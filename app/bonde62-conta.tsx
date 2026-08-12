import { router, useLocalSearchParams } from "expo-router";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { bonde62Auth } from "../services/bonde62Firebase";

type Modo = "entrar" | "criar";

function traduzirErroFirebase(code?: string) {
  switch (code) {
    case "auth/email-already-in-use":
      return "Esse e-mail já possui uma conta. Entre com sua senha.";
    case "auth/invalid-email":
      return "Digite um e-mail válido.";
    case "auth/weak-password":
      return "A senha precisa ter pelo menos 6 caracteres.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    default:
      return "Não foi possível concluir agora. Tente novamente.";
  }
}

export default function Bonde62Conta() {
  const params = useLocalSearchParams();

  const emailInicial = useMemo(() => {
    const valor = params.email;
    if (Array.isArray(valor)) return valor[0] || "";
    return valor ? String(valor) : "";
  }, [params.email]);

  const modoInicial = useMemo<Modo>(() => {
    const valor = params.modo;
    const modoTexto = Array.isArray(valor) ? valor[0] : valor;
    return modoTexto === "entrar" ? "entrar" : "criar";
  }, [params.modo]);

  const veioDaCompra = useMemo(() => {
    const valor = params.origem;
    const origemTexto = Array.isArray(valor) ? valor[0] : valor;
    return origemTexto === "compra" && Boolean(emailInicial);
  }, [params.origem, emailInicial]);

  const [modo, setModo] = useState<Modo>(modoInicial);
  const [email, setEmail] = useState(emailInicial);
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [erroFormulario, setErroFormulario] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState<any>(null);

  useEffect(() => {
    if (emailInicial) {
      setEmail(emailInicial);
    }
  }, [emailInicial]);

  useEffect(() => {
    setModo(modoInicial);
  }, [modoInicial]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(bonde62Auth, (user) => {
      setUsuarioAtual(user);
    });

    return unsubscribe;
  }, []);

  async function entrar() {
    setErroFormulario("");

    if (!email.trim() || !senha) {
      setErroFormulario("Digite seu e-mail e sua senha.");
      return;
    }

    if (senha.length < 6) {
      setErroFormulario("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    try {
      setCarregando(true);

      await signInWithEmailAndPassword(
        bonde62Auth,
        email.trim().toLowerCase(),
        senha
      );

      router.replace("/meus-ingressos");
    } catch (error: any) {
      setErroFormulario(traduzirErroFirebase(error?.code));
    } finally {
      setCarregando(false);
    }
  }

  async function criarConta() {
    const emailLimpo = email.trim().toLowerCase();

    setErroFormulario("");

    if (!emailLimpo || !senha || !confirmarSenha) {
      setErroFormulario(
        "Preencha a senha e a confirmação da senha."
      );
      return;
    }

    if (senha.length < 6) {
      setErroFormulario(
        "Sua senha precisa ter pelo menos 6 caracteres."
      );
      return;
    }

    if (senha !== confirmarSenha) {
      setErroFormulario(
        "As senhas não conferem. Digite a mesma senha nos dois campos."
      );
      return;
    }

    try {
      setCarregando(true);

      const credencial = await createUserWithEmailAndPassword(
        bonde62Auth,
        emailLimpo,
        senha
      );

      // Já deixamos a confirmação por e-mail preparada.
      // Nesta primeira fase ela não bloqueia o acesso aos ingressos.
      try {
        await sendEmailVerification(credencial.user);
      } catch (verificationError) {
        console.log(
          "Não foi possível enviar verificação de e-mail agora:",
          verificationError
        );
      }

      setErroFormulario("");
      router.replace("/meus-ingressos");
    } catch (error: any) {
      if (error?.code === "auth/email-already-in-use") {
        setModo("entrar");
      }

      setErroFormulario(traduzirErroFirebase(error?.code));
    } finally {
      setCarregando(false);
    }
  }

  async function sair() {
    await signOut(bonde62Auth);
    setSenha("");
    setConfirmarSenha("");
    setModo("entrar");
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      keyboardShouldPersistTaps="handled"
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

        <TouchableOpacity onPress={() => router.push("/meus-ingressos")}>
          <Text style={styles.topLink}>MEUS INGRESSOS</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <View style={styles.infoBox}>
          <Text style={styles.kicker}>SUA CONTA BONDE 62</Text>
          <Text style={styles.heroTitle}>
            Seus ingressos,
            {"\n"}
            <Text style={styles.pink}>sempre com você.</Text>
          </Text>

          <Text style={styles.heroText}>
            Você pode comprar primeiro e criar sua senha depois. As compras ficam
            ligadas ao e-mail informado no pagamento.
          </Text>

          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🎟️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Todos os ingressos em um lugar</Text>
              <Text style={styles.featureText}>
                Comprou novamente com o mesmo e-mail? O novo ingresso aparece na
                mesma conta.
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🔐</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Acesso com e-mail e senha</Text>
              <Text style={styles.featureText}>
                Nas próximas vezes, basta entrar e abrir Meus Ingressos.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          {usuarioAtual ? (
            <>
              <Text style={styles.cardKicker}>CONTA CONECTADA</Text>
              <Text style={styles.cardTitle}>Você já está logado</Text>
              <Text style={styles.muted}>{usuarioAtual.email}</Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.replace("/meus-ingressos")}
              >
                <Text style={styles.primaryButtonText}>VER MEUS INGRESSOS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={sair}>
                <Text style={styles.secondaryButtonText}>SAIR DA CONTA</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, modo === "criar" && styles.tabActive]}
                  onPress={() => {
                    setModo("criar");
                    setErroFormulario("");
                  }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      modo === "criar" && styles.tabTextActive,
                    ]}
                  >
                    CRIAR SENHA
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tab, modo === "entrar" && styles.tabActive]}
                  onPress={() => {
                    setModo("entrar");
                    setErroFormulario("");
                  }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      modo === "entrar" && styles.tabTextActive,
                    ]}
                  >
                    JÁ TENHO CONTA
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.cardTitle}>
                {modo === "criar"
                  ? "Crie sua senha"
                  : "Entre na sua conta"}
              </Text>

              <Text style={styles.cardDescription}>
                {modo === "criar"
                  ? veioDaCompra
                    ? "Seu e-mail já foi identificado pela compra. Agora crie apenas a sua senha."
                    : "Use o mesmo e-mail informado na compra."
                  : veioDaCompra
                  ? "Seu e-mail já foi identificado. Digite apenas a senha da sua conta."
                  : "Entre com o e-mail e a senha que você criou."}
              </Text>

              {veioDaCompra ? (
                <View style={styles.lockedEmailBox}>
                  <Text style={styles.lockedEmailLabel}>
                    E-MAIL DA COMPRA
                  </Text>
                  <Text style={styles.lockedEmailValue}>
                    {email}
                  </Text>
                  <Text style={styles.lockedEmailHint}>
                    Este ingresso ficará vinculado a este e-mail.
                  </Text>
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Seu e-mail"
                  placeholderTextColor="#7d7086"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}

              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.passwordInput}
                  value={senha}
                  onChangeText={(valor) => {
                    setSenha(valor);
                    if (erroFormulario) setErroFormulario("");
                  }}
                  placeholder="Sua senha (mínimo 6 caracteres)"
                  placeholderTextColor="#7d7086"
                  secureTextEntry={!mostrarSenha}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setMostrarSenha((atual) => !atual)}
                >
                  <Text style={styles.eyeButtonText}>
                    {mostrarSenha ? "OCULTAR" : "VER"}
                  </Text>
                </TouchableOpacity>
              </View>

              {modo === "criar" ? (
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmarSenha}
                    onChangeText={(valor) => {
                      setConfirmarSenha(valor);
                      if (erroFormulario) setErroFormulario("");
                    }}
                    placeholder="Confirme sua senha"
                    placeholderTextColor="#7d7086"
                    secureTextEntry={!mostrarConfirmarSenha}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() =>
                      setMostrarConfirmarSenha((atual) => !atual)
                    }
                  >
                    <Text style={styles.eyeButtonText}>
                      {mostrarConfirmarSenha ? "OCULTAR" : "VER"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <Text style={styles.passwordHint}>
                A senha deve ter pelo menos 6 caracteres.
              </Text>

              {erroFormulario ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠ {erroFormulario}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryButton, carregando && styles.disabled]}
                onPress={modo === "criar" ? criarConta : entrar}
                disabled={carregando}
              >
                {carregando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {modo === "criar"
                      ? "CRIAR SENHA E VER MEUS INGRESSOS"
                      : "ENTRAR E VER MEUS INGRESSOS"}
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={styles.securityText}>
                🔒 Sua senha é gerenciada pelo Firebase Authentication. Ela não
                fica salva em texto no nosso banco de ingressos.
              </Text>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#050008",
  },
  pageContent: {
    minHeight: "100%" as any,
    paddingBottom: 50,
    overflow: "hidden",
  },
  glowPink: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: "rgba(255,22,132,0.18)",
    right: -180,
    top: -160,
  },
  glowPurple: {
    position: "absolute",
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: "rgba(120,0,255,0.16)",
    left: -190,
    bottom: -160,
  },
  topbar: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 24,
    minHeight: 92,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  topLink: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
  container: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 55,
    gap: 30,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  infoBox: {
    flex: 1,
    minWidth: 310,
    paddingVertical: 20,
  },
  kicker: {
    color: "#ff1684",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.5,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 44,
    lineHeight: 50,
    fontWeight: "900",
    marginTop: 12,
  },
  heroText: {
    color: "#d6ccdf",
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 570,
    marginTop: 18,
    marginBottom: 22,
  },
  feature: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 13,
    maxWidth: 570,
  },
  featureIcon: {
    fontSize: 26,
  },
  featureTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
  featureText: {
    color: "#a99db2",
    lineHeight: 20,
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    width: 430,
    maxWidth: "100%",
    backgroundColor: "#120018",
    borderColor: "rgba(255,22,132,0.5)",
    borderWidth: 1,
    borderRadius: 26,
    padding: 26,
  },
  cardKicker: {
    color: "#18c96e",
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: 11,
  },
  cardTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 27,
    marginTop: 16,
  },
  cardDescription: {
    color: "#b8aabd",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  muted: {
    color: "#b8aabd",
    marginTop: 8,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#0a000f",
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: "#ff1684",
  },
  tabText: {
    color: "#a99db2",
    fontWeight: "900",
    fontSize: 10,
  },
  tabTextActive: {
    color: "#fff",
  },
  input: {
    width: "100%",
    marginTop: 13,
    borderRadius: 13,
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    backgroundColor: "#1a0521",
    color: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 14,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#ff1684",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 18,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },
  secondaryButton: {
    width: "100%",
    borderColor: "rgba(255,22,132,0.55)",
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
  securityText: {
    color: "#85788e",
    textAlign: "center",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 16,
  },
  disabled: {
    opacity: 0.6,
  },

  lockedEmailBox: {
    width: "100%",
    marginTop: 14,
    borderRadius: 13,
    borderColor: "rgba(255,22,132,0.35)",
    borderWidth: 1,
    backgroundColor: "#1a0521",
    paddingHorizontal: 15,
    paddingVertical: 14,
  },

  lockedEmailLabel: {
    color: "#8f8199",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  lockedEmailValue: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
    marginTop: 5,
  },

  lockedEmailHint: {
    color: "#8d8195",
    fontSize: 9,
    marginTop: 5,
  },


  passwordWrap: {
    width: "100%",
    marginTop: 13,
    borderRadius: 13,
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    backgroundColor: "#1a0521",
    flexDirection: "row",
    alignItems: "center",
  },

  passwordInput: {
    flex: 1,
    color: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 14,
    outlineStyle: "none" as any,
  },

  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 15,
  },

  eyeButtonText: {
    color: "#ff1684",
    fontSize: 10,
    fontWeight: "900",
  },

  passwordHint: {
    color: "#8d8195",
    fontSize: 10,
    marginTop: 9,
  },

  errorBox: {
    width: "100%",
    backgroundColor: "rgba(255,80,104,0.10)",
    borderColor: "rgba(255,80,104,0.55)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginTop: 12,
  },

  errorText: {
    color: "#ff7b8d",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
  },

});