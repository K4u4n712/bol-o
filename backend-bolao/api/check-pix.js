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

    // No Pix, consideramos aprovado quando o pagamento da transaction
    // ou a própria order chegam como approved.
    const approved =
      paymentStatus === "approved" ||
      orderStatus === "approved" ||
      statusDetail === "accredited";

    if (orderNsu) {
      try {
        const pagamentoRef = db.collection("pagamentos").doc(orderNsu);

        await pagamentoRef.set(
          {
            status: approved ? "approved" : (paymentStatus || orderStatus || "pending"),
            statusDetail: statusDetail || null,
            ingressoStatus: approved ? "confirmed" : "pending",
            mercadoPagoOrderStatus: orderStatus || null,
            mercadoPagoPaymentStatus: paymentStatus || null,
            respostaConsultaMercadoPago: mpData,
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
            ...(approved
              ? {
                  aprovadoEm: admin.firestore.FieldValue.serverTimestamp(),
                }
              : {}),
          },
          { merge: true }
        );
      } catch (firestoreError) {
        console.error("Erro ao atualizar Firestore:", firestoreError);
      }
    }

    return res.status(200).json({
      success: true,
      approved,
      order_id: orderId,
      order_status: orderStatus,
      payment_id: payment?.id ? String(payment.id) : null,
      payment_status: paymentStatus,
      status: paymentStatus || orderStatus || "pending",
      status_detail: statusDetail,
    });
  } catch (error) {
    console.error("Erro check-pix:", error);

    return res.status(500).json({
      success: false,
      message: "Erro interno ao consultar pagamento.",
      error: String(error),
    });
  }
};