const crypto = require('crypto');
const { db, admin } = require('../lib/firebaseAdmin');

const PRECO_AIRCLEAN_CENTAVOS = 6990;
const ORDER_ID_PATTERN = /^ORD[A-Z0-9]{10,80}$/i;

function centavos(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : null;
}

function assinaturaValida({ assinatura, requestId, dataId, segredo }) {
  if (!assinatura || !requestId || !dataId || !segredo) return false;
  const campos = Object.fromEntries(String(assinatura).split(',').map((parte) => {
    const pos = parte.indexOf('=');
    return pos < 0 ? ['', ''] : [parte.slice(0, pos).trim(), parte.slice(pos + 1).trim()];
  }));
  if (!/^\d+$/.test(campos.ts || '') || !/^[0-9a-f]{64}$/i.test(campos.v1 || '')) return false;
  // O Mercado Pago usa o data.id em letras minúsculas no manifesto da assinatura.
  const manifesto = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${campos.ts};`;
  const esperado = crypto.createHmac('sha256', segredo).update(manifesto).digest();
  const recebido = Buffer.from(campos.v1, 'hex');
  return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

async function consultarOrder(orderId, token) {
  const resposta = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: { accept: 'application/json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12000),
  });
  const texto = await resposta.text();
  let dados;
  try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = {}; }
  return { ok: resposta.ok, status: resposta.status, dados };
}

function erroIdInvalido(dados) {
  return Array.isArray(dados?.errors) && dados.errors.some((e) => e?.code === 'invalid_path_param');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Método não permitido.' });

  try {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN_LOJA;
    const segredo = process.env.MERCADO_PAGO_WEBHOOK_SECRET_LOJA;
    if (!token || !segredo) {
      console.error('Configuração do webhook AirClean incompleta.');
      return res.status(503).json({ success: false, message: 'Configuração incompleta.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const tipo = String(req.query?.type || body?.type || '');
    const dataId = String(req.query?.['data.id'] || req.query?.data_id || body?.data?.id || '').trim();

    // Não processar outros tipos de evento neste endpoint exclusivo de Orders.
    if (tipo && tipo !== 'order') return res.status(200).json({ success: true, ignored: true });
    if (!dataId) return res.status(400).json({ success: false, message: 'Order ID ausente.' });

    const assinatura = req.headers['x-signature'];
    const requestId = req.headers['x-request-id'];
    if (!assinaturaValida({ assinatura, requestId, dataId, segredo })) {
      console.warn('Webhook AirClean: assinatura inválida.');
      return res.status(401).json({ success: false, message: 'Assinatura inválida.' });
    }

    console.log('Webhook AirClean autenticado; Order ID:', dataId);
    if (!ORDER_ID_PATTERN.test(dataId)) {
      console.warn('Webhook AirClean: identificador fora do formato esperado.');
      return res.status(200).json({ success: true, ignored: true, reason: 'invalid_order_id' });
    }

    const consulta = await consultarOrder(dataId, token);
    if (!consulta.ok) {
      console.error('Consulta de Order AirClean falhou:', consulta.status, JSON.stringify(consulta.dados));
      // O simulador pode enviar uma Order fictícia. Nunca alterar pedido nesse caso.
      if (consulta.status === 400 && erroIdInvalido(consulta.dados)) {
        return res.status(200).json({ success: true, ignored: true, reason: 'order_id_rejected_by_provider' });
      }
      // Falhas transitórias continuam sendo erro para permitir reentrega.
      return res.status(503).json({ success: false, message: 'Não foi possível consultar a Order.' });
    }

    const order = consulta.dados;
    const orderId = String(order?.id || '');
    const pedidoId = String(order?.external_reference || '');
    if (orderId !== dataId || !pedidoId) {
      console.warn('Webhook AirClean: Order sem associação válida.');
      return res.status(200).json({ success: true, ignored: true });
    }

    const pedidoRef = db.collection('pedidos_loja').doc(pedidoId);
    const snap = await pedidoRef.get();
    if (!snap.exists) return res.status(200).json({ success: true, ignored: true });
    const pedido = snap.data();

    if (pedido?.tipo !== 'airclean_produto' ||
        pedido?.provedorPagamento !== 'mercadopago' ||
        pedido?.mercadoPagoApi !== 'orders' ||
        String(pedido?.mercadoPagoOrderId || '') !== orderId) {
      console.warn('Webhook AirClean: Order não corresponde ao pedido cadastrado.');
      return res.status(200).json({ success: true, ignored: true });
    }

    const valorCobrado = centavos(order?.total_amount);
    const valorEsperado = Number(pedido?.valorCentavos);
    if (valorCobrado !== PRECO_AIRCLEAN_CENTAVOS || valorEsperado !== PRECO_AIRCLEAN_CENTAVOS) {
      console.error('Webhook AirClean: divergência no valor cobrado.', pedidoId);
      return res.status(409).json({ success: false, message: 'Valor da cobrança divergente.' });
    }

    const pagamentos = Array.isArray(order?.transactions?.payments) ? order.transactions.payments : [];
    const pagoCentavos = centavos(order?.total_paid_amount);
    const statusOrder = String(order?.status || '').toLowerCase();
    const pagamentoAprovado = pagamentos.some((p) => String(p?.status || '').toLowerCase() === 'approved');
    console.log('Diagnostico AirClean:', {
  statusOrder,
  totalPaidAmount: order?.total_paid_amount,
  pagoCentavos,
  precoEsperadoCentavos: PRECO_AIRCLEAN_CENTAVOS,
  pagamentos: pagamentos.map(p => ({
    status: p.status,
    amount: p.amount,
    paid_amount: p.paid_amount,
  })),
});
    // Exigir confirmação de pagamento na API, valor integral e status da Order.
    const pago = statusOrder === 'processed' && pagamentoAprovado && pagoCentavos === PRECO_AIRCLEAN_CENTAVOS;

    const atualizacao = {
      mercadoPagoOrderStatus: statusOrder || null,
      mercadoPagoPaymentStatus: pagamentos[0]?.status || null,
      mercadoPagoPaymentId: pagamentos[0]?.id ? String(pagamentos[0].id) : (pedido?.mercadoPagoPaymentId || null),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Não reverter pedidos já pagos por eventos repetidos ou atrasados.
    if (pedido?.pedidoStatus === 'pago') {
      await pedidoRef.update(atualizacao);
      return res.status(200).json({ success: true, paid: true, duplicate: true });
    }

    if (pago) {
      await pedidoRef.update({
        ...atualizacao,
        pagamentoStatus: 'approved',
        pedidoStatus: 'pago',
        pagoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('Pagamento AirClean confirmado:', pedidoId);
      return res.status(200).json({ success: true, paid: true });
    }

    // Um valor divergente ou status inconsistente nunca confirma a venda.
    if (pagamentoAprovado || pagoCentavos > 0) {
      console.warn('Webhook AirClean: pagamento inconsistente, revisão necessária.', pedidoId);
      await pedidoRef.update({ ...atualizacao, pagamentoStatus: 'revisao_necessaria' });
      return res.status(200).json({ success: true, paid: false, review: true });
    }

    await pedidoRef.update({
      ...atualizacao,
      pagamentoStatus: pagamentos[0]?.status || statusOrder || 'pending',
      pedidoStatus: 'aguardando_pagamento',
    });
    return res.status(200).json({ success: true, paid: false, status: statusOrder || 'pending' });
  } catch (erro) {
    console.error('Erro no webhook AirClean:', erro?.message || erro);
    return res.status(500).json({ success: false, message: 'Erro interno no webhook.' });
  }
};
