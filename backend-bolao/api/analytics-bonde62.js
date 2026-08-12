const { db, admin } = require("../lib/firebaseAdmin");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanText(value, max = 300) {
  return String(value || "").trim().slice(0, max);
}

function safeVisitorId(value) {
  return cleanText(value, 100).replace(/[^a-zA-Z0-9_-]/g, "");
}

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

module.exports = async function handler(req, res) {
  cors(res);

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
    const FieldValue = admin.firestore.FieldValue;

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const visitorId = safeVisitorId(body.visitorId);
    const action = cleanText(body.action, 30);
    const path = cleanText(body.path || "/bonde62", 180);
    const referrer = cleanText(body.referrer, 300);
    const userAgent = cleanText(body.userAgent, 500);
    const platform = cleanText(body.platform, 80);

    if (!visitorId) {
      return res.status(400).json({
        success: false,
        message: "visitorId obrigatório.",
      });
    }

    if (!["page_view", "heartbeat", "leave"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Ação inválida.",
      });
    }

    const nowMs = Date.now();
    const today = dateKey();

    const visitorRef = db.collection("bonde62_visitors").doc(visitorId);
    const statsRef = db.collection("bonde62_analytics").doc("stats");
    const dailyRef = db.collection("bonde62_analytics_daily").doc(today);
    const dailyUniqueRef = db
      .collection("bonde62_analytics_daily_unique")
      .doc(`${today}_${visitorId}`);

    if (action === "heartbeat") {
      await visitorRef.set(
        {
          visitorId,
          lastSeenMs: nowMs,
          lastSeen: FieldValue.serverTimestamp(),
          status: "online",
          path,
          platform,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.status(200).json({ success: true });
    }

    if (action === "leave") {
      await visitorRef.set(
        {
          visitorId,
          status: "offline",
          lastSeen: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.status(200).json({ success: true });
    }

    await db.runTransaction(async (tx) => {
      const [visitorSnap, uniqueTodaySnap] = await Promise.all([
        tx.get(visitorRef),
        tx.get(dailyUniqueRef),
      ]);

      const isNewVisitor = !visitorSnap.exists;
      const isNewToday = !uniqueTodaySnap.exists;

      tx.set(
        visitorRef,
        {
          visitorId,
          firstSeen: isNewVisitor
            ? FieldValue.serverTimestamp()
            : visitorSnap.data()?.firstSeen || FieldValue.serverTimestamp(),
          firstSeenMs: isNewVisitor
            ? nowMs
            : Number(visitorSnap.data()?.firstSeenMs || nowMs),
          lastSeen: FieldValue.serverTimestamp(),
          lastSeenMs: nowMs,
          status: "online",
          path,
          referrer,
          userAgent,
          platform,
          totalViews: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        statsRef,
        {
          totalViews: FieldValue.increment(1),
          uniqueVisitors: FieldValue.increment(isNewVisitor ? 1 : 0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        dailyRef,
        {
          date: today,
          views: FieldValue.increment(1),
          uniqueVisitors: FieldValue.increment(isNewToday ? 1 : 0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (isNewToday) {
        tx.set(dailyUniqueRef, {
          visitorId,
          date: today,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: "Visualização registrada.",
    });
  } catch (error) {
    console.error("analytics-bonde62:", error);

    return res.status(500).json({
      success: false,
      message: "Erro ao registrar analytics.",
    });
  }
};