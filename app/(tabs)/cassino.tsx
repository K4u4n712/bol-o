import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

export default function CassinoScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#050A07" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.topBar}>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.menuIconTop}>☰</Text>
            </TouchableOpacity>

            <View style={styles.logoRow}>
              <Text style={styles.logoText}>Cassino</Text>
              <Text style={styles.logoNumber}>10</Text>
            </View>

            <View style={styles.topIconBox}>
              <Text style={styles.topIcon}>🎰</Text>
            </View>
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroSmall}>CASSINO 10</Text>
            <Text style={styles.heroTitle}>Jogos disponíveis</Text>
            <Text style={styles.heroText}>
              Escolha um dos jogos abaixo para começar. Novas opções serão adicionadas em breve.
            </Text>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNumber}>1</Text>
              <Text style={styles.heroStatLabel}>jogo disponível</Text>
            </View>

            <View style={styles.heroStatDivider} />

            <View style={styles.heroStat}>
              <Text style={styles.heroStatNumber}>Mines</Text>
              <Text style={styles.heroStatLabel}>jogo ativo</Text>
            </View>

            <View style={styles.heroStatDivider} />

            <View style={styles.heroStat}>
              <Text style={styles.heroStatNumber}>+</Text>
              <Text style={styles.heroStatLabel}>novos jogos em breve</Text>
            </View>
          </View>

          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.heroGoldLine} />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Jogos disponíveis</Text>
            <Text style={styles.sectionSubtitle}>Toque em um card para abrir</Text>
          </View>

          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>NOVO</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.mainGameCard}
          onPress={() => router.push("/mines")}
        >
          <View style={styles.gameImage}>
            <View style={styles.fakeBoard}>
              {Array.from({ length: 25 }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.fakeCell,
                    index === 6 && styles.fakeCellGold,
                    index === 12 && styles.fakeCellBomb,
                    index === 18 && styles.fakeCellGreen,
                  ]}
                >
                  {index === 6 && <Text style={styles.fakeCellText}>💎</Text>}
                  {index === 12 && <Text style={styles.fakeCellText}>💣</Text>}
                </View>
              ))}
            </View>

            <View style={styles.gameImageOverlay}>
              <View style={styles.gameLogoCircle}>
                <Text style={styles.gameLogoEmoji}>💣</Text>
              </View>

              <View style={styles.gameImageTextBox}>
                <Text style={styles.gameImageTitle}>MINES</Text>
                <Text style={styles.gameImageSub}>10</Text>
              </View>
            </View>
          </View>

          <View style={styles.gameContent}>
            <View style={styles.gameTopLine}>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>DISPONÍVEL</Text>
              </View>

              <Text style={styles.gameMeta}>Risco variável</Text>
            </View>

            <Text style={styles.gameTitle}>Mines 10</Text>

            <Text style={styles.gameDescription}>
              Abra casas, acumule multiplicador e tente sair antes da mina.
            </Text>

            <View style={styles.featureRow}>
              <View style={styles.featurePill}>
                <Text style={styles.featureText}>2 minas</Text>
              </View>

              <View style={styles.featurePill}>
                <Text style={styles.featureText}>5 minas</Text>
              </View>

              <View style={styles.featurePill}>
                <Text style={styles.featureText}>10 minas</Text>
              </View>

              <View style={styles.featurePill}>
                <Text style={styles.featureText}>24 minas</Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.footerSmall}>Multiplicadores</Text>
                <Text style={styles.footerStrong}>por quantidade de minas</Text>
              </View>

              <View style={styles.playButton}>
                <Text style={styles.playButtonText}>Jogar</Text>
                <Text style={styles.playButtonArrow}>→</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitleSmall}>Próximos jogos</Text>

        <View style={styles.gridGames}>
          <View style={styles.futureCard}>
            <View style={styles.futureIconBox}>
              <Text style={styles.futureIcon}>🎲</Text>
            </View>
            <Text style={styles.futureTitle}>Dados</Text>
            <Text style={styles.futureText}>Em breve</Text>
          </View>

          <View style={styles.futureCard}>
            <View style={styles.futureIconBox}>
              <Text style={styles.futureIcon}>🚀</Text>
            </View>
            <Text style={styles.futureTitle}>Crash</Text>
            <Text style={styles.futureText}>Em breve</Text>
          </View>

          <View style={styles.futureCard}>
            <View style={styles.futureIconBox}>
              <Text style={styles.futureIcon}>🎡</Text>
            </View>
            <Text style={styles.futureTitle}>Roleta</Text>
            <Text style={styles.futureText}>Em breve</Text>
          </View>

          <View style={styles.futureCard}>
            <View style={styles.futureIconBox}>
              <Text style={styles.futureIcon}>🃏</Text>
            </View>
            <Text style={styles.futureTitle}>Cards</Text>
            <Text style={styles.futureText}>Em breve</Text>
          </View>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      <View style={styles.bottomMenu}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/")}
        >
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

        <TouchableOpacity style={styles.menuItemActive}>
          <Text style={styles.menuIcon}>🎰</Text>
          <Text style={styles.menuTextActive}>Cassino</Text>
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
  container: {
    flex: 1,
    backgroundColor: "#F3F6F4",
  },
  content: {
    paddingBottom: 115,
  },
  hero: {
    backgroundColor: "#050A07",
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
  topIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,213,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,213,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  topIcon: {
    fontSize: 19,
  },
  heroContent: {
    marginTop: 26,
    maxWidth: 330,
  },
  heroSmall: {
    color: "#FFD500",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 33,
    fontWeight: "900",
    marginTop: 4,
  },
  heroText: {
    color: "#CFE7D8",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 7,
  },
  heroStats: {
    marginTop: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,213,0,0.18)",
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  heroStat: {
    alignItems: "center",
    flex: 1,
  },
  heroStatNumber: {
    color: "#FFD500",
    fontSize: 18,
    fontWeight: "900",
  },
  heroStatLabel: {
    color: "#DFFFEA",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center",
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroGlowOne: {
    position: "absolute",
    right: -45,
    top: 85,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(0,163,68,0.22)",
  },
  heroGlowTwo: {
    position: "absolute",
    left: -55,
    bottom: -55,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,213,0,0.10)",
  },
  heroGoldLine: {
    position: "absolute",
    bottom: 0,
    left: 40,
    right: 40,
    height: 2,
    backgroundColor: "rgba(255,213,0,0.55)",
    borderRadius: 99,
  },
  sectionHeader: {
    marginHorizontal: 18,
    marginTop: 22,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  sectionBadge: {
    backgroundColor: "#E8FFF1",
    borderWidth: 1,
    borderColor: "#BEE7C9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sectionBadgeText: {
    color: "#006B2E",
    fontSize: 11,
    fontWeight: "900",
  },
  mainGameCard: {
    marginHorizontal: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 7,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  gameImage: {
    height: 190,
    backgroundColor: "#08150E",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fakeBoard: {
    width: 280,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    opacity: 0.58,
    transform: [{ rotate: "-8deg" }],
  },
  fakeCell: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: "#173B27",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  fakeCellGold: {
    backgroundColor: "#EAB308",
    borderColor: "#FFD500",
  },
  fakeCellBomb: {
    backgroundColor: "#6B1111",
    borderColor: "#EF4444",
  },
  fakeCellGreen: {
    backgroundColor: "#0F6B3B",
    borderColor: "#22C55E",
  },
  fakeCellText: {
    fontSize: 20,
  },
  gameImageOverlay: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  gameLogoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFD500",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  gameLogoEmoji: {
    fontSize: 36,
  },
  gameImageTextBox: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  gameImageTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 1,
  },
  gameImageSub: {
    color: "#FFD500",
    fontSize: 36,
    fontWeight: "900",
    marginLeft: 5,
  },
  gameContent: {
    padding: 18,
  },
  gameTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusPill: {
    backgroundColor: "#00A344",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  gameMeta: {
    color: "#006B2E",
    fontSize: 12,
    fontWeight: "900",
  },
  gameTitle: {
    color: "#111827",
    fontSize: 27,
    fontWeight: "900",
    marginBottom: 5,
  },
  gameDescription: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  featureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  featurePill: {
    backgroundColor: "#F1FFF5",
    borderWidth: 1,
    borderColor: "#BEE7C9",
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  featureText: {
    color: "#006B2E",
    fontSize: 11,
    fontWeight: "900",
  },
  cardFooter: {
    marginTop: 17,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerSmall: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "800",
  },
  footerStrong: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2,
  },
  playButton: {
    backgroundColor: "#006B2E",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  playButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  playButtonArrow: {
    color: "#FFD500",
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 6,
  },
  sectionTitleSmall: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginHorizontal: 18,
    marginTop: 22,
    marginBottom: 12,
  },
  gridGames: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginHorizontal: 18,
  },
  futureCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 22,
    padding: 15,
    minHeight: 130,
    justifyContent: "center",
  },
  futureIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F3F6F4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  futureIcon: {
    fontSize: 22,
  },
  futureTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },
  futureText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
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
