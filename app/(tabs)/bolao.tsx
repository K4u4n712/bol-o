import React, { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { db } from "../../services/firebaseConfig";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Aposta = {
  id?: string;
  nome: string;
  email: string;
  placar: string;
  jogo: string;
  valor: number;
  criadoEm?: any;
  atualizadoEm?: any;
};

type Jogo = {
  id: string;
  data: string;
  horario: string;
  status: string;
  timeCasa: {
    nome: string;
    sigla: string;
    bandeira: string;
  };
  timeFora: {
    nome: string;
    sigla: string;
    bandeira: string;
  };
};

const VALOR_APOSTA = 10;

export default function BolaoScreen() {
  const [apostas, setApostas] = useState<Aposta[]>([]);
  const [jogoAtual, setJogoAtual] = useState<Jogo | null>(null);
  const [carregandoJogo, setCarregandoJogo] = useState(true);

  const pulse = useRef(new Animated.Value(1)).current;

  const totalParticipantes = apostas.length;

  const totalBolao = apostas.reduce((total, item) => {
    return total + Number(item.valor || VALOR_APOSTA);
  }, 0);

  const nomeJogoAtual = jogoAtual
    ? `${jogoAtual.timeCasa.nome} x ${jogoAtual.timeFora.nome}`
    : "Nenhum jogo aberto";

  useEffect(() => {
    const animacao = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.25,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );

    animacao.start();

    return () => animacao.stop();
  }, []);

  useEffect(() => {
    async function buscarJogoAtual() {
      try {
        const agora = new Date();
        const limite48h = new Date(agora.getTime() + 48 * 60 * 60 * 1000);

        const fData = (d: Date) =>
          `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
            2,
            "0"
          )}${String(d.getDate()).padStart(2, "0")}`;

        const urlESPN = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${fData(
          agora
        )}-${fData(limite48h)}`;

        const response = await fetch(urlESPN);
        const data = await response.json();

        const statusSnapshot = await getDocs(collection(db, "status_apostas"));

        const statusFirebase: Record<string, boolean> = {};

        statusSnapshot.forEach((docSnap) => {
          statusFirebase[docSnap.id] = docSnap.data().aberta;
        });

        const jogosFiltrados = (data.events || []).reduce(
          (acc: Jogo[], event: any) => {
            const dataJogo = new Date(event.date);
            const status = event.status?.type?.state;

            const competidores = event.competitions?.[0]?.competitors || [];

            const timeCasa = competidores.find(
              (c: any) => c.homeAway === "home"
            );

            const timeFora = competidores.find(
              (c: any) => c.homeAway === "away"
            );

            if (!timeCasa || !timeFora) return acc;

            if (dataJogo > limite48h) return acc;

            if (status === "post") return acc;

            const jaTemStatusNoFirebase =
              statusFirebase[event.id] !== undefined;

            const apostasAbertas = jaTemStatusNoFirebase
              ? statusFirebase[event.id]
              : status === "pre";

            if (!apostasAbertas) return acc;

            let statusBR = "AGENDADO";
            if (status === "in") statusBR = "AO VIVO";
            if (status === "post") statusBR = "FINALIZADO";

            acc.push({
              id: event.id,
              data: dataJogo.toLocaleDateString("pt-BR"),
              horario: dataJogo.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              status: statusBR,
              timeCasa: {
                nome: timeCasa.team.displayName,
                sigla: timeCasa.team.abbreviation,
                bandeira:
                  timeCasa.team.logo || "https://via.placeholder.com/50",
              },
              timeFora: {
                nome: timeFora.team.displayName,
                sigla: timeFora.team.abbreviation,
                bandeira:
                  timeFora.team.logo || "https://via.placeholder.com/50",
              },
            });

            return acc;
          },
          []
        );

        setJogoAtual(jogosFiltrados[0] || null);
      } catch (error) {
        console.log("Erro ao buscar jogo atual:", error);
        setJogoAtual(null);
      } finally {
        setCarregandoJogo(false);
      }
    }

    buscarJogoAtual();

    const interval = setInterval(buscarJogoAtual, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!jogoAtual?.id) {
      setApostas([]);
      return;
    }

    const apostasRef = collection(db, "apostas");

    const q = query(apostasRef, where("jogoId", "==", jogoAtual.id));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista: Aposta[] = snapshot.docs.map((documento) => {
          const data = documento.data();

          return {
            id: documento.id,
            nome: data.nome || "Usuário",
            email: data.email || "",
            placar: data.placar || "",
            jogo: data.jogo || nomeJogoAtual,
            valor: Number(data.valor || VALOR_APOSTA),
            criadoEm: data.criadoEm,
            atualizadoEm: data.atualizadoEm,
          };
        });

        lista.sort((a, b) => {
          const dataA = pegarMillis(a.atualizadoEm || a.criadoEm);
          const dataB = pegarMillis(b.atualizadoEm || b.criadoEm);

          return dataB - dataA;
        });

        setApostas(lista);
      },
      (error) => {
        console.log("Erro ao carregar apostas:", error);
      }
    );

    return () => unsubscribe();
  }, [jogoAtual?.id]);

  function pegarMillis(data?: any) {
    if (!data) return 0;

    if (typeof data.toMillis === "function") {
      return data.toMillis();
    }

    if (data.seconds) {
      return data.seconds * 1000;
    }

    return new Date(data).getTime();
  }

  function formatarTempo(data?: any) {
    if (!data) return "agora";

    const millis = pegarMillis(data);

    if (!millis) return "agora";

    const diferenca = Date.now() - millis;
    const minutos = Math.floor(diferenca / 60000);

    if (minutos < 1) return "agora";
    if (minutos === 1) return "1 min atrás";
    if (minutos < 60) return `${minutos} min atrás`;

    const horas = Math.floor(minutos / 60);

    if (horas === 1) return "1 hora atrás";
    if (horas < 24) return `${horas} horas atrás`;

    const dias = Math.floor(horas / 24);

    return `${dias} dia${dias > 1 ? "s" : ""} atrás`;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#006B2E" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/")}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Bolão</Text>

        <View style={styles.headerCircle}>
          <Text style={styles.headerIcon}>👥</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.liveRowTop}>
            <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
            <Text style={styles.liveTopText}>
              {jogoAtual?.status === "AO VIVO" ? "AO VIVO" : "ABERTO"}
            </Text>
          </View>

          <Text style={styles.heroTitle}>Bolão do jogo</Text>

          <Text style={styles.heroMatch}>
            {carregandoJogo ? "Carregando jogo..." : nomeJogoAtual}
          </Text>

          {jogoAtual && (
            <Text style={styles.heroDate}>
              {jogoAtual.data} • {jogoAtual.horario}
            </Text>
          )}

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total acumulado</Text>
            <Text style={styles.totalValue}>{totalBolao} BRL</Text>
            <Text style={styles.totalSub}>valor total do prêmio</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statNumber}>{totalParticipantes}</Text>
            <Text style={styles.statLabel}>participantes</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🪙</Text>
            <Text style={styles.statNumber}>{VALOR_APOSTA}</Text>
            <Text style={styles.statLabel}>BRL por pessoa</Text>
          </View>
        </View>

        <View style={styles.ruleCard}>
          <Text style={styles.ruleTitle}>Como ganha?</Text>
          <Text style={styles.ruleText}>
            Quem acertar o placar exato leva o bolão acumulado. Se mais de uma
            pessoa acertar, o prêmio pode ser dividido entre os ganhadores.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Participantes do bolão</Text>

        {!carregandoJogo && !jogoAtual && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum jogo aberto</Text>
            <Text style={styles.emptyText}>
              Quando o admin abrir uma aposta, o jogo vai aparecer aqui.
            </Text>
          </View>
        )}

        {jogoAtual && apostas.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum participante ainda</Text>
            <Text style={styles.emptyText}>
              Quando alguém fizer um palpite, vai aparecer aqui.
            </Text>
          </View>
        )}

        {apostas.map((item, index) => (
          <View style={styles.userCard} key={item.id || `${item.email}-${index}`}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.nome?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.nome || "Usuário"}</Text>

              <Text style={styles.userBet}>
                {item.jogo || nomeJogoAtual} • {item.placar}
              </Text>

              <Text style={styles.userTime}>
                {formatarTempo(item.atualizadoEm || item.criadoEm)}
              </Text>
            </View>

            <View style={styles.valueBadge}>
              <Text style={styles.valueText}>
                {item.valor || VALOR_APOSTA} BRL
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <View style={styles.bottomMenu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/")}>
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

        <TouchableOpacity style={styles.menuItemActive}>
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuTextActive}>Bolão</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/ranking")}
        >
          <Text style={styles.menuIcon}>🏆</Text>
          <Text style={styles.menuText}>Ranking</Text>
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
  safe: {
    flex: 1,
    backgroundColor: "#F3F6F4",
  },

  header: {
    backgroundColor: "#006B2E",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },

  back: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
  },

  headerCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  headerIcon: {
    fontSize: 22,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 105,
  },

  heroCard: {
    backgroundColor: "#006B2E",
    borderRadius: 30,
    padding: 24,
    alignItems: "center",
    elevation: 5,
  },

  liveRowTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  liveDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#A7F3D0",
    marginRight: 8,
  },

  liveTopText: {
    color: "#A7F3D0",
    fontSize: 20,
    fontWeight: "900",
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 33,
    fontWeight: "900",
    textAlign: "center",
  },

  heroMatch: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 8,
    textAlign: "center",
  },

  heroDate: {
    color: "#DFFFEA",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 8,
    textAlign: "center",
  },

  totalBox: {
    backgroundColor: "#008A37",
    borderRadius: 25,
    paddingVertical: 25,
    paddingHorizontal: 20,
    marginTop: 24,
    width: "100%",
    alignItems: "center",
  },

  totalLabel: {
    color: "#DFFFEA",
    fontSize: 19,
    fontWeight: "900",
  },

  totalValue: {
    color: "#FFD500",
    fontSize: 54,
    fontWeight: "900",
    marginTop: 6,
  },

  totalSub: {
    color: "#DFFFEA",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },

  statsRow: {
    flexDirection: "row",
    marginTop: 20,
    gap: 14,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 24,
    alignItems: "center",
    elevation: 4,
  },

  statIcon: {
    fontSize: 38,
  },

  statNumber: {
    color: "#111827",
    fontSize: 42,
    fontWeight: "900",
    marginTop: 10,
  },

  statLabel: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 5,
  },

  ruleCard: {
    backgroundColor: "#FFF6BF",
    borderRadius: 24,
    padding: 20,
    marginTop: 22,
    borderWidth: 1.5,
    borderColor: "#FFD500",
  },

  ruleTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 10,
  },

  ruleText: {
    color: "#4B5563",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 30,
  },

  sectionTitle: {
    color: "#111827",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 28,
    marginBottom: 14,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    elevation: 3,
  },

  emptyTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },

  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 5,
  },

  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    elevation: 3,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#006B2E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },

  userInfo: {
    flex: 1,
  },

  userName: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },

  userBet: {
    color: "#4B5563",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 3,
  },

  userTime: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },

  valueBadge: {
    backgroundColor: "#E7FBEF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },

  valueText: {
    color: "#006B2E",
    fontSize: 15,
    fontWeight: "900",
  },

  bottomSpace: {
    height: 20,
  },

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

  menuIcon: {
    fontSize: 22,
  },

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