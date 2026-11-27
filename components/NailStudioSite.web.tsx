import Head from 'expo-router/head';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { request, type Availability } from '../services/nailStudio';
import NailMonthDeck from './NailMonthDeck.web';
import './NailStudioSite.css';

const days = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' });
const asDate = (day: string) => new Date(day + 'T12:00:00Z');
const facts = [
  ['Hora marcada', 'Seu horário é só seu'],
  ['Atendimento exclusivo', 'Atenção total a você'],
  ['Acabamento impecável', 'Detalhe em cada unha'],
];
const steps = [
  ['Escolha o horário', 'Toque em um horário livre na agenda.'],
  ['Coloque seus dados', 'Só seu nome e WhatsApp.'],
  ['Confirme no site', 'Confira os dados e receba a confirmação aqui mesmo.'],
];

export default function NailStudioSite() {
  const [calendar, setCalendar] = useState<Availability>();
  const [service, setService] = useState('');
  const [month, setMonth] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [version, setVersion] = useState(0);
  const [calendarError, setCalendarError] = useState('');
  const [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const sheet = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const success = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setCalendar(undefined);
    setCalendarError('');
    request<Availability>(new URLSearchParams({ view: 'calendar', service })).then(data => {
      if (!active) return;
      setCalendar(data);
      setMonth(old => old >= data.first.slice(0, 7) && old <= data.last.slice(0, 7) ? old : data.first.slice(0, 7));
    }).catch(() => { if (active) setCalendarError('Não foi possível carregar os horários. Tente novamente.'); });
    return () => { active = false; };
  }, [service, version]);

  useEffect(() => {
    if (receipt) success.current?.focus();
    else if (time) form.current?.scrollIntoView({ block: 'start' });
  }, [time, receipt]);

  const chosen = calendar?.services.find(item => item.id === calendar.service);
  const summary = date && time && chosen ? chosen.name + ' · ' + days.format(asDate(date)) + ' às ' + time : '';
  async function reserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen || !summary || lock.current) return;
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get('name')).trim();
    const phone = String(fields.get('phone')).replace(/\D/g, '');
    if (name.length < 2 || !/^\d{10,13}$/.test(phone)) {
      setMessage('Informe seu nome e um WhatsApp com DDD.');
      return;
    }
    lock.current = true;
    setSaving(true);
    setMessage('');
    try {
      const result = await request<{ id: string }>(new URLSearchParams(), null, 'POST', {
        reminderConsent: fields.has('reminderConsent'),
        service: chosen.id, date, time, name, phone, notes: String(fields.get('notes') || '').trim(),
      });
      if (!result.id) throw new Error('A confirmação não foi recebida.');
      setReceipt(summary + '\nReserva ' + result.id);
      form.current?.reset();
      setTime('');
      setVersion(v => v + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível confirmar a reserva.');
      if ((error as { status?: number })?.status === 409) {
        setTime('');
        setVersion(v => v + 1);
        document.getElementById('agendar')?.scrollIntoView();
      }
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return <main className="lua-site" lang="pt-BR">
    <Head><title>Lua Beauty Studio · Nail Designer</title><meta name="theme-color" content="#111111" /></Head>
    <nav><div className="wrap"><span className="logo">🌙 Lua Beauty Studio</span><a className="cta" href="#agendar">Agendar</a></div></nav>
    <div className="wrap">
      <header className="hero"><div className="eyebrow">Nail Designer</div>
        <h1>Lua <em>Beauty</em> Studio</h1><p>Unhas feitas com arte, cuidado e exclusividade.</p>
        <div className="btns"><a className="btn f" href="#agendar">Agendar meu horário</a><a className="btn" href="#como">Como funciona</a></div>
      </header>
      <div className="facts">{facts.map(([title, detail]) => <div key={title} className="fact"><b>{title}</b><span>{detail}</span></div>)}</div>
      <section id="como"><h2>Como funciona</h2><p className="lead">Agendar é rápido e simples.</p>
        <div className="how">{steps.map(([title, detail], index) => <div key={title}><i>{index + 1}</i><b>{title}</b><span>{detail}</span></div>)}</div>
      </section>
      <section id="agendar"><h2>Agende seu horário</h2><p className="lead">Toque em uma data para ver os horários livres.</p>
        {calendar && <label className="service">Serviço<br/><select value={calendar.service} disabled={saving} onChange={e => {
          setService(e.target.value); setCalendar(undefined); setTime(''); setMessage(''); setReceipt('');
        }}>{calendar.services.map(s => <option key={s.id} value={s.id}>{s.name} · {s.duration} min</option>)}</select></label>}
        <div className="live" role="status"><i/>{calendar ? Object.values(calendar.times).reduce((n,a) => n + a.length, 0) + ' horários livres na agenda' : calendarError || 'Carregando agenda…'}</div>
        {calendarError && <button className="retry" onClick={() => setVersion(v => v + 1)}>Tentar novamente</button>}
        {!time && message && <p role="alert">{message}</p>}
        {calendar && month && <NailMonthDeck month={month} calendar={calendar} selected={date}
          disabled={saving} onMonth={setMonth} onDay={key => {
            if (key !== date) setTime('');
            setDate(key); setReceipt(''); setMessage(''); sheet.current?.showModal();
          }} />}
      </section>
      <dialog className="sheet" ref={sheet} aria-labelledby="slot-day">
        <div className="grab"/><button className="x" aria-label="Fechar" onClick={() => sheet.current?.close()}>✕</button>
        <h3 id="slot-day">{date && days.format(asDate(date))}</h3><p className="shs">Escolha um horário livre · Horário de Brasília</p>
        <div className="chips">{calendar?.times[date]?.map(slot => <button className="chip" key={slot} onClick={() => {
          sheet.current?.close(); setTime(slot); form.current?.scrollIntoView();
        }}>{slot}<small>Livre</small></button>)}</div>
      </dialog>
      <section hidden={!time}><p className="lead">Quase lá! Confirme seus dados</p>
        <form className="box" ref={form} onSubmit={reserve}><div className="sum">{summary}</div>
          <div className="row"><div><label htmlFor="nome">Seu nome</label><input id="nome" name="name" autoComplete="name" placeholder="Como posso te chamar?" minLength={2} maxLength={80} required/></div>
          <div><label htmlFor="zap">WhatsApp com DDD</label><input id="zap" name="phone" type="tel" autoComplete="tel" placeholder="(62) 90000-0000" required/></div></div>
          <label htmlFor="obs">Observações (opcional)</label><input id="obs" name="notes" maxLength={500} placeholder="Cor, formato, referência…"/>
          <label className="reminder-choice"><input name="reminderConsent" type="checkbox"/>Autorizo o studio a me enviar um lembrete pelo WhatsApp no dia deste atendimento.</label>
          {message && <p role="alert">{message}</p>}<button className="go" disabled={saving}>{saving ? 'Confirmando…' : 'Confirmar agendamento'}</button>
        </form>
      </section>
      {receipt && <section><div className="box ok" ref={success} tabIndex={-1}><span aria-hidden="true">💖</span><h2>Agendamento confirmado!</h2><pre>{receipt}</pre></div></section>}
      <section className="faq"><h2>Dúvidas frequentes</h2><p className="lead">Respostas rápidas.</p>
        <details><summary>Quanto tempo dura o atendimento?</summary><p>A duração aparece ao lado do nome de cada serviço na agenda.</p></details>
        <details><summary>Como confirmo meu horário?</summary><p>Escolha a data e o horário, preencha seus dados e toque em Confirmar agendamento. O comprovante aparece nesta página.</p></details>
        <details><summary>Posso trocar o horário antes de confirmar?</summary><p>Sim. Volte ao calendário e escolha outro horário antes de enviar a reserva.</p></details>
      </section>
    </div>
    {!time && !receipt && <a className="fab" href="#agendar">Agendar meu horário</a>}
    <footer>🌙 <b>Lua Beauty Studio</b><br/><a href="/agenda-unhas-admin">Área administrativa</a><br/>© Lua Beauty Studio</footer>

  </main>;
}
