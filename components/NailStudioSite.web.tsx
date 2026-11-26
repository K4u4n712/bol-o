import Head from 'expo-router/head';
import { Image, type ImageSourcePropType } from 'react-native';
import NailStudio from './NailStudio';

const hero = require('../assets/lauana/hero.jpg');

const models: { name: string; detail: string; alt: string; image: ImageSourcePropType }[] = [
  {
    name: 'Nude rosado', detail: 'Tom translúcido com brilho delicado.',
    alt: 'Unhas amendoadas curtas em gel nude rosado sobre linho claro',
    image: require('../assets/lauana/nude.jpg'),
  },
  {
    name: 'Francesinha', detail: 'Base rosada com pontas brancas finas.',
    alt: 'Unhas em gel com francesinha branca fina sobre tecido acetinado',
    image: require('../assets/lauana/francesinha.jpg'),
  },
  {
    name: 'Vinho cereja', detail: 'Cor profunda com acabamento intenso e brilhante.',
    alt: 'Unhas arredondadas em gel vinho cereja sobre superfície marrom',
    image: require('../assets/lauana/cereja.jpg'),
  },
];

const tips = [
  { title: 'Escolha um modelo', text: 'Salve uma referência de cor, formato ou decoração para mostrar no dia.' },
  { title: 'Avise se já estiver usando gel', text: 'Conte à Lauana se estiver com gel ou alongamento de outro atendimento. Assim, ela pode orientar sobre a remoção.' },
  { title: 'Cuide do acabamento', text: 'Evite usar as unhas para abrir embalagens e procure a profissional para fazer a manutenção ou a remoção.' },
];

export default function NailStudioSite() {
  return <div className="lauana-site">
    <Head>
      <title>Lauana Beatuy studio | Unhas em gel e agendamento</title>
      <meta name="description" content="Veja inspirações de unhas em gel, confira as recomendações da Lauana e reserve seu horário online." />
    </Head>
    <style>{siteCss}</style>
    <header className="lb-header">
      <div className="lb-frame lb-header-inner">
        <a className="lb-logo" href="#inicio" aria-label="Lauana Beatuy studio, início">
          <span>Lauana</span><small>Beatuy studio</small>
        </a>
        <nav className="lb-nav" aria-label="Navegação principal">
          <a href="#modelos">Modelos</a>
          <a href="#recomendacoes">Recomendações</a>
        </nav>
        <a className="lb-button lb-button-small" href="#agendar">Agendar</a>
      </div>
    </header>
    <main id="inicio">
      <section className="lb-frame lb-hero" aria-labelledby="lb-hero-title">
        <div className="lb-hero-copy">
          <p className="lb-eyebrow">Com Lauana</p>
          <h1 id="lb-hero-title">Unhas em gel<span> do seu jeito.</span></h1>
          <p>Escolha seu estilo e reserve seu atendimento online.</p>
          <div className="lb-hero-actions">
            <a className="lb-button" href="#agendar">Escolher meu horário</a>
            <a className="lb-text-link" href="#modelos">Ver modelos</a>
          </div>
        </div>
        <div className="lb-hero-image">
          <Image source={hero} accessibilityLabel="Unhas amendoadas em gel vinho sobre cetim champanhe" resizeMode="cover"
            style={{ width: '100%', height: '100%' }} />
        </div>
      </section>
      <section id="agendar" className="lb-booking-section" aria-labelledby="lb-booking-title">
        <div className="lb-frame lb-booking">
          <div className="lb-section-heading">
            <p className="lb-eyebrow">Reserva online</p>
            <h2 id="lb-booking-title">Seu próximo horário</h2>
            <p>Toque em uma data disponível, escolha o horário e confirme com seu WhatsApp.</p>
            <dl className="lb-hours" aria-label="Horário de atendimento">
              <div><dt>Segunda a sexta</dt><dd>7h às 18h</dd></div>
              <div><dt>Sábado</dt><dd>7h às 12h</dd></div>
            </dl>
          </div>
          <div id="lauana-booking-card"><NailStudio embedded /></div>
        </div>
      </section>
      <section id="modelos" className="lb-gallery-section" aria-labelledby="lb-gallery-title">
        <div className="lb-frame">
          <div className="lb-section-heading">
            <p className="lb-eyebrow">Inspirações</p>
            <h2 id="lb-gallery-title">Qual é o seu estilo?</h2>
            <p>Use os modelos como referência para escolher a cor e o acabamento.</p>
          </div>
          <div className="lb-gallery">
            {models.map(model => <figure className="lb-model" key={model.name}>
              <div className="lb-model-image"><Image source={model.image} accessibilityLabel={model.alt} resizeMode="cover"
                style={{ width: '100%', height: '100%' }} /></div>
              <figcaption><h3>{model.name}</h3><p>{model.detail}</p></figcaption>
            </figure>)}
          </div>
          <p className="lb-caption">Imagens ilustrativas de inspiração.</p>
        </div>
      </section>
      <section id="recomendacoes" className="lb-frame lb-tips" aria-labelledby="lb-tips-title">
        <div className="lb-section-heading">
          <p className="lb-eyebrow">Para as clientes</p>
          <h2 id="lb-tips-title">Antes e depois<br />do atendimento</h2>
        </div>
        <div>
          {tips.map(tip => <article key={tip.title} className="lb-tip">
            <h3>{tip.title}</h3><p>{tip.text}</p>
          </article>)}
        </div>
      </section>
    </main>
    <footer className="lb-footer">
      <div className="lb-frame lb-footer-inner">
        <span>Lauana Beatuy studio</span>
        <a href="/agenda-unhas-admin">Área administrativa</a>
      </div>
    </footer>
    <nav className="lb-mobile-nav" aria-label="Atalhos">
      <a href="#modelos">Modelos</a>
      <a className="lb-button" href="#agendar">Ver horários</a>
    </nav>
  </div>;
}

const siteCss = `
.lauana-site{--lb-ink:#301b24;--lb-muted:#66535b;--lb-accent:#651b39;--lb-line:#e6d8d7;background:#fbf7f2;color:var(--lb-ink);font:16px/1.55 system-ui,sans-serif;height:100vh;height:100dvh;overflow:auto;overflow-wrap:anywhere}
.lauana-site *{box-sizing:border-box}
.lauana-site h1,.lauana-site h2,.lauana-site h3,.lauana-site p,.lauana-site figure{margin:0}
.lauana-site a{color:inherit}
.lauana-site a:focus-visible{outline:2px solid var(--lb-accent);outline-offset:5px}
.lauana-site section[id]{scroll-margin-top:20px}
.lauana-site .lb-frame{width:min(1180px,calc(100% - 96px));margin-inline:auto}
.lauana-site .lb-header{background:#fffaf7;border-bottom:1px solid var(--lb-line)}
.lauana-site .lb-header-inner,.lauana-site .lb-footer-inner{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:82px}
.lauana-site .lb-logo{display:flex;flex-direction:column;align-items:center;text-decoration:none;line-height:1}
.lauana-site .lb-logo span{font:38px/.94 Georgia,serif;letter-spacing:-.065em}
.lauana-site .lb-logo small{font-size:11px;letter-spacing:.14em;margin-top:6px}
.lauana-site .lb-nav{display:flex;gap:34px}
.lauana-site .lb-nav a,.lauana-site .lb-footer a{font-size:14px;text-decoration:none}
.lauana-site .lb-nav a:hover,.lauana-site .lb-footer a:hover{text-decoration:underline}
.lauana-site .lb-button{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:12px 23px;background:var(--lb-accent);color:white;text-decoration:none;font-weight:650;border:1px solid var(--lb-accent);border-radius:3px}
.lauana-site .lb-button:hover{background:#481228}
.lauana-site .lb-button-small{min-height:42px;padding:8px 20px;font-size:14px}
.lauana-site .lb-hero{display:grid;grid-template-columns:1fr .94fr;gap:clamp(36px,7vw,110px);align-items:center;padding:44px;min-height:480px;margin-block:24px 30px;background:#381526;color:#fff8f4;border-radius:30px}
.lauana-site .lb-eyebrow{font-size:13px;font-weight:750;line-height:1.3;letter-spacing:.13em;text-transform:uppercase;color:var(--lb-accent)}
.lauana-site h1,.lauana-site h2{font-family:Georgia,serif;font-weight:400;letter-spacing:-.045em;line-height:1.04}
.lauana-site h1{font-size:clamp(56px,7vw,106px);margin-block:16px 22px}
.lauana-site .lb-hero .lb-eyebrow,.lauana-site h1 span{color:#f4c4cb}
.lauana-site h1 span{display:block;font-style:italic}
.lauana-site .lb-hero-copy>p:not(.lb-eyebrow),.lauana-site .lb-section-heading>p:not(.lb-eyebrow){color:var(--lb-muted);max-width:42ch;font-size:18px}
.lauana-site .lb-hero-copy>p:not(.lb-eyebrow){color:#f6e6eb}
.lauana-site .lb-hero-actions{display:flex;align-items:center;flex-wrap:wrap;gap:20px;margin-top:28px}
.lauana-site .lb-text-link{font-weight:650;text-underline-offset:5px}
.lauana-site .lb-hero .lb-button{background:#f8e0e4;border-color:#f8e0e4;color:#4d1630}
.lauana-site .lb-hero .lb-button:hover{background:#fff5f3}
.lauana-site .lb-hero-image{height:clamp(355px,36vw,500px);overflow:hidden;background:#6d4d3f;border-radius:18px}
.lauana-site .lb-gallery-section{padding-block:68px;background:#f3e8e4}
.lauana-site .lb-section-heading h2{font-size:clamp(40px,5.2vw,69px);margin-block:11px 15px}
.lauana-site .lb-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-top:30px}
.lauana-site .lb-model-image{height:clamp(180px,25vw,330px);overflow:hidden;background:#e1c6bc;border-radius:3px}
.lauana-site .lb-model figcaption{padding-top:12px}
.lauana-site .lb-model h3,.lauana-site .lb-tip h3{font:26px/1.15 Georgia,serif}
.lauana-site .lb-model p,.lauana-site .lb-tip p{margin-top:6px;color:var(--lb-muted)}
.lauana-site .lb-caption{margin-top:20px;font-size:13px;color:var(--lb-muted)}
.lauana-site .lb-tips,.lauana-site .lb-booking{display:grid;grid-template-columns:1fr 1.1fr;gap:clamp(26px,6vw,90px);align-items:start;padding-block:70px}
.lauana-site .lb-tip{padding-block:16px;border-top:1px solid var(--lb-line)}
.lauana-site .lb-booking-section{background:#f3e8e4}
.lauana-site .lb-hours{display:grid;gap:9px;margin:22px 0 0;max-width:340px}
.lauana-site .lb-hours div{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #dbc3cb;padding-top:9px}
.lauana-site .lb-hours dt{font-weight:650}
.lauana-site .lb-hours dd{margin:0;color:var(--lb-accent);font-weight:650}
.lauana-site .lb-mobile-nav{display:none}
.lauana-site .lb-button{border-radius:12px}
.lauana-site .lb-footer{border-top:1px solid var(--lb-line)}
.lauana-site .lb-footer-inner span{font:22px/1.2 Georgia,serif}
@media(max-width:900px){.lauana-site .lb-frame{width:calc(100% - 48px)}.lauana-site .lb-hero{gap:24px;padding:26px}.lauana-site .lb-gallery{gap:16px}}
@media(max-width:700px){
  .lauana-site{padding-bottom:calc(72px + env(safe-area-inset-bottom))}
  .lauana-site .lb-frame{width:calc(100% - 32px)}
  .lauana-site .lb-header-inner{min-height:60px}
  .lauana-site .lb-nav,.lauana-site .lb-header .lb-button,.lauana-site .lb-hero .lb-text-link{display:none}
  .lauana-site .lb-logo span{font-size:31px}
  .lauana-site .lb-hero{display:flex;position:relative;isolation:isolate;align-items:flex-end;min-height:385px;padding:22px;margin-block:12px 24px;overflow:hidden;border-radius:22px}
  .lauana-site .lb-hero-image{position:absolute;z-index:-2;inset:0;height:100%;border-radius:0}
  .lauana-site .lb-hero::after{content:'';position:absolute;z-index:-1;inset:0;background:linear-gradient(180deg,#24111d00 5%,#24111d66 34%,#24111ded 78%)}
  .lauana-site h1{font-size:clamp(42px,11.5vw,62px);margin-block:7px 10px}
  .lauana-site .lb-hero-copy>p:not(.lb-eyebrow),.lauana-site .lb-section-heading>p:not(.lb-eyebrow){font-size:16px}
  .lauana-site .lb-hero-actions{margin-top:16px}
  .lauana-site .lb-tips,.lauana-site .lb-booking{grid-template-columns:minmax(0,1fr);padding-block:28px;gap:19px}
  .lauana-site .lb-gallery-section{padding-block:30px}
  .lauana-site .lb-gallery{grid-template-columns:1fr;gap:16px;margin-top:20px}
  .lauana-site .lb-model{display:grid;grid-template-columns:105px minmax(0,1fr);align-items:center;gap:14px;background:#fff9f6;padding:9px;border-radius:14px}
  .lauana-site .lb-model-image{height:102px;border-radius:9px}
  .lauana-site .lb-model figcaption{padding:0}
  .lauana-site .lb-model h3{font-size:24px}
  .lauana-site .lb-model p{font-size:15px}
  .lauana-site .lb-footer a{max-width:110px;text-align:right}
  .lauana-site .lb-mobile-nav{position:fixed;z-index:5;bottom:0;left:0;right:0;display:grid;grid-template-columns:1fr 1.45fr;align-items:center;gap:12px;padding:9px 16px calc(9px + env(safe-area-inset-bottom));background:#fffaf7;border-top:1px solid var(--lb-line)}
  .lauana-site .lb-mobile-nav a:first-child{text-align:center;font-weight:650;text-decoration:none;padding:12px 5px}
  .lauana-site .lb-mobile-nav .lb-button{min-height:48px}
}
`;
