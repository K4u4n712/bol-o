const crypto = require("crypto");
const { db, admin } = require("../lib/firebaseAdmin");

const PRECO_BONDE62_LOTE_SECRETO = 1;

// Dados predefinidos pelo Mercado Pago para teste de Pix via API Orders.
// Em produção, estes dados devem voltar a vir do comprador real.
const TESTE_PIX_MERCADO_PAGO = true;
const TESTE_EMAIL = "test_user_br@testuser.com";
const TESTE_FIRST_NAME = "APRO";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Idempotency-Key"
  );

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

    if (!accessToken.startsWith("APP_USR")) {
      return res.status(500).json({
        success: false,
        message:
          "O Access Token configurado não é o token da nova aplicação Checkout Transparente via API Orders.",
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

    if (!Number.isFinite(qtd) || qtd < 1) {
      qtd = 1;
    }

    qtd = Math.floor(qtd);

    if (qtd > 10) {
      return res.status(400).json({
        success: false,
        message: "Quantidade máxima de 10 ingressos por compra.",
      });
    }

    const valorNumber = Number(
      (qtd * PRECO_BONDE62_LOTE_SECRETO).toFixed(2)
    );

    const valorMercadoPago = valorNumber.toFixed(2);

    const pagamentoRef = db.collection("pagamentos").doc();
    const orderNsu = pagamentoRef.id;

    const descricao =
      qtd === 1
        ? "Ingresso Bonde 62 - Lote Secreto"
        : `${qtd} ingressos Bonde 62 - Lote Secreto`;

    const nomeComprador = String(nome).trim();
    const emailComprador = String(email).trim();
    const whatsappComprador = String(whatsapp).trim();

    await pagamentoRef.set({
      tipo: "bonde62_ingresso",
      evento: evento || "bonde62",
      lote: lote || "lote_secreto",
      quantidade: qtd,

      nome: nomeComprador,
      email: emailComprador,
      whatsapp: whatsappComprador,

      descricao,

      valorReais: valorNumber,
      valorCentavos: Math.round(valorNumber * 100),

      status: "creating",
      ingressoStatus: "pending",

      order_nsu: orderNsu,

      provedorPagamento: "mercadopago",
      mercadoPagoApi: "orders",
      ambienteMercadoPago: TESTE_PIX_MERCADO_PAGO ? "teste" : "producao",

      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    const idempotencyKey = crypto.randomUUID();

    // Para o teste oficial de Pix do Mercado Pago:
    // payer.email = test_user_br@testuser.com
    // payer.first_name = APRO
    // O Mercado Pago cria a order como action_required e depois
    // atualiza automaticamente o pagamento para aprovado.
    const payer = TESTE_PIX_MERCADO_PAGO
      ? {
          email: TESTE_EMAIL,
          first_name: TESTE_FIRST_NAME,
        }
      : {
          email: emailComprador,
          first_name: nomeComprador,
        };

    const payloadMercadoPago = {
      type: "online",
      processing_mode: "automatic",
      external_reference: orderNsu,
      total_amount: valorMercadoPago,

      payer,

      transactions: {
        payments: [
          {
            amount: valorMercadoPago,
            payment_method: {
              id: "pix",
              type: "bank_transfer",
            },
            expiration_time: "PT30M",
          },
        ],
      },
    };

    console.log("Criando Pix via Mercado Pago Orders:", {
      orderNsu,
      valor: valorMercadoPago,
      ambiente: TESTE_PIX_MERCADO_PAGO ? "teste" : "producao",
      payer,
    });

    const mpResponse = await fetch(
      "https://api.mercadopago.com/v1/orders",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payloadMercadoPago),
      }
    );

    const raw = await mpResponse.text();

    let mpData;
    try {
      mpData = raw ? JSON.parse(raw) : {};
    } catch {
      mpData = {
        message: "Resposta inválida do Mercado Pago.",
        raw,
      };
    }

    if (!mpResponse.ok) {
      console.error("Erro Mercado Pago Orders:", mpData);

      await pagamentoRef.update({
        status: "checkout_error",
        erroMercadoPago: mpData,
        payloadMercadoPago,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(mpResponse.status).json({
        success: false,
        message: "Erro ao criar Pix no Mercado Pago.",
        details: mpData,
      });
    }

    const pagamentoMercadoPago =
      mpData?.transactions?.payments?.[0] || {};

    const paymentMethod =
      pagamentoMercadoPago?.payment_method || {};

    const qrCode = paymentMethod.qr_code || null;
    const qrCodeBase64 = paymentMethod.qr_code_base64 || null;
    const ticketUrl = paymentMethod.ticket_url || null;

    const mercadoPagoOrderId = mpData?.id
      ? String(mpData.id)
      : null;

    const mercadoPagoPaymentId = pagamentoMercadoPago?.id
      ? String(pagamentoMercadoPago.id)
      : null;

    const statusOrder =
      mpData?.status || "action_required";

    const statusDetailOrder =
      mpData?.status_detail || "waiting_transfer";

    const statusPagamento =
      pagamentoMercadoPago?.status || statusOrder;

    const statusDetailPagamento =
      pagamentoMercadoPago?.status_detail || statusDetailOrder;

    if (!qrCode) {
      console.error(
        "Order criada, mas o Mercado Pago não retornou QR Code:",
        mpData
      );

      await pagamentoRef.update({
        status: "pix_error",
        mercadoPagoOrderId,
        mercadoPagoPaymentId,
        respostaMercadoPago: mpData,
        payloadMercadoPago,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(400).json({
        success: false,
        message:
          "A order foi criada, mas o Mercado Pago não retornou o código Pix.",
        details: mpData,
      });
    }

    await pagamentoRef.update({
      mercadoPagoOrderId,
      mercadoPagoPaymentId,

      status: statusPagamento,
      statusDetail: statusDetailPagamento,

      mercadoPagoOrderStatus: statusOrder,
      mercadoPagoOrderStatusDetail: statusDetailOrder,

      qrCode,
      qrCodeBase64,
      ticketUrl,

      idempotencyKey,

      payloadMercadoPago,
      respostaMercadoPago: mpData,

      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,

      teste: TESTE_PIX_MERCADO_PAGO,

      order_nsu: orderNsu,
      order_id: mercadoPagoOrderId,

      payment_id:
        mercadoPagoPaymentId || mercadoPagoOrderId,

      status: statusPagamento,
      status_detail: statusDetailPagamento,

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