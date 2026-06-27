import React, { useEffect, useRef, useState } from "react";
import { mostrarAlerta, mostrarConfirmacao } from "../utils/mostrarAlerta";
import { router } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebaseConfig";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const VALOR_APOSTA = 10;
const TAXA_ADMIN = 0.2;

type JogoMonitorado = {
  id: string;
  jogo: string;
  data: string;
  horario: string;
  dataInicioMillis: number;
  dataFimEstimadoMillis: number;
  statusRaw: string;
  statusBR: string;
  placarCasa: number;
  placarFora: number;
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

type Aposta = {
  id: string;
  nome: string;
  email: string;
  emailLower: string;
  jogo: string;
  placar: string;
  golsCasa: number;
  golsFora: number;
  valor: number;
  criadoEm?: any;
  atualizadoEm?: any;
};

type ResultadoProcessado = {
  jogoId: string;
  jogo: string;
  processado: boolean;
  resultadoOficial: {
    golsCasa: number;
    golsFora: number;
    placar: string;
  };
  totalPalpites: number;
  totalArrecadado: number;
  taxaAdmin: number;
  premioLiquido: number;
  quantidadeGanhadores: number;
  premioPorVencedor: number;
  ganhadores: any[];
  ranking: any[];
  modoProcessamento: string;
  processadoEmTexto: string;
};

export default function AdminScreen() {
  const {
    user,
    users,
    carregarUsuarios,
    banirUsuario,
  } = useAuth();

  const [jogos, setJogos] = useState<JogoMonitorado[]>([]);
  const [carregandoJogos, setCarregandoJogos] = useState(true);

  const [apostasPorJogo, setApostasPorJogo] = useState<
    Record<string, Aposta[]>
  >({});

  const [resultadosPorJogo, setResultadosPorJogo] = useState<
    Record<string, ResultadoProcessado | null>
  >({});

  const [resultadosManuais, setResultadosManuais] = useState<
    Record<string, { casa: string; fora: string }>
  >({});

  const [saldosEditados, setSaldosEditados] = useState<Record<string, string>>(
    {}
  );

  const [saldosUsers, setSaldosUsers] = useState<any>({
    porEmail: {},
    porUid: {},
  });

  const [saldosUsuarios, setSaldosUsuarios] = useState<any>({
    porEmail: {},
    porUid: {},
  });

  const [agoraTick, setAgoraTick] = useState(Date.now());
  const [processandoIds, setProcessandoIds] = useState<Record<string, boolean>>(
    {}
  );

  const [secoesAbertas, setSecoesAbertas] = useState({
    jogos: true,
    usuarios: false,
  });

  const processandoRef = useRef<Set<string>>(new Set());

  const usuariosComuns = users.filter((item: any) => item.role === "user");

  const totalPalpitesGeral = Object.values(apostasPorJogo).reduce(
    (total, lista) => total + lista.length,
    0
  );

  const totalArrecadadoGeral = Object.values(apostasPorJogo).reduce(
    (total, lista) => {
      const subtotal = lista.reduce(
        (soma, aposta) => soma + Number(aposta.valor || VALOR_APOSTA),
        0
      );

      return total + subtotal;
    },
    0
  );

  useEffect(() => {
    carregarUsuarios();
  }, []);

  useEffect(() => {
    function montarMapaSaldos(snapshot: any) {
      const porEmail: Record<string, number> = {};
      const porUid: Record<string, number> = {};

      snapshot.docs.forEach((documento: any) => {
        const data = documento.data() || {};
        const emailLower = normalizarEmail(data.email || data.emailLower || "");
        const uid = String(data.uid || documento.id || "");
        const saldo = Number(data.saldo || 0);

        if (emailLower) {
          porEmail[emailLower] = saldo;
        }

        if (uid) {
          porUid[uid] = saldo;
        }
      });

      return {
        porEmail,
        porUid,
      };
    }

    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setSaldosUsers(montarMapaSaldos(snapshot));
      },
      (error) => {
        console.log("Erro ao escutar saldos em users:", error);
      }
    );

    const unsubscribeUsuarios = onSnapshot(
      collection(db, "usuarios"),
      (snapshot) => {
        setSaldosUsuarios(montarMapaSaldos(snapshot));
      },
      (error) => {
        console.log("Erro ao escutar saldos em usuarios:", error);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeUsuarios();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setAgoraTick(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function buscarJogos() {
      try {
        const agora = new Date();

        const inicioBusca = new Date(agora.getTime() - 6 * 60 * 60 * 1000);
        const limite48h = new Date(agora.getTime() + 48 * 60 * 60 * 1000);

        const fData = (d: Date) =>
          `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
            2,
            "0"
          )}${String(d.getDate()).padStart(2, "0")}`;

        const urlESPN = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${fData(
          inicioBusca
        )}-${fData(limite48h)}`;

        const response = await fetch(urlESPN);
        const data = await response.json();

        const statusSnapshot = await getDocs(collection(db, "status_apostas"));

        const statusFirebase: Record<string, boolean> = {};

        statusSnapshot.forEach((docSnap) => {
          statusFirebase[docSnap.id] = Boolean(docSnap.data().aberta);
        });

        const listaJogos: JogoMonitorado[] = [];

        (data.events || []).forEach((event: any) => {
          const dataJogo = new Date(event.date);
          const statusRaw = event.status?.type?.state || "pre";

          const competidores = event.competitions?.[0]?.competitors || [];

          const timeCasa = competidores.find(
            (c: any) => c.homeAway === "home"
          );

          const timeFora = competidores.find(
            (c: any) => c.homeAway === "away"
          );

          if (!timeCasa || !timeFora) return;

          const agoraMs = agora.getTime();
          const dataJogoMs = dataJogo.getTime();

          const futuroDentro48h =
            dataJogoMs >= agoraMs && dataJogoMs <= limite48h.getTime();

          const jogoRecente =
            dataJogoMs < agoraMs &&
            agoraMs - dataJogoMs <= 6 * 60 * 60 * 1000;

          if (!futuroDentro48h && !jogoRecente) return;

          const jaTemStatusFirebase = statusFirebase[event.id] !== undefined;

          const apostasAbertas = jaTemStatusFirebase
            ? statusFirebase[event.id]
            : statusRaw === "pre";

          let statusBR = "AGENDADO";
          if (statusRaw === "in") statusBR = "AO VIVO";
          if (statusRaw === "post") statusBR = "FINALIZADO";

          listaJogos.push({
            id: event.id,
            jogo: `${timeCasa.team.displayName} x ${timeFora.team.displayName}`,
            data: dataJogo.toLocaleDateString("pt-BR"),
            horario: dataJogo.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            dataInicioMillis: dataJogoMs,
            dataFimEstimadoMillis: dataJogoMs + 2 * 60 * 60 * 1000,
            statusRaw,
            statusBR,
            placarCasa: Number(timeCasa.score || 0),
            placarFora: Number(timeFora.score || 0),
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

        listaJogos.sort((a, b) => {
          const prioridade = (status: string) => {
            if (status === "in") return 0;
            if (status === "pre") return 1;
            if (status === "post") return 2;
            return 3;
          };

          const pa = prioridade(a.statusRaw);
          const pb = prioridade(b.statusRaw);

          if (pa !== pb) return pa - pb;

          return a.dataInicioMillis - b.dataInicioMillis;
        });

        setJogos(listaJogos);
      } catch (error) {
        console.log("Erro ao buscar jogos:", error);
        setJogos([]);
      } finally {
        setCarregandoJogos(false);
      }
    }

    buscarJogos();

    const interval = setInterval(buscarJogos, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (jogos.length === 0) {
      setApostasPorJogo({});
      return;
    }

    const unsubscribes = jogos.map((jogo) => {
      const apostasRef = collection(db, "apostas");
      const q = query(apostasRef, where("jogoId", "==", jogo.id));

      return onSnapshot(
        q,
        (snapshot) => {
          const lista: Aposta[] = snapshot.docs.map((documento) => {
            const data = documento.data();

            return {
              id: documento.id,
              nome: data.nome || "Usuário",
              email: data.email || "",
              emailLower:
                data.emailLower || data.email?.toLowerCase() || "",
              jogo: data.jogo || jogo.jogo,
              placar: data.placar || "",
              golsCasa: Number(data.golsCasa || 0),
              golsFora: Number(data.golsFora || 0),
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

          setApostasPorJogo((prev) => ({
            ...prev,
            [jogo.id]: lista,
          }));
        },
        (error) => {
          console.log("Erro ao carregar apostas do jogo:", jogo.id, error);
        }
      );
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [jogos.map((jogo) => jogo.id).join("|")]);

  useEffect(() => {
    if (jogos.length === 0) {
      setResultadosPorJogo({});
      return;
    }

    const unsubscribes = jogos.map((jogo) => {
      const resultadoRef = doc(db, "resultados", jogo.id);

      return onSnapshot(resultadoRef, (snapshot) => {
        setResultadosPorJogo((prev) => ({
          ...prev,
          [jogo.id]: snapshot.exists()
            ? (snapshot.data() as ResultadoProcessado)
            : null,
        }));
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [jogos.map((jogo) => jogo.id).join("|")]);

  useEffect(() => {
    jogos.forEach((jogo) => {
      const resultado = resultadosPorJogo[jogo.id];

      if (jogo.statusRaw !== "post") return;
      if (resultado?.processado) return;
      if (processandoRef.current.has(jogo.id)) return;

      calcularVencedoresJogo(jogo, true);
    });
  }, [jogos, resultadosPorJogo]);

  if (!user || user.role !== "admin") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.blockedBox}>
          <Text style={styles.blockedIcon}>🔒</Text>
          <Text style={styles.blockedTitle}>Acesso bloqueado</Text>
          <Text style={styles.blockedText}>
            Apenas administradores podem acessar esta área.
          </Text>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.backButtonText}>Voltar para o app</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  function alternarSecao(secao: "jogos" | "usuarios") {
    setSecoesAbertas((prev) => ({
      ...prev,
      [secao]: !prev[secao],
    }));
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

  function formatarMoeda(valor: number) {
    return `${Number(valor || 0).toFixed(2)} BRL`;
  }

  function normalizarEmail(email: string) {
    return String(email || "").trim().toLowerCase();
  }

  function pegarSaldoVisual(item: any) {
    const emailLower = normalizarEmail(item.email || item.emailLower || "");
    const uid = String(item.uid || item.id || "");

    const saldos = [
      Number(item.saldo || 0),
      emailLower ? Number(saldosUsers.porEmail[emailLower] || 0) : 0,
      uid ? Number(saldosUsers.porUid[uid] || 0) : 0,
      emailLower ? Number(saldosUsuarios.porEmail[emailLower] || 0) : 0,
      uid ? Number(saldosUsuarios.porUid[uid] || 0) : 0,
    ].filter((valor) => !isNaN(valor));

    if (saldos.length === 0) return 0;

    return Math.max(...saldos);
  }

  async function buscarDocumentoPorEmailEmColecao(
    nomeColecao: "users" | "usuarios",
    email: string
  ) {
    const emailLower = normalizarEmail(email);
    const refColecao = collection(db, nomeColecao);

    let snapshot = await getDocs(
      query(refColecao, where("emailLower", "==", emailLower))
    );

    if (snapshot.empty) {
      snapshot = await getDocs(query(refColecao, where("email", "==", email)));
    }

    if (snapshot.empty) {
      snapshot = await getDocs(
        query(refColecao, where("email", "==", emailLower))
      );
    }

    if (snapshot.empty) return null;

    const documento = snapshot.docs[0];

    return {
      id: documento.id,
      ref: doc(db, nomeColecao, documento.id),
      data: documento.data() as any,
    };
  }

  function formatarDuracao(ms: number) {
    if (ms <= 0) return "00h 00m 00s";

    const totalSegundos = Math.floor(ms / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    return `${String(horas).padStart(2, "0")}h ${String(minutos).padStart(
      2,
      "0"
    )}m ${String(segundos).padStart(2, "0")}s`;
  }

  function textoTempoPrincipal(jogo: JogoMonitorado) {
    if (jogo.statusRaw === "post") return "Jogo finalizado";

    if (jogo.statusRaw === "pre") {
      const faltaParaComecar = jogo.dataInicioMillis - agoraTick;

      if (faltaParaComecar > 0) {
        return `Começa em ${formatarDuracao(faltaParaComecar)}`;
      }

      return "Aguardando início";
    }

    if (jogo.statusRaw === "in") {
      const faltaParaEncerrar = jogo.dataFimEstimadoMillis - agoraTick;

      if (faltaParaEncerrar > 0) {
        return `Encerra em aprox. ${formatarDuracao(faltaParaEncerrar)}`;
      }

      return "Aguardando fim oficial da ESPN";
    }

    return `${jogo.data} • ${jogo.horario}`;
  }

  function alterarSaldoCampo(email: string, valor: string) {
    setSaldosEditados({
      ...saldosEditados,
      [email]: valor,
    });
  }

  function alterarResultadoManual(
    jogoId: string,
    campo: "casa" | "fora",
    valor: string
  ) {
    setResultadosManuais((prev) => ({
      ...prev,
      [jogoId]: {
        casa: prev[jogoId]?.casa || "",
        fora: prev[jogoId]?.fora || "",
        [campo]: valor,
      },
    }));
  }

  function pegarResultadoManual(jogo: JogoMonitorado, campo: "casa" | "fora") {
    const manual = resultadosManuais[jogo.id];

    if (manual?.[campo] !== undefined) {
      return manual[campo];
    }

    if (jogo.statusRaw === "post") {
      return campo === "casa"
        ? String(jogo.placarCasa)
        : String(jogo.placarFora);
    }

    return "";
  }

  async function salvarSaldo(email: string) {
    try {
      const valorDigitado = saldosEditados[email];

      if (!valorDigitado) {
        mostrarAlerta("Atenção", "Digite um valor de saldo.");
        return;
      }

      const numero = Number(valorDigitado.replace(",", "."));

      if (isNaN(numero) || numero < 0) {
        mostrarAlerta("Erro", "Digite um número válido.");
        return;
      }

      const usuarioUsers = await buscarDocumentoPorEmailEmColecao("users", email);
      const usuarioUsuarios = await buscarDocumentoPorEmailEmColecao(
        "usuarios",
        email
      );

      if (!usuarioUsers && !usuarioUsuarios) {
        mostrarAlerta("Erro", "Usuário não encontrado no Firebase.");
        return;
      }

      const base = usuarioUsers?.data || usuarioUsuarios?.data || {};
      const uidBase =
        String(base.uid || usuarioUsers?.id || usuarioUsuarios?.id || "") || "";
      const nomeBase = base.nome || base.name || "Usuário";
      const emailBase = base.email || email;
      const emailLower = normalizarEmail(emailBase);

      const dadosAtualizados = {
        uid: uidBase,
        nome: nomeBase,
        email: emailBase,
        emailLower,
        saldo: numero,
        atualizadoEm: serverTimestamp(),
      };

      const batch = writeBatch(db);

      if (usuarioUsers) {
        batch.set(usuarioUsers.ref, dadosAtualizados, { merge: true });
      } else if (uidBase) {
        batch.set(doc(db, "users", uidBase), dadosAtualizados, {
          merge: true,
        });
      }

      if (usuarioUsuarios) {
        batch.set(usuarioUsuarios.ref, dadosAtualizados, { merge: true });
      } else if (uidBase) {
        batch.set(doc(db, "usuarios", uidBase), dadosAtualizados, {
          merge: true,
        });
      }

      await batch.commit();
      await carregarUsuarios();

      setSaldosEditados({
        ...saldosEditados,
        [email]: "",
      });

      mostrarAlerta("Saldo atualizado", `Novo saldo: ${numero} BRL`);
    } catch (error) {
      console.log("Erro ao salvar saldo:", error);
      mostrarAlerta("Erro", "Não foi possível salvar o saldo.");
    }
  }

  async function buscarUsuarioPorEmail(email: string) {
    const usuarioUsers = await buscarDocumentoPorEmailEmColecao("users", email);
    const usuarioUsuarios = await buscarDocumentoPorEmailEmColecao(
      "usuarios",
      email
    );

    if (!usuarioUsers && !usuarioUsuarios) return null;

    const dadosUsers = usuarioUsers?.data || {};
    const dadosUsuarios = usuarioUsuarios?.data || {};

    const saldoUsers = Number(dadosUsers.saldo || 0);
    const saldoUsuarios = Number(dadosUsuarios.saldo || 0);

    const vitoriasUsers = Number(dadosUsers.vitoriasBolao || 0);
    const vitoriasUsuarios = Number(dadosUsuarios.vitoriasBolao || 0);

    const id =
      String(
        dadosUsers.uid ||
          dadosUsuarios.uid ||
          usuarioUsers?.id ||
          usuarioUsuarios?.id ||
          ""
      ) || "";

    const dadosCombinados = {
      ...dadosUsers,
      ...dadosUsuarios,
      uid: id,
      email: dadosUsers.email || dadosUsuarios.email || email,
      emailLower: normalizarEmail(
        dadosUsers.email || dadosUsuarios.email || email
      ),
      nome: dadosUsers.nome || dadosUsuarios.nome || "Usuário",
      saldo: Math.max(saldoUsers, saldoUsuarios),
      vitoriasBolao: Math.max(vitoriasUsers, vitoriasUsuarios),
    };

    return {
      id,
      ref: usuarioUsers?.ref || usuarioUsuarios?.ref,
      refUsers: usuarioUsers?.ref || (id ? doc(db, "users", id) : null),
      refUsuarios:
        usuarioUsuarios?.ref || (id ? doc(db, "usuarios", id) : null),
      data: dadosCombinados as any,
    };
  }

  function verificarVencedor(
    palpiteCasa: number,
    palpiteFora: number,
    resultadoCasa: number,
    resultadoFora: number
  ) {
    const vencedorPalpite =
      palpiteCasa > palpiteFora
        ? "casa"
        : palpiteCasa < palpiteFora
        ? "fora"
        : "empate";

    const vencedorReal =
      resultadoCasa > resultadoFora
        ? "casa"
        : resultadoCasa < resultadoFora
        ? "fora"
        : "empate";

    return vencedorPalpite === vencedorReal;
  }

  function marcarProcessando(jogoId: string, valor: boolean) {
    if (valor) {
      processandoRef.current.add(jogoId);
    } else {
      processandoRef.current.delete(jogoId);
    }

    setProcessandoIds((prev) => ({
      ...prev,
      [jogoId]: valor,
    }));
  }

  async function calcularVencedoresJogo(
    jogo: JogoMonitorado,
    automatico = false
  ) {
    try {
      if (processandoRef.current.has(jogo.id)) return;

      marcarProcessando(jogo.id, true);

      const resultadoRef = doc(db, "resultados", jogo.id);
      const resultadoSnap = await getDoc(resultadoRef);

      if (resultadoSnap.exists() && resultadoSnap.data().processado) {
        setResultadosPorJogo((prev) => ({
          ...prev,
          [jogo.id]: resultadoSnap.data() as ResultadoProcessado,
        }));

        if (!automatico) {
          mostrarAlerta(
            "Resultado já processado",
            "Esse jogo já teve os vencedores calculados."
          );
        }

        return;
      }

      const golsCasa = automatico
        ? Number(jogo.placarCasa)
        : Number(pegarResultadoManual(jogo, "casa"));

      const golsFora = automatico
        ? Number(jogo.placarFora)
        : Number(pegarResultadoManual(jogo, "fora"));

      if (isNaN(golsCasa) || isNaN(golsFora)) {
        mostrarAlerta("Erro", "Digite o resultado oficial corretamente.");
        return;
      }

      const apostasRef = collection(db, "apostas");
      const q = query(apostasRef, where("jogoId", "==", jogo.id));
      const snapshot = await getDocs(q);

      const apostas: Aposta[] = snapshot.docs.map((documento) => {
        const data = documento.data();

        return {
          id: documento.id,
          nome: data.nome || "Usuário",
          email: data.email || "",
          emailLower:
            data.emailLower || data.email?.toLowerCase() || "",
          jogo: data.jogo || jogo.jogo,
          placar: data.placar || "",
          golsCasa: Number(data.golsCasa || 0),
          golsFora: Number(data.golsFora || 0),
          valor: Number(data.valor || VALOR_APOSTA),
          criadoEm: data.criadoEm,
          atualizadoEm: data.atualizadoEm,
        };
      });

      const totalArrecadadoFinal = apostas.reduce((total, item) => {
        return total + Number(item.valor || VALOR_APOSTA);
      }, 0);

      const taxaAdminFinal = totalArrecadadoFinal * TAXA_ADMIN;
      const premioLiquidoFinal = totalArrecadadoFinal - taxaAdminFinal;

      const vencedoresExatos = apostas.filter((aposta) => {
        return aposta.golsCasa === golsCasa && aposta.golsFora === golsFora;
      });

      const premioPorVencedor =
        vencedoresExatos.length > 0
          ? premioLiquidoFinal / vencedoresExatos.length
          : 0;

      const rankingBase = apostas.map((aposta) => {
        const acertouPlacar =
          aposta.golsCasa === golsCasa && aposta.golsFora === golsFora;

        const acertouVencedor = verificarVencedor(
          aposta.golsCasa,
          aposta.golsFora,
          golsCasa,
          golsFora
        );

        const pontos = acertouPlacar ? 10 : acertouVencedor ? 3 : 0;
        const venceu = acertouPlacar;
        const premio = venceu ? premioPorVencedor : 0;

        return {
          nome: aposta.nome,
          email: aposta.email,
          emailLower: aposta.emailLower,
          jogo: aposta.jogo,
          placar: aposta.placar,
          golsCasa: aposta.golsCasa,
          golsFora: aposta.golsFora,
          acertouPlacar,
          acertouVencedor,
          pontos,
          venceu,
          premio,
        };
      });

      rankingBase.sort((a, b) => {
        if (b.pontos !== a.pontos) return b.pontos - a.pontos;
        return a.nome.localeCompare(b.nome);
      });

      const rankingCompleto: any[] = [];
      const ganhadoresDetalhados: any[] = [];

      for (const item of rankingBase) {
        const usuarioInfo = await buscarUsuarioPorEmail(item.email);

        const saldoAnterior = Number(usuarioInfo?.data?.saldo || 0);
        const vitoriasAntes = Number(usuarioInfo?.data?.vitoriasBolao || 0);

        const saldoAtual = item.venceu
          ? saldoAnterior + item.premio
          : saldoAnterior;

        const vitoriasDepois = item.venceu
          ? vitoriasAntes + 1
          : vitoriasAntes;

        if (item.venceu && usuarioInfo) {
          const dadosPremio = {
            uid: usuarioInfo.id,
            nome: item.nome || usuarioInfo.data.nome || "Usuário",
            email: item.email || usuarioInfo.data.email || "",
            emailLower:
              item.emailLower ||
              normalizarEmail(item.email || usuarioInfo.data.email || ""),
            saldo: saldoAtual,
            vitoriasBolao: vitoriasDepois,
            atualizadoEm: serverTimestamp(),
          };

          if (usuarioInfo.refUsers) {
            await setDoc(usuarioInfo.refUsers, dadosPremio, { merge: true });
          }

          if (usuarioInfo.refUsuarios) {
            await setDoc(usuarioInfo.refUsuarios, dadosPremio, {
              merge: true,
            });
          }
        }

        const controle = {
          ...item,
          saldoAnterior,
          saldoAtual,
          vitoriasAntes,
          vitoriasDepois,
          premioRecebido: item.premio,
          usuarioEncontrado: Boolean(usuarioInfo),
        };

        rankingCompleto.push(controle);

        if (item.venceu) {
          ganhadoresDetalhados.push(controle);
        }

        const emailSeguro = item.email
          .toLowerCase()
          .replace(/[\/\\.#$[\]]/g, "_");

        const notificacaoId = `${jogo.id}_${emailSeguro}`;

        await setDoc(doc(db, "notificacoes", notificacaoId), {
          jogoId: jogo.id,
          jogo: jogo.jogo,
          nome: item.nome,
          email: item.email,
          emailLower: item.emailLower,
          placar: item.placar,
          resultadoOficial: `${jogo.timeCasa.sigla} ${golsCasa} x ${golsFora} ${jogo.timeFora.sigla}`,
          venceu: item.venceu,
          pontos: item.pontos,
          premio: item.premio,
          saldoAnterior,
          saldoAtual,
          vitoriasAntes,
          vitoriasDepois,
          mensagem: item.venceu
            ? `🎉 Você venceu ${formatarMoeda(item.premio)}!`
            : "😢 Você não venceu este bolão.",
          criadoEm: serverTimestamp(),
        });
      }

      const relatorio: ResultadoProcessado = {
        jogoId: jogo.id,
        jogo: jogo.jogo,
        processado: true,
        resultadoOficial: {
          golsCasa,
          golsFora,
          placar: `${jogo.timeCasa.sigla} ${golsCasa} x ${golsFora} ${jogo.timeFora.sigla}`,
        },
        totalPalpites: apostas.length,
        totalArrecadado: totalArrecadadoFinal,
        taxaAdmin: taxaAdminFinal,
        premioLiquido: premioLiquidoFinal,
        quantidadeGanhadores: ganhadoresDetalhados.length,
        premioPorVencedor,
        ganhadores: ganhadoresDetalhados,
        ranking: rankingCompleto,
        modoProcessamento: automatico ? "automático" : "manual",
        processadoEmTexto: new Date().toLocaleString("pt-BR"),
      };

      await setDoc(
        resultadoRef,
        {
          ...relatorio,
          processadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "status_apostas", jogo.id),
        {
          aberta: false,
          encerrado: true,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true }
      );

      await carregarUsuarios();

      setResultadosPorJogo((prev) => ({
        ...prev,
        [jogo.id]: relatorio,
      }));

      if (!automatico) {
        mostrarAlerta(
          "Resultado calculado",
          `Jogo: ${jogo.jogo}\nResultado: ${
            relatorio.resultadoOficial.placar
          }\n\nTotal: ${formatarMoeda(
            totalArrecadadoFinal
          )}\nTaxa admin: ${formatarMoeda(
            taxaAdminFinal
          )}\nPrêmio líquido: ${formatarMoeda(
            premioLiquidoFinal
          )}\n\nGanhadores: ${
            ganhadoresDetalhados.length
          }\nPrêmio por vencedor: ${formatarMoeda(premioPorVencedor)}`
        );
      }
    } catch (error) {
      console.log("Erro ao calcular vencedores:", error);
      mostrarAlerta("Erro", "Não foi possível calcular os vencedores.");
    } finally {
      marcarProcessando(jogo.id, false);
    }
  }

  async function alterarStatusAposta(jogo: JogoMonitorado, aberta: boolean) {
    try {
      await setDoc(
        doc(db, "status_apostas", jogo.id),
        {
          aberta,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true }
      );

      setJogos((prev) =>
        prev.map((item) =>
          item.id === jogo.id ? { ...item, apostasAbertas: aberta } : item
        )
      );

      mostrarAlerta(
        aberta ? "Apostas abertas" : "Apostas fechadas",
        `${jogo.jogo}`
      );
    } catch (error) {
      console.log("Erro ao alterar status:", error);
      mostrarAlerta("Erro", "Não foi possível alterar o status da aposta.");
    }
  }

  async function zerarDadosJogo(jogo: JogoMonitorado) {
    try {
      const batch = writeBatch(db);

      const apostasRef = collection(db, "apostas");
      const qApostas = query(apostasRef, where("jogoId", "==", jogo.id));
      const apostasSnapshot = await getDocs(qApostas);

      apostasSnapshot.docs.forEach((documento) => {
        batch.delete(doc(db, "apostas", documento.id));
      });

      const notificacoesRef = collection(db, "notificacoes");
      const qNotificacoes = query(
        notificacoesRef,
        where("jogoId", "==", jogo.id)
      );
      const notificacoesSnapshot = await getDocs(qNotificacoes);

      notificacoesSnapshot.docs.forEach((documento) => {
        batch.delete(doc(db, "notificacoes", documento.id));
      });

      batch.delete(doc(db, "resultados", jogo.id));

      await batch.commit();

      mostrarAlerta(
        "Sucesso",
        "Palpites, notificações e resultado desse jogo foram apagados."
      );
    } catch (error) {
      console.log("Erro ao zerar jogo:", error);
      mostrarAlerta("Erro", "Não foi possível zerar os dados do jogo.");
    }
  }

  function confirmarZerarDadosJogo(jogo: JogoMonitorado) {
    mostrarConfirmacao(
      "Zerar jogo",
      `Deseja apagar palpites, notificações e resultado de ${jogo.jogo}? Isso não desfaz pagamentos já realizados.`,
      () => zerarDadosJogo(jogo)
    );
  }

  async function zerarPalpiteUsuarioNoJogo(jogo: JogoMonitorado, email: string) {
    try {
      const apostasRef = collection(db, "apostas");

      const q = query(
        apostasRef,
        where("jogoId", "==", jogo.id),
        where("emailLower", "==", email.toLowerCase())
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        mostrarAlerta("Sem palpite", "Esse usuário não possui palpite salvo.");
        return;
      }

      const batch = writeBatch(db);

      snapshot.docs.forEach((documento) => {
        batch.delete(doc(db, "apostas", documento.id));
      });

      await batch.commit();

      mostrarAlerta("Sucesso", "Palpite apagado.");
    } catch (error) {
      console.log("Erro ao apagar palpite:", error);
      mostrarAlerta("Erro", "Não foi possível apagar o palpite.");
    }
  }

  function confirmarZerarPalpiteUsuarioNoJogo(
    jogo: JogoMonitorado,
    aposta: Aposta
  ) {
    mostrarConfirmacao(
      "Apagar palpite",
      `Deseja apagar o palpite de ${aposta.nome} em ${jogo.jogo}?`,
      () => zerarPalpiteUsuarioNoJogo(jogo, aposta.email)
    );
  }

  async function liberarUsuario(email: string) {
    const usuariosRef = collection(db, "users");
    const q = query(usuariosRef, where("emailLower", "==", email.toLowerCase()));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      mostrarAlerta("Erro", "Usuário não encontrado.");
      return;
    }

    const usuarioDoc = snapshot.docs[0];

    await updateDoc(doc(db, "users", usuarioDoc.id), {
      banido: false,
    });
  }

  async function alternarBanimento(
    email: string,
    nome: string,
    banido: boolean
  ) {
    if (banido) {
      await liberarUsuario(email);
      await carregarUsuarios();
      mostrarAlerta("Usuário liberado", `${nome} foi desbanido.`);
      return;
    }

    mostrarConfirmacao("Banir usuário", `Deseja banir ${nome}?`, async () => {
      await banirUsuario(email);
      await carregarUsuarios();
      mostrarAlerta("Usuário banido", `${nome} foi banido.`);
    });
  }

  function resumoFinanceiroJogo(jogoId: string) {
    const apostas = apostasPorJogo[jogoId] || [];

    const totalArrecadado = apostas.reduce((total, item) => {
      return total + Number(item.valor || VALOR_APOSTA);
    }, 0);

    const taxaAdmin = totalArrecadado * TAXA_ADMIN;
    const premioLiquido = totalArrecadado - taxaAdmin;

    return {
      totalPalpites: apostas.length,
      totalArrecadado,
      taxaAdmin,
      premioLiquido,
    };
  }

  function renderRelatorio(resultado: ResultadoProcessado) {
    return (
      <View style={styles.reportCard}>
        <Text style={styles.reportTitle}>Relatório do resultado</Text>

        <Text style={styles.reportLine}>
          <Text style={styles.reportLabel}>Jogo: </Text>
          <Text style={styles.reportValue}>{resultado.jogo}</Text>
        </Text>

        <Text style={styles.reportLine}>
          <Text style={styles.reportLabel}>Resultado oficial: </Text>
          <Text style={styles.reportValue}>
            {resultado.resultadoOficial?.placar}
          </Text>
        </Text>

        <Text style={styles.reportLine}>
          <Text style={styles.reportLabel}>Processamento: </Text>
          <Text style={styles.reportValue}>
            {resultado.modoProcessamento} • {resultado.processadoEmTexto}
          </Text>
        </Text>

        <View style={styles.reportDivider} />

        <Text style={styles.reportLine}>
          <Text style={styles.reportLabel}>Palpites: </Text>
          <Text style={styles.reportValue}>{resultado.totalPalpites}</Text>
        </Text>

        <Text style={styles.reportLine}>
          <Text style={styles.reportLabel}>Total arrecadado: </Text>
          <Text style={styles.reportValue}>
            {formatarMoeda(resultado.totalArrecadado)}
          </Text>
        </Text>

        <Text style={styles.reportLine}>
          <Text style={styles.reportLabel}>Taxa admin: </Text>
          <Text style={styles.reportValue}>
            {formatarMoeda(resultado.taxaAdmin)}
          </Text>
        </Text>

        <Text style={styles.reportLine}>
          <Text style={styles.reportLabel}>Prêmio líquido: </Text>
          <Text style={styles.reportValue}>
            {formatarMoeda(resultado.premioLiquido)}
          </Text>
        </Text>

        <Text style={styles.reportLine}>
          <Text style={styles.reportLabel}>Ganhadores: </Text>
          <Text style={styles.reportValue}>
            {resultado.quantidadeGanhadores}
          </Text>
        </Text>

        <Text style={styles.reportLine}>
          <Text style={styles.reportLabel}>Prêmio por ganhador: </Text>
          <Text style={styles.reportValue}>
            {formatarMoeda(resultado.premioPorVencedor)}
          </Text>
        </Text>

        <View style={styles.reportDivider} />

        <Text style={styles.reportTitle}>Ganhadores detalhados</Text>

        {resultado.ganhadores?.length === 0 && (
          <View style={styles.noWinnerBox}>
            <Text style={styles.noWinnerText}>
              Nenhum usuário acertou o placar exato.
            </Text>
          </View>
        )}

        {resultado.ganhadores?.map((ganhador, index) => (
          <View style={styles.winnerCard} key={`${ganhador.email}-${index}`}>
            <View style={styles.winnerTop}>
              <Text style={styles.winnerName}>{ganhador.nome}</Text>
              <Text style={styles.winnerBadge}>
                +{formatarMoeda(ganhador.premioRecebido)}
              </Text>
            </View>

            <Text style={styles.winnerInfo}>Email: {ganhador.email}</Text>
            <Text style={styles.winnerInfo}>Palpite: {ganhador.placar}</Text>
            <Text style={styles.winnerInfo}>
              Saldo anterior: {formatarMoeda(ganhador.saldoAnterior)}
            </Text>
            <Text style={styles.winnerInfo}>
              Saldo atual: {formatarMoeda(ganhador.saldoAtual)}
            </Text>
            <Text style={styles.winnerInfo}>
              Vitórias antes: {ganhador.vitoriasAntes} • Agora:{" "}
              {ganhador.vitoriasDepois}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  function renderCabecalhoSecao(
    secao: "jogos" | "usuarios",
    icone: string,
    titulo: string,
    subtitulo: string
  ) {
    const aberta = secoesAbertas[secao];

    return (
      <TouchableOpacity
        style={styles.sectionToggle}
        onPress={() => alternarSecao(secao)}
        activeOpacity={0.85}
      >
        <View style={styles.sectionToggleLeft}>
          <Text style={styles.sectionToggleIcon}>{icone}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionToggleTitle}>{titulo}</Text>
            <Text style={styles.sectionToggleSub}>{subtitulo}</Text>
          </View>
        </View>

        <Text style={styles.sectionToggleArrow}>{aberta ? "▲" : "▼"}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/")}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Painel Admin</Text>

        <Text style={styles.adminIcon}>🛡️</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroBadge}>ADMINISTRADOR</Text>
          <Text style={styles.heroTitle}>Controle multi-jogos</Text>
          <Text style={styles.heroText}>
            Painel organizado por seções. Abra apenas a parte que deseja
            gerenciar.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statNumber}>{usuariosComuns.length}</Text>
            <Text style={styles.statLabel}>usuários</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⚽</Text>
            <Text style={styles.statNumber}>{jogos.length}</Text>
            <Text style={styles.statLabel}>jogos 48h</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={styles.statNumber}>{totalPalpitesGeral}</Text>
            <Text style={styles.statLabel}>palpites</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🪙</Text>
            <Text style={styles.statNumber}>
              {totalArrecadadoGeral.toFixed(0)}
            </Text>
            <Text style={styles.statLabel}>BRL total</Text>
          </View>
        </View>

        {renderCabecalhoSecao(
          "jogos",
          "⚽",
          "Jogos monitorados",
          `${jogos.length} jogo(s) nas próximas 48 horas`
        )}

        {secoesAbertas.jogos && (
          <View style={styles.sectionContent}>
            {carregandoJogos && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  Carregando jogos oficiais...
                </Text>
              </View>
            )}

            {!carregandoJogos && jogos.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  Nenhum jogo encontrado nas próximas 48 horas.
                </Text>
              </View>
            )}

            {jogos.map((jogo) => {
              const financeiro = resumoFinanceiroJogo(jogo.id);
              const apostas = apostasPorJogo[jogo.id] || [];
              const resultado = resultadosPorJogo[jogo.id];
              const processando = Boolean(processandoIds[jogo.id]);

              return (
                <View style={styles.gameCard} key={jogo.id}>
                  <View style={styles.gameHeader}>
                    <Text style={styles.gameLabel}>Jogo monitorado</Text>

                    <View
                      style={[
                        styles.gameStatusBadge,
                        jogo.statusRaw === "in" && styles.statusLive,
                        jogo.statusRaw === "post" && styles.statusFinished,
                      ]}
                    >
                      <Text style={styles.gameStatusText}>
                        {jogo.statusBR}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.matchTitle}>{jogo.jogo}</Text>

                  <Text style={styles.scoreLive}>
                    {jogo.timeCasa.sigla} {jogo.placarCasa} x{" "}
                    {jogo.placarFora} {jogo.timeFora.sigla}
                  </Text>

                  <View style={styles.timerBox}>
                    <Text style={styles.timerTitle}>Tempo do bolão</Text>
                    <Text style={styles.timerMain}>
                      {textoTempoPrincipal(jogo)}
                    </Text>
                    <Text style={styles.timerSub}>
                      {jogo.data} às {jogo.horario} • Atualiza a cada 60
                      segundos
                    </Text>
                  </View>

                  <View style={styles.infoGrid}>
                    <View style={styles.infoMini}>
                      <Text style={styles.infoMiniNumber}>
                        {jogo.apostasAbertas ? "Aberto" : "Fechado"}
                      </Text>
                      <Text style={styles.infoMiniLabel}>apostas</Text>
                    </View>

                    <View style={styles.infoMini}>
                      <Text style={styles.infoMiniNumber}>
                        {financeiro.totalPalpites}
                      </Text>
                      <Text style={styles.infoMiniLabel}>palpites</Text>
                    </View>
                  </View>

                  <View style={styles.financeBox}>
                    <Text style={styles.financeText}>
                      Total: {formatarMoeda(financeiro.totalArrecadado)}
                    </Text>
                    <Text style={styles.financeText}>
                      Taxa admin 20%: {formatarMoeda(financeiro.taxaAdmin)}
                    </Text>
                    <Text style={styles.financeTextStrong}>
                      Prêmio líquido: {formatarMoeda(financeiro.premioLiquido)}
                    </Text>
                  </View>

                  <View style={styles.resultRow}>
                    <TextInput
                      style={styles.resultInput}
                      placeholder={jogo.timeCasa.sigla}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={pegarResultadoManual(jogo, "casa")}
                      onChangeText={(valor) =>
                        alterarResultadoManual(jogo.id, "casa", valor)
                      }
                    />

                    <Text style={styles.resultX}>X</Text>

                    <TextInput
                      style={styles.resultInput}
                      placeholder={jogo.timeFora.sigla}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={pegarResultadoManual(jogo, "fora")}
                      onChangeText={(valor) =>
                        alterarResultadoManual(jogo.id, "fora", valor)
                      }
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.calculateButton,
                      processando && styles.disabledButton,
                    ]}
                    disabled={processando}
                    onPress={() => calcularVencedoresJogo(jogo, false)}
                  >
                    <Text style={styles.calculateButtonText}>
                      {processando
                        ? "Calculando..."
                        : "🏆 Calcular vencedores manualmente"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.smallActionButton,
                        jogo.apostasAbertas && styles.closeButton,
                      ]}
                      onPress={() =>
                        alterarStatusAposta(jogo, !jogo.apostasAbertas)
                      }
                    >
                      <Text style={styles.smallActionText}>
                        {jogo.apostasAbertas
                          ? "Fechar aposta"
                          : "Abrir aposta"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.smallActionButton, styles.resetSmallButton]}
                      onPress={() => confirmarZerarDadosJogo(jogo)}
                    >
                      <Text style={styles.resetSmallText}>Zerar jogo</Text>
                    </TouchableOpacity>
                  </View>

                  {resultado && renderRelatorio(resultado)}

                  <Text style={styles.subSectionTitle}>Palpites recebidos</Text>

                  {apostas.length === 0 && (
                    <View style={styles.noWinnerBox}>
                      <Text style={styles.noWinnerText}>
                        Nenhum palpite neste jogo ainda.
                      </Text>
                    </View>
                  )}

                  {apostas.map((aposta) => (
                    <View style={styles.betMiniCard} key={aposta.id}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.betMiniName}>{aposta.nome}</Text>
                        <Text style={styles.betMiniText}>
                          Palpite: {aposta.placar} • {aposta.valor} BRL
                        </Text>
                        <Text style={styles.betMiniText}>{aposta.email}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.deleteMiniButton}
                        onPress={() =>
                          confirmarZerarPalpiteUsuarioNoJogo(jogo, aposta)
                        }
                      >
                        <Text style={styles.deleteMiniText}>Apagar</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {renderCabecalhoSecao(
          "usuarios",
          "👥",
          "Usuários cadastrados",
          `${usuariosComuns.length} usuário(s) comuns`
        )}

        {secoesAbertas.usuarios && (
          <View style={styles.sectionContent}>
            {usuariosComuns.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  Nenhum usuário comum cadastrado ainda.
                </Text>
              </View>
            )}

            {usuariosComuns.map((item: any) => (
              <View
                style={[styles.userCard, item.banido && styles.userCardBanned]}
                key={item.email}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {String(item.nome || "U").charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.userInfo}>
                  <View style={styles.userTopRow}>
                    <Text style={styles.userName}>{item.nome}</Text>

                    <View
                      style={[
                        styles.statusBadge,
                        item.banido ? styles.statusBanned : styles.statusActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          item.banido
                            ? styles.statusTextBanned
                            : styles.statusTextActive,
                        ]}
                      >
                        {item.banido ? "BANIDO" : "ATIVO"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.userEmail}>{item.email}</Text>

                  <View style={styles.balanceBadge}>
                    <Text style={styles.balanceBadgeText}>
                      Saldo: {formatarMoeda(pegarSaldoVisual(item))}
                    </Text>
                  </View>

                  <TextInput
                    style={styles.input}
                    placeholder="Novo saldo"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={saldosEditados[item.email] || ""}
                    onChangeText={(valor) =>
                      alterarSaldoCampo(item.email, valor)
                    }
                  />

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={() => salvarSaldo(item.email)}
                  >
                    <Text style={styles.saveButtonText}>Salvar saldo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.banButton,
                      item.banido && styles.unbanButton,
                    ]}
                    onPress={() =>
                      alternarBanimento(
                        item.email,
                        item.nome,
                        Boolean(item.banido)
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.banButtonText,
                        item.banido && styles.unbanButtonText,
                      ]}
                    >
                      {item.banido ? "Liberar usuário" : "Banir usuário"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Importante</Text>
          <Text style={styles.warningText}>
            O cálculo automático funciona enquanto o painel admin estiver
            aberto. Quando um jogo finalizar na ESPN, o sistema processa o
            resultado, paga os ganhadores, fecha a aposta e salva o relatório.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F6F4" },

  header: {
    backgroundColor: "#111827",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },

  back: { color: "#FFFFFF", fontSize: 34, fontWeight: "900" },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  adminIcon: { fontSize: 26 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  heroCard: {
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 22,
    elevation: 4,
  },

  heroBadge: {
    color: "#FFD500",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
  },

  heroTitle: { color: "#FFFFFF", fontSize: 27, fontWeight: "900" },

  heroText: {
    color: "#D1D5DB",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    lineHeight: 21,
  },

  statsRow: { flexDirection: "row", marginTop: 18 },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    marginHorizontal: 4,
    elevation: 3,
  },

  statIcon: { fontSize: 30 },

  statNumber: {
    color: "#111827",
    fontSize: 31,
    fontWeight: "900",
    marginTop: 6,
  },

  statLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  sectionToggle: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginTop: 20,
    marginBottom: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  sectionToggleIcon: {
    fontSize: 28,
    marginRight: 12,
  },

  sectionToggleTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },

  sectionToggleSub: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  sectionToggleArrow: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginLeft: 10,
  },

  sectionContent: {
    marginBottom: 6,
  },

  subSectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 18,
    marginBottom: 10,
  },

  gameCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  gameHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  gameLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  gameStatusBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },

  statusLive: {
    backgroundColor: "#FEE2E2",
  },

  statusFinished: {
    backgroundColor: "#E5E7EB",
  },

  gameStatusText: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "900",
  },

  matchTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 12,
  },

  scoreLive: {
    color: "#006B2E",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
  },

  timerBox: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 15,
    marginTop: 15,
  },

  timerTitle: {
    color: "#FFD500",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 5,
  },

  timerMain: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
  },

  timerSub: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 18,
  },

  infoGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  infoMini: {
    flex: 1,
    backgroundColor: "#F3F6F4",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },

  infoMiniNumber: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },

  infoMiniLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },

  financeBox: {
    backgroundColor: "#FFF6BF",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FFD500",
  },

  financeText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },

  financeTextStrong: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },

  resultInput: {
    flex: 1,
    backgroundColor: "#F3F6F4",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    fontSize: 15,
    color: "#111827",
    fontWeight: "900",
    textAlign: "center",
  },

  resultX: {
    marginHorizontal: 12,
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },

  calculateButton: {
    backgroundColor: "#16A34A",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },

  disabledButton: {
    backgroundColor: "#9CA3AF",
  },

  calculateButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  actionsRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 8,
  },

  smallActionButton: {
    flex: 1,
    backgroundColor: "#E7FBEF",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },

  closeButton: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },

  smallActionText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900",
  },

  resetSmallButton: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },

  resetSmallText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "900",
  },

  reportCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 18,
    padding: 15,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },

  reportTitle: {
    color: "#065F46",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },

  reportLine: {
    color: "#111827",
    fontSize: 14,
    marginTop: 5,
  },

  reportLabel: {
    color: "#374151",
    fontWeight: "900",
  },

  reportValue: {
    color: "#111827",
    fontWeight: "700",
  },

  reportDivider: {
    height: 1,
    backgroundColor: "#BBF7D0",
    marginVertical: 12,
  },

  winnerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },

  winnerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  winnerName: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
    flex: 1,
  },

  winnerBadge: {
    color: "#16A34A",
    fontSize: 13,
    fontWeight: "900",
    marginLeft: 8,
  },

  winnerInfo: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
  },

  noWinnerBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },

  noWinnerText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
  },

  betMiniCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  betMiniName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },

  betMiniText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  deleteMiniButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    marginLeft: 10,
  },

  deleteMiniText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "900",
  },

  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    elevation: 3,
  },

  userCardBanned: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#006B2E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  userInfo: { flex: 1 },

  userTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  userName: { color: "#111827", fontSize: 17, fontWeight: "900", flex: 1 },

  userEmail: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    marginLeft: 8,
  },

  statusActive: { backgroundColor: "#DCFCE7" },
  statusBanned: { backgroundColor: "#FEE2E2" },
  statusText: { fontSize: 10, fontWeight: "900" },
  statusTextActive: { color: "#166534" },
  statusTextBanned: { color: "#991B1B" },

  balanceBadge: {
    backgroundColor: "#E7FBEF",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 9,
  },

  balanceBadgeText: { color: "#006B2E", fontSize: 13, fontWeight: "900" },

  input: {
    backgroundColor: "#F3F6F4",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
    marginTop: 12,
  },

  saveButton: {
    backgroundColor: "#006B2E",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  saveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },

  banButton: {
    backgroundColor: "#111827",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },

  banButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },

  unbanButton: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },

  unbanButtonText: { color: "#166534" },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
  },

  emptyText: { color: "#6B7280", fontWeight: "700" },

  warningCard: {
    backgroundColor: "#FFF6BF",
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FFD500",
  },

  warningTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },

  warningText: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
  },

  blockedBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  blockedIcon: { fontSize: 55, marginBottom: 12 },
  blockedTitle: { fontSize: 25, fontWeight: "900", color: "#111827" },

  blockedText: {
    color: "#6B7280",
    fontSize: 15,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },

  backButton: {
    backgroundColor: "#006B2E",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
  },

  backButtonText: { color: "#FFFFFF", fontWeight: "900" },
});