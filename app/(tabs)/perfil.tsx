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
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../services/firebaseConfig";
import { collection, onSnapshot, query, where } from "firebase/firestore";

const CHECKOUT_INFINITEPAY_URL = "https://checkout.infinitepay.io/pitstoplanchepizzariaa/8wJ5hi2y41";

type PerfilStats = {
  totalPalpites: number;
  totalAcertos: number;
  totalPontos: number;
  melhorPalpite: string;
  melhorPosicao: string;
};

export default function PerfilScreen() {
  const { user, logout } = useAuth();

  const [modalDeposito, setModalDeposito] = useState(false);
  const [valorDeposito, setValorDeposito] = useState("10");

  const [stats, setStats] = useState<PerfilStats>({
    totalPalpites: 0,
    totalAcertos: 0,
    totalPontos: 0,
    melhorPalpite: "Nenhum palpite ainda",
    melhorPosicao: "Aguardando resultado",
  });

  useEffect(() => {
    if (!user?.email) return;

    const emailLower = user.email.toLowerCase();
    const apostasRef = collection(db, "apostas");
    const qApostas = query(apostasRef, where("emailLower", "==", emailLower));

    let totalPalpitesAtual = 0;
    let ultimoPalpite = "";

    const unsubscribeApostas = onSnapshot(qApostas, (snapshot) => {
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

      atualizarStatsComResultados(totalPalpitesAtual, ultimoPalpite);
    });

    const resultadosRef = collection(db, "resultados");

    const unsubscribeResultados = onSnapshot(resultadosRef, () => {
      atualizarStatsComResultados(totalPalpitesAtual, ultimoPalpite);
    });

    return () => {
      unsubscribeApostas();
      unsubscribeResultados();
    };
  }, [user]);

  async function atualizarStatsComResultados(
    totalPalpitesAtual: number,
    ultimoPalpite: string
  ) {
    if (!user?.email) return;

    const emailLower = user.email.toLowerCase();
    const resultadosRef = collection(db, "resultados");

    const unsubscribe = onSnapshot(resultadosRef, (snapshot) => {
      let totalPontos = 0;
      let totalAcertos = 0;
      let melhorPalpite = ultimoPalpite || "Nenhum palpite ainda";
      let melhorPosicaoNumero: number | null = null;
      let melhorPontuacao = -1;

      snapshot.docs.forEach((docItem) => {
        const data = docItem.data();
        const ranking = Array.isArray(data.ranking) ? data.ranking : [];

        const posicaoUsuario = ranking.findIndex((item: any) => {
          const emailItem = item.emailLower || item.email?.toLowerCase();
          return emailItem === emailLower;
        });

        if (posicaoUsuario >= 0) {
          const item = ranking[posicaoUsuario];
          const pontos = Number(item.pontos || 0);

          totalPontos += pontos;

          if (pontos > 0) totalAcertos += 1;

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

      unsubscribe();
    });
  }

  function pegarMillis(data?: any) {
    if (!data) return 0;
    if (typeof data.toMillis === "function") return data.toMillis();
    if (data.seconds) return data.seconds * 1000;
    return new Date(data).getTime();
  }

  function abrirConfig() {
    mostrarAlerta(
      "Configurações",
      "Aqui depois podemos colocar edição de nome, foto, senha, grupos e notificações."
    );
  }

  async function abrirCheckoutDeposito() {
    const valor = Number(valorDeposito.replace(",", "."));

    if (!valor || valor < 1) {
      mostrarAlerta("Valor inválido", "Digite um valor válido para depositar.");
      return;
    }

    if (CHECKOUT_INFINITEPAY_URL.includes("https://checkout.infinitepay.io/pitstoplanchepizzariaa/8wJ5hi2y41")) {
      mostrarAlerta(
        "Link não configurado",
        "Cole o link do checkout da InfinitePay no código."
      );
      return;
    }

    setModalDeposito(false);

    const identificadorUsuario = user?.uid || user?.email?.toLowerCase().replace(/[^a-z0-9]/g, "");
    const urlComTracking = `${CHECKOUT_INFINITEPAY_URL}?reference_id=${identificadorUsuario}&amount=${valor}`;
    

    const abriu = await Linking.openURL(urlComTracking);

    if (!abriu) {
      mostrarAlerta("Erro", "Não foi possível abrir o checkout.");
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
            <Text style={styles.balanceValue}>{user?.saldo || 0} BRL</Text>
            <Text style={styles.balanceInfo}>
              Saldo atualizado online pelo Firebase.
            </Text>
          </View>

          <Text style={styles.coinIcon}>🪙</Text>
        </View>

        <TouchableOpacity
          style={styles.depositButton}
          onPress={() => setModalDeposito(true)}
        >
          <Text style={styles.depositText}>Depositar via Pix</Text>
        </TouchableOpacity>

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
            />

            <TouchableOpacity
              style={styles.modalDepositButton}
              onPress={abrirCheckoutDeposito}
            >
              <Text style={styles.modalDepositText}>Continuar para Pix</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalDeposito(false)}
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
  balanceValue: { color: "#FFD500", fontSize: 32, fontWeight: "900", marginTop: 4 },

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
  performanceText: { color: "#6B7280", fontSize: 13, fontWeight: "700", marginTop: 3 },

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
  menuOptionSubtitle: { color: "#6B7280", fontSize: 12, fontWeight: "700", marginTop: 3 },
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

  warningTitle: { color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  warningText: { color: "#4B5563", fontSize: 13, fontWeight: "600", lineHeight: 20 },
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

  modalDepositButton: {
    backgroundColor: "#006B2E",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 14,
  },

  modalDepositText: {
    color: "#FFFFFF",
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
  menuText: { fontSize: 11, color: "#6B7280", marginTop: 3, fontWeight: "700" },
  menuTextActive: { fontSize: 11, color: "#00A344", marginTop: 3, fontWeight: "900" },
});