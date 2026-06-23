import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Switch,
  Image,
  Alert,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../services/firebaseConfig";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

// Tipagem para os jogos que virão da API
type Jogo = {
  id: string;
  dataIso: string;
  dataFormatada: string;
  horaFormatada: string;
  status: "ao-vivo" | "agendado" | "encerrado";
  timeCasa: string;
  logoCasa: string;
  placarCasa: number | null;
  timeFora: string;
  logoFora: string;
  placarFora: number | null;
  tempoDecorrido?: string;
  apostasAbertas: boolean;
};

export default function GerenciarRodadaScreen() {
  const { user } = useAuth();
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [configApostas, setConfigApostas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // 1. Ouve o Firebase em tempo real para saber quais jogos estão com apostas abertas
    // Estamos usando um documento único 'status_rodada' dentro da coleção 'jogos_config'
    const unsub = onSnapshot(doc(db, "jogos_config", "status_rodada"), (doc) => {
      if (doc.exists()) {
        setConfigApostas(doc.data());
      }
    });

    // 2. Busca os jogos na API
    buscarJogosAPI();

    // 3. Atualiza a lista a cada 30 segundos para manter o placar ao vivo
    const interval = setInterval(buscarJogosAPI, 30000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  // VERIFICAÇÃO DE ADMIN
  if (!user || user.role !== "admin") {
    return (
      <SafeAreaView style={styles.safeBlocked}>
        <View style={styles.blockedBox}>
          <Text style={styles.blockedIcon}>🔒</Text>
          <Text style={styles.blockedTitle}>Acesso bloqueado</Text>
          <Text style={styles.blockedText}>
            Apenas administradores podem acessar o painel de gerenciamento.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.backButtonText}>Voltar para o app</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  async function buscarJogosAPI() {
    try {
      // Endpoint da ESPN para futebol (FIFA World Cup)
      // Nota: Como a copa não está acontecendo, essa API pode retornar vazia no momento.
      const response = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"
      );
      const data = await response.json();

      let jogosFormatados: Jogo[] = [];

      // SE A API RETORNAR JOGOS (Quando a copa começar)
      if (data.events && data.events.length > 0) {
        const agora = new Date().getTime();

        data.events.forEach((evento: any) => {
          const statusDaApi = evento.status.type.state; // 'pre', 'in', 'post'
          const dataJogo = new Date(evento.date);
          
          // Lógica: Se acabou (post) e já passou 1 hora (3600000 ms), ignora o jogo (não entra no array)
          if (statusDaApi === "post" && agora - dataJogo.getTime() > 3600000) {
            return;
          }

          let statusLocal: "agendado" | "ao-vivo" | "encerrado" = "agendado";
          if (statusDaApi === "in") statusLocal = "ao-vivo";
          if (statusDaApi === "post") statusLocal = "encerrado";

          jogosFormatados.push({
            id: evento.id,
            dataIso: evento.date,
            dataFormatada: dataJogo.toLocaleDateString("pt-BR"),
            horaFormatada: dataJogo.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            status: statusLocal,
            tempoDecorrido: evento.status.displayClock,
            timeCasa: evento.competitions[0].competitors[0].team.name,
            logoCasa: evento.competitions[0].competitors[0].team.logo,
            placarCasa: parseInt(evento.competitions[0].competitors[0].score) || 0,
            timeFora: evento.competitions[0].competitors[1].team.name,
            logoFora: evento.competitions[0].competitors[1].team.logo,
            placarFora: parseInt(evento.competitions[0].competitors[1].score) || 0,
            apostasAbertas: false, // Será sobreescrito pelo state do Firebase abaixo
          });
        });
      } else {
        // FALLBACK: MOCK DATA PARA TESTE (Já que não tem jogo da copa hoje)
        // Isso garante que você veja a tela funcionando igual ao seu print
        jogosFormatados = [
          {
            id: "jogo_1",
            dataIso: "2026-06-21T18:00:00Z",
            dataFormatada: "21/06/2026",
            horaFormatada: "18:00",
            status: "ao-vivo",
            timeCasa: "New Zealand",
            logoCasa: "https://flagcdn.com/w320/nz.png",
            placarCasa: 1,
            timeFora: "Egypt",
            logoFora: "https://flagcdn.com/w320/eg.png",
            placarFora: 0,
            apostasAbertas: false,
          },
          {
            id: "jogo_2",
            dataIso: "2026-06-22T14:00:00Z",
            dataFormatada: "22/06/2026",
            horaFormatada: "14:00",
            status: "agendado",
            timeCasa: "Argentina",
            logoCasa: "https://flagcdn.com/w320/ar.png",
            placarCasa: null,
            timeFora: "Austria",
            logoFora: "https://flagcdn.com/w320/at.png",
            placarFora: null,
            apostasAbertas: true,
          },
        ];
      }

      setJogos(jogosFormatados);
    } catch (error) {
      console.log("Erro ao buscar jogos:", error);
    } finally {
      setLoading(false);
    }
  }

  // Função que atualiza no Firebase se a aposta daquele jogo está aberta ou fechada
  async function toggleApostas(jogoId: string, statusAtual: boolean) {
    try {
      const novoStatus = !statusAtual;
      
      // Atualiza o objeto inteiro no Firebase (merge: true não apaga os outros jogos)
      await setDoc(
        doc(db, "jogos_config", "status_rodada"),
        { [jogoId]: novoStatus },
        { merge: true }
      );

    } catch (error) {
      Alert.alert("Erro", "Não foi possível alterar o status da aposta.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* HEADER HERO */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeftBar} />
          <View style={styles.heroContent}>
            <Text style={styles.heroIcon}>📚</Text>
            <View>
              <Text style={styles.heroTitle}>Gerenciar Rodada Copa</Text>
              <Text style={styles.heroTitleYear}>2026</Text>
              <Text style={styles.heroSubtitle}>
                Inteligência de exibição em tempo real
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>𝍖</Text>
          <Text style={styles.sectionTitle}>
            Gerenciamento ({jogos.length})
          </Text>
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Buscando jogos ao vivo...</Text>
        ) : (
          jogos.map((jogo) => {
            // Verifica no estado do Firebase se a aposta está aberta. Se não existir, assume false.
            const apostaAberta = configApostas[jogo.id] || false;

            return (
              <View style={styles.gameCard} key={jogo.id}>
                {/* Borda lateral colorida dependendo do status */}
                <View
                  style={[
                    styles.cardLeftBar,
                    jogo.status === "ao-vivo"
                      ? styles.barAoVivo
                      : styles.barAgendado,
                  ]}
                />

                <View style={styles.cardContent}>
                  {/* DATA E STATUS */}
                  <View style={styles.cardHeader}>
                    <Text style={styles.dateText}>{jogo.dataFormatada}</Text>
                    <View style={styles.statusBox}>
                      {jogo.status === "ao-vivo" ? (
                        <Text style={styles.statusAoVivo}>📺 AO VIVO</Text>
                      ) : (
                        <Text style={styles.statusAgendado}>📅 AGENDADO</Text>
                      )}
                    </View>
                  </View>

                  {/* TIMES E PLACAR */}
                  <View style={styles.teamsRow}>
                    <View style={styles.teamCol}>
                      <Image
                        source={{ uri: jogo.logoCasa }}
                        style={styles.flagImage}
                      />
                      <Text style={styles.teamName}>{jogo.timeCasa}</Text>
                    </View>

                    <View style={styles.scoreCol}>
                      {jogo.status === "agendado" ? (
                        <>
                          <Text style={styles.vsText}>VS</Text>
                          <Text style={styles.timeText}>{jogo.horaFormatada}</Text>
                        </>
                      ) : (
                        <Text style={styles.scoreText}>
                          {jogo.placarCasa} - {jogo.placarFora}
                        </Text>
                      )}
                    </View>

                    <View style={styles.teamCol}>
                      <Image
                        source={{ uri: jogo.logoFora }}
                        style={styles.flagImage}
                      />
                      <Text style={styles.teamName}>{jogo.timeFora}</Text>
                    </View>
                  </View>

                  {/* CAIXA DO SWITCH (APOSTAS ABERTAS/FECHADAS) */}
                  <View style={styles.toggleBox}>
                    <Text style={styles.toggleLabel}>
                      {apostaAberta ? "Apostas Abertas" : "Apostas Fechadas"}
                    </Text>
                    <Switch
                      trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
                      thumbColor={apostaAberta ? "#16A34A" : "#9CA3AF"}
                      onValueChange={() => toggleApostas(jogo.id, apostaAberta)}
                      value={apostaAberta}
                    />
                  </View>

                  {/* FOOTER */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>👥 0 aposta(s)</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* MENU INFERIOR - IDÊNTICO AO SEU */}
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
          <Text style={styles.menuIcon}>⚙️</Text>
          <Text style={styles.menuTextActive}>Gerenciar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  safeBlocked: { flex: 1, backgroundColor: "#F3F6F4" },

  scrollContent: { padding: 16, paddingBottom: 100 },

  // HERO (Cabeçalho branco com borda verde)
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    flexDirection: "row",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    marginBottom: 24,
    marginTop: 10,
  },
  heroLeftBar: {
    width: 6,
    backgroundColor: "#006B2E",
  },
  heroContent: {
    flex: 1,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  heroIcon: {
    fontSize: 34,
    marginRight: 16,
  },
  heroTitle: {
    color: "#006B2E",
    fontSize: 18,
    fontWeight: "900",
  },
  heroTitleYear: {
    color: "#006B2E",
    fontSize: 18,
    fontWeight: "900",
  },
  heroSubtitle: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  // TÍTULO DA SEÇÃO
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionIcon: {
    color: "#006B2E",
    fontSize: 18,
    fontWeight: "900",
    marginRight: 8,
  },
  sectionTitle: {
    color: "#006B2E",
    fontSize: 16,
    fontWeight: "900",
  },

  loadingText: {
    textAlign: "center",
    marginTop: 20,
    color: "#6B7280",
    fontWeight: "700",
  },

  // CARD DO JOGO
  gameCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    flexDirection: "row",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardLeftBar: {
    width: 5,
  },
  barAoVivo: { backgroundColor: "#EF4444" }, // Vermelho
  barAgendado: { backgroundColor: "#2DD4BF" }, // Turquesa

  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  dateText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "700",
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusAoVivo: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "900",
  },
  statusAgendado: {
    color: "#2DD4BF",
    fontSize: 12,
    fontWeight: "900",
  },

  // TIMES E PLACAR
  teamsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  teamCol: {
    flex: 1,
    alignItems: "center",
  },
  flagImage: {
    width: 48,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
    resizeMode: "cover",
  },
  teamName: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  scoreCol: {
    width: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    color: "#006B2E",
    fontSize: 26,
    fontWeight: "900",
  },
  vsText: {
    color: "#10B981",
    fontSize: 18,
    fontWeight: "900",
  },
  timeText: {
    color: "#006B2E",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  // CAIXA DO SWITCH
  toggleBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  toggleLabel: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },

  // FOOTER DO CARD
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  footerText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },

  // MENU INFERIOR
  bottomMenu: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 74,
    backgroundColor: "#111827", // Fundo escuro como no print
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
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
    color: "#9CA3AF",
    marginTop: 2,
    fontWeight: "700",
  },
  menuTextActive: {
    fontSize: 10,
    color: "#FFFFFF",
    marginTop: 2,
    fontWeight: "900",
  },

  // TELA DE BLOQUEIO PARA QUEM NÃO É ADMIN
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