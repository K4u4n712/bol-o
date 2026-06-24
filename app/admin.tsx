import React, { useEffect, useState } from "react";
import { mostrarAlerta, mostrarConfirmacao } from "../utils/mostrarAlerta";
import { router } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebaseConfig";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const JOGO_ID = "brasil-argentina-2026";
const NOME_JOGO = "Brasil x Argentina";
const VALOR_APOSTA = 10;

export default function AdminScreen() {
  const {
    user,
    users,
    carregarUsuarios,
    atualizarSaldoUsuario,
    banirUsuario,
    desbanirUsuario,
  } = useAuth();

  const [saldosEditados, setSaldosEditados] = useState<Record<string, string>>(
    {}
  );
  const [totalPalpites, setTotalPalpites] = useState(0);
  const [golsBrasilResultado, setGolsBrasilResultado] = useState("");
  const [golsArgentinaResultado, setGolsArgentinaResultado] = useState("");

  useEffect(() => {
    carregarUsuarios();

    const apostasRef = collection(db, "apostas");
    const q = query(apostasRef, where("jogoId", "==", JOGO_ID));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTotalPalpites(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

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

  async function contarPalpites() {
    const apostasRef = collection(db, "apostas");
    const q = query(apostasRef, where("jogoId", "==", JOGO_ID));
    const snapshot = await getDocs(q);

    setTotalPalpites(snapshot.size);
  }

  function alterarCampo(email: string, valor: string) {
    setSaldosEditados({
      ...saldosEditados,
      [email]: valor,
    });
  }

  async function salvarSaldo(email: string) {
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

    await atualizarSaldoUsuario(email, numero);
    await carregarUsuarios();

    setSaldosEditados({
      ...saldosEditados,
      [email]: "",
    });

    mostrarAlerta("Saldo atualizado", `Novo saldo: ${numero} BRL`);
  }

  async function zerarPalpiteUsuario(email: string) {
    try {
      const apostasRef = collection(db, "apostas");

      const q = query(
        apostasRef,
        where("jogoId", "==", JOGO_ID),
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

      const notificacoesRef = collection(db, "notificacoes");

      const qNotificacoes = query(
        notificacoesRef,
        where("jogoId", "==", JOGO_ID),
        where("emailLower", "==", email.toLowerCase())
      );

      const notificacoesSnapshot = await getDocs(qNotificacoes);

      notificacoesSnapshot.docs.forEach((documento) => {
        batch.delete(doc(db, "notificacoes", documento.id));
      });

      await batch.commit();
      await contarPalpites();

      mostrarAlerta("Sucesso", "Palpite desse usuário foi apagado.");
    } catch (error) {
      console.log("Erro ao zerar palpite:", error);
      mostrarAlerta("Erro", "Não foi possível apagar o palpite.");
    }
  }

  function confirmarZerarUsuario(email: string, nome: string) {
  mostrarConfirmacao(
    "Zerar palpite",
    `Deseja apagar o palpite de ${nome}?`,
    () => zerarPalpiteUsuario(email)
  );
}

  async function zerarTodosPalpites() {
    try {
      const batch = writeBatch(db);

      const apostasRef = collection(db, "apostas");
      const qApostas = query(apostasRef, where("jogoId", "==", JOGO_ID));
      const apostasSnapshot = await getDocs(qApostas);

      apostasSnapshot.docs.forEach((documento) => {
        batch.delete(doc(db, "apostas", documento.id));
      });

      const notificacoesRef = collection(db, "notificacoes");
      const qNotificacoes = query(
        notificacoesRef,
        where("jogoId", "==", JOGO_ID)
      );
      const notificacoesSnapshot = await getDocs(qNotificacoes);

      notificacoesSnapshot.docs.forEach((documento) => {
        batch.delete(doc(db, "notificacoes", documento.id));
      });

      batch.delete(doc(db, "resultados", JOGO_ID));

      await batch.commit();

      setTotalPalpites(0);
      setGolsBrasilResultado("");
      setGolsArgentinaResultado("");

      mostrarAlerta("Sucesso", "Todos os palpites e resultados foram apagados.");
    } catch (error) {
      console.log("Erro ao zerar todos:", error);
      mostrarAlerta("Erro", "Não foi possível zerar os palpites.");
    }
  }

  function confirmarZerarTodos() {
  mostrarConfirmacao(
    "Atenção",
    "Deseja realmente apagar TODOS os palpites e resultados?",
    () => zerarTodosPalpites()
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
  

  async function alternarBanimento(email: string, nome: string, banido: boolean) {
  if (banido) {
    await liberarUsuario(email);
    await carregarUsuarios();
    mostrarAlerta("Usuário liberado", `${nome} foi desbanido.`);
    return;
  }

  confirmarBanirUsuario(email, nome);
}

function confirmarBanirUsuario(email: string, nome: string) {
  mostrarConfirmacao("Banir usuário", `Deseja banir ${nome}?`, async () => {
    await banirUsuario(email);
    await carregarUsuarios();
    mostrarAlerta("Usuário banido", `${nome} foi banido.`);
  });
}

  function verificarVencedor(
    palpiteBrasil: number,
    palpiteArgentina: number,
    resultadoBrasil: number,
    resultadoArgentina: number
  ) {
    const vencedorPalpite =
      palpiteBrasil > palpiteArgentina
        ? "brasil"
        : palpiteBrasil < palpiteArgentina
        ? "argentina"
        : "empate";

    const vencedorReal =
      resultadoBrasil > resultadoArgentina
        ? "brasil"
        : resultadoBrasil < resultadoArgentina
        ? "argentina"
        : "empate";

    return vencedorPalpite === vencedorReal;
  }

  async function calcularVencedores() {
    try {
      const golsBrasil = Number(golsBrasilResultado);
      const golsArgentina = Number(golsArgentinaResultado);

      if (isNaN(golsBrasil) || isNaN(golsArgentina)) {
        mostrarAlerta("Erro", "Digite o resultado oficial corretamente.");
        return;
      }

      const apostasRef = collection(db, "apostas");
      const q = query(apostasRef, where("jogoId", "==", JOGO_ID));
      const snapshot = await getDocs(q);

      const apostas = snapshot.docs.map((documento) => {
        const data = documento.data();

        return {
          id: documento.id,
          nome: data.nome || "Usuário",
          email: data.email || "",
          emailLower: data.emailLower || data.email?.toLowerCase() || "",
          placar: data.placar || "",
          golsBrasil: Number(data.golsBrasil || 0),
          golsAdversario: Number(data.golsAdversario || 0),
          valor: Number(data.valor || VALOR_APOSTA),
        };
      });

      if (apostas.length === 0) {
        mostrarAlerta("Sem palpites", "Nenhum palpite encontrado.");
        return;
      }

      const totalArrecadado = apostas.reduce((total, item) => {
        return total + Number(item.valor || VALOR_APOSTA);
      }, 0);

      const taxaAdmin = totalArrecadado * 0.2;
      const premioLiquido = totalArrecadado - taxaAdmin;

      const vencedoresExatos = apostas.filter((aposta) => {
        return (
          aposta.golsBrasil === golsBrasil &&
          aposta.golsAdversario === golsArgentina
        );
      });

      const premioPorVencedor =
        vencedoresExatos.length > 0
          ? premioLiquido / vencedoresExatos.length
          : 0;

      const ranking = apostas.map((aposta) => {
        const acertouPlacar =
          aposta.golsBrasil === golsBrasil &&
          aposta.golsAdversario === golsArgentina;

        const acertouVencedor = verificarVencedor(
          aposta.golsBrasil,
          aposta.golsAdversario,
          golsBrasil,
          golsArgentina
        );

        const pontos = acertouPlacar ? 10 : acertouVencedor ? 3 : 0;
        const venceu = acertouPlacar;
        const premio = venceu ? premioPorVencedor : 0;

        return {
          nome: aposta.nome,
          email: aposta.email,
          emailLower: aposta.emailLower,
          placar: aposta.placar,
          pontos,
          venceu,
          premio,
        };
      });

      ranking.sort((a, b) => {
        if (b.pontos !== a.pontos) return b.pontos - a.pontos;
        return a.nome.localeCompare(b.nome);
      });

      for (const vencedor of ranking) {
        if (vencedor.venceu && vencedor.premio > 0) {
          const usuarioGanhador = users.find(
            (item) =>
              item.email.toLowerCase() === vencedor.email.toLowerCase()
          );

          if (usuarioGanhador) {
            await atualizarSaldoUsuario(
              vencedor.email,
              usuarioGanhador.saldo + vencedor.premio
            );
          }
        }

        const notificacaoId = `${JOGO_ID}_${vencedor.email
          .toLowerCase()
          .replace(/[\/\\.#$[\]]/g, "_")}`;

        await setDoc(doc(db, "notificacoes", notificacaoId), {
          jogoId: JOGO_ID,
          jogo: NOME_JOGO,
          nome: vencedor.nome,
          email: vencedor.email,
          emailLower: vencedor.email.toLowerCase(),
          venceu: vencedor.venceu,
          pontos: vencedor.pontos,
          premio: vencedor.premio,
          mensagem: vencedor.venceu
            ? `🎉 Você venceu ${vencedor.premio.toFixed(2)} BRL!`
            : "😢 Você não venceu este bolão.",
          criadoEm: serverTimestamp(),
        });
      }

      await setDoc(doc(db, "resultados", JOGO_ID), {
        jogoId: JOGO_ID,
        jogo: NOME_JOGO,
        golsBrasil,
        golsAdversario: golsArgentina,
        golsArgentina,
        totalArrecadado,
        taxaAdmin,
        premioLiquido,
        premioPorVencedor,
        vencedores: vencedoresExatos,
        ranking,
        criadoEm: serverTimestamp(),
      });

      await carregarUsuarios();

      const nomesVencedores =
        vencedoresExatos.length > 0
          ? vencedoresExatos.map((item) => item.nome).join(", ")
          : "Nenhum vencedor exato";

      mostrarAlerta(
        "Resultado calculado",
        `Resultado: Brasil ${golsBrasil} x ${golsArgentina} Argentina\n\nTotal: ${totalArrecadado.toFixed(
          2
        )} BRL\nSua taxa 20%: ${taxaAdmin.toFixed(
          2
        )} BRL\nPrêmio líquido: ${premioLiquido.toFixed(
          2
        )} BRL\n\nVencedores: ${nomesVencedores}\nCada vencedor recebe: ${premioPorVencedor.toFixed(
          2
        )} BRL`
      );
    } catch (error) {
      console.log("Erro ao calcular vencedores:", error);
      mostrarAlerta("Erro", "Não foi possível calcular os vencedores.");
    }
  }

  const usuariosComuns = users.filter((item) => item.role === "user");

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
          <Text style={styles.heroTitle}>Controle do Bolão</Text>
          <Text style={styles.heroText}>
            Gerencie usuários, saldos, banimentos, palpites e resultados.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statNumber}>{usuariosComuns.length}</Text>
            <Text style={styles.statLabel}>usuários</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={styles.statNumber}>{totalPalpites}</Text>
            <Text style={styles.statLabel}>palpites</Text>
          </View>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Resultado oficial</Text>
          <Text style={styles.resultText}>
            Informe o placar final para calcular vencedores, pontos, taxa e
            prêmio.
          </Text>

          <View style={styles.resultRow}>
            <TextInput
              style={styles.resultInput}
              placeholder="Brasil"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={golsBrasilResultado}
              onChangeText={setGolsBrasilResultado}
            />

            <Text style={styles.resultX}>X</Text>

            <TextInput
              style={styles.resultInput}
              placeholder="Argentina"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={golsArgentinaResultado}
              onChangeText={setGolsArgentinaResultado}
            />
          </View>

          <View style={styles.taxBox}>
            <Text style={styles.taxText}>Taxa do administrador: 20%</Text>
          </View>

          <TouchableOpacity
            style={styles.calculateButton}
            onPress={calcularVencedores}
          >
            <Text style={styles.calculateButtonText}>
              🏆 Calcular vencedores
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dangerCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dangerTitle}>Zerar todos os palpites</Text>
            <Text style={styles.dangerText}>
              Apaga todos os palpites, resultados e notificações.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={confirmarZerarTodos}
          >
            <Text style={styles.resetButtonText}>Zerar</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Usuários cadastrados</Text>

        {usuariosComuns.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Nenhum usuário comum cadastrado ainda.
            </Text>
          </View>
        )}

        {usuariosComuns.map((item) => (
          <View
            style={[styles.userCard, item.banido && styles.userCardBanned]}
            key={item.email}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.nome.charAt(0).toUpperCase()}
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
                  Saldo: {item.saldo} BRL
                </Text>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Novo saldo"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={saldosEditados[item.email] || ""}
                onChangeText={(valor) => alterarCampo(item.email, valor)}
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => salvarSaldo(item.email)}
              >
                <Text style={styles.saveButtonText}>Salvar saldo</Text>
              </TouchableOpacity>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.deleteBetButton}
                  onPress={() => confirmarZerarUsuario(item.email, item.nome)}
                >
                  <Text style={styles.deleteBetButtonText}>
                    🗑️ Zerar palpite
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.banButton,
                    item.banido && styles.unbanButton,
                  ]}
                  onPress={() =>
                    alternarBanimento(item.email, item.nome, Boolean(item.banido))
                  }
                >
                  <Text
                    style={[
                      styles.banButtonText,
                      item.banido && styles.unbanButtonText,
                    ]}
                  >
                    {item.banido ? "Liberar" : "Banir"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Dados online</Text>
          <Text style={styles.warningText}>
            Os usuários, palpites, resultados e saldos agora ficam salvos no
            Firebase. Outros celulares conseguem ver as atualizações online.
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
    paddingTop: 28,
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
  statNumber: { color: "#111827", fontSize: 31, fontWeight: "900", marginTop: 6 },
  statLabel: { color: "#6B7280", fontSize: 12, fontWeight: "700", marginTop: 3 },

  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginTop: 18,
    elevation: 3,
  },

  resultTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },

  resultText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
    lineHeight: 19,
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

  taxBox: {
    backgroundColor: "#FFF6BF",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FFD500",
  },

  taxText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },

  calculateButton: {
    backgroundColor: "#16A34A",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },

  calculateButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  dangerCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    flexDirection: "row",
    alignItems: "center",
  },

  dangerTitle: { color: "#991B1B", fontSize: 17, fontWeight: "900" },
  dangerText: { color: "#7F1D1D", fontSize: 12, fontWeight: "700", marginTop: 4 },

  resetButton: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  resetButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },

  sectionTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 24,
    marginBottom: 12,
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
  userEmail: { color: "#6B7280", fontSize: 13, fontWeight: "700", marginTop: 3 },

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

  actionsRow: {
    flexDirection: "row",
    marginTop: 8,
  },

  deleteBetButton: {
    flex: 1,
    backgroundColor: "#FEF2F2",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },

  deleteBetButtonText: { color: "#DC2626", fontSize: 12, fontWeight: "900" },

  banButton: {
    flex: 1,
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginLeft: 6,
  },

  banButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },

  unbanButton: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },

  unbanButtonText: { color: "#166534" },

  emptyCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18 },
  emptyText: { color: "#6B7280", fontWeight: "700" },

  warningCard: {
    backgroundColor: "#FFF6BF",
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FFD500",
  },

  warningTitle: { color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  warningText: { color: "#4B5563", fontSize: 13, fontWeight: "600", lineHeight: 20 },

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