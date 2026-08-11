const crypto = require("crypto");
const { db, admin } = require("../lib/firebaseAdmin");

const PRECO_BONDE62_LOTE_SECRETO = 1;
const PUBLIC_BASE_URL = "https://bol-o-rouge.vercel.app";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Método não permitido.",
    });
  }

  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        message: "MERCADO_PAGO_ACCESS_TOKEN não configurado na Vercel.",
      });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const {
      nome,
      email,
      whatsapp,
      quantidade,
      evento,
      lote,
    } = body || {};

    if (!nome || !email || !whatsapp) {
      return res.status(400).json({
        success: false,
        message: "Nome, e-mail e WhatsApp são obrigatórios.",
      });
    }

    let qtd = Number(quantidade || 1);

    if (!qtd || qtd < 1) {
      qtd = 1;
    }

    if (qtd > 10) {
      return res.status(400).json({
        success: false,
        message: "Quantidade máxima de 10 ingressos por compra.",
      });
    }

    const valorNumber = Number(
      (qtd * PRECO_BONDE62_LOTE_SECRETO).toFixed(2)
    );

    const pagamentoRef = db.collection("pagamentos").doc();
    const orderNsu = pagamentoRef.id;

    const descricao =
      qtd === 1
        ? "Ingresso Bonde 62 - Lote Secreto"
        : `${qtd} ingressos Bonde 62 - Lote Secreto`;

    await pagamentoRef.set({
      tipo: "bonde62_ingresso",
      evento: evento || "bonde62",
      lote: lote || "lote_secreto",
      quantidade: qtd,

      nome: nome.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim(),

      valorReais: valorNumber,
      valorCentavos: Math.round(valorNumber * 100),

      status: "pending",
      ingressoStatus: "pending",

      order_nsu: orderNsu,

      provedorPagamento: "mercadopago",

      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    const idempotencyKey = crypto.randomUUID();

    const payloadMercadoPago = {
      transaction_amount: valorNumber,
      description: descricao,
      payment_method_id: "pix",

      external_reference: orderNsu,

      notification_url:
        `${PUBLIC_BASE_URL}/api/webhook-mercadopago`,

      payer: {
        email: email.trim(),
        first_name: nome.trim(),
      },

      metadata: {
        order_nsu: orderNsu,
        tipo: "bonde62_ingresso",
        evento: "bonde62",
        lote: lote || "lote_secreto",
        quantidade: qtd,
        whatsapp: whatsapp.trim(),
      },
    };

    const mpResponse = await fetch(
      "https://api.mercadopago.com/v1/payments",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },

        body: JSON.stringify(payloadMercadoPago),
      }
    );

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      await pagamentoRef.update({
        status: "checkout_error",
        erroMercadoPago: mpData,
        atualizadoEm:
          admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(mpResponse.status).json({
        success: false,
        message: "Erro ao criar Pix no Mercado Pago.",
        details: mpData,
      });
    }

    const transactionData =
      mpData?.point_of_interaction?.transaction_data || {};

    const qrCode = transactionData.qr_code || null;
    const qrCodeBase64 = transactionData.qr_code_base64 || null;
    const ticketUrl = transactionData.ticket_url || null;

    if (!qrCode) {
      await pagamentoRef.update({
        status: "pix_error",
        respostaMercadoPago: mpData,
        atualizadoEm:
          admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(400).json({
        success: false,
        message: "Mercado Pago não retornou o código Pix.",
        details: mpData,
      });
    }

    await pagamentoRef.update({
      mercadoPagoPaymentId: String(mpData.id),

      status: mpData.status || "pending",

      qrCode,
      qrCodeBase64,
      ticketUrl,

      payloadMercadoPago,
      respostaMercadoPago: mpData,

      atualizadoEm:
        admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,

      order_nsu: orderNsu,

      payment_id: String(mpData.id),

      status: mpData.status,

      valor: valorNumber,

      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      ticket_url: ticketUrl,
    });
  } catch (error) {
    console.error("Erro ao criar Pix Mercado Pago:", error);

    return res.status(500).json({
      success: false,
      message: "Erro interno ao criar Pix.",
      error: String(error),
    });
  }
};