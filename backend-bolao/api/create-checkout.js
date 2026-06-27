const { db, admin } = require("../lib/firebaseAdmin");

const INFINITEPAY_HANDLE = "pitstoplanchepizzariaa";

// Backend atual, usado para o webhook da InfinitePay
const PUBLIC_BASE_URL = "https://bol-o-rouge.vercel.app";

// Site/PWA para onde o usuário deve voltar depois do pagamento
const PWA_BASE_URL = "https://bolao10-web.vercel.app";

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
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { uid, nome, email, valorReais } = body || {};

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: "Usuário não informado.",
      });
    }

    const valorNumber = Number(valorReais);

    if (!valorNumber || valorNumber < 1) {
      return res.status(400).json({
        success: false,
        message: "Valor inválido.",
      });
    }

    const valorCentavos = Math.round(valorNumber * 100);

    const pagamentoRef = db.collection("pagamentos").doc();
    const orderNsu = pagamentoRef.id;

    // Depois do pagamento, a InfinitePay manda o usuário para esta tela do PWA.
    // O order_nsu vai na URL para a tela conseguir acompanhar o status no Firebase.
    const redirectUrl = `${PWA_BASE_URL}/pagamento-retorno?order_nsu=${encodeURIComponent(
      orderNsu
    )}`;

    await pagamentoRef.set({
      uid,
      nome: nome || "Usuário",
      email: email || "",
      valorReais: valorNumber,
      valorCentavos,
      status: "pending",
      tipo: "deposito_saldo",
      order_nsu: orderNsu,
      redirectUrl,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    const payload = {
      handle: INFINITEPAY_HANDLE,

      // Antes estava indo para o Google. Agora volta para o seu PWA.
      redirect_url: redirectUrl,

      // O saldo continua sendo confirmado pelo webhook, que é o jeito seguro.
      webhook_url: `${PUBLIC_BASE_URL}/api/webhook-infinitepay`,

      order_nsu: orderNsu,
      customer: {
        name: nome || "Usuário",
        email: email || "",
      },
      items: [
        {
          quantity: 1,
          price: valorCentavos,
          description: `Depósito de saldo - ${nome || uid}`,
        },
      ],
    };

    const checkoutResponse = await fetch(
      "https://api.checkout.infinitepay.io/links",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const checkoutData = await checkoutResponse.json();

    const checkoutUrl =
      checkoutData.url || checkoutData.checkout_url || checkoutData.link;

    if (!checkoutResponse.ok || !checkoutUrl) {
      await pagamentoRef.update({
        status: "checkout_error",
        erroCheckout: checkoutData,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(400).json({
        success: false,
        message: "Erro ao criar checkout na InfinitePay.",
        details: checkoutData,
      });
    }

    await pagamentoRef.update({
      checkoutUrl,
      payloadCheckout: payload,
      respostaCheckout: checkoutData,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      url: checkoutUrl,
      order_nsu: orderNsu,
      redirect_url: redirectUrl,
    });
  } catch (error) {
    console.error("Erro ao criar checkout:", error);

    return res.status(500).json({
      success: false,
      message: "Erro interno ao criar checkout.",
      error: String(error),
    });
  }
};
