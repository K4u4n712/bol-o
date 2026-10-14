import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

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
  const { width: largura } = useWindowDimensions();
  const [pagina,setPagina] = useState('Visão geral');
  const [pedidoAberto,setPedidoAberto] = useState('');
  const [confirmarCancelamento,setConfirmarCancelamento] = useState('');
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

  const mobile = largura < 780;
  const moeda = (n:number) => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const pendentes = pedidos.filter(p=>p.pedidoStatus!=='pago');
  const preparar = pagos.filter(p=>!p.statusEntrega || p.statusEntrega==='novo');
  const enviados = pagos.filter(p=>p.statusEntrega==='enviado');
  const entregues = pagos.filter(p=>p.statusEntrega==='entregue');
  const paginas = ['Visão geral','Pedidos','Clientes','Financeiro'];
  const stat = (nome:string, valor:string, detalhe:string, cor:string) => <View style={[styles.metric,{minWidth:mobile?'47%':195}]} key={nome}><Text style={styles.metricLabel}>{nome}</Text><Text style={[styles.metricValue,{color:cor}]}>{valor}</Text><Text style={styles.metricDetail}>{detalhe}</Text></View>;
  const cardPedido = (p:Pedido) => {
    const pago=p.pedidoStatus==='pago';
    const aberto=pedidoAberto===p.id;
    return <View key={p.id} style={styles.orderCard}>
      <Pressable onPress={()=>setPedidoAberto(aberto?'':p.id)} style={[styles.orderTop,{flexDirection:mobile?'column':'row'}]}>
        <View style={{flex:1}}><Text style={styles.orderName}>{p.cliente?.nome||'Cliente não informado'}</Text><Text style={styles.muted}>#{p.id.slice(0,12)} · {p.criadoEm?new Date(p.criadoEm).toLocaleString('pt-BR'):'Sem data'}</Text><Text style={styles.muted}>{p.produto?.nome||'AirClean'} · {p.produto?.quantidade||1} un.</Text></View>
        <View style={{alignItems:mobile?'flex-start':'flex-end',gap:6}}><Text style={styles.orderPrice}>{moeda(Number(p.valorReais)||0)}</Text><Text style={[styles.pill,{backgroundColor:pago?'#dcfce7':'#fef3c7',color:pago?'#166534':'#92400e'}]}>{pago?'● Pago':'● Aguardando pagamento'}</Text><Text style={styles.muted}>Entrega: {p.statusEntrega||'novo'} {aberto?'▲':'▼'}</Text></View>
      </Pressable>
      {aberto && <View style={styles.orderDetails}>
        <Text style={styles.sectionMini}>Dados do pedido</Text>
        <Text style={styles.info}>Pedido completo: {p.id}</Text>
        <Text style={styles.info}>E-mail: {p.cliente?.email||'—'} · Telefone: {p.cliente?.telefone||'—'}</Text>
        <Text style={styles.info}>Endereço: {[p.entrega?.rua,p.entrega?.numero,p.entrega?.bairro,p.entrega?.cidade,p.entrega?.estado,p.entrega?.cep].filter(Boolean).join(', ')||'Não informado'}</Text>
        <Text style={styles.info}>Pagamento: {p.pagamentoStatus||'—'} · Status do pedido: {p.pedidoStatus||'—'}</Text>
        <Text style={[styles.sectionMini,{marginTop:16}]}>Etapa de entrega</Text>
        <View style={styles.chips}>{etapas.map(etapa=><Pressable key={etapa} onPress={()=>{if(etapa==='cancelado'){setConfirmarCancelamento(p.id);return;}void salvar(p.id,{statusEntrega:etapa});}} disabled={salvando===p.id || (!pago && ['preparando','enviado','entregue'].includes(etapa))} style={[styles.chip,p.statusEntrega===etapa&&styles.chipActive,(!pago&&['preparando','enviado','entregue'].includes(etapa))&&{opacity:.4}]}><Text style={[styles.chipText,p.statusEntrega===etapa&&{color:'#fff'}]}>{({novo:'Novo',preparando:'Em preparo',enviado:'Enviado',entregue:'Entregue',cancelado:'Cancelado'} as Record<string,string>)[etapa]}</Text></Pressable>)}</View>
        {confirmarCancelamento===p.id && <View style={styles.warning}><Text style={styles.info}>Marcar como cancelado não reembolsa o Pix. Confirma a alteração do status de entrega?</Text><View style={styles.chips}><Pressable style={styles.smallButton} onPress={()=>setConfirmarCancelamento('')}><Text>Voltar</Text></Pressable><Pressable style={styles.dangerButton} onPress={()=>{setConfirmarCancelamento('');void salvar(p.id,{statusEntrega:'cancelado'});}}><Text style={{color:'#fff',fontWeight:'700'}}>Confirmar</Text></Pressable></View></View>}
        <Text style={styles.fieldLabel}>Transportadora</Text><TextInput style={styles.field} value={p.transportadora||''} onChangeText={v=>editar(p.id,'transportadora',v)} placeholder="Ex.: Correios" placeholderTextColor="#94a3b8" />
        <Text style={styles.fieldLabel}>Código de rastreio</Text><TextInput style={styles.field} value={p.codigoRastreio||''} onChangeText={v=>editar(p.id,'codigoRastreio',v)} placeholder="Código de rastreamento" placeholderTextColor="#94a3b8" />
        <Text style={styles.fieldLabel}>Observações internas</Text><TextInput style={[styles.field,{height:76,textAlignVertical:'top'}]} multiline value={p.observacao||''} onChangeText={v=>editar(p.id,'observacao',v)} placeholder="Anotações sobre o pedido" placeholderTextColor="#94a3b8" />
        <Pressable onPress={()=>salvar(p.id,{transportadora:p.transportadora||'',codigoRastreio:p.codigoRastreio||'',observacao:p.observacao||''})} disabled={salvando===p.id} style={[styles.primary,{alignSelf:'flex-start'}]}><Text style={styles.primaryText}>{salvando===p.id?'Salvando...':'Salvar dados da entrega'}</Text></Pressable>
      </View>}
    </View>;
  };
  return <View style={styles.shell}>
    {!mobile && <View style={styles.sidebar}><View style={styles.brandRow}><View style={styles.brandIcon}><Text style={{color:'#fff',fontWeight:'900',fontSize:18}}>AC</Text></View><View><Text style={styles.brand}>AirClean</Text><Text style={styles.brandSub}>CENTRAL DE GESTÃO</Text></View></View><Text style={styles.menuHeading}>MENU PRINCIPAL</Text>{paginas.map((nome,i)=><Pressable key={nome} onPress={()=>setPagina(nome)} style={[styles.menuItem,pagina===nome&&styles.menuActive]}><Text style={[styles.menuText,pagina===nome&&{color:'#fff'}]}>{['▦','▤','♙','◈'][i]}   {nome}</Text></Pressable>)}<View style={{flex:1}}/><View style={styles.sidebarFoot}><Text style={{color:'#cbd5e1',fontWeight:'700'}}>AirClean Brasil</Text><Text style={{color:'#94a3b8',fontSize:11,marginTop:5}}>Administração segura</Text><Pressable onPress={sair} style={{marginTop:18}}><Text style={{color:'#fff'}}>↪ Sair da conta</Text></Pressable></View></View>}
    <ScrollView style={styles.workspace} contentContainerStyle={[styles.workspaceContent,{padding:mobile?16:30}]}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>PAINEL ADMINISTRATIVO</Text><Text style={styles.pageTitle}>{pagina}</Text><Text style={styles.pageSubtitle}>Acompanhe sua loja de forma simples e organizada.</Text></View><Pressable onPress={carregarPedidos} disabled={carregandoPedidos} style={styles.refresh}><Text style={styles.refreshText}>{carregandoPedidos?'Atualizando...':'↻ Atualizar'}</Text></Pressable></View>
      {mobile && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:18}}><View style={styles.chips}>{paginas.map(nome=><Pressable key={nome} onPress={()=>setPagina(nome)} style={[styles.chip,pagina===nome&&styles.chipActive]}><Text style={[styles.chipText,pagina===nome&&{color:'#fff'}]}>{nome}</Text></Pressable>)}<Pressable onPress={sair} style={styles.chip}><Text>Sair</Text></Pressable></View></ScrollView>}
      {!!aviso&&<View style={styles.warning}><Text style={{color:'#991b1b'}}>{aviso}</Text></View>}
      {limite&&<View style={styles.warning}><Text style={{color:'#92400e'}}>Exibindo até 200 registros recentes. Os indicadores podem estar incompletos; falta paginação no backend.</Text></View>}
      {pagina==='Visão geral' && <>
        <View style={styles.metrics}>{stat('Receita confirmada',moeda(receita),'Somente pedidos marcados como pagos','#0f172a')}{stat('Pedidos registrados',String(pedidos.length),'Total carregado do Firebase','#0f172a')}{stat('Aguardando pagamento',String(pendentes.length),'Não contam como faturamento','#d97706')}{stat('Para preparar',String(preparar.length),'Pagos aguardando preparação','#2563eb')}</View>
        <View style={[styles.twoCol,{flexDirection:mobile?'column':'row'}]}><View style={[styles.panel,{flex:1}]}><Text style={styles.panelTitle}>Acompanhamento de entregas</Text><Text style={styles.panelSubtitle}>Situação atual dos pedidos pagos</Text>{[['Para preparar',preparar.length],['Enviados',enviados.length],['Entregues',entregues.length]].map(([nome,qtd])=><View key={String(nome)} style={styles.progressRow}><View style={styles.progressHead}><Text style={styles.info}>{nome}</Text><Text style={styles.info}>{qtd}</Text></View><View style={styles.track}><View style={[styles.fill,{width:`${pagos.length?Math.round(Number(qtd)/pagos.length*100):0}%`}]} /></View></View>)}</View><View style={[styles.panel,{flex:1}]}><Text style={styles.panelTitle}>Precisa de atenção</Text><Text style={styles.panelSubtitle}>Prioridades da operação</Text><Text style={styles.task}>📦  {preparar.length} pedido(s) pago(s) para preparar</Text><Text style={styles.task}>🚚  {enviados.length} pedido(s) enviado(s)</Text><Text style={styles.task}>⏳  {pendentes.length} pagamento(s) pendente(s)</Text><Pressable style={[styles.primary,{alignSelf:'flex-start',marginTop:16}]} onPress={()=>{setPagina('Pedidos');setFiltro('pagos');}}><Text style={styles.primaryText}>Gerenciar pedidos →</Text></Pressable></View></View>
        <View style={styles.panel}><Text style={styles.panelTitle}>Pedidos recentes</Text><Text style={styles.panelSubtitle}>Clique para consultar e gerenciar</Text>{pedidos.slice(0,5).map(cardPedido)}{pedidos.length===0&&<Text style={styles.muted}>Nenhum pedido registrado.</Text>}</View>
      </>}
      {pagina==='Pedidos' && <View style={styles.panel}><Text style={styles.panelTitle}>Todos os pedidos</Text><Text style={styles.panelSubtitle}>Pesquise, filtre e atualize as etapas de entrega.</Text><TextInput style={styles.search} value={busca} onChangeText={setBusca} placeholder="Buscar por nome, e-mail ou número do pedido" placeholderTextColor="#94a3b8"/><View style={styles.chips}>{['todos','pagos','pendentes',...etapas].map(item=><Pressable key={item} onPress={()=>setFiltro(item)} style={[styles.chip,filtro===item&&styles.chipActive]}><Text style={[styles.chipText,filtro===item&&{color:'#fff'}]}>{({todos:'Todos',pagos:'Pagos',pendentes:'Pendentes',novo:'Novos',preparando:'Em preparo',enviado:'Enviados',entregue:'Entregues',cancelado:'Cancelados'} as Record<string,string>)[item]}</Text></Pressable>)}</View><Text style={[styles.muted,{marginVertical:14}]}>{filtrados.length} pedido(s) encontrado(s)</Text>{filtrados.map(cardPedido)}{filtrados.length===0&&<Text style={styles.muted}>Nenhum pedido corresponde à pesquisa.</Text>}</View>}
      {pagina==='Clientes' && <View style={styles.panel}><Text style={styles.panelTitle}>Clientes</Text><Text style={styles.panelSubtitle}>Contatos identificados nos pedidos carregados.</Text>{Array.from(new Map(pedidos.filter(p=>p.cliente?.email).map(p=>[p.cliente!.email!.toLowerCase(),p])).values()).map(p=><View key={p.cliente?.email} style={styles.customer}><View><Text style={styles.orderName}>{p.cliente?.nome||'Cliente'}</Text><Text style={styles.muted}>{p.cliente?.email} · {p.cliente?.telefone||'Sem telefone'}</Text></View><Text style={styles.muted}>{pedidos.filter(x=>x.cliente?.email?.toLowerCase()===p.cliente?.email?.toLowerCase()).length} pedido(s)</Text></View>)}{pedidos.length===0&&<Text style={styles.muted}>Ainda não há clientes.</Text>}</View>}
      {pagina==='Financeiro' && <><View style={styles.metrics}>{stat('Receita confirmada',moeda(receita),'Valor bruto dos pedidos pagos','#16a34a')}{stat('Pedidos pagos',String(pagos.length),'Confirmação registrada no Firebase','#0f172a')}{stat('Ticket médio',moeda(pagos.length?receita/pagos.length:0),'Receita dividida pelos pedidos pagos','#0f172a')}{stat('Receita não confirmada',moeda(pendentes.reduce((s,p)=>s+Number(p.valorReais||0),0)),'Não é dinheiro recebido','#d97706')}</View><View style={styles.panel}><Text style={styles.panelTitle}>Entenda seus números</Text><Text style={styles.task}>A receita mostrada é bruta, não representa lucro.</Text><Text style={styles.task}>Taxas do Mercado Pago, custo do produto, frete e anúncios ainda não são descontados.</Text><Text style={styles.task}>Pedidos pendentes e de teste devem ser conferidos antes de considerar o dinheiro disponível.</Text></View></>}
      <Text style={styles.footer}>AirClean Admin · Dados protegidos por autenticação Firebase · Atualize para consultar novas compras</Text>
    </ScrollView>
  </View>;

}

const styles = StyleSheet.create({
  fundo:{flex:1,backgroundColor:'#f1f5f9',justifyContent:'center',alignItems:'center',padding:20,minHeight:600},
  centro:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#f1f5f9'},
  legenda:{marginTop:15,color:'#64748b'},
  loginCard:{backgroundColor:'#fff',borderRadius:24,padding:34,width:'100%',maxWidth:440,borderWidth:1,borderColor:'#e2e8f0'},
  logo:{width:58,height:58,borderRadius:17,backgroundColor:'#0f172a',alignItems:'center',justifyContent:'center',marginBottom:20},
  logoTexto:{color:'#fff',fontWeight:'900',fontSize:22},
  marca:{fontSize:25,fontWeight:'900',color:'#0f172a'},azul:{color:'#2563eb'},
  subtitulo:{color:'#64748b',fontSize:14,marginTop:7,marginBottom:22},
  label:{fontWeight:'700',color:'#334155',marginBottom:8,fontSize:13},
  input:{borderWidth:1,borderColor:'#cbd5e1',borderRadius:12,paddingHorizontal:14,height:50,marginBottom:18,color:'#0f172a',backgroundColor:'#fff'},
  erro:{color:'#b91c1c',marginBottom:14,fontSize:13},
  botao:{backgroundColor:'#2563eb',borderRadius:12,padding:16,alignItems:'center'},
  botaoDesabilitado:{opacity:.6},botaoTexto:{color:'#fff',fontWeight:'800',fontSize:15},
  rodape:{textAlign:'center',marginTop:20,color:'#94a3b8',fontSize:12},
  shell:{flex:1,flexDirection:'row',backgroundColor:'#f6f8fc',minHeight:600},
  sidebar:{width:244,backgroundColor:'#101b31',paddingHorizontal:18,paddingTop:28,paddingBottom:22},
  brandRow:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:46},
  brandIcon:{height:42,width:42,borderRadius:13,backgroundColor:'#2563eb',alignItems:'center',justifyContent:'center'},
  brand:{color:'#fff',fontSize:21,fontWeight:'900'},brandSub:{color:'#94a3b8',fontSize:9,letterSpacing:1.5,marginTop:3},
  menuHeading:{color:'#64748b',fontSize:10,fontWeight:'800',letterSpacing:1.4,marginBottom:15,marginLeft:12},
  menuItem:{paddingHorizontal:14,paddingVertical:15,borderRadius:11,marginBottom:5},menuActive:{backgroundColor:'#2563eb'},
  menuText:{color:'#b7c4d8',fontWeight:'700',fontSize:14},sidebarFoot:{borderTopWidth:1,borderColor:'#334155',paddingTop:20},
  workspace:{flex:1},workspaceContent:{width:'100%',maxWidth:1480,alignSelf:'center',paddingBottom:48},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16,marginBottom:25},
  eyebrow:{fontSize:10,color:'#64748b',fontWeight:'800',letterSpacing:1.8,marginBottom:8},
  pageTitle:{fontSize:30,fontWeight:'900',color:'#101b31'},pageSubtitle:{color:'#64748b',marginTop:6,fontSize:13},
  refresh:{borderWidth:1,borderColor:'#dbe3ed',borderRadius:10,paddingHorizontal:17,paddingVertical:12,backgroundColor:'#fff'},refreshText:{color:'#334155',fontWeight:'800'},
  metrics:{flexDirection:'row',flexWrap:'wrap',gap:14,marginBottom:20},
  metric:{flexGrow:1,flexBasis:'22%',backgroundColor:'#fff',borderRadius:15,padding:20,borderWidth:1,borderColor:'#e6ebf2'},
  metricLabel:{color:'#64748b',fontWeight:'700',fontSize:12},metricValue:{fontSize:26,fontWeight:'900',marginTop:12},metricDetail:{color:'#94a3b8',fontSize:11,marginTop:7},
  twoCol:{gap:18,marginBottom:18},panel:{backgroundColor:'#fff',borderRadius:16,padding:20,borderWidth:1,borderColor:'#e6ebf2',marginBottom:18},
  panelTitle:{fontSize:18,fontWeight:'900',color:'#0f172a'},panelSubtitle:{color:'#64748b',fontSize:12,marginTop:5,marginBottom:20},
  progressRow:{marginBottom:16},progressHead:{flexDirection:'row',justifyContent:'space-between',marginBottom:7},
  track:{height:8,borderRadius:8,backgroundColor:'#e8eef8',overflow:'hidden'},fill:{height:8,backgroundColor:'#2563eb',borderRadius:8},
  task:{fontSize:13,color:'#334155',marginTop:14,lineHeight:20},
  primary:{backgroundColor:'#2563eb',paddingHorizontal:18,paddingVertical:13,borderRadius:10},primaryText:{color:'#fff',fontWeight:'800',fontSize:13},
  orderCard:{borderWidth:1,borderColor:'#e8edf4',borderRadius:12,marginBottom:10,backgroundColor:'#fff',overflow:'hidden'},
  orderTop:{padding:16,justifyContent:'space-between',gap:14},orderName:{fontSize:14,color:'#0f172a',fontWeight:'800'},orderPrice:{fontSize:17,color:'#0f172a',fontWeight:'900'},
  muted:{color:'#64748b',fontSize:12,marginTop:6},pill:{overflow:'hidden',paddingHorizontal:10,paddingVertical:5,borderRadius:30,fontSize:11,fontWeight:'800'},
  orderDetails:{borderTopWidth:1,borderColor:'#edf2f7',padding:17,backgroundColor:'#fafcff'},
  sectionMini:{color:'#0f172a',fontSize:14,fontWeight:'900',marginBottom:9},info:{color:'#475569',fontSize:12,lineHeight:21},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14},chip:{borderWidth:1,borderColor:'#dbe3ed',paddingHorizontal:12,paddingVertical:10,borderRadius:9,backgroundColor:'#fff'},chipActive:{backgroundColor:'#2563eb',borderColor:'#2563eb'},chipText:{fontSize:12,fontWeight:'800',color:'#475569'},
  fieldLabel:{fontSize:12,fontWeight:'800',color:'#334155',marginTop:10,marginBottom:7},field:{borderWidth:1,borderColor:'#dbe3ed',borderRadius:10,padding:12,backgroundColor:'#fff',color:'#0f172a',fontSize:13},
  search:{borderWidth:1,borderColor:'#dbe3ed',borderRadius:10,padding:14,backgroundColor:'#fff',color:'#0f172a',marginBottom:15},
  warning:{backgroundColor:'#fff7ed',borderRadius:10,padding:14,marginBottom:16,borderWidth:1,borderColor:'#fed7aa'},
  smallButton:{backgroundColor:'#e2e8f0',padding:12,borderRadius:9},dangerButton:{backgroundColor:'#dc2626',padding:12,borderRadius:9},
  customer:{paddingVertical:16,borderBottomWidth:1,borderColor:'#edf2f7',flexDirection:'row',justifyContent:'space-between',flexWrap:'wrap',gap:12},
  footer:{textAlign:'center',fontSize:11,color:'#94a3b8',marginTop:20},
});
