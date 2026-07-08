const { db, admin } = require("../lib/firebaseAdmin");

const INFINITEPAY_HANDLE = "pitstoplanchepizzariaa";

// Backend atual, usado para o webhook da InfinitePay
const PUBLIC_BASE_URL = "https://bol-o-rouge.vercel.app";

// Site/PWA para onde o usuário deve voltar depois do pagamento
const PWA_BASE_URL = "https://bolao10-web.vercel.app";

// Preço oficial do lote secreto Bonde 62
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
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const {
      uid,
      nome,
      email,
      whatsapp,
      valorReais,
      tipo,
      evento,
      lote,
      quantidade,
    } = body || {};

    const tipoPagamento = tipo || "deposito_saldo";

    let valorNumber = 0;
    let qtd = 1;
    let descricaoItem = "";
    let redirectUrl = "";
    let dadosExtras = {};

    const pagamentoRef = db.collection("pagamentos").doc();
    const orderNsu = pagamentoRef.id;

    // ============================
    // PAGAMENTO BONDE 62
    // ============================
    if (tipoPagamento === "bonde62_ingresso") {
      if (!nome || !email || !whatsapp) {
        return res.status(400).json({
          success: false,
          message: "Nome, e-mail e WhatsApp são obrigatórios.",
        });
      }

      qtd = Number(quantidade || 1);

      if (!qtd || qtd < 1) {
        qtd = 1;
      }

      if (qtd > 10) {
        return res.status(400).json({
          success: false,
          message: "Quantidade máxima de 10 ingressos por compra.",
        });
      }

      valorNumber = Number((qtd * PRECO_BONDE62_LOTE_SECRETO).toFixed(2));

      descricaoItem =
        qtd === 1
          ? "Ingresso Bonde 62 - Lote Secreto"
          : `${qtd} ingressos Bonde 62 - Lote Secreto`;

      redirectUrl = `${PWA_BASE_URL}/pagamento-retorno?order_nsu=${encodeURIComponent(
        orderNsu
      )}&tipo=bonde62`;

      dadosExtras = {
        tipo: "bonde62_ingresso",
        evento: evento || "bonde62",
        lote: lote || "lote_secreto",
        quantidade: qtd,
        whatsapp,
        ingressoStatus: "pending",
      };
    }

    // ============================
    // PAGAMENTO NORMAL DO BOLÃO
    // ============================
    if (tipoPagamento !== "bonde62_ingresso") {
      if (!uid) {
        return res.status(400).json({
          success: false,
          message: "Usuário não informado.",
        });
      }

      valorNumber = Number(valorReais);

      if (!valorNumber || valorNumber < 1) {
        return res.status(400).json({
          success: false,
          message: "Valor inválido.",
        });
      }

      descricaoItem = `Depósito de saldo - ${nome || uid}`;

      redirectUrl = `${PWA_BASE_URL}/pagamento-retorno?order_nsu=${encodeURIComponent(
        orderNsu
      )}`;

      dadosExtras = {
        uid,
        tipo: "deposito_saldo",
      };
    }

    const valorCentavos = Math.round(valorNumber * 100);

    await pagamentoRef.set({
      ...dadosExtras,
      uid: uid || null,
      nome: nome || "Usuário",
      email: email || "",
      valorReais: valorNumber,
      valorCentavos,
      status: "pending",
      order_nsu: orderNsu,
      redirectUrl,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    let itemPrice = valorCentavos;
    let itemQuantity = 1;

    if (tipoPagamento === "bonde62_ingresso") {
      itemPrice = Math.round(PRECO_BONDE62_LOTE_SECRETO * 100);
      itemQuantity = qtd;
    }

    const payload = {
      handle: INFINITEPAY_HANDLE,
      redirect_url: redirectUrl,
      webhook_url: `${PUBLIC_BASE_URL}/api/webhook-infinitepay`,
      order_nsu: orderNsu,
      customer: {
        name: nome || "Usuário",
        email: email || "",
      },
      items: [
        {
          quantity: itemQuantity,
          price: itemPrice,
          description: descricaoItem,
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