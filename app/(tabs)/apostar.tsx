import { mostrarAlerta } from "../../utils/mostrarAlerta";
import React, { useState, useEffect } from "react";
import { router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../services/firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Image
} from "react-native";

const VALOR_APOSTA = 10;

// ============================================================================
// COMPONENTE INTERNO: CARD DE APOSTA (Renderiza 1 para cada jogo aberto)
// ============================================================================
function CardAposta({ jogo }: { jogo: any }) {
  const { user, atualizarSaldoUsuario } = useAuth();

  const [golsCasa, setGolsCasa] = useState(0);
  const [golsFora, setGolsFora] = useState(0);
  const [jaApostou, setJaApostou] = useState(false);
  const [alteracaoUsada, setAlteracaoUsada] = useState(false);
  const [placarApostado, setPlacarApostado] = useState("");

  const apostaBloqueada = jaApostou && alteracaoUsada;

  useEffect(() => {
    carregarAposta();
  }, [user, jogo.id]);

  function getApostaId() {
    if (!user) return "";
    const identificador = user.uid ? user.uid : user.email.toLowerCase().replace(/[\/\\.#$[\]]/g, "_");
    return `${jogo.id}_${identificador}`;
  }

  async function carregarAposta() {
    try {
      if (!user) return;

      const apostaRef = doc(db, "apostas", getApostaId());
      const apostaSnap = await getDoc(apostaRef);

      if (!apostaSnap.exists()) return;

      const aposta = apostaSnap.data();

      setJaApostou(true);
      setAlteracaoUsada(!!aposta.jaAlterou);
      setPlacarApostado(aposta.placar || "");

      if (typeof aposta.golsCasa === "number") setGolsCasa(aposta.golsCasa);
      if (typeof aposta.golsFora === "number") setGolsFora(aposta.golsFora);

    } catch (error) {
      console.log("Erro ao carregar aposta:", error);
    }
  }

  function aumentarCasa() {
    if (!apostaBloqueada) setGolsCasa((v) => v + 1);
  }

  function diminuirCasa() {
    if (!apostaBloqueada && golsCasa > 0) setGolsCasa((v) => v - 1);
  }

  function aumentarFora() {
    if (!apostaBloqueada) setGolsFora((v) => v + 1);
  }

  function diminuirFora() {
    if (!apostaBloqueada && golsFora > 0) setGolsFora((v) => v - 1);
  }

  async function confirmarPalpite() {
    try {
      if (!user) {
        mostrarAlerta("Erro", "Faça login primeiro.");
        return;
      }

      const apostaRef = doc(db, "apostas", getApostaId());
      const apostaSnap = await getDoc(apostaRef);
      const apostaExistente = apostaSnap.exists() ? apostaSnap.data() : null;

      if (!apostaExistente && user.saldo < VALOR_APOSTA) {
        mostrarAlerta("Saldo insuficiente", `Você precisa ter pelo menos ${VALOR_APOSTA} BRL para apostar.`);
        return;
      }

      if (apostaExistente && apostaExistente.jaAlterou) {
        mostrarAlerta("Alteração já usada", "Você só pode alterar seu palpite uma vez.");
        return;
      }

      const placar = `${golsCasa} x ${golsFora}`;

      const dadosAposta: any = {
        userId: user.uid || "",
        nome: user.nome,
        email: user.email,
        emailLower: user.email.toLowerCase(),
        jogoId: jogo.id,
        jogo: `${jogo.timeCasa.nome} x ${jogo.timeFora.nome}`,
        timeCasa: jogo.timeCasa.nome,
        timeFora: jogo.timeFora.nome,
        golsCasa,
        golsFora,
        placar,
        valor: VALOR_APOSTA,
        jaAlterou: !!apostaExistente,
        atualizadoEm: serverTimestamp(),
      };

      if (!apostaExistente) dadosAposta.criadoEm = serverTimestamp();

      await setDoc(apostaRef, dadosAposta, { merge: true });

      if (!apostaExistente) {
        await atualizarSaldoUsuario(user.email, user.saldo - VALOR_APOSTA);
      }

      setJaApostou(true);
      setAlteracaoUsada(!!apostaExistente);
      setPlacarApostado(placar);

      const msg = `${jogo.timeCasa.sigla} ${placar} ${jogo.timeFora.sigla}`;
      mostrarAlerta(apostaExistente ? "Palpite alterado!" : "Palpite salvo!", msg);
    } catch (error) {
      console.log("Erro ao salvar aposta:", error);
      mostrarAlerta("Erro", "Não foi possível salvar a aposta.");
    }
  }

  return (
    <View style={styles.cardContainer}>
      <View style={styles.matchMiniCard}>
        <View style={styles.miniTeam}>
          <Image source={{ uri: jogo.timeCasa.bandeira }} style={styles.miniFlagImg} />
          <Text style={styles.miniTeamName}>{jogo.timeCasa.nome.toUpperCase()}</Text>
        </View>

        <Text style={styles.miniVs}>X</Text>

        <View style={styles.miniTeam}>
          <Text style={styles.miniTeamName}>{jogo.timeFora.nome.toUpperCase()}</Text>
          <Image source={{ uri: jogo.timeFora.bandeira }} style={styles.miniFlagImg} />
        </View>
      </View>

      <Text style={styles.dateText}>{jogo.data} • {jogo.horario}</Text>

      <View style={styles.scoreAreaWrapper}>
        <View style={styles.scoreColumn}>
          <Text style={[styles.scoreTeam, { color: "#1B4D3E" }]}>{jogo.timeCasa.sigla}</Text>
          <View style={styles.scoreBox}>
            <TouchableOpacity style={styles.arrowButton} onPress={aumentarCasa} disabled={apostaBloqueada}>
              <Text style={[styles.arrowIcon, apostaBloqueada && styles.disabledText]}>˄</Text>
            </TouchableOpacity>
            <Text style={styles.scoreNumber}>{golsCasa}</Text>
            <TouchableOpacity style={styles.arrowButton} onPress={diminuirCasa} disabled={apostaBloqueada}>
              <Text style={[styles.arrowIcon, apostaBloqueada && styles.disabledText]}>˅</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.scoreXContainer}>
          <Text style={styles.scoreX}>x</Text>
        </View>

        <View style={styles.scoreColumn}>
          <Text style={[styles.scoreTeam, { color: "#111827" }]}>{jogo.timeFora.sigla}</Text>
          <View style={styles.scoreBox}>
            <TouchableOpacity style={styles.arrowButton} onPress={aumentarFora} disabled={apostaBloqueada}>
              <Text style={[styles.arrowIcon, apostaBloqueada && styles.disabledText]}>˄</Text>
            </TouchableOpacity>
            <Text style={styles.scoreNumber}>{golsFora}</Text>
            <TouchableOpacity style={styles.arrowButton} onPress={diminuirFora} disabled={apostaBloqueada}>
              <Text style={[styles.arrowIcon, apostaBloqueada && styles.disabledText]}>˅</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {jaApostou && (
        <View style={styles.apostaSalvaBox}>
          <Text style={styles.apostaSalvaTitle}>✅ Você já apostou neste jogo</Text>
          <Text style={styles.apostaSalvaText}>{jogo.timeCasa.sigla} {placarApostado} {jogo.timeFora.sigla}</Text>
          {!alteracaoUsada && (
            <Text style={styles.apostaAlteracaoText}>Você ainda pode alterar seu palpite uma vez.</Text>
          )}
          {alteracaoUsada && (
            <Text style={styles.apostaAlteracaoText}>Alteração já utilizada.</Text>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.confirmButton,
          jaApostou && styles.confirmButtonDone,
          apostaBloqueada && styles.confirmDisabled,
        ]}
        onPress={confirmarPalpite}
        disabled={apostaBloqueada}
      >
        <Text style={[
          styles.confirmText,
          jaApostou && styles.confirmTextDone,
          apostaBloqueada && styles.confirmTextDisabled,
        ]}>
          {!jaApostou && "Confirmar palpite"}
          {jaApostou && !alteracaoUsada && "Alterar palpite uma vez"}
          {jaApostou && alteracaoUsada && "✅ Palpite realizado"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// TELA PRINCIPAL DE APOSTAS
// ============================================================================
export default function ApostarScreen() {
  const [jogosAbertos, setJogosAbertos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const buscarJogos = async () => {
      try {
        const agora = new Date();
        const limite48h = new Date(agora.getTime() + (48 * 60 * 60 * 1000));
        
        const fData = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const urlESPN = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${fData(agora)}-${fData(limite48h)}`;

        const response = await fetch(urlESPN);
        const data = await response.json();

        // Checa no banco de dados quem o Admin bloqueou ou abriu
        const statusSnapshot = await getDocs(collection(db, "status_apostas"));
        const statusFirebase: Record<string, boolean> = {};
        statusSnapshot.forEach(docSnap => {
          statusFirebase[docSnap.id] = docSnap.data().aberta;
        });

        const filtrados = data.events.reduce((acc: any[], event: any) => {
          const dataJogo = new Date(event.date);
          const status = event.status.type.state; 
          const competidores = event.competitions[0].competitors;
          const timeCasa = competidores.find((c: any) => c.homeAway === 'home');
          const timeFora = competidores.find((c: any) => c.homeAway === 'away');

          if (dataJogo > limite48h || status === 'post') return acc;

          const jaTemStatus = statusFirebase[event.id] !== undefined;
          const isOpen = jaTemStatus ? statusFirebase[event.id] : (status === 'pre');

          // SÓ ADICIONA NA TELA SE ESTIVER ABERTO PARA APOSTA
          if (isOpen) {
            acc.push({
              id: event.id,
              data: dataJogo.toLocaleDateString('pt-BR'),
              horario: dataJogo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              timeCasa: { nome: timeCasa.team.displayName, sigla: timeCasa.team.abbreviation, bandeira: timeCasa.team.logo },
              timeFora: { nome: timeFora.team.displayName, sigla: timeFora.team.abbreviation, bandeira: timeFora.team.logo }
            });
          }
          return acc;
        }, []);

        setJogosAbertos(filtrados);
        setLoading(false);
      } catch (error) {
        console.error("Erro ao carregar jogos:", error);
        setLoading(false);
      }
    };

    buscarJogos();
  }, []);

  function abrirAjuda() {
    mostrarAlerta(
      "Como funciona?",
      "Escolha o placar exato. Cada usuário pode enviar apenas um palpite por jogo. Após apostar, você ainda pode alterar uma única vez antes do prazo final."
    );
  }

  // TELA DE CARREGAMENTO
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#006B2E" />
        <Text style={{ marginTop: 12, color: '#006B2E', fontWeight: 'bold' }}>Carregando jogos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#006B2E" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/")}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fazer meu palpite</Text>
        <TouchableOpacity style={styles.helpCircle} onPress={abrirAjuda}>
          <Text style={styles.helpText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* VERIFICAÇÃO: TEM JOGO ABERTO OU TELA VAZIA? */}
      {jogosAbertos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.padlock}>🔒</Text>
          <Text style={styles.emptyText}>Nenhuma aposta disponível no momento</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>🎯</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Acerta o placar e leva o bolão!</Text>
              <Text style={styles.infoText}>Bateu o placar exato? O prêmio é todo seu.</Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Jogos Abertos ⓘ</Text>

          {/* RENDERIZA UM CARD PARA CADA JOGO ABERTO */}
          {jogosAbertos.map((jogo) => (
            <CardAposta key={jogo.id} jogo={jogo} />
          ))}

          <Text style={styles.feeText}>⚠️ Aposta fictícia: {VALOR_APOSTA} BRL por pessoa (por jogo)</Text>
        </ScrollView>
      )}

      {/* MENU INFERIOR */}
      <View style={styles.bottomMenu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/")}>
          <Text style={styles.menuIcon}>🏠</Text>
          <Text style={styles.menuText}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItemActive}>
          <Text style={styles.menuIcon}>🎯</Text>
          <Text style={styles.menuTextActive}>Apostar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/bolao")}>
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuText}>Bolão</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/ranking")}>
          <Text style={styles.menuIcon}>🏆</Text>
          <Text style={styles.menuText}>Ranking</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/perfil")}>
          <Text style={styles.menuIcon}>👤</Text>
          <Text style={styles.menuText}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F5F7F6",
  },
  header: {
    backgroundColor: "#006B2E",
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  helpCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  helpText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  // ESTILOS TELA VAZIA (CADEADO)
  emptyContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80, 
  },
  padlock: {
    fontSize: 65,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 40,
  },

  // ESTILOS CONTEÚDO SCROLL
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 98,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 16,
    marginBottom: 10,
  },
  
  // ESTILOS DO CARD INDIVIDUAL
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  matchMiniCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  miniTeam: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniFlagImg: {
    width: 30,
    height: 20,
    borderRadius: 4,
    resizeMode: 'contain',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  miniTeamName: {
    fontSize: 11,
    fontWeight: "900",
    color: "#111827",
  },
  miniVs: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },
  dateText: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 14,
  },
  scoreAreaWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  scoreColumn: {
    alignItems: "center",
  },
  scoreTeam: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  scoreBox: {
    width: 90,
    height: 140,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 4,
    borderColor: "#F4F5F7", 
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  scoreXContainer: {
    marginHorizontal: 16,
    paddingTop: 20, 
  },
  scoreX: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "900",
  },
  arrowButton: {
    width: 60,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowIcon: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  disabledText: {
    color: "#D1D5DB",
  },
  scoreNumber: {
    color: "#111827",
    fontSize: 46,
    fontWeight: "900",
    includeFontPadding: false,
  },
  apostaSalvaBox: {
    backgroundColor: "#E7FBEF",
    borderRadius: 14,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#B7E4C7",
  },
  apostaSalvaTitle: {
    color: "#006B2E",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  apostaSalvaText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
  },
  apostaAlteracaoText: {
    color: "#4B5563",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: "#EAF3FF",
    borderRadius: 13,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFD7FF",
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  infoTitle: {
    color: "#1E3A8A",
    fontSize: 13,
    fontWeight: "900",
  },
  infoText: {
    color: "#4B5563",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  confirmButton: {
    backgroundColor: "#006B2E",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  confirmDisabled: {
    backgroundColor: "#9CA3AF",
    borderColor: "#9CA3AF",
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  confirmButtonDone: {
    backgroundColor: "#D1FAE5",
    borderWidth: 2,
    borderColor: "#10B981",
    opacity: 0.9,
  },
  confirmTextDone: {
    color: "#065F46",
    fontWeight: "900",
  },
  confirmTextDisabled: {
    color: "#FFFFFF",
  },
  feeText: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
  },
  bottomMenu: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 74,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingBottom: 8,
  },
  menuItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemActive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: {
    fontSize: 20,
  },
  menuText: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "700",
  },
  menuTextActive: {
    fontSize: 10,
    color: "#00A344",
    marginTop: 2,
    fontWeight: "900",
  },
});