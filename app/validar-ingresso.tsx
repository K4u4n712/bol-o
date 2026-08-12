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

type Resultado =
  | {
      type: "valid";
      title: string;
      message: string;
      ticket?: any;
    }
  | {
      type: "used";
      title: string;
      message: string;
      ticket?: any;
    }
  | {
      type: "invalid";
      title: string;
      message: string;
      ticket?: any;
    }
  | null;

export default function ValidarIngresso() {
  const [permission, requestPermission] = useCameraPermissions();

  const [pin, setPin] = useState("");
  const [pinLiberado, setPinLiberado] = useState(false);
  const [scannerAtivo, setScannerAtivo] = useState(true);
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);
  const [ultimoQr, setUltimoQr] = useState("");

  const cameraLiberada = useMemo(
    () => Boolean(permission?.granted),
    [permission?.granted]
  );

  async function liberarScanner() {
    if (!pin.trim()) {
      Alert.alert("Digite o PIN", "Informe o PIN da portaria.");
      return;
    }

    if (!permission?.granted) {
      const resposta = await requestPermission();

      if (!resposta.granted) {
        Alert.alert(
          "Câmera não autorizada",
          "Permita o acesso à câmera para validar os ingressos."
        );
        return;
      }
    }

    setPinLiberado(true);
    setScannerAtivo(true);
  }

  async function validarQr(qrData: string) {
    if (!scannerAtivo || validando || !qrData) return;

    setScannerAtivo(false);
    setValidando(true);
    setUltimoQr(qrData);

    try {
      const response = await fetch(API_VALIDAR_INGRESSO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Validator-Pin": pin.trim(),
        },
        body: JSON.stringify({
          qr: qrData,
        }),
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
        return;
      }

      if (!response.ok || !data?.success) {
        setResultado({
          type: "invalid",
          title: "INGRESSO INVÁLIDO",
          message:
            data?.message ||
            "Este QR Code não corresponde a um ingresso válido.",
          ticket: data?.ticket,
        });
        return;
      }

      setResultado({
        type: "valid",
        title: "INGRESSO VÁLIDO",
        message: "Entrada liberada. O ingresso foi marcado como utilizado.",
        ticket: data?.ticket,
      });
    } catch (error) {
      console.log("Erro ao validar ingresso:", error);

      setResultado({
        type: "invalid",
        title: "ERRO AO VALIDAR",
        message:
          "Não foi possível consultar o servidor. Verifique a internet e tente novamente.",
      });
    } finally {
      setValidando(false);
    }
  }

  function escanearProximo() {
    setResultado(null);
    setUltimoQr("");
    setScannerAtivo(true);
  }

  function trocarPin() {
    setPinLiberado(false);
    setPin("");
    setResultado(null);
    setScannerAtivo(true);
  }

  if (!pinLiberado) {
    return (
      <View style={styles.pageCenter}>
        <View style={styles.loginCard}>
          <Text style={styles.brand}>
            BONDE <Text style={styles.pink}>62</Text>
          </Text>
          <Text style={styles.brandSub}>VALIDADOR DE INGRESSOS</Text>

          <Text style={styles.loginTitle}>Acesso da portaria</Text>
          <Text style={styles.loginText}>
            Digite o PIN do evento para liberar o leitor de QR Code.
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
            onPress={liberarScanner}
          >
            <Text style={styles.primaryButtonText}>LIBERAR CÂMERA</Text>
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

  if (!cameraLiberada) {
    return (
      <View style={styles.pageCenter}>
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Precisamos da câmera</Text>
          <Text style={styles.loginText}>
            Autorize a câmera para escanear os QR Codes.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={requestPermission}
          >
            <Text style={styles.primaryButtonText}>PERMITIR CÂMERA</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.page}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.brand}>
              BONDE <Text style={styles.pink}>62</Text>
            </Text>
            <Text style={styles.brandSub}>VALIDADOR</Text>
          </View>

          <TouchableOpacity onPress={trocarPin}>
            <Text style={styles.topAction}>TROCAR PIN</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cameraArea}>
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

          <View style={styles.cameraInstruction}>
            {validando ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.cameraInstructionText}>
                  VALIDANDO INGRESSO...
                </Text>
              </>
            ) : (
              <Text style={styles.cameraInstructionText}>
                APONTE A CÂMERA PARA O QR CODE
              </Text>
            )}
          </View>
        </View>

        <View style={styles.bottomInfo}>
          <Text style={styles.bottomTitle}>Entrada Bonde 62</Text>
          <Text style={styles.bottomText}>
            Cada ingresso pode ser validado apenas uma vez.
          </Text>
        </View>
      </View>

      <Modal
        visible={Boolean(resultado)}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.resultOverlay}>
          {resultado ? (
            <ScrollView
              contentContainerStyle={styles.resultScroll}
              showsVerticalScrollIndicator={false}
            >
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

                <Text style={styles.resultMessage}>
                  {resultado.message}
                </Text>

                {resultado.ticket ? (
                  <View style={styles.ticketInfoBox}>
                    <Info label="TITULAR" value={resultado.ticket.nome} />
                    <Info
                      label="CÓDIGO"
                      value={resultado.ticket.codigo}
                    />
                    <Info
                      label="QUANTIDADE"
                      value={String(resultado.ticket.quantidade || 1)}
                    />
                    <Info
                      label="E-MAIL"
                      value={resultado.ticket.email}
                    />
                    {resultado.ticket.utilizadoEmTexto ? (
                      <Info
                        label="UTILIZADO EM"
                        value={resultado.ticket.utilizadoEmTexto}
                      />
                    ) : null}
                  </View>
                ) : null}

                {resultado.type === "invalid" &&
                resultado.title === "PIN INVÁLIDO" ? (
                  <TouchableOpacity
                    style={styles.resultPrimaryButton}
                    onPress={trocarPin}
                  >
                    <Text style={styles.resultPrimaryButtonText}>
                      DIGITAR PIN NOVAMENTE
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.resultPrimaryButton}
                    onPress={escanearProximo}
                  >
                    <Text style={styles.resultPrimaryButtonText}>
                      ESCANEAR PRÓXIMO
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.debugCode} numberOfLines={2}>
                  {ultimoQr}
                </Text>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </>
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
  pageCenter: {
    flex: 1,
    backgroundColor: "#050008",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loginCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#120018",
    borderColor: "#ff1684",
    borderWidth: 1,
    borderRadius: 24,
    padding: 26,
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
    fontSize: 25,
    fontWeight: "900",
    marginTop: 28,
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
    borderRadius: 13,
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
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 16,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
  secondaryButton: {
    width: "100%",
    borderColor: "rgba(255,22,132,0.5)",
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 11,
  },
  topbar: {
    minHeight: 82,
    paddingHorizontal: 22,
    backgroundColor: "#08000c",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topAction: {
    color: "#ff1684",
    fontSize: 10,
    fontWeight: "900",
  },
  cameraArea: {
    flex: 1,
    minHeight: 450,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraShadeTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "20%",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  cameraShadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "20%",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  cameraShadeLeft: {
    position: "absolute",
    left: 0,
    top: "20%",
    bottom: "20%",
    width: "15%",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  cameraShadeRight: {
    position: "absolute",
    right: 0,
    top: "20%",
    bottom: "20%",
    width: "15%",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  scannerFrame: {
    width: "70%",
    maxWidth: 360,
    aspectRatio: 1,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 38,
    height: 38,
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
    bottom: 36,
    backgroundColor: "rgba(5,0,8,0.78)",
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cameraInstructionText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
  },
  bottomInfo: {
    minHeight: 100,
    paddingHorizontal: 22,
    paddingVertical: 18,
    backgroundColor: "#08000c",
  },
  bottomTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
  bottomText: {
    color: "#988b9f",
    fontSize: 11,
    marginTop: 5,
  },
  resultOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
  },
  resultScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  resultCard: {
    width: "100%",
    maxWidth: 470,
    backgroundColor: "#120018",
    borderWidth: 2,
    borderRadius: 26,
    padding: 26,
    alignItems: "center",
  },
  resultCardValid: {
    borderColor: "#18c96e",
  },
  resultCardUsed: {
    borderColor: "#f2a51a",
  },
  resultCardInvalid: {
    borderColor: "#ff5068",
  },
  resultCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  resultCircleValid: {
    backgroundColor: "#18c96e",
  },
  resultCircleUsed: {
    backgroundColor: "#f2a51a",
  },
  resultCircleInvalid: {
    backgroundColor: "#ff5068",
  },
  resultIcon: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "900",
  },
  resultTitle: {
    fontSize: 25,
    fontWeight: "900",
    marginTop: 18,
  },
  resultTitleValid: {
    color: "#18c96e",
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