const { db, admin } = require("../lib/firebaseAdmin");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Admin-Pin"
  );
}

function getDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();

  if (value._seconds) {
    return new Date(Number(value._seconds) * 1000);
  }

  if (value.seconds) {
    return new Date(Number(value.seconds) * 1000);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function brDate(value) {
  const d = getDate(value);
  if (!d) return "";

  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

function dayKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function lastDays(amount) {
  const result = [];

  for (let i = amount - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(dayKey(d));
  }

  return result;
}

function number(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(data) {
  const payment = String(data.status || "").toLowerCase();
  const ticket = String(data.ingressoStatus || "").toLowerCase();

  if (
    ticket === "cancelled" ||
    ticket === "canceled" ||
    ticket === "blocked" ||
    ticket === "bloqueado"
  ) {
    return "blocked";
  }

  if (
    ticket === "used" ||
    ticket === "utilizado" ||
    data.utilizadoEm
  ) {
    return "used";
  }

  if (
    payment === "approved" ||
    payment === "paid" ||
    ticket === "confirmed"
  ) {
    return "approved";
  }

  if (
    payment === "rejected" ||
    payment === "cancelled" ||
    payment === "canceled"
  ) {
    return "rejected";
  }

  return "pending";
}

function sanitizePayment(doc) {
  const data = doc.data() || {};
  const status = normalizeStatus(data);

  return {
    id: doc.id,
    codigo:
      data.ingressoCodigo ||
      `B62-${String(data.order_nsu || doc.id)
        .slice(0, 10)
        .toUpperCase()}`,
    nome: data.nome || "",
    email: data.email || "",
    whatsapp: data.whatsapp || "",
    quantidade: number(data.quantidade || 1),
    valor: number(
      data.valorTotal ??
        data.total ??
        data.valor ??
        data.amount ??
        0
    ),
    lote: data.lote || "",
    pagamentoStatus: data.status || "",
    ingressoStatus: data.ingressoStatus || "",
    status,
    criadoEm: brDate(
      data.criadoEm ||
        data.createdAt ||
        data.created_at ||
        data.atualizadoEm
    ),
    criadoEmMs:
      getDate(
        data.criadoEm ||
          data.createdAt ||
          data.created_at ||
          data.atualizadoEm
      )?.getTime() || 0,
    utilizadoEm: brDate(data.utilizadoEm),
    orderId: data.order_id || "",
    paymentId: data.payment_id || "",
  };
}

async function loadDashboard() {
  const [
    pagamentosSnap,
    analyticsSnap,
  ] = await Promise.all([
    db
      .collection("pagamentos")
      .where("tipo", "==", "bonde62_ingresso")
      .limit(500)
      .get(),
    db.collection("bonde62_analytics").doc("stats").get(),
  ]);

  const payments = pagamentosSnap.docs
    .map(sanitizePayment)
    .sort((a, b) => b.criadoEmMs - a.criadoEmMs);

  let approvedOrders = 0;
  let pendingOrders = 0;
  let rejectedOrders = 0;
  let blockedOrders = 0;
  let ticketsSold = 0;
  let ticketsUsed = 0;
  let revenue = 0;

  const salesMap = {};

  for (const p of payments) {
    if (p.status === "approved" || p.status === "used") {
      approvedOrders += 1;
      ticketsSold += p.quantidade;
      revenue += p.valor;

      if (p.status === "used") {
        ticketsUsed += p.quantidade;
      }

      if (p.criadoEmMs) {
        const key = dayKey(new Date(p.criadoEmMs));
        salesMap[key] = salesMap[key] || {
          orders: 0,
          tickets: 0,
          revenue: 0,
        };

        salesMap[key].orders += 1;
        salesMap[key].tickets += p.quantidade;
        salesMap[key].revenue += p.valor;
      }
    } else if (p.status === "pending") {
      pendingOrders += 1;
    } else if (p.status === "rejected") {
      rejectedOrders += 1;
    } else if (p.status === "blocked") {
      blockedOrders += 1;
    }
  }

  const analytics = analyticsSnap.exists
    ? analyticsSnap.data() || {}
    : {};

  const days = lastDays(7);

  const dailyRefs = days.map((day) =>
    db.collection("bonde62_analytics_daily").doc(day)
  );

  const dailySnaps = await Promise.all(
    dailyRefs.map((ref) => ref.get())
  );

  const trafficDaily = days.map((day, index) => {
    const data = dailySnaps[index].exists
      ? dailySnaps[index].data() || {}
      : {};

    return {
      date: day,
      views: number(data.views),
      uniqueVisitors: number(data.uniqueVisitors),
    };
  });

  const salesDaily = days.map((day) => ({
    date: day,
    orders: number(salesMap[day]?.orders),
    tickets: number(salesMap[day]?.tickets),
    revenue: number(salesMap[day]?.revenue),
  }));

  const cutoff = Date.now() - 45_000;

  const onlineSnap = await db
    .collection("bonde62_visitors")
    .where("lastSeenMs", ">=", cutoff)
    .limit(500)
    .get();

  const online = onlineSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((v) => v.status !== "offline");

  const uniqueVisitors = number(analytics.uniqueVisitors);
  const totalViews = number(analytics.totalViews);

  const conversion =
    uniqueVisitors > 0
      ? Number(((approvedOrders / uniqueVisitors) * 100).toFixed(2))
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      onlineNow: online.length,
      totalViews,
      uniqueVisitors,
      approvedOrders,
      pendingOrders,
      rejectedOrders,
      blockedOrders,
      ticketsSold,
      ticketsUsed,
      ticketsAvailable: Math.max(ticketsSold - ticketsUsed, 0),
      revenue,
      conversion,
    },
    trafficDaily,
    salesDaily,
    purchases: payments.slice(0, 200),
    onlineVisitors: online.slice(0, 100).map((v) => ({
      id: v.id,
      path: v.path || "",
      platform: v.platform || "",
      lastSeenMs: number(v.lastSeenMs),
    })),
  };
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  try {
    const expectedPin = String(
      process.env.BONDE62_ADMIN_PIN || ""
    ).trim();

    if (!expectedPin) {
      return res.status(500).json({
        success: false,
        message:
          "BONDE62_ADMIN_PIN não configurado no servidor.",
      });
    }

    const receivedPin = String(
      req.headers["x-admin-pin"] || ""
    ).trim();

    if (!receivedPin || receivedPin !== expectedPin) {
      return res.status(403).json({
        success: false,
        message: "PIN administrativo inválido.",
      });
    }

    if (req.method === "GET") {
      const dashboard = await loadDashboard();

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

    const action = String(body.action || "").trim();
    const paymentId = String(body.paymentId || "").trim();

    if (action !== "ticket_status") {
      return res.status(400).json({
        success: false,
        message: "Ação administrativa inválida.",
      });
    }

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "paymentId obrigatório.",
      });
    }

    const allowed = [
      "confirmed",
      "used",
      "cancelled",
    ];

    const nextStatus = String(body.status || "").trim();

    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status inválido.",
      });
    }

    const ref = db.collection("pagamentos").doc(paymentId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        message: "Compra não encontrada.",
      });
    }

    const FieldValue = admin.firestore.FieldValue;

    const update = {
      ingressoStatus: nextStatus,
      adminAtualizadoEm: FieldValue.serverTimestamp(),
    };

    if (nextStatus === "used") {
      update.utilizadoEm = FieldValue.serverTimestamp();
      update.validadoPor = "admin";
    } else {
      update.utilizadoEm = FieldValue.delete();
      update.validadoPor = FieldValue.delete();
    }

    await ref.update(update);

    return res.status(200).json({
      success: true,
      message:
        nextStatus === "confirmed"
          ? "Ingresso reativado."
          : nextStatus === "used"
          ? "Ingresso marcado como utilizado."
          : "Ingresso bloqueado.",
    });
  } catch (error) {
    console.error("admin-bonde62:", error);

    return res.status(500).json({
      success: false,
      message: "Erro interno no painel administrativo.",
    });
  }
};