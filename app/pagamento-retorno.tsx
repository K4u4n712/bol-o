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

  const deepLinkApp = useMemo(() => {
    if (orderNsu) {
      return `appbolao://pagamento-retorno?order_nsu=${encodeURIComponent(orderNsu)}`;
    }

    return "appbolao://pagamento-retorno";
  }, [orderNsu]);

  const [statusTela, setStatusTela] = useState<PagamentoStatus>("carregando");
  const [mensagem, setMensagem] = useState(
    "Estamos confirmando seu pagamento. Aguarde alguns segundos..."
  );
  const [valorPago, setValorPago] = useState<number | null>(null);
  const [tentouAbrirApp, setTentouAbrirApp] = useState(false);

  // Quando o retorno abrir no navegador/PWA, tenta mandar para o APK instalado.
  // Se não tiver APK instalado, continua normalmente no PWA.
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const timer = setTimeout(() => {
      setTentouAbrirApp(true);

      Linking.openURL(deepLinkApp).catch(() => {
        console.log("Não foi possível abrir o APK automaticamente.");
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [deepLinkApp]);

  useEffect(() => {
    if (!orderNsu) {
      setStatusTela("pendente");
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
          setMensagem("Pagamento localizado. Aguardando confirmação...");
          return;
        }

        const data = snapshot.data();
        const status = data.status;
        const valor = Number(data.valorReais || 0);

        if (valor > 0) {
          setValorPago(valor);
        }

        if (statusAprovado(status)) {
          setStatusTela("aprovado");
          setMensagem("Pagamento aprovado! Seu saldo já está sendo atualizado.");

          setTimeout(() => {
            router.replace("/perfil");
          }, 3500);

          return;
        }

        if (statusErro(status)) {
          setStatusTela("erro");
          setMensagem(
            "Não conseguimos confirmar esse pagamento. Tente novamente ou confira seu extrato."
          );
          return;
        }

        setStatusTela("pendente");
        setMensagem(
          "Pagamento recebido pela InfinitePay. Aguardando o webhook confirmar o saldo..."
        );
      },
      (error) => {
        console.log("Erro ao acompanhar pagamento:", error);
        setStatusTela("pendente");
        setMensagem(
          "Pagamento enviado. Se ele foi aprovado, seu saldo será atualizado em instantes."
        );
      }
    );

    return () => unsubscribe();
  }, [orderNsu]);

  const aprovado = statusTela === "aprovado";
  const erro = statusTela === "erro";
  const carregando = statusTela === "carregando" || statusTela === "pendente";

  async function abrirAplicativo() {
    try {
      await Linking.openURL(deepLinkApp);
    } catch (error) {
      console.log("Erro ao abrir app:", error);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#006B2E" />

      <View style={styles.header}>
        <Text style={styles.logo}>⚽ Bolão10</Text>
        <Text style={styles.headerText}>Retorno do pagamento</Text>
      </View>

      <View style={styles.container}>
        <View style={styles.card}>
          <View
            style={[
              styles.iconCircle,
              aprovado && styles.iconCircleSuccess,
              erro && styles.iconCircleError,
            ]}
          >
            <Text style={styles.iconText}>
              {aprovado ? "✅" : erro ? "⚠️" : "⏳"}
            </Text>
          </View>

          <Text style={styles.title}>
            {aprovado
              ? "Pagamento aprovado!"
              : erro
              ? "Pagamento não confirmado"
              : "Confirmando pagamento"}
          </Text>

          <Text style={styles.message}>{mensagem}</Text>

          {valorPago !== null && (
            <View style={styles.valueBox}>
              <Text style={styles.valueLabel}>Valor do depósito</Text>
              <Text style={styles.valueText}>
                {valorPago.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                BRL
              </Text>
            </View>
          )}

          {user?.email && (
            <Text style={styles.userText}>Conta: {user.email}</Text>
          )}

          {carregando && <ActivityIndicator color="#006B2E" size="large" />}

          {Platform.OS === "web" && (
            <View style={styles.appBox}>
              <Text style={styles.appBoxTitle}>Tem o APK instalado?</Text>

              <Text style={styles.appBoxText}>
                Vamos tentar abrir o aplicativo automaticamente. Se aparecer uma
                mensagem do navegador, toque em abrir.
              </Text>

              <TouchableOpacity style={styles.openAppButton} onPress={abrirAplicativo}>
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
            style={styles.primaryButton}
            onPress={() => router.replace("/perfil")}
          >
            <Text style={styles.primaryButtonText}>Voltar para meu perfil</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.secondaryButtonText}>Ir para início</Text>
          </TouchableOpacity>

          <Text style={styles.helpText}>
            O saldo é confirmado pelo webhook da InfinitePay. Se ainda não
            apareceu, aguarde alguns segundos e atualize o Perfil.
          </Text>
        </View>
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
    color: "#DFFFEA",
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
    backgroundColor: "#FFFFFF",
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

  iconText: {
    fontSize: 42,
  },

  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },

  message: {
    color: "#4B5563",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 18,
  },

  valueBox: {
    width: "100%",
    backgroundColor: "#F1FFF5",
    borderWidth: 1,
    borderColor: "#BEE7C9",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },

  valueLabel: {
    color: "#006B2E",
    fontSize: 13,
    fontWeight: "800",
  },

  valueText: {
    color: "#006B2E",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
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
    backgroundColor: "#006B2E",
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
    backgroundColor: "#006B2E",
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
    borderColor: "#D1D5DB",
  },

  secondaryButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },

  helpText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 14,
  },
});
