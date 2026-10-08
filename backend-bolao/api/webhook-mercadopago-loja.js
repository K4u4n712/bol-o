const crypto = require("crypto");
const { db, admin } = require("../lib/firebaseAdmin");

const PRECO_AIRCLEAN_CENTAVOS = 9990;

function valorEmCentavos(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100);
}

function extrairAssinatura(xSignature) {
  const partes = String(xSignature || "").split(",");
  let ts = "";
  let v1 = "";

  for (const parte of partes) {
    const [chave, ...resto] = parte.split("=");
    const valor = resto.join("=").trim();

    if (chave?.trim() === "ts") ts = valor;
    if (chave?.trim() === "v1") v1 = valor;
  }

  return { ts, v1 };
}

function assinaturaValida({ xSignature, xRequestId, dataId, secret }) {
  if (!xSignature || !xRequestId || !dataId || !secret) return false;

  const { ts, v1 } = extrairAssinatura(xSignature);
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const calculada = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    const recebidaBuffer = Buffer.from(v1, "hex");
    const calculadaBuffer = Buffer.from(calculada, "hex");

    if (recebidaBuffer.length !== calculadaBuffer.length) return false;

    return crypto.timingSafeEqual(recebidaBuffer, calculadaBuffer);
  } catch {
    return false;
  }
}

async function consultarOrder(orderId, accessToken) {
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
    data = { raw };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function extrairStatus(order) {
  const pagamento = order?.transactions?.payments?.[0] || {};

  const orderStatus = String(order?.status || "");
  const orderStatusDetail = String(order?.status_detail || "");
  const paymentStatus = String(pagamento?.status || "");
  const paymentStatusDetail = String(pagamento?.status_detail || "");

  const aprovado =
    paymentStatus === "approved" ||
    orderStatus === "approved" ||
    paymentStatusDetail === "accredited" ||
    orderStatusDetail === "accredited";

  return {
    pagamento,
    orderStatus,
    orderStatusDetail,
    paymentStatus,
    paymentStatusDetail,
    aprovado,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Método não permitido.",
    });
  }

  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

    if (!accessToken || !webhookSecret) {
      console.error("Variáveis do Mercado Pago não configuradas.");

      return res.status(500).json({
        success: false,
        message: "Configuração do Mercado Pago incompleta.",
      });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const dataId = String(
      req.query?.["data.id"] ||
        req.query?.data_id ||
        body?.data?.id ||
        ""
    );

    const tipo = String(req.query?.type || body?.type || "");

    /*
      Este endpoint pertence somente à integração Orders da loja.
      Outros tipos de notificação são reconhecidos e ignorados.
    */
    if (tipo && tipo !== "order") {
      return res.status(200).json({
        success: true,
        ignored: true,
      });
    }

    if (!dataId) {
      return res.status(400).json({
        success: false,
        message: "Notificação sem ID da order.",
      });
    }

    const xSignature = req.headers["x-signature"];
    const xRequestId = req.headers["x-request-id"];

    if (
      !assinaturaValida({
        xSignature,
        xRequestId,
        dataId,
        secret: webhookSecret,
      })
    ) {
      console.warn("Webhook Mercado Pago com assinatura inválida.");

      return res.status(401).json({
        success: false,
        message: "Assinatura inválida.",
      });
    }

    /*
      Não confiamos no status recebido no webhook.
      Consultamos a Order diretamente na API do Mercado Pago.
    */
    const consulta = await consultarOrder(dataId, accessToken);

    if (!consulta.ok) {
      console.error(
        "Falha ao consultar Order do Mercado Pago:",
        consulta.status,
        consulta.data
      );

      return res.status(500).json({
        success: false,
        message: "Não foi possível confirmar a order no Mercado Pago.",
      });
    }

    const order = consulta.data;
    const orderId = String(order?.id || dataId);
    const pedidoId = String(order?.external_reference || "");

    if (!pedidoId) {
      console.warn("Order sem external_reference:", orderId);

      return res.status(200).json({
        success: true,
        ignored: true,
        message: "Order sem pedido da loja associado.",
      });
    }

    const pedidoRef = db.collection("pedidos_loja").doc(pedidoId);
    const pedidoSnap = await pedidoRef.get();

    if (!pedidoSnap.exists) {
      console.warn("Pedido da loja não encontrado:", pedidoId);

      return res.status(200).json({
        success: true,
        ignored: true,
        message: "Pedido da loja não encontrado.",
      });
    }

    const pedido = pedidoSnap.data();

    /*
      Impede que uma Order de outro fluxo seja usada para alterar
      um pedido AirClean.
    */
    if (
      pedido?.tipo !== "airclean_produto" ||
      pedido?.provedorPagamento !== "mercadopago" ||
      pedido?.mercadoPagoApi !== "orders"
    ) {
      console.warn("Pedido incompatível com webhook da loja:", pedidoId);

      return res.status(200).json({
        success: true,
        ignored: true,
      });
    }

    /*
      Confere se a Order consultada é exatamente a que foi salva
      quando o Pix foi criado.
    */
    if (
      pedido?.mercadoPagoOrderId &&
      String(pedido.mercadoPagoOrderId) !== orderId
    ) {
      console.error("Order ID não corresponde ao pedido:", {
        pedidoId,
        esperado: pedido.mercadoPagoOrderId,
        recebido: orderId,
      });

      return res.status(409).json({
        success: false,
        message: "Order não corresponde ao pedido.",
      });
    }

    const totalCentavos = valorEmCentavos(order?.total_amount);

    if (
      totalCentavos !== PRECO_AIRCLEAN_CENTAVOS ||
      Number(pedido?.valorCentavos) !== PRECO_AIRCLEAN_CENTAVOS
    ) {
      console.error("Valor divergente no pagamento AirClean:", {
        pedidoId,
        totalCentavos,
        pedidoCentavos: pedido?.valorCentavos,
      });

      await pedidoRef.update({
        pagamentoStatus: "value_mismatch",
        pedidoStatus: "erro_pagamento",
        mercadoPagoOrderId: orderId,
        respostaWebhookMercadoPago: order,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(409).json({
        success: false,
        message: "Valor da cobrança não corresponde ao pedido.",
      });
    }

    const {
      pagamento,
      orderStatus,
      orderStatusDetail,
      paymentStatus,
      paymentStatusDetail,
      aprovado,
    } = extrairStatus(order);

    const atualizacaoBase = {
      mercadoPagoOrderId: orderId,
      mercadoPagoPaymentId: pagamento?.id
        ? String(pagamento.id)
        : pedido?.mercadoPagoPaymentId || null,

      mercadoPagoOrderStatus: orderStatus || null,
      mercadoPagoOrderStatusDetail: orderStatusDetail || null,
      mercadoPagoPaymentStatus: paymentStatus || null,

      pagamentoStatusDetail:
        paymentStatusDetail || orderStatusDetail || null,

      ultimaNotificacaoMercadoPago: {
        id: body?.id || null,
        action: body?.action || null,
        type: body?.type || tipo || "order",
        live_mode:
          typeof body?.live_mode === "boolean" ? body.live_mode : null,
        date_created: body?.date_created || null,
      },

      respostaWebhookMercadoPago: order,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    /*
      Idempotência:
      se o pedido já estiver pago, uma repetição do webhook não
      cria uma segunda venda nem volta o status para pending.
    */
    if (pedido?.pedidoStatus === "pago") {
      await pedidoRef.update(atualizacaoBase);

      return res.status(200).json({
        success: true,
        paid: true,
        duplicate: true,
      });
    }

    if (aprovado) {
      await pedidoRef.update({
        ...atualizacaoBase,
        pagamentoStatus: "approved",
        pedidoStatus: "pago",
        pagoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("Pagamento AirClean confirmado:", {
        pedidoId,
        orderId,
      });

      return res.status(200).json({
        success: true,
        paid: true,
      });
    }

    /*
      Atualiza o estado real do Mercado Pago, mas NÃO marca como pago.
    */
    await pedidoRef.update({
      ...atualizacaoBase,
      pagamentoStatus:
        paymentStatus || orderStatus || pedido?.pagamentoStatus || "pending",
      pedidoStatus: "aguardando_pagamento",
    });

    return res.status(200).json({
      success: true,
      paid: false,
      status: paymentStatus || orderStatus || "pending",
    });
  } catch (error) {
    console.error("Erro no webhook Mercado Pago AirClean:", error);

    return res.status(500).json({
      success: false,
      message: "Erro interno ao processar webhook.",
    });
  }
};