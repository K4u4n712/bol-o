import React from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";

export default function PerfilScreen() {
  const { user, logout } = useAuth();

  function abrirConfig() {
    Alert.alert(
      "Configurações",
      "Aqui depois podemos colocar edição de nome, foto, senha, grupos e notificações."
    );
  }

  async function sairConta() {
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      Alert.alert("Erro", "Não foi possível sair da conta.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#006B2E" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/(tabs)")}>
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
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>palpites</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>4</Text>
            <Text style={styles.statLabel}>acertos</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>230</Text>
            <Text style={styles.statLabel}>pontos</Text>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <View>
            <Text style={styles.balanceLabel}>Saldo fictício</Text>
            <Text style={styles.balanceValue}>{user?.saldo || 0} BRL</Text>
            <Text style={styles.balanceInfo}>
              Saldo vinculado ao login atual.
            </Text>
          </View>

          <Text style={styles.coinIcon}>🪙</Text>
        </View>

        {user?.role === "admin" && (
          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => router.push("/admin")}
          >
            <View>
              <Text style={styles.adminTitle}>Painel administrador</Text>
              <Text style={styles.adminText}>
                Gerenciar usuários e definir saldos fictícios.
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
              <Text style={styles.performanceText}>Brasil 2 x 1 Argentina</Text>
            </View>
          </View>

          <View style={styles.performanceItem}>
            <Text style={styles.performanceIcon}>🏆</Text>
            <View style={styles.performanceInfo}>
              <Text style={styles.performanceTitle}>Melhor posição</Text>
              <Text style={styles.performanceText}>2º lugar no ranking</Text>
            </View>
          </View>

          <View style={styles.performanceItem}>
            <Text style={styles.performanceIcon}>👥</Text>
            <View style={styles.performanceInfo}>
              <Text style={styles.performanceTitle}>Grupo atual</Text>
              <Text style={styles.performanceText}>Família e Amigos</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Minha conta</Text>

        <View style={styles.menuBox}>
          <TouchableOpacity style={styles.menuOption}>
            <Text style={styles.menuOptionIcon}>🎯</Text>
            <View style={styles.menuOptionTextBox}>
              <Text style={styles.menuOptionTitle}>Meus palpites</Text>
              <Text style={styles.menuOptionSubtitle}>
                Ver todos os palpites feitos
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuOption}>
            <Text style={styles.menuOptionIcon}>👥</Text>
            <View style={styles.menuOptionTextBox}>
              <Text style={styles.menuOptionTitle}>Meus grupos</Text>
              <Text style={styles.menuOptionSubtitle}>
                Família, amigos e bolões
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuOption}>
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
            Este app usa apenas dinheiro fictício. Não envolve pagamento real,
            saque real ou aposta com dinheiro verdadeiro.
          </Text>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      <View style={styles.bottomMenu}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/(tabs)")}
        >
          <Text style={styles.menuIcon}>🏠</Text>
          <Text style={styles.menuText}>Início</Text>
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

        <TouchableOpacity style={styles.menuItemActive}>
          <Text style={styles.menuIcon}>👤</Text>
          <Text style={styles.menuTextActive}>Perfil</Text>
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
    paddingTop: 28,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  back: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },

  configCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  configText: {
    fontSize: 19,
  },

  scroll: {
    flex: 1,
  },

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
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },

  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#006B2E",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "900",
  },

  name: {
    color: "#111827",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 12,
  },

  userTag: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },

  levelBadge: {
    backgroundColor: "#FFF6BF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    marginTop: 14,
  },

  levelText: {
    color: "#0B3D1C",
    fontWeight: "900",
    fontSize: 13,
  },

  statsRow: {
    flexDirection: "row",
    marginTop: 18,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    marginHorizontal: 4,
    elevation: 2,
  },

  statNumber: {
    color: "#006B2E",
    fontSize: 27,
    fontWeight: "900",
  },

  statLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  balanceCard: {
    backgroundColor: "#005C28",
    borderRadius: 22,
    padding: 20,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  balanceLabel: {
    color: "#DFFFEA",
    fontSize: 14,
    fontWeight: "700",
  },

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

  coinIcon: {
    fontSize: 42,
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

  adminTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
  },

  adminText: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 5,
    maxWidth: 240,
  },

  adminIcon: {
    fontSize: 36,
  },

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

  performanceIcon: {
    fontSize: 28,
    marginRight: 12,
  },

  performanceInfo: {
    flex: 1,
  },

  performanceTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },

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

  menuOptionIcon: {
    fontSize: 27,
    marginRight: 12,
  },

  menuOptionTextBox: {
    flex: 1,
  },

  menuOptionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },

  menuOptionSubtitle: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  arrow: {
    color: "#9CA3AF",
    fontSize: 30,
    fontWeight: "700",
  },

  logoutButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 17,
    alignItems: "center",
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },

  logoutText: {
    color: "#DC2626",
    fontSize: 16,
    fontWeight: "900",
  },

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