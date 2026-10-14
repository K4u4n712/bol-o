import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

// Firebase Auth independente do login do bolão/Bonde62.
// O UID no frontend serve apenas para controlar a interface.
// APIs administrativas devem validar o ID token e o UID no servidor.
const ADMIN_UID = 'U2yi9HTIpMWJyuTVLeSJ5vTrDaf1';
const APP_ADMIN_NAME = 'airclean-admin-isolado';
const API = 'https://bol-o-rouge.vercel.app/api/admin-airclean';
type Pedido = { id:string; cliente?:{nome?:string;email?:string;telefone?:string}; entrega?:{rua?:string;numero?:string;bairro?:string;cidade?:string;estado?:string;cep?:string}; produto?:{nome?:string;quantidade?:number}; valorReais?:number; pedidoStatus?:string; pagamentoStatus?:string; statusEntrega?:string; codigoRastreio?:string; transportadora?:string; observacao?:string; criadoEm?:string; };
const etapas = ['novo','preparando','enviado','entregue','cancelado'];

type AuthInstance = ReturnType<typeof getAuth>;

function obterAuthAirClean(): AuthInstance {
  // Reutiliza as opções públicas do Firebase já configurado pelo projeto.
  const appPrincipal = getApp();
  const appAdmin = getApps().find((app) => app.name === APP_ADMIN_NAME)
    ?? initializeApp(appPrincipal.options, APP_ADMIN_NAME);
  // Uma instância Auth vinculada a outro Firebase App tem sessão própria.
  return getAuth(appAdmin);
}

export default function AdminLoja() {
  const [auth, setAuth] = useState<AuthInstance | null>(null);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [entrando, setEntrando] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [pedidos,setPedidos] = useState<Pedido[]>([]);
  const [carregandoPedidos,setCarregandoPedidos] = useState(false);
  const [filtro,setFiltro] = useState('todos');
  const [busca,setBusca] = useState('');
  const [salvando,setSalvando] = useState('');
  const [aviso,setAviso] = useState('');
  const [limite,setLimite] = useState(false);

  useEffect(() => {
    let ativo = true;
    let cancelar: (() => void) | undefined;
    try {
      const instancia = obterAuthAirClean();
      setAuth(instancia);
      cancelar = onAuthStateChanged(instancia, (u) => {
        if (!ativo) return;
        setUsuario(u);
        setCarregando(false);
      }, () => {
        if (!ativo) return;
        setErro('Não foi possível verificar a sessão do administrador.');
        setCarregando(false);
      });
    } catch (e) {
      console.error('Erro ao inicializar AirClean Admin:', e);
      if (ativo) {
        setErro('Não foi possível inicializar o login AirClean.');
        setCarregando(false);
      }
    }
    return () => {
      ativo = false;
      cancelar?.();
    };
  }, []);

  async function carregarPedidos() {
    if (!auth?.currentUser || auth.currentUser.uid !== ADMIN_UID) return;
    setCarregandoPedidos(true);setAviso('');
    try {
      const token=await auth.currentUser.getIdToken();
      const resposta=await fetch(API,{headers:{Authorization:`Bearer ${token}`}});
      const dados=await resposta.json();
      if(!resposta.ok) throw new Error(dados.error||'Falha ao buscar pedidos');
      setPedidos(dados.pedidos||[]);setLimite(Boolean(dados.limitado));
    } catch(e:any) {setAviso(e?.message||'Erro ao carregar pedidos');}
    finally {setCarregandoPedidos(false);}
  }
  useEffect(()=>{if(usuario?.uid===ADMIN_UID) void carregarPedidos();},[usuario,auth]);
  const filtrados=useMemo(()=>pedidos.filter(p=>(filtro==='todos'||(filtro==='pagos'?p.pedidoStatus==='pago':filtro==='pendentes'?p.pedidoStatus!=='pago':p.statusEntrega===filtro))&&`${p.id} ${p.cliente?.nome||''} ${p.cliente?.email||''}`.toLowerCase().includes(busca.toLowerCase())),[pedidos,filtro,busca]);
  const pagos=pedidos.filter(p=>p.pedidoStatus==='pago');
  const receita=pagos.reduce((n,p)=>n+Number(p.valorReais||0),0);
  async function salvar(id:string,alteracoes:Record<string,string>) {
    if(!auth?.currentUser) return;
    setSalvando(id);setAviso('');
    try {
      const token=await auth.currentUser.getIdToken();
      const resposta=await fetch(API,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({id,...alteracoes})});
      const dados=await resposta.json();if(!resposta.ok)throw new Error(dados.error||'Não foi possível salvar');
      setPedidos(anteriores=>anteriores.map(p=>p.id===id?{...p,...alteracoes}:p));
    } catch(e:any){setAviso(e?.message||'Erro ao salvar');} finally{setSalvando('');}
  }
  function editar(id:string,chave:keyof Pedido,valor:string){setPedidos(lista=>lista.map(p=>p.id===id?{...p,[chave]:valor}:p));}
  async function entrar() {
    if (!auth || entrando || !email.trim() || !senha) return;
    setErro('');
    setEntrando(true);
    try {
      const resultado = await signInWithEmailAndPassword(auth, email.trim(), senha);
      if (resultado.user.uid !== ADMIN_UID) {
        await signOut(auth);
        setErro('Esta conta não tem permissão para administrar a AirClean.');
      } else {
        setUsuario(resultado.user);
      }
    } catch (e: any) {
      console.error('Falha no login AirClean:', e?.code ?? e);
      setErro('Não foi possível entrar. Confira o e-mail e a senha.');
    } finally {
      setEntrando(false);
      setSenha('');
    }
  }

  async function sair() {
    if (!auth) return;
    try {
      await signOut(auth);
      setUsuario(null);
    } catch (e) {
      console.error('Erro ao sair do AirClean:', e);
      setErro('Não foi possível encerrar a sessão.');
    }
  }

  if (carregando) {
    return <View style={styles.centro}><ActivityIndicator size="large" color="#2386ee" /><Text style={styles.legenda}>Verificando acesso...</Text></View>;
  }

  if (!usuario || usuario.uid !== ADMIN_UID) {
    return (
      <View style={styles.fundo}>
        <View style={styles.loginCard}>
          <View style={styles.logo}><Text style={styles.logoTexto}>AC</Text></View>
          <Text style={styles.marca}>AirClean <Text style={styles.azul}>Admin</Text></Text>
          <Text style={styles.subtitulo}>Entre para gerenciar sua loja com segurança.</Text>
          <Text style={styles.label}>E-mail administrativo</Text>
          <TextInput style={styles.input} placeholder="seu@email.com" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />
          <Text style={styles.label}>Senha</Text>
          <TextInput style={styles.input} placeholder="Sua senha" placeholderTextColor="#94a3b8" secureTextEntry value={senha} onChangeText={setSenha} onSubmitEditing={entrar} />
          {!!erro && <Text style={styles.erro}>{erro}</Text>}
          <Pressable onPress={entrar} disabled={entrando || !auth || !email.trim() || !senha} style={[styles.botao, (entrando || !auth) && styles.botaoDesabilitado]}>
            <Text style={styles.botaoTexto}>{entrando ? 'Entrando...' : 'Entrar no painel →'}</Text>
          </Pressable>
          <Text style={styles.rodape}>Acesso restrito ao administrador autorizado.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.painel} contentContainerStyle={styles.conteudo}>
      <View style={styles.topo}>
        <View><Text style={styles.marca}>AirClean <Text style={styles.azul}>Admin</Text></Text><Text style={styles.subtitulo}>Painel de controle da loja</Text></View>
        <Pressable onPress={sair} style={styles.sair}><Text style={styles.sairTexto}>Sair</Text></Pressable>
      </View>
      <Text style={styles.titulo}>Visão geral da AirClean</Text>
      <Text style={styles.subtitulo}>Pedidos registrados no Firebase • Atualize para consultar novas compras</Text>
      <Pressable onPress={carregarPedidos} style={styles.botao}><Text style={styles.botaoTexto}>{carregandoPedidos?'Carregando...':'↻ Atualizar pedidos'}</Text></Pressable>
      {!!aviso && <Text style={styles.erro}>{aviso}</Text>}
      {limite && <Text style={styles.erro}>Exibindo somente os 200 registros mais recentes. Adicione paginação antes de ampliar o volume de vendas.</Text>}
      <View style={styles.grid}>
        {[['📦','Pedidos',pedidos.length],['💰','Faturamento confirmado',receita.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})],['✅','Pagos',pagos.length],['⏳','Aguardando pagamento',pedidos.length-pagos.length]].map(([icone,titulo,valor])=><View key={String(titulo)} style={styles.card}><Text style={styles.cardIcone}>{icone}</Text><Text style={styles.cardTitulo}>{valor}</Text><Text style={styles.cardDescricao}>{titulo}</Text></View>)}
      </View>
      <Text style={[styles.titulo,{marginTop:30,marginBottom:12}]}>Gerenciar pedidos</Text>
      <TextInput style={styles.input} placeholder="Buscar por cliente, e-mail ou pedido" value={busca} onChangeText={setBusca}/>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:18}}>
        {['todos','pagos','pendentes',...etapas].map(item=><Pressable key={item} onPress={()=>setFiltro(item)} style={[styles.sair,filtro===item&&{backgroundColor:'#dbeafe'}]}><Text style={styles.sairTexto}>{item}</Text></Pressable>)}
      </View>
      {filtrados.length===0 && <Text style={styles.subtitulo}>Nenhum pedido encontrado.</Text>}
      {filtrados.map(p=><View key={p.id} style={[styles.card,{marginBottom:14}]}>
        <Text style={styles.cardTitulo}>{p.cliente?.nome||'Cliente não informado'} • {(Number(p.valorReais)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</Text>
        <Text style={styles.cardDescricao}>Pedido: {p.id} | Criado: {p.criadoEm?new Date(p.criadoEm).toLocaleString('pt-BR'):'—'}</Text>
        <Text style={styles.cardDescricao}>Pagamento: {p.pedidoStatus||'—'} / {p.pagamentoStatus||'—'}</Text>
        <Text style={styles.cardDescricao}>Produto: {p.produto?.nome||'AirClean'} • Quantidade: {p.produto?.quantidade||1}</Text>
        <Text style={styles.cardDescricao}>Contato: {p.cliente?.email||'—'} | {p.cliente?.telefone||'—'}</Text>
        <Text style={styles.cardDescricao}>Entrega: {[p.entrega?.rua,p.entrega?.numero,p.entrega?.bairro,p.entrega?.cidade,p.entrega?.estado,p.entrega?.cep].filter(Boolean).join(', ')}</Text>
        <Text style={[styles.label,{marginTop:15}]}>Etapa de entrega</Text>
        <View style={{flexDirection:'row',gap:6,flexWrap:'wrap',marginBottom:12}}>{etapas.map(etapa=><Pressable key={etapa} onPress={()=>salvar(p.id,{statusEntrega:etapa})} disabled={salvando===p.id} style={[styles.sair,p.statusEntrega===etapa&&{backgroundColor:'#bfdbfe'}]}><Text style={styles.sairTexto}>{etapa}</Text></Pressable>)}</View>
        <Text style={styles.label}>Transportadora</Text><TextInput style={styles.input} value={p.transportadora||''} onChangeText={v=>editar(p.id,'transportadora',v)} placeholder="Transportadora"/>
        <Text style={styles.label}>Código de rastreio</Text><TextInput style={styles.input} value={p.codigoRastreio||''} onChangeText={v=>editar(p.id,'codigoRastreio',v)} placeholder="Código de rastreamento"/>
        <Text style={styles.label}>Observações internas</Text><TextInput style={styles.input} value={p.observacao||''} onChangeText={v=>editar(p.id,'observacao',v)} placeholder="Anotações sobre o pedido"/>
        <Pressable onPress={()=>salvar(p.id,{transportadora:p.transportadora||'',codigoRastreio:p.codigoRastreio||'',observacao:p.observacao||''})} disabled={salvando===p.id} style={styles.botao}><Text style={styles.botaoTexto}>{salvando===p.id?'Salvando...':'Salvar dados de entrega'}</Text></Pressable>
      </View>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: '#f0f5fb', justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 600 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f5fb' },
  legenda: { marginTop: 15, color: '#64748b' },
  loginCard: { backgroundColor: '#fff', borderRadius: 24, padding: 34, width: '100%', maxWidth: 440, borderWidth: 1, borderColor: '#e2e8f0' },
  logo: { width: 58, height: 58, borderRadius: 17, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoTexto: { color: '#fff', fontWeight: '900', fontSize: 22 },
  marca: { fontSize: 25, fontWeight: '900', color: '#0f172a' },
  azul: { color: '#2386ee' },
  subtitulo: { color: '#64748b', fontSize: 14, marginTop: 7, marginBottom: 22 },
  label: { fontWeight: '700', color: '#334155', marginBottom: 8, fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 14, height: 50, marginBottom: 18, color: '#0f172a', backgroundColor: '#fff' },
  erro: { color: '#b91c1c', marginBottom: 14, fontSize: 13 },
  botao: { backgroundColor: '#2386ee', borderRadius: 12, padding: 16, alignItems: 'center' },
  botaoDesabilitado: { opacity: 0.6 },
  botaoTexto: { color: '#fff', fontWeight: '800', fontSize: 15 },
  rodape: { textAlign: 'center', marginTop: 20, color: '#94a3b8', fontSize: 12 },
  painel: { flex: 1, backgroundColor: '#f5f8fc' },
  conteudo: { padding: 24, maxWidth: 1150, width: '100%', alignSelf: 'center' },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, flexWrap: 'wrap' },
  sair: { borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  sairTexto: { color: '#334155', fontWeight: '700' },
  titulo: { fontSize: 29, fontWeight: '900', color: '#0f172a' },
  aviso: { backgroundColor: '#e9f8f0', padding: 20, borderRadius: 16, marginTop: 10, marginBottom: 24 },
  avisoTitulo: { color: '#087442', fontWeight: '800', fontSize: 16 },
  avisoTexto: { color: '#345c49', marginTop: 7, lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 22, minWidth: 230, flexGrow: 1, flexBasis: '30%' },
  cardIcone: { fontSize: 29, marginBottom: 16 },
  cardTitulo: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  cardDescricao: { color: '#64748b', fontSize: 13, marginTop: 7 },
  emBreve: { color: '#2386ee', fontSize: 12, fontWeight: '700', marginTop: 16 },
});
