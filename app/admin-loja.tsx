import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut, type Auth, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

// Acesso exclusivo à interface AirClean. As APIs administrativas DEVEM validar
// o ID token do Firebase no servidor e conferir este UID antes de ler/alterar dados.
const ADMIN_UID = 'U2yi9HTIpMWJyuTVLeSJ5vTrDaf1';
const APP_ADMIN_NOME = 'airclean-admin-isolado';

export default function AdminLoja() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [entrando, setEntrando] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    let cancelar: (() => void) | undefined;
    try {
      // Um Firebase App nomeado tem uma sessão Auth independente da sessão do bolão.
      const existente = getApps().find((app) => app.name === APP_ADMIN_NOME);
      const appAdmin = existente ?? initializeApp(getApp().options, APP_ADMIN_NOME);
      const instancia = getAuth(appAdmin);
      setAuth(instancia);
      // Configura persistência para novos logins; não reinicializa Auth existente.
      setPersistence(instancia, browserLocalPersistence).catch((e) => {
        console.warn('AirClean: persistência local indisponível:', e);
      });
      cancelar = onAuthStateChanged(instancia, (u) => {
        if (!ativo) return;
        setUsuario(u);
        setCarregando(false);
      }, (e) => {
        if (!ativo) return;
        console.error('AirClean: falha no observador de autenticação:', e);
        setErro('Não foi possível verificar o login.');
        setCarregando(false);
      });
    } catch (e) {
      console.error('AirClean: falha ao iniciar Firebase:', e);
      setErro('Firebase não inicializado. Verifique a configuração do projeto.');
      setCarregando(false);
    }
    return () => { ativo = false; cancelar?.(); };
  }, []);

  async function entrar() {
    if (!auth || entrando || !email.trim() || !senha) return;
    setErro('');
    setEntrando(true);
    try {
      // Espera a persistência ser aplicada antes de autenticar.
      await setPersistence(auth, browserLocalPersistence);
      const resultado = await signInWithEmailAndPassword(auth, email.trim(), senha);
      if (resultado.user.uid !== ADMIN_UID) {
        await signOut(auth);
        setErro('Esta conta não tem permissão para administrar a AirClean.');
      }
    } catch (e) {
      console.error('AirClean: erro de login:', e);
      setErro('Não foi possível entrar. Confira o e-mail e a senha ou tente novamente.');
    } finally {
      setEntrando(false);
      setSenha('');
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
          <Pressable onPress={entrar} disabled={entrando || !auth || !email.trim() || !senha} style={[styles.botao, (entrando || !auth || !email.trim() || !senha) && styles.botaoDesabilitado]}>
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
        <Pressable onPress={() => auth && signOut(auth)} style={styles.sair}><Text style={styles.sairTexto}>Sair</Text></Pressable>
      </View>
      <Text style={styles.titulo}>Bem-vindo ao seu painel 👋</Text>
      <Text style={styles.subtitulo}>Seu login administrativo está funcionando.</Text>
      <View style={styles.aviso}><Text style={styles.avisoTitulo}>✓ Acesso autorizado</Text><Text style={styles.avisoTexto}>Esta é a primeira etapa. Os dados de vendas ainda não foram conectados. Não há valores fictícios neste painel.</Text></View>
      <View style={styles.grid}>
        {[
          ['📊', 'Dashboard', 'Gráficos e indicadores de vendas'],
          ['🛍️', 'Pedidos', 'Pagos, pendentes e cancelados'],
          ['📦', 'Produtos', 'Preços e disponibilidade'],
          ['🚚', 'Entregas', 'Envios e rastreamento'],
          ['👥', 'Clientes', 'Histórico de compras'],
          ['⚙️', 'Configurações', 'Dados e segurança da loja'],
        ].map(([icone, titulo, descricao]) => (
          <View key={titulo} style={styles.card}><Text style={styles.cardIcone}>{icone}</Text><Text style={styles.cardTitulo}>{titulo}</Text><Text style={styles.cardDescricao}>{descricao}</Text><Text style={styles.emBreve}>Em desenvolvimento</Text></View>
        ))}
      </View>
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
