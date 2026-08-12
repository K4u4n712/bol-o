const QRCode = require("qrcode");
const { db, admin } = require("../lib/firebaseAdmin");

const REQUIRE_VERIFIED_EMAIL =
  process.env.BONDE62_REQUIRE_VERIFIED_EMAIL === "true";

function timestampToMillis(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value._seconds) {
    return Number(value._seconds) * 1000;
  }

  return 0;
}

function statusDoIngresso(data) {
  const ingressoStatus = String(data?.ingressoStatus || "").toLowerCase();
  const pagamentoStatus = String(data?.status || "").toLowerCase();

  if (
    ["used", "utilizado", "consumed"].includes(ingressoStatus)
  ) {
    return "used";
  }

  if (
    ["expired", "expirado", "cancelled", "canceled"].includes(ingressoStatus)
  ) {
    return "expired";
  }

  if (
    ingressoStatus === "confirmed" ||
    pagamentoStatus === "approved" ||
    pagamentoStatus === "paid"
  ) {
    return "valid";
  }

  return "pending";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

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
    const authorization = String(req.headers.authorization || "");
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Faça login para ver seus ingressos.",
      });
    }

    let decoded;

    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error("Token Firebase inválido:", error);

      return res.status(401).json({
        success: false,
        message: "Sua sessão expirou. Entre novamente.",
      });
    }

    const email = String(decoded?.email || "").trim();
    const emailNormalizado = email.toLowerCase();

    if (!emailNormalizado) {
      return res.status(400).json({
        success: false,
        message: "Sua conta não possui e-mail.",
      });
    }

    if (REQUIRE_VERIFIED_EMAIL && !decoded?.email_verified) {
      return res.status(403).json({
        success: false,
        code: "email_not_verified",
        message:
          "Confirme seu e-mail antes de acessar seus ingressos.",
      });
    }

    // Busca principal para as novas compras.
    const normalizadoSnapshot = await db
      .collection("pagamentos")
      .where("emailNormalizado", "==", emailNormalizado)
      .get();

    const docsMap = new Map();

    normalizadoSnapshot.forEach((doc) => {
      docsMap.set(doc.id, {
        id: doc.id,
        ...doc.data(),
      });
    });

    // Compatibilidade com compras antigas, feitas antes do campo
    // emailNormalizado existir. O Firebase Auth normaliza o e-mail,
    // então esta busca cobre o caso mais comum.
    if (docsMap.size === 0) {
      const legadoSnapshot = await db
        .collection("pagamentos")
        .where("email", "==", email)
        .get();

      legadoSnapshot.forEach((doc) => {
        docsMap.set(doc.id, {
          id: doc.id,
          ...doc.data(),
        });
      });
    }

    const pagamentos = Array.from(docsMap.values())
      .filter((item) => item.tipo === "bonde62_ingresso")
      .sort(
        (a, b) =>
          timestampToMillis(b.criadoEm) -
          timestampToMillis(a.criadoEm)
      );

    const ingressos = [];

    for (const item of pagamentos) {
      const status = statusDoIngresso(item);

      const codigo =
        item.ingressoCodigo ||
        `B62-${String(item.order_nsu || item.id)
          .slice(0, 10)
          .toUpperCase()}`;

      let qrBase64 = null;

      if (status === "valid" || status === "used") {
        const payload =
          item.ingressoQrPayload ||
          {
            type: "BONDE62_TICKET",
            id: item.order_nsu || item.id,
            code: codigo,
          };

        try {
          qrBase64 = await QRCode.toDataURL(
            JSON.stringify(payload),
            {
              errorCorrectionLevel: "M",
              margin: 2,
              width: 360,
            }
          );
        } catch (qrError) {
          console.error("Erro ao gerar QR do ingresso:", qrError);
        }
      }

      ingressos.push({
        id: item.id,
        codigo,
        status,

        nome: item.nome || "",
        email: item.email || email,

        quantidade: Number(item.quantidade || 1),
        valor: Number(item.valorReais || 0),

        lote: item.lote || "lote_secreto",
        evento: item.evento || "bonde62",

        order_nsu: item.order_nsu || item.id,
        order_id: item.mercadoPagoOrderId || null,

        qr_code_base64: qrBase64,

        criadoEm: timestampToMillis(item.criadoEm),
        aprovadoEm: timestampToMillis(item.aprovadoEm),
        utilizadoEm: timestampToMillis(item.utilizadoEm),

        // Ainda não temos a data oficial do evento gravada no banco.
        validadeTexto:
          status === "used"
            ? "Ingresso já utilizado"
            : status === "expired"
            ? "Ingresso expirado"
            : "Válido até a data do evento",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        uid: decoded.uid,
        email,
        emailVerified: Boolean(decoded.email_verified),
      },
      ingressos,
    });
  } catch (error) {
    console.error("Erro em meus-ingressos:", error);

    return res.status(500).json({
      success: false,
      message: "Erro interno ao carregar ingressos.",
      error: String(error),
    });
  }
};