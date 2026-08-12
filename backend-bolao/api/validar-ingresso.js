const { db, admin } = require("../lib/firebaseAdmin");

function parseQr(raw) {
  if (!raw) {
    throw new Error("QR vazio.");
  }

  const texto = String(raw).trim();

  try {
    const parsed = JSON.parse(texto);

    if (parsed?.type === "BONDE62_TICKET") {
      return {
        id: parsed.id ? String(parsed.id) : "",
        code: parsed.code ? String(parsed.code) : "",
      };
    }
  } catch {
    // Continua para formatos antigos.
  }

  if (texto.startsWith("BONDE62:")) {
    return {
      id: texto.slice("BONDE62:".length).trim(),
      code: "",
    };
  }

  throw new Error("Formato de QR inválido.");
}

function timestampToText(value) {
  if (!value) return "";

  let date;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (value._seconds) {
    date = new Date(Number(value._seconds) * 1000);
  } else {
    return "";
  }

  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

async function acharDocumento(ticketId, ticketCode) {
  if (ticketId) {
    const direto = db.collection("pagamentos").doc(ticketId);
    const diretoSnap = await direto.get();

    if (diretoSnap.exists) {
      return direto;
    }

    const porOrderNsu = await db
      .collection("pagamentos")
      .where("order_nsu", "==", ticketId)
      .limit(1)
      .get();

    if (!porOrderNsu.empty) {
      return porOrderNsu.docs[0].ref;
    }
  }

  if (ticketCode) {
    const porCodigo = await db
      .collection("pagamentos")
      .where("ingressoCodigo", "==", ticketCode)
      .limit(1)
      .get();

    if (!porCodigo.empty) {
      return porCodigo.docs[0].ref;
    }
  }

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Validator-Pin"
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
    const pinEsperado = String(
      process.env.BONDE62_VALIDATOR_PIN || ""
    ).trim();

    if (!pinEsperado) {
      return res.status(500).json({
        success: false,
        message: "PIN da portaria não configurado no servidor.",
      });
    }

    const pinRecebido = String(
      req.headers["x-validator-pin"] || ""
    ).trim();

    if (!pinRecebido || pinRecebido !== pinEsperado) {
      return res.status(403).json({
        success: false,
        message: "PIN da portaria inválido.",
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    let parsed;

    try {
      parsed = parseQr(body.qr);
    } catch (error) {
      return res.status(400).json({
        success: false,
        status: "invalid",
        message: "QR Code inválido ou não reconhecido.",
      });
    }

    const pagamentoRef = await acharDocumento(
      parsed.id,
      parsed.code
    );

    if (!pagamentoRef) {
      return res.status(404).json({
        success: false,
        status: "invalid",
        message: "Ingresso não encontrado.",
      });
    }

    const resultado = await db.runTransaction(
      async (transaction) => {
        const snap = await transaction.get(pagamentoRef);

        if (!snap.exists) {
          return {
            status: "invalid",
            reason: "not_found",
          };
        }

        const data = snap.data();

        if (data.tipo !== "bonde62_ingresso") {
          return {
            status: "invalid",
            reason: "wrong_type",
            data,
          };
        }

        const pagamentoStatus = String(
          data.status || ""
        ).toLowerCase();

        const ingressoStatus = String(
          data.ingressoStatus || ""
        ).toLowerCase();

        const aprovado =
          pagamentoStatus === "approved" ||
          pagamentoStatus === "paid" ||
          ingressoStatus === "confirmed";

        if (!aprovado) {
          return {
            status: "invalid",
            reason: "not_approved",
            data,
          };
        }

        if (
          ingressoStatus === "used" ||
          ingressoStatus === "utilizado" ||
          data.utilizadoEm
        ) {
          return {
            status: "used",
            data,
          };
        }

        const agora =
          admin.firestore.FieldValue.serverTimestamp();

        transaction.update(pagamentoRef, {
          ingressoStatus: "used",
          utilizadoEm: agora,
          validadoPor: "portaria",
          atualizadoEm: agora,
        });

        return {
          status: "valid",
          data: {
            ...data,
            ingressoStatus: "used",
          },
        };
      }
    );

    const data = resultado.data || {};

    const codigo =
      data.ingressoCodigo ||
      parsed.code ||
      `B62-${String(
        data.order_nsu || pagamentoRef.id
      )
        .slice(0, 10)
        .toUpperCase()}`;

    const ticket = {
      id: pagamentoRef.id,
      codigo,
      nome: data.nome || "",
      email: data.email || "",
      quantidade: Number(data.quantidade || 1),
      lote: data.lote || "lote_secreto",
      utilizadoEmTexto:
        resultado.status === "used"
          ? timestampToText(data.utilizadoEm)
          : "",
    };

    if (resultado.status === "used") {
      return res.status(409).json({
        success: false,
        status: "used",
        message:
          "Este ingresso já foi utilizado anteriormente.",
        ticket,
      });
    }

    if (resultado.status !== "valid") {
      return res.status(400).json({
        success: false,
        status: "invalid",
        message:
          resultado.reason === "not_approved"
            ? "O pagamento deste ingresso ainda não está aprovado."
            : "Ingresso inválido.",
        ticket,
      });
    }

    return res.status(200).json({
      success: true,
      status: "valid",
      message: "Ingresso validado com sucesso.",
      ticket,
    });
  } catch (error) {
    console.error("Erro ao validar ingresso:", error);

    return res.status(500).json({
      success: false,
      status: "invalid",
      message: "Erro interno ao validar ingresso.",
      error: String(error),
    });
  }
};