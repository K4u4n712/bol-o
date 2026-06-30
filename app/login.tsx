import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useSponsor } from "../contexts/SponsorContext";
import { db } from "../services/firebaseConfig";

const STORAGE_EMAIL_KEY = "bolao10_email_lembrado";

type ModalInfo = {
  titulo: string;
  mensagem: string;
  tipo: "erro" | "sucesso" | "info";
  textoPrincipal?: string;
  textoSecundario?: string;
  acaoSecundaria?: () => void;
};

function salvarEmailNoDispositivo(email: string) {
  try {
    const storage = (globalThis as any)?.localStorage;
    if (Platform.OS === "web" && storage) {
      storage.setItem(STORAGE_EMAIL_KEY, email);
    }
  } catch (error) {
    console.log("Não foi possível salvar o e-mail:", error);
  }
}

function removerEmailDoDispositivo() {
  try {
    const storage = (globalThis as any)?.localStorage;
    if (Platform.OS === "web" && storage) {
      storage.removeItem(STORAGE_EMAIL_KEY);
    }
  } catch (error) {
    console.log("Não foi possível remover o e-mail:", error);
  }
}

function carregarEmailDoDispositivo() {
  try {
    const storage = (globalThis as any)?.localStorage;
    if (Platform.OS === "web" && storage) {
      return storage.getItem(STORAGE_EMAIL_KEY) || "";
    }
  } catch (error) {
    console.log("Não foi possível carregar o e-mail:", error);
  }

  return "";
}

function emailEhValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginScreen() {
  const { login, register, user } = useAuth();
  const { patrocinador, temPatrocinador } = useSponsor();

  const [modoCadastro, setModoCadastro] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrarEmail, setLembrarEmail] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [modalInfo, setModalInfo] = useState<ModalInfo | null>(null);

  useEffect(() => {
    const emailSalvo = carregarEmailDoDispositivo();

    if (emailSalvo) {
      setEmail(emailSalvo);
      setLembrarEmail(true);
    }
  }, []);

  useEffect(() => {
    if (user) {
      router.replace("/");
    }
  }, [user]);

  function abrirModal(info: ModalInfo) {
    setModalInfo({
      textoPrincipal: "Entendi",
      ...info,
    });
  }

  function fecharModal() {
    setModalInfo(null);
  }

  function limparSenhaAoTrocarModo() {
    setSenha("");
    setMostrarSenha(false);
  }

  function trocarParaCadastro() {
    limparSenhaAoTrocarModo();
    setModoCadastro(true);
  }

  function trocarParaLogin() {
    limparSenhaAoTrocarModo();
    setModoCadastro(false);
  }

  function salvarPreferenciaEmail(emailNormalizado: string) {
    if (lembrarEmail) {
      salvarEmailNoDispositivo(emailNormalizado);
    } else {
      removerEmailDoDispositivo();
    }
  }

  async function emailJaTemCadastro(emailNormalizado: string) {
    const colecoes = ["users", "usuarios"];

    for (const nomeColecao of colecoes) {
      const ref = collection(db, nomeColecao);
      const qEmailLower = query(ref, where("emailLower", "==", emailNormalizado));
      const snapEmailLower = await getDocs(qEmailLower);

      if (!snapEmailLower.empty) {
        return true;
      }

      const qEmail = query(ref, where("email", "==", emailNormalizado));
      const snapEmail = await getDocs(qEmail);

      if (!snapEmail.empty) {
        return true;
      }
    }

    return false;
  }

  async function entrar() {
    const emailNormalizado = email.trim().toLowerCase();
    const senhaDigitada = senha.trim();

    if (!emailNormalizado || !senhaDigitada) {
      abrirModal({
        titulo: "Faltou preencher",
        mensagem: "Digite seu e-mail e sua senha para entrar.",
        tipo: "info",
      });
      return;
    }

    if (!emailEhValido(emailNormalizado)) {
      abrirModal({
        titulo: "E-mail inválido",
        mensagem: "Digite um e-mail válido. Exemplo: nome@email.com",
        tipo: "erro",
      });
      return;
    }

    setCarregando(true);

    let cadastroExiste: boolean | null = null;

    try {
      cadastroExiste = await emailJaTemCadastro(emailNormalizado);
    } catch (error) {
      // Se a regra do Firestore bloquear consulta sem login, não travamos o usuário.
      // Nesse caso, tentamos o login normalmente.
      cadastroExiste = null;
    }

    try {
      await login(emailNormalizado, senhaDigitada);
      salvarPreferenciaEmail(emailNormalizado);
      router.replace("/");
    } catch (error: any) {
      if (cadastroExiste === false) {
        abrirModal({
          titulo: "Você ainda não tem conta",
          mensagem:
            "Esse e-mail ainda não tem cadastro no Bolão10. Toque em criar conta para se cadastrar rapidinho.",
          tipo: "info",
          textoPrincipal: "Fechar",
          textoSecundario: "Criar conta agora",
          acaoSecundaria: trocarParaCadastro,
        });
        return;
      }

      if (cadastroExiste === true) {
        abrirModal({
          titulo: "Senha incorreta",
          mensagem:
            "Encontramos esse e-mail, mas a senha não conferiu. Confira a senha e tente novamente.",
          tipo: "erro",
        });
        return;
      }

      abrirModal({
        titulo: "Não foi possível entrar",
        mensagem:
          "Confira se o e-mail e a senha estão certos. Se for sua primeira vez, toque em criar conta grátis.",
        tipo: "erro",
        textoPrincipal: "Fechar",
        textoSecundario: "Criar conta grátis",
        acaoSecundaria: trocarParaCadastro,
      });
    } finally {
      setCarregando(false);
    }
  }

  async function cadastrar() {
    const nomeNormalizado = nome.trim();
    const emailNormalizado = email.trim().toLowerCase();
    const senhaDigitada = senha.trim();

    if (!nomeNormalizado || !emailNormalizado || !senhaDigitada) {
      abrirModal({
        titulo: "Faltou preencher",
        mensagem: "Digite seu nome, e-mail e senha para criar sua conta.",
        tipo: "info",
      });
      return;
    }

    if (!emailEhValido(emailNormalizado)) {
      abrirModal({
        titulo: "E-mail inválido",
        mensagem: "Digite um e-mail válido. Exemplo: nome@email.com",
        tipo: "erro",
      });
      return;
    }

    if (senhaDigitada.length < 6) {
      abrirModal({
        titulo: "Senha muito curta",
        mensagem: "Crie uma senha com pelo menos 6 caracteres.",
        tipo: "erro",
      });
      return;
    }

    setCarregando(true);

    try {
      await register(nomeNormalizado, emailNormalizado, senhaDigitada);
      salvarPreferenciaEmail(emailNormalizado);
      router.replace("/");
    } catch (error: any) {
      const mensagem = String(error?.message || "");

      if (mensagem.includes("já está cadastrado")) {
        abrirModal({
          titulo: "Esse e-mail já tem conta",
          mensagem:
            "Esse e-mail já foi cadastrado. Toque em fazer login e entre com sua senha.",
          tipo: "info",
          textoPrincipal: "Fechar",
          textoSecundario: "Fazer login",
          acaoSecundaria: trocarParaLogin,
        });
        return;
      }

      abrirModal({
        titulo: "Erro no cadastro",
        mensagem: mensagem || "Não conseguimos criar sua conta agora.",
        tipo: "erro",
      });
    } finally {
      setCarregando(false);
    }
  }

  function acaoPrincipal() {
    if (carregando) return;
    modoCadastro ? cadastrar() : entrar();
  }

  function executarAcaoSecundariaModal() {
    const acao = modalInfo?.acaoSecundaria;
    fecharModal();

    if (acao) {
      setTimeout(() => {
        acao();
      }, 120);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, temPatrocinador && styles.safePatrocinado]}>
      <StatusBar barStyle="light-content" backgroundColor={temPatrocinador ? "#050A07" : "#006B2E"} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoBox}>
            <View style={[styles.logoCircle, temPatrocinador && styles.logoCirclePatrocinado]}>
              <Text style={styles.logoIcon}>⚽</Text>
            </View>
            <Text style={[styles.logo, temPatrocinador && styles.logoPatrocinado]}>
              Bolão10
            </Text>
            <Text style={[styles.subtitle, temPatrocinador && styles.subtitlePatrocinado]}>
              {temPatrocinador && patrocinador
                ? `Edição especial ${patrocinador.nome}`
                : "Entre, crie sua conta e dê seu palpite."}
            </Text>
          </View>

          {temPatrocinador && patrocinador && (
            <View style={styles.sponsorWelcomeCard}>
              <View style={styles.sponsorLogoCircle}>
                <Text style={styles.sponsorLogoText}>AL</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.sponsorSmall}>PATROCINADO POR</Text>
                <Text style={styles.sponsorName}>{patrocinador.nome}</Text>
                <Text style={styles.sponsorDesc}>{patrocinador.descricao}</Text>
              </View>
            </View>
          )}

          <View style={[styles.card, temPatrocinador && styles.cardPatrocinado]}>
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, !modoCadastro && styles.modeTabActive]}
                onPress={trocarParaLogin}
                disabled={carregando}
              >
                <Text style={[styles.modeTabText, !modoCadastro && styles.modeTabTextActive]}>
                  Entrar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeTab, modoCadastro && styles.modeTabActive]}
                onPress={trocarParaCadastro}
                disabled={carregando}
              >
                <Text style={[styles.modeTabText, modoCadastro && styles.modeTabTextActive]}>
                  Criar conta
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>{modoCadastro ? "Criar conta grátis" : "Entrar na conta"}</Text>

            <Text style={styles.description}>
              {modoCadastro
                ? "Primeira vez aqui? Cadastre seu nome, e-mail e uma senha."
                : "Já tem conta? Digite seu e-mail e senha para acessar."}
            </Text>

            {!modoCadastro && (
              <View style={styles.tipBox}>
                <Text style={styles.tipIcon}>💡</Text>
                <Text style={styles.tipText}>
                  Primeira vez? Toque em <Text style={styles.tipStrong}>Criar conta</Text> antes de tentar entrar.
                </Text>
              </View>
            )}

            {modoCadastro && (
              <View style={styles.inputBox}>
                <Text style={styles.label}>Seu nome</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: João Silva"
                  placeholderTextColor="#9CA3AF"
                  value={nome}
                  onChangeText={setNome}
                  editable={!carregando}
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
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
                editable={!carregando}
              />
            </View>

            <View style={styles.inputBox}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordBox}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Digite sua senha"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!mostrarSenha}
                  value={senha}
                  onChangeText={setSenha}
                  editable={!carregando}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                />

                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setMostrarSenha(!mostrarSenha)}
                  disabled={carregando}
                >
                  <Text style={styles.eyeText}>{mostrarSenha ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setLembrarEmail(!lembrarEmail)}
              disabled={carregando}
            >
              <View style={[styles.checkbox, lembrarEmail && styles.checkboxActive]}>
                {lembrarEmail && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Lembrar meu e-mail neste aparelho</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mainButton, temPatrocinador && styles.mainButtonPatrocinado, carregando && styles.mainButtonDisabled]}
              onPress={acaoPrincipal}
              disabled={carregando}
            >
              {carregando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.mainButtonText}>
                  {modoCadastro ? "Criar minha conta" : "Entrar agora"}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.switchArea}>
              <Text style={styles.switchHelp}>
                {modoCadastro ? "Já tem cadastro?" : "Ainda não tem conta?"}
              </Text>

              <TouchableOpacity
                style={styles.switchButton}
                onPress={modoCadastro ? trocarParaLogin : trocarParaCadastro}
                disabled={carregando}
              >
                <Text style={styles.switchText}>
                  {modoCadastro ? "Fazer login" : "Criar conta grátis"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.footerText, temPatrocinador && styles.footerTextPatrocinado]}>
            {temPatrocinador && patrocinador
              ? `Bolão10 • ${patrocinador.avisoQr}`
              : "Bolão10 • simples, rápido e fácil de usar"}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={!!modalInfo}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <Pressable style={styles.modalOverlay} onPress={fecharModal}>
          <Pressable style={styles.modalCard}>
            <View
              style={[
                styles.modalIconCircle,
                modalInfo?.tipo === "erro" && styles.modalIconCircleError,
                modalInfo?.tipo === "sucesso" && styles.modalIconCircleSuccess,
              ]}
            >
              <Text style={styles.modalIcon}>
                {modalInfo?.tipo === "erro" ? "⚠️" : modalInfo?.tipo === "sucesso" ? "✅" : "ℹ️"}
              </Text>
            </View>

            <Text style={styles.modalTitle}>{modalInfo?.titulo}</Text>
            <Text style={styles.modalMessage}>{modalInfo?.mensagem}</Text>

            {modalInfo?.textoSecundario && (
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={executarAcaoSecundariaModal}>
                <Text style={styles.modalSecondaryButtonText}>{modalInfo.textoSecundario}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalMainButton} onPress={fecharModal}>
              <Text style={styles.modalMainButtonText}>{modalInfo?.textoPrincipal || "Entendi"}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 30,
    justifyContent: "center",
  },

  logoBox: {
    alignItems: "center",
    marginBottom: 22,
  },

  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },

  logoIcon: {
    fontSize: 42,
  },

  logo: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 10,
    letterSpacing: -0.5,
  },

  subtitle: {
    color: "#DFFFEA",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 20,
    elevation: 7,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },

  modeTabs: {
    flexDirection: "row",
    backgroundColor: "#F3F6F4",
    borderRadius: 18,
    padding: 5,
    marginBottom: 18,
  },

  modeTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },

  modeTabActive: {
    backgroundColor: "#006B2E",
  },

  modeTabText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "900",
  },

  modeTabTextActive: {
    color: "#FFFFFF",
  },

  title: {
    color: "#111827",
    fontSize: 25,
    fontWeight: "900",
  },

  description: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 20,
  },

  tipBox: {
    flexDirection: "row",
    backgroundColor: "#FFF8D6",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },

  tipIcon: {
    fontSize: 18,
  },

  tipText: {
    flex: 1,
    color: "#674D00",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },

  tipStrong: {
    fontWeight: "900",
  },

  inputBox: {
    marginBottom: 14,
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

  passwordBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F6F4",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },

  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
  },

  eyeButton: {
    width: 54,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },

  eyeText: {
    fontSize: 20,
  },

  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 16,
  },

  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
    backgroundColor: "#FFFFFF",
  },

  checkboxActive: {
    backgroundColor: "#006B2E",
    borderColor: "#006B2E",
  },

  checkboxMark: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  rememberText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "800",
  },

  mainButton: {
    backgroundColor: "#006B2E",
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 2,
  },

  mainButtonDisabled: {
    opacity: 0.75,
  },

  mainButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  switchArea: {
    marginTop: 18,
    alignItems: "center",
  },

  switchHelp: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 7,
  },

  switchButton: {
    backgroundColor: "#E6F4EA",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#BEE7C9",
  },

  switchText: {
    color: "#006B2E",
    fontSize: 14,
    fontWeight: "900",
  },

  footerText: {
    color: "#DFFFEA",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 18,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.54)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },

  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    elevation: 12,
  },

  modalIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#E6F4EA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  modalIconCircleError: {
    backgroundColor: "#FEE2E2",
  },

  modalIconCircleSuccess: {
    backgroundColor: "#DCFCE7",
  },

  modalIcon: {
    fontSize: 28,
  },

  modalTitle: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
  },

  modalMessage: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 18,
  },

  modalSecondaryButton: {
    width: "100%",
    backgroundColor: "#006B2E",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 10,
  },

  modalSecondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  modalMainButton: {
    width: "100%",
    backgroundColor: "#F3F6F4",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },

  modalMainButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },

  safePatrocinado: {
    backgroundColor: "#050A07",
  },

  logoCirclePatrocinado: {
    backgroundColor: "#111827",
    borderWidth: 2,
    borderColor: "#D6A941",
  },

  logoPatrocinado: {
    color: "#FFFFFF",
  },

  subtitlePatrocinado: {
    color: "#F7D989",
  },

  sponsorWelcomeCard: {
    backgroundColor: "#061A10",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#D6A941",
    padding: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },

  sponsorLogoCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#050A07",
    borderWidth: 1.5,
    borderColor: "#D6A941",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  sponsorLogoText: {
    color: "#D6A941",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
  },

  sponsorSmall: {
    color: "#D1D5DB",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },

  sponsorName: {
    color: "#D6A941",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 2,
  },

  sponsorDesc: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
    lineHeight: 17,
  },

  cardPatrocinado: {
    borderWidth: 1,
    borderColor: "#D6A941",
  },

  mainButtonPatrocinado: {
    backgroundColor: "#D6A941",
  },

  footerTextPatrocinado: {
    color: "#F7D989",
  }
});
