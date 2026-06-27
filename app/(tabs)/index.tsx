import React, { useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { db } from "../../services/firebaseConfig";
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Animated,
  Image,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";

const VALOR_APOSTA = 10;

// Mantivemos este ID apenas para não quebrar a sua lógica atual de notificações do Backend
const JOGO_ID_NOTIFICACAO = "brasil-argentina-2026";

type JogoHome = {
  id: string;
  data: string;
  horario: string;
  startMillis: number;
  status: string;
  apostasAbertas: boolean;
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

type ApostaHome = {
  id: string;
  jogoId: string;
  valor: number;
};

type JogoDestaque = JogoHome & {
  participantes: number;
  totalBolao: number;
};

function gerarIdNotificacao(email: string) {
  return `${JOGO_ID_NOTIFICACAO}_${email
    .toLowerCase()
    .replace(/\./g, "_")
    .replace(/#/g, "_")
    .replace(/\$/g, "_")
    .replace(/\//g, "_")
    .replace(/\\/g, "_")
    .replace(/\[/g, "_")
    .replace(/\]/g, "_")}`;
}

export default function HomeScreen() {
  const { user } = useAuth();

  const [jogosDisponiveis, setJogosDisponiveis] = useState<JogoHome[]>([]);
  const [apostas, setApostas] = useState<ApostaHome[]>([]);
  const [loadingJogo, setLoadingJogo] = useState(true);

  const [notificacao, setNotificacao] = useState<any>(null);
  const [mostrarNotificacao, setMostrarNotificacao] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;

  // 1. ANIMAÇÃO DO PONTO "AO VIVO"
  useEffect(() => {
    const animacao = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.35,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );

    animacao.start();

    return () => animacao.stop();
  }, [pulse]);

  // 2. BUSCAR JOGOS DA ESPN E STATUS DO FIREBASE
  useEffect(() => {
    async function buscarJogosDisponiveis() {
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
          statusFirebase[docSnap.id] = Boolean(docSnap.data().aberta);
        });

        const lista: JogoHome[] = [];

        (data.events || []).forEach((event: any) => {
          const dataJogo = new Date(event.date);
          const status = event.status?.type?.state || "pre";

          if (dataJogo > limite48h) return;
          if (status === "post") return;

          const competidores = event.competitions?.[0]?.competitors || [];

          const timeCasa = competidores.find(
            (c: any) => c.homeAway === "home"
          );

          const timeFora = competidores.find(
            (c: any) => c.homeAway === "away"
          );

          if (!timeCasa || !timeFora) return;

          const jaTemStatus = statusFirebase[event.id] !== undefined;

          const apostasAbertas = jaTemStatus
            ? statusFirebase[event.id]
            : status === "pre";

          lista.push({
            id: String(event.id),
            data: dataJogo.toLocaleDateString("pt-BR"),
            horario: dataJogo.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            startMillis: dataJogo.getTime(),
            status,
            apostasAbertas,
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
        });

        lista.sort((a, b) => a.startMillis - b.startMillis);

        setJogosDisponiveis(lista);
      } catch (error) {
        console.error("Erro ao carregar jogos da home:", error);
        setJogosDisponiveis([]);
      } finally {
        setLoadingJogo(false);
      }
    }

    buscarJogosDisponiveis();

    const interval = setInterval(buscarJogosDisponiveis, 60000);

    return () => clearInterval(interval);
  }, []);

  // 3. MONITORAR TODAS AS APOSTAS PARA A HOME ESCOLHER O MAIOR BOLÃO
  useEffect(() => {
    const apostasRef = collection(db, "apostas");

    const unsubscribeApostas = onSnapshot(
      apostasRef,
      (snapshot) => {
        const lista: ApostaHome[] = snapshot.docs.map((documento) => {
          const data = documento.data();

          return {
            id: documento.id,
            jogoId: String(data.jogoId || ""),
            valor: Number(data.valor || VALOR_APOSTA),
          };
        });

        setApostas(lista);
      },
      (error) => {
        console.log("Erro ao carregar apostas da home:", error);
      }
    );

    return () => unsubscribeApostas();
  }, []);

  // 4. ESCOLHER O JOGO COM MAIS DINHEIRO/PESSOAS
  const jogoDestaque = useMemo<JogoDestaque | null>(() => {
    if (jogosDisponiveis.length === 0) return null;

    const jogosComTotais = jogosDisponiveis
      .map((jogo) => {
        const apostasDoJogo = apostas.filter(
          (aposta) => String(aposta.jogoId) === String(jogo.id)
        );

        const participantes = apostasDoJogo.length;

        const totalBolao = apostasDoJogo.reduce((total, aposta) => {
          return total + Number(aposta.valor || VALOR_APOSTA);
        }, 0);

        return {
          ...jogo,
          participantes,
          totalBolao,
        };
      })
      .filter((jogo) => {
        // Mostra jogos abertos ou bolões que já têm dinheiro/pessoas.
        return jogo.apostasAbertas || jogo.participantes > 0;
      });

    if (jogosComTotais.length === 0) return null;

    jogosComTotais.sort((a, b) => {
      // Prioridade principal: maior bolão acumulado.
      if (b.totalBolao !== a.totalBolao) return b.totalBolao - a.totalBolao;

      // Segunda prioridade: mais participantes.
      if (b.participantes !== a.participantes) {
        return b.participantes - a.participantes;
      }

      // Terceira prioridade: jogos abertos antes de fechados.
      if (a.apostasAbertas && !b.apostasAbertas) return -1;
      if (!a.apostasAbertas && b.apostasAbertas) return 1;

      // Última prioridade: jogo mais próximo.
      return a.startMillis - b.startMillis;
    });

    return jogosComTotais[0];
  }, [jogosDisponiveis, apostas]);

  // 5. MONITORAR NOTIFICAÇÕES GERAIS
  useEffect(() => {
    let unsubscribeNotificacao: (() => void) | undefined;

    if (user?.email) {
      const notificacaoRef = doc(
        db,
        "notificacoes",
        gerarIdNotificacao(user.email)
      );

      unsubscribeNotificacao = onSnapshot(
        notificacaoRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setNotificacao(null);
            return;
          }

          setNotificacao(snapshot.data());
        },
        (error) => {
          console.log("Erro ao carregar notificação:", error);
        }
      );
    } else {
      setNotificacao(null);
    }

    return () => {
      if (unsubscribeNotificacao) unsubscribeNotificacao();
    };
  }, [user]);

  function abrirNotificacao() {
    setMostrarNotificacao(true);
  }

  function fecharNotificacao() {
    setMostrarNotificacao(false);
  }

  function irParaAposta() {
    router.push("/apostar");
  }

  function irParaBolao() {
    router.push("/bolao");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#006B2E" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.topBar}>
            <TouchableOpacity>
              <Text style={styles.menuIconTop}>☰</Text>
            </TouchableOpacity>

            <View style={styles.logoRow}>
              <Animated.View
                style={[styles.liveDot, { transform: [{ scale: pulse }] }]}
              />
              <Text style={styles.logoBall}>⚽</Text>
              <Text style={styles.logoText}>Bolão</Text>
              <Text style={styles.logoNumber}>10</Text>
            </View>

            <TouchableOpacity style={styles.bellBox} onPress={abrirNotificacao}>
              <Text style={styles.bell}>🔔</Text>
              {notificacao && <View style={styles.redDot} />}
            </TouchableOpacity>
          </View>

          <View style={styles.welcomeBox}>
            <Text style={styles.welcomeTitle}>
              Olá, {user?.nome || "Jogador"}! 👋
            </Text>
            <Text style={styles.welcomeText}>Que comece o bolão!</Text>
          </View>

          <View style={styles.heroDecorOne} />
          <View style={styles.heroDecorTwo} />
          <View style={styles.heroDecorThree} />
        </View>

        {loadingJogo ? (
          <View style={[styles.gameCard, { paddingVertical: 40 }]}> 
            <ActivityIndicator size="large" color="#006B2E" />
            <Text style={styles.loadingText}>
              Buscando o maior bolão disponível...
            </Text>
          </View>
        ) : !jogoDestaque ? (
          <View style={[styles.gameCard, { paddingVertical: 40 }]}> 
            <Text style={{ fontSize: 50, marginBottom: 10 }}>🔒</Text>
            <Text style={styles.emptyGameTitle}>Nenhum jogo aberto</Text>
            <Text style={styles.emptyGameText}>
              As apostas estão fechadas no momento ou não há jogos programados.
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.gameCard}
              activeOpacity={0.9}
              onPress={irParaBolao}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {jogoDestaque.totalBolao > 0
                    ? "BOLÃO EM DESTAQUE"
                    : "PRÓXIMO JOGO"}
                </Text>
              </View>

              <Text style={styles.gameTitle}>
                {jogoDestaque.timeCasa.nome} x {jogoDestaque.timeFora.nome}
              </Text>

              <View style={styles.teamsRow}>
                <TouchableOpacity style={styles.teamBox} onPress={irParaAposta}>
                  <Image
                    source={{ uri: jogoDestaque.timeCasa.bandeira }}
                    style={styles.flagImage}
                  />
                  <Text style={styles.teamName}>{jogoDestaque.timeCasa.sigla}</Text>
                </TouchableOpacity>

                <Text style={styles.vs}>X</Text>

                <TouchableOpacity style={styles.teamBox} onPress={irParaAposta}>
                  <Image
                    source={{ uri: jogoDestaque.timeFora.bandeira }}
                    style={styles.flagImage}
                  />
                  <Text style={styles.teamName}>{jogoDestaque.timeFora.sigla}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.gameInfo}>
                <Text style={styles.infoText}>📅 {jogoDestaque.data}</Text>
                <Text style={styles.infoText}>🕘 {jogoDestaque.horario}</Text>
              </View>

              <View style={styles.priceBox}>
                <Text style={styles.priceText}>
                  💸 Entrada: R$ {VALOR_APOSTA},00
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Em quem você acha que vence?</Text>

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[styles.betButton, { backgroundColor: "#E6F4EA" }]}
                onPress={irParaAposta}
              >
                <Image
                  source={{ uri: jogoDestaque.timeCasa.bandeira }}
                  style={styles.btnFlagImage}
                />
                <Text style={styles.betButtonText}>{jogoDestaque.timeCasa.sigla}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.betButton, { backgroundColor: "#EEF2FF" }]}
                onPress={irParaAposta}
              >
                <Image
                  source={{ uri: jogoDestaque.timeFora.bandeira }}
                  style={styles.btnFlagImage}
                />
                <Text style={styles.betButtonText}>{jogoDestaque.timeFora.sigla}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.liveBox}
              activeOpacity={0.9}
              onPress={irParaBolao}
            >
              <View style={styles.liveHeader}>
                <Text style={styles.liveTitle}>AO VIVO NO BOLÃO</Text>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>● AO VIVO</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>👥</Text>
                  <Text style={styles.statNumber}>
                    {jogoDestaque.participantes}
                  </Text>
                  <Text style={styles.statLabel}>pessoas apostando</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>🪙</Text>
                  <Text style={styles.statNumber}>{jogoDestaque.totalBolao}</Text>
                  <Text style={styles.statLabel}>BRL acumulado</Text>
                </View>
              </View>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <View style={styles.bottomMenu}>
        <TouchableOpacity style={styles.menuItemActive}>
          <Text style={styles.menuIcon}>🏠</Text>
          <Text style={styles.menuTextActive}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/apostar")}>
          <Text style={styles.menuIcon}>🎯</Text>
          <Text style={styles.menuText}>Apostar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/bolao")}>
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuText}>Bolão</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/ranking")}>
          <Text style={styles.menuIcon}>🏆</Text>
          <Text style={styles.menuText}>Ranking</Text>
        </TouchableOpacity>

        {user?.email === "admin@bolao.com" && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/gerenciar")}>
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={styles.menuText}>Gerenciar</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/perfil")}>
          <Text style={styles.menuIcon}>👤</Text>
          <Text style={styles.menuText}>Perfil</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={mostrarNotificacao}
        transparent={true}
        animationType="fade"
        onRequestClose={fecharNotificacao}
      >
        <Pressable style={styles.modalOverlay} onPress={fecharNotificacao}>
          <Pressable style={styles.modalContent}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>🔔 Notificações</Text>
              <TouchableOpacity onPress={fecharNotificacao}>
                <Text style={styles.notificationClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {!notificacao ? (
              <View style={styles.emptyNotification}>
                <Text style={styles.emptyNotificationText}>
                  Nenhuma notificação no momento.
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.notificationContent,
                  notificacao.venceu
                    ? styles.notificationWin
                    : styles.notificationLose,
                ]}
              >
                <Text style={styles.notificationGame}>🏆 Resultado do Bolão</Text>
                <Text style={styles.notificationMessage}>
                  {notificacao.mensagem}
                </Text>
                {notificacao.venceu && (
                  <Text style={styles.notificationPrize}>
                    💰 Prêmio: R$ {Number(notificacao.premio).toFixed(2)}
                  </Text>
                )}
                <Text style={styles.notificationHint}>
                  Toque fora do card ou no ✕ para fechar.
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F3F6F4",
  },
  container: {
    flex: 1,
    backgroundColor: "#F3F6F4",
  },
  content: {
    paddingBottom: 110,
  },
  hero: {
    backgroundColor: "#006B2E",
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 56,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: "hidden",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuIconTop: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#00FF66",
    marginRight: 7,
  },
  logoBall: {
    fontSize: 24,
    marginRight: 4,
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    fontStyle: "italic",
  },
  logoNumber: {
    color: "#FFD500",
    fontSize: 25,
    fontWeight: "900",
    fontStyle: "italic",
    marginLeft: 4,
  },
  bellBox: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bell: {
    fontSize: 20,
  },
  redDot: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  welcomeBox: {
    marginTop: 22,
  },
  welcomeTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  welcomeText: {
    color: "#DFFFEA",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },
  heroDecorOne: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.06)",
    right: -45,
    bottom: -45,
  },
  heroDecorTwo: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,213,0,0.10)",
    left: -30,
    bottom: -25,
  },
  heroDecorThree: {
    position: "absolute",
    width: 160,
    height: 45,
    backgroundColor: "rgba(0,0,0,0.10)",
    bottom: 0,
    left: 60,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
  },
  gameCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginTop: -38,
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
    elevation: 6,
  },
  loadingText: {
    marginTop: 10,
    color: "#6B7280",
    fontWeight: "bold",
  },
  emptyGameTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  emptyGameText: {
    color: "#6B7280",
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 20,
  },
  badge: {
    backgroundColor: "#FFD500",
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 18,
    marginBottom: 10,
  },
  badgeText: {
    color: "#0B3D1C",
    fontWeight: "900",
    fontSize: 11,
  },
  gameTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 15,
    textAlign: "center",
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  teamBox: {
    alignItems: "center",
  },
  flagImage: {
    width: 66,
    height: 66,
    borderRadius: 33,
    resizeMode: "contain",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  btnFlagImage: {
    width: 44,
    height: 44,
    marginBottom: 6,
    resizeMode: "contain",
  },
  teamName: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "900",
    color: "#111827",
  },
  vs: {
    fontSize: 30,
    fontWeight: "900",
    color: "#111827",
  },
  gameInfo: {
    flexDirection: "row",
    gap: 15,
    marginTop: 16,
  },
  infoText: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "700",
  },
  priceBox: {
    marginTop: 15,
    width: "100%",
    borderWidth: 1,
    borderColor: "#BEE7C9",
    backgroundColor: "#F1FFF5",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  priceText: {
    color: "#006B2E",
    fontWeight: "900",
    fontSize: 14,
  },
  sectionTitle: {
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 12,
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },
  buttonsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    gap: 14,
  },
  betButton: {
    flex: 1,
    height: 94,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  betButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },
  liveBox: {
    backgroundColor: "#005C28",
    marginHorizontal: 20,
    marginTop: 23,
    borderRadius: 22,
    padding: 17,
    elevation: 4,
  },
  liveHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveTitle: {
    color: "#FFD500",
    fontSize: 14,
    fontWeight: "900",
  },
  liveBadge: {
    backgroundColor: "#00B050",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  liveBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#007A35",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  statIcon: {
    fontSize: 27,
  },
  statNumber: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
    marginTop: 4,
  },
  statLabel: {
    color: "#DFFFEA",
    fontSize: 11,
    textAlign: "center",
    marginTop: 3,
    fontWeight: "700",
  },
  bottomSpace: {
    height: 110,
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
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  menuItemActive: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notificationTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },
  notificationClose: {
    fontSize: 20,
    fontWeight: "900",
    color: "#6B7280",
  },
  notificationContent: {
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  notificationWin: {
    backgroundColor: "#FFF6BF",
    borderColor: "#FFD500",
  },
  notificationLose: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  notificationGame: {
    color: "#006B2E",
    fontSize: 15,
    fontWeight: "900",
  },
  notificationMessage: {
    marginTop: 8,
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
  },
  notificationPrize: {
    marginTop: 10,
    color: "#059669",
    fontSize: 16,
    fontWeight: "900",
  },
  notificationHint: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
  },
  emptyNotification: {
    paddingVertical: 15,
  },
  emptyNotificationText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
  },
});
