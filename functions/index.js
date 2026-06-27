const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// Sua InfiniteTag sem o símbolo $
const INFINITEPAY_HANDLE = "pitstoplanchepizzariaa";

// Depois do primeiro deploy, troque SEU_PROJETO pelo ID real do Firebase
const WEBHOOK_URL =
  "https://southamerica-east1-SEU_PROJETO.cloudfunctions.net/webhookInfinitepay";

// Pode deixar Google por enquanto só para teste.
// Depois você pode trocar por uma página sua.
const REDIRECT_URL = "https://google.com";

/**
 * Essa função é chamada pelo seu app React Native.
 * Ela cria um pagamento pendente no Firebase e gera o link de checkout da InfinitePay.
 */
exports.createInfinitePayCheckout = functions
  .region("southamerica-east1")
  .https.onRequest(async (req, res) => {
    try {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }

      if (req.method !== "POST") {
        return res.status(405).json({
          success: false,
          message: "Método não permitido.",
        });
      }

      const { uid, nome, email, valorReais } = req.body || {};

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

      const payload = {
        handle: INFINITEPAY_HANDLE,
        redirect_url: REDIRECT_URL,
        webhook_url: WEBHOOK_URL,
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

      if (!checkoutResponse.ok || !checkoutData.url) {
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
        checkoutUrl: checkoutData.url,
        payloadCheckout: payload,
        respostaCheckout: checkoutData,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({
        success: true,
        url: checkoutData.url,
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
  });

/**
 * Essa função é chamada pela InfinitePay depois que o cliente paga.
 * Ela confirma o pagamento e adiciona saldo no usuário.
 */
exports.webhookInfinitepay = functions
  .region("southamerica-east1")
  .https.onRequest(async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({
          success: false,
          message: "Método não permitido.",
        });
      }

      const body = req.body || {};

      console.log("Webhook recebido da InfinitePay:", JSON.stringify(body));

      const {
        invoice_slug,
        amount,
        paid_amount,
        installments,
        capture_method,
        transaction_nsu,
        order_nsu,
        receipt_url,
        items,
      } = body;

      if (!order_nsu || !transaction_nsu || !invoice_slug) {
        return res.status(400).json({
          success: false,
          message: "Dados incompletos no webhook.",
        });
      }

      const pagamentoRef = db.collection("pagamentos").doc(order_nsu);
      const pagamentoSnap = await pagamentoRef.get();

      if (!pagamentoSnap.exists) {
        return res.status(400).json({
          success: false,
          message: "Pedido não encontrado.",
        });
      }

      const pagamento = pagamentoSnap.data();

      // Evita duplicar saldo caso a InfinitePay envie o webhook mais de uma vez
      if (pagamento.status === "paid") {
        return res.status(200).json({
          success: true,
          message: null,
        });
      }

      // Confirma o pagamento na própria InfinitePay
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
            slug: invoice_slug,
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
          invoice_slug,
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
  });