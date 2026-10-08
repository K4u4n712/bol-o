import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

const produto = require("../assets/images/loja/aspirador-principal.png");

type Formulario = {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
};

const formularioInicial: Formulario = {
  nome: "",
  cpf: "",
  email: "",
  telefone: "",
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
};

export default function CheckoutLoja() {
  const { width } = useWindowDimensions();
  const mobile = width < 850;

  const [form, setForm] = useState<Formulario>(formularioInicial);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState("");
  const [erro, setErro] = useState("");
  const [processandoPagamento, setProcessandoPagamento] = useState(false);

  function alterar(campo: keyof Formulario, valor: string) {
    setForm((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));

    setErro("");
  }

  function formatarCPF(valor: string) {
    const numeros = valor.replace(/\D/g, "").slice(0, 11);

    return numeros
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function formatarTelefone(valor: string) {
    const numeros = valor.replace(/\D/g, "").slice(0, 11);

    if (numeros.length <= 10) {
      return numeros
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }

    return numeros
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }

  function formatarCEP(valor: string) {
    const numeros = valor.replace(/\D/g, "").slice(0, 8);

    return numeros.replace(/(\d{5})(\d)/, "$1-$2");
  }

  async function buscarCEP(valor?: string) {
    const cep = (valor ?? form.cep).replace(/\D/g, "");

    if (cep.length !== 8) {
      setErroCep("Digite um CEP válido com 8 números.");
      return;
    }

    try {
      setBuscandoCep(true);
      setErroCep("");

      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados = await resposta.json();

      if (dados.erro) {
        setErroCep("CEP não encontrado.");
        return;
      }

      setForm((anterior) => ({
        ...anterior,
        cep: formatarCEP(cep),
        rua: dados.logradouro || anterior.rua,
        bairro: dados.bairro || anterior.bairro,
        cidade: dados.localidade || anterior.cidade,
        estado: dados.uf || anterior.estado,
      }));
    } catch {
      setErroCep("Não foi possível consultar o CEP agora.");
    } finally {
      setBuscandoCep(false);
    }
  }

  async function continuarPagamento() {
    if (processandoPagamento) return;

    const obrigatorios = [
      form.nome,
      form.cpf,
      form.email,
      form.telefone,
      form.cep,
      form.rua,
      form.numero,
      form.bairro,
      form.cidade,
      form.estado,
    ];

    if (obrigatorios.some((campo) => !campo.trim())) {
      setErro("Preencha todos os campos obrigatórios antes de continuar.");
      return;
    }

    const cpfNumeros = form.cpf.replace(/\D/g, "");
    const telefoneNumeros = form.telefone.replace(/\D/g, "");
    const cepNumeros = form.cep.replace(/\D/g, "");

    if (form.nome.trim().length < 3) {
      setErro("Digite seu nome completo.");
      return;
    }

    if (cpfNumeros.length !== 11) {
      setErro("Digite um CPF válido.");
      return;
    }

    if (!form.email.includes("@") || !form.email.includes(".")) {
      setErro("Digite um e-mail válido.");
      return;
    }

    if (telefoneNumeros.length < 10) {
      setErro("Digite um telefone/WhatsApp válido.");
      return;
    }

    if (cepNumeros.length !== 8) {
      setErro("Digite um CEP válido.");
      return;
    }

    setErro("");
    setProcessandoPagamento(true);

    try {
 const apiBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://bol-o-rouge.vercel.app";

      const resposta = await fetch(`${apiBase}/api/create-pix-loja`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: form.nome.trim(),
          cpf: form.cpf,
          email: form.email.trim(),
          telefone: form.telefone,
          cep: form.cep,
          rua: form.rua.trim(),
          numero: form.numero.trim(),
          complemento: form.complemento.trim(),
          bairro: form.bairro.trim(),
          cidade: form.cidade.trim(),
          estado: form.estado.trim(),
        }),
      });

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok || !dados?.success) {
        throw new Error(
          dados?.message || "Não foi possível iniciar o pagamento Pix."
        );
      }

      router.push({
        pathname: "/pagamento-loja",
        params: {
          pedido_id: String(dados.pedido_id || dados.order_nsu || ""),
          order_id: String(dados.order_id || ""),
          payment_id: String(dados.payment_id || ""),
          status: String(dados.status || "pending"),
          valor: String(dados.valor || 99.9),
          qr_code: String(dados.qr_code || ""),
          qr_code_base64: String(dados.qr_code_base64 || ""),
          ticket_url: String(dados.ticket_url || ""),
          teste: dados.teste ? "1" : "0",
        },
      });
    } catch (e) {
      const mensagem =
        e instanceof Error
          ? e.message
          : "Não foi possível iniciar o pagamento. Tente novamente.";

      setErro(mensagem);
    } finally {
      setProcessandoPagamento(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* TOPO */}

        <View style={styles.top}>
          <View style={styles.topInner}>
            <Pressable onPress={() => router.push("/loja")}>
              <Text style={styles.logo}>
                Air<Text style={styles.logoBlue}>Clean</Text>
              </Text>
              <Text style={styles.logoSub}>CHECKOUT SEGURO</Text>
            </Pressable>

            <View style={styles.secureTop}>
              <Text style={styles.lock}>🔒</Text>

              <View>
                <Text style={styles.secureTitle}>Compra protegida</Text>
                <Text style={styles.secureSubtitle}>
                  Seus dados estão protegidos
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* PROGRESSO */}

        <View style={styles.progressArea}>
          <View style={styles.progressInner}>
            <View style={styles.progressItem}>
              <View style={[styles.progressCircle, styles.progressActive]}>
                <Text style={styles.progressNumberActive}>1</Text>
              </View>

              <Text style={styles.progressTextActive}>Dados</Text>
            </View>

            <View style={styles.progressLine} />

            <View style={styles.progressItem}>
              <View style={styles.progressCircle}>
                <Text style={styles.progressNumber}>2</Text>
              </View>

              <Text style={styles.progressText}>Pagamento</Text>
            </View>

            <View style={styles.progressLine} />

            <View style={styles.progressItem}>
              <View style={styles.progressCircle}>
                <Text style={styles.progressNumber}>3</Text>
              </View>

              <Text style={styles.progressText}>Confirmação</Text>
            </View>
          </View>
        </View>

        {/* CONTEÚDO */}

        <View
          style={[
            styles.checkout,
            mobile && styles.checkoutMobile,
          ]}
        >
          {/* FORMULÁRIO */}

          <View
            style={[
              styles.formColumn,
              mobile && styles.fullWidth,
            ]}
          >
            <Pressable
              onPress={() => router.push("/loja")}
              style={styles.backButton}
            >
              <Text style={styles.backText}>‹ Voltar para a loja</Text>
            </Pressable>

            <Text style={styles.checkoutEyebrow}>FINALIZE SUA COMPRA</Text>

            <Text
              style={[
                styles.checkoutTitle,
                mobile && styles.checkoutTitleMobile,
              ]}
            >
              Falta pouco para o seu AirClean chegar até você.
            </Text>

            <Text style={styles.checkoutDescription}>
              Preencha seus dados abaixo para continuar para o pagamento.
            </Text>

            {/* CONTATO */}

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardNumber}>
                  <Text style={styles.cardNumberText}>1</Text>
                </View>

                <View>
                  <Text style={styles.cardTitle}>Seus dados</Text>
                  <Text style={styles.cardSubtitle}>
                    Para identificação e contato do pedido
                  </Text>
                </View>
              </View>

              <Campo
                titulo="Nome completo *"
                placeholder="Digite seu nome completo"
                value={form.nome}
                onChangeText={(v) => alterar("nome", v)}
                autoComplete="name"
              />

              <View
                style={[
                  styles.inputRow,
                  mobile && styles.inputRowMobile,
                ]}
              >
                <View style={styles.inputHalf}>
                  <Campo
                    titulo="CPF *"
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChangeText={(v) =>
                      alterar("cpf", formatarCPF(v))
                    }
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputHalf}>
                  <Campo
                    titulo="WhatsApp *"
                    placeholder="(62) 99999-9999"
                    value={form.telefone}
                    onChangeText={(v) =>
                      alterar("telefone", formatarTelefone(v))
                    }
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <Campo
                titulo="E-mail *"
                placeholder="seuemail@exemplo.com"
                value={form.email}
                onChangeText={(v) => alterar("email", v)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            {/* ENTREGA */}

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardNumber}>
                  <Text style={styles.cardNumberText}>2</Text>
                </View>

                <View>
                  <Text style={styles.cardTitle}>
                    Endereço de entrega
                  </Text>

                  <Text style={styles.cardSubtitle}>
                    Informe onde deseja receber seu pedido
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>CEP *</Text>

              <View style={styles.cepRow}>
                <TextInput
                  style={[styles.input, styles.cepInput]}
                  placeholder="00000-000"
                  placeholderTextColor="#aaa"
                  value={form.cep}
                  keyboardType="numeric"
                  onChangeText={(valor) => {
                    const formatado = formatarCEP(valor);

                    alterar("cep", formatado);
                    setErroCep("");

                    if (formatado.replace(/\D/g, "").length === 8) {
                      buscarCEP(formatado);
                    }
                  }}
                />

                <Pressable
                  onPress={() => buscarCEP()}
                  style={({ pressed }) => [
                    styles.cepButton,
                    pressed && styles.pressed,
                  ]}
                >
                  {buscandoCep ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.cepButtonText}>BUSCAR</Text>
                  )}
                </Pressable>
              </View>

              {!!erroCep && (
                <Text style={styles.fieldError}>{erroCep}</Text>
              )}

              <Campo
                titulo="Rua / Avenida *"
                placeholder="Nome da rua"
                value={form.rua}
                onChangeText={(v) => alterar("rua", v)}
              />

              <View
                style={[
                  styles.inputRow,
                  mobile && styles.inputRowMobile,
                ]}
              >
                <View style={styles.numberInput}>
                  <Campo
                    titulo="Número *"
                    placeholder="123"
                    value={form.numero}
                    onChangeText={(v) => alterar("numero", v)}
                  />
                </View>

                <View style={styles.complementInput}>
                  <Campo
                    titulo="Complemento"
                    placeholder="Apto, bloco, casa..."
                    value={form.complemento}
                    onChangeText={(v) =>
                      alterar("complemento", v)
                    }
                  />
                </View>
              </View>

              <Campo
                titulo="Bairro *"
                placeholder="Seu bairro"
                value={form.bairro}
                onChangeText={(v) => alterar("bairro", v)}
              />

              <View
                style={[
                  styles.inputRow,
                  mobile && styles.inputRowMobile,
                ]}
              >
                <View style={styles.cityInput}>
                  <Campo
                    titulo="Cidade *"
                    placeholder="Cidade"
                    value={form.cidade}
                    onChangeText={(v) => alterar("cidade", v)}
                  />
                </View>

                <View style={styles.stateInput}>
                  <Campo
                    titulo="UF *"
                    placeholder="GO"
                    value={form.estado}
                    onChangeText={(v) =>
                      alterar(
                        "estado",
                        v.toUpperCase().slice(0, 2)
                      )
                    }
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            </View>

            {mobile && (
              <ResumoPedido
                comprar={continuarPagamento}
                erro={erro}
                processando={processandoPagamento}
              />
            )}
          </View>

          {/* RESUMO DESKTOP */}

          {!mobile && (
            <View style={styles.summaryColumn}>
              <View style={styles.stickySummary}>
                <ResumoPedido
                  comprar={continuarPagamento}
                  erro={erro}
                  processando={processandoPagamento}
                />
              </View>
            </View>
          )}
        </View>

        {/* RODAPÉ */}

        <View style={styles.footer}>
          <Text style={styles.footerSecurity}>
            🔒 Checkout protegido
          </Text>

          <Text style={styles.footerText}>
            © 2026 AirClean. Todos os direitos reservados.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* CAMPO */

type CampoProps = {
  titulo: string;
  placeholder?: string;
  value: string;
  onChangeText: (texto: string) => void;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: any;
};

function Campo({
  titulo,
  ...props
}: CampoProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{titulo}</Text>

      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor="#aaa"
      />
    </View>
  );
}

/* RESUMO */

function ResumoPedido({
  comprar,
  erro,
  processando,
}: {
  comprar: () => void;
  erro: string;
  processando: boolean;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Resumo do pedido</Text>

      <View style={styles.summaryDivider} />

      <View style={styles.productRow}>
        <View style={styles.productImageBox}>
          <Image
            source={produto}
            style={styles.productImage}
            resizeMode="cover"
          />

          <View style={styles.quantityBadge}>
            <Text style={styles.quantityText}>1</Text>
          </View>
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName}>
            Mini Aspirador AirClean 3 em 1
          </Text>

          <Text style={styles.productModel}>Modelo AS-228</Text>

          <Text style={styles.productFeature}>
            Sem fio • Recarregável
          </Text>
        </View>

        <Text style={styles.productPrice}>R$ 69,90</Text>
      </View>

      <View style={styles.summaryDivider} />

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Subtotal</Text>
        <Text style={styles.priceValue}>R$ 69,90</Text>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Entrega</Text>
        <Text style={styles.shippingText}>Calculada no pedido</Text>
      </View>

      <View style={styles.summaryDivider} />

      <View style={styles.totalRow}>
        <View>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalPayment}>Pagamento via Pix</Text>
        </View>

        <Text style={styles.totalPrice}>R$ 69,90</Text>
      </View>

      <View style={styles.pixBox}>
        <View style={styles.pixIcon}>
          <Text style={styles.pixIconText}>◆</Text>
        </View>

        <View style={styles.pixInfo}>
          <Text style={styles.pixTitle}>Pagamento via Pix</Text>

          <Text style={styles.pixDescription}>
            Na próxima etapa você receberá o QR Code e o código
            Pix Copia e Cola.
          </Text>
        </View>
      </View>

      {!!erro && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠ {erro}</Text>
        </View>
      )}

      <Pressable
        onPress={comprar}
        disabled={processando}
        style={({ pressed }) => [
          styles.payButton,
          processando && styles.payButtonDisabled,
          pressed && !processando && styles.pressed,
        ]}
      >
        {processando ? (
          <View style={styles.payButtonLoading}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.payButtonText}>GERANDO PIX...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.payButtonText}>IR PARA O PAGAMENTO</Text>
            <Text style={styles.payButtonPrice}>R$ 69,90</Text>
          </>
        )}
      </Pressable>

      <View style={styles.securityList}>
        <Text style={styles.securityItem}>
          🔒 Seus dados estão protegidos
        </Text>

        <Text style={styles.securityItem}>
          📦 Pedido com acompanhamento
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },

  page: {
    flex: 1,
  },

  pageContent: {
    flexGrow: 1,
  },

  fullWidth: {
    width: "100%",
  },

  top: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eaeaea",
  },

  topInner: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  logo: {
    color: "#111",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -1.2,
  },

  logoBlue: {
    color: "#2787d9",
  },

  logoSub: {
    color: "#999",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.7,
    marginTop: 2,
  },

  secureTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  lock: {
    fontSize: 18,
  },

  secureTitle: {
    color: "#222",
    fontSize: 11,
    fontWeight: "900",
  },

  secureSubtitle: {
    color: "#999",
    fontSize: 9,
    marginTop: 1,
  },

  progressArea: {
    backgroundColor: "#fff",
  },

  progressInner: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 17,
    paddingBottom: 21,
    flexDirection: "row",
    alignItems: "center",
  },

  progressItem: {
    alignItems: "center",
  },

  progressCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },

  progressActive: {
    backgroundColor: "#111",
  },

  progressNumber: {
    color: "#999",
    fontSize: 11,
    fontWeight: "900",
  },

  progressNumberActive: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },

  progressText: {
    color: "#aaa",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 5,
  },

  progressTextActive: {
    color: "#111",
    fontSize: 9,
    fontWeight: "900",
    marginTop: 5,
  },

  progressLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
    marginHorizontal: 9,
    marginBottom: 17,
  },

  checkout: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 38,
    paddingBottom: 70,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 42,
  },

  checkoutMobile: {
    flexDirection: "column",
    paddingTop: 25,
  },

  formColumn: {
    flex: 1.12,
    minWidth: 0,
  },

  summaryColumn: {
    flex: 0.88,
    minWidth: 0,
  },

  stickySummary: {
    width: "100%",
  },

  backButton: {
    alignSelf: "flex-start",
    marginBottom: 24,
  },

  backText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "700",
  },

  checkoutEyebrow: {
    color: "#2787d9",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
  },

  checkoutTitle: {
    color: "#111",
    fontSize: 36,
    lineHeight: 41,
    fontWeight: "900",
    letterSpacing: -1.3,
    marginTop: 9,
    maxWidth: 620,
  },

  checkoutTitleMobile: {
    fontSize: 29,
    lineHeight: 34,
  },

  checkoutDescription: {
    color: "#777",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 26,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e9e9e9",

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 23,
  },

  cardNumber: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  cardNumberText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },

  cardTitle: {
    color: "#111",
    fontSize: 17,
    fontWeight: "900",
  },

  cardSubtitle: {
    color: "#999",
    fontSize: 10,
    marginTop: 2,
  },

  field: {
    marginBottom: 17,
  },

  label: {
    color: "#333",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 7,
  },

  input: {
    width: "100%",
    height: 48,
    borderWidth: 1,
    borderColor: "#dedede",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    color: "#111",
    fontSize: 13,
    outlineStyle: "none",
  } as any,

  inputRow: {
    flexDirection: "row",
    gap: 13,
  },

  inputRowMobile: {
    flexDirection: "column",
    gap: 0,
  },

  inputHalf: {
    flex: 1,
  },

  numberInput: {
    flex: 0.35,
  },

  complementInput: {
    flex: 0.65,
  },

  cityInput: {
    flex: 0.75,
  },

  stateInput: {
    flex: 0.25,
  },

  cepRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 5,
  },

  cepInput: {
    flex: 1,
  },

  cepButton: {
    width: 100,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  cepButtonText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },

  fieldError: {
    color: "#c62828",
    fontSize: 10,
    marginBottom: 15,
  },

  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e8e8e8",

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },

  summaryTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  summaryDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#ededed",
    marginVertical: 19,
  },

  productRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  productImageBox: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: "visible",
    backgroundColor: "#f2f2f2",
    position: "relative",
  },

  productImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },

  quantityBadge: {
    position: "absolute",
    right: -7,
    top: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  quantityText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
  },

  productInfo: {
    flex: 1,
    paddingLeft: 13,
    paddingRight: 8,
  },

  productName: {
    color: "#111",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },

  productModel: {
    color: "#999",
    fontSize: 9,
    marginTop: 3,
  },

  productFeature: {
    color: "#777",
    fontSize: 9,
    marginTop: 6,
  },

  productPrice: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
  },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 11,
  },

  priceLabel: {
    color: "#777",
    fontSize: 12,
  },

  priceValue: {
    color: "#222",
    fontSize: 12,
    fontWeight: "700",
  },

  shippingText: {
    color: "#2787d9",
    fontSize: 10,
    fontWeight: "800",
  },

  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  totalLabel: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
  },

  totalPayment: {
    color: "#999",
    fontSize: 9,
    marginTop: 2,
  },

  totalPrice: {
    color: "#111",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  pixBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f9ff",
    borderWidth: 1,
    borderColor: "#dceeff",
    borderRadius: 13,
    padding: 14,
    marginTop: 21,
    gap: 11,
  },

  pixIcon: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: "#2787d9",
    alignItems: "center",
    justifyContent: "center",
  },

  pixIconText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
  },

  pixInfo: {
    flex: 1,
  },

  pixTitle: {
    color: "#111",
    fontSize: 11,
    fontWeight: "900",
  },

  pixDescription: {
    color: "#777",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },

  errorBox: {
    backgroundColor: "#fff3f3",
    borderWidth: 1,
    borderColor: "#ffd8d8",
    padding: 11,
    borderRadius: 9,
    marginTop: 15,
  },

  errorText: {
    color: "#b42318",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
  },

  payButton: {
    width: "100%",
    backgroundColor: "#111",
    borderRadius: 12,
    paddingHorizontal: 17,
    paddingVertical: 16,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  payButtonDisabled: {
    opacity: 0.65,
  },

  payButtonLoading: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  payButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  payButtonPrice: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.82,
  },

  securityList: {
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },

  securityItem: {
    color: "#888",
    fontSize: 9,
  },

  footer: {
    backgroundColor: "#111",
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: "center",
  },

  footerSecurity: {
    color: "#ddd",
    fontSize: 10,
    fontWeight: "800",
  },

  footerText: {
    color: "#666",
    fontSize: 9,
    marginTop: 8,
  },
});