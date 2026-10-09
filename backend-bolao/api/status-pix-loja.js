const { db } = require('../lib/firebaseAdmin');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://aircleanbrasil.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const pedidoId = typeof req.query.pedido_id === 'string' ? req.query.pedido_id : '';
  const orderId = typeof req.query.order_id === 'string' ? req.query.order_id : '';
  if (!/^[a-zA-Z0-9]{10,80}$/.test(pedidoId) || !/^ORD[A-Z0-9]{10,80}$/i.test(orderId)) {
    return res.status(400).json({ error: 'Identificadores inválidos' });
  }

  try {
    const doc = await db.collection('pedidos_loja').doc(pedidoId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Pedido não encontrado' });
    const pedido = doc.data();
    if (pedido?.tipo !== 'airclean_produto' ||
        pedido?.provedorPagamento !== 'mercadopago' ||
        pedido?.mercadoPagoApi !== 'orders' ||
        pedido?.mercadoPagoOrderId !== orderId) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const paid = pedido?.pedidoStatus === 'pago' && pedido?.pagamentoStatus === 'approved';
    return res.status(200).json({ paid, status: paid ? 'approved' : 'pending' });
  } catch (erro) {
    console.error('Erro ao consultar status AirClean:', erro);
    return res.status(500).json({ error: 'Não foi possível consultar o pedido' });
  }
};
