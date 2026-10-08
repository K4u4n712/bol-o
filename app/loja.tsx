import { router } from "expo-router";
import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

const principal = require("../assets/images/loja/aspirador-principal.png");
const beneficios = require("../assets/images/loja/aspirador-beneficios.png");
const carro = require("../assets/images/loja/aspirador-carro.png");
const teclado = require("../assets/images/loja/aspirador-teclado.png");
const sofa = require("../assets/images/loja/aspirador-sofa.png");
const soprador = require("../assets/images/loja/aspirador-soprador.png");

const fotosProduto = [
  { source: principal, label: "Produto" }, { source: carro, label: "Carro" },
  { source: teclado, label: "Teclado" }, { source: sofa, label: "Sofá" },
  { source: soprador, label: "Aspira e sopra" }, { source: beneficios, label: "Benefícios" },
];

export default function Loja() {
  const { width } = useWindowDimensions();
  const mobile = width < 800;

  const [faqAberto, setFaqAberto] = useState<number | null>(null);
  const [fotoAtual, setFotoAtual] = useState(0);
  const [zoomImagem, setZoomImagem] = useState<string | null>(null);
  const fotoAnterior = () => setFotoAtual((i) => i === 0 ? fotosProduto.length - 1 : i - 1);
  const proximaFoto = () => setFotoAtual((i) => i === fotosProduto.length - 1 ? 0 : i + 1);
  const alternarZoom = (id: string) => setZoomImagem((atual) => atual === id ? null : id);

  const comprar = () => {
    router.push("/checkout-loja");
  };

  const perguntas = [
    {
      pergunta: "O AirClean funciona sem fio?",
      resposta:
        "Sim. O modelo AS-228 é portátil e recarregável, permitindo pequenas limpezas sem permanecer conectado a um cabo.",
    },
    {
      pergunta: "Posso usar no carro?",
      resposta:
        "Sim. O formato compacto facilita a limpeza de bancos, console, porta-objetos e pequenas frestas do veículo.",
    },
    {
      pergunta: "Ele aspira e também sopra?",
      resposta:
        "O modelo possui funções de aspiração e sopro, permitindo diferentes formas de uso conforme o acessório utilizado.",
    },
    {
      pergunta: "Ele é indicado para teclado e computador?",
      resposta:
        "O formato compacto e os acessórios permitem alcançar pequenos espaços. Em equipamentos eletrônicos, desligue o aparelho antes da limpeza e siga os cuidados recomendados pelo fabricante.",
    },
    {
      pergunta: "Como acompanho meu pedido?",
      resposta:
        "Após o envio, as informações de rastreamento do pedido serão disponibilizadas ao cliente.",
    },
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        {/* BARRA SUPERIOR */}
        <View style={styles.topBar}>
          <Text style={styles.topBarText}>
            🚚 ENVIO PARA TODO O BRASIL
          </Text>
        </View>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerInner}>
            <View>
              <Text style={styles.logo}>
                Air<Text style={styles.logoAccent}>Clean</Text>
              </Text>
              <Text style={styles.logoSub}>
                LIMPEZA SEM COMPLICAÇÃO
              </Text>
            </View>

            {!mobile && (
              <View style={styles.headerSecurity}>
                <Text style={styles.headerSecurityIcon}>🔒</Text>

                <View>
                  <Text style={styles.headerSecurityTitle}>
                    Compra protegida
                  </Text>
                  <Text style={styles.headerSecuritySub}>
                    Ambiente seguro
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* HERO */}
        <View
          style={[
            styles.hero,
            mobile && styles.heroMobile,
          ]}
        >
          <View
            style={[
              styles.heroPhotoColumn,
              mobile && styles.fullWidth,
            ]}
          >
            <View style={styles.mainPhoto}>
              <View style={styles.photoBadge}><Text style={styles.photoBadgeText}>3 EM 1</Text></View>
              <Image source={fotosProduto[fotoAtual].source} style={styles.mainImage} resizeMode="cover" />
              <Pressable onPress={fotoAnterior} style={[styles.galleryArrow, styles.galleryArrowLeft]}><Text style={styles.galleryArrowText}>‹</Text></Pressable>
              <Pressable onPress={proximaFoto} style={[styles.galleryArrow, styles.galleryArrowRight]}><Text style={styles.galleryArrowText}>›</Text></Pressable>
              <View style={styles.galleryCounter}><Text style={styles.galleryCounterText}>{fotoAtual + 1} / {fotosProduto.length}</Text></View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
              {fotosProduto.map((foto, index) => (
                <Pressable key={foto.label} onPress={() => setFotoAtual(index)} style={[styles.thumbnail, fotoAtual === index && styles.thumbnailActive]}>
                  <Image source={foto.source} style={styles.thumbnailImage} resizeMode="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View
            style={[
              styles.heroContent,
              mobile && styles.fullWidth,
            ]}
          >
            <View style={styles.launchBadge}>
              <Text style={styles.launchBadgeText}>
                🔥 OFERTA DE LANÇAMENTO
              </Text>
            </View>

            <Text
              style={[
                styles.heroTitle,
                mobile && styles.heroTitleMobile,
              ]}
            >
              A limpeza rápida que cabe na sua mão.
            </Text>

            <Text style={styles.heroDescription}>
              Aspire poeira, migalhas e pequenas sujeiras do carro,
              teclado, sofá e cantos difíceis sem precisar carregar um
              aspirador grande pela casa.
            </Text>

            <View style={styles.chips}>
              <Text style={styles.chip}>✓ Sem fio</Text>
              <Text style={styles.chip}>✓ Recarregável</Text>
              <Text style={styles.chip}>✓ Aspira</Text>
              <Text style={styles.chip}>✓ Sopra</Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.productName}>
              Mini Aspirador AirClean 3 em 1
            </Text>

            <Text style={styles.model}>
              Modelo AS-228
            </Text>

            <View style={styles.priceBlock}>
              <Text style={styles.priceLabel}>
                OFERTA ESPECIAL
              </Text>

              <View style={styles.priceLine}>
                <Text style={styles.price}>R$ 69,90</Text>

                <View style={styles.offerSmall}>
                  <Text style={styles.offerSmallText}>
                    OFERTA
                  </Text>
                </View>
              </View>

              <Text style={styles.paymentText}>
                Pagamento via Pix
              </Text>
            </View>

            <Pressable
              onPress={comprar}
              style={({ pressed }) => [
                styles.buyButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buyButtonText}>
                QUERO GARANTIR O MEU
              </Text>

              <Text style={styles.buyButtonSub}>
                Continuar para compra
              </Text>
            </Pressable>

            <View style={styles.trustRow}>
              <View style={styles.trustItem}>
                <Text style={styles.trustIcon}>🔒</Text>
                <Text style={styles.trustText}>
                  Pagamento seguro
                </Text>
              </View>

              <View style={styles.trustItem}>
                <Text style={styles.trustIcon}>📦</Text>
                <Text style={styles.trustText}>
                  Pedido rastreável
                </Text>
              </View>

              <View style={styles.trustItem}>
                <Text style={styles.trustIcon}>🇧🇷</Text>
                <Text style={styles.trustText}>
                  Envio nacional
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* PROBLEMA / SOLUÇÃO */}
        <View style={styles.problemSection}>
          <View style={styles.sectionCenter}>
            <Text style={styles.eyebrow}>
              LIMPEZA SEM COMPLICAÇÃO
            </Text>

            <Text
              style={[
                styles.sectionBigTitle,
                mobile && styles.sectionBigTitleMobile,
              ]}
            >
              Pequeno para guardar. Prático para usar.
            </Text>

            <Text style={styles.sectionLead}>
              Para aquelas sujeiras que não justificam tirar o aspirador
              grande do armário.
            </Text>
          </View>

          <View
            style={[
              styles.useGrid,
              mobile && styles.column,
            ]}
          >
            <View
              style={[
                styles.useCard,
                mobile && styles.fullWidth,
              ]}
            >
              <Pressable onPress={() => alternarZoom("carro")} style={styles.zoomImageBox}>
                <Image source={carro} style={[styles.useImage, zoomImagem === "carro" && styles.imageMiniZoom]} resizeMode="cover" />
                <View style={styles.zoomHint}><Text style={styles.zoomHintText}>⌕</Text></View>
              </Pressable>

              <View style={styles.useContent}>
                <Text style={styles.useNumber}>01</Text>
                <Text style={styles.useTitle}>
                  Limpeza do carro
                </Text>
                <Text style={styles.useDescription}>
                  Ideal para pequenas sujeiras em bancos, console,
                  porta-objetos e frestas.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.useCard,
                mobile && styles.fullWidth,
              ]}
            >
              <Pressable onPress={() => alternarZoom("teclado")} style={styles.zoomImageBox}>
                <Image source={teclado} style={[styles.useImage, zoomImagem === "teclado" && styles.imageMiniZoom]} resizeMode="cover" />
                <View style={styles.zoomHint}><Text style={styles.zoomHintText}>⌕</Text></View>
              </Pressable>

              <View style={styles.useContent}>
                <Text style={styles.useNumber}>02</Text>
                <Text style={styles.useTitle}>
                  Mesa e teclado
                </Text>
                <Text style={styles.useDescription}>
                  Ajuda a alcançar espaços pequenos e remover resíduos
                  do ambiente de trabalho.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.useCard,
                mobile && styles.fullWidth,
              ]}
            >
              <Pressable onPress={() => alternarZoom("sofa")} style={styles.zoomImageBox}>
                <Image source={sofa} style={[styles.useImage, zoomImagem === "sofa" && styles.imageMiniZoom]} resizeMode="cover" />
                <View style={styles.zoomHint}><Text style={styles.zoomHintText}>⌕</Text></View>
              </Pressable>

              <View style={styles.useContent}>
                <Text style={styles.useNumber}>03</Text>
                <Text style={styles.useTitle}>
                  Sofá e casa
                </Text>
                <Text style={styles.useDescription}>
                  Prático para migalhas e pequenas sujeiras do cotidiano.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* BENEFÍCIOS */}
        <View style={styles.visualSection}>
          <View style={styles.visualInner}>
            <Text style={styles.lightEyebrow}>
              CONHEÇA O AIRCLEAN
            </Text>

            <Text
              style={[
                styles.visualTitle,
                mobile && styles.sectionBigTitleMobile,
              ]}
            >
              Feito para acompanhar sua rotina.
            </Text>

            <Text style={styles.visualDescription}>
              Compacto, portátil e com acessórios para diferentes
              situações de limpeza.
            </Text>

            <Pressable onPress={() => alternarZoom("beneficios")} style={styles.benefitImageContainer}>
              <Image source={beneficios} style={[styles.benefitImage, zoomImagem === "beneficios" && styles.imageMiniZoom]} resizeMode="cover" />
              <View style={styles.zoomHint}><Text style={styles.zoomHintText}>⌕</Text></View>
            </Pressable>
          </View>
        </View>

        {/* ASPIRA / SOPRA */}
        <View
          style={[
            styles.featureSection,
            mobile && styles.column,
          ]}
        >
          <View
            style={[
              styles.featureImageContainer,
              mobile && styles.fullWidth,
            ]}
          >
            <Pressable onPress={() => alternarZoom("soprador")} style={styles.featureImagePressable}>
              <Image source={soprador} style={[styles.featureImage, zoomImagem === "soprador" && styles.imageMiniZoom]} resizeMode="cover" />
              <View style={styles.zoomHint}><Text style={styles.zoomHintText}>⌕</Text></View>
            </Pressable>
          </View>

          <View
            style={[
              styles.featureContent,
              mobile && styles.fullWidth,
            ]}
          >
            <Text style={styles.eyebrow}>
              MAIS VERSATILIDADE
            </Text>

            <Text
              style={[
                styles.featureTitle,
                mobile && styles.sectionBigTitleMobile,
              ]}
            >
              Aspire. Sopre. Alcance.
            </Text>

            <Text style={styles.featureDescription}>
              Diferentes funções e acessórios ajudam a adaptar o
              aparelho à limpeza que você precisa fazer.
            </Text>

            <View style={styles.featureList}>
              <View style={styles.featureListItem}>
                <View style={styles.checkCircle}>
                  <Text style={styles.check}>✓</Text>
                </View>

                <View style={styles.featureListContent}>
                  <Text style={styles.featureListTitle}>
                    Função de aspiração
                  </Text>
                  <Text style={styles.featureListText}>
                    Para migalhas, poeira e pequenas sujeiras.
                  </Text>
                </View>
              </View>

              <View style={styles.featureListItem}>
                <View style={styles.checkCircle}>
                  <Text style={styles.check}>✓</Text>
                </View>

                <View style={styles.featureListContent}>
                  <Text style={styles.featureListTitle}>
                    Função soprador
                  </Text>
                  <Text style={styles.featureListText}>
                    Auxilia na remoção de poeira de áreas estreitas.
                  </Text>
                </View>
              </View>

              <View style={styles.featureListItem}>
                <View style={styles.checkCircle}>
                  <Text style={styles.check}>✓</Text>
                </View>

                <View style={styles.featureListContent}>
                  <Text style={styles.featureListTitle}>
                    Formato portátil
                  </Text>
                  <Text style={styles.featureListText}>
                    Fácil de transportar e guardar.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* DESTAQUE */}
        <View style={styles.statement}>
          <Text style={styles.statementSmall}>
            MENOS TRABALHO PARA AS PEQUENAS SUJEIRAS
          </Text>

          <Text
            style={[
              styles.statementTitle,
              mobile && styles.statementTitleMobile,
            ]}
          >
            Pegou. Limpou. Guardou.
          </Text>

          <Text style={styles.statementText}>
            Uma solução compacta para deixar sempre por perto.
          </Text>
        </View>

        {/* PROVA SOCIAL HONESTA */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.eyebrow}>
              EXPERIÊNCIA DOS CLIENTES
            </Text>

            <Text
              style={[
                styles.reviewsTitle,
                mobile && styles.sectionBigTitleMobile,
              ]}
            >
              Avaliações verificadas
            </Text>

            <Text style={styles.reviewsDescription}>
              Esta área será preenchida com avaliações de compradores
              reais conforme os primeiros pedidos forem entregues.
            </Text>
          </View>

          <View style={styles.emptyReviews}>
            <View style={styles.emptyReviewIcon}>
              <Text style={styles.emptyReviewIconText}>★</Text>
            </View>

            <Text style={styles.emptyReviewTitle}>
              Estamos começando.
            </Text>

            <Text style={styles.emptyReviewText}>
              Preferimos mostrar experiências reais em vez de publicar
              depoimentos inventados. As avaliações verificadas aparecerão
              aqui.
            </Text>
          </View>
        </View>

        {/* OFERTA FINAL */}
        <View style={styles.finalOffer}>
          <View style={styles.finalOfferInner}>
            <Text style={styles.finalEyebrow}>
              AIRCLEAN 3 EM 1
            </Text>

            <Text
              style={[
                styles.finalTitle,
                mobile && styles.finalTitleMobile,
              ]}
            >
              Limpeza rápida quando você precisar.
            </Text>

            <Text style={styles.finalDescription}>
              Para carro, casa, sofá, mesa, teclado e pequenas
              limpezas do cotidiano.
            </Text>

            <Text style={styles.finalPriceLabel}>
              OFERTA ESPECIAL
            </Text>

            <Text style={styles.finalPrice}>
              R$ 69,90
            </Text>

            <Text style={styles.finalPayment}>
              Pagamento via Pix
            </Text>

            <Pressable
              onPress={comprar}
              style={({ pressed }) => [
                styles.finalButton,
                pressed && styles.finalButtonPressed,
              ]}
            >
              <Text style={styles.finalButtonText}>
                QUERO O MEU AIRCLEAN
              </Text>
            </Pressable>

            <View style={styles.finalTrust}>
              <Text style={styles.finalTrustText}>
                🔒 Pagamento seguro
              </Text>

              <Text style={styles.finalTrustDot}>•</Text>

              <Text style={styles.finalTrustText}>
                📦 Pedido rastreável
              </Text>
            </View>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.faq}>
          <Text style={styles.eyebrow}>
            TIRE SUAS DÚVIDAS
          </Text>

          <Text
            style={[
              styles.faqTitle,
              mobile && styles.sectionBigTitleMobile,
            ]}
          >
            Perguntas frequentes
          </Text>

          <View style={styles.faqList}>
            {perguntas.map((item, index) => {
              const aberto = faqAberto === index;

              return (
                <Pressable
                  key={index}
                  onPress={() =>
                    setFaqAberto(aberto ? null : index)
                  }
                  style={styles.faqItem}
                >
                  <View style={styles.faqQuestionRow}>
                    <Text style={styles.faqQuestion}>
                      {item.pergunta}
                    </Text>

                    <Text style={styles.faqPlus}>
                      {aberto ? "−" : "+"}
                    </Text>
                  </View>

                  {aberto && (
                    <Text style={styles.faqAnswer}>
                      {item.resposta}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>
            Air<Text style={styles.logoAccent}>Clean</Text>
          </Text>

          <Text style={styles.footerDescription}>
            Limpeza prática para o dia a dia.
          </Text>

          <View style={styles.footerDivider} />

          <Text style={styles.footerLegal}>
            © 2026 AirClean. Todos os direitos reservados.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },

  page: {
    flex: 1,
    backgroundColor: "#fff",
  },

  pageContent: {
    flexGrow: 1,
  },

  column: {
    flexDirection: "column",
  },

  fullWidth: {
    width: "100%",
    flexBasis: "auto",
  },

  topBar: {
    backgroundColor: "#0b0b0b",
    minHeight: 39,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  topBarText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },

  headerInner: {
    width: "100%",
    maxWidth: 1180,
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

  logoAccent: {
    color: "#2787d9",
  },

  logoSub: {
    color: "#999",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 2,
  },

  headerSecurity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  headerSecurityIcon: {
    fontSize: 18,
  },

  headerSecurityTitle: {
    color: "#222",
    fontSize: 11,
    fontWeight: "800",
  },

  headerSecuritySub: {
    color: "#999",
    fontSize: 9,
    marginTop: 1,
  },

  hero: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 48,
    paddingBottom: 65,
    flexDirection: "row",
    alignItems: "center",
    gap: 48,
  },

  heroMobile: {
    flexDirection: "column",
    paddingTop: 25,
    gap: 30,
  },

  heroPhotoColumn: {
    flex: 1.08,
    minWidth: 0,
  },

  mainPhoto: {
    width: "100%",
    aspectRatio: 1.16,
    backgroundColor: "#f7f8fa",
    borderRadius: 26,
    overflow: "hidden",
    position: "relative",
  },

  mainImage: {
    width: "100%",
    height: "100%",
  },

  photoBadge: {
    position: "absolute",
    zIndex: 2,
    left: 18,
    top: 18,
    backgroundColor: "#111",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 100,
  },

  photoBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  thumbnailRow: { flexDirection: "row", gap: 10, marginTop: 10, paddingRight: 2 },

  thumbnail: {
    width: 92, height: 64,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: "#eee", borderWidth: 2, borderColor: "transparent",
  },
  thumbnailActive: { borderColor: "#2787d9" },

  thumbnailImage: {
    width: "100%",
    height: "100%",
  },

  galleryArrow: { position: "absolute", top: "50%", marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.68)", alignItems: "center", justifyContent: "center", zIndex: 3 },
  galleryArrowLeft: { left: 12 },
  galleryArrowRight: { right: 12 },
  galleryArrowText: { color: "#fff", fontSize: 32, lineHeight: 34 },
  galleryCounter: { position: "absolute", right: 14, bottom: 14, backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  galleryCounterText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  zoomImageBox: { width: "100%", overflow: "hidden", position: "relative" },
  featureImagePressable: { width: "100%", height: "100%", overflow: "hidden", position: "relative" },
  imageMiniZoom: { transform: [{ scale: 1.12 }] },
  zoomHint: { position: "absolute", right: 12, bottom: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center" },
  zoomHintText: { color: "#fff", fontSize: 20, fontWeight: "800" },

  heroContent: {
    flex: 0.92,
    minWidth: 0,
  },

  launchBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fff4e8",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 100,
  },

  launchBadgeText: {
    color: "#9a4a00",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  heroTitle: {
    color: "#101010",
    fontSize: 47,
    lineHeight: 51,
    fontWeight: "900",
    letterSpacing: -2,
    marginTop: 20,
    maxWidth: 540,
  },

  heroTitleMobile: {
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.3,
  },

  heroDescription: {
    color: "#555f6d",
    fontSize: 16,
    lineHeight: 26,
    marginTop: 18,
    maxWidth: 520,
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 21,
  },

  chip: {
    backgroundColor: "#f3f3f3",
    color: "#222",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },

  divider: {
    height: 1,
    backgroundColor: "#e9e9e9",
    marginVertical: 25,
  },

  productName: {
    color: "#111",
    fontSize: 19,
    fontWeight: "900",
  },

  model: {
    color: "#999",
    fontSize: 11,
    marginTop: 4,
  },

  priceBlock: {
    marginTop: 20,
  },

  priceLabel: {
    color: "#6f7782",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  priceLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 11,
    marginTop: 4,
  },

  price: {
    color: "#0d1b2a",
    fontSize: 43,
    fontWeight: "900",
    letterSpacing: -1.5,
  },

  offerSmall: {
    backgroundColor: "#111",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
  },

  offerSmallText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
  },

  paymentText: {
    color: "#6f7782",
    fontSize: 11,
    marginTop: 2,
  },

  buyButton: {
    width: "100%",
    backgroundColor: "#1677c8",
    borderRadius: 14,
    paddingVertical: 17,
    paddingHorizontal: 18,
    alignItems: "center",
    marginTop: 23,
  },

  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }],
  },

  buyButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.25,
  },

  buyButtonSub: {
    color: "#aaa",
    fontSize: 9,
    marginTop: 3,
  },

  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
  },

  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  trustIcon: {
    fontSize: 11,
  },

  trustText: {
    color: "#6f7782",
    fontSize: 9,
  },

  problemSection: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 80,
  },

  sectionCenter: {
    alignItems: "center",
    maxWidth: 760,
    alignSelf: "center",
  },

  eyebrow: {
    color: "#6f7782",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },

  sectionBigTitle: {
    color: "#111",
    fontSize: 40,
    lineHeight: 45,
    fontWeight: "900",
    letterSpacing: -1.5,
    textAlign: "center",
    marginTop: 12,
  },

  sectionBigTitleMobile: {
    fontSize: 31,
    lineHeight: 36,
    letterSpacing: -1,
  },

  sectionLead: {
    color: "#5f6875",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 13,
    maxWidth: 620,
  },

  useGrid: {
    flexDirection: "row",
    gap: 15,
    marginTop: 45,
  },

  useCard: {
    flex: 1,
    backgroundColor: "#f7f8fa",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e9edf2",
  },

  useImage: {
    width: "100%",
    aspectRatio: 1.45,
  },

  useContent: {
    padding: 22,
  },

  useNumber: {
    color: "#aaa",
    fontSize: 9,
    fontWeight: "900",
  },

  useTitle: {
    color: "#111",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 12,
  },

  useDescription: {
    color: "#5f6875",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },

  visualSection: {
    backgroundColor: "#0b0d10",
    paddingTop: 50,
    paddingBottom: 50,
    paddingHorizontal: 22,
  },

  visualInner: {
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center",
    alignItems: "center",
  },

  lightEyebrow: {
    color: "#999",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },

  visualTitle: {
    color: "#fff",
    fontSize: 40,
    lineHeight: 45,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -1.5,
    marginTop: 12,
  },

  visualDescription: {
    color: "#aaa",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 620,
    marginTop: 13,
  },

  benefitImageContainer: {
    width: "100%",
    aspectRatio: 1.91,
    marginTop: 20,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#161616",
  },

  benefitImage: { width: "100%", height: "100%" },

  featureSection: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 90,
    flexDirection: "row",
    alignItems: "center",
    gap: 55,
  },

  featureImageContainer: {
    flex: 1.05,
    aspectRatio: 1.25,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#eee",
  },

  featureImage: {
    width: "100%",
    height: "100%",
  },

  featureContent: {
    flex: 0.95,
  },

  featureTitle: {
    color: "#111",
    fontSize: 41,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: -1.5,
    marginTop: 12,
  },

  featureDescription: {
    color: "#5f6875",
    fontSize: 15,
    lineHeight: 24,
    marginTop: 15,
  },

  featureList: {
    marginTop: 28,
    gap: 20,
  },

  featureListItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
  },

  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  check: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },

  featureListContent: {
    flex: 1,
  },

  featureListTitle: {
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
  },

  featureListText: {
    color: "#6f7782",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },

  statement: {
    backgroundColor: "#f7f8fa",
    paddingHorizontal: 22,
    paddingVertical: 85,
    alignItems: "center",
  },

  statementSmall: {
    color: "#888",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.8,
    textAlign: "center",
  },

  statementTitle: {
    color: "#111",
    fontSize: 55,
    lineHeight: 61,
    fontWeight: "900",
    letterSpacing: -2,
    textAlign: "center",
    marginTop: 12,
  },

  statementTitleMobile: {
    fontSize: 38,
    lineHeight: 43,
  },

  statementText: {
    color: "#5f6875",
    fontSize: 14,
    marginTop: 13,
    textAlign: "center",
  },

  reviewsSection: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 85,
  },

  reviewsHeader: {
    alignItems: "center",
  },

  reviewsTitle: {
    color: "#111",
    fontSize: 38,
    lineHeight: 43,
    fontWeight: "900",
    letterSpacing: -1.3,
    textAlign: "center",
    marginTop: 11,
  },

  reviewsDescription: {
    color: "#6f7782",
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 570,
    marginTop: 12,
  },

  emptyReviews: {
    marginTop: 35,
    backgroundColor: "#f8f9fb",
    borderRadius: 20,
    paddingHorizontal: 25,
    paddingVertical: 35,
    alignItems: "center",
  },

  emptyReviewIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyReviewIconText: {
    color: "#fff",
    fontSize: 20,
  },

  emptyReviewTitle: {
    color: "#111",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 15,
  },

  emptyReviewText: {
    color: "#6f7782",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 500,
    marginTop: 7,
  },

  finalOffer: {
    backgroundColor: "#0b0d10",
    paddingHorizontal: 22,
    paddingVertical: 90,
  },

  finalOfferInner: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    alignItems: "center",
  },

  finalEyebrow: {
    color: "#999",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },

  finalTitle: {
    color: "#fff",
    fontSize: 43,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.5,
    textAlign: "center",
    marginTop: 12,
  },

  finalTitleMobile: {
    fontSize: 33,
    lineHeight: 38,
  },

  finalDescription: {
    color: "#aaa",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 560,
    marginTop: 14,
  },

  finalPriceLabel: {
    color: "#888",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginTop: 30,
  },

  finalPrice: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1.5,
    marginTop: 3,
  },

  finalPayment: {
    color: "#999",
    fontSize: 11,
    marginTop: 2,
  },

  finalButton: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#fff",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: 23,
  },

  finalButtonPressed: {
    opacity: 0.85,
  },

  finalButtonText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
  },

  finalTrust: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },

  finalTrustText: {
    color: "#999",
    fontSize: 9,
  },

  finalTrustDot: {
    color: "#555",
    fontSize: 9,
  },

  faq: {
    width: "100%",
    maxWidth: 850,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 85,
  },

  faqTitle: {
    color: "#111",
    fontSize: 38,
    lineHeight: 43,
    fontWeight: "900",
    letterSpacing: -1.3,
    marginTop: 11,
  },

  faqList: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },

  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 20,
  },

  faqQuestionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
  },

  faqQuestion: {
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
    flex: 1,
  },

  faqPlus: {
    color: "#6f7782",
    fontSize: 23,
    fontWeight: "400",
  },

  faqAnswer: {
    color: "#5f6875",
    fontSize: 12,
    lineHeight: 20,
    marginTop: 12,
    paddingRight: 40,
  },

  footer: {
    backgroundColor: "#090909",
    paddingHorizontal: 22,
    paddingVertical: 55,
    alignItems: "center",
  },

  footerLogo: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -1,
  },

  footerDescription: {
    color: "#888",
    fontSize: 11,
    marginTop: 7,
  },

  footerDivider: {
    width: "100%",
    maxWidth: 700,
    height: 1,
    backgroundColor: "#242424",
    marginVertical: 28,
  },

  footerLegal: {
    color: "#555",
    fontSize: 9,
    textAlign: "center",
  },
});