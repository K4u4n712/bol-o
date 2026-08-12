import { router } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { bonde62Auth } from "../services/bonde62Firebase";

const API_MEUS_INGRESSOS_URL =
  "https://bol-o-rouge.vercel.app/api/meus-ingressos";

type TicketStatus = "valid" | "used" | "expired" | "pending";

type Ingresso = {
  id: string;
  codigo: string;
  status: TicketStatus;
  nome: string;
  email: string;
  quantidade: number;
  valor: number;
  lote: string;
  evento: string;
  order_nsu: string;
  order_id?: string | null;
  qr_code_base64?: string | null;
  criadoEm?: number;
  aprovadoEm?: number;
  utilizadoEm?: number;
  validadeTexto?: string;
};

type Aba = "ativos" | "historico" | "todos";

function formatarMoeda(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(timestamp?: number) {
  if (!timestamp) return "—";

  return new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusVisual(status: TicketStatus) {
  if (status === "valid") {
    return {
      label: "VÁLIDO",
      icon: "✓",
      className: "valid",
    };
  }

  if (status === "used") {
    return {
      label: "UTILIZADO",
      icon: "✓",
      className: "used",
    };
  }

  if (status === "expired") {
    return {
      label: "EXPIRADO",
      icon: "×",
      className: "expired",
    };
  }

  return {
    label: "AGUARDANDO",
    icon: "◷",
    className: "pending",
  };
}

export default function MeusIngressos() {
  const [user, setUser] = useState<any>(null);
  const [authCarregando, setAuthCarregando] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ingressos, setIngressos] = useState<Ingresso[]>([]);
  const [aba, setAba] = useState<Aba>("ativos");
  const [selecionado, setSelecionado] = useState<Ingresso | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(bonde62Auth, (usuario) => {
      setUser(usuario);
      setAuthCarregando(false);

      if (!usuario) {
        setCarregando(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    carregarIngressos();
  }, [user]);

  async function carregarIngressos() {
    try {
      setCarregando(true);
      setErro("");

      const token = await user.getIdToken(true);

      const response = await fetch(API_MEUS_INGRESSOS_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErro(
          data?.message ||
            "Não foi possível carregar seus ingressos."
        );
        return;
      }

      setIngressos(Array.isArray(data.ingressos) ? data.ingressos : []);
    } catch (error) {
      console.log("Erro ao carregar ingressos:", error);
      setErro("Não foi possível carregar seus ingressos agora.");
    } finally {
      setCarregando(false);
    }
  }

  async function sair() {
    await signOut(bonde62Auth);
    router.replace("/bonde62");
  }

  const ativos = useMemo(
    () => ingressos.filter((ticket) => ticket.status === "valid"),
    [ingressos]
  );

  const historico = useMemo(
    () =>
      ingressos.filter(
        (ticket) =>
          ticket.status === "used" ||
          ticket.status === "expired"
      ),
    [ingressos]
  );

  const lista = useMemo(() => {
    if (aba === "ativos") return ativos;
    if (aba === "historico") return historico;
    return ingressos;
  }, [aba, ativos, historico, ingressos]);

  const iniciais = useMemo(() => {
    const email = String(user?.email || "");
    const primeiro = email.charAt(0).toUpperCase() || "B";
    return primeiro;
  }, [user?.email]);

  if (authCarregando) {
    return (
      <View style={styles.centerPage}>
        <ActivityIndicator size="large" color="#ff1684" />
        <Text style={styles.loadingText}>Carregando sua conta...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerPage}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🎟️</Text>
          <Text style={styles.emptyTitle}>Entre para ver seus ingressos</Text>
          <Text style={styles.emptyText}>
            Use o mesmo e-mail informado na compra.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/bonde62-conta")}
          >
            <Text style={styles.primaryButtonText}>ENTRAR / CRIAR SENHA</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/bonde62")}
          >
            <Text style={styles.secondaryButtonText}>VOLTAR AO BONDE 62</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
      >
        <View style={styles.glowPink} />
        <View style={styles.glowPurple} />

        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => router.push("/bonde62")}>
            <Text style={styles.brand}>
              BONDE <Text style={styles.pink}>62</Text>
            </Text>
            <Text style={styles.brandSub}>O BAILE</Text>
          </TouchableOpacity>

          <View style={styles.nav}>
            <TouchableOpacity onPress={() => router.push("/bonde62")}>
              <Text style={styles.navText}>INÍCIO</Text>
            </TouchableOpacity>

            <Text style={[styles.navText, styles.navActive]}>
              MEUS INGRESSOS
            </Text>

            <TouchableOpacity onPress={sair}>
              <Text style={styles.navText}>SAIR</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{iniciais}</Text>
            </View>

            <View>
              <Text style={styles.profileName}>Minha conta</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.container}>
          <Text style={styles.title}>
            Meus <Text style={styles.pink}>Ingressos</Text>
          </Text>
          <Text style={styles.subtitle}>
            Acesse seus ingressos comprados, consulte o status e apresente
            o QR Code na entrada.
          </Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNumber}>{ingressos.length}</Text>
              <Text style={styles.summaryLabel}>Ingressos comprados</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={[styles.summaryNumber, styles.green]}>
                {ativos.length}
              </Text>
              <Text style={styles.summaryLabel}>Ingressos ativos</Text>
            </View>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, aba === "ativos" && styles.tabActive]}
              onPress={() => setAba("ativos")}
            >
              <Text
                style={[
                  styles.tabText,
                  aba === "ativos" && styles.tabTextActive,
                ]}
              >
                Ingressos ativos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, aba === "historico" && styles.tabActive]}
              onPress={() => setAba("historico")}
            >
              <Text
                style={[
                  styles.tabText,
                  aba === "historico" && styles.tabTextActive,
                ]}
              >
                Histórico
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, aba === "todos" && styles.tabActive]}
              onPress={() => setAba("todos")}
            >
              <Text
                style={[
                  styles.tabText,
                  aba === "todos" && styles.tabTextActive,
                ]}
              >
                Todas as compras
              </Text>
            </TouchableOpacity>
          </View>

          {carregando ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#ff1684" size="large" />
              <Text style={styles.stateText}>Buscando seus ingressos...</Text>
            </View>
          ) : erro ? (
            <View style={styles.stateBox}>
              <Text style={styles.errorTitle}>Não foi possível carregar</Text>
              <Text style={styles.stateText}>{erro}</Text>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={carregarIngressos}
              >
                <Text style={styles.smallButtonText}>TENTAR NOVAMENTE</Text>
              </TouchableOpacity>
            </View>
          ) : lista.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.emptyIcon}>🎟️</Text>
              <Text style={styles.errorTitle}>
                Nenhum ingresso nesta categoria
              </Text>
              <Text style={styles.stateText}>
                Se você acabou de pagar, aguarde alguns segundos e atualize.
              </Text>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={carregarIngressos}
              >
                <Text style={styles.smallButtonText}>ATUALIZAR</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.ticketList}>
              {lista.map((ticket) => {
                const visual = statusVisual(ticket.status);

                return (
                  <View key={ticket.id} style={styles.ticketCard}>
                    <View style={styles.ticketTop}>
                      <View style={styles.eventBadge}>
                        <Text style={styles.eventBadgeText}>18+</Text>
                      </View>

                      <View style={styles.ticketMain}>
                        <View style={styles.ticketHeaderRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ticketTitle}>
                              BONDE 62 — O BAILE
                            </Text>
                            <Text style={styles.ticketMeta}>
                              Goiânia • Open Bar • Evento 18+
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.statusBadge,
                              ticket.status === "valid" &&
                                styles.statusBadgeValid,
                              ticket.status === "used" &&
                                styles.statusBadgeUsed,
                              ticket.status === "expired" &&
                                styles.statusBadgeExpired,
                              ticket.status === "pending" &&
                                styles.statusBadgePending,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusText,
                                ticket.status === "valid" &&
                                  styles.statusTextValid,
                              ]}
                            >
                              {visual.icon} {visual.label}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.ticketDetailsRow}>
                          <View style={styles.detailBox}>
                            <Text style={styles.detailLabel}>TITULAR</Text>
                            <Text style={styles.detailValue}>
                              {ticket.nome || "—"}
                            </Text>
                          </View>

                          <View style={styles.detailBox}>
                            <Text style={styles.detailLabel}>QUANTIDADE</Text>
                            <Text style={styles.detailValue}>
                              {ticket.quantidade}
                            </Text>
                          </View>

                          <View style={styles.detailBox}>
                            <Text style={styles.detailLabel}>COMPRA</Text>
                            <Text style={styles.detailValue}>
                              {formatarData(ticket.aprovadoEm || ticket.criadoEm)}
                            </Text>
                          </View>

                          <View style={styles.detailBox}>
                            <Text style={styles.detailLabel}>VALOR</Text>
                            <Text style={styles.detailValue}>
                              {formatarMoeda(ticket.valor)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.codeRow}>
                          <View>
                            <Text style={styles.detailLabel}>
                              CÓDIGO DO INGRESSO
                            </Text>
                            <Text style={styles.ticketCode}>
                              {ticket.codigo}
                            </Text>
                          </View>

                          <Text style={styles.validity}>
                            {ticket.validadeTexto}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.ticketActions}>
                      <View style={styles.loteBadge}>
                        <Text style={styles.loteBadgeText}>
                          {String(ticket.lote)
                            .replace(/_/g, " ")
                            .toUpperCase()}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => setSelecionado(ticket)}
                      >
                        <Text style={styles.viewButtonText}>
                          VER INGRESSO →
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.infoStrip}>
            <Text style={styles.infoStripText}>
              ⓘ Apresente o QR Code do ingresso junto com um documento com foto
              na entrada do evento.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(selecionado)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelecionado(null)}
      >
        <View style={styles.modalOverlay}>
          {selecionado ? (
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalBrand}>
                    BONDE <Text style={styles.pink}>62</Text>
                  </Text>
                  <Text style={styles.brandSub}>O BAILE</Text>
                </View>

                <TouchableOpacity onPress={() => setSelecionado(null)}>
                  <Text style={styles.modalClose}>×</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalKicker}>SEU INGRESSO</Text>

              {selecionado.qr_code_base64 ? (
                <View style={styles.qrBox}>
                  <Image
                    source={{ uri: selecionado.qr_code_base64 }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <View style={styles.qrUnavailable}>
                  <Text style={styles.qrUnavailableText}>
                    QR disponível após confirmação do pagamento
                  </Text>
                </View>
              )}

              <Text style={styles.modalCode}>{selecionado.codigo}</Text>

              <View style={styles.modalDivider} />

              <View style={styles.modalInfoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>TITULAR</Text>
                  <Text style={styles.modalValue}>{selecionado.nome}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>QUANTIDADE</Text>
                  <Text style={styles.modalValue}>
                    {selecionado.quantidade}
                  </Text>
                </View>
              </View>

              <Text style={styles.modalSecurity}>
                🔒 QR Code de uso único. Apresente-o na entrada junto com um
                documento com foto.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setSelecionado(null)}
              >
                <Text style={styles.primaryButtonText}>FECHAR</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#050008",
  },
  pageContent: {
    minHeight: "100%" as any,
    paddingBottom: 60,
    overflow: "hidden",
  },
  centerPage: {
    flex: 1,
    minHeight: "100%" as any,
    backgroundColor: "#050008",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#fff",
    marginTop: 14,
    fontWeight: "700",
  },
  glowPink: {
    position: "absolute",
    width: 560,
    height: 560,
    borderRadius: 280,
    backgroundColor: "rgba(255,22,132,0.14)",
    right: -200,
    top: -160,
  },
  glowPurple: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: "rgba(120,0,255,0.13)",
    left: -200,
    bottom: -160,
  },
  topbar: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    paddingHorizontal: 24,
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },
  brand: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "900",
  },
  brandSub: {
    color: "#ff1684",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 4,
  },
  pink: {
    color: "#ff1684",
  },
  nav: {
    flexDirection: "row",
    gap: 24,
    alignItems: "center",
  },
  navText: {
    color: "#b8aabd",
    fontSize: 11,
    fontWeight: "900",
  },
  navActive: {
    color: "#ff1684",
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ff1684",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "900",
  },
  profileName: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  profileEmail: {
    color: "#8d7f96",
    fontSize: 9,
    marginTop: 2,
  },
  container: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 44,
  },
  title: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#a99db2",
    textAlign: "center",
    marginTop: 8,
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginTop: 28,
    flexWrap: "wrap",
  },
  summaryCard: {
    minWidth: 170,
    backgroundColor: "#120018",
    borderColor: "rgba(255,22,132,0.28)",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: "center",
  },
  summaryNumber: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 28,
  },
  green: {
    color: "#18c96e",
  },
  summaryLabel: {
    color: "#a99db2",
    fontSize: 10,
    marginTop: 4,
    fontWeight: "700",
  },
  tabs: {
    flexDirection: "row",
    alignSelf: "center",
    marginTop: 34,
    backgroundColor: "#0c0011",
    borderRadius: 14,
    padding: 4,
    flexWrap: "wrap",
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: "#ff1684",
  },
  tabText: {
    color: "#8f8298",
    fontWeight: "900",
    fontSize: 11,
  },
  tabTextActive: {
    color: "#fff",
  },
  ticketList: {
    gap: 16,
    marginTop: 28,
  },
  ticketCard: {
    backgroundColor: "#120018",
    borderColor: "rgba(255,22,132,0.32)",
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  ticketTop: {
    flexDirection: "row",
  },
  eventBadge: {
    width: 120,
    minHeight: 190,
    backgroundColor: "#25002f",
    alignItems: "center",
    justifyContent: "center",
  },
  eventBadgeText: {
    color: "#ff1684",
    fontSize: 34,
    fontWeight: "900",
  },
  ticketMain: {
    flex: 1,
    padding: 20,
  },
  ticketHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  ticketTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 20,
  },
  ticketMeta: {
    color: "#96899f",
    fontSize: 11,
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
  },
  statusBadgeValid: {
    borderColor: "#18c96e",
    backgroundColor: "rgba(24,201,110,0.10)",
  },
  statusBadgeUsed: {
    borderColor: "#6c6273",
    backgroundColor: "rgba(108,98,115,0.14)",
  },
  statusBadgeExpired: {
    borderColor: "#ff5068",
    backgroundColor: "rgba(255,80,104,0.10)",
  },
  statusBadgePending: {
    borderColor: "#e0a427",
    backgroundColor: "rgba(224,164,39,0.10)",
  },
  statusText: {
    color: "#d0c7d5",
    fontWeight: "900",
    fontSize: 10,
  },
  statusTextValid: {
    color: "#18c96e",
  },
  ticketDetailsRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 22,
    flexWrap: "wrap",
  },
  detailBox: {
    minWidth: 110,
  },
  detailLabel: {
    color: "#7f7288",
    fontSize: 9,
    letterSpacing: 1.3,
    fontWeight: "900",
  },
  detailValue: {
    color: "#fff",
    fontWeight: "800",
    marginTop: 5,
    fontSize: 12,
  },
  codeRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    flexWrap: "wrap",
  },
  ticketCode: {
    color: "#ff1684",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 5,
  },
  validity: {
    color: "#8e8197",
    fontSize: 10,
  },
  ticketActions: {
    borderTopColor: "rgba(255,255,255,0.06)",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    paddingLeft: 140,
    gap: 12,
  },
  loteBadge: {
    borderColor: "rgba(255,22,132,0.42)",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  loteBadgeText: {
    color: "#ff1684",
    fontWeight: "900",
    fontSize: 9,
  },
  viewButton: {
    backgroundColor: "#ff1684",
    borderRadius: 11,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  viewButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 10,
  },
  stateBox: {
    marginTop: 28,
    borderColor: "rgba(255,22,132,0.25)",
    borderWidth: 1,
    borderRadius: 20,
    backgroundColor: "#100016",
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  stateText: {
    color: "#9c8fa5",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  errorTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 18,
  },
  smallButton: {
    marginTop: 16,
    backgroundColor: "#ff1684",
    borderRadius: 11,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  smallButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 10,
  },
  infoStrip: {
    marginTop: 22,
    borderColor: "rgba(255,22,132,0.30)",
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: "#0f0015",
    padding: 14,
  },
  infoStripText: {
    color: "#b4a7bd",
    textAlign: "center",
    fontSize: 11,
  },
  emptyCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#120018",
    borderColor: "rgba(255,22,132,0.45)",
    borderWidth: 1,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 42,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 10,
  },
  emptyText: {
    color: "#a99db2",
    textAlign: "center",
    marginTop: 8,
  },
  primaryButton: {
    width: "100%",
    marginTop: 20,
    backgroundColor: "#ff1684",
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
  secondaryButton: {
    width: "100%",
    marginTop: 10,
    borderColor: "rgba(255,22,132,0.45)",
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#120018",
    borderColor: "#ff1684",
    borderWidth: 1,
    borderRadius: 26,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalBrand: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "900",
  },
  modalClose: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "300",
  },
  modalKicker: {
    color: "#ff1684",
    textAlign: "center",
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: 11,
    marginTop: 18,
  },
  qrBox: {
    alignSelf: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 18,
    marginTop: 15,
  },
  qrImage: {
    width: 210,
    height: 210,
  },
  qrUnavailable: {
    marginTop: 15,
    minHeight: 150,
    borderColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  qrUnavailableText: {
    color: "#92859b",
    textAlign: "center",
  },
  modalCode: {
    color: "#ff1684",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 19,
    letterSpacing: 1,
    marginTop: 14,
  },
  modalDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 18,
  },
  modalInfoRow: {
    flexDirection: "row",
    gap: 14,
  },
  modalValue: {
    color: "#fff",
    fontWeight: "900",
    marginTop: 5,
  },
  modalSecurity: {
    color: "#a99db2",
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 18,
  },
});