const QRCode = require("qrcode");
const { db, admin } = require("../lib/firebaseAdmin");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Método não permitido.",
    });
  }

  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const orderId = String(req.query?.order_id || "").trim();
    const orderNsu = String(req.query?.order_nsu || "").trim();

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        message: "MERCADO_PAGO_ACCESS_TOKEN não configurado.",
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "order_id é obrigatório.",
      });
    }

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const raw = await mpResponse.text();

    let mpData;

    try {
      mpData = raw ? JSON.parse(raw) : {};
    } catch {
      mpData = { raw };
    }

    if (!mpResponse.ok) {
      return res.status(mpResponse.status).json({
        success: false,
        message: "Erro ao consultar a order no Mercado Pago.",
        details: mpData,
      });
    }

    const payment = mpData?.transactions?.payments?.[0] || {};

    const orderStatus = mpData?.status || "";
    const paymentStatus = payment?.status || "";
    const statusDetail =
      payment?.status_detail || mpData?.status_detail || "";

    const approved =
      paymentStatus === "approved" ||
      orderStatus === "approved" ||
      statusDetail === "accredited";

    let ticketQrBase64 = null;
    let ticketCode = null;

    if (approved) {
      const identificadorSeguro = orderNsu || orderId;

      ticketCode = orderNsu
        ? `B62-${orderNsu.slice(0, 10).toUpperCase()}`
        : `B62-${String(orderId).slice(-10).toUpperCase()}`;

      /*
        O QR NÃO contém nome, e-mail ou valor.
        Ele carrega apenas um identificador interno que depois
        será consultado pelo validador da portaria.
      */
      const qrPayload = JSON.stringify({
        type: "BONDE62_TICKET",
        id: identificadorSeguro,
        code: ticketCode,
      });

      ticketQrBase64 = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 420,
      });
    }

    if (orderNsu) {
      try {
        const pagamentoRef = db.collection("pagamentos").doc(orderNsu);

        const dadosAtualizacao = {
          status: approved
            ? "approved"
            : paymentStatus || orderStatus || "pending",

          statusDetail: statusDetail || null,

          ingressoStatus: approved
            ? "confirmed"
            : "pending",

          mercadoPagoOrderStatus: orderStatus || null,
          mercadoPagoPaymentStatus: paymentStatus || null,

          respostaConsultaMercadoPago: mpData,

          atualizadoEm:
            admin.firestore.FieldValue.serverTimestamp(),
        };

        if (approved) {
          dadosAtualizacao.aprovadoEm =
            admin.firestore.FieldValue.serverTimestamp();

          dadosAtualizacao.ingressoCodigo = ticketCode;
          dadosAtualizacao.ingressoQrPayload = {
            type: "BONDE62_TICKET",
            id: orderNsu,
            code: ticketCode,
          };

          /*
            Não salvamos a imagem Base64 no Firestore.
            Guardamos apenas os dados do QR e geramos a imagem
            quando a tela consulta o pagamento.
          */
        }

        await pagamentoRef.set(
          dadosAtualizacao,
          { merge: true }
        );
      } catch (firestoreError) {
        console.error(
          "Erro ao atualizar Firestore:",
          firestoreError
        );
      }
    }

    return res.status(200).json({
      success: true,

      approved,

      order_id: orderId,

      order_status: orderStatus,

      payment_id: payment?.id
        ? String(payment.id)
        : null,

      payment_status: paymentStatus,

      status:
        paymentStatus ||
        orderStatus ||
        "pending",

      status_detail: statusDetail,

      ticket_code: ticketCode,

      // Já vem como "data:image/png;base64,..."
      ticket_qr_base64: ticketQrBase64,
    });
  } catch (error) {
    console.error("Erro check-pix:", error);

    return res.status(500).json({
      success: false,
      message:
        "Erro interno ao consultar pagamento.",
      error: String(error),
    });
  }
};