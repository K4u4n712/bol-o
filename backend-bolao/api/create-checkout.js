const { db, admin } = require("../lib/firebaseAdmin");

const INFINITEPAY_HANDLE = "pitstoplanchepizzariaa";

function getBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const host = req.headers.host;
  return `https://${host}`;
}

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

    await pagamentoRef.set({
      uid,
      nome: nome || "Usuário",
      email: email || "",
      valorReais: valorNumber,
      valorCentavos,
      status: "pending",
      tipo: "deposito_saldo",
      order_nsu: orderNsu,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    const baseUrl = getBaseUrl(req);

    const payload = {
      handle: INFINITEPAY_HANDLE,
      redirect_url: "https://google.com",
      webhook_url: `${baseUrl}/api/webhook-infinitepay`,
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