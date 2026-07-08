import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

const SEU_NUMERO_WHATSAPP = "5562999999999"; // TROQUE PELO SEU NÚMERO
const API_CREATE_CHECKOUT_URL =
  "https://bol-o-rouge.vercel.app/api/create-checkout";

const PRECO_LOTE_SECRETO = 29.9;
const TEMPO_PROMO_SEGUNDOS = 15 * 60;

export default function Bonde62() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [quantidade, setQuantidade] = useState("1");

  const [tempo, setTempo] = useState(TEMPO_PROMO_SEGUNDOS);
  const [modalAberto, setModalAberto] = useState(true);
  const [toast, setToast] = useState("Lote secreto liberado por tempo limitado.");
  const [comprando, setComprando] = useState(false);

  const mensagens = [
    "Algumas pessoas estão vendo o Lote Secreto agora.",
    "Vagas limitadas no preço promocional.",
    "Quem garante antes paga menos.",
    "O valor sobe depois da virada de lote.",
    "Lote Secreto disponível somente nesta abertura.",
    "Garanta seu lugar antes do contador zerar.",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTempo((atual) => {
        if (atual <= 1) return 0;
        return atual - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % mensagens.length;
      setToast(mensagens[index]);
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  const qtd = useMemo(() => {
    const valor = Number(quantidade.replace(/\D/g, ""));
    return valor > 0 ? valor : 1;
  }, [quantidade]);

  const total = qtd * PRECO_LOTE_SECRETO;

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarTempo(segundos: number) {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;

    return `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
  }

  function falarWhatsApp() {
    const mensagem = encodeURIComponent(
      `Olá! Quero garantir meu ingresso do BONDE 62 — O BAILE.\n\n` +
        `Nome: ${nome || "Não informado"}\n` +
        `WhatsApp: ${whatsapp || "Não informado"}\n` +
        `E-mail: ${email || "Não informado"}\n` +
        `Quantidade: ${qtd}\n` +
        `Total: ${formatarMoeda(total)}`
    );

    Linking.openURL(`https://wa.me/${SEU_NUMERO_WHATSAPP}?text=${mensagem}`);
  }

  async function comprarIngresso() {
    if (comprando) return;

    if (!nome.trim() || !whatsapp.trim() || !email.trim()) {
      Alert.alert(
        "Falta pouca coisa",
        "Preencha nome, WhatsApp e e-mail para continuar."
      );
      return;
    }

    try {
      setComprando(true);

      const response = await fetch(API_CREATE_CHECKOUT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipo: "bonde62_ingresso",
          evento: "bonde62",
          lote: "lote_secreto",
          nome: nome.trim(),
          whatsapp: whatsapp.trim(),
          email: email.trim(),
          quantidade: qtd,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.url) {
        console.log("Erro checkout Bonde 62:", data);

        Alert.alert(
          "Erro ao gerar pagamento",
          data?.message || "Não foi possível criar o pagamento agora."
        );

        return;
      }

      await Linking.openURL(data.url);
    } catch (error) {
      console.log("Erro ao comprar ingresso Bonde 62:", error);

      Alert.alert(
        "Erro ao abrir pagamento",
        "Não foi possível abrir o pagamento. Tente novamente em alguns segundos."
      );
    } finally {
      setComprando(false);
    }
  }

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
        <View style={styles.topUrgencyBar}>
          <Text style={styles.topUrgencyText}>
            🔥 PROMOÇÃO DO LOTE SECRETO TERMINA EM
          </Text>
          <Text style={styles.topTimer}>{formatarTempo(tempo)}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.glowPink} />
          <View style={styles.glowPurple} />

          <View style={styles.inner}>
            <View style={styles.navbar}>
              <View>
                <Text style={styles.logo}>
                  BONDE <Text style={styles.logoPink}>62</Text>
                </Text>
                <Text style={styles.logoSub}>O BAILE</Text>
              </View>

              {isWide && (
                <View style={styles.navLinks}>
                  <Text style={styles.navText}>O EVENTO</Text>
                  <Text style={styles.navText}>INGRESSOS</Text>
                  <Text style={styles.navText}>COMO FUNCIONA</Text>
                  <Text style={styles.navText}>FAQ</Text>
                </View>
              )}

              {isWide && (
                <TouchableOpacity style={styles.navButton} onPress={comprarIngresso}>
                  <Text style={styles.navButtonText}>
                    {comprando ? "GERANDO..." : "GARANTIR AGORA"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.heroGrid, isWide && styles.heroGridWide]}>
              <View style={[styles.heroTextBox, isWide && styles.heroTextBoxWide]}>
                <Text style={styles.kicker}>LOTE SECRETO • PRIMEIRA ABERTURA</Text>

                <Text style={styles.heroTitle}>
                  GOIÂNIA,{"\n"}
                  <Text style={styles.heroTitlePink}>CHAMA O BONDE.</Text>
                </Text>

                <Text style={styles.heroSubtitle}>
                  Uma noite criada para quem gosta de festa de verdade:
                  música, Open Bar, DJs, gente bonita e uma experiência
                  exclusiva para sair da rotina.
                </Text>

                <View style={styles.badgesRow}>
                  <Badge text="18+" />
                  <Badge text="Goiânia" />
                  <Badge text="Open Bar" />
                  <Badge text="Lote Secreto" />
                  <Badge text="Vagas Limitadas" />
                </View>

                <View style={styles.urgencyCard}>
                  <Text style={styles.urgencyTitle}>⚡ Preço promocional ativo</Text>
                  <Text style={styles.urgencyText}>
                    O lote secreto está aberto por tempo limitado. Depois da
                    virada, o valor sobe.
                  </Text>

                  <View style={styles.timerBox}>
                    <Text style={styles.timerLabel}>TEMPO RESTANTE</Text>
                    <Text style={styles.timerValue}>{formatarTempo(tempo)}</Text>
                  </View>
                </View>

                <View style={[styles.heroButtons, isWide && styles.heroButtonsWide]}>
                  <TouchableOpacity style={styles.mainButton} onPress={comprarIngresso}>
                    <Text style={styles.mainButtonText}>
                      {comprando ? "GERANDO PAGAMENTO..." : "🔒 GARANTIR LOTE SECRETO"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.whatsButton} onPress={falarWhatsApp}>
                    <Text style={styles.whatsButtonText}>💬 FALAR NO WHATSAPP</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.heroVisual, isWide && styles.heroVisualWide]}>
                <View style={styles.stageLight1} />
                <View style={styles.stageLight2} />
                <View style={styles.stageLight3} />

                <Text style={styles.heroVisualSmall}>NOITE EXCLUSIVA</Text>
                <Text style={styles.heroVisualTitle}>BONDE 62</Text>
                <Text style={styles.heroVisualText}>
                  Música • Open Bar • energia de baile • experiência única
                </Text>

                <View style={styles.djCard}>
                  <Text style={styles.djIcon}>🎧</Text>
                  <View>
                    <Text style={styles.djTitle}>O baile começa antes de chegar</Text>
                    <Text style={styles.djText}>Primeira abertura do lote secreto.</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.inner}>
          <View style={styles.secretPanel}>
            <View style={[styles.secretGrid, isWide && styles.secretGridWide]}>
              <View style={[styles.secretMain, isWide && styles.secretMainWide]}>
                <Text style={styles.sectionKicker}>🔥 LOTE SECRETO ABERTO</Text>
                <Text style={styles.secretTitle}>Os primeiros pagam menos.</Text>
                <Text style={styles.secretDesc}>
                  Essa é a primeira abertura do Bonde 62. O lote secreto é
                  limitado e pode virar a qualquer momento.
                </Text>

                <View style={styles.priceBox}>
                  <Text style={styles.priceSmall}>LOTE SECRETO</Text>
                  <Text style={styles.price}>R$ 29,90</Text>
                  <Text style={styles.priceTag}>APENAS 10 INGRESSOS</Text>
                  <Text style={styles.priceText}>
                    Incluso: entrada no evento + Open Bar + experiência Bonde 62.
                  </Text>
                </View>
              </View>

              <View style={[styles.lotsGrid, isWide && styles.lotsGridWide]}>
                <LotCard
                  lote="LOTE FUNDADOR"
                  valor="R$ 39,90"
                  linhas={["Depois da virada", "Preço promocional", "Vagas limitadas"]}
                />
                <LotCard
                  lote="LOTE 1"
                  valor="R$ 49,90"
                  linhas={["Próxima etapa", "Valor intermediário", "Sujeito à disponibilidade"]}
                />
                <LotCard
                  lote="LOTE 2"
                  valor="R$ 69,90"
                  linhas={["Última chamada", "Preço maior", "Não deixe para depois"]}
                />
              </View>
            </View>

            <View style={styles.microcopyBox}>
              <Text style={styles.microcopyText}>
                🧠 Quem entra primeiro paga menos. Quem deixa para depois pega a virada de lote.
              </Text>
            </View>
          </View>

          <SectionTitle title="POR QUE GARANTIR AGORA?" />

          <View style={[styles.featuresGrid, isWide && styles.featuresGridWide]}>
            <FeatureCard icon="🍾" title="OPEN BAR" text="Open Bar incluso no ingresso, sem revelar a experiência completa antes da hora." isWide={isWide} />
            <FeatureCard icon="🎧" title="DJS" text="Música para fazer o bonde curtir do início ao fim." isWide={isWide} />
            <FeatureCard icon="📍" title="LOCAL EXCLUSIVO" text="Uma experiência diferente para sair da rotina em Goiânia." isWide={isWide} />
            <FeatureCard icon="👥" title="GENTE BONITA" text="Galera animada, ambiente jovem e clima de baile." isWide={isWide} />
            <FeatureCard icon="🔥" title="VAGAS LIMITADAS" text="O lote secreto tem poucas unidades e preço promocional." isWide={isWide} />
            <FeatureCard icon="18+" title="EVENTO 18+" text="Documento obrigatório na entrada." isWide={isWide} />
          </View>

          <SectionTitle title="COMO FUNCIONA" />

          <View style={[styles.stepsGrid, isWide && styles.stepsGridWide]}>
            <StepCard number="1" icon="🎟️" title="ESCOLHA SEU LOTE" text="Garanta o lote secreto antes da virada." isWide={isWide} />
            <StepCard number="2" icon="👤" title="PREENCHA SEUS DADOS" text="Informe nome, WhatsApp e e-mail." isWide={isWide} />
            <StepCard number="3" icon="💸" title="FAÇA O PAGAMENTO" text="Finalize pelo pagamento configurado ou WhatsApp." isWide={isWide} />
            <StepCard number="4" icon="✅" title="RECEBA A CONFIRMAÇÃO" text="Seu ingresso será confirmado após pagamento aprovado." isWide={isWide} />
          </View>

          <View style={[styles.formSection, isWide && styles.formSectionWide]}>
            <View style={[styles.formImageBox, isWide && styles.formImageBoxWide]}>
              <Text style={styles.formImageSmall}>PRIMEIRA ABERTURA</Text>
              <Text style={styles.formImageTitle}>BONDE 62</Text>
              <Text style={styles.formImageText}>
                Garanta antes da virada. O preço não volta.
              </Text>

              <View style={styles.formMiniTimer}>
                <Text style={styles.formMiniTimerLabel}>Promo termina em</Text>
                <Text style={styles.formMiniTimerValue}>{formatarTempo(tempo)}</Text>
              </View>
            </View>

            <View style={[styles.formBox, isWide && styles.formBoxWide]}>
              <Text style={styles.formTitle}>GARANTA SEU INGRESSO</Text>
              <Text style={styles.formSubtitle}>
                Lote secreto limitado. Depois da virada, o valor sobe.
              </Text>

              <View style={[styles.inputRow, isWide && styles.inputRowWide]}>
                <TextInput
                  style={[styles.input, isWide && styles.inputHalf]}
                  placeholder="Seu nome completo"
                  placeholderTextColor="#777"
                  value={nome}
                  onChangeText={setNome}
                />

                <TextInput
                  style={[styles.input, isWide && styles.inputHalf]}
                  placeholder="WhatsApp com DDD"
                  placeholderTextColor="#777"
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                  keyboardType="phone-pad"
                />
              </View>

              <TextInput
                style={styles.input}
                placeholder="Seu e-mail"
                placeholderTextColor="#777"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />

              <View style={[styles.inputRow, isWide && styles.inputRowWide]}>
                <TextInput
                  style={[styles.input, isWide && styles.inputHalf]}
                  placeholder="Quantidade"
                  placeholderTextColor="#777"
                  value={quantidade}
                  onChangeText={setQuantidade}
                  keyboardType="numeric"
                />

                <View style={[styles.totalBox, isWide && styles.inputHalf]}>
                  <Text style={styles.totalLabel}>TOTAL NO LOTE SECRETO</Text>
                  <Text style={styles.totalValue}>{formatarMoeda(total)}</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.buyButton} onPress={comprarIngresso}>
                <Text style={styles.buyButtonText}>
                  {comprando ? "GERANDO PAGAMENTO..." : "🔒 COMPRAR AGORA"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.formWarning}>
                Seu ingresso só será confirmado após pagamento aprovado.
              </Text>
            </View>
          </View>

          <View style={[styles.trustGrid, isWide && styles.trustGridWide]}>
            <TrustItem icon="18+" title="EVENTO 18+" text="Somente para maiores de 18 anos." isWide={isWide} />
            <TrustItem icon="📄" title="DOCUMENTO" text="Documento com foto obrigatório na entrada." isWide={isWide} />
            <TrustItem icon="🎟️" title="CONFIRMAÇÃO" text="Ingresso confirmado após pagamento aprovado." isWide={isWide} />
            <TrustItem icon="💰" title="REEMBOLSO" text="Se a meta mínima não for atingida, o valor será reembolsado." isWide={isWide} />
          </View>

          <View style={styles.finalCta}>
            <View>
              <Text style={styles.finalSmall}>NÃO DEIXE PARA A VIRADA</Text>
              <Text style={styles.finalTitle}>
                GARANTA SEU INGRESSO{"\n"}
                <Text style={styles.finalPink}>ANTES DO PREÇO SUBIR</Text>
              </Text>
            </View>

            <TouchableOpacity style={styles.finalButton} onPress={comprarIngresso}>
              <Text style={styles.finalButtonText}>
                {comprando ? "GERANDO PAGAMENTO..." : "GARANTIR MEU LUGAR AGORA →"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerLogo}>
              BONDE <Text style={styles.logoPink}>62</Text>
            </Text>
            <Text style={styles.footerText}>
              Goiânia - GO • Evento 18+ • Documento obrigatório na entrada.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.toast}>
        <Text style={styles.toastTitle}>🔥 Movimento no lote</Text>
        <Text style={styles.toastText}>{toast}</Text>
      </View>

      <Modal visible={modalAberto} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalKicker}>OFERTA RELÂMPAGO</Text>
            <Text style={styles.modalTitle}>Lote Secreto liberado</Text>
            <Text style={styles.modalText}>
              Os primeiros ingressos do Bonde 62 estão com preço promocional.
              Depois que o tempo acabar, o valor pode subir.
            </Text>

            <View style={styles.modalTimerBox}>
              <Text style={styles.modalTimerLabel}>PROMOÇÃO ACABA EM</Text>
              <Text style={styles.modalTimer}>{formatarTempo(tempo)}</Text>
            </View>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setModalAberto(false)}
            >
              <Text style={styles.modalButtonText}>VER LOTE SECRETO</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalAberto(false)}>
              <Text style={styles.modalClose}>continuar vendo o site</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badgeChip}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <View style={styles.titleLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.titleLine} />
    </View>
  );
}

function LotCard({
  lote,
  valor,
  linhas,
}: {
  lote: string;
  valor: string;
  linhas: string[];
}) {
  return (
    <View style={styles.lotCard}>
      <Text style={styles.lotName}>{lote}</Text>
      <Text style={styles.lotPrice}>{valor}</Text>
      {linhas.map((linha) => (
        <Text key={linha} style={styles.lotBullet}>• {linha}</Text>
      ))}
    </View>
  );
}

function FeatureCard({
  icon,
  title,
  text,
  isWide,
}: {
  icon: string;
  title: string;
  text: string;
  isWide: boolean;
}) {
  return (
    <View style={[styles.featureCard, isWide && styles.featureCardWide]}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function StepCard({
  number,
  icon,
  title,
  text,
  isWide,
}: {
  number: string;
  icon: string;
  title: string;
  text: string;
  isWide: boolean;
}) {
  return (
    <View style={[styles.stepCard, isWide && styles.stepCardWide]}>
      <View style={styles.stepTop}>
        <Text style={styles.stepNumber}>{number}</Text>
        <Text style={styles.stepIcon}>{icon}</Text>
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function TrustItem({
  icon,
  title,
  text,
  isWide,
}: {
  icon: string;
  title: string;
  text: string;
  isWide: boolean;
}) {
  return (
    <View style={[styles.trustItem, isWide && styles.trustItemWide]}>
      <Text style={styles.trustIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.trustTitle}>{title}</Text>
        <Text style={styles.trustText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#050008",
  },
  pageContent: {
    paddingBottom: 40,
  },
  topUrgencyBar: {
    backgroundColor: "#ff1684",
    paddingVertical: 11,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  topUrgencyText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
  },
  topTimer: {
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: "900",
  },
  inner: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 24,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#07000c",
    paddingBottom: 36,
  },
  glowPink: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: "rgba(255, 0, 120, 0.24)",
    right: -160,
    top: -120,
  },
  glowPurple: {
    position: "absolute",
    width: 480,
    height: 480,
    borderRadius: 240,
    backgroundColor: "rgba(118, 0, 255, 0.22)",
    left: -160,
    bottom: -160,
  },
  navbar: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 1,
  },
  logoPink: {
    color: "#ff1684",
  },
  logoSub: {
    color: "#ff1684",
    fontWeight: "900",
    letterSpacing: 5,
    fontSize: 12,
    marginTop: -2,
  },
  navLinks: {
    flexDirection: "row",
    gap: 26,
    alignItems: "center",
  },
  navText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    opacity: 0.9,
  },
  navButton: {
    backgroundColor: "#ff1684",
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
  navButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
  heroGrid: {
    gap: 26,
    paddingTop: 28,
  },
  heroGridWide: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroTextBox: {
    width: "100%",
  },
  heroTextBoxWide: {
    width: "54%",
  },
  kicker: {
    color: "#ff1684",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 10,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 50,
    lineHeight: 55,
    fontWeight: "900",
    letterSpacing: -2,
  },
  heroTitlePink: {
    color: "#ff1684",
  },
  heroSubtitle: {
    color: "#f0eaf5",
    marginTop: 20,
    fontSize: 17,
    lineHeight: 27,
    maxWidth: 720,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },
  badgeChip: {
    borderColor: "#ff1684",
    borderWidth: 1,
    backgroundColor: "rgba(255,22,132,0.08)",
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 30,
  },
  badgeText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
  urgencyCard: {
    marginTop: 24,
    backgroundColor: "rgba(255,22,132,0.08)",
    borderColor: "rgba(255,22,132,0.35)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
  urgencyTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
  urgencyText: {
    color: "#d7ccdf",
    marginTop: 8,
    lineHeight: 22,
  },
  timerBox: {
    marginTop: 14,
    backgroundColor: "#ff1684",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  timerLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
  timerValue: {
    color: "#fff",
    fontSize: 38,
    fontWeight: "900",
    marginTop: 4,
  },
  heroButtons: {
    gap: 12,
    marginTop: 28,
  },
  heroButtonsWide: {
    flexDirection: "row",
  },
  mainButton: {
    backgroundColor: "#ff1684",
    paddingVertical: 17,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 260,
  },
  mainButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  whatsButton: {
    borderColor: "#ff1684",
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingVertical: 17,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 260,
  },
  whatsButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  heroVisual: {
    minHeight: 310,
    borderRadius: 28,
    borderColor: "rgba(255,22,132,0.45)",
    borderWidth: 1,
    backgroundColor: "#120018",
    padding: 24,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  heroVisualWide: {
    width: "46%",
    minHeight: 430,
  },
  stageLight1: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 120,
    backgroundColor: "rgba(255,22,132,0.30)",
    top: -40,
    right: -40,
  },
  stageLight2: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 140,
    backgroundColor: "rgba(128,0,255,0.22)",
    bottom: 40,
    left: -70,
  },
  stageLight3: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: 120,
    left: 110,
  },
  heroVisualSmall: {
    color: "#ff1684",
    fontWeight: "900",
    letterSpacing: 3,
    fontSize: 12,
  },
  heroVisualTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 42,
    marginTop: 8,
  },
  heroVisualText: {
    color: "#e8dff0",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  djCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 24,
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 15,
    borderRadius: 18,
  },
  djIcon: {
    fontSize: 32,
  },
  djTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
  djText: {
    color: "#cfc5d6",
    marginTop: 3,
  },
  secretPanel: {
    marginTop: 28,
    borderRadius: 24,
    borderColor: "rgba(255,22,132,0.35)",
    borderWidth: 1,
    backgroundColor: "#0d0014",
    padding: 22,
  },
  secretGrid: {
    gap: 18,
  },
  secretGridWide: {
    flexDirection: "row",
  },
  secretMain: {
    width: "100%",
  },
  secretMainWide: {
    width: "38%",
  },
  sectionKicker: {
    color: "#ff1684",
    fontWeight: "900",
    fontSize: 14,
  },
  secretTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 8,
  },
  secretDesc: {
    color: "#cfc5d6",
    marginTop: 8,
    lineHeight: 22,
  },
  priceBox: {
    marginTop: 18,
    borderColor: "#ff1684",
    borderWidth: 2,
    borderRadius: 22,
    padding: 22,
    backgroundColor: "rgba(255,22,132,0.08)",
    alignItems: "center",
  },
  priceSmall: {
    color: "#ff1684",
    fontWeight: "900",
    letterSpacing: 2,
  },
  price: {
    color: "#fff",
    fontSize: 52,
    fontWeight: "900",
    marginTop: 8,
  },
  priceTag: {
    color: "#fff",
    fontWeight: "900",
    borderColor: "#ff1684",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginTop: 10,
    fontSize: 12,
  },
  priceText: {
    color: "#dcd2e5",
    textAlign: "center",
    marginTop: 14,
    lineHeight: 21,
  },
  lotsGrid: {
    gap: 12,
  },
  lotsGridWide: {
    flexDirection: "row",
    flex: 1,
  },
  lotCard: {
    flex: 1,
    minHeight: 170,
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    backgroundColor: "#16051f",
    borderRadius: 18,
    padding: 18,
    justifyContent: "center",
  },
  lotName: {
    color: "#ff1684",
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 8,
  },
  lotPrice: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 30,
    marginBottom: 10,
  },
  lotBullet: {
    color: "#d4cbdc",
    fontSize: 13,
    marginTop: 5,
  },
  microcopyBox: {
    marginTop: 20,
    borderTopColor: "rgba(255,255,255,0.08)",
    borderTopWidth: 1,
    paddingTop: 16,
  },
  microcopyText: {
    color: "#ff1684",
    textAlign: "center",
    fontWeight: "900",
  },
  sectionTitleWrap: {
    marginTop: 42,
    marginBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  titleLine: {
    width: 70,
    height: 2,
    backgroundColor: "#ff1684",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 1,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  featuresGridWide: {
    justifyContent: "space-between",
  },
  featureCard: {
    width: "47%",
    borderColor: "rgba(255,22,132,0.28)",
    borderWidth: 1,
    backgroundColor: "#0f0017",
    borderRadius: 18,
    padding: 16,
    minHeight: 175,
    alignItems: "center",
  },
  featureCardWide: {
    width: "15.5%",
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  featureTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
    textAlign: "center",
    minHeight: 34,
  },
  featureText: {
    color: "#c9c0d1",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  stepsGrid: {
    gap: 14,
  },
  stepsGridWide: {
    flexDirection: "row",
  },
  stepCard: {
    borderColor: "rgba(255,22,132,0.35)",
    borderWidth: 1,
    backgroundColor: "#100018",
    borderRadius: 18,
    padding: 18,
  },
  stepCardWide: {
    width: "24%",
  },
  stepTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  stepNumber: {
    color: "#fff",
    backgroundColor: "#ff1684",
    width: 34,
    height: 34,
    borderRadius: 17,
    textAlign: "center",
    lineHeight: 34,
    fontWeight: "900",
  },
  stepIcon: {
    fontSize: 30,
  },
  stepTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
  stepText: {
    color: "#c9c0d1",
    marginTop: 8,
    lineHeight: 20,
  },
  formSection: {
    marginTop: 34,
    borderColor: "rgba(255,22,132,0.35)",
    borderWidth: 1,
    backgroundColor: "#0e0015",
    borderRadius: 24,
    overflow: "hidden",
  },
  formSectionWide: {
    flexDirection: "row",
  },
  formImageBox: {
    minHeight: 240,
    padding: 24,
    backgroundColor: "#190022",
    justifyContent: "flex-end",
  },
  formImageBoxWide: {
    width: "38%",
  },
  formImageSmall: {
    color: "#ff1684",
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: 12,
  },
  formImageTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 44,
    marginTop: 8,
  },
  formImageText: {
    color: "#d7ccdf",
    marginTop: 6,
    fontSize: 16,
  },
  formMiniTimer: {
    marginTop: 20,
    backgroundColor: "#ff1684",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  formMiniTimerLabel: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 2,
  },
  formMiniTimerValue: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 30,
    marginTop: 4,
  },
  formBox: {
    padding: 22,
  },
  formBoxWide: {
    width: "62%",
  },
  formTitle: {
    color: "#ff1684",
    fontSize: 22,
    fontWeight: "900",
  },
  formSubtitle: {
    color: "#cfc5d6",
    marginTop: 6,
    marginBottom: 14,
  },
  inputRow: {
    gap: 12,
  },
  inputRowWide: {
    flexDirection: "row",
  },
  input: {
    width: "100%",
    backgroundColor: "#180520",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 12,
    color: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 15,
    marginTop: 12,
    fontSize: 14,
  },
  inputHalf: {
    flex: 1,
  },
  totalBox: {
    backgroundColor: "#180520",
    borderColor: "#ff1684",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    justifyContent: "center",
  },
  totalLabel: {
    color: "#bbaec7",
    fontSize: 11,
    fontWeight: "900",
  },
  totalValue: {
    color: "#ff1684",
    fontWeight: "900",
    fontSize: 20,
    marginTop: 3,
  },
  buyButton: {
    backgroundColor: "#ff1684",
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 18,
  },
  buyButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },
  formWarning: {
    color: "#bfaec9",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
  trustGrid: {
    gap: 12,
    marginTop: 24,
  },
  trustGridWide: {
    flexDirection: "row",
  },
  trustItem: {
    flexDirection: "row",
    gap: 12,
    borderColor: "rgba(255,22,132,0.24)",
    borderWidth: 1,
    backgroundColor: "#100018",
    borderRadius: 16,
    padding: 16,
  },
  trustItemWide: {
    width: "24%",
  },
  trustIcon: {
    color: "#ff1684",
    fontSize: 28,
    fontWeight: "900",
  },
  trustTitle: {
    color: "#ff1684",
    fontWeight: "900",
    fontSize: 13,
  },
  trustText: {
    color: "#cfc5d6",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  finalCta: {
    marginTop: 32,
    borderRadius: 24,
    backgroundColor: "#17001f",
    borderColor: "rgba(255,22,132,0.35)",
    borderWidth: 1,
    padding: 24,
    gap: 18,
  },
  finalSmall: {
    color: "#ff1684",
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: 12,
  },
  finalTitle: {
    color: "#fff",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
    marginTop: 8,
  },
  finalPink: {
    color: "#ff1684",
  },
  finalButton: {
    backgroundColor: "#ff1684",
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: "center",
  },
  finalButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  footer: {
    marginTop: 28,
    paddingVertical: 26,
    borderTopColor: "rgba(255,255,255,0.08)",
    borderTopWidth: 1,
    alignItems: "center",
  },
  footerLogo: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
  },
  footerText: {
    color: "#9e93aa",
    marginTop: 8,
    textAlign: "center",
  },
  toast: {
    position: "fixed" as any,
    right: 24,
    bottom: 24,
    maxWidth: 340,
    backgroundColor: "#120018",
    borderColor: "#ff1684",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#ff1684",
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  toastTitle: {
    color: "#ff1684",
    fontWeight: "900",
    marginBottom: 4,
  },
  toastText: {
    color: "#fff",
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#120018",
    borderColor: "#ff1684",
    borderWidth: 1,
    borderRadius: 26,
    padding: 26,
    alignItems: "center",
  },
  modalKicker: {
    color: "#ff1684",
    fontWeight: "900",
    letterSpacing: 3,
    fontSize: 12,
  },
  modalTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 32,
    marginTop: 10,
    textAlign: "center",
  },
  modalText: {
    color: "#d7ccdf",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 12,
  },
  modalTimerBox: {
    backgroundColor: "#ff1684",
    borderRadius: 18,
    padding: 18,
    marginTop: 20,
    width: "100%",
    alignItems: "center",
  },
  modalTimerLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
  modalTimer: {
    color: "#fff",
    fontSize: 46,
    fontWeight: "900",
    marginTop: 4,
  },
  modalButton: {
    backgroundColor: "#ff1684",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
    width: "100%",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  modalClose: {
    color: "#bfaec9",
    marginTop: 14,
    textDecorationLine: "underline",
  },
});
