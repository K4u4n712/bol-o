import React, { useEffect, useRef, useState } from "react";
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
  ScrollView,
  SafeAreaView,
  StatusBar,
  Animated,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";

const JOGO_ID = "brasil-argentina-2026";
const VALOR_APOSTA = 10;

function gerarIdNotificacao(email: string) {
  return `${JOGO_ID}_${email
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

  const [participantes, setParticipantes] = useState(0);
  const [notificacao, setNotificacao] = useState<any>(null);
  const [mostrarNotificacao, setMostrarNotificacao] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;

  const valorAposta = VALOR_APOSTA;
  const totalBolao = participantes * valorAposta;

  useEffect(() => {
    Animated.loop(
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
    ).start();
  }, []);

  useEffect(() => {
    const apostasRef = collection(db, "apostas");
    const qApostas = query(apostasRef, where("jogoId", "==", JOGO_ID));

    const unsubscribeApostas = onSnapshot(
      qApostas,
      (snapshot) => {
        setParticipantes(snapshot.size);
      },
      (error) => {
        console.log("Erro ao carregar participantes:", error);
      }
    );

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
      unsubscribeApostas();

      if (unsubscribeNotificacao) {
        unsubscribeNotificacao();
      }
    };
  }, [user]);

  function abrirNotificacao() {
    setMostrarNotificacao(true);
  }

  function fecharNotificacao() {
    setMostrarNotificacao(false);
  }

  function irParaAposta() {
    router.push("/(tabs)/apostar");
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
                style={[
                  styles.liveDot,
                  {
                    transform: [{ scale: pulse }],
                  },
                ]}
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

          {mostrarNotificacao && (
            <View style={styles.notificationCard}>
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
                  <Text style={styles.notificationGame}>
                    🏆 Resultado do Bolão
                  </Text>

                  <Text style={styles.notificationMessage}>
                    {notificacao.mensagem}
                  </Text>

                  {notificacao.venceu && (
                    <Text style={styles.notificationPrize}>
                      💰 Prêmio: R$ {Number(notificacao.premio).toFixed(2)}
                    </Text>
                  )}

                  <Text style={styles.notificationHint}>
                    Toque no ✕ para fechar.
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.heroDecorOne} />
          <View style={styles.heroDecorTwo} />
          <View style={styles.heroDecorThree} />
        </View>

        <View style={styles.gameCard}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>PRÓXIMO JOGO</Text>
          </View>

          <Text style={styles.gameTitle}>Brasil x Argentina</Text>

          <View style={styles.teamsRow}>
            <TouchableOpacity style={styles.teamBox} onPress={irParaAposta}>
              <Text style={styles.flag}>🇧🇷</Text>
              <Text style={styles.teamName}>BRASIL</Text>
            </TouchableOpacity>

            <Text style={styles.vs}>X</Text>

            <TouchableOpacity style={styles.teamBox} onPress={irParaAposta}>
              <Text style={styles.flag}>🇦🇷</Text>
              <Text style={styles.teamName}>ARGENTINA</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gameInfo}>
            <Text style={styles.infoText}>📅 21/06/2026</Text>
            <Text style={styles.infoText}>🕘 21:00</Text>
          </View>

          <View style={styles.priceBox}>
            <Text style={styles.priceText}>💸 Entrada: R$ 10,00</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Em quem você acha que vence?</Text>

        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.betButton, styles.brazilButton]}
            onPress={irParaAposta}
          >
            <Text style={styles.betIcon}>🇧🇷</Text>
            <Text style={styles.betButtonText}>BRASIL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.betButton, styles.argentinaButton]}
            onPress={irParaAposta}
          >
            <Text style={styles.betIcon}>🇦🇷</Text>
            <Text style={styles.betButtonText}>ARGENTINA</Text>
          </TouchableOpacity>
        </View>

        {participantes > 0 && (
          <View style={styles.liveBox}>
            <View style={styles.liveHeader}>
              <Text style={styles.liveTitle}>AO VIVO NO BOLÃO</Text>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>● AO VIVO</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>👥</Text>
                <Text style={styles.statNumber}>{participantes}</Text>
                <Text style={styles.statLabel}>pessoas apostando</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statIcon}>🪙</Text>
                <Text style={styles.statNumber}>{totalBolao}</Text>
                <Text style={styles.statLabel}>BRL acumulado</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <View style={styles.bottomMenu}>
        <TouchableOpacity style={styles.menuItemActive}>
          <Text style={styles.menuIcon}>🏠</Text>
          <Text style={styles.menuTextActive}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/(tabs)/apostar")}
        >
          <Text style={styles.menuIcon}>🎯</Text>
          <Text style={styles.menuText}>Apostar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/(tabs)/bolao")}
        >
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuText}>Bolão</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/(tabs)/ranking")}
        >
          <Text style={styles.menuIcon}>🏆</Text>
          <Text style={styles.menuText}>Ranking</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/(tabs)/perfil")}
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

  notificationCard: {
    backgroundColor: "#FFFFFF",
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    zIndex: 10,
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
    fontSize: 23,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 15,
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

  flag: {
    fontSize: 54,
  },

  teamName: {
    marginTop: 6,
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

  brazilButton: {
    backgroundColor: "#FFD500",
  },

  argentinaButton: {
    backgroundColor: "#DDEBFF",
  },

  betIcon: {
    fontSize: 34,
    marginBottom: 6,
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
    fontWeight: "800",
  },
});



