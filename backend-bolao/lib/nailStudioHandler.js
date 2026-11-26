const { randomUUID, randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { db, admin } = require('./firebaseAdmin');

const settings = db.doc('nailStudio/settings');
const days = settings.collection('days');
const defaults = [{ id: 'gel', name: 'Unhas em gel', duration: 90 }];
const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' });
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function validateDate(date, booking) {
  const parsed = new Date(date + 'T12:00:00Z');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date) {
    fail(400, 'Informe uma data válida.');
  }
  const now = new Date();
  if (booking && (date < dateFormat.format(now) ||
      date > dateFormat.format(new Date(+now + 60 * 86400000)))) {
    fail(400, 'Escolha uma data nos próximos 60 dias.');
  }
}

function minutes(value) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function clock(value) {
  return [Math.floor(value / 60), value % 60].map(part => String(part).padStart(2, '0')).join(':');
}

function available(day, service, date) {
  if (!day.start || !day.end || !service) return [];
  const now = new Date();
  const earliest = date === dateFormat.format(now) ? minutes(timeFormat.format(now)) : -1;
  const result = [];
  for (let i = minutes(day.start); i + service.duration <= minutes(day.end); i += 30) {
    if (i > earliest && !(day.bookings || []).some(item =>
      item.status !== 'cancelado' && i < minutes(item.time) + item.duration &&
      i + service.duration > minutes(item.time))) result.push(clock(i));
  }
  return result;
}

function contactKey() {
  const key = Buffer.from(process.env.NAIL_STUDIO_CONTACT_KEY || '', 'base64');
  if (key.length !== 32) fail(503, 'Agenda aguardando configuração.');
  return key;
}

function seal(name, phone) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', contactKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ name, phone }), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

function reveal(value) {
  const bytes = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', contactKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const mode = req.query.mode;
    const body = req.body || {};
    const date = req.method === 'GET' ? req.query.date : body.date;
    if (mode === 'admin') {
      const uid = process.env.NAIL_STUDIO_ADMIN_UID || process.env.AIRCLEAN_ADMIN_UID;
      if (!uid) fail(503, 'Acesso administrativo aguardando configuração.');
      const token = /^Bearer (.+)$/.exec(req.headers.authorization || '');
      if (!token) fail(401, 'Entre com sua conta.');
      const user = await admin.auth().verifyIdToken(token[1], true).catch(() => null);
      if (!user || user.uid !== uid) fail(403, 'Esta conta não tem acesso à agenda.');
    }

    if (req.method === 'GET') {
      validateDate(date, mode !== 'admin');
      const [config, snapshot] = await Promise.all([settings.get(), days.doc(date).get()]);
      const services = config.data()?.services || defaults;
      const day = snapshot.data() || {};
      if (mode === 'admin') {
        const bookings = (day.bookings || []).map(({ contact, ...item }) => ({ ...item, ...reveal(contact) }));
        return res.json({ services, bookings, start: day.start || '', end: day.end || '' });
      }
      const service = services.find(item => item.id === req.query.service);
      return res.json({ services, times: available(day, service, date) });
    }

    if (req.method === 'POST' && mode !== 'admin') {
      validateDate(date, true);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
      if (name.length < 2 || name.length > 80 || !/^\d{10,13}$/.test(phone)) {
        fail(400, 'Informe seu nome e um WhatsApp com DDD.');
      }
      const contact = seal(name, phone);
      const id = randomUUID();
      const ref = days.doc(date);
      await db.runTransaction(async tx => {
        const [config, snapshot] = await tx.getAll(settings, ref);
        const day = snapshot.data() || {};
        const services = config.data()?.services || defaults;
        const service = services.find(item => item.id === body.service);
        if (!available(day, service, date).includes(body.time)) {
          fail(409, 'Esse horário ficou indisponível. Escolha outro.');
        }
        const bookings = day.bookings || [];
        if (bookings.length >= 200) fail(409, 'A agenda deste dia está cheia.');
        tx.set(ref, { bookings: [...bookings, {
          id, time: body.time, service: service.name, duration: service.duration,
          contact, status: 'confirmado',
        }] }, { merge: true });
      });
      return res.status(201).json({ id });
    }

    if (req.method === 'PATCH' && mode === 'admin') {
      if (body.action === 'services') {
        const { services } = body;
        if (!Array.isArray(services) || !services.length || services.length > 12 ||
            services.some(item => !item || typeof item.id !== 'string' || !/^[\w-]{1,40}$/.test(item.id) ||
              typeof item.name !== 'string' || !item.name.trim() || item.name.length > 60 ||
              !Number.isInteger(item.duration) || item.duration < 30 || item.duration > 360 ||
              item.duration % 30 !== 0) || new Set(services.map(item => item.id)).size !== services.length) {
          fail(400, 'Use até 12 serviços com duração entre 30 e 360 minutos, em múltiplos de 30.');
        }
        await settings.set({ services: services.map(({ id, name, duration }) => ({ id, name: name.trim(), duration })) }, { merge: true });
        return res.json({ ok: true });
      }
      validateDate(date, false);
      const ref = days.doc(date);
      if (body.action === 'hours') {
        const { start, end } = body;
        const valid = value => typeof value === 'string' && /^([01]\d|2[0-3]):(00|30)$/.test(value);
        if (!(start === '' && end === '') && (!valid(start) || !valid(end) || start >= end)) {
          fail(400, 'Informe início e fim no formato HH:MM, em intervalos de 30 minutos.');
        }
        await ref.set({ start, end }, { merge: true });
      } else if (body.action === 'status') {
        await db.runTransaction(async tx => {
          const snapshot = await tx.get(ref);
          const bookings = snapshot.data()?.bookings || [];
          const item = bookings.find(entry => entry.id === body.id);
          if (!item) fail(404, 'Agendamento não encontrado.');
          if (item.status !== 'confirmado' || !['cancelado', 'concluído'].includes(body.status)) {
            fail(409, 'Esse atendimento já foi atualizado.');
          }
          tx.update(ref, { bookings: bookings.map(entry =>
            entry.id === item.id ? { ...entry, status: body.status } : entry) });
        });
      } else fail(400, 'Ação inválida.');
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    if (!error.status) console.error('Nail studio:', error.code || error.name);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Agenda temporariamente indisponível.' });
  }
};
