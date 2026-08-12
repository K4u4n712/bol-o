const crypto = require("crypto");
const { db, admin } = require("../lib/firebaseAdmin");

const PRECO_BONDE62_LOTE_SECRETO = 1;

// Dados predefinidos pelo Mercado Pago para teste de Pix via API Orders.
// Em produção, estes dados devem voltar a vir do comprador real.
const TESTE_PIX_MERCADO_PAGO = true;
const TESTE_EMAIL = "test_user_br@testuser.com";
const TESTE_FIRST_NAME = "APRO";

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extrairDadosPix(orderData) {
  const pagamento = orderData?.transactions?.payments?.[0] || {};
  const paymentMethod = pagamento?.payment_method || {};

  const orderStatus = orderData?.status || "";
  const orderStatusDetail = orderData?.status_detail || "";

  const paymentStatus = pagamento?.status || orderStatus || "pending";
  const paymentStatusDetail =
    pagamento?.status_detail || orderStatusDetail || "";

  const approved =
    paymentStatus === "approved" ||
    orderStatus === "approved" ||
    paymentStatusDetail === "accredited" ||
    orderStatusDetail === "accredited";

  return {
    pagamento,
    paymentMethod,

    orderId: orderData?.id ? String(orderData.id) : null,
    paymentId: pagamento?.id ? String(pagamento.id) : null,

    orderStatus: orderStatus || "pending",
    orderStatusDetail: orderStatusDetail || "",

    paymentStatus,
    paymentStatusDetail,

    approved,

    qrCode: paymentMethod?.qr_code || null,
    qrCodeBase64: paymentMethod?.qr_code_base64 || null,
    ticketUrl: paymentMethod?.ticket_url || null,
  };
}

async function consultarOrderMercadoPago(orderId, accessToken) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const raw = await response.text();

  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {
      message: "Resposta inválida ao consultar a order.",
      raw,
    };
  }

  return {
    ok: response.ok,
    statusCode: response.status,
    data,
  };
}

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
          "O Access Token configurado não é o token da aplicação Checkout Transparente via API Orders.",
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
      userId,
      userEmail,
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
    const emailNormalizado = emailComprador.toLowerCase();
    const whatsappComprador = String(whatsapp).trim();

    // Estes campos são apenas informativos nesta etapa.
    // A autorização da tela "Meus Ingressos" é feita no backend
    // pelo token real do Firebase, nunca confiando apenas no body.
    const userIdInformado = userId ? String(userId).trim() : null;
    const userEmailInformado = userEmail
      ? String(userEmail).trim().toLowerCase()
      : null;

    await pagamentoRef.set({
      tipo: "bonde62_ingresso",
      evento: evento || "bonde62",
      lote: lote || "lote_secreto",
      quantidade: qtd,

      nome: nomeComprador,
      email: emailComprador,
      emailNormalizado,
      whatsapp: whatsappComprador,

      userIdInformado,
      userEmailInformado,

      descricao,

      valorReais: valorNumber,
      valorCentavos: Math.round(valorNumber * 100),

      status: "creating",
      ingressoStatus: "pending",

      order_nsu: orderNsu,

      provedorPagamento: "mercadopago",
      mercadoPagoApi: "orders",
      ambienteMercadoPago: TESTE_PIX_MERCADO_PAGO
        ? "teste"
        : "producao",

      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    const idempotencyKey = crypto.randomUUID();

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
      ambiente: TESTE_PIX_MERCADO_PAGO
        ? "teste"
        : "producao",
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

    /*
      IMPORTANTE:
      A API Orders pode criar a order e ainda não devolver todos os
      dados da transação imediatamente.

      Antes, este arquivo devolvia erro 400 se qr_code viesse vazio.
      Agora, quando isso acontecer, consultamos GET /v1/orders/{id}
      por alguns segundos para buscar a versão atualizada da order.
    */

    let orderFinal = mpData;
    let dadosPix = extrairDadosPix(orderFinal);

    if (!dadosPix.qrCode && dadosPix.orderId && !dadosPix.approved) {
      console.log(
        "Order criada sem QR imediato. Consultando order atualizada:",
        dadosPix.orderId
      );

      // Até ~7 segundos de espera no máximo.
      for (let tentativa = 1; tentativa <= 10; tentativa++) {
        await esperar(700);

        const consulta = await consultarOrderMercadoPago(
          dadosPix.orderId,
          accessToken
        );

        if (!consulta.ok) {
          console.log(
            `Consulta ${tentativa}/10 falhou:`,
            consulta.statusCode,
            consulta.data
          );
          continue;
        }

        orderFinal = consulta.data;
        dadosPix = extrairDadosPix(orderFinal);

        console.log(`Consulta ${tentativa}/10:`, {
          orderStatus: dadosPix.orderStatus,
          paymentStatus: dadosPix.paymentStatus,
          temQrCode: Boolean(dadosPix.qrCode),
          approved: dadosPix.approved,
        });

        // Se o QR apareceu, já podemos retornar.
        if (dadosPix.qrCode) {
          break;
        }

        // No teste APRO, pode aprovar tão rápido que nem precisamos do QR.
        if (dadosPix.approved) {
          break;
        }
      }
    }

    const {
      orderId: mercadoPagoOrderId,
      paymentId: mercadoPagoPaymentId,
      orderStatus: statusOrder,
      orderStatusDetail: statusDetailOrder,
      paymentStatus: statusPagamento,
      paymentStatusDetail: statusDetailPagamento,
      approved,
      qrCode,
      qrCodeBase64,
      ticketUrl,
    } = dadosPix;

    await pagamentoRef.update({
      mercadoPagoOrderId,
      mercadoPagoPaymentId,

      status: approved
        ? "approved"
        : statusPagamento || statusOrder || "pending",

      statusDetail:
        statusDetailPagamento || statusDetailOrder || null,

      ingressoStatus: approved
        ? "confirmed"
        : "pending",

      mercadoPagoOrderStatus: statusOrder,
      mercadoPagoOrderStatusDetail:
        statusDetailOrder || null,

      mercadoPagoPaymentStatus:
        statusPagamento || null,

      qrCode: qrCode || null,
      qrCodeBase64: qrCodeBase64 || null,
      ticketUrl: ticketUrl || null,

      idempotencyKey,

      payloadMercadoPago,
      respostaMercadoPago: orderFinal,

      ...(approved
        ? {
            aprovadoEm:
              admin.firestore.FieldValue.serverTimestamp(),
          }
        : {}),

      atualizadoEm:
        admin.firestore.FieldValue.serverTimestamp(),
    });

    /*
      Não devolvemos mais erro 400 simplesmente porque o QR ainda não
      chegou. Se a order existe, o frontend recebe order_id e pode usar
      o check-pix.js para continuar consultando o status.
    */
    return res.status(200).json({
      success: true,

      teste: TESTE_PIX_MERCADO_PAGO,

      order_nsu: orderNsu,
      order_id: mercadoPagoOrderId,

      payment_id:
        mercadoPagoPaymentId || mercadoPagoOrderId,

      approved,

      status: approved
        ? "approved"
        : statusPagamento || statusOrder || "pending",

      status_detail:
        statusDetailPagamento ||
        statusDetailOrder ||
        "",

      valor: valorNumber,

      qr_code: qrCode || "",
      qr_code_base64: qrCodeBase64 || "",
      ticket_url: ticketUrl || "",

      // Ajuda a identificar no console quando a order ainda está atualizando.
      processing: !qrCode && !approved,
    });
  } catch (error) {
    console.error(
      "Erro ao criar Pix Mercado Pago Orders:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Erro interno ao criar Pix.",
      error: String(error),
    });
  }
};