import React, { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebaseConfig";
import { useAuth } from "../contexts/AuthContext";

type PagamentoStatus = "carregando" | "pendente" | "aprovado" | "erro";

function statusAprovado(status?: any) {
  const statusTexto = String(status || "").toLowerCase();

  return [
    "paid",
    "pago",
    "approved",
    "aprovado",
    "completed",
    "complete",
    "success",
    "successful",
    "confirmed",
    "confirmado",
    "captured",
    "finalizado",
  ].includes(statusTexto);
}

function statusErro(status?: any) {
  const statusTexto = String(status || "").toLowerCase();

  return [
    "failed",
    "fail",
    "error",
    "erro",
    "cancelled",
    "canceled",
    "cancelado",
    "checkout_error",
    "rejected",
    "recusado",
    "value_mismatch",
    "check_failed",
  ].includes(statusTexto);
}

export default function PagamentoRetornoScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const orderNsu = useMemo(() => {
    const valor = params.order_nsu;

    if (Array.isArray(valor)) {
      return valor[0] || "";
    }

    return valor ? String(valor) : "";
  }, [params.order_nsu]);

  const tipoParam = useMemo(() => {
    const valor = params.tipo;

    if (Array.isArray(valor)) {
      return valor[0] || "";
    }

    return valor ? String(valor) : "";
  }, [params.tipo]);

  const isBonde62 = tipoParam === "bonde62";

  const deepLinkApp = useMemo(() => {
    if (orderNsu) {
      return `appbolao://pagamento-retorno?order_nsu=${encodeURIComponent(orderNsu)}`;
    }

    return "appbolao://pagamento-retorno";
  }, [orderNsu]);

  const [statusTela, setStatusTela] = useState<PagamentoStatus>("carregando");
  const [mensagem, setMensagem] = useState(
    isBonde62
      ? "Estamos confirmando seu ingresso. Aguarde alguns segundos..."
      : "Estamos confirmando seu pagamento. Aguarde alguns segundos..."
  );
  const [valorPago, setValorPago] = useState<number | null>(null);
  const [compradorNome, setCompradorNome] = useState("");
  const [compradorEmail, setCompradorEmail] = useState("");
  const [compradorWhatsapp, setCompradorWhatsapp] = useState("");
  const [quantidade, setQuantidade] = useState<number | null>(null);
  const [tentouAbrirApp, setTentouAbrirApp] = useState(false);

  // No Bolão10, tenta abrir o APK quando estiver no PWA.
  // No Bonde 62, não tenta abrir o app do bolão.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (isBonde62) return;

    const timer = setTimeout(() => {
      setTentouAbrirApp(true);

      Linking.openURL(deepLinkApp).catch(() => {
        console.log("Não foi possível abrir o APK automaticamente.");
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [deepLinkApp, isBonde62]);

  useEffect(() => {
    if (!orderNsu) {
      setStatusTela("pendente");

      if (isBonde62) {
        setMensagem(
          "Pagamento enviado. Se o Pix foi aprovado, seu ingresso será confirmado em instantes."
        );
        return;
      }

      setMensagem(
        "Pagamento enviado. Se o Pix foi aprovado, seu saldo será atualizado em instantes."
      );

      const timer = setTimeout(() => {
        router.replace("/perfil");
      }, 6000);

      return () => clearTimeout(timer);
    }

    const pagamentoRef = doc(db, "pagamentos", orderNsu);

    const unsubscribe = onSnapshot(
      pagamentoRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setStatusTela("pendente");

          setMensagem(
            isBonde62
              ? "Pagamento localizado. Aguardando confirmação do ingresso..."
              : "Pagamento localizado. Aguardando confirmação..."
          );

          return;
        }

        const data = snapshot.data();
        const status = data.status;
        const valor = Number(data.valorReais || 0);

        if (valor > 0) {
          setValorPago(valor);
        }

        if (data.nome) {
          setCompradorNome(String(data.nome));
        }

        if (data.email) {
          setCompradorEmail(String(data.email));
        }

        if (data.whatsapp) {
          setCompradorWhatsapp(String(data.whatsapp));
        }

        if (data.quantidade) {
          setQuantidade(Number(data.quantidade));
        }

        if (statusAprovado(status)) {
          setStatusTela("aprovado");

          if (isBonde62) {
            setMensagem(
              "Pagamento aprovado! Seu ingresso do Bonde 62 está garantido. Salve essa tela e acompanhe as próximas informações pelo WhatsApp."
            );
            return;
          }

          setMensagem("Pagamento aprovado! Seu saldo já está sendo atualizado.");

          setTimeout(() => {
            router.replace("/perfil");
          }, 3500);

          return;
        }

        if (statusErro(status)) {
          setStatusTela("erro");

          setMensagem(
            isBonde62
              ? "Não conseguimos confirmar esse pagamento. Tente novamente ou fale com o suporte do Bonde 62."
              : "Não conseguimos confirmar esse pagamento. Tente novamente ou confira seu extrato."
          );

          return;
        }

        setStatusTela("pendente");

        setMensagem(
          isBonde62
            ? "Pagamento recebido pela InfinitePay. Aguardando o webhook confirmar seu ingresso..."
            : "Pagamento recebido pela InfinitePay. Aguardando o webhook confirmar o saldo..."
        );
      },
      (error) => {
        console.log("Erro ao acompanhar pagamento:", error);
        setStatusTela("pendente");

        setMensagem(
          isBonde62
            ? "Pagamento enviado. Se ele foi aprovado, seu ingresso será confirmado em instantes."
            : "Pagamento enviado. Se ele foi aprovado, seu saldo será atualizado em instantes."
        );
      }
    );

    return () => unsubscribe();
  }, [orderNsu, isBonde62]);

  const aprovado = statusTela === "aprovado";
  const erro = statusTela === "erro";
  const carregando = statusTela === "carregando" || statusTela === "pendente";

  const tema = isBonde62
    ? {
        bg: "#050008",
        header: "#120018",
        headerText: "#ffd8ee",
        primary: "#ff1684",
        primaryDark: "#c90065",
        card: "#120018",
        cardBorder: "#ff1684",
        soft: "#210027",
        softBorder: "rgba(255, 22, 132, 0.35)",
        text: "#ffffff",
        muted: "#d7ccdf",
      }
    : {
        bg: "#F3F6F4",
        header: "#006B2E",
        headerText: "#DFFFEA",
        primary: "#006B2E",
        primaryDark: "#005525",
        card: "#FFFFFF",
        cardBorder: "#FFFFFF",
        soft: "#F1FFF5",
        softBorder: "#BEE7C9",
        text: "#111827",
        muted: "#4B5563",
      };

  async function abrirAplicativo() {
    try {
      await Linking.openURL(deepLinkApp);
    } catch (error) {
      console.log("Erro ao abrir app:", error);
    }
  }

  function voltarPrincipal() {
    router.replace(isBonde62 ? "/bonde62" : "/perfil");
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tema.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={tema.header} />

      <View style={[styles.header, { backgroundColor: tema.header }]}>
        <Text style={styles.logo}>
          {isBonde62 ? "🔥 Bonde 62" : "⚽ Bolão10"}
        </Text>

        <Text style={[styles.headerText, { color: tema.headerText }]}>
          {isBonde62 ? "Retorno do ingresso" : "Retorno do pagamento"}
        </Text>
      </View>

      <View style={styles.container}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: tema.card,
              borderColor: isBonde62 ? tema.cardBorder : "transparent",
              borderWidth: isBonde62 ? 1 : 0,
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              aprovado && styles.iconCircleSuccess,
              erro && styles.iconCircleError,
              isBonde62 && styles.iconCircleBonde,
              aprovado && isBonde62 && styles.iconCircleBondeSuccess,
            ]}
          >
            <Text style={styles.iconText}>
              {aprovado ? "✅" : erro ? "⚠️" : "⏳"}
            </Text>
          </View>

          <Text style={[styles.title, { color: tema.text }]}>
            {aprovado
              ? isBonde62
                ? "Ingresso confirmado!"
                : "Pagamento aprovado!"
              : erro
              ? "Pagamento não confirmado"
              : isBonde62
              ? "Confirmando ingresso"
              : "Confirmando pagamento"}
          </Text>

          <Text style={[styles.message, { color: tema.muted }]}>{mensagem}</Text>

          {valorPago !== null && (
            <View
              style={[
                styles.valueBox,
                {
                  backgroundColor: tema.soft,
                  borderColor: tema.softBorder,
                },
              ]}
            >
              <Text style={[styles.valueLabel, { color: tema.primary }]}>
                {isBonde62 ? "Valor do ingresso" : "Valor do depósito"}
              </Text>

              <Text style={[styles.valueText, { color: tema.primary }]}>
                {valorPago.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                BRL
              </Text>
            </View>
          )}

          {isBonde62 && (
            <View
              style={[
                styles.ticketBox,
                {
                  backgroundColor: tema.soft,
                  borderColor: tema.softBorder,
                },
              ]}
            >
              <Text style={[styles.ticketTitle, { color: tema.primary }]}>
                Dados do pedido
              </Text>

              {!!compradorNome && (
                <Text style={[styles.ticketText, { color: tema.muted }]}>
                  Nome: {compradorNome}
                </Text>
              )}

              {!!compradorEmail && (
                <Text style={[styles.ticketText, { color: tema.muted }]}>
                  E-mail: {compradorEmail}
                </Text>
              )}

              {!!compradorWhatsapp && (
                <Text style={[styles.ticketText, { color: tema.muted }]}>
                  WhatsApp: {compradorWhatsapp}
                </Text>
              )}

              {quantidade !== null && (
                <Text style={[styles.ticketText, { color: tema.muted }]}>
                  Quantidade: {quantidade} ingresso(s)
                </Text>
              )}

              {!!orderNsu && (
                <Text style={[styles.ticketCode, { color: tema.primary }]}>
                  Pedido: {orderNsu}
                </Text>
              )}
            </View>
          )}

          {!isBonde62 && user?.email && (
            <Text style={styles.userText}>Conta: {user.email}</Text>
          )}

          {carregando && <ActivityIndicator color={tema.primary} size="large" />}

          {Platform.OS === "web" && !isBonde62 && (
            <View style={styles.appBox}>
              <Text style={styles.appBoxTitle}>Tem o APK instalado?</Text>

              <Text style={styles.appBoxText}>
                Vamos tentar abrir o aplicativo automaticamente. Se aparecer uma
                mensagem do navegador, toque em abrir.
              </Text>

              <TouchableOpacity
                style={[styles.openAppButton, { backgroundColor: tema.primary }]}
                onPress={abrirAplicativo}
              >
                <Text style={styles.openAppButtonText}>Abrir no aplicativo</Text>
              </TouchableOpacity>

              {tentouAbrirApp && (
                <Text style={styles.appHelpText}>
                  Se o app não abrir, continue por aqui mesmo. Seu saldo também
                  será atualizado pelo PWA.
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: tema.primary }]}
            onPress={voltarPrincipal}
          >
            <Text style={styles.primaryButtonText}>
              {isBonde62 ? "Voltar para o Bonde 62" : "Voltar para meu perfil"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                borderColor: isBonde62 ? tema.softBorder : "#D1D5DB",
              },
            ]}
            onPress={() => router.replace("/")}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                { color: isBonde62 ? "#FFFFFF" : "#111827" },
              ]}
            >
              Ir para início
            </Text>
          </TouchableOpacity>

          <Text style={[styles.helpText, { color: tema.muted }]}>
            {isBonde62
              ? "Seu ingresso é confirmado pelo webhook da InfinitePay. Se ainda não apareceu como confirmado, aguarde alguns segundos e atualize esta página."
              : "O saldo é confirmado pelo webhook da InfinitePay. Se ainda não apareceu, aguarde alguns segundos e atualize o Perfil."}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  header: {
    paddingTop: 30,
    paddingBottom: 26,
    paddingHorizontal: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: "center",
  },

  logo: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
  },

  headerText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
  },

  container: {
    flex: 1,
    padding: 22,
    justifyContent: "center",
  },

  card: {
    borderRadius: 26,
    padding: 24,
    alignItems: "center",
    elevation: 5,
  },

  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FFF6BF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  iconCircleSuccess: {
    backgroundColor: "#DCFCE7",
  },

  iconCircleError: {
    backgroundColor: "#FEE2E2",
  },

  iconCircleBonde: {
    backgroundColor: "#2A0034",
    borderWidth: 1,
    borderColor: "#ff1684",
  },

  iconCircleBondeSuccess: {
    backgroundColor: "#151F12",
    borderColor: "#22C55E",
  },

  iconText: {
    fontSize: 42,
  },

  title: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },

  message: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 18,
  },

  valueBox: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },

  valueLabel: {
    fontSize: 13,
    fontWeight: "800",
  },

  valueText: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },

  ticketBox: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },

  ticketTitle: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },

  ticketText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },

  ticketCode: {
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 12,
  },

  userText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },

  appBox: {
    width: "100%",
    backgroundColor: "#F3F6F4",
    borderRadius: 18,
    padding: 15,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },

  appBoxTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  appBoxText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
  },

  openAppButton: {
    borderRadius: 15,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 12,
  },

  openAppButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  appHelpText: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
    marginTop: 9,
  },

  primaryButton: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 22,
    alignItems: "center",
    width: "100%",
    marginTop: 18,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  secondaryButton: {
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 22,
    alignItems: "center",
    width: "100%",
    marginTop: 10,
    borderWidth: 1,
  },

  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "900",
  },

  helpText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 14,
  },
});
