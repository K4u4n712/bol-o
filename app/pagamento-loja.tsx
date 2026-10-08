import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";

function parametro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] || "" : valor || "";
}

function formatarTempo(segundos: number) {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

export default function PagamentoLoja() {
  const { width } = useWindowDimensions();
  const mobile = width < 760;

  const params = useLocalSearchParams<{
    pedido_id?: string | string[];
    order_id?: string | string[];
    payment_id?: string | string[];
    status?: string | string[];
    valor?: string | string[];
    qr_code?: string | string[];
    qr_code_base64?: string | string[];
    ticket_url?: string | string[];
    teste?: string | string[];
  }>();

  const pedidoId = parametro(params.pedido_id);
  const qrCode = parametro(params.qr_code);
  const qrCodeBase64 = parametro(params.qr_code_base64);
  const teste = parametro(params.teste) === "1";

  const valor = useMemo(() => {
    const numero = Number(parametro(params.valor) || "99.90");
    return Number.isFinite(numero) ? numero : 99.9;
  }, [params.valor]);

  const [copiado, setCopiado] = useState(false);
  const [segundos, setSegundos] = useState(30 * 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setSegundos((atual) => (atual > 0 ? atual - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  async function copiarPix() {
    if (!qrCode) return;

    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        await navigator.clipboard.writeText(qrCode);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2200);
        return;
      }

      throw new Error("Clipboard indisponível.");
    } catch {
      setCopiado(false);
    }
  }

  const qrSource = qrCodeBase64
    ? {
        uri: qrCodeBase64.startsWith("data:")
          ? qrCodeBase64
          : `data:image/png;base64,${qrCodeBase64}`,
      }
    : null;

  const pixDisponivel = Boolean(qrCode);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View>
            <Text style={styles.logo}>
              Air<Text style={styles.logoBlue}>Clean</Text>
            </Text>
            <Text style={styles.logoSub}>PAGAMENTO SEGURO</Text>
          </View>

          <View style={styles.security}>
            <Text style={styles.securityIcon}>🔒</Text>
            <View>
              <Text style={styles.securityTitle}>Compra protegida</Text>
              <Text style={styles.securitySub}>Ambiente de pagamento</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.page,
          mobile && styles.pageMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.steps}>
          <View style={styles.stepDone}>
            <Text style={styles.stepDoneText}>✓</Text>
          </View>
          <View style={styles.stepLineActive} />
          <View style={styles.stepActive}>
            <Text style={styles.stepActiveText}>2</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.step}>
            <Text style={styles.stepText}>3</Text>
          </View>
        </View>

        <View style={styles.stepLabels}>
          <Text style={styles.stepLabelDone}>Dados</Text>
          <Text style={styles.stepLabelActive}>Pagamento</Text>
          <Text style={styles.stepLabel}>Confirmação</Text>
        </View>

        <View
          style={[
            styles.content,
            mobile && styles.contentMobile,
          ]}
        >
          <View style={[styles.main, mobile && styles.full]}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backText}>‹ Voltar ao checkout</Text>
            </Pressable>

            <Text style={styles.eyebrow}>PAGAMENTO VIA PIX</Text>
            <Text style={[styles.title, mobile && styles.titleMobile]}>
              Falta só o pagamento para confirmar seu AirClean.
            </Text>
            <Text style={styles.subtitle}>
              Escaneie o QR Code ou copie o código Pix abaixo.
            </Text>

            {teste && (
              <View style={styles.testBanner}>
                <Text style={styles.testBannerTitle}>AMBIENTE DE TESTE</Text>
                <Text style={styles.testBannerText}>
                  Esta cobrança foi criada enquanto a integração do Mercado Pago está em teste.
                </Text>
              </View>
            )}

            <View style={styles.paymentCard}>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <View style={styles.statusTextBox}>
                  <Text style={styles.statusTitle}>Aguardando pagamento</Text>
                  <Text style={styles.statusSubtitle}>
                    A confirmação será feita automaticamente após o Pix.
                  </Text>
                </View>
                <ActivityIndicator size="small" />
              </View>

              <View style={styles.divider} />

              {pixDisponivel ? (
                <>
                  <View style={styles.qrArea}>
                    {qrSource ? (
                      <View style={styles.qrBox}>
                        <Image
                          source={qrSource}
                          style={styles.qrImage}
                          resizeMode="contain"
                        />
                      </View>
                    ) : (
                      <View style={styles.qrPlaceholder}>
                        <Text style={styles.qrPlaceholderText}>PIX</Text>
                      </View>
                    )}

                    <View style={styles.qrInstructions}>
                      <Text style={styles.instructionsTitle}>
                        Pague pelo aplicativo do seu banco
                      </Text>

                      <View style={styles.instruction}>
                        <View style={styles.instructionNumber}>
                          <Text style={styles.instructionNumberText}>1</Text>
                        </View>
                        <Text style={styles.instructionText}>
                          Abra o app do seu banco e escolha pagar via Pix.
                        </Text>
                      </View>

                      <View style={styles.instruction}>
                        <View style={styles.instructionNumber}>
                          <Text style={styles.instructionNumberText}>2</Text>
                        </View>
                        <Text style={styles.instructionText}>
                          Escaneie o QR Code ou use o Pix Copia e Cola.
                        </Text>
                      </View>

                      <View style={styles.instruction}>
                        <View style={styles.instructionNumber}>
                          <Text style={styles.instructionNumberText}>3</Text>
                        </View>
                        <Text style={styles.instructionText}>
                          Confira o valor antes de confirmar no seu banco.
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.copyLabel}>PIX COPIA E COLA</Text>

                  <View style={styles.copyBox}>
                    <Text
                      style={styles.copyCode}
                      numberOfLines={2}
                    >
                      {qrCode}
                    </Text>
                  </View>

                  <Pressable
                    onPress={copiarPix}
                    style={({ pressed }) => [
                      styles.copyButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.copyButtonText}>
                      {copiado ? "✓ CÓDIGO COPIADO" : "COPIAR CÓDIGO PIX"}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.processingBox}>
                  <ActivityIndicator size="large" />
                  <Text style={styles.processingTitle}>
                    Preparando seu Pix...
                  </Text>
                  <Text style={styles.processingText}>
                    O pedido foi criado, mas o QR Code ainda não chegou nesta tela.
                    Não faça outro pedido enquanto finalizamos esta integração.
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.sidebar, mobile && styles.full]}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Resumo do pedido</Text>

              <View style={styles.summaryDivider} />

              <View style={styles.productRow}>
                <View style={styles.productIcon}>
                  <Text style={styles.productIconText}>AC</Text>
                </View>

                <View style={styles.productInfo}>
                  <Text style={styles.productName}>
                    Mini Aspirador AirClean 3 em 1
                  </Text>
                  <Text style={styles.productModel}>Modelo AS-228 · Qtd. 1</Text>
                </View>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Total</Text>
                <Text style={styles.price}>
                  {valor.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </Text>
              </View>

              <Text style={styles.paymentMethod}>Pagamento via Pix</Text>

              <View style={styles.expirationBox}>
                <Text style={styles.expirationLabel}>Tempo da cobrança</Text>
                <Text style={styles.expirationTime}>
                  {formatarTempo(segundos)}
                </Text>
              </View>

              {pedidoId ? (
                <Text style={styles.orderId}>
                  Pedido: {pedidoId}
                </Text>
              ) : null}

              <View style={styles.safeBox}>
                <Text style={styles.safeTitle}>🔒 Pagamento protegido</Text>
                <Text style={styles.safeText}>
                  Confira os dados no aplicativo do seu banco antes de concluir o Pix.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f6f7f9",
  },

  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e8e8",
  },

  headerInner: {
    width: "100%",
    maxWidth: 1115,
    alignSelf: "center",
    minHeight: 92,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  logo: {
    color: "#111",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1.5,
  },

  logoBlue: {
    color: "#2b91df",
  },

  logoSub: {
    marginTop: -2,
    color: "#888",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 2,
  },

  security: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  securityIcon: {
    fontSize: 16,
  },

  securityTitle: {
    color: "#111",
    fontSize: 12,
    fontWeight: "900",
  },

  securitySub: {
    marginTop: 2,
    color: "#999",
    fontSize: 9,
  },

  page: {
    width: "100%",
    maxWidth: 1115,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 70,
  },

  pageMobile: {
    paddingTop: 18,
  },

  steps: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  stepDone: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  stepDoneText: {
    color: "#fff",
    fontWeight: "900",
  },

  stepActive: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: "#2b91df",
    alignItems: "center",
    justifyContent: "center",
  },

  stepActiveText: {
    color: "#fff",
    fontWeight: "900",
  },

  step: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: "#e9eaec",
    alignItems: "center",
    justifyContent: "center",
  },

  stepText: {
    color: "#888",
    fontWeight: "900",
  },

  stepLineActive: {
    width: 125,
    height: 1,
    backgroundColor: "#2b91df",
  },

  stepLine: {
    width: 125,
    height: 1,
    backgroundColor: "#d7d7d7",
  },

  stepLabels: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 3,
    marginTop: 6,
    marginBottom: 44,
  },

  stepLabelDone: {
    width: 80,
    textAlign: "left",
    color: "#555",
    fontSize: 9,
    fontWeight: "800",
  },

  stepLabelActive: {
    width: 100,
    textAlign: "center",
    color: "#2b91df",
    fontSize: 9,
    fontWeight: "900",
  },

  stepLabel: {
    width: 90,
    textAlign: "right",
    color: "#999",
    fontSize: 9,
    fontWeight: "700",
  },

  content: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 42,
  },

  contentMobile: {
    flexDirection: "column",
    gap: 24,
  },

  main: {
    flex: 1.2,
    minWidth: 0,
  },

  sidebar: {
    flex: 0.8,
    minWidth: 320,
  },

  full: {
    width: "100%",
    minWidth: 0,
  },

  backButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
  },

  backText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "700",
  },

  eyebrow: {
    color: "#2b91df",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 10,
  },

  title: {
    color: "#111",
    fontSize: 38,
    lineHeight: 43,
    fontWeight: "900",
    letterSpacing: -1.5,
    maxWidth: 620,
  },

  titleMobile: {
    fontSize: 30,
    lineHeight: 35,
  },

  subtitle: {
    color: "#737373",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 22,
  },

  testBanner: {
    backgroundColor: "#fff8df",
    borderWidth: 1,
    borderColor: "#f1d980",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },

  testBannerTitle: {
    color: "#745900",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  testBannerText: {
    color: "#745900",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  paymentCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e4e4",
    borderRadius: 20,
    padding: 24,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2b91df",
    marginRight: 12,
  },

  statusTextBox: {
    flex: 1,
  },

  statusTitle: {
    color: "#111",
    fontSize: 17,
    fontWeight: "900",
  },

  statusSubtitle: {
    color: "#888",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: "#ededed",
    marginVertical: 22,
  },

  qrArea: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 24,
  },

  qrBox: {
    width: 220,
    height: 220,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 16,
    padding: 10,
    backgroundColor: "#fff",
  },

  qrImage: {
    width: "100%",
    height: "100%",
  },

  qrPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 16,
    backgroundColor: "#f2f3f5",
    alignItems: "center",
    justifyContent: "center",
  },

  qrPlaceholderText: {
    color: "#111",
    fontSize: 36,
    fontWeight: "900",
  },

  qrInstructions: {
    flex: 1,
    minWidth: 230,
  },

  instructionsTitle: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 14,
  },

  instruction: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  instructionNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  instructionNumberText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },

  instructionText: {
    flex: 1,
    color: "#666",
    fontSize: 11,
    lineHeight: 17,
  },

  copyLabel: {
    color: "#777",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 24,
    marginBottom: 8,
  },

  copyBox: {
    backgroundColor: "#f5f6f7",
    borderWidth: 1,
    borderColor: "#e1e1e1",
    borderRadius: 12,
    padding: 14,
  },

  copyCode: {
    color: "#555",
    fontSize: 10,
    lineHeight: 15,
  },

  copyButton: {
    height: 52,
    backgroundColor: "#111",
    borderRadius: 12,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  copyButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },

  processingBox: {
    alignItems: "center",
    paddingVertical: 35,
    paddingHorizontal: 16,
  },

  processingTitle: {
    color: "#111",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 16,
  },

  processingText: {
    color: "#777",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 420,
    marginTop: 8,
  },

  summaryCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e4e4",
    borderRadius: 20,
    padding: 24,
  },

  summaryTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "900",
  },

  summaryDivider: {
    height: 1,
    backgroundColor: "#ededed",
    marginVertical: 20,
  },

  productRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  productIcon: {
    width: 66,
    height: 66,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  productIconText: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "900",
  },

  productInfo: {
    flex: 1,
  },

  productName: {
    color: "#111",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
  },

  productModel: {
    color: "#999",
    fontSize: 9,
    marginTop: 4,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  priceLabel: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
  },

  price: {
    color: "#111",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
  },

  paymentMethod: {
    color: "#888",
    fontSize: 9,
    textAlign: "right",
    marginTop: 4,
  },

  expirationBox: {
    backgroundColor: "#f5f9fd",
    borderWidth: 1,
    borderColor: "#d9eaf7",
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  expirationLabel: {
    color: "#5f6f7d",
    fontSize: 10,
    fontWeight: "700",
  },

  expirationTime: {
    color: "#2b91df",
    fontSize: 18,
    fontWeight: "900",
  },

  orderId: {
    color: "#999",
    fontSize: 8,
    lineHeight: 13,
    marginTop: 14,
  },

  safeBox: {
    backgroundColor: "#f7f7f7",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },

  safeTitle: {
    color: "#222",
    fontSize: 10,
    fontWeight: "900",
  },

  safeText: {
    color: "#888",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 5,
  },

  pressed: {
    opacity: 0.82,
  },
});
