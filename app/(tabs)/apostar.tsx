import { mostrarAlerta } from "../../utils/mostrarAlerta";
import React, { useState, useEffect } from "react";
import { router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useSponsor } from "../../contexts/SponsorContext";
import { db } from "../../services/firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  onSnapshot,
  serverTimestamp,
  runTransaction,
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
  Image,
} from "react-native";

const VALOR_APOSTA = 10;

// ============================================================================
// COMPONENTE INTERNO: CARD DE APOSTA
// ============================================================================
function CardAposta({ jogo }: { jogo: any }) {
  const { user } = useAuth();
  const { patrocinador, temPatrocinador } = useSponsor();

  const [golsCasa, setGolsCasa] = useState(0);
  const [golsFora, setGolsFora] = useState(0);
  const [jaApostou, setJaApostou] = useState(false);
  const [alteracaoUsada, setAlteracaoUsada] = useState(false);
  const [placarApostado, setPlacarApostado] = useState("");
  const [agoraTick, setAgoraTick] = useState(Date.now());
  const [salvando, setSalvando] = useState(false);

  const jogoComecou =
    typeof jogo.startMillis === "number" && agoraTick >= jogo.startMillis;

  const apostaBloqueada =
    jogoComecou || (jaApostou && alteracaoUsada) || salvando;

  useEffect(() => {
    carregarAposta();
  }, [user, jogo.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAgoraTick(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  function getApostaId() {
    if (!user) return "";

    const emailSeguro = (user.email || "sem_email")
      .toLowerCase()
      .replace(/[\/\\.#$[\]]/g, "_");

    const identificador = user.uid ? user.uid : emailSeguro;

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

      if (typeof aposta.golsCasa === "number") {
        setGolsCasa(aposta.golsCasa);
      }

      if (typeof aposta.golsFora === "number") {
        setGolsFora(aposta.golsFora);
      }
    } catch (error) {
      console.log("Erro ao carregar aposta:", error);
    }
  }

  function formatarHorario(millis: number) {
    return new Date(millis).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
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

  function aumentarCasa() {
    if (!apostaBloqueada) {
      setGolsCasa((v) => v + 1);
    }
  }

  function diminuirCasa() {
    if (!apostaBloqueada && golsCasa > 0) {
      setGolsCasa((v) => v - 1);
    }
  }

  function aumentarFora() {
    if (!apostaBloqueada) {
      setGolsFora((v) => v + 1);
    }
  }

  function diminuirFora() {
    if (!apostaBloqueada && golsFora > 0) {
      setGolsFora((v) => v - 1);
    }
  }

  function textoBotao() {
    if (salvando) return "Salvando...";
    if (jogoComecou) return "🔒 Palpites encerrados";
    if (!jaApostou) return "Confirmar palpite";
    if (jaApostou && !alteracaoUsada) return "Alterar palpite uma vez";
    return "✅ Palpite realizado";
  }

  async function confirmarPalpite() {
    try {
      if (salvando) return;

      if (!user) {
        mostrarAlerta("Erro", "Faça login primeiro.");
        return;
      }

      if (!user.uid) {
        mostrarAlerta("Erro", "Usuário sem ID. Faça login novamente.");
        return;
      }

      const uid = user.uid;
      const nomeUsuario = user.nome || "";
      const emailUsuario = user.email || "";

      if (
        typeof jogo.startMillis === "number" &&
        Date.now() >= jogo.startMillis
      ) {
        mostrarAlerta(
          "Palpites encerrados",
          "Esse jogo já começou. Só era possível apostar até o horário de início."
        );
        return;
      }

      setSalvando(true);

      const apostaRef = doc(db, "apostas", getApostaId());

      const usuarioRef = doc(db, "usuarios", uid);
      const usersRef = doc(db, "users", uid);

      const placar = `${golsCasa} x ${golsFora}`;

      const resultado = await runTransaction(db, async (transaction) => {
        const apostaSnap = await transaction.get(apostaRef);
        const usuarioSnap = await transaction.get(usuarioRef);
        const usersSnap = await transaction.get(usersRef);

        const apostaExistente = apostaSnap.exists() ? apostaSnap.data() : null;

        if (apostaExistente && apostaExistente.jaAlterou) {
          throw new Error("ALTERACAO_JA_USADA");
        }

        let saldoAtual = 0;

        if (!apostaExistente) {
          const saldoUsuarios = usuarioSnap.exists()
            ? Number(usuarioSnap.data().saldo || 0)
            : 0;

          const saldoUsers = usersSnap.exists()
            ? Number(usersSnap.data().saldo || 0)
            : 0;

          saldoAtual = Math.max(saldoUsuarios, saldoUsers);

          console.log("SALDO usuarios:", saldoUsuarios);
          console.log("SALDO users:", saldoUsers);
          console.log("SALDO usado:", saldoAtual);

          if (saldoAtual < VALOR_APOSTA) {
            throw new Error("SALDO_INSUFICIENTE");
          }
        }

        const dadosAposta: any = {
          userId: uid,
          patrocinadorId: patrocinador?.id || "",
          patrocinadorNome: patrocinador?.nome || "",
          origem: patrocinador ? `qr_${patrocinador.id}` : "organico",
          nome: nomeUsuario,
          email: emailUsuario,
          emailLower: emailUsuario.toLowerCase(),
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

        if (!apostaExistente) {
          dadosAposta.criadoEm = serverTimestamp();

          const novoSaldo = saldoAtual - VALOR_APOSTA;

          transaction.set(
            usuarioRef,
            {
              uid,
              nome: nomeUsuario,
              email: emailUsuario,
              saldo: novoSaldo,
              atualizadoEm: serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            usersRef,
            {
              uid,
              nome: nomeUsuario,
              email: emailUsuario,
              saldo: novoSaldo,
              atualizadoEm: serverTimestamp(),
            },
            { merge: true }
          );

          const extratoUsuariosRef = doc(
            db,
            "usuarios",
            uid,
            "extrato",
            `aposta_${jogo.id}`
          );

          const extratoUsersRef = doc(
            db,
            "users",
            uid,
            "extrato",
            `aposta_${jogo.id}`
          );

          const dadosExtrato = {
            tipo: "aposta",
            status: "paid",
            valor: -VALOR_APOSTA,
            jogoId: jogo.id,
            jogo: `${jogo.timeCasa.nome} x ${jogo.timeFora.nome}`,
            placar,
            criadoEm: serverTimestamp(),
          };

          transaction.set(extratoUsuariosRef, dadosExtrato);
          transaction.set(extratoUsersRef, dadosExtrato);
        }

        transaction.set(apostaRef, dadosAposta, { merge: true });

        return {
          foiAlteracao: !!apostaExistente,
        };
      });

      setJaApostou(true);
      setAlteracaoUsada(resultado.foiAlteracao);
      setPlacarApostado(placar);

      const msg = `${jogo.timeCasa.sigla} ${placar} ${jogo.timeFora.sigla}`;

      mostrarAlerta(
        resultado.foiAlteracao ? "Palpite alterado!" : "Palpite salvo!",
        msg
      );

      router.push({
        pathname: "/bolao",
        params: {
          focusGameId: jogo.id,
        },
      });
    } catch (error: any) {
      console.log("Erro ao salvar aposta:", error);

      const mensagemErro = String(error?.message || "");

      if (mensagemErro.includes("SALDO_INSUFICIENTE")) {
        mostrarAlerta(
          "Saldo insuficiente",
          `Você precisa ter pelo menos ${VALOR_APOSTA} BRL para apostar.`
        );
        return;
      }

      if (mensagemErro.includes("ALTERACAO_JA_USADA")) {
        mostrarAlerta(
          "Alteração já usada",
          "Você só pode alterar seu palpite uma vez."
        );
        return;
      }

      mostrarAlerta("Erro", "Não foi possível salvar a aposta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={[styles.cardContainer, temPatrocinador && styles.cardContainerPatrocinado]}>
      {temPatrocinador && patrocinador && (
        <View style={styles.cardSponsorMini}>
          <View style={styles.cardSponsorMiniLogo}>
            {patrocinador.logoUri ? (
              <Image
                source={{ uri: patrocinador.logoUri }}
                style={styles.cardSponsorMiniLogoImage}
              />
            ) : (
              <Text style={styles.cardSponsorMiniLogoText}>
                {patrocinador.logoIniciais || "AL"}
              </Text>
            )}
          </View>

          <Text style={styles.cardSponsorMiniText}>
            Oferecimento {patrocinador.nome}
          </Text>
        </View>
      )}

      <View style={styles.matchMiniCard}>
        <View style={styles.miniTeam}>
          <Image
            source={{ uri: jogo.timeCasa.bandeira }}
            style={styles.miniFlagImg}
          />

          <Text style={styles.miniTeamName}>
            {jogo.timeCasa.nome.toUpperCase()}
          </Text>
        </View>

        <Text style={styles.miniVs}>X</Text>

        <View style={styles.miniTeam}>
          <Text style={styles.miniTeamName}>
            {jogo.timeFora.nome.toUpperCase()}
          </Text>

          <Image
            source={{ uri: jogo.timeFora.bandeira }}
            style={styles.miniFlagImg}
          />
        </View>
      </View>

      <Text style={styles.dateText}>
        {jogo.data} • {jogo.horario}
      </Text>

      {typeof jogo.startMillis === "number" && (
        <View style={[styles.timeBox, jogoComecou && styles.timeBoxClosed]}>
          <Text style={styles.timeBoxTitle}>
            {jogoComecou
              ? "Palpites encerrados"
              : `Começa em ${formatarContagem(jogo.startMillis - agoraTick)}`}
          </Text>

          <Text style={styles.timeBoxText}>
            {jogoComecou
              ? "Esse jogo já começou."
              : `Você pode apostar até ${formatarHorario(jogo.startMillis)}.`}
          </Text>
        </View>
      )}

      <View style={styles.scoreAreaWrapper}>
        <View style={styles.scoreColumn}>
          <Text style={[styles.scoreTeam, { color: "#1B4D3E" }]}>
            {jogo.timeCasa.sigla}
          </Text>

          <View style={styles.scoreBox}>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={aumentarCasa}
              disabled={apostaBloqueada}
            >
              <Text
                style={[
                  styles.arrowIcon,
                  apostaBloqueada && styles.disabledText,
                ]}
              >
                ˄
              </Text>
            </TouchableOpacity>

            <Text style={styles.scoreNumber}>{golsCasa}</Text>

            <TouchableOpacity
              style={styles.arrowButton}
              onPress={diminuirCasa}
              disabled={apostaBloqueada}
            >
              <Text
                style={[
                  styles.arrowIcon,
                  apostaBloqueada && styles.disabledText,
                ]}
              >
                ˅
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.scoreXContainer}>
          <Text style={styles.scoreX}>x</Text>
        </View>

        <View style={styles.scoreColumn}>
          <Text style={[styles.scoreTeam, { color: "#111827" }]}>
            {jogo.timeFora.sigla}
          </Text>

          <View style={styles.scoreBox}>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={aumentarFora}
              disabled={apostaBloqueada}
            >
              <Text
                style={[
                  styles.arrowIcon,
                  apostaBloqueada && styles.disabledText,
                ]}
              >
                ˄
              </Text>
            </TouchableOpacity>

            <Text style={styles.scoreNumber}>{golsFora}</Text>

            <TouchableOpacity
              style={styles.arrowButton}
              onPress={diminuirFora}
              disabled={apostaBloqueada}
            >
              <Text
                style={[
                  styles.arrowIcon,
                  apostaBloqueada && styles.disabledText,
                ]}
              >
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
            {jogo.timeCasa.sigla} {placarApostado} {jogo.timeFora.sigla}
          </Text>

          {!alteracaoUsada && !jogoComecou && (
            <Text style={styles.apostaAlteracaoText}>
              Você ainda pode alterar seu palpite uma vez.
            </Text>
          )}

          {alteracaoUsada && (
            <Text style={styles.apostaAlteracaoText}>
              Alteração já utilizada.
            </Text>
          )}

          {jogoComecou && (
            <Text style={styles.apostaAlteracaoText}>
              O jogo começou. Não é mais possível alterar.
            </Text>
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
        <Text
          style={[
            styles.confirmText,
            jaApostou && styles.confirmTextDone,
            apostaBloqueada && styles.confirmTextDisabled,
          ]}
        >
          {textoBotao()}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// TELA PRINCIPAL DE APOSTAS
// ============================================================================
export default function ApostarScreen() {
  const { user } = useAuth();
  const { patrocinador, temPatrocinador } = useSponsor();

  const [jogosAbertos, setJogosAbertos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saldoUsersConta, setSaldoUsersConta] = useState(0);
  const [saldoUsuariosConta, setSaldoUsuariosConta] = useState(0);

  const saldoAtual = Math.max(
    Number(saldoUsersConta || 0),
    Number(saldoUsuariosConta || 0),
    Number((user as any)?.saldo || 0)
  );

  useEffect(() => {
    if (!user?.uid) {
      setSaldoUsersConta(0);
      setSaldoUsuariosConta(0);
      return;
    }

    const unsubscribeUsers = onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        setSaldoUsersConta(
          snapshot.exists() ? Number(snapshot.data()?.saldo || 0) : 0
        );
      },
      (error) => {
        console.log("Erro ao carregar saldo em users:", error);
      }
    );

    const unsubscribeUsuarios = onSnapshot(
      doc(db, "usuarios", user.uid),
      (snapshot) => {
        setSaldoUsuariosConta(
          snapshot.exists() ? Number(snapshot.data()?.saldo || 0) : 0
        );
      },
      (error) => {
        console.log("Erro ao carregar saldo em usuarios:", error);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeUsuarios();
    };
  }, [user?.uid]);

  useEffect(() => {
    const buscarJogos = async () => {
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

        const filtrados = (data.events || []).reduce(
          (acc: any[], event: any) => {
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

            if (dataJogo.getTime() <= agora.getTime()) return acc;

            const jaTemStatus = statusFirebase[event.id] !== undefined;

            const isOpen = jaTemStatus
              ? statusFirebase[event.id]
              : status === "pre";

            if (isOpen) {
              acc.push({
                id: event.id,
                data: dataJogo.toLocaleDateString("pt-BR"),
                horario: dataJogo.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                startMillis: dataJogo.getTime(),
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
            }

            return acc;
          },
          []
        );

        setJogosAbertos(filtrados);
      } catch (error) {
        console.error("Erro ao carregar jogos:", error);
      } finally {
        setLoading(false);
      }
    };

    buscarJogos();

    const interval = setInterval(buscarJogos, 60000);

    return () => clearInterval(interval);
  }, []);

  function formatarSaldo(valor: number) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function irParaDeposito() {
    router.push("/perfil");
  }

  function abrirAjuda() {
    mostrarAlerta(
      "Como funciona?",
      "Escolha o placar exato. Cada usuário pode enviar apenas um palpite por jogo. Após apostar, você ainda pode alterar uma única vez antes do jogo começar."
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.safe,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#006B2E" />

        <Text
          style={{
            marginTop: 12,
            color: "#006B2E",
            fontWeight: "bold",
          }}
        >
          Carregando jogos...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, temPatrocinador && styles.safePatrocinado]}>
      <StatusBar barStyle="light-content" backgroundColor={temPatrocinador ? "#050A07" : "#006B2E"} />

      <View style={[styles.header, temPatrocinador && styles.headerPatrocinado]}>
        <TouchableOpacity onPress={() => router.push("/")}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Fazer meu palpite</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.saldoPill, temPatrocinador && styles.saldoPillPatrocinado]}
            onPress={irParaDeposito}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.saldoPillText,
                temPatrocinador && styles.saldoPillTextPatrocinado,
              ]}
            >
              Saldo: R$ {formatarSaldo(saldoAtual)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.helpCircle} onPress={abrirAjuda}>
            <Text style={styles.helpText}>?</Text>
          </TouchableOpacity>
        </View>
      </View>

      {temPatrocinador && patrocinador && (
        <View style={styles.sponsorTopCard}>
          <View style={styles.sponsorTopLogo}>
            {patrocinador.logoUri ? (
              <Image
                source={{ uri: patrocinador.logoUri }}
                style={styles.sponsorTopLogoImage}
              />
            ) : (
              <Text style={styles.sponsorTopLogoText}>
                {patrocinador.logoIniciais || "AL"}
              </Text>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.sponsorTopSmall}>OFERECIMENTO</Text>
            <Text style={styles.sponsorTopName}>{patrocinador.nome}</Text>
            <Text style={styles.sponsorTopText}>Bolão10 em parceria oficial.</Text>
          </View>
        </View>
      )}

      {jogosAbertos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.padlock}>🔒</Text>

          <Text style={styles.emptyText}>
            Nenhuma aposta disponível no momento
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>🎯</Text>

            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>
                Acerta o placar e leva o bolão!
              </Text>

              <Text style={styles.infoText}>
                Bateu o placar exato? O prêmio é todo seu.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Jogos Abertos ⓘ</Text>

          {jogosAbertos.map((jogo) => (
            <CardAposta key={jogo.id} jogo={jogo} />
          ))}

          <Text style={styles.feeText}>
            ⚠️ Aposta Real: {VALOR_APOSTA} BRL por pessoa por jogo
          </Text>
        </ScrollView>
      )}

      <View style={styles.bottomMenu}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/")}
        >
          <Text style={styles.menuIcon}>🏠</Text>
          <Text style={styles.menuText}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItemActive}>
          <Text style={styles.menuIcon}>🎯</Text>
          <Text style={styles.menuTextActive}>Apostar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/bolao")}
        >
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuText}>Bolão</Text>
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

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },

  saldoPill: {
    backgroundColor: "#008D38",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    elevation: 4,
  },

  saldoPillPatrocinado: {
    backgroundColor: "#D6A941",
    borderColor: "rgba(255,255,255,0.18)",
  },

  saldoPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  saldoPillTextPatrocinado: {
    color: "#07120C",
  },

  helpCircle: {
    width: 28,
    marginLeft: 8,
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
    resizeMode: "contain",
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
    marginBottom: 10,
  },

  timeBox: {
    backgroundColor: "#E7FBEF",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#B7E4C7",
    alignItems: "center",
  },

  timeBoxClosed: {
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
  },

  timeBoxTitle: {
    color: "#006B2E",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },

  timeBoxText: {
    color: "#4B5563",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    textAlign: "center",
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

  safePatrocinado: {
    backgroundColor: "#F7F3EA",
  },

  headerPatrocinado: {
    backgroundColor: "#07110C",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(205, 162, 78, 0.55)",
  },

  sponsorTopCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(205, 162, 78, 0.45)",
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginHorizontal: 20,
    marginTop: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
  },

  sponsorTopLogo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#050A07",
    borderWidth: 1.5,
    borderColor: "rgba(205, 162, 78, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },

  sponsorTopLogoImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },

  sponsorTopLogoText: {
    color: "#E8C878",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },

  sponsorTopSmall: {
    color: "#7A6633",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
  },

  sponsorTopName: {
    color: "#123522",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 2,
  },

  sponsorTopText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },

  cardContainerPatrocinado: {
    borderWidth: 1,
    borderColor: "rgba(205, 162, 78, 0.35)",
  },

  cardSponsorMini: {
    alignSelf: "center",
    backgroundColor: "#F7F3EA",
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(205, 162, 78, 0.45)",
    flexDirection: "row",
    alignItems: "center",
  },

  cardSponsorMiniLogo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#050A07",
    overflow: "hidden",
    marginRight: 7,
    alignItems: "center",
    justifyContent: "center",
  },

  cardSponsorMiniLogoImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },

  cardSponsorMiniLogoText: {
    color: "#E8C878",
    fontSize: 9,
    fontWeight: "900",
  },

  cardSponsorMiniText: {
    color: "#7A6633",
    fontSize: 11,
    fontWeight: "900",
  }
});