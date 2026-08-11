const crypto = require("crypto");
const { db, admin } = require("../lib/firebaseAdmin");

const PRECO_BONDE62_LOTE_SECRETO = 1;

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
        message: "MERCADO_PAGO_ACCESS_TOKEN não configurado.",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { nome, email, whatsapp, quantidade, evento, lote } = body || {};

    if (!nome || !email || !whatsapp) {
      return res.status(400).json({
        success: false,
        message: "Nome, e-mail e WhatsApp são obrigatórios.",
      });
    }

    let qtd = Number(quantidade || 1);
    if (!Number.isFinite(qtd) || qtd < 1) qtd = 1;
    qtd = Math.floor(qtd);

    if (qtd > 10) {
      return res.status(400).json({
        success: false,
        message: "Quantidade máxima de 10 ingressos por compra.",
      });
    }

    const valorNumber = Number((qtd * PRECO_BONDE62_LOTE_SECRETO).toFixed(2));
    const valorString = valorNumber.toFixed(2);

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
      descricao,
      valorReais: valorNumber,
      valorCentavos: Math.round(valorNumber * 100),
      status: "creating",
      ingressoStatus: "pending",
      order_nsu: orderNsu,
      provedorPagamento: "mercadopago",
      mercadoPagoApi: "orders",
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    const idempotencyKey = crypto.randomUUID();

    const payloadMercadoPago = {
      type: "online",
      total_amount: valorString,
      external_reference: orderNsu,
      processing_mode: "automatic",
      transactions: {
        payments: [
          {
            amount: valorString,
            payment_method: {
              id: "pix",
              type: "bank_transfer",
            },
          },
        ],
      },
      payer: {
        email: email.trim(),
      },
    };

    const mpResponse = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payloadMercadoPago),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      await pagamentoRef.update({
        status: "checkout_error",
        erroMercadoPago: mpData,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(mpResponse.status).json({
        success: false,
        message: "Erro ao criar Pix no Mercado Pago.",
        details: mpData,
      });
    }

    const payment = mpData?.transactions?.payments?.[0] || {};
    const paymentMethod = payment?.payment_method || {};

    const qrCode = paymentMethod.qr_code || null;
    const qrCodeBase64 = paymentMethod.qr_code_base64 || null;
    const ticketUrl = paymentMethod.ticket_url || null;

    const orderId = mpData?.id ? String(mpData.id) : null;
    const paymentId = payment?.id ? String(payment.id) : null;

    const orderStatus = mpData?.status || "action_required";
    const orderStatusDetail =
      mpData?.status_detail || payment?.status_detail || "waiting_transfer";

    if (!qrCode) {
      await pagamentoRef.update({
        status: "pix_error",
        mercadoPagoOrderId: orderId,
        mercadoPagoPaymentId: paymentId,
        respostaMercadoPago: mpData,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(400).json({
        success: false,
        message: "Mercado Pago não retornou o código Pix.",
        details: mpData,
      });
    }

    await pagamentoRef.update({
      mercadoPagoOrderId: orderId,
      mercadoPagoPaymentId: paymentId,
      status: orderStatus,
      statusDetail: orderStatusDetail,
      qrCode,
      qrCodeBase64,
      ticketUrl,
      payloadMercadoPago,
      respostaMercadoPago: mpData,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      order_nsu: orderNsu,
      payment_id: paymentId || orderId,
      order_id: orderId,
      status: orderStatus,
      status_detail: orderStatusDetail,
      valor: valorNumber,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      ticket_url: ticketUrl,
    });
  } catch (error) {
    console.error("Erro ao criar Pix Mercado Pago Orders:", error);

    return res.status(500).json({
      success: false,
      message: "Erro interno ao criar Pix.",
      error: String(error),
    });
  }
};