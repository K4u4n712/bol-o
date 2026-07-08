const { db, admin } = require("../lib/firebaseAdmin");

const INFINITEPAY_HANDLE = "pitstoplanchepizzariaa";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Método não permitido.",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    console.log("Webhook recebido da InfinitePay:", JSON.stringify(body));

    const {
      amount,
      paid_amount,
      installments,
      capture_method,
      transaction_nsu,
      order_nsu,
      receipt_url,
      items,
    } = body || {};

    const invoiceSlug = body?.invoice_slug || body?.slug;

    if (!order_nsu) {
      console.log("Webhook sem order_nsu:", JSON.stringify(body));

      return res.status(400).json({
        success: false,
        message: "Webhook sem order_nsu.",
      });
    }

    const pagamentoRef = db.collection("pagamentos").doc(order_nsu);
    const pagamentoSnap = await pagamentoRef.get();

    if (!pagamentoSnap.exists) {
      console.log("Pedido não encontrado:", order_nsu);

      return res.status(400).json({
        success: false,
        message: "Pedido não encontrado.",
      });
    }

    const pagamento = pagamentoSnap.data();

    if (pagamento.status === "paid") {
      return res.status(200).json({
        success: true,
        message: null,
      });
    }

    if (!transaction_nsu || !invoiceSlug) {
      await pagamentoRef.update({
        status: "webhook_incomplete",
        webhookRecebido: body,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("Webhook incompleto:", JSON.stringify(body));

      return res.status(400).json({
        success: false,
        message: "Dados incompletos no webhook.",
      });
    }

    const checkResponse = await fetch(
      "https://api.checkout.infinitepay.io/payment_check",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          handle: INFINITEPAY_HANDLE,
          order_nsu,
          transaction_nsu,
          slug: invoiceSlug,
        }),
      }
    );

    const checkData = await checkResponse.json();

    console.log("Resposta payment_check:", JSON.stringify(checkData));

    if (!checkResponse.ok || !checkData.success || !checkData.paid) {
      await pagamentoRef.update({
        status: "check_failed",
        webhookRecebido: body,
        paymentCheck: checkData,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(400).json({
        success: false,
        message: "Pagamento ainda não confirmado.",
      });
    }

    if (Number(checkData.amount) !== Number(pagamento.valorCentavos)) {
      await pagamentoRef.update({
        status: "value_mismatch",
        webhookRecebido: body,
        paymentCheck: checkData,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(400).json({
        success: false,
        message: "Valor pago diferente do valor criado.",
      });
    }

    // ============================
    // BONDE 62 — CRIA INGRESSO
    // ============================
    if (pagamento.tipo === "bonde62_ingresso") {
      const quantidade = Number(pagamento.quantidade || 1);

      await db.runTransaction(async (transaction) => {
        transaction.update(pagamentoRef, {
          status: "paid",
          ingressoStatus: "confirmed",
          pagoEm: admin.firestore.FieldValue.serverTimestamp(),
          invoice_slug: invoiceSlug,
          amount: amount || null,
          paid_amount: paid_amount || null,
          installments: installments || null,
          capture_method: capture_method || null,
          transaction_nsu,
          receipt_url: receipt_url || null,
          items: Array.isArray(items) ? items : [],
          webhookRecebido: body,
          paymentCheck: checkData,
          atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });

        for (let i = 1; i <= quantidade; i++) {
          const ingressoId = `${order_nsu}-${i}`;
          const ingressoRef = db.collection("bonde62_ingressos").doc(ingressoId);

          transaction.set(ingressoRef, {
            ingressoId,
            order_nsu,
            evento: "bonde62",
            nome: pagamento.nome || "",
            email: pagamento.email || "",
            whatsapp: pagamento.whatsapp || "",
            lote: pagamento.lote || "lote_secreto",
            valorTotal: Number(pagamento.valorReais || 0),
            valorCentavos: Number(pagamento.valorCentavos || 0),
            quantidade,
            status: "valid",
            usado: false,
            usadoEm: null,
            transaction_nsu,
            receipt_url: receipt_url || null,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });

      return res.status(200).json({
        success: true,
        message: null,
      });
    }

    // ============================
    // BOLÃO — MANTÉM SALDO NORMAL
    // ============================
    const userRef = db.collection("usuarios").doc(pagamento.uid);

    await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);

      const saldoAtual = userSnap.exists
        ? Number(userSnap.data().saldo || 0)
        : 0;

      const novoSaldo = saldoAtual + Number(pagamento.valorReais);

      transaction.update(pagamentoRef, {
        status: "paid",
        pagoEm: admin.firestore.FieldValue.serverTimestamp(),
        invoice_slug: invoiceSlug,
        amount: amount || null,
        paid_amount: paid_amount || null,
        installments: installments || null,
        capture_method: capture_method || null,
        transaction_nsu,
        receipt_url: receipt_url || null,
        items: Array.isArray(items) ? items : [],
        webhookRecebido: body,
        paymentCheck: checkData,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.set(
        userRef,
        {
          uid: pagamento.uid,
          nome: pagamento.nome || "",
          email: pagamento.email || "",
          saldo: novoSaldo,
          atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const extratoRef = userRef.collection("extrato").doc(order_nsu);

      transaction.set(extratoRef, {
        tipo: "deposito",
        status: "paid",
        valor: Number(pagamento.valorReais),
        valorCentavos: Number(pagamento.valorCentavos),
        pagamentoId: order_nsu,
        transaction_nsu,
        receipt_url: receipt_url || null,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return res.status(200).json({
      success: true,
      message: null,
    });
  } catch (error) {
    console.error("Erro no webhook InfinitePay:", error);

    return res.status(400).json({
      success: false,
      message: "Erro ao processar webhook.",
      error: String(error),
    });
  }
};