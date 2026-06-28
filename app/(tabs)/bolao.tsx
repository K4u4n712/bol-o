import React, { useEffect, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { db } from "../../services/firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Animated,
  FlatList,
  Dimensions,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Aposta = {
  id?: string;
  userId?: string;
  nome: string;
  email: string;
  emailLower?: string;
  placar: string;
  jogo: string;
  jogoId: string;
  valor: number;
  criadoEm?: any;
  atualizadoEm?: any;
};

type Jogo = {
  id: string;
  data: string;
  horario: string;
  status: string;
  statusOriginal: string;
  dataHora: string;
  startMillis: number;
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

type JogoBolao = Jogo & {
  apostas: Aposta[];
  minhaAposta?: Aposta | null;
  totalParticipantes: number;
  totalBolao: number;
  isFocusedGame: boolean;
  hasMyGuess: boolean;
  isLive: boolean;
  isFinished: boolean;
  myGuessMillis: number;
};

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 40;

const VALOR_APOSTA = 10;

// duração estimada para mostrar “termina em”
const DURACAO_ESTIMADA_JOGO_MS = 2 * 60 * 60 * 1000;

export default function BolaoScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const focusGameId =
    typeof params.focusGameId === "string" ? params.focusGameId : "";

  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [apostas, setApostas] = useState<Aposta[]>([]);
  const [carregandoJogo, setCarregandoJogo] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [jogoSelecionadoId, setJogoSelecionadoId] = useState("");
  const [agoraTick, setAgoraTick] = useState(Date.now());

  const { width: windowWidth } = useWindowDimensions();

  const cardWidth = useMemo(() => {
    if (Platform.OS !== "web") {
      return CARD_WIDTH;
    }

    const larguraBase = windowWidth || width;
    const larguraCalculada = larguraBase - 40;

    return Math.max(280, Math.min(larguraCalculada, 390));
  }, [windowWidth]);

  const pulse = useRef(new Animated.Value(1)).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const primeiroVisivel = viewableItems?.[0];

    if (!primeiroVisivel) return;

    if (typeof primeiroVisivel.index === "number") {
      setCurrentIndex(primeiroVisivel.index);
    }

    if (primeiroVisivel.item?.id) {
      setJogoSelecionadoId(primeiroVisivel.item.id);
    }
  }).current;

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
    const interval = setInterval(() => {
      setAgoraTick(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function buscarJogosBolao() {
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

            const jaTemStatusNoFirebase =
              statusFirebase[event.id] !== undefined;

            const apostasAbertas = jaTemStatusNoFirebase
              ? statusFirebase[event.id]
              : status === "pre";

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
              statusOriginal: status,
              dataHora: event.date,
              startMillis: dataJogo.getTime(),
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

            return acc;
          },
          []
        );

        setJogos(jogosFiltrados);
      } catch (error) {
        console.log("Erro ao buscar jogos do bolão:", error);
        setJogos([]);
      } finally {
        setCarregandoJogo(false);
      }
    }

    buscarJogosBolao();

    const interval = setInterval(buscarJogosBolao, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const apostasRef = collection(db, "apostas");

    const unsubscribe = onSnapshot(
      apostasRef,
      (snapshot) => {
        const lista: Aposta[] = snapshot.docs.map((documento) => {
          const data = documento.data();

          return {
            id: documento.id,
            userId: data.userId || "",
            nome: data.nome || "Usuário",
            email: data.email || "",
            emailLower: data.emailLower || "",
            placar: data.placar || "",
            jogo: data.jogo || "",
            jogoId: String(data.jogoId || ""),
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
  }, []);

  const jogosDoBolao = useMemo(() => {
    const emailUsuario = user?.email?.toLowerCase() || "";
    const uidUsuario = user?.uid || "";

    return jogos
      .map((jogo) => {
        const jogoIdAtual = String(jogo.id || "");
        const nomeJogoCompleto = `${jogo.timeCasa.nome} x ${jogo.timeFora.nome}`;
        const nomeJogoSiglas = `${jogo.timeCasa.sigla} x ${jogo.timeFora.sigla}`;

        const apostasDoJogo = apostas.filter((aposta) => {
          const apostaJogoId = String(aposta.jogoId || "");

          if (apostaJogoId && apostaJogoId === jogoIdAtual) {
            return true;
          }

          const textoJogoAposta = normalizarTexto(aposta.jogo || "");

          if (!textoJogoAposta) {
            return false;
          }

          return (
            textoJogoAposta === normalizarTexto(nomeJogoCompleto) ||
            textoJogoAposta === normalizarTexto(nomeJogoSiglas)
          );
        });

        const minhaAposta =
          apostasDoJogo.find((aposta) => {
            const apostaEmail =
              aposta.emailLower || aposta.email?.toLowerCase() || "";

            return (
              (!!uidUsuario && aposta.userId === uidUsuario) ||
              (!!emailUsuario && apostaEmail === emailUsuario)
            );
          }) || null;

        const totalParticipantes = apostasDoJogo.length;

        const totalBolao = apostasDoJogo.reduce((total, item) => {
          return total + Number(item.valor || VALOR_APOSTA);
        }, 0);

        const isLive = jogo.statusOriginal === "in";
        const isFinished = jogo.statusOriginal === "post";
        const hasMyGuess = !!minhaAposta;
        const isFocusedGame = jogo.id === focusGameId;

        return {
          ...jogo,
          apostas: apostasDoJogo,
          minhaAposta,
          totalParticipantes,
          totalBolao,
          isFocusedGame,
          hasMyGuess,
          isLive,
          isFinished,
          myGuessMillis: pegarMillis(
            minhaAposta?.atualizadoEm || minhaAposta?.criadoEm
          ),
        };
      })
      .filter((jogo) => {
        return (
          !jogo.isFinished &&
          (
            jogo.totalParticipantes > 0 ||
            jogo.hasMyGuess ||
            jogo.isLive ||
            jogo.apostasAbertas
          )
        );
      })
      .sort((a, b) => {
        if (a.isFocusedGame && !b.isFocusedGame) return -1;
        if (!a.isFocusedGame && b.isFocusedGame) return 1;

        if (b.totalBolao !== a.totalBolao) return b.totalBolao - a.totalBolao;

        if (b.totalParticipantes !== a.totalParticipantes) {
          return b.totalParticipantes - a.totalParticipantes;
        }

        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;

        if (a.apostasAbertas && !b.apostasAbertas) return -1;
        if (!a.apostasAbertas && b.apostasAbertas) return 1;

        if (a.hasMyGuess && !b.hasMyGuess) return -1;
        if (!a.hasMyGuess && b.hasMyGuess) return 1;

        if (a.hasMyGuess && b.hasMyGuess) {
          return b.myGuessMillis - a.myGuessMillis;
        }

        return a.startMillis - b.startMillis;
      });
  }, [jogos, apostas, user?.email, user?.uid, focusGameId]);

  useEffect(() => {
    if (jogosDoBolao.length === 0) {
      setCurrentIndex(0);
      setJogoSelecionadoId("");
      return;
    }

    const aindaExiste = jogosDoBolao.some(
      (jogo) => jogo.id === jogoSelecionadoId
    );

    if (!jogoSelecionadoId || !aindaExiste) {
      setCurrentIndex(0);
      setJogoSelecionadoId(jogosDoBolao[0].id);
      return;
    }

    if (currentIndex > jogosDoBolao.length - 1) {
      setCurrentIndex(0);
      setJogoSelecionadoId(jogosDoBolao[0].id);
    }
  }, [jogosDoBolao, currentIndex, jogoSelecionadoId]);

  const jogoSelecionado =
    jogosDoBolao.find((jogo) => jogo.id === jogoSelecionadoId) ||
    jogosDoBolao[currentIndex] ||
    null;

  const apostasSelecionadas = jogoSelecionado?.apostas || [];

  function normalizarTexto(texto: string) {
    return String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

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

  function formatarContagem(millis: number) {
    if (millis <= 0) return "agora";

    const totalMinutos = Math.ceil(millis / 60000);
    const dias = Math.floor(totalMinutos / 1440);
    const horas = Math.floor((totalMinutos % 1440) / 60);
    const minutos = totalMinutos % 60;

    if (dias > 0) {
      return `${dias}d ${horas}h ${minutos}min`;
    }

    if (horas > 0) {
      return `${horas}h ${minutos}min`;
    }

    return `${minutos}min`;
  }

  function formatarHorarioLimite(millis: number) {
    return new Date(millis).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getInfoTempoJogo(item: JogoBolao) {
    const inicioJogo = item.startMillis;
    const fimEstimado = inicioJogo + DURACAO_ESTIMADA_JOGO_MS;

    if (item.isLive) {
      const restante = fimEstimado - agoraTick;

      return {
        titulo: "Jogo rolando",
        destaque:
          restante > 0
            ? `Termina em aprox. ${formatarContagem(restante)}`
            : "Pode estar acabando agora",
        texto: "Palpites encerrados porque o jogo já começou.",
      };
    }

    if (agoraTick < inicioJogo) {
      const restante = inicioJogo - agoraTick;

      return {
        titulo: `Começa em ${formatarContagem(restante)}`,
        destaque: item.apostasAbertas
          ? `Você pode apostar até ${formatarHorarioLimite(inicioJogo)}`
          : "Palpites fechados pelo admin",
        texto: item.apostasAbertas
          ? "Quando o jogo começar, o palpite fecha automaticamente."
          : "Esse bolão não está aceitando novos palpites agora.",
      };
    }

    return {
      titulo: "Jogo encerrado",
      destaque: "Palpites encerrados",
      texto: "Aguardando apuração do resultado.",
    };
  }

  function handleScrollEnd(event: any) {
    const indexCalculado = Math.round(
      event.nativeEvent.contentOffset.x / cardWidth
    );

    const indexSeguro = Math.max(
      0,
      Math.min(indexCalculado, jogosDoBolao.length - 1)
    );

    const jogoAtual = jogosDoBolao[indexSeguro];

    setCurrentIndex(indexSeguro);

    if (jogoAtual?.id) {
      setJogoSelecionadoId(jogoAtual.id);
    }
  }

  function renderBolaoCard({ item }: { item: JogoBolao }) {
    const nomeJogo = `${item.timeCasa.nome} x ${item.timeFora.nome}`;
    const tempoInfo = getInfoTempoJogo(item);

    return (
      <View style={[styles.carouselSlide, { width: cardWidth }]}>
        <View style={styles.heroCard}>
          <View style={styles.liveRowTop}>
            <Animated.View
              style={[
                styles.liveDot,
                item.isLive && styles.liveDotRed,
                { opacity: pulse },
              ]}
            />

            <Text style={styles.liveTopText}>
              {item.isLive
                ? "AO VIVO"
                : item.hasMyGuess
                ? "MEU PALPITE"
                : "ABERTO"}
            </Text>
          </View>

          <Text style={styles.heroTitle}>Bolão do jogo</Text>

          <Text style={styles.heroMatch}>{nomeJogo}</Text>

          <Text style={styles.heroDate}>
            {item.data} • {item.horario}
          </Text>

          <View
            style={[
              styles.timeNoticeBox,
              item.isLive && styles.timeNoticeBoxLive,
              !item.apostasAbertas && !item.isLive && styles.timeNoticeBoxClosed,
            ]}
          >
            <Text style={styles.timeNoticeTitle}>{tempoInfo.titulo}</Text>
            <Text style={styles.timeNoticeHighlight}>
              {tempoInfo.destaque}
            </Text>
            <Text style={styles.timeNoticeText}>{tempoInfo.texto}</Text>
          </View>

          {item.minhaAposta && (
            <View style={styles.myGuessBox}>
              <Text style={styles.myGuessTitle}>Seu palpite</Text>
              <Text style={styles.myGuessText}>
                {item.timeCasa.sigla} {item.minhaAposta.placar}{" "}
                {item.timeFora.sigla}
              </Text>
            </View>
          )}

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total acumulado</Text>
            <Text style={styles.totalValue}>{item.totalBolao} BRL</Text>
            <Text style={styles.totalSub}>valor total do prêmio</Text>
          </View>

          {jogosDoBolao.length > 1 && (
            <Text style={styles.swipeText}>
              Arraste para o lado para ver outros bolões
            </Text>
          )}
        </View>
      </View>
    );
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
        {carregandoJogo && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Carregando bolões...</Text>
            <Text style={styles.emptyText}>
              Estamos buscando os jogos disponíveis.
            </Text>
          </View>
        )}

        {!carregandoJogo && jogosDoBolao.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum bolão disponível</Text>
            <Text style={styles.emptyText}>
              Os bolões aparecem quando estiverem abertos, ao vivo ou quando
              você já tiver feito um palpite.
            </Text>
          </View>
        )}

        {jogosDoBolao.length > 0 && (
          <>
            <FlatList
              data={jogosDoBolao}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              style={
                Platform.OS === "web"
                  ? { width: cardWidth, alignSelf: "center" }
                  : undefined
              }
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScrollEnd}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              renderItem={renderBolaoCard}
            />

            <View style={styles.dotsArea}>
              {jogosDoBolao.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    currentIndex === index && styles.dotActive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>👥</Text>
                <Text style={styles.statNumber}>
                  {jogoSelecionado?.totalParticipantes || 0}
                </Text>
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
                Quem acertar o placar exato leva o bolão acumulado. Se mais de
                uma pessoa acertar, o prêmio pode ser dividido entre os
                ganhadores.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Participantes do bolão</Text>

            {apostasSelecionadas.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  Nenhum participante ainda
                </Text>
                <Text style={styles.emptyText}>
                  Quando alguém fizer um palpite neste jogo, vai aparecer aqui.
                </Text>
              </View>
            )}

            {apostasSelecionadas.map((item, index) => (
              <View
                style={styles.userCard}
                key={item.id || `${item.email}-${index}`}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.nome?.charAt(0).toUpperCase() || "U"}
                  </Text>
                </View>

                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.nome || "Usuário"}</Text>

                  <Text style={styles.userBet}>
                    {item.jogo ||
                      `${jogoSelecionado?.timeCasa.nome} x ${jogoSelecionado?.timeFora.nome}`}{" "}
                    • {item.placar}
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
          </>
        )}

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

  carouselSlide: {
    overflow: "hidden",
  },

  heroCard: {
    backgroundColor: "#006B2E",
    borderRadius: 30,
    padding: 24,
    alignItems: "center",
    elevation: 5,
    ...(Platform.OS === "web"
      ? {
          width: "100%",
          maxWidth: 390,
          overflow: "hidden",
        }
      : {}),
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

  liveDotRed: {
    backgroundColor: "#FF5A5F",
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
    flexShrink: 1,
  },

  heroMatch: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 8,
    textAlign: "center",
    flexShrink: 1,
  },

  heroDate: {
    color: "#DFFFEA",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 8,
    textAlign: "center",
  },

  timeNoticeBox: {
    backgroundColor: "#E7FBEF",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#B7E4C7",
  },

  timeNoticeBoxLive: {
    backgroundColor: "#FFECEC",
    borderColor: "#FFB4B4",
  },

  timeNoticeBoxClosed: {
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
  },

  timeNoticeTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },

  timeNoticeHighlight: {
    color: "#006B2E",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
    textAlign: "center",
  },

  timeNoticeText: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },

  myGuessBox: {
    backgroundColor: "#FFF6BF",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
    alignItems: "center",
    width: "100%",
  },

  myGuessTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
  },

  myGuessText: {
    color: "#006B2E",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
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
    textAlign: "center",
    flexShrink: 1,
  },

  totalSub: {
    color: "#DFFFEA",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },

  swipeText: {
    color: "#DFFFEA",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 16,
    textAlign: "center",
  },

  dotsArea: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 14,
    gap: 8,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C9D3CE",
  },

  dotActive: {
    width: 22,
    backgroundColor: "#006B2E",
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