import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../services/firebaseConfig";

const TOTAL_CASAS = 25;
const SALDO_FICTICIO_PADRAO = 0;
const BANCA_FICTICIA_PADRAO = 0;
const PERCENTUAL_RESERVA_BANCA = 0.25;
const APOSTA_PADRAO = 10;
const APOSTA_MINIMA = 1;
const APOSTA_MAXIMA = 100;
const MULTIPLICADOR_MAXIMO_GLOBAL = 23.33;

const MULTIPLICADORES_POR_MINAS: Record<number, number[]> = {
  2: [1.01, 1.08, 1.12, 1.18, 1.25, 1.33, 1.42, 1.5],
  5: [1.16, 1.3, 1.48, 1.7, 1.98, 2.35, 2.8],
  10: [1.55, 2.05, 2.8, 3.9, 5.4],
  15: [2.33, 3.8, 6.2, 10.5],
  24: [23.33],
};

const OPCOES_MINAS = [2, 5, 10, 15, 24];

type ResultadoCasa = "segura" | "mina";

type HistoricoItem = {
  id: string;
  nome?: string;
  resultado?: "sacou" | "perdeu";
  aposta?: number;
  pagamento?: number;
  ganhoLiquido?: number;
};

function arredondar(valor: number) {
  return Math.floor(Number(valor || 0) * 100) / 100;
}

function formatarSaldo(valor: number) {
  return arredondar(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function numeroValido(valor: any) {
  const numero = Number(valor);

  if (isNaN(numero)) {
    return null;
  }

  return numero;
}

function pegarSaldoBolao(dadosUsers?: any, dadosUsuarios?: any, userContext?: any) {
  // IMPORTANTE:
  // O saldo principal do app é o mesmo que aparece no Perfil.
  // O Perfil usa primeiro a coleção "usuarios".
  // Então o Mines também deve priorizar "usuarios" para não mostrar saldo antigo.
  const saldoUsuarios = numeroValido(dadosUsuarios?.saldo);

  if (saldoUsuarios !== null) {
    return Math.max(0, saldoUsuarios);
  }

  const saldoUsers = numeroValido(dadosUsers?.saldo);

  if (saldoUsers !== null) {
    return Math.max(0, saldoUsers);
  }

  const saldoContexto = numeroValido(userContext?.saldo);

  if (saldoContexto !== null) {
    return Math.max(0, saldoContexto);
  }

  return 0;
}

function dadosSaldoBolao(user: any, novoSaldo: number) {
  return {
    uid: user?.uid || "",
    nome: user?.nome || "Usuário",
    email: user?.email || "",
    emailLower: String(user?.email || "").toLowerCase(),
    saldo: novoSaldo,
    atualizadoEm: serverTimestamp(),
  };
}

function formatarMultiplicador(valor: number) {
  return `${Number(valor || 0).toFixed(2).replace(".", ",")}x`;
}

function pegarMultiplicadores(minas: number, tetoGlobal: number) {
  const tabela = MULTIPLICADORES_POR_MINAS[minas] || MULTIPLICADORES_POR_MINAS[2];
  return tabela.map((valor) => Math.min(Number(valor || 1), tetoGlobal));
}

function pegarMultiplicador(minas: number, casasSeguras: number, tetoGlobal: number) {
  if (casasSeguras <= 0) return 1;

  const tabela = pegarMultiplicadores(minas, tetoGlobal);
  const indice = casasSeguras - 1;

  if (tabela[indice] !== undefined) {
    return Number(tabela[indice]);
  }

  const ultimo = tabela[tabela.length - 1] || 1;
  const extra = Math.pow(1.18, indice - tabela.length + 1);
  return Math.min(arredondar(ultimo * extra), tetoGlobal);
}

function calcularGanho(aposta: number, minas: number, casasSeguras: number, tetoGlobal: number) {
  const multiplicador = pegarMultiplicador(minas, casasSeguras, tetoGlobal);
  return arredondar(aposta * multiplicador);
}

function calcularLimitePagamento(bancaFicticia: number, percentualReservaBanca: number) {
  const banca = Number(bancaFicticia || 0);
  const liberado = banca * (1 - percentualReservaBanca);
  return Math.max(0, arredondar(liberado));
}

function textoRisco(minas: number) {
  if (minas <= 2) return "Baixo";
  if (minas <= 5) return "Médio";
  if (minas <= 10) return "Alto";
  if (minas <= 15) return "Muito alto";
  return "Extremo";
}

export default function CassinoScreen() {
  const { user } = useAuth();

  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  const [saldoFicticio, setSaldoFicticio] = useState(SALDO_FICTICIO_PADRAO);
  const [bancaFicticia, setBancaFicticia] = useState(BANCA_FICTICIA_PADRAO);

  const [cassinoConfig, setCassinoConfig] = useState({
    ativo: true,
    apostaMinima: APOSTA_MINIMA,
    apostaMaxima: APOSTA_MAXIMA,
    multiplicadorMaximo: MULTIPLICADOR_MAXIMO_GLOBAL,
    percentualReservaBanca: PERCENTUAL_RESERVA_BANCA,
  });

  const [aposta, setAposta] = useState(APOSTA_PADRAO);
  const [apostaDaRodada, setApostaDaRodada] = useState(APOSTA_PADRAO);
  const [minas, setMinas] = useState(5);
  const [minasDaRodada, setMinasDaRodada] = useState(5);

  const [emJogo, setEmJogo] = useState(false);
  const [casasReveladas, setCasasReveladas] = useState<Record<number, ResultadoCasa>>({});
  const [casasSeguras, setCasasSeguras] = useState(0);
  const [ganhoAtual, setGanhoAtual] = useState(0);
  const [mensagem, setMensagem] = useState("Configure a rodada e comece a simulação.");
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  const minesAtivo = cassinoConfig.ativo !== false;
  const apostaMinimaConfig = Number(cassinoConfig.apostaMinima || APOSTA_MINIMA);
  const apostaMaximaConfig = Number(cassinoConfig.apostaMaxima || APOSTA_MAXIMA);
  const multiplicadorMaximoConfig = Number(
    cassinoConfig.multiplicadorMaximo || MULTIPLICADOR_MAXIMO_GLOBAL
  );
  const percentualReservaConfig = Number(
    cassinoConfig.percentualReservaBanca ?? PERCENTUAL_RESERVA_BANCA
  );

  const limitePagamentoAtual = useMemo(() => {
    return calcularLimitePagamento(bancaFicticia, percentualReservaConfig);
  }, [bancaFicticia, percentualReservaConfig]);

  const multiplicadorAtual = useMemo(() => {
    return pegarMultiplicador(minasDaRodada, casasSeguras, multiplicadorMaximoConfig);
  }, [minasDaRodada, casasSeguras, multiplicadorMaximoConfig]);

  const proximoMultiplicador = useMemo(() => {
    return pegarMultiplicador(minasDaRodada, casasSeguras + 1, multiplicadorMaximoConfig);
  }, [minasDaRodada, casasSeguras, multiplicadorMaximoConfig]);

  const saqueMaximoTeorico = useMemo(() => {
    const tabela = pegarMultiplicadores(minasDaRodada, multiplicadorMaximoConfig);
    const ultimo = tabela[tabela.length - 1] || multiplicadorMaximoConfig;
    return arredondar(apostaDaRodada * Math.min(ultimo, multiplicadorMaximoConfig));
  }, [apostaDaRodada, minasDaRodada, multiplicadorMaximoConfig]);

  const saqueDisponivel = useMemo(() => {
    return Math.min(ganhoAtual, limitePagamentoAtual, saqueMaximoTeorico);
  }, [ganhoAtual, limitePagamentoAtual, saqueMaximoTeorico]);

  const multiplicadoresSelecionados = useMemo(() => {
    return pegarMultiplicadores(minas, multiplicadorMaximoConfig);
  }, [minas, multiplicadorMaximoConfig]);

  useEffect(() => {
    if (!user?.uid) {
      setCarregando(false);
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const usuarioRef = doc(db, "usuarios", user.uid);
    const bancaRef = doc(db, "cassino_config", "mines10");

    let dadosUsers: any = null;
    let dadosUsuarios: any = null;
    let carregouUsers = false;
    let carregouUsuarios = false;

    function atualizarSaldoNaTela() {
      setSaldoFicticio(pegarSaldoBolao(dadosUsers, dadosUsuarios, user));

      if (carregouUsers || carregouUsuarios) {
        setCarregando(false);
      }
    }

    const unsubUsers = onSnapshot(
      userRef,
      (snapshot) => {
        dadosUsers = snapshot.exists() ? snapshot.data() : null;
        carregouUsers = true;
        atualizarSaldoNaTela();
      },
      (error) => {
        console.log("Erro ao carregar saldo do Bolão em users:", error);
        carregouUsers = true;
        atualizarSaldoNaTela();
      }
    );

    const unsubUsuarios = onSnapshot(
      usuarioRef,
      (snapshot) => {
        dadosUsuarios = snapshot.exists() ? snapshot.data() : null;
        carregouUsuarios = true;
        atualizarSaldoNaTela();
      },
      (error) => {
        console.log("Erro ao carregar saldo do Bolão em usuarios:", error);
        carregouUsuarios = true;
        atualizarSaldoNaTela();
      }
    );

    const unsubBanca = onSnapshot(
      bancaRef,
      (snapshot) => {
        const data = snapshot.data() || {};

        const configAtualizada = {
          ativo: data.ativo !== false,
          apostaMinima: Number(data.apostaMinima ?? APOSTA_MINIMA),
          apostaMaxima: Number(data.apostaMaxima ?? APOSTA_MAXIMA),
          multiplicadorMaximo: Number(data.multiplicadorMaximo ?? MULTIPLICADOR_MAXIMO_GLOBAL),
          percentualReservaBanca: Number(
            data.percentualReservaBanca ?? PERCENTUAL_RESERVA_BANCA
          ),
        };

        setCassinoConfig(configAtualizada);
        setBancaFicticia(Number(data.bancaFicticia ?? BANCA_FICTICIA_PADRAO));

        setAposta((valorAtual) => {
          const valor = Number(valorAtual || APOSTA_PADRAO);
          if (valor < configAtualizada.apostaMinima) return configAtualizada.apostaMinima;
          if (valor > configAtualizada.apostaMaxima) return configAtualizada.apostaMaxima;
          return valor;
        });
      },
      (error) => {
        console.log("Erro ao carregar configuração do Mines:", error);
      }
    );

    const qHistorico = query(
      collection(db, "cassino_historico"),
      orderBy("criadoEm", "desc"),
      limit(8)
    );

    const unsubHistorico = onSnapshot(
      qHistorico,
      (snapshot) => {
        setHistorico(
          snapshot.docs.map((documento) => ({
            id: documento.id,
            ...(documento.data() as any),
          }))
        );
      },
      (error) => {
        console.log("Erro ao carregar histórico do Mines:", error);
      }
    );

    return () => {
      unsubUsers();
      unsubUsuarios();
      unsubBanca();
      unsubHistorico();
    };
  }, [user?.uid]);

  function alterarAposta(valor: number) {
    if (emJogo) return;

    const novoValor = Math.max(
      apostaMinimaConfig,
      Math.min(apostaMaximaConfig, Math.floor(Number(valor || 0)))
    );

    setAposta(novoValor);
  }

  async function comecarJogo() {
    if (!user?.uid || emJogo || processando) return;

    if (!minesAtivo) {
      setMensagem("Mines 10 está desativado pelo admin no momento.");
      return;
    }

    if (aposta < apostaMinimaConfig || aposta > apostaMaximaConfig) {
      setMensagem(
        `A aposta precisa estar entre ${formatarSaldo(apostaMinimaConfig)} e ${formatarSaldo(apostaMaximaConfig)} saldo fictício.`
      );
      return;
    }

    setProcessando(true);

    try {
      const resultado = await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid!);
        const usuarioRef = doc(db, "usuarios", user.uid!);
        const bancaRef = doc(db, "cassino_config", "mines10");

        const userSnap = await transaction.get(userRef);
        const usuarioSnap = await transaction.get(usuarioRef);
        const bancaSnap = await transaction.get(bancaRef);

        if (!userSnap.exists() && !usuarioSnap.exists()) {
          throw new Error("Usuário não encontrado.");
        }

        const saldoAtual = pegarSaldoBolao(
          userSnap.exists() ? userSnap.data() : null,
          usuarioSnap.exists() ? usuarioSnap.data() : null,
          user
        );

        if (saldoAtual < aposta) {
          throw new Error("Saldo insuficiente.");
        }

        const dadosBanca = bancaSnap.exists() ? bancaSnap.data() : {};

        if (dadosBanca?.ativo === false) {
          throw new Error("Mines 10 está desativado pelo admin no momento.");
        }

        const apostaMinimaFirebase = Number(dadosBanca?.apostaMinima ?? apostaMinimaConfig);
        const apostaMaximaFirebase = Number(dadosBanca?.apostaMaxima ?? apostaMaximaConfig);
        const multiplicadorFirebase = Number(
          dadosBanca?.multiplicadorMaximo ?? multiplicadorMaximoConfig
        );
        const reservaFirebase = Number(
          dadosBanca?.percentualReservaBanca ?? percentualReservaConfig
        );

        if (aposta < apostaMinimaFirebase || aposta > apostaMaximaFirebase) {
          throw new Error(
            `A aposta precisa estar entre ${formatarSaldo(apostaMinimaFirebase)} e ${formatarSaldo(apostaMaximaFirebase)} saldo fictício.`
          );
        }

        const bancaAtual = Number(dadosBanca?.bancaFicticia ?? BANCA_FICTICIA_PADRAO);
        const novoSaldo = arredondar(saldoAtual - aposta);
        const novaBanca = arredondar(bancaAtual + aposta);

        transaction.set(
          userRef,
          dadosSaldoBolao(user, novoSaldo),
          { merge: true }
        );

        transaction.set(
          usuarioRef,
          dadosSaldoBolao(user, novoSaldo),
          { merge: true }
        );

        transaction.set(
          bancaRef,
          {
            ativo: true,
            bancaFicticia: novaBanca,
            apostaMinima: apostaMinimaFirebase,
            apostaMaxima: apostaMaximaFirebase,
            percentualReservaBanca: reservaFirebase,
            multiplicadorMaximo: multiplicadorFirebase,
            modo: "simulacao_controlada",
            atualizadoEm: serverTimestamp(),
          },
          { merge: true }
        );

        return {
          novaBanca,
          config: {
            ativo: true,
            apostaMinima: apostaMinimaFirebase,
            apostaMaxima: apostaMaximaFirebase,
            percentualReservaBanca: reservaFirebase,
            multiplicadorMaximo: multiplicadorFirebase,
          },
        };
      });

      setBancaFicticia(resultado.novaBanca);
      setCassinoConfig(resultado.config);
      setApostaDaRodada(aposta);
      setMinasDaRodada(minas);
      setCasasReveladas({});
      setCasasSeguras(0);
      setGanhoAtual(0);
      setEmJogo(true);
      setMensagem("Jogo iniciado. Escolha uma casa para revelar.");
    } catch (error: any) {
      setMensagem(error?.message || "Erro ao iniciar jogo.");
    } finally {
      setProcessando(false);
    }
  }

  async function registrarHistorico(
    resultado: "sacou" | "perdeu",
    pagamento: number,
    ganhoLiquido: number,
    motivo: string
  ) {
    try {
      await addDoc(collection(db, "cassino_historico"), {
        uid: user?.uid || "",
        nome: user?.nome || "Usuário",
        email: user?.email || "",
        jogo: "Mines 10 ",
        resultado,
        aposta: apostaDaRodada,
        pagamento,
        ganhoLiquido,
        minas: minasDaRodada,
        multiplicador: multiplicadorAtual,
        casasSeguras,
        motivo,
        aviso:
          ".",
        criadoEm: serverTimestamp(),
      });
    } catch (error) {
      console.log("Erro ao salvar histórico:", error);
    }
  }

  async function revelarCasa(indice: number) {
    if (!emJogo || processando) return;
    if (casasReveladas[indice]) return;

    const proximasCasasSeguras = casasSeguras + 1;
    const proximoGanho = calcularGanho(
      apostaDaRodada,
      minasDaRodada,
      proximasCasasSeguras,
      multiplicadorMaximoConfig
    );

    if (proximoGanho > limitePagamentoAtual) {
      setCasasReveladas({
        ...casasReveladas,
        [indice]: "mina",
      });
      setEmJogo(false);
      setGanhoAtual(0);
      setMensagem(`💣 Mina! Você perdeu ${formatarSaldo(apostaDaRodada)} saldo fictício.`);
      await registrarHistorico("perdeu", 0, -apostaDaRodada, "controle_interno_banca");
      return;
    }

    const casasRestantes = TOTAL_CASAS - Object.keys(casasReveladas).length;
    const chanceMina = Math.min(0.92, minasDaRodada / Math.max(casasRestantes, 1));
    const caiuMina = Math.random() < chanceMina;

    if (caiuMina) {
      setCasasReveladas({
        ...casasReveladas,
        [indice]: "mina",
      });
      setEmJogo(false);
      setGanhoAtual(0);
      setMensagem(`💣 Mina! Você perdeu ${formatarSaldo(apostaDaRodada)} saldo fictício.`);
      await registrarHistorico("perdeu", 0, -apostaDaRodada, "mina_probabilidade");
      return;
    }

    setCasasReveladas({
      ...casasReveladas,
      [indice]: "segura",
    });

    setCasasSeguras(proximasCasasSeguras);
    setGanhoAtual(proximoGanho);

    const saqueProtegido = Math.min(proximoGanho, limitePagamentoAtual, saqueMaximoTeorico);

    setMensagem(
      `💎 Casa segura. Multiplicador ${formatarMultiplicador(
        pegarMultiplicador(minasDaRodada, proximasCasasSeguras, multiplicadorMaximoConfig)
      )}. Saque disponível: ${formatarSaldo(saqueProtegido)} saldo fictício.`
    );
  }

  async function sacar() {
    if (!user?.uid || !emJogo || processando) return;

    if (saqueDisponivel <= 0) {
      setMensagem("Ainda não há saldo fictício disponível para sacar.");
      return;
    }

    setProcessando(true);

    try {
      const resultado = await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid!);
        const usuarioRef = doc(db, "usuarios", user.uid!);
        const bancaRef = doc(db, "cassino_config", "mines10");

        const userSnap = await transaction.get(userRef);
        const usuarioSnap = await transaction.get(usuarioRef);
        const bancaSnap = await transaction.get(bancaRef);

        if (!userSnap.exists() && !usuarioSnap.exists()) {
          throw new Error("Usuário não encontrado.");
        }

        const saldoAtual = pegarSaldoBolao(
          userSnap.exists() ? userSnap.data() : null,
          usuarioSnap.exists() ? usuarioSnap.data() : null,
          user
        );

        const bancaAtual = Number(
          bancaSnap.exists()
            ? bancaSnap.data().bancaFicticia ?? BANCA_FICTICIA_PADRAO
            : BANCA_FICTICIA_PADRAO
        );

        const percentualReservaBanca = Number(
          bancaSnap.exists()
            ? bancaSnap.data().percentualReservaBanca ?? percentualReservaConfig
            : percentualReservaConfig
        );

        const multiplicadorGlobalFirebase = Number(
          bancaSnap.exists()
            ? bancaSnap.data().multiplicadorMaximo ?? multiplicadorMaximoConfig
            : multiplicadorMaximoConfig
        );

        const limiteDaBanca = calcularLimitePagamento(bancaAtual, percentualReservaBanca);
        const tabela = pegarMultiplicadores(minasDaRodada, multiplicadorGlobalFirebase);
        const ultimoMultiplicador = tabela[tabela.length - 1] || multiplicadorGlobalFirebase;
        const saqueMaximoFirebase = arredondar(apostaDaRodada * ultimoMultiplicador);
        const pagamento = Math.min(ganhoAtual, saqueMaximoFirebase, limiteDaBanca);

        if (pagamento <= 0) {
          throw new Error("Saque indisponível nesta rodada.");
        }

        const novoSaldo = arredondar(saldoAtual + pagamento);
        const novaBanca = arredondar(bancaAtual - pagamento);

        transaction.set(
          userRef,
          dadosSaldoBolao(user, novoSaldo),
          { merge: true }
        );

        transaction.set(
          usuarioRef,
          dadosSaldoBolao(user, novoSaldo),
          { merge: true }
        );

        transaction.set(
          bancaRef,
          {
            bancaFicticia: novaBanca,
            atualizadoEm: serverTimestamp(),
          },
          { merge: true }
        );

        return { pagamento, novaBanca };
      });

      const lucroLiquido = arredondar(resultado.pagamento - apostaDaRodada);

      setBancaFicticia(resultado.novaBanca);
      setEmJogo(false);
      setGanhoAtual(0);
      setMensagem(
        `✅ Você sacou ${formatarSaldo(
          resultado.pagamento
        )} saldo fictício. Resultado líquido: ${formatarSaldo(lucroLiquido)}.`
      );

      await registrarHistorico("sacou", resultado.pagamento, lucroLiquido, "saque_usuario");
    } catch (error: any) {
      setMensagem(error?.message || "Não foi possível sacar.");
    } finally {
      setProcessando(false);
    }
  }

  function renderCasa(indice: number) {
    const resultado = casasReveladas[indice];

    return (
      <TouchableOpacity
        key={indice}
        activeOpacity={0.85}
        onPress={() => revelarCasa(indice)}
        disabled={!emJogo || Boolean(resultado) || processando}
        style={[
          styles.casa,
          resultado === "segura" && styles.casaSegura,
          resultado === "mina" && styles.casaMina,
        ]}
      >
        <Text style={styles.casaTexto}>
          {resultado === "segura" ? "💎" : resultado === "mina" ? "💣" : ""}
        </Text>
      </TouchableOpacity>
    );
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color="#F7C948" />
        <Text style={styles.loadingText}>Carregando Mines 10...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#06130D" />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.voltar} onPress={() => router.back()}>
            <Text style={styles.voltarTexto}>← Voltar</Text>
          </TouchableOpacity>

          <View>
            <Text style={styles.titulo}>💣 Mines 10</Text>
          </View>
        </View>

        {!minesAtivo && (
          <View style={styles.desativadoBox}>
            <Text style={styles.desativadoTitulo}>Mines 10 indisponível</Text>
            <Text style={styles.desativadoTexto}>
              O admin desativou novas rodadas no momento.
            </Text>
          </View>
        )}

        <View style={styles.resumos}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Saldo do Bolão</Text>
            <Text style={styles.cardValor}>{formatarSaldo(saldoFicticio)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Ganho atual</Text>
            <Text style={styles.cardValor}>{formatarSaldo(ganhoAtual)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Multiplicador</Text>
            <Text style={styles.cardValor}>{formatarMultiplicador(multiplicadorAtual)}</Text>
          </View>
        </View>

        <View style={styles.areaJogo}>
          <View style={styles.painel}>
            <Text style={styles.label}>Quantidade</Text>

            <View style={styles.inputFake}>
              <Text style={styles.inputTexto}>{formatarSaldo(aposta)}</Text>
            </View>

            <View style={styles.linhaBotoes}>
              <TouchableOpacity
                disabled={emJogo}
                style={[styles.botaoMenor, emJogo && styles.desativado]}
                onPress={() => alterarAposta(aposta / 2)}
              >
                <Text style={styles.botaoMenorTexto}>1/2</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={emJogo}
                style={[styles.botaoMenor, emJogo && styles.desativado]}
                onPress={() => alterarAposta(aposta * 2)}
              >
                <Text style={styles.botaoMenorTexto}>2x</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={emJogo}
                style={[styles.botaoMenor, emJogo && styles.desativado]}
                onPress={() => alterarAposta(10)}
              >
                <Text style={styles.botaoMenorTexto}>10</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Número de minas</Text>

            <View style={styles.linhaBotoes}>
              {OPCOES_MINAS.map((n) => (
                <TouchableOpacity
                  key={n}
                  disabled={emJogo}
                  style={[
                    styles.botaoMina,
                    minas === n && styles.botaoMinaAtivo,
                    emJogo && styles.desativado,
                  ]}
                  onPress={() => setMinas(n)}
                >
                  <Text
                    style={[
                      styles.botaoMinaTexto,
                      minas === n && styles.botaoMinaTextoAtivo,
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.riscoBox}>
              <View style={styles.riscoLinhaTopo}>
                <Text style={styles.riscoTitulo}>Risco: {textoRisco(minas)}</Text>
                <Text style={styles.riscoBadge}>{minas} minas</Text>
              </View>

              <Text style={styles.riscoTexto}>
                1º acerto: {formatarMultiplicador(multiplicadoresSelecionados[0] || 1)} • Máximo teórico: {formatarMultiplicador(multiplicadoresSelecionados[multiplicadoresSelecionados.length - 1] || 1)}
              </Text>

              <View style={styles.miniTabela}>
                {multiplicadoresSelecionados.slice(0, 5).map((valor, index) => (
                  <View style={styles.miniTabelaItem} key={`mult-${minas}-${index}`}>
                    <Text style={styles.miniTabelaLabel}>{index + 1}ª</Text>
                    <Text style={styles.miniTabelaValor}>{formatarMultiplicador(valor)}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.info}>Aposta permitida: {formatarSaldo(apostaMinimaConfig)} até {formatarSaldo(apostaMaximaConfig)}</Text>
              <Text style={styles.info}>Próximo multiplicador: {formatarMultiplicador(proximoMultiplicador)}</Text>
              <Text style={styles.info}>Saque máximo teórico: {formatarSaldo(saqueMaximoTeorico)}</Text>
              <Text style={styles.info}>Saque disponível: {formatarSaldo(saqueDisponivel)}</Text>
            </View>

            {!emJogo ? (
              <TouchableOpacity
                disabled={processando || !minesAtivo}
                style={[styles.botaoComecar, (processando || !minesAtivo) && styles.desativado]}
                onPress={comecarJogo}
              >
                <Text style={styles.botaoComecarTexto}>
                  {processando ? "Aguarde..." : !minesAtivo ? "Mines desativado" : "Começar jogo"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                disabled={saqueDisponivel <= 0 || processando}
                style={[
                  styles.botaoSacar,
                  (saqueDisponivel <= 0 || processando) && styles.desativado,
                ]}
                onPress={sacar}
              >
                <Text style={styles.botaoSacarTexto}>
                  Sacar {formatarSaldo(saqueDisponivel)}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.tabuleiroArea}>
            <Text style={styles.tabuleiroTitulo}>Escolha uma casa</Text>
            <Text style={styles.tabuleiroInfo}>
              Minas: {minasDaRodada} • Seguras: {casasSeguras} • Ganho atual: {formatarSaldo(ganhoAtual)}
            </Text>

            <View style={styles.tabuleiro}>
              {Array.from({ length: TOTAL_CASAS }).map((_, i) => renderCasa(i))}
            </View>

            <View style={styles.mensagemBox}>
              <Text style={styles.mensagem}>
                {mensagem.includes("Saldo insuficiente")
                  ? "Saldo insuficiente."
                  : mensagem}
              </Text>

              {mensagem.includes("Saldo insuficiente") && (
                <TouchableOpacity
                  style={styles.botaoRecarregar}
                  onPress={() =>
                    router.push({
                      pathname: "/perfil",
                      params: { abrirDeposito: "1" },
                    } as any)
                  }
                >
                  <Text style={styles.botaoRecarregarTexto}>Recarregar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.historicoBox}>
          <Text style={styles.historicoTitulo}>Histórico recente</Text>

          {historico.length === 0 ? (
            <Text style={styles.historicoVazio}>Nenhuma rodada registrada ainda.</Text>
          ) : (
            historico.map((h) => (
              <View key={h.id} style={styles.historicoItem}>
                <Text style={styles.historicoNome}>{h.nome || "Usuário"}</Text>
                <Text style={styles.historicoDetalhe}>
                  {h.resultado === "sacou" ? "Sacou" : "Perdeu"} • Aposta{" "}
                  {formatarSaldo(Number(h.aposta || 0))} • Pagamento{" "}
                  {formatarSaldo(Number(h.pagamento || 0))} • Líquido{" "}
                  {formatarSaldo(Number(h.ganhoLiquido || 0))}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#06130D" },
  loading: {
    flex: 1,
    backgroundColor: "#06130D",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: "#F9FAFB", marginTop: 12, fontWeight: "800" },
  container: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  voltar: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  voltarTexto: { color: "#F9FAFB", fontWeight: "900" },
  titulo: { color: "#F9FAFB", fontSize: 28, fontWeight: "900" },
  subtitulo: { color: "#F7C948", fontSize: 14, fontWeight: "900" },
  alerta: {
    backgroundColor: "#3A2500",
    borderWidth: 2,
    borderColor: "#F7C948",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  alertaTitulo: {
    color: "#F7C948",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
    textAlign: "center",
  },
  alertaTexto: {
    color: "#FFF7CC",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  desativadoBox: {
    backgroundColor: "#2B1111",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  desativadoTitulo: { color: "#FCA5A5", fontSize: 16, fontWeight: "900" },
  desativadoTexto: { color: "#FEE2E2", fontSize: 13, marginTop: 4, fontWeight: "700" },
  resumos: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  card: {
    flexGrow: 1,
    minWidth: 145,
    backgroundColor: "#0C2417",
    borderWidth: 1,
    borderColor: "rgba(247,201,72,0.25)",
    borderRadius: 16,
    padding: 14,
  },
  cardLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "800" },
  cardValor: { color: "#F7C948", fontSize: 24, fontWeight: "900", marginTop: 4 },
  areaJogo: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  painel: {
    flexGrow: 1,
    minWidth: 280,
    backgroundColor: "#0B1B13",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
  },
  label: { color: "#E5E7EB", fontSize: 13, fontWeight: "900", marginBottom: 8, marginTop: 4 },
  inputFake: {
    backgroundColor: "#06130D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  inputTexto: { color: "#F9FAFB", fontSize: 24, fontWeight: "900" },
  linhaBotoes: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  botaoMenor: {
    flexGrow: 1,
    minWidth: 70,
    backgroundColor: "#15291D",
    borderWidth: 1,
    borderColor: "rgba(247,201,72,0.20)",
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
  },
  botaoMenorTexto: { color: "#F9FAFB", fontWeight: "900" },
  botaoMina: {
    width: 54,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#15291D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  botaoMinaAtivo: { backgroundColor: "#F7C948", borderColor: "#F7C948" },
  botaoMinaTexto: { color: "#F9FAFB", fontWeight: "900" },
  botaoMinaTextoAtivo: { color: "#111827" },
  riscoBox: {
    backgroundColor: "rgba(247,201,72,0.08)",
    borderWidth: 1,
    borderColor: "rgba(247,201,72,0.24)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  riscoLinhaTopo: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" },
  riscoTitulo: { color: "#F7C948", fontSize: 14, fontWeight: "900" },
  riscoBadge: {
    color: "#111827",
    backgroundColor: "#F7C948",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "900",
  },
  riscoTexto: { color: "#E5E7EB", fontSize: 12, fontWeight: "800", marginTop: 8, lineHeight: 18 },
  miniTabela: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  miniTabelaItem: {
    backgroundColor: "#06130D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    minWidth: 56,
    alignItems: "center",
  },
  miniTabelaLabel: { color: "#9CA3AF", fontSize: 10, fontWeight: "800" },
  miniTabelaValor: { color: "#F9FAFB", fontSize: 12, fontWeight: "900", marginTop: 2 },
  infoBox: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 12, marginBottom: 14 },
  info: { color: "#D1D5DB", fontSize: 12, fontWeight: "800", marginBottom: 4 },
  botaoComecar: { backgroundColor: "#F7C948", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  botaoComecarTexto: { color: "#111827", fontSize: 16, fontWeight: "900" },
  botaoSacar: { backgroundColor: "#16A34A", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  botaoSacarTexto: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  desativado: { opacity: 0.45 },
  tabuleiroArea: {
    flexGrow: 2,
    minWidth: 320,
    backgroundColor: "#0B1B13",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
  },
  tabuleiroTitulo: { color: "#F9FAFB", fontSize: 20, fontWeight: "900" },
  tabuleiroInfo: { color: "#9CA3AF", fontSize: 12, marginTop: 4, marginBottom: 12, fontWeight: "800" },
  tabuleiro: { flexDirection: "row", flexWrap: "wrap", gap: 8, maxWidth: 340, alignSelf: "center", justifyContent: "center" },
  casa: {
    width: 58,
    height: 58,
    borderRadius: 13,
    backgroundColor: "#16281F",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  casaSegura: { backgroundColor: "#0F5B35", borderColor: "#22C55E" },
  casaMina: { backgroundColor: "#5B1111", borderColor: "#EF4444" },
  casaTexto: { fontSize: 25 },
  mensagemBox: { marginTop: 14, backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 14, padding: 12 },
  mensagem: { color: "#E5E7EB", fontSize: 13, lineHeight: 19, fontWeight: "800", textAlign: "center" },
  botaoRecarregar: {
    marginTop: 10,
    backgroundColor: "#FFD500",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  botaoRecarregarTexto: {
    color: "#07110C",
    fontSize: 14,
    fontWeight: "900",
  },
  historicoBox: {
    marginTop: 14,
    backgroundColor: "#0B1B13",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
  },
  historicoTitulo: { color: "#F9FAFB", fontSize: 18, fontWeight: "900", marginBottom: 10 },
  historicoVazio: { color: "#9CA3AF", fontWeight: "800" },
  historicoItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  historicoNome: { color: "#F7C948", fontWeight: "900" },
  historicoDetalhe: { color: "#D1D5DB", fontSize: 12, marginTop: 3, fontWeight: "800" },
});
