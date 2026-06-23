import React, { useState, useEffect } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";

export default function LoginScreen() {
  // ADICIONADO: Puxando o 'user' do contexto para verificar se já está logado
  const { login, register, user } = useAuth();

  const [modoCadastro, setModoCadastro] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  // NOVO: Efeito que roda assim que a tela abre. 
  // Se já existir um usuário logado (salvo no celular), ele pula pro app direto.
  useEffect(() => {
    if (user) {
      router.replace("/(tabs)");
    }
  }, [user]);

  async function entrar() {
    try {
      await login(email.trim(), senha.trim());
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Erro no login", error.message);
    }
  }

  async function cadastrar() {
    try {
      await register(nome.trim(), email.trim(), senha.trim());
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Erro no cadastro", error.message);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#006B2E" />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>⚽</Text>
            <Text style={styles.logo}>Bolão do Brasa</Text>
            <Text style={styles.subtitle}>
              Entre no seu bolão entre família e amigos
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>
              {modoCadastro ? "Criar conta" : "Entrar na conta"}
            </Text>

            <Text style={styles.description}>
              {modoCadastro
                ? "Cadastre seus dados para começar a dar palpites."
                : "Faça login para acessar seus palpites e bolões."}
            </Text>

            {modoCadastro && (
              <View style={styles.inputBox}>
                <Text style={styles.label}>Nome</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite seu nome"
                  placeholderTextColor="#9CA3AF"
                  value={nome}
                  onChangeText={setNome}
                />
              </View>
            )}

            <View style={styles.inputBox}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite seu e-mail"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputBox}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite sua senha"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={senha}
                onChangeText={setSenha}
              />
            </View>

            <TouchableOpacity
              style={styles.mainButton}
              onPress={modoCadastro ? cadastrar : entrar}
            >
              <Text style={styles.mainButtonText}>
                {modoCadastro ? "Criar conta" : "Entrar"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setModoCadastro(!modoCadastro)}
            >
              <Text style={styles.switchText}>
                {modoCadastro
                  ? "Já tenho conta, fazer login"
                  : "Não tenho conta, criar cadastro"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Aviso importante</Text>
            <Text style={styles.warningText}>
              Este app usa apenas dinheiro fictício. Não envolve pagamento real,
              saque real ou aposta com dinheiro verdadeiro.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#006B2E",
  },

  keyboard: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    padding: 22,
    justifyContent: "center",
  },

  logoBox: {
    alignItems: "center",
    marginBottom: 28,
  },

  logoIcon: {
    fontSize: 64,
  },

  logo: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 8,
  },

  subtitle: {
    color: "#DFFFEA",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 22,
    elevation: 5,
  },

  title: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "900",
  },

  description: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },

  inputBox: {
    marginBottom: 15,
  },

  label: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 7,
  },

  input: {
    backgroundColor: "#F3F6F4",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
  },

  mainButton: {
    backgroundColor: "#006B2E",
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 8,
  },

  mainButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  switchButton: {
    marginTop: 18,
    alignItems: "center",
  },

  switchText: {
    color: "#006B2E",
    fontSize: 14,
    fontWeight: "900",
  },

  warningBox: {
    backgroundColor: "#FFF6BF",
    borderRadius: 18,
    padding: 16,
    marginTop: 22,
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
});