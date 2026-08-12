import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const API_VALIDAR_INGRESSO_URL =
  "https://bol-o-rouge.vercel.app/api/validar-ingresso";

type Ticket = {
  id?: string;
  codigo?: string;
  nome?: string;
  email?: string;
  quantidade?: number;
  lote?: string;
  valor?: number;
  utilizadoEmTexto?: string;
  validadoEmTexto?: string;
};

type Dashboard = {
  summary: {
    totalAprovados: number;
    totalValidados: number;
    totalDisponiveis: number;
    ultimoValidadoEm?: string;
  };
  history: Ticket[];
} | null;

type Resultado =
  | {
      type: "valid";
      title: string;
      message: string;
      ticket?: Ticket;
    }
  | {
      type: "used";
      title: string;
      message: string;
      ticket?: Ticket;
    }
  | {
      type: "invalid";
      title: string;
      message: string;
      ticket?: Ticket;
    }
  | null;

type TabType = "scanner" | "codigo" | "historico";

export default function ValidarIngresso() {
  const [permission, requestPermission] = useCameraPermissions();

  const [pin, setPin] = useState("");
  const [pinLiberado, setPinLiberado] = useState(false);

  const [scannerAtivo, setScannerAtivo] = useState(true);
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);
  const [ultimoValorLido, setUltimoValorLido] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<TabType>("scanner");

  const [codigoManual, setCodigoManual] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard>(null);
  const [carregandoPainel, setCarregandoPainel] = useState(false);

  const cameraLiberada = useMemo(
    () => Boolean(permission?.granted),
    [permission?.granted]
  );

  async function liberarAcesso() {
    if (!pin.trim()) {
      Alert.alert("PIN obrigatório", "Digite o PIN da portaria.");
      return;
    }

    setPinLiberado(true);
    setScannerAtivo(true);
    await carregarPainel(pin.trim());
  }

  async function carregarPainel(pinAtual = pin.trim()) {
    if (!pinAtual) return;

    setCarregandoPainel(true);

    try {
      const response = await fetch(
        `${API_VALIDAR_INGRESSO_URL}?mode=dashboard&pin=${encodeURIComponent(
          pinAtual
        )}`,
        {
          method: "GET",
          headers: {
            "X-Validator-Pin": pinAtual,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        setPinLiberado(false);
        Alert.alert("PIN inválido", "O PIN da portaria não foi aceito.");
        return;
      }

      if (!response.ok || !data?.success) {
        return;
      }

      setDashboard({
        summary: {
          totalAprovados: Number(data?.summary?.totalAprovados || 0),
          totalValidados: Number(data?.summary?.totalValidados || 0),
          totalDisponiveis: Number(data?.summary?.totalDisponiveis || 0),
          ultimoValidadoEm: data?.summary?.ultimoValidadoEm || "",
        },
        history: Array.isArray(data?.history) ? data.history : [],
      });
    } catch (error) {
      console.log("Erro ao carregar painel:", error);
    } finally {
      setCarregandoPainel(false);
    }
  }

  async function enviarValidacao(payload: { qr?: string; code?: string }) {
    if (validando) return;

    setScannerAtivo(false);
    setValidando(true);

    try {
      const response = await fetch(API_VALIDAR_INGRESSO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Validator-Pin": pin.trim(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        setPinLiberado(false);
        setResultado({
          type: "invalid",
          title: "PIN INVÁLIDO",
          message: data?.message || "O PIN informado não foi aceito.",
        });
        return;
      }

      if (data?.status === "used") {
        setResultado({
          type: "used",
          title: "INGRESSO JÁ UTILIZADO",
          message:
            data?.message ||
            "Este ingresso já foi utilizado anteriormente.",
          ticket: data?.ticket,
        });
        await carregarPainel();
        return;
      }

      if (!response.ok || !data?.success) {
        setResultado({
          type: "invalid",
          title: "INGRESSO INVÁLIDO",
          message:
            data?.message ||
            "Este ingresso não é válido ou ainda não foi aprovado.",
          ticket: data?.ticket,
        });
        await carregarPainel();
        return;
      }

      setResultado({
        type: "valid",
        title: "ENTRADA LIBERADA",
        message: "Ingresso validado com sucesso.",
        ticket: data?.ticket,
      });

      setCodigoManual("");
      await carregarPainel();
    } catch (error) {
      console.log("Erro ao validar ingresso:", error);

      setResultado({
        type: "invalid",
        title: "ERRO AO VALIDAR",
        message:
          "Não foi possível conectar ao servidor. Verifique a internet e tente novamente.",
      });
    } finally {
      setValidando(false);
    }
  }

  async function validarQr(qrData: string) {
    if (!scannerAtivo || validando || !qrData) return;

    setUltimoValorLido(qrData);
    await enviarValidacao({ qr: qrData });
  }

  async function validarCodigoManual() {
    const codigo = codigoManual.trim().toUpperCase();

    if (!codigo) {
      Alert.alert(
        "Código obrigatório",
        "Digite o código do ingresso para validar manualmente."
      );
      return;
    }

    setUltimoValorLido(codigo);
    await enviarValidacao({ code: codigo });
  }

  function escanearProximo() {
    setResultado(null);
    setUltimoValorLido("");
    setScannerAtivo(true);
  }

  function trocarPin() {
    setPinLiberado(false);
    setPin("");
    setScannerAtivo(true);
    setResultado(null);
    setDashboard(null);
  }

  function formatMoney(value?: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value || 0));
  }

  if (!pinLiberado) {
    return (
      <View style={styles.pageCenter}>
        <View style={styles.loginCard}>
          <Text style={styles.brand}>
            BONDE <Text style={styles.pink}>62</Text>
          </Text>
          <Text style={styles.brandSub}>VALIDADOR OFICIAL</Text>

          <Text style={styles.loginTitle}>Acesso da portaria</Text>
          <Text style={styles.loginText}>
            Digite o PIN para liberar o painel de validação de ingressos.
          </Text>

          <TextInput
            style={styles.pinInput}
            value={pin}
            onChangeText={setPin}
            placeholder="PIN da portaria"
            placeholderTextColor="#7e7187"
            secureTextEntry
            keyboardType="number-pad"
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={liberarAcesso}
          >
            <Text style={styles.primaryButtonText}>ENTRAR NO PAINEL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/bonde62")}
          >
            <Text style={styles.secondaryButtonText}>VOLTAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>
                BONDE <Text style={styles.pink}>62</Text>
              </Text>
              <Text style={styles.brandSub}>PAINEL DE VALIDAÇÃO</Text>
            </View>

            <TouchableOpacity style={styles.smallAction} onPress={trocarPin}>
              <Text style={styles.smallActionText}>TROCAR PIN</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>PORTARIA / CHECK-IN</Text>
            <Text style={styles.heroTitle}>Validação de ingressos</Text>
            <Text style={styles.heroText}>
              Escaneie o QR Code ou digite o código do ingresso manualmente.
            </Text>
          </View>

          <View style={styles.statsRow}>
            <StatCard
              label="Já validados"
              value={dashboard?.summary?.totalValidados ?? 0}
              accent="#18d26b"
            />
            <StatCard
              label="Ainda disponíveis"
              value={dashboard?.summary?.totalDisponiveis ?? 0}
              accent="#ffca3a"
            />
            <StatCard
              label="Total aprovados"
              value={dashboard?.summary?.totalAprovados ?? 0}
              accent="#ff1684"
            />
          </View>

          <View style={styles.lastValidationBox}>
            <Text style={styles.lastValidationLabel}>ÚLTIMA VALIDAÇÃO</Text>
            <Text style={styles.lastValidationValue}>
              {dashboard?.summary?.ultimoValidadoEm || "Nenhuma ainda"}
            </Text>
          </View>

          <View style={styles.tabs}>
            <TabButton
              active={abaAtiva === "scanner"}
              label="QR Code"
              onPress={() => setAbaAtiva("scanner")}
            />
            <TabButton
              active={abaAtiva === "codigo"}
              label="Código"
              onPress={() => setAbaAtiva("codigo")}
            />
            <TabButton
              active={abaAtiva === "historico"}
              label="Histórico"
              onPress={() => setAbaAtiva("historico")}
            />
          </View>

          {abaAtiva === "scanner" ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Leitor de QR Code</Text>
              <Text style={styles.sectionText}>
                Aponte a câmera para o QR Code do ingresso.
              </Text>

              <View style={styles.cameraCard}>
                {cameraLiberada ? (
                  <>
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      active={scannerAtivo && !resultado && !validando}
                      barcodeScannerSettings={{
                        barcodeTypes: ["qr"],
                      }}
                      onBarcodeScanned={
                        scannerAtivo && !resultado && !validando
                          ? ({ data }) => validarQr(data)
                          : undefined
                      }
                    />
                    <View style={styles.cameraShadeTop} />
                    <View style={styles.cameraShadeBottom} />
                    <View style={styles.cameraShadeLeft} />
                    <View style={styles.cameraShadeRight} />

                    <View style={styles.scannerFrame}>
                      <View style={[styles.corner, styles.cornerTL]} />
                      <View style={[styles.corner, styles.cornerTR]} />
                      <View style={[styles.corner, styles.cornerBL]} />
                      <View style={[styles.corner, styles.cornerBR]} />
                    </View>
                  </>
                ) : (
                  <View style={styles.permissionBox}>
                    <Text style={styles.permissionIcon}>📷</Text>
                    <Text style={styles.permissionTitle}>
                      Permita o uso da câmera
                    </Text>
                    <Text style={styles.permissionText}>
                      Para ler QR Code direto pelo celular.
                    </Text>

                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={requestPermission}
                    >
                      <Text style={styles.primaryButtonText}>
                        PERMITIR CÂMERA
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.cameraInstruction}>
                  {validando ? (
                    <>
                      <ActivityIndicator color="#fff" />
                      <Text style={styles.cameraInstructionText}>
                        VALIDANDO...
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.cameraInstructionText}>
                      APONTE O QR NO QUADRO
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.quickRow}>
                <TouchableOpacity
                  style={styles.quickButton}
                  onPress={() => setAbaAtiva("codigo")}
                >
                  <Text style={styles.quickButtonText}>VALIDAR POR CÓDIGO</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickButtonSecondary}
                  onPress={() => carregarPainel()}
                >
                  <Text style={styles.quickButtonSecondaryText}>
                    ATUALIZAR PAINEL
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {abaAtiva === "codigo" ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Validação manual</Text>
              <Text style={styles.sectionText}>
                Digite o código do ingresso. Exemplo: B62-XXXXXXXX
              </Text>

              <TextInput
                style={styles.manualInput}
                value={codigoManual}
                onChangeText={(text) => setCodigoManual(text.toUpperCase())}
                placeholder="Digite o código do ingresso"
                placeholderTextColor="#84778e"
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={validarCodigoManual}
                disabled={validando}
              >
                <Text style={styles.primaryButtonText}>
                  {validando ? "VALIDANDO..." : "VALIDAR CÓDIGO"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setAbaAtiva("scanner")}
              >
                <Text style={styles.secondaryButtonText}>VOLTAR AO QR CODE</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {abaAtiva === "historico" ? (
            <View style={styles.sectionCard}>
              <View style={styles.historyHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Últimas validações</Text>
                  <Text style={styles.sectionText}>
                    Histórico recente da portaria.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.refreshPill}
                  onPress={() => carregarPainel()}
                >
                  <Text style={styles.refreshPillText}>ATUALIZAR</Text>
                </TouchableOpacity>
              </View>

              {carregandoPainel ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color="#ff1684" />
                  <Text style={styles.loadingText}>Carregando histórico...</Text>
                </View>
              ) : dashboard?.history?.length ? (
                dashboard.history.map((item, index) => (
                  <View style={styles.historyItem} key={`${item.codigo}-${index}`}>
                    <View style={styles.historyBadge}>
                      <Text style={styles.historyBadgeText}>✓</Text>
                    </View>

                    <View style={styles.historyContent}>
                      <Text style={styles.historyName}>
                        {item.nome || "Sem nome"}
                      </Text>
                      <Text style={styles.historyCode}>
                        {item.codigo || "Sem código"}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {item.email || "Sem e-mail"}
                      </Text>
                    </View>

                    <View style={styles.historyRight}>
                      <Text style={styles.historyStatus}>VALIDADO</Text>
                      <Text style={styles.historyTime}>
                        {item.validadoEmTexto || item.utilizadoEmTexto || "—"}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyIcon}>🕘</Text>
                  <Text style={styles.emptyTitle}>Nenhuma validação ainda</Text>
                  <Text style={styles.emptyText}>
                    Assim que algum ingresso for validado, ele aparece aqui.
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>
      </View>

      <Modal
        visible={Boolean(resultado)}
        transparent
        animationType="fade"
        onRequestClose={escanearProximo}
      >
        <View style={styles.resultOverlay}>
          {resultado ? (
            <View
              style={[
                styles.resultCard,
                resultado.type === "valid" && styles.resultCardValid,
                resultado.type === "used" && styles.resultCardUsed,
                resultado.type === "invalid" && styles.resultCardInvalid,
              ]}
            >
              <View
                style={[
                  styles.resultCircle,
                  resultado.type === "valid" && styles.resultCircleValid,
                  resultado.type === "used" && styles.resultCircleUsed,
                  resultado.type === "invalid" && styles.resultCircleInvalid,
                ]}
              >
                <Text style={styles.resultIcon}>
                  {resultado.type === "valid"
                    ? "✓"
                    : resultado.type === "used"
                    ? "!"
                    : "×"}
                </Text>
              </View>

              <Text
                style={[
                  styles.resultTitle,
                  resultado.type === "valid" && styles.resultTitleValid,
                  resultado.type === "used" && styles.resultTitleUsed,
                  resultado.type === "invalid" && styles.resultTitleInvalid,
                ]}
              >
                {resultado.title}
              </Text>

              <Text style={styles.resultMessage}>{resultado.message}</Text>

              {resultado.ticket ? (
                <View style={styles.ticketInfoBox}>
                  <Info label="TITULAR" value={resultado.ticket.nome} />
                  <Info label="CÓDIGO" value={resultado.ticket.codigo} />
                  <Info
                    label="QUANTIDADE"
                    value={String(resultado.ticket.quantidade || 1)}
                  />
                  <Info
                    label="E-MAIL"
                    value={resultado.ticket.email}
                  />
                  <Info
                    label="VALOR"
                    value={formatMoney(resultado.ticket.valor)}
                  />
                  {resultado.ticket.utilizadoEmTexto ? (
                    <Info
                      label="UTILIZADO EM"
                      value={resultado.ticket.utilizadoEmTexto}
                    />
                  ) : null}
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.resultPrimaryButton}
                onPress={escanearProximo}
              >
                <Text style={styles.resultPrimaryButtonText}>
                  VALIDAR PRÓXIMO
                </Text>
              </TouchableOpacity>

              <Text style={styles.debugCode} numberOfLines={2}>
                {ultimoValorLido}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#050008",
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  pageCenter: {
    flex: 1,
    backgroundColor: "#050008",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loginCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#120018",
    borderColor: "#ff1684",
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  heroCard: {
    backgroundColor: "#120018",
    borderWidth: 1,
    borderColor: "rgba(255,22,132,0.45)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: "#ff1684",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
  },
  heroText: {
    color: "#b9aeca",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  brand: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "900",
  },
  pink: {
    color: "#ff1684",
  },
  brandSub: {
    color: "#ff1684",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 3,
    marginTop: 2,
  },
  loginTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 26,
  },
  loginText: {
    color: "#b1a4ba",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  pinInput: {
    width: "100%",
    backgroundColor: "#1a0521",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 14,
    color: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginTop: 18,
    fontSize: 16,
    letterSpacing: 4,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#ff1684",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 14,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
  secondaryButton: {
    width: "100%",
    borderColor: "rgba(255,22,132,0.45)",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 11,
  },
  smallAction: {
    backgroundColor: "#1a0521",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,22,132,0.35)",
  },
  smallActionText: {
    color: "#ff1684",
    fontSize: 11,
    fontWeight: "900",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#120018",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "900",
  },
  statLabel: {
    color: "#c1b6c7",
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
    fontWeight: "700",
  },
  lastValidationBox: {
    backgroundColor: "#120018",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    marginBottom: 16,
  },
  lastValidationLabel: {
    color: "#8f809b",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  lastValidationValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 6,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#100015",
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#ff1684",
  },
  tabButtonText: {
    color: "#9b8ea3",
    fontSize: 12,
    fontWeight: "900",
  },
  tabButtonTextActive: {
    color: "#fff",
  },
  sectionCard: {
    backgroundColor: "#120018",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
  sectionText: {
    color: "#b7adc1",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 14,
  },
  cameraCard: {
    height: 380,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  permissionIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  permissionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  permissionText: {
    color: "#b7adc1",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  cameraShadeTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "18%",
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  cameraShadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "18%",
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  cameraShadeLeft: {
    position: "absolute",
    left: 0,
    top: "18%",
    bottom: "18%",
    width: "13%",
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  cameraShadeRight: {
    position: "absolute",
    right: 0,
    top: "18%",
    bottom: "18%",
    width: "13%",
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  scannerFrame: {
    width: "72%",
    aspectRatio: 1,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 34,
    height: 34,
    borderColor: "#ff1684",
  },
  cornerTL: {
    left: 0,
    top: 0,
    borderLeftWidth: 4,
    borderTopWidth: 4,
  },
  cornerTR: {
    right: 0,
    top: 0,
    borderRightWidth: 4,
    borderTopWidth: 4,
  },
  cornerBL: {
    left: 0,
    bottom: 0,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
  },
  cornerBR: {
    right: 0,
    bottom: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
  },
  cameraInstruction: {
    position: "absolute",
    bottom: 18,
    backgroundColor: "rgba(5,0,8,0.82)",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cameraInstructionText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  quickButton: {
    flex: 1,
    backgroundColor: "#ff1684",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  quickButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  quickButtonSecondary: {
    flex: 1,
    backgroundColor: "#1a0521",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  quickButtonSecondaryText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  manualInput: {
    width: "100%",
    backgroundColor: "#1a0521",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 14,
    color: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 15,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refreshPill: {
    backgroundColor: "#1a0521",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshPillText: {
    color: "#ff1684",
    fontSize: 11,
    fontWeight: "900",
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
  loadingText: {
    color: "#c5bacd",
    marginTop: 10,
    fontSize: 13,
  },
  historyItem: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#1a0521",
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
    alignItems: "center",
  },
  historyBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#18d26b",
    alignItems: "center",
    justifyContent: "center",
  },
  historyBadgeText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 20,
  },
  historyContent: {
    flex: 1,
  },
  historyName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  historyCode: {
    color: "#ff1684",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },
  historyMeta: {
    color: "#b4a9be",
    fontSize: 12,
    marginTop: 4,
  },
  historyRight: {
    alignItems: "flex-end",
    maxWidth: 110,
  },
  historyStatus: {
    color: "#18d26b",
    fontWeight: "900",
    fontSize: 11,
  },
  historyTime: {
    color: "#b4a9be",
    fontSize: 11,
    marginTop: 6,
    textAlign: "right",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },
  emptyIcon: {
    fontSize: 38,
    marginBottom: 10,
  },
  emptyTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 17,
  },
  emptyText: {
    color: "#b5aabf",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  resultOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    padding: 20,
  },
  resultCard: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    backgroundColor: "#120018",
    borderWidth: 2,
    borderRadius: 26,
    padding: 24,
    alignItems: "center",
  },
  resultCardValid: {
    borderColor: "#18d26b",
  },
  resultCardUsed: {
    borderColor: "#f2a51a",
  },
  resultCardInvalid: {
    borderColor: "#ff5068",
  },
  resultCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  resultCircleValid: {
    backgroundColor: "#18d26b",
  },
  resultCircleUsed: {
    backgroundColor: "#f2a51a",
  },
  resultCircleInvalid: {
    backgroundColor: "#ff5068",
  },
  resultIcon: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "900",
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 18,
    textAlign: "center",
  },
  resultTitleValid: {
    color: "#18d26b",
  },
  resultTitleUsed: {
    color: "#f2a51a",
  },
  resultTitleInvalid: {
    color: "#ff5068",
  },
  resultMessage: {
    color: "#c1b6c7",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  ticketInfoBox: {
    width: "100%",
    marginTop: 20,
    backgroundColor: "#1a0521",
    borderRadius: 16,
    padding: 15,
  },
  infoRow: {
    paddingVertical: 9,
    borderBottomColor: "rgba(255,255,255,0.06)",
    borderBottomWidth: 1,
  },
  infoLabel: {
    color: "#82758a",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  infoValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },
  resultPrimaryButton: {
    width: "100%",
    backgroundColor: "#ff1684",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 15,
    marginTop: 20,
  },
  resultPrimaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
  debugCode: {
    color: "#5f5466",
    fontSize: 8,
    marginTop: 12,
    textAlign: "center",
  },
});