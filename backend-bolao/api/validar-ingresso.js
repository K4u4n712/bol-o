const { db, admin } = require("../lib/firebaseAdmin");

function getDateFromAny(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value._seconds) {
    return new Date(Number(value._seconds) * 1000);
  }

  if (value.seconds) {
    return new Date(Number(value.seconds) * 1000);
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function formatDateBR(value) {
  const date = getDateFromAny(value);
  if (!date) return "";

  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

function parseQr(raw) {
  if (!raw) {
    throw new Error("QR vazio.");
  }

  const texto = String(raw).trim();

  try {
    const parsed = JSON.parse(texto);

    if (parsed?.type === "BONDE62_TICKET") {
      return {
        id: parsed.id ? String(parsed.id).trim() : "",
        code: parsed.code ? String(parsed.code).trim() : "",
      };
    }
  } catch {
    // segue pro próximo formato
  }

  if (texto.startsWith("BONDE62:")) {
    return {
      id: texto.slice("BONDE62:".length).trim(),
      code: "",
    };
  }

  if (texto.startsWith("B62-")) {
    return {
      id: "",
      code: texto.trim(),
    };
  }

  throw new Error("Formato de QR inválido.");
}

function isApproved(data = {}) {
  const pagamentoStatus = String(data.status || "").toLowerCase();
  const ingressoStatus = String(data.ingressoStatus || "").toLowerCase();

  return (
    pagamentoStatus === "approved" ||
    pagamentoStatus === "paid" ||
    ingressoStatus === "confirmed"
  );
}

function isUsed(data = {}) {
  const ingressoStatus = String(data.ingressoStatus || "").toLowerCase();

  return (
    ingressoStatus === "used" ||
    ingressoStatus === "utilizado" ||
    Boolean(data.utilizadoEm)
  );
}

function buildTicket(docId, data = {}, fallback = {}) {
  const codigo =
    data.ingressoCodigo ||
    fallback.code ||
    `B62-${String(data.order_nsu || docId).slice(0, 10).toUpperCase()}`;

  return {
    id: docId,
    codigo,
    nome: data.nome || "",
    email: data.email || "",
    quantidade: Number(data.quantidade || 1),
    lote: data.lote || "lote_secreto",
    valor: Number(data.valorTotal || data.total || 0),
    status: data.ingressoStatus || "",
    utilizadoEmTexto: formatDateBR(data.utilizadoEm),
    criadoEmTexto: formatDateBR(data.criadoEm || data.createdAt || data.atualizadoEm),
  };
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

async function carregarDashboard() {
  const snapshot = await db
    .collection("pagamentos")
    .where("tipo", "==", "bonde62_ingresso")
    .limit(500)
    .get();

  let totalAprovados = 0;
  let totalValidados = 0;

  const historico = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};

    if (!isApproved(data)) return;

    const quantidade = Number(data.quantidade || 1);
    totalAprovados += quantidade;

    if (isUsed(data)) {
      totalValidados += quantidade;

      const usadoEm = getDateFromAny(data.utilizadoEm);

      historico.push({
        ...buildTicket(doc.id, data),
        validadoEmTexto: formatDateBR(data.utilizadoEm),
        validadoEmMs: usadoEm ? usadoEm.getTime() : 0,
      });
    }
  });

  historico.sort((a, b) => b.validadoEmMs - a.validadoEmMs);

  const totalDisponiveis = Math.max(totalAprovados - totalValidados, 0);

  return {
    summary: {
      totalAprovados,
      totalValidados,
      totalDisponiveis,
      ultimoValidadoEm: historico[0]?.validadoEmTexto || "",
    },
    history: historico.slice(0, 20).map(({ validadoEmMs, ...item }) => item),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Validator-Pin"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  try {
    const pinEsperado = String(process.env.BONDE62_VALIDATOR_PIN || "").trim();

    if (!pinEsperado) {
      return res.status(500).json({
        success: false,
        message: "PIN da portaria não configurado no servidor.",
      });
    }

    const pinRecebido = String(
      req.headers["x-validator-pin"] || req.query?.pin || ""
    ).trim();

    if (!pinRecebido || pinRecebido !== pinEsperado) {
      return res.status(403).json({
        success: false,
        message: "PIN da portaria inválido.",
      });
    }

    // DASHBOARD / HISTÓRICO
    if (req.method === "GET") {
      const dashboard = await carregarDashboard();

      return res.status(200).json({
        success: true,
        ...dashboard,
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Método não permitido.",
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const codigoManual = String(body.code || body.ticketCode || "").trim();

    let parsed = {
      id: "",
      code: codigoManual,
    };

    if (!codigoManual) {
      try {
        parsed = parseQr(body.qr);
      } catch {
        return res.status(400).json({
          success: false,
          status: "invalid",
          message: "QR Code inválido ou não reconhecido.",
        });
      }
    }

    const pagamentoRef = await acharDocumento(parsed.id, parsed.code);

    if (!pagamentoRef) {
      return res.status(404).json({
        success: false,
        status: "invalid",
        message: "Ingresso não encontrado.",
      });
    }

    const resultado = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(pagamentoRef);

      if (!snap.exists) {
        return {
          status: "invalid",
          reason: "not_found",
        };
      }

      const data = snap.data() || {};

      if (data.tipo !== "bonde62_ingresso") {
        return {
          status: "invalid",
          reason: "wrong_type",
          data,
        };
      }

      if (!isApproved(data)) {
        return {
          status: "invalid",
          reason: "not_approved",
          data,
        };
      }

      if (isUsed(data)) {
        return {
          status: "used",
          data,
        };
      }

      const agora = admin.firestore.FieldValue.serverTimestamp();

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
    });

    const data = resultado.data || {};
    const ticket = buildTicket(pagamentoRef.id, data, parsed);

    if (resultado.status === "used") {
      return res.status(409).json({
        success: false,
        status: "used",
        message: "Este ingresso já foi utilizado anteriormente.",
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