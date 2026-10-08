const crypto = require("crypto");
const { db, admin } = require("../lib/firebaseAdmin");

const PRECO_AIRCLEAN = 99.9;
const PRODUTO_ID = "airclean-as228";
const PRODUTO_NOME = "Mini Aspirador AirClean 3 em 1";

// Mantenha true enquanto terminamos e testamos o fluxo.
// Só mudaremos para false quando o pagamento real estiver validado.
const TESTE_PIX_MERCADO_PAGO = true;
const TESTE_EMAIL = "test_user_br@testuser.com";
const TESTE_FIRST_NAME = "APRO";

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
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
console.log("=== MERCADO PAGO CONSULTA ORDER ===");
console.log("HTTP:", response.status);
console.log("RESPOSTA:", raw);
console.log("==================================");

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
        message: "Access Token do Mercado Pago inválido.",
      });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const {
      nome,
      cpf,
      email,
      telefone,
      cep,
      rua,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
    } = body;

    if (
      !nome ||
      !cpf ||
      !email ||
      !telefone ||
      !cep ||
      !rua ||
      !numero ||
      !bairro ||
      !cidade ||
      !estado
    ) {
      return res.status(400).json({
        success: false,
        message: "Preencha todos os dados obrigatórios.",
      });
    }

    const nomeComprador = String(nome).trim();
    const cpfComprador = somenteNumeros(cpf);
    const emailComprador = String(email).trim().toLowerCase();
    const telefoneComprador = somenteNumeros(telefone);
    const cepComprador = somenteNumeros(cep);

    if (nomeComprador.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Nome inválido.",
      });
    }

    if (cpfComprador.length !== 11) {
      return res.status(400).json({
        success: false,
        message: "CPF inválido.",
      });
    }

    if (
      !emailComprador.includes("@") ||
      !emailComprador.includes(".")
    ) {
      return res.status(400).json({
        success: false,
        message: "E-mail inválido.",
      });
    }

    if (telefoneComprador.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Telefone inválido.",
      });
    }

    if (cepComprador.length !== 8) {
      return res.status(400).json({
        success: false,
        message: "CEP inválido.",
      });
    }

    /*
      IMPORTANTE:
      O navegador NÃO escolhe o preço.
      O servidor sempre cobra o valor definido aqui.
    */
    const valorNumber = Number(PRECO_AIRCLEAN.toFixed(2));
    const valorMercadoPago = valorNumber.toFixed(2);

    const pedidoRef = db.collection("pedidos_loja").doc();
    const pedidoId = pedidoRef.id;

    await pedidoRef.set({
      tipo: "airclean_produto",

      produto: {
        id: PRODUTO_ID,
        nome: PRODUTO_NOME,
        modelo: "AS-228",
        quantidade: 1,
      },

      cliente: {
        nome: nomeComprador,
        cpf: cpfComprador,
        email: emailComprador,
        telefone: telefoneComprador,
      },

      entrega: {
        cep: cepComprador,
        rua: String(rua).trim(),
        numero: String(numero).trim(),
        complemento: complemento
          ? String(complemento).trim()
          : "",
        bairro: String(bairro).trim(),
        cidade: String(cidade).trim(),
        estado: String(estado).trim().toUpperCase(),
      },

      valorReais: valorNumber,
      valorCentavos: Math.round(valorNumber * 100),

      pagamentoStatus: "creating",
      pedidoStatus: "aguardando_pagamento",

      order_nsu: pedidoId,

      provedorPagamento: "mercadopago",
      mercadoPagoApi: "orders",

      ambienteMercadoPago: TESTE_PIX_MERCADO_PAGO
        ? "teste"
        : "producao",

      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    const idempotencyKey = crypto.randomUUID();

    /*
      Enquanto TESTE_PIX_MERCADO_PAGO = true,
      mantemos o payer de teste que você já estava usando.
    */
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

      external_reference: pedidoId,

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

    console.log("Criando Pix AirClean:", {
      pedidoId,
      valor: valorMercadoPago,
      ambiente: TESTE_PIX_MERCADO_PAGO
        ? "teste"
        : "producao",
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
      console.error("Erro Mercado Pago AirClean:", mpData);

      await pedidoRef.update({
        pagamentoStatus: "checkout_error",
        pedidoStatus: "erro_pagamento",

        erroMercadoPago: mpData,
        payloadMercadoPago,

        atualizadoEm:
          admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(mpResponse.status).json({
        success: false,
        message: "Erro ao criar Pix no Mercado Pago.",
        details: mpData,
      });
    }

    /*
      Assim como no create-pix.js original, a Order pode
      ser criada antes do QR Code ficar disponível.

      Portanto consultamos novamente por alguns segundos.
    */

    let orderFinal = mpData;
    let dadosPix = extrairDadosPix(orderFinal);

    if (
      !dadosPix.qrCode &&
      dadosPix.orderId &&
      !dadosPix.approved
    ) {
      for (let tentativa = 1; tentativa <= 10; tentativa++) {
        await esperar(700);

        const consulta = await consultarOrderMercadoPago(
          dadosPix.orderId,
          accessToken
        );

        if (!consulta.ok) {
          console.log(
            `Consulta AirClean ${tentativa}/10 falhou:`,
            consulta.statusCode
          );

          continue;
        }

        orderFinal = consulta.data;
        dadosPix = extrairDadosPix(orderFinal);

        if (dadosPix.qrCode || dadosPix.approved) {
          break;
        }
      }
    }

    const {
      orderId,
      paymentId,
      orderStatus,
      orderStatusDetail,
      paymentStatus,
      paymentStatusDetail,
      approved,
      qrCode,
      qrCodeBase64,
      ticketUrl,
    } = dadosPix;

    await pedidoRef.update({
      mercadoPagoOrderId: orderId,
      mercadoPagoPaymentId: paymentId,

      pagamentoStatus: approved
        ? "approved"
        : paymentStatus || orderStatus || "pending",

      pagamentoStatusDetail:
        paymentStatusDetail || orderStatusDetail || null,

      pedidoStatus: approved
        ? "pago"
        : "aguardando_pagamento",

      mercadoPagoOrderStatus: orderStatus,
      mercadoPagoOrderStatusDetail:
        orderStatusDetail || null,

      mercadoPagoPaymentStatus:
        paymentStatus || null,

      qrCode: qrCode || null,
      qrCodeBase64: qrCodeBase64 || null,
      ticketUrl: ticketUrl || null,

      idempotencyKey,

      payloadMercadoPago,
      respostaMercadoPago: orderFinal,

      ...(approved
        ? {
            pagoEm:
              admin.firestore.FieldValue.serverTimestamp(),
          }
        : {}),

      atualizadoEm:
        admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,

      teste: TESTE_PIX_MERCADO_PAGO,

      pedido_id: pedidoId,
      order_nsu: pedidoId,

      order_id: orderId,

      payment_id: paymentId || orderId,

      approved,

      status: approved
        ? "approved"
        : paymentStatus || orderStatus || "pending",

      status_detail:
        paymentStatusDetail || orderStatusDetail || "",

      valor: valorNumber,

      qr_code: qrCode || "",
      qr_code_base64: qrCodeBase64 || "",
      ticket_url: ticketUrl || "",

      processing: !qrCode && !approved,
    });
  } catch (error) {
    console.error("Erro ao criar Pix AirClean:", error);

    return res.status(500).json({
      success: false,
      message: "Erro interno ao criar Pix da loja.",
      error: String(error),
    });
  }
};