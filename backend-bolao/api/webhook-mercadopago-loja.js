const crypto = require('crypto');
const { db, admin } = require('../lib/firebaseAdmin');

const PRECO_AIRCLEAN_CENTAVOS = 6990;
const ORDER_ID_PATTERN = /^ORD[A-Z0-9]{10,80}$/i;

function centavos(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : null;
}

function verificarAssinatura({ assinatura, requestId, dataId, segredo }) {
  const resultado = { valida: false, diagnostico: 'dados_ausentes', formatoCorrespondente: null };
  if (!assinatura || !requestId || !dataId || !segredo) return resultado;
  const campos = Object.fromEntries(String(assinatura).split(',').map((parte) => {
    const pos = parte.indexOf('=');
    return pos < 0 ? ['', ''] : [parte.slice(0, pos).trim(), parte.slice(pos + 1).trim()];
  }));
  if (!/^\d+$/.test(campos.ts || '') || !/^[0-9a-f]{64}$/i.test(campos.v1 || '')) {
    return { ...resultado, diagnostico: 'cabecalho_malformado' };
  }
  const recebido = Buffer.from(campos.v1, 'hex');
  // Diagnóstico: testar apenas variantes do identificador, sem aceitar automaticamente
  // uma variante não documentada. Não registrar chave, HMAC ou request ID.
  const variantes = [
    ['minusculo', String(dataId).toLowerCase()],
    ['original', String(dataId)],
    ['maiusculo', String(dataId).toUpperCase()],
  ];
  let corresponde = null;
  for (const [nome, id] of variantes) {
    const manifesto = `id:${id};request-id:${requestId};ts:${campos.ts};`;
    const esperado = crypto.createHmac('sha256', segredo).update(manifesto).digest();
    if (recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado)) {
      corresponde = nome;
    }
  }
  return {
    valida: corresponde === 'minusculo' || corresponde === 'maiusculo',
    diagnostico: corresponde ? 'formato_identificado' : 'nenhum_formato_corresponde',
    formatoCorrespondente: corresponde,
  };
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
    const idUrl = req.query?.['data.id'];
    const idUrlAlternativo = req.query?.data_id;
    const idBody = body?.data?.id;
    const dataId = String(idUrl || idUrlAlternativo || idBody || '').trim();

    // Diagnóstico limitado: não registrar identificadores completos em produção.
    console.log('Origem ID AirClean:', {
      temIdUrl: Boolean(idUrl),
      temIdUrlAlternativo: Boolean(idUrlAlternativo),
      temIdBody: Boolean(idBody),
      idsConcordam: [idUrl, idUrlAlternativo, idBody]
        .filter((valor) => valor !== undefined && valor !== null && valor !== '')
        .every((valor) => String(valor).trim() === dataId),
    });

    if (tipo && tipo !== 'order') return res.status(200).json({ success: true, ignored: true });
    if (!dataId) return res.status(400).json({ success: false, message: 'Order ID ausente.' });

    const assinatura = req.headers['x-signature'];
    const requestId = req.headers['x-request-id'];
    const verificacao = verificarAssinatura({ assinatura, requestId, dataId, segredo });
    console.log('Diagnostico assinatura AirClean:', {
      tipo,
      temAssinatura: Boolean(assinatura),
      temRequestId: Boolean(requestId),
      temSegredo: Boolean(segredo),
      diagnostico: verificacao.diagnostico,
      formatoCorrespondente: verificacao.formatoCorrespondente,
    });
    if (!verificacao.valida) {
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
      if (consulta.status === 400 && erroIdInvalido(consulta.dados)) {
        return res.status(200).json({ success: true, ignored: true, reason: 'order_id_rejected_by_provider' });
      }
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
    const pagamentoAprovado = pagamentos.some((p) => ['approved', 'processed'].includes(String(p?.status || '').toLowerCase()));
    console.log('Diagnostico AirClean:', {
      statusOrder,
      totalPaidAmount: order?.total_paid_amount,
      pagoCentavos,
      precoEsperadoCentavos: PRECO_AIRCLEAN_CENTAVOS,
      statusPagamentos: pagamentos.map(p => String(p?.status || '').toLowerCase()),
    });
    const pago = statusOrder === 'processed' && pagamentoAprovado && pagoCentavos === PRECO_AIRCLEAN_CENTAVOS;

    const atualizacao = {
      mercadoPagoOrderStatus: statusOrder || null,
      mercadoPagoPaymentStatus: pagamentos[0]?.status || null,
      mercadoPagoPaymentId: pagamentos[0]?.id ? String(pagamentos[0].id) : (pedido?.mercadoPagoPaymentId || null),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

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

    if (pagamentoAprovado || (statusOrder === 'processed' && pagoCentavos !== PRECO_AIRCLEAN_CENTAVOS)) {
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
