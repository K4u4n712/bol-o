const { db, admin } = require('../lib/firebaseAdmin');
const ADMIN_UID = process.env.AIRCLEAN_ADMIN_UID;
const allowedOrigins = (process.env.AIRCLEAN_ADMIN_ORIGINS || 'https://aircleanbrasil.vercel.app').split(',').map(x => x.trim());
const states = ['novo','preparando','enviado','entregue','cancelado'];
function serial(v) { if (v && typeof v.toDate === 'function') return v.toDate().toISOString(); if (Array.isArray(v)) return v.map(serial); if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,serial(x)])); return v; }
module.exports = async (req,res) => {
 const origin = req.headers.origin;
 if (origin && allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Vary','Origin'); res.setHeader('Cache-Control','no-store');
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods','GET,PATCH,OPTIONS');
 if(req.method==='OPTIONS') return res.status(204).end();
 if(!['GET','PATCH'].includes(req.method)) return res.status(405).json({error:'Método não permitido'});
 if(!ADMIN_UID) return res.status(503).json({error:'Administrador não configurado'});
 try {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization||'');
  if(!match) return res.status(401).json({error:'Autenticação necessária'});
  const decoded = await admin.auth().verifyIdToken(match[1],true);
  if(decoded.uid!==ADMIN_UID) return res.status(403).json({error:'Acesso negado'});
  if(req.method==='GET') {
   const snap = await db.collection('pedidos_loja').orderBy('criadoEm','desc').limit(200).get();
   const pedidos = snap.docs.filter(d=>d.data().tipo==='airclean_produto').map(d=>({id:d.id,...serial(d.data())}));
   return res.status(200).json({pedidos,limitado: snap.size===200});
  }
  const body = typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  const {id,statusEntrega,codigoRastreio,transportadora,observacao} = body;
  if(typeof id!=='string'||!/^[A-Za-z0-9]{10,80}$/.test(id)) return res.status(400).json({error:'Pedido inválido'});
  const ref=db.collection('pedidos_loja').doc(id); const snap=await ref.get();
  if(!snap.exists||snap.data().tipo!=='airclean_produto') return res.status(404).json({error:'Pedido não encontrado'});
  const patch={atualizadoEm:admin.firestore.FieldValue.serverTimestamp()};
  if(statusEntrega!==undefined) {
   if(!states.includes(statusEntrega)) return res.status(400).json({error:'Status de entrega inválido'});
   if(['preparando','enviado','entregue'].includes(statusEntrega)&&snap.data().pedidoStatus!=='pago') return res.status(409).json({error:'Pagamento ainda não confirmado'});
   patch.statusEntrega=statusEntrega;
  }
  for(const [key,value,max] of [['codigoRastreio',codigoRastreio,120],['transportadora',transportadora,100],['observacao',observacao,500]]) {
   if(value!==undefined){if(typeof value!=='string'||value.length>max) return res.status(400).json({error:`Campo ${key} inválido`});patch[key]=value.trim();}
  }
  await ref.update(patch);return res.status(200).json({success:true});
 }catch(e){console.error('AirClean admin API:',e?.code||e?.message);return res.status(e?.code?.startsWith('auth/')?401:500).json({error:'Não foi possível processar a solicitação'});}
};
