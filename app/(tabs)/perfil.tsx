import React, { useEffect, useState } from "react";
import { mostrarAlerta } from "../../utils/mostrarAlerta";
import { router } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Modal,
  TextInput,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../services/firebaseConfig";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

const CREATE_CHECKOUT_URL =
  "https://bol-o-rouge.vercel.app/api/create-checkout";

type PerfilStats = {
  totalPalpites: number;
  totalAcertos: number;
  totalPontos: number;
  melhorPalpite: string;
  melhorPosicao: string;
};

type SaqueUsuario = {
  id: string;
  uid: string;
  nome: string;
  email: string;
  chavePix: string;
  valorSolicitado: number;
  saldoAntes: number;
  saldoDepois: number;
  status: "processando" | "pago" | "cancelado" | string;
  criadoEm?: any;
  atualizadoEm?: any;
};

export default function PerfilScreen() {
  const { user, logout } = useAuth();

  const [modalDeposito, setModalDeposito] = useState(false);
  const [valorDeposito, setValorDeposito] = useState("10");
  const [depositando, setDepositando] = useState(false);
  const [saldoAtual, setSaldoAtual] = useState(0);

  const [modalSaque, setModalSaque] = useState(false);
  const [valorSaque, setValorSaque] = useState("20");
  const [chavePix, setChavePix] = useState("");
  const [solicitandoSaque, setSolicitandoSaque] = useState(false);
  const [saquesUsuario, setSaquesUsuario] = useState<SaqueUsuario[]>([]);

  const [stats, setStats] = useState<PerfilStats>({
    totalPalpites: 0,
    totalAcertos: 0,
    totalPontos: 0,
    melhorPalpite: "Nenhum palpite ainda",
    melhorPosicao: "Aguardando resultado",
  });

  useEffect(() => {
    if (!user?.uid) return;

    const userRef = doc(db, "usuarios", user.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setSaldoAtual(Number(user?.saldo || 0));
          return;
        }

        const data = snapshot.data();
        setSaldoAtual(Number(data.saldo || 0));
      },
      (error) => {
        console.log("Erro ao buscar saldo:", error);
        setSaldoAtual(Number(user?.saldo || 0));
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    const qSaques = query(
      collection(db, "saques"),
      where("uid", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      qSaques,
      (snapshot) => {
        const lista: SaqueUsuario[] = snapshot.docs.map((documento) => {
          const data = documento.data();

          return {
            id: documento.id,
            uid: data.uid || "",
            nome: data.nome || "Usuário",
            email: data.email || "",
            chavePix: data.chavePix || "",
            valorSolicitado: Number(data.valorSolicitado || 0),
            saldoAntes: Number(data.saldoAntes || 0),
            saldoDepois: Number(data.saldoDepois || 0),
            status: data.status || "processando",
            criadoEm: data.criadoEm,
            atualizadoEm: data.atualizadoEm,
          };
        });

        lista.sort((a, b) => {
          const dataA = pegarMillis(a.atualizadoEm || a.criadoEm);
          const dataB = pegarMillis(b.atualizadoEm || b.criadoEm);
          return dataB - dataA;
        });

        setSaquesUsuario(lista);
      },
      (error) => {
        console.log("Erro ao buscar saques do usuário:", error);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.email) return;

    const emailLower = user.email.toLowerCase();

    let totalPalpitesAtual = 0;
    let ultimoPalpite = "Nenhum palpite ainda";
    let resultadosDocs: any[] = [];

    function recalcularStats() {
      let totalPontos = 0;
      let totalAcertos = 0;
      let melhorPalpite = ultimoPalpite || "Nenhum palpite ainda";
      let melhorPosicaoNumero: number | null = null;
      let melhorPontuacao = -1;

      resultadosDocs.forEach((data) => {
        const ranking = Array.isArray(data.ranking) ? data.ranking : [];

        const posicaoUsuario = ranking.findIndex((item: any) => {
          const emailItem = item.emailLower || item.email?.toLowerCase();
          return emailItem === emailLower;
        });

        if (posicaoUsuario >= 0) {
          const item = ranking[posicaoUsuario];
          const pontos = Number(item.pontos || 0);

          totalPontos += pontos;

          if (pontos > 0) {
            totalAcertos += 1;
          }

          const posicaoAtual = posicaoUsuario + 1;

          if (
            melhorPosicaoNumero === null ||
            posicaoAtual < melhorPosicaoNumero
          ) {
            melhorPosicaoNumero = posicaoAtual;
          }

          if (pontos > melhorPontuacao) {
            melhorPontuacao = pontos;
            melhorPalpite = item.placar
              ? `Brasil ${item.placar} Argentina`
              : melhorPalpite;
          }
        }
      });

      setStats({
        totalPalpites: totalPalpitesAtual,
        totalAcertos,
        totalPontos,
        melhorPalpite: melhorPontuacao >= 0 ? melhorPalpite : ultimoPalpite,
        melhorPosicao:
          melhorPosicaoNumero !== null
            ? `${melhorPosicaoNumero}º lugar no ranking`
            : "Aguardando resultado",
      });
    }

    const apostasRef = collection(db, "apostas");
    const qApostas = query(apostasRef, where("emailLower", "==", emailLower));

    const unsubscribeApostas = onSnapshot(
      qApostas,
      (snapshot) => {
        totalPalpitesAtual = snapshot.size;

        if (!snapshot.empty) {
          const apostas = snapshot.docs.map((docItem) => docItem.data());

          apostas.sort((a: any, b: any) => {
            const dataA = pegarMillis(a.atualizadoEm || a.criadoEm);
            const dataB = pegarMillis(b.atualizadoEm || b.criadoEm);
            return dataB - dataA;
          });

          ultimoPalpite = apostas[0]?.placar
            ? `Brasil ${apostas[0].placar} Argentina`
            : "Nenhum palpite ainda";
        } else {
          ultimoPalpite = "Nenhum palpite ainda";
        }

        recalcularStats();
      },
      (error) => {
        console.log("Erro ao buscar apostas:", error);
      }
    );

    const resultadosRef = collection(db, "resultados");

    const unsubscribeResultados = onSnapshot(
      resultadosRef,
      (snapshot) => {
        resultadosDocs = snapshot.docs.map((docItem) => docItem.data());
        recalcularStats();
      },
      (error) => {
        console.log("Erro ao buscar resultados:", error);
      }
    );

    return () => {
      unsubscribeApostas();
      unsubscribeResultados();
    };
  }, [user?.email]);

  function pegarMillis(data?: any) {
    if (!data) return 0;
    if (typeof data.toMillis === "function") return data.toMillis();
    if (data.seconds) return data.seconds * 1000;

    const convertido = new Date(data).getTime();
    return Number.isNaN(convertido) ? 0 : convertido;
  }

  function formatarSaldo(valor: number) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function saquesEmProcessamento() {
    return saquesUsuario.filter((saque) => saque.status === "processando");
  }

  function textoStatusSaque(status: string) {
    if (status === "pago") return "Pago";
    if (status === "cancelado") return "Cancelado";
    return "Em processamento";
  }

  async function solicitarSaque() {
    try {
      const valorLimpo = valorSaque.replace(",", ".").trim();
      const valor = Number(valorLimpo);
      const chave = chavePix.trim();

      if (!user?.uid || !user?.email) {
        mostrarAlerta("Erro", "Você precisa estar logado para solicitar saque.");
        return;
      }

      const uidUsuario = String(user.uid);
      const emailUsuario = String(user.email);
      const nomeUsuarioConta = user.nome || "Usuário";

      if (!valor || isNaN(valor)) {
        mostrarAlerta("Valor inválido", "Digite um valor válido para sacar.");
        return;
      }

      if (valor < 20) {
        mostrarAlerta("Saque mínimo", "O valor mínimo para saque é R$ 20,00.");
        return;
      }

      if (valor > saldoAtual) {
        mostrarAlerta(
          "Saldo insuficiente",
          `Você tem ${formatarSaldo(saldoAtual)} BRL disponível para saque.`
        );
        return;
      }

      if (!chave) {
        mostrarAlerta("Chave Pix obrigatória", "Digite a chave Pix para receber o saque.");
        return;
      }

      if (solicitandoSaque) return;

      setSolicitandoSaque(true);

      const saqueRef = doc(collection(db, "saques"));
      const userRef = doc(db, "users", uidUsuario);
      const usuarioRef = doc(db, "usuarios", uidUsuario);
      const extratoId = `saque_${saqueRef.id}`;

      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const usuarioSnap = await transaction.get(usuarioRef);

        const saldoUsers = userSnap.exists() ? Number(userSnap.data().saldo || 0) : 0;
        const saldoUsuarios = usuarioSnap.exists()
          ? Number(usuarioSnap.data().saldo || 0)
          : 0;

        const saldoBase = Math.max(saldoUsers, saldoUsuarios, saldoAtual);

        if (saldoBase < valor) {
          throw new Error("Saldo insuficiente para solicitar este saque.");
        }

        const saldoDepois = Number((saldoBase - valor).toFixed(2));
        const emailLower = emailUsuario.toLowerCase();
        const nomeUsuario = nomeUsuarioConta;

        const dadosUsuario = {
          uid: uidUsuario,
          nome: nomeUsuario,
          email: emailUsuario,
          emailLower,
          saldo: saldoDepois,
          atualizadoEm: serverTimestamp(),
        };

        transaction.set(userRef, dadosUsuario, { merge: true });
        transaction.set(usuarioRef, dadosUsuario, { merge: true });

        transaction.set(saqueRef, {
          uid: uidUsuario,
          nome: nomeUsuario,
          email: emailUsuario,
          emailLower,
          chavePix: chave,
          valorSolicitado: valor,
          saldoAntes: saldoBase,
          saldoDepois,
          status: "processando",
          prazoEstimadoMinutos: 60,
          origem: "perfil",
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        });

        const extrato = {
          tipo: "saque_solicitado",
          descricao: "Solicitação de saque Pix",
          saqueId: saqueRef.id,
          valor: -valor,
          saldoAntes: saldoBase,
          saldoDepois,
          status: "processando",
          chavePix: chave,
          criadoEm: serverTimestamp(),
        };

        transaction.set(doc(db, "users", uidUsuario, "extrato", extratoId), extrato, {
          merge: true,
        });
        transaction.set(doc(db, "usuarios", uidUsuario, "extrato", extratoId), extrato, {
          merge: true,
        });
      });

      setModalSaque(false);
      setValorSaque("20");
      setChavePix("");

      mostrarAlerta(
        "Saque solicitado",
        "Seu saldo foi retido e o saque está em processamento. O prazo estimado é de até 1 hora."
      );
    } catch (error: any) {
      console.log("Erro ao solicitar saque:", error);
      mostrarAlerta(
        "Erro no saque",
        error?.message || "Não foi possível solicitar o saque."
      );
    } finally {
      setSolicitandoSaque(false);
    }
  }

  function abrirConfig() {
    mostrarAlerta(
      "Configurações",
      "Aqui depois podemos colocar edição de nome, foto, senha, grupos e notificações."
    );
  }

  async function abrirCheckoutDeposito() {
    try {
      const valorLimpo = valorDeposito.replace(",", ".").trim();
      const valor = Number(valorLimpo);

      if (!valor || valor < 1) {
        mostrarAlerta("Valor inválido", "Digite um valor válido para depositar.");
        return;
      }

      if (!user?.uid) {
        mostrarAlerta("Erro", "Você precisa estar logado para depositar.");
        return;
      }

      if (depositando) return;

      setDepositando(true);

      const response = await fetch(CREATE_CHECKOUT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: user.uid,
          nome: user.nome || "Usuário",
          email: user.email || "",
          valorReais: valor,
        }),
      });

      let data: any = {};

      try {
        data = await response.json();
      } catch (jsonError) {
        console.log("Erro ao ler resposta do checkout:", jsonError);
      }

      if (!response.ok || !data.success || !data.url) {
        mostrarAlerta(
          "Erro",
          data.message || "Não foi possível gerar o checkout Pix."
        );
        return;
      }

      setModalDeposito(false);

      await Linking.openURL(data.url);
    } catch (error) {
      console.log("Erro ao abrir checkout:", error);
      mostrarAlerta("Erro", "Não foi possível abrir o checkout.");
    } finally {
      setDepositando(false);
    }
  }

  async function sairConta() {
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      mostrarAlerta("Erro", "Não foi possível sair da conta.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#006B2E" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/")}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Perfil</Text>

        <TouchableOpacity style={styles.configCircle} onPress={abrirConfig}>
          <Text style={styles.configText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.nome?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>

          <Text style={styles.name}>{user?.nome || "Usuário"}</Text>
          <Text style={styles.userTag}>{user?.email || "sem e-mail"}</Text>

          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>
              {user?.role === "admin"
                ? "🛡️ Administrador"
                : "🔥 Palpiteiro do Brasa"}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalPalpites}</Text>
            <Text style={styles.statLabel}>palpites</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalAcertos}</Text>
            <Text style={styles.statLabel}>acertos</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalPontos}</Text>
            <Text style={styles.statLabel}>pontos</Text>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <View>
            <Text style={styles.balanceLabel}>Saldo</Text>
            <Text style={styles.balanceValue}>
              {formatarSaldo(saldoAtual)} BRL
            </Text>
            <Text style={styles.balanceInfo}>
              Saldo Real.
            </Text>
          </View>

          <Text style={styles.coinIcon}>🪙</Text>
        </View>

        <TouchableOpacity
          style={[styles.depositButton, depositando && styles.buttonDisabled]}
          onPress={() => setModalDeposito(true)}
          disabled={depositando}
        >
          <Text style={styles.depositText}>
            {depositando ? "Gerando Pix..." : "Depositar via Pix"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.withdrawButton, solicitandoSaque && styles.buttonDisabled]}
          onPress={() => setModalSaque(true)}
          disabled={solicitandoSaque}
        >
          <Text style={styles.withdrawText}>
            {solicitandoSaque ? "Solicitando saque..." : "Solicitar saque"}
          </Text>
        </TouchableOpacity>

        {saquesEmProcessamento().length > 0 && (
          <View style={styles.saqueStatusCard}>
            <Text style={styles.saqueStatusTitle}>Saque em processamento</Text>
            <Text style={styles.saqueStatusText}>
              Você possui {saquesEmProcessamento().length} saque(s) aguardando pagamento manual.
              O prazo estimado é de até 1 hora.
            </Text>

            {saquesEmProcessamento().slice(0, 2).map((saque) => (
              <View style={styles.saqueMiniCard} key={saque.id}>
                <Text style={styles.saqueMiniValue}>
                  {formatarSaldo(saque.valorSolicitado)} BRL
                </Text>
                <Text style={styles.saqueMiniText}>Pix: {saque.chavePix}</Text>
                <Text style={styles.saqueMiniText}>
                  Status: {textoStatusSaque(saque.status)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {user?.role === "admin" && (
          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => router.push("/admin")}
          >
            <View>
              <Text style={styles.adminTitle}>Painel administrador</Text>
              <Text style={styles.adminText}>
                Gerenciar usuários e definir saldos.
              </Text>
            </View>

            <Text style={styles.adminIcon}>🛡️</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Meu desempenho</Text>

        <View style={styles.performanceCard}>
          <View style={styles.performanceItem}>
            <Text style={styles.performanceIcon}>🎯</Text>
            <View style={styles.performanceInfo}>
              <Text style={styles.performanceTitle}>Melhor palpite</Text>
              <Text style={styles.performanceText}>{stats.melhorPalpite}</Text>
            </View>
          </View>

          <View style={styles.performanceItem}>
            <Text style={styles.performanceIcon}>🏆</Text>
            <View style={styles.performanceInfo}>
              <Text style={styles.performanceTitle}>Melhor posição</Text>
              <Text style={styles.performanceText}>{stats.melhorPosicao}</Text>
            </View>
          </View>

          <View style={styles.performanceItem}>
            <Text style={styles.performanceIcon}>👥</Text>
            <View style={styles.performanceInfo}>
              <Text style={styles.performanceTitle}>Grupo atual</Text>
              <Text style={styles.performanceText}>
                Bolão Brasil x Argentina
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Minha conta</Text>

        <View style={styles.menuBox}>
          <TouchableOpacity
            style={styles.menuOption}
            onPress={() => router.push("/bolao")}
          >
            <Text style={styles.menuOptionIcon}>🎯</Text>
            <View style={styles.menuOptionTextBox}>
              <Text style={styles.menuOptionTitle}>Meus palpites</Text>
              <Text style={styles.menuOptionSubtitle}>
                Ver palpites feitos no bolão
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuOption}>
            <Text style={styles.menuOptionIcon}>👥</Text>
            <View style={styles.menuOptionTextBox}>
              <Text style={styles.menuOptionTitle}>Meus grupos</Text>
              <Text style={styles.menuOptionSubtitle}>
                Bolão Brasil x Argentina
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuOption}
            onPress={() => router.push("/")}
          >
            <Text style={styles.menuOptionIcon}>🔔</Text>
            <View style={styles.menuOptionTextBox}>
              <Text style={styles.menuOptionTitle}>Notificações</Text>
              <Text style={styles.menuOptionSubtitle}>
                Avisos de jogos e resultados
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          {user?.role === "admin" && (
            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => router.push("/admin")}
            >
              <Text style={styles.menuOptionIcon}>🛡️</Text>
              <View style={styles.menuOptionTextBox}>
                <Text style={styles.menuOptionTitle}>
                  Painel administrador
                </Text>
                <Text style={styles.menuOptionSubtitle}>
                  Gerenciar usuários e saldos
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.menuOption} onPress={abrirConfig}>
            <Text style={styles.menuOptionIcon}>⚙️</Text>
            <View style={styles.menuOptionTextBox}>
              <Text style={styles.menuOptionTitle}>Configurações</Text>
              <Text style={styles.menuOptionSubtitle}>
                Editar perfil e preferências
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={sairConta}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Aviso importante</Text>
          <Text style={styles.warningText}>
            Depósitos reais podem envolver regras legais. Use apenas se estiver
            tudo regularizado.
          </Text>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal visible={modalDeposito} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Depositar saldo</Text>
            <Text style={styles.modalSubtitle}>
              Digite o valor e continue para o checkout Pix.
            </Text>

            <TextInput
              style={styles.inputValor}
              value={valorDeposito}
              onChangeText={setValorDeposito}
              keyboardType="numeric"
              placeholder="Ex: 10"
              editable={!depositando}
            />

            <TouchableOpacity
              style={[
                styles.modalDepositButton,
                depositando && styles.buttonDisabled,
              ]}
              onPress={abrirCheckoutDeposito}
              disabled={depositando}
            >
              {depositando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalDepositText}>Continuar para Pix</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalDeposito(false)}
              disabled={depositando}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalSaque} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Solicitar saque</Text>
            <Text style={styles.modalSubtitle}>
              O saque é manual. Após solicitar, o valor fica retido e pode levar até 1 hora.
            </Text>

            <View style={styles.availableBox}>
              <Text style={styles.availableLabel}>Saldo disponível para saque</Text>
              <Text style={styles.availableValue}>{formatarSaldo(saldoAtual)} BRL</Text>
            </View>

            <Text style={styles.modalLabel}>Valor do saque</Text>
            <TextInput
              style={styles.inputValor}
              value={valorSaque}
              onChangeText={setValorSaque}
              keyboardType="numeric"
              placeholder="Mínimo 20"
              editable={!solicitandoSaque}
            />

            <TouchableOpacity
              style={styles.useAllButton}
              onPress={() => setValorSaque(String(Number(saldoAtual.toFixed(2))))}
              disabled={solicitandoSaque || saldoAtual < 20}
            >
              <Text style={styles.useAllText}>Usar saldo disponível</Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Chave Pix</Text>
            <TextInput
              style={styles.inputPix}
              value={chavePix}
              onChangeText={setChavePix}
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              editable={!solicitandoSaque}
            />

            <TouchableOpacity
              style={[
                styles.modalWithdrawButton,
                solicitandoSaque && styles.buttonDisabled,
              ]}
              onPress={solicitarSaque}
              disabled={solicitandoSaque}
            >
              {solicitandoSaque ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.modalWithdrawText}>Solicitar saque</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalSaque(false)}
              disabled={solicitandoSaque}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

        <TouchableOpacity style={styles.menuItemActive}>
          <Text style={styles.menuIcon}>👤</Text>
          <Text style={styles.menuTextActive}>Perfil</Text>
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
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  back: { color: "#FFFFFF", fontSize: 34, fontWeight: "900" },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },

  configCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  configText: { fontSize: 19 },
  scroll: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 110,
  },

  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 26,
    alignItems: "center",
    elevation: 4,
  },

  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#006B2E",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: { color: "#FFFFFF", fontSize: 42, fontWeight: "900" },
  name: { color: "#111827", fontSize: 27, fontWeight: "900", marginTop: 12 },
  userTag: { color: "#6B7280", fontSize: 14, fontWeight: "700", marginTop: 3 },

  levelBadge: {
    backgroundColor: "#FFF6BF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    marginTop: 14,
  },

  levelText: { color: "#0B3D1C", fontWeight: "900", fontSize: 13 },

  statsRow: { flexDirection: "row", marginTop: 18 },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    marginHorizontal: 4,
    elevation: 2,
  },

  statNumber: { color: "#006B2E", fontSize: 27, fontWeight: "900" },
  statLabel: { color: "#6B7280", fontSize: 12, fontWeight: "700", marginTop: 3 },

  balanceCard: {
    backgroundColor: "#005C28",
    borderRadius: 22,
    padding: 20,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  balanceLabel: { color: "#DFFFEA", fontSize: 14, fontWeight: "700" },
  balanceValue: {
    color: "#FFD500",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
  },

  balanceInfo: {
    color: "#DFFFEA",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 5,
    maxWidth: 230,
  },

  coinIcon: { fontSize: 42 },

  depositButton: {
    backgroundColor: "#00A344",
    borderRadius: 18,
    padding: 17,
    alignItems: "center",
    marginTop: 12,
  },

  depositText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  withdrawButton: {
    backgroundColor: "#FFD500",
    borderRadius: 18,
    padding: 17,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#EAB308",
  },

  withdrawText: {
    color: "#0B3D1C",
    fontSize: 16,
    fontWeight: "900",
  },

  saqueStatusCard: {
    backgroundColor: "#FFF6BF",
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FFD500",
  },

  saqueStatusTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },

  saqueStatusText: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
  },

  saqueMiniCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },

  saqueMiniValue: {
    color: "#006B2E",
    fontSize: 17,
    fontWeight: "900",
  },

  saqueMiniText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  adminCard: {
    backgroundColor: "#111827",
    borderRadius: 22,
    padding: 20,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  adminTitle: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  adminText: { color: "#D1D5DB", fontSize: 13, fontWeight: "600", marginTop: 5 },
  adminIcon: { fontSize: 36 },

  sectionTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 24,
    marginBottom: 12,
  },

  performanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    elevation: 2,
  },

  performanceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },

  performanceIcon: { fontSize: 28, marginRight: 12 },
  performanceInfo: { flex: 1 },
  performanceTitle: { color: "#111827", fontSize: 15, fontWeight: "900" },
  performanceText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },

  menuBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    elevation: 2,
  },

  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },

  menuOptionIcon: { fontSize: 27, marginRight: 12 },
  menuOptionTextBox: { flex: 1 },
  menuOptionTitle: { color: "#111827", fontSize: 16, fontWeight: "900" },
  menuOptionSubtitle: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  arrow: { color: "#9CA3AF", fontSize: 30, fontWeight: "700" },

  logoutButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 17,
    alignItems: "center",
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },

  logoutText: { color: "#DC2626", fontSize: 16, fontWeight: "900" },

  warningCard: {
    backgroundColor: "#FFF6BF",
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
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
  bottomSpace: { height: 20 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  modalBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    width: "100%",
  },

  modalTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },

  modalSubtitle: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 16,
  },

  inputValor: {
    backgroundColor: "#F3F6F4",
    borderRadius: 14,
    padding: 15,
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  modalLabel: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 7,
    marginTop: 12,
  },

  availableBox: {
    backgroundColor: "#F1FFF5",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BEE7C9",
    marginBottom: 8,
  },

  availableLabel: {
    color: "#006B2E",
    fontSize: 12,
    fontWeight: "800",
  },

  availableValue: {
    color: "#006B2E",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 3,
  },

  useAllButton: {
    alignSelf: "flex-start",
    backgroundColor: "#E7FBEF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#BEE7C9",
  },

  useAllText: {
    color: "#006B2E",
    fontSize: 12,
    fontWeight: "900",
  },

  inputPix: {
    backgroundColor: "#F3F6F4",
    borderRadius: 14,
    padding: 15,
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  modalDepositButton: {
    backgroundColor: "#006B2E",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 14,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  modalDepositText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  modalWithdrawButton: {
    backgroundColor: "#FFD500",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },

  modalWithdrawText: {
    color: "#0B3D1C",
    fontSize: 16,
    fontWeight: "900",
  },

  cancelButton: {
    padding: 14,
    alignItems: "center",
    marginTop: 6,
  },

  cancelText: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "900",
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

  menuItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  menuItemActive: { flex: 1, alignItems: "center", justifyContent: "center" },
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