import React, { useEffect, useState } from "react";
import { mostrarAlerta } from "../../utils/mostrarAlerta";
import { router } from "expo-router";
import { db } from "../../services/firebaseConfig";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
} from "react-native";

type Aposta = {
  id?: string;
  nome: string;
  email: string;
  placar: string;
  golsBrasil: number;
  golsAdversario: number;
  valor: number;
};

type ResultadoOficial = {
  golsBrasil: number;
  golsAdversario: number;
};

type RankingItem = {
  nome: string;
  email: string;
  placar: string;
  pontos: number;
  venceu: boolean;
  premio: number;
};

const JOGO_ID = "brasil-argentina-2026";
const VALOR_APOSTA = 10;

export default function RankingScreen() {
  const [apostas, setApostas] = useState<Aposta[]>([]);
  const [resultado, setResultado] = useState<ResultadoOficial | null>(null);
  const [ranking, setRanking] = useState<RankingItem[]>([]);

  useEffect(() => {
    const apostasRef = collection(db, "apostas");
    const q = query(apostasRef, where("jogoId", "==", JOGO_ID));

    const unsubscribeApostas = onSnapshot(
      q,
      (snapshot) => {
        const lista: Aposta[] = snapshot.docs.map((documento) => {
          const data = documento.data();

          return {
            id: documento.id,
            nome: data.nome || "Usuário",
            email: data.email || "",
            placar: data.placar || "",
            golsBrasil: Number(data.golsBrasil || 0),
            golsAdversario: Number(data.golsAdversario || 0),
            valor: Number(data.valor || VALOR_APOSTA),
          };
        });

        setApostas(lista);
      },
      (error) => {
        console.log("Erro ao carregar apostas:", error);
      }
    );

    const resultadoRef = doc(db, "resultados", JOGO_ID);

    const unsubscribeResultado = onSnapshot(
      resultadoRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setResultado(null);
          return;
        }

        const data = snapshot.data();

        setResultado({
          golsBrasil: Number(data.golsBrasil || 0),
          golsAdversario: Number(data.golsAdversario || 0),
        });
      },
      (error) => {
        console.log("Erro ao carregar resultado:", error);
      }
    );

    return () => {
      unsubscribeApostas();
      unsubscribeResultado();
    };
  }, []);

  useEffect(() => {
    calcularRanking();
  }, [apostas, resultado]);

  function calcularRanking() {
    if (!resultado) {
      setRanking([]);
      return;
    }

    const totalBolao = apostas.reduce((total, item) => {
      return total + Number(item.valor || VALOR_APOSTA);
    }, 0);

    const ganhadoresExatos = apostas.filter(
      (item) =>
        item.golsBrasil === resultado.golsBrasil &&
        item.golsAdversario === resultado.golsAdversario
    );

    const premioPorGanhador =
      ganhadoresExatos.length > 0 ? totalBolao / ganhadoresExatos.length : 0;

    const lista: RankingItem[] = apostas.map((item) => {
      const acertouPlacar =
        item.golsBrasil === resultado.golsBrasil &&
        item.golsAdversario === resultado.golsAdversario;

      const acertouVencedor = verificarVencedor(
        item.golsBrasil,
        item.golsAdversario,
        resultado.golsBrasil,
        resultado.golsAdversario
      );

      const pontos = acertouPlacar ? 10 : acertouVencedor ? 3 : 0;

      return {
        nome: item.nome,
        email: item.email,
        placar: item.placar,
        pontos,
        venceu: acertouPlacar,
        premio: acertouPlacar ? premioPorGanhador : 0,
      };
    });

    lista.sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      return a.nome.localeCompare(b.nome);
    });

    setRanking(lista);
  }

  function verificarVencedor(
    apostaBrasil: number,
    apostaAdversario: number,
    resultadoBrasil: number,
    resultadoAdversario: number
  ) {
    const vencedorAposta =
      apostaBrasil > apostaAdversario
        ? "brasil"
        : apostaBrasil < apostaAdversario
        ? "argentina"
        : "empate";

    const vencedorResultado =
      resultadoBrasil > resultadoAdversario
        ? "brasil"
        : resultadoBrasil < resultadoAdversario
        ? "argentina"
        : "empate";

    return vencedorAposta === vencedorResultado;
  }

  function abrirInstrucoes() {
    mostrarAlerta(
      "Como funciona o ranking?",
      "Placar exato: 10 pontos.\n\nAcertou apenas o vencedor ou empate: 3 pontos.\n\nErrou tudo: 0 pontos.\n\nO prêmio é dividido entre quem acertou o placar exato."
    );
  }

  function posicao(index: number) {
    return `${index + 1}º`;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#006B2E" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/")}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Ranking</Text>

        <TouchableOpacity style={styles.headerCircle} onPress={abrirInstrucoes}>
          <Text style={styles.headerIcon}>🏆</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroBadge}>🏆 RANKING DO BOLÃO</Text>

          <Text style={styles.heroTitle}>
            {resultado ? "Resultado calculado" : "Aguardando resultado"}
          </Text>

          <Text style={styles.heroText}>
            {resultado
              ? `Resultado oficial: Brasil ${resultado.golsBrasil} x ${resultado.golsAdversario} Argentina`
              : "O administrador precisa informar o placar oficial para calcular o ranking."}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Classificação geral</Text>

        {ranking.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Ranking ainda não calculado</Text>
            <Text style={styles.emptyText}>
              O administrador precisa informar o resultado oficial no painel.
            </Text>
          </View>
        )}

        {ranking.map((item, index) => (
          <View
            style={[
              styles.rankingCard,
              index === 0 && styles.rankingCardFirst,
            ]}
            key={`${item.email}-${index}`}
          >
            <View
              style={[
                styles.positionCircle,
                index === 0 && styles.positionFirst,
              ]}
            >
              <Text style={styles.positionText}>{posicao(index)}</Text>
            </View>

            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{item.nome}</Text>

              <Text style={styles.playerBet}>
                Brasil {item.placar} Argentina
              </Text>

              <Text
                style={[
                  styles.playerStatus,
                  item.venceu && styles.winnerStatus,
                ]}
              >
                {item.venceu
                  ? `🏆 Venceu ${item.premio.toFixed(2)} BRL`
                  : item.pontos > 0
                  ? "Acertou o vencedor"
                  : "Não pontuou"}
              </Text>
            </View>

            <View style={styles.pointsBox}>
              <Text style={styles.points}>{item.pontos}</Text>
              <Text style={styles.pointsLabel}>pts</Text>
            </View>
          </View>
        ))}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Pontuação</Text>

          <Text style={styles.infoText}>
            Placar exato: 10 pontos. Acertou apenas vencedor ou empate: 3 pontos.
            Errou tudo: 0 pontos.
          </Text>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      <View style={styles.bottomMenu}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/")}
        >
          <Text style={styles.menuIcon}>🏠</Text>
          <Text style={styles.menuText}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/apostar")}
        >
          <Text style={styles.menuIcon}>🎯</Text>
          <Text style={styles.menuText}>Apostar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/bolao")}
        >
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuText}>Bolão</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItemActive}>
          <Text style={styles.menuIcon}>🏆</Text>
          <Text style={styles.menuTextActive}>Ranking</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/perfil")}
        >
          <Text style={styles.menuIcon}>👤</Text>
          <Text style={styles.menuText}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F6F4" },

  header: {
    backgroundColor: "#006B2E",
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },

  back: { color: "#FFFFFF", fontSize: 34, fontWeight: "900" },
  headerTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },

  headerCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  headerIcon: { fontSize: 23 },

  scroll: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 105,
  },

  heroCard: {
    backgroundColor: "#006B2E",
    borderRadius: 28,
    padding: 24,
    elevation: 4,
  },

  heroBadge: {
    color: "#FFD500",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 18,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
  },

  heroText: {
    color: "#DFFFEA",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 27,
    marginTop: 12,
  },

  sectionTitle: {
    color: "#111827",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 28,
    marginBottom: 16,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    elevation: 3,
  },

  emptyTitle: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
  },

  emptyText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },

  rankingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    elevation: 3,
  },

  rankingCardFirst: {
    backgroundColor: "#FFF6BF",
    borderWidth: 1.5,
    borderColor: "#FFD500",
  },

  positionCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#E7FBEF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  positionFirst: {
    backgroundColor: "#FFD500",
  },

  positionText: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
  },

  playerInfo: {
    flex: 1,
  },

  playerName: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
  },

  playerBet: {
    color: "#4B5563",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },

  playerStatus: {
    color: "#006B2E",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 6,
  },

  winnerStatus: {
    color: "#B45309",
  },

  pointsBox: {
    alignItems: "center",
    marginLeft: 8,
  },

  points: {
    color: "#006B2E",
    fontSize: 36,
    fontWeight: "900",
  },

  pointsLabel: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "900",
  },

  infoBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginTop: 18,
    elevation: 2,
  },

  infoTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },

  infoText: {
    color: "#4B5563",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 26,
  },

  bottomSpace: { height: 20 },

  bottomMenu: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 78,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingBottom: 10,
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

  menuIcon: { fontSize: 22 },

  menuText: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 3,
    fontWeight: "700",
  },

  menuTextActive: {
    fontSize: 11,
    color: "#00A344",
    marginTop: 3,
    fontWeight: "900",
  },
});