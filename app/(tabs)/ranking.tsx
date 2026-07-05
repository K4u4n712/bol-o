import React, { useEffect, useMemo, useState } from "react";
import { mostrarAlerta } from "../../utils/mostrarAlerta";
import { router } from "expo-router";
import { db } from "../../services/firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";

type RankingItem = {
  nome: string;
  email: string;
  emailLower?: string;
  placar: string;
  pontos: number;
  venceu: boolean;
  premio?: number;
  premioRecebido?: number;
};

type ResultadoRanking = {
  id: string;
  jogoId: string;
  jogo: string;
  processado?: boolean;
  resultadoOficial?: {
    golsCasa?: number;
    golsFora?: number;
    placar?: string;
  };
  totalPalpites?: number;
  totalArrecadado?: number;
  taxaAdmin?: number;
  premioLiquido?: number;
  quantidadeGanhadores?: number;
  premioPorVencedor?: number;
  ganhadores?: any[];
  ranking?: RankingItem[];
  modoProcessamento?: string;
  processadoEmTexto?: string;
  processadoEm?: any;
  atualizadoEm?: any;
  preservadoEm?: any;
  criadoEm?: any;
  origemHistorico?: string;
};

type RankingGeralItem = {
  nome: string;
  email: string;
  pontos: number;
  vitorias: number;
  premios: number;
  jogos: number;
};

export default function RankingScreen() {
  const [resultadosAtuais, setResultadosAtuais] = useState<ResultadoRanking[]>([]);
  const [rankingHistorico, setRankingHistorico] = useState<ResultadoRanking[]>([]);

  useEffect(() => {
    const unsubscribeResultados = onSnapshot(
      collection(db, "resultados"),
      (snapshot) => {
        const lista: ResultadoRanking[] = snapshot.docs
          .map((documento) => normalizarResultado(documento.id, documento.data()))
          .filter((item) => item.processado && (item.ranking || []).length > 0);

        setResultadosAtuais(lista);
      },
      (error) => {
        console.log("Erro ao carregar resultados atuais:", error);
      }
    );

    const unsubscribeHistorico = onSnapshot(
      collection(db, "ranking_historico"),
      (snapshot) => {
        const lista: ResultadoRanking[] = snapshot.docs
          .map((documento) => normalizarResultado(documento.id, documento.data()))
          .filter((item) => (item.ranking || []).length > 0);

        setRankingHistorico(lista);
      },
      (error) => {
        console.log("Erro ao carregar ranking histórico:", error);
      }
    );

    return () => {
      unsubscribeResultados();
      unsubscribeHistorico();
    };
  }, []);

  const rankingsSalvos = useMemo(() => {
    const mapa: Record<string, ResultadoRanking> = {};

    // O histórico vem primeiro porque ele é a cópia permanente.
    rankingHistorico.forEach((item) => {
      mapa[item.jogoId || item.id] = item;
    });

    // Se ainda não houve "zerar jogo", o resultado atual também aparece.
    resultadosAtuais.forEach((item) => {
      const chave = item.jogoId || item.id;

      if (!mapa[chave]) {
        mapa[chave] = item;
      }
    });

    return Object.values(mapa).sort((a, b) => {
      const dataB = pegarMillis(b.atualizadoEm || b.preservadoEm || b.processadoEm || b.criadoEm);
      const dataA = pegarMillis(a.atualizadoEm || a.preservadoEm || a.processadoEm || a.criadoEm);

      return dataB - dataA;
    });
  }, [resultadosAtuais, rankingHistorico]);

  const rankingGeral = useMemo(() => {
    const mapa: Record<string, RankingGeralItem> = {};

    rankingsSalvos.forEach((resultado) => {
      (resultado.ranking || []).forEach((item) => {
        const email = String(item.email || item.emailLower || "").trim().toLowerCase();
        const chave = email || normalizarTexto(item.nome || "Usuário");
        const premio = Number(item.premioRecebido ?? item.premio ?? 0);

        if (!mapa[chave]) {
          mapa[chave] = {
            nome: item.nome || "Usuário",
            email: email || item.email || "",
            pontos: 0,
            vitorias: 0,
            premios: 0,
            jogos: 0,
          };
        }

        mapa[chave].pontos += Number(item.pontos || 0);
        mapa[chave].vitorias += item.venceu ? 1 : 0;
        mapa[chave].premios += premio;
        mapa[chave].jogos += 1;
      });
    });

    return Object.values(mapa).sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
      if (b.premios !== a.premios) return b.premios - a.premios;
      return a.nome.localeCompare(b.nome);
    });
  }, [rankingsSalvos]);

  function normalizarResultado(id: string, data: any): ResultadoRanking {
    return {
      id,
      jogoId: String(data.jogoId || id),
      jogo: data.jogo || "Jogo",
      processado: Boolean(data.processado ?? true),
      resultadoOficial: data.resultadoOficial || null,
      totalPalpites: Number(data.totalPalpites || 0),
      totalArrecadado: Number(data.totalArrecadado || 0),
      taxaAdmin: Number(data.taxaAdmin || 0),
      premioLiquido: Number(data.premioLiquido || 0),
      quantidadeGanhadores: Number(data.quantidadeGanhadores || 0),
      premioPorVencedor: Number(data.premioPorVencedor || 0),
      ganhadores: Array.isArray(data.ganhadores) ? data.ganhadores : [],
      ranking: Array.isArray(data.ranking) ? data.ranking : [],
      modoProcessamento: data.modoProcessamento || "",
      processadoEmTexto: data.processadoEmTexto || "",
      processadoEm: data.processadoEm,
      atualizadoEm: data.atualizadoEm,
      preservadoEm: data.preservadoEm,
      criadoEm: data.criadoEm,
      origemHistorico: data.origemHistorico || "",
    };
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

  function normalizarTexto(texto: string) {
    return String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatarMoeda(valor: number) {
    return `${Number(valor || 0).toFixed(2)} BRL`;
  }

  function posicao(index: number) {
    return `${index + 1}º`;
  }

  function textoResultado(resultado: ResultadoRanking) {
    if (resultado.resultadoOficial?.placar) {
      return resultado.resultadoOficial.placar;
    }

    const golsCasa = resultado.resultadoOficial?.golsCasa;
    const golsFora = resultado.resultadoOficial?.golsFora;

    if (typeof golsCasa === "number" && typeof golsFora === "number") {
      return `${golsCasa} x ${golsFora}`;
    }

    return "Resultado salvo";
  }

  function textoDataResultado(resultado: ResultadoRanking) {
    if (resultado.processadoEmTexto) {
      return resultado.processadoEmTexto;
    }

    const millis = pegarMillis(
      resultado.atualizadoEm ||
        resultado.preservadoEm ||
        resultado.processadoEm ||
        resultado.criadoEm
    );

    if (!millis) return "Data não informada";

    return new Date(millis).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function abrirInstrucoes() {
    mostrarAlerta(
      "Como funciona o ranking?",
      "Placar exato: 10 pontos.\n\nAcertou apenas o vencedor ou empate: 3 pontos.\n\nErrou tudo: 0 pontos.\n\nAgora o ranking fica salvo no histórico mesmo depois de zerar o jogo."
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#006B2E" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/")}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Ranking</Text>

        <TouchableOpacity style={styles.headerCircle} onPress={abrirInstrucoes}>
          <Text style={styles.headerIcon}>🏆</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroBadge}>🏆 RANKING PERMANENTE</Text>

          <Text style={styles.heroTitle}>
            {rankingsSalvos.length > 0 ? "Histórico salvo" : "Aguardando ranking"}
          </Text>

          <Text style={styles.heroText}>
            {rankingsSalvos.length > 0
              ? "Os rankings ficam salvos mesmo depois que o administrador zera o jogo."
              : "Assim que um resultado for calculado no painel admin, o ranking aparecerá aqui."}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Classificação geral</Text>

        {rankingGeral.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Ranking ainda não calculado</Text>
            <Text style={styles.emptyText}>
              Finalize um jogo no painel admin para salvar o primeiro ranking.
            </Text>
          </View>
        )}

        {rankingGeral.map((item, index) => (
          <View
            style={[
              styles.rankingCard,
              index === 0 && styles.rankingCardFirst,
            ]}
            key={`${item.email || item.nome}-${index}`}
          >
            <View
              style={[
                styles.positionCircle,
                index === 0 && styles.positionFirst,
              ]}
            >
              <Text style={styles.positionText}>{posicao(index)}</Text>
            </View>

            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{item.nome}</Text>

              <Text style={styles.playerBet}>
                {item.jogos} jogo(s) no histórico
              </Text>

              <Text style={[styles.playerStatus, item.vitorias > 0 && styles.winnerStatus]}>
                {item.vitorias > 0
                  ? `🏆 ${item.vitorias} vitória(s) • ${formatarMoeda(item.premios)}`
                  : "Ainda não venceu bolão"}
              </Text>
            </View>

            <View style={styles.pointsBox}>
              <Text style={styles.points}>{item.pontos}</Text>
              <Text style={styles.pointsLabel}>pts</Text>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Rankings por jogo</Text>

        {rankingsSalvos.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum histórico salvo</Text>
            <Text style={styles.emptyText}>
              O histórico será criado automaticamente quando o admin calcular os vencedores.
            </Text>
          </View>
        )}

        {rankingsSalvos.map((resultado) => {
          const rankingDoJogo = resultado.ranking || [];
          const topRanking = rankingDoJogo.slice(0, 10);

          return (
            <View style={styles.historyCard} key={resultado.jogoId || resultado.id}>
              <View style={styles.historyHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyBadge}>RANKING SALVO</Text>
                  <Text style={styles.historyTitle}>{resultado.jogo}</Text>
                  <Text style={styles.historySub}>
                    Resultado: {textoResultado(resultado)}
                  </Text>
                  <Text style={styles.historyDate}>
                    {textoDataResultado(resultado)}
                  </Text>
                </View>

                <View style={styles.historyMiniBox}>
                  <Text style={styles.historyMiniNumber}>
                    {resultado.totalPalpites || rankingDoJogo.length}
                  </Text>
                  <Text style={styles.historyMiniLabel}>palpites</Text>
                </View>
              </View>

              <View style={styles.historyStats}>
                <Text style={styles.historyStatText}>
                  Total: {formatarMoeda(resultado.totalArrecadado || 0)}
                </Text>
                <Text style={styles.historyStatText}>
                  Prêmio: {formatarMoeda(resultado.premioLiquido || 0)}
                </Text>
                <Text style={styles.historyStatText}>
                  Ganhadores: {resultado.quantidadeGanhadores || 0}
                </Text>
              </View>

              {topRanking.map((item, index) => {
                const premio = Number(item.premioRecebido ?? item.premio ?? 0);

                return (
                  <View style={styles.historyPlayerRow} key={`${resultado.jogoId}-${item.email}-${index}`}>
                    <Text style={styles.historyPosition}>{posicao(index)}</Text>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyPlayerName}>{item.nome}</Text>
                      <Text style={styles.historyPlayerBet}>
                        Palpite: {item.placar || "-"}
                      </Text>
                    </View>

                    <View style={styles.historyPointsBox}>
                      <Text style={styles.historyPoints}>{item.pontos || 0}</Text>
                      <Text style={styles.historyPointsLabel}>pts</Text>
                      {item.venceu && (
                        <Text style={styles.historyPrize}>
                          {formatarMoeda(premio)}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Pontuação</Text>

          <Text style={styles.infoText}>
            Placar exato: 10 pontos. Acertou apenas vencedor ou empate: 3 pontos.
            Errou tudo: 0 pontos. O histórico não é apagado quando o jogo é zerado.
          </Text>
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

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/cassino")}
        >
          <Text style={styles.menuIcon}>🎰</Text>
          <Text style={styles.menuText}>Cassino</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItemActive}>
          <Text style={styles.menuIcon}>🏆</Text>
          <Text style={styles.menuTextActive}>Ranking</Text>
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
  safe: { flex: 1, backgroundColor: "#F3F6F4" },

  header: {
    backgroundColor: "#006B2E",
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
  headerTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },

  headerCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  headerIcon: { fontSize: 23 },

  scroll: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 105,
  },

  heroCard: {
    backgroundColor: "#006B2E",
    borderRadius: 28,
    padding: 24,
    elevation: 4,
  },

  heroBadge: {
    color: "#FFD500",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 18,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
  },

  heroText: {
    color: "#DFFFEA",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 27,
    marginTop: 12,
  },

  sectionTitle: {
    color: "#111827",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 28,
    marginBottom: 16,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    elevation: 3,
  },

  emptyTitle: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
  },

  emptyText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },

  rankingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    elevation: 3,
  },

  rankingCardFirst: {
    backgroundColor: "#FFF6BF",
    borderWidth: 1.5,
    borderColor: "#FFD500",
  },

  positionCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#E7FBEF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  positionFirst: {
    backgroundColor: "#FFD500",
  },

  positionText: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
  },

  playerInfo: {
    flex: 1,
  },

  playerName: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
  },

  playerBet: {
    color: "#4B5563",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },

  playerStatus: {
    color: "#006B2E",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 6,
  },

  winnerStatus: {
    color: "#B45309",
  },

  pointsBox: {
    alignItems: "center",
    marginLeft: 8,
  },

  points: {
    color: "#006B2E",
    fontSize: 36,
    fontWeight: "900",
  },

  pointsLabel: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "900",
  },

  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 18,
    marginBottom: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  historyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  historyBadge: {
    color: "#006B2E",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },

  historyTitle: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 27,
  },

  historySub: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 5,
  },

  historyDate: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  historyMiniBox: {
    minWidth: 72,
    borderRadius: 18,
    backgroundColor: "#E7FBEF",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },

  historyMiniNumber: {
    color: "#006B2E",
    fontSize: 22,
    fontWeight: "900",
  },

  historyMiniLabel: {
    color: "#4B5563",
    fontSize: 11,
    fontWeight: "900",
  },

  historyStats: {
    backgroundColor: "#F3F6F4",
    borderRadius: 18,
    padding: 12,
    marginTop: 14,
  },

  historyStatText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 3,
  },

  historyPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  historyPosition: {
    width: 40,
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },

  historyPlayerName: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },

  historyPlayerBet: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },

  historyPointsBox: {
    alignItems: "center",
    minWidth: 74,
  },

  historyPoints: {
    color: "#006B2E",
    fontSize: 23,
    fontWeight: "900",
  },

  historyPointsLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "800",
  },

  historyPrize: {
    color: "#B45309",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },

  infoBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginTop: 18,
    elevation: 2,
  },

  infoTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },

  infoText: {
    color: "#4B5563",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 26,
  },

  bottomSpace: { height: 20 },

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