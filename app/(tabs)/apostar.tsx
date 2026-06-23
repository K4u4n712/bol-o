import React, { useState, useEffect } from "react";
import { router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../services/firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ScrollView,
} from "react-native";

const JOGO_ID = "brasil-argentina-2026";
const NOME_JOGO = "Brasil x Argentina";
const VALOR_APOSTA = 10;

export default function ApostarScreen() {
  const { user, atualizarSaldoUsuario } = useAuth();

  const [golsBrasil, setGolsBrasil] = useState(2);
  const [golsAdversario, setGolsAdversario] = useState(1);
  const [jaApostou, setJaApostou] = useState(false);
  const [alteracaoUsada, setAlteracaoUsada] = useState(false);
  const [placarApostado, setPlacarApostado] = useState("");

  const apostaBloqueada = jaApostou && alteracaoUsada;

  useEffect(() => {
    carregarAposta();
  }, [user]);

  function getApostaId() {
    if (!user) return "";

    const identificador = user.uid
      ? user.uid
      : user.email.toLowerCase().replace(/[\/\\.#$[\]]/g, "_");

    return `${JOGO_ID}_${identificador}`;
  }

  async function carregarAposta() {
    try {
      if (!user) return;

      setJaApostou(false);
      setAlteracaoUsada(false);
      setPlacarApostado("");

      const apostaRef = doc(db, "apostas", getApostaId());
      const apostaSnap = await getDoc(apostaRef);

      if (!apostaSnap.exists()) return;

      const aposta = apostaSnap.data();

      setJaApostou(true);
      setAlteracaoUsada(!!aposta.jaAlterou);
      setPlacarApostado(aposta.placar || "");

      if (typeof aposta.golsBrasil === "number") {
        setGolsBrasil(aposta.golsBrasil);
      }

      if (typeof aposta.golsAdversario === "number") {
        setGolsAdversario(aposta.golsAdversario);
      }

      if (aposta.placar) {
        const partes = aposta.placar.split("x");

        if (partes.length === 2) {
          setGolsBrasil(Number(partes[0].trim()));
          setGolsAdversario(Number(partes[1].trim()));
        }
      }
    } catch (error) {
      console.log("Erro ao carregar aposta:", error);
    }
  }

  function aumentarBrasil() {
    if (apostaBloqueada) return;
    setGolsBrasil((valor) => valor + 1);
  }

  function diminuirBrasil() {
    if (apostaBloqueada) return;

    if (golsBrasil > 0) {
      setGolsBrasil((valor) => valor - 1);
    }
  }

  function aumentarAdversario() {
    if (apostaBloqueada) return;
    setGolsAdversario((valor) => valor + 1);
  }

  function diminuirAdversario() {
    if (apostaBloqueada) return;

    if (golsAdversario > 0) {
      setGolsAdversario((valor) => valor - 1);
    }
  }

  function abrirAjuda() {
    Alert.alert(
      "Como funciona?",
      "Escolha o placar exato. Cada usuário pode enviar apenas um palpite para este jogo. Após apostar, você ainda pode alterar uma única vez antes do prazo final."
    );
  }

  async function confirmarPalpite() {
    try {
      if (!user) {
        Alert.alert("Erro", "Faça login primeiro.");
        return;
      }

      const agora = new Date();
      const horarioLimite = new Date(2026, 11, 31, 23, 59, 0);

      if (agora >= horarioLimite) {
        Alert.alert("Apostas encerradas", "O prazo para alterar terminou.");
        return;
      }

      const apostaRef = doc(db, "apostas", getApostaId());
      const apostaSnap = await getDoc(apostaRef);

      const apostaExistente = apostaSnap.exists() ? apostaSnap.data() : null;

      if (!apostaExistente && user.saldo < VALOR_APOSTA) {
        Alert.alert(
          "Saldo insuficiente",
          `Você precisa ter pelo menos ${VALOR_APOSTA} BRL para apostar.`
        );
        return;
      }

      if (apostaExistente && apostaExistente.jaAlterou) {
        Alert.alert(
          "Alteração já usada",
          "Você só pode alterar seu palpite uma vez."
        );
        return;
      }

      const placar = `${golsBrasil} x ${golsAdversario}`;

      const dadosAposta: any = {
        userId: user.uid || "",
        nome: user.nome,
        email: user.email,
        emailLower: user.email.toLowerCase(),
        jogoId: JOGO_ID,
        jogo: NOME_JOGO,
        timeCasa: "Brasil",
        timeFora: "Argentina",
        golsBrasil,
        golsAdversario,
        placar,
        valor: VALOR_APOSTA,
        jaAlterou: !!apostaExistente,
        atualizadoEm: serverTimestamp(),
      };

      if (!apostaExistente) {
        dadosAposta.criadoEm = serverTimestamp();
      }

      await setDoc(apostaRef, dadosAposta, { merge: true });

      if (!apostaExistente) {
        await atualizarSaldoUsuario(user.email, user.saldo - VALOR_APOSTA);
      }

      setJaApostou(true);
      setAlteracaoUsada(!!apostaExistente);
      setPlacarApostado(placar);

      if (apostaExistente) {
        Alert.alert("Palpite alterado!", `Brasil ${placar} Argentina`);
      } else {
        Alert.alert("Palpite salvo!", `Brasil ${placar} Argentina`);
      }
    } catch (error) {
      console.log("Erro ao salvar aposta:", error);
      Alert.alert("Erro", "Não foi possível salvar a aposta.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#006B2E" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/(tabs)")}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Fazer meu palpite</Text>

        <TouchableOpacity style={styles.helpCircle} onPress={abrirAjuda}>
          <Text style={styles.helpText}>?</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.matchMiniCard}>
          <View style={styles.miniTeam}>
            <Text style={styles.miniFlag}>🇧🇷</Text>
            <Text style={styles.miniTeamName}>BRASIL</Text>
          </View>

          <Text style={styles.miniVs}>X</Text>

          <View style={styles.miniTeam}>
            <Text style={styles.miniTeamName}>ARGENTINA</Text>
            <Text style={styles.miniFlag}>🇦🇷</Text>
          </View>
        </View>

        <Text style={styles.dateText}>21/06/2026 • 21:00</Text>

        <Text style={styles.sectionTitle}>Palpite de placar exato ⓘ</Text>

        {/* NOVA ÁREA DE PLACAR FORMATADA IGUAL AO PRINT */}
        <View style={styles.scoreAreaWrapper}>
          
          <View style={styles.scoreColumn}>
            <Text style={[styles.scoreTeam, { color: "#1B4D3E" }]}>BRASIL</Text>
            <View style={styles.scoreBox}>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={aumentarBrasil}
                disabled={apostaBloqueada}
              >
                <Text style={[styles.arrowIcon, apostaBloqueada && styles.disabledText]}>
                  ˄
                </Text>
              </TouchableOpacity>

              <Text style={styles.scoreNumber}>{golsBrasil}</Text>

              <TouchableOpacity
                style={styles.arrowButton}
                onPress={diminuirBrasil}
                disabled={apostaBloqueada}
              >
                <Text style={[styles.arrowIcon, apostaBloqueada && styles.disabledText]}>
                  ˅
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.scoreXContainer}>
            <Text style={styles.scoreX}>x</Text>
          </View>

          <View style={styles.scoreColumn}>
            <Text style={[styles.scoreTeam, { color: "#111827" }]}>ARGENTINA</Text>
            <View style={styles.scoreBox}>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={aumentarAdversario}
                disabled={apostaBloqueada}
              >
                <Text style={[styles.arrowIcon, apostaBloqueada && styles.disabledText]}>
                  ˄
                </Text>
              </TouchableOpacity>

              <Text style={styles.scoreNumber}>{golsAdversario}</Text>

              <TouchableOpacity
                style={styles.arrowButton}
                onPress={diminuirAdversario}
                disabled={apostaBloqueada}
              >
                <Text style={[styles.arrowIcon, apostaBloqueada && styles.disabledText]}>
                  ˅
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>

        {jaApostou && (
          <View style={styles.apostaSalvaBox}>
            <Text style={styles.apostaSalvaTitle}>
              ✅ Você já apostou neste jogo
            </Text>

            <Text style={styles.apostaSalvaText}>
              Brasil {placarApostado} Argentina
            </Text>

            {!alteracaoUsada && (
              <Text style={styles.apostaAlteracaoText}>
                Você ainda pode alterar seu palpite uma vez.
              </Text>
            )}

            {alteracaoUsada && (
              <Text style={styles.apostaAlteracaoText}>
                Alteração já utilizada.
              </Text>
            )}
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>🎯</Text>

          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Acerta o placar e leva o bolão!</Text>

            <Text style={styles.infoText}>
              Bateu o placar exato? O prêmio é todo seu.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.confirmButton,
            jaApostou && styles.confirmButtonDone,
            apostaBloqueada && styles.confirmDisabled,
          ]}
          onPress={confirmarPalpite}
          disabled={apostaBloqueada}
        >
          <Text
            style={[
              styles.confirmText,
              jaApostou && styles.confirmTextDone,
              apostaBloqueada && styles.confirmTextDisabled,
            ]}
          >
            {!jaApostou && "Confirmar palpite"}
            {jaApostou && !alteracaoUsada && "Alterar palpite uma vez"}
            {jaApostou && alteracaoUsada && "✅ Palpite realizado"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.feeText}>
          ⚠️ Aposta fictícia: {VALOR_APOSTA} BRL por pessoa
        </Text>
      </ScrollView>

      <View style={styles.bottomMenu}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/(tabs)")}
        >
          <Text style={styles.menuIcon}>⌂</Text>
          <Text style={styles.menuText}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItemActive}>
          <Text style={styles.menuIcon}>🎯</Text>
          <Text style={styles.menuTextActive}>Apostar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/(tabs)/bolao")}
        >
          <Text style={styles.menuIcon}>⚙</Text>
          <Text style={styles.menuText}>Bolão</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/(tabs)/ranking")}
        >
          <Text style={styles.menuIcon}>♜</Text>
          <Text style={styles.menuText}>Ranking</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/(tabs)/perfil")}
        >
          <Text style={styles.menuIcon}>♙</Text>
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

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 98,
  },

  matchMiniCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 2,
  },

  miniTeam: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  miniFlag: {
    fontSize: 28,
  },

  miniTeamName: {
    fontSize: 12,
    fontWeight: "900",
    color: "#111827",
  },

  miniVs: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },

  dateText: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 14,
  },

  sectionTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 16, // Espaçamento maior
  },

  // ESTILOS DA NOVA ÁREA DE PLACAR
  scoreAreaWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  scoreColumn: {
    alignItems: "center",
  },

  scoreTeam: {
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 10,
    letterSpacing: 0.5,
  },

  scoreBox: {
    width: 100,
    height: 155,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 4,
    borderColor: "#F4F5F7", // Borda cinza super clara como no print
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },

  scoreXContainer: {
    marginHorizontal: 22,
    paddingTop: 24, // Desce o "X" compensando a altura do texto do time, para centralizar com a caixa
  },

  scoreX: {
    color: "#111827",
    fontSize: 32,
    fontWeight: "900",
  },

  arrowButton: {
    width: 70,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
  },

  arrowIcon: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },

  disabledText: {
    color: "#D1D5DB",
  },

  scoreNumber: {
    color: "#111827",
    fontSize: 54,
    fontWeight: "900",
    includeFontPadding: false,
  },

  // O RESTANTE DOS ESTILOS
  apostaSalvaBox: {
    backgroundColor: "#E7FBEF",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#B7E4C7",
  },

  apostaSalvaTitle: {
    color: "#006B2E",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },

  apostaSalvaText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
  },

  apostaAlteracaoText: {
    color: "#4B5563",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },

  infoBox: {
    backgroundColor: "#EAF3FF",
    borderRadius: 13,
    padding: 12,
    marginTop: 12,
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
    paddingVertical: 15,
    marginTop: 12,
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
    fontSize: 15,
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

  checkIcon: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    marginLeft: 10,
  },

  feeText: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
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