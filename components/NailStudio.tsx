import { Link } from 'expo-router';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth as projectAuth } from '../services/firebaseConfig';

type Service = { id: string; name: string; duration: number };
type Booking = { id: string; time: string; service: string; status: string; name: string; phone: string };
type Day = { services: Service[]; times?: string[]; bookings?: Booking[]; start?: string; end?: string };

const api = (process.env.EXPO_PUBLIC_NAIL_STUDIO_API || 'https://bol-o-rouge.vercel.app') + '/api/agenda-unhas';
const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' });

function adminAuth() {
  const name = 'nail-studio-admin';
  const app = getApps().find(item => item.name === name) ?? initializeApp(getApp(projectAuth.app.name).options, name);
  return getAuth(app);
}

function Button({ title, action, disabled = false, secondary = false }: {
  title: string; action: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={action}
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}

function Field({ label, value, change, placeholder, secret = false }: {
  label: string; value: string; change: (value: string) => void; placeholder?: string; secret?: boolean;
}) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} style={styles.input} value={value} onChangeText={change}
      placeholder={placeholder} placeholderTextColor="#786574" secureTextEntry={secret}
      autoCapitalize={label === 'E-mail' || secret ? 'none' : 'sentences'} />
  </View>;
}

async function request<T>(query: URLSearchParams, user?: User | null, method = 'GET', body?: object): Promise<T> {
  const headers: Record<string, string> = {};
  if (user) headers.Authorization = 'Bearer ' + await user.getIdToken();
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(api + '?' + query.toString(), { method, headers, body: body && JSON.stringify(body) });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Agenda temporariamente indisponível.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível acessar a agenda.');
  return data;
}

export default function NailStudio({ admin = false, embedded = false }: { admin?: boolean; embedded?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [date, setDate] = useState('');
  const [service, setService] = useState('');
  const [time, setTime] = useState('');
  const [day, setDay] = useState<Day>();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftDuration, setDraftDuration] = useState('90');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState('');
  const [receipt, setReceipt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => setDate(dateFormat.format(new Date())), []);
  useEffect(() => admin ? onAuthStateChanged(adminAuth(), setUser) : undefined, [admin]);
  useEffect(() => {
    setDay(undefined);
    if (admin && !user) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({ date, service, mode: admin ? 'admin' : 'public' });
    request<Day>(query, user).then(data => {
      if (!active) return;
      setDay(data);
      setStart(data.start || '');
      setEnd(data.end || '');
      setServices(data.services);
      if (!admin && !data.services.some(item => item.id === service)) {
        setService(data.services[0]?.id || '');
      }
    }).catch(error => {
      if (active) setFeedback(error.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [date, service, admin, user, refresh]);

  async function run(action: () => Promise<void>) {
    setFeedback('');
    setSaving(true);
    try { await action(); }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Tente novamente.'); }
    finally { setSaving(false); }
  }

  function chooseDate(value: string) {
    setDate(value);
    setTime('');
    setDay(undefined);
    setLoading(false);
    setFeedback('');
  }

  function changeDay(offset: number) {
    const value = new Date(date + 'T12:00:00Z');
    if (!Number.isFinite(+value)) return;
    value.setUTCDate(value.getUTCDate() + offset);
    chooseDate(dateFormat.format(value));
  }

  function saveAdmin(body: object, message: string) {
    return run(async () => {
      await request(new URLSearchParams({ mode: 'admin' }), user, 'PATCH', { date, ...body });
      setFeedback(message);
      setRefresh(value => value + 1);
    });
  }

  async function reserve() {
    await run(async () => {
      try {
        await request(new URLSearchParams(), null, 'POST', { date, service, time, name, phone });
        setReceipt(date.split('-').reverse().join('/') + ' às ' + time);
        setName('');
        setPhone('');
      } finally {
        setTime('');
        setRefresh(value => value + 1);
      }
    });
  }

  const content = <>
    {!embedded && <View style={styles.hero}>
      <Text style={styles.brand}>LAUANA BEATUY STUDIO</Text>
      <Text accessibilityRole="header" style={styles.title}>{admin ? 'Painel da agenda' : 'Agende suas unhas em gel'}</Text>
      <Text style={styles.description}>{admin ? 'Gerencie serviços, horários e atendimentos.' : 'Escolha o serviço e reserve um horário disponível.'}</Text>
    </View>}
    {feedback ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{feedback}</Text> : null}
    {admin && !user ? <View style={styles.card}>
      <Field label="E-mail" value={email} change={setEmail} />
      <Field label="Senha" value={password} change={setPassword} secret />
      <Button title="Entrar" disabled={saving || !email.trim() || !password} action={() => run(async () => {
        try { await signInWithEmailAndPassword(adminAuth(), email.trim(), password); }
        catch { throw new Error('Confira o e-mail e a senha.'); }
        setPassword('');
      })} />
    </View> : receipt ? <View style={styles.card}>
      <Text style={styles.heading}>Agendamento confirmado</Text>
      <Text style={styles.description}>{receipt}</Text>
      <Button title="Fazer outro agendamento" action={() => setReceipt('')} />
    </View> : <>
      <View style={styles.card}>
        {!admin && <>
          <Text style={styles.heading}>Serviço</Text>
          <View style={styles.row}>{(day?.services || services).map(item =>
            <Button key={item.id} title={item.name + ' · ' + item.duration + ' min'}
              secondary={item.id !== service} action={() => { setService(item.id); setTime(''); setFeedback(''); }} />)}</View>
        </>}
        <Text style={styles.heading}>Data</Text>
        <View style={styles.row}>
          <Button title="Dia anterior" secondary disabled={!date || (!admin && date <= dateFormat.format(new Date()))}
            action={() => changeDay(-1)} />
          <Button title="Próximo dia" secondary
            disabled={!date || (!admin && date >= dateFormat.format(new Date(Date.now() + 60 * 86400000)))}
            action={() => changeDay(1)} />
        </View>
        {Platform.OS === 'web' ? <label style={{ display: 'grid', gap: 6, color: '#43152f', fontWeight: 600 }}>
          Data do atendimento
          <input type="date" value={date}
            min={admin ? undefined : dateFormat.format(new Date())}
            max={admin ? undefined : dateFormat.format(new Date(Date.now() + 60 * 86400000))}
            onChange={event => chooseDate(event.currentTarget.value)}
            style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '8px 12px',
              border: '1px solid #d6afc0', borderRadius: 10, color: '#321026', background: '#fff', font: 'inherit' }} />
        </label> : <Field label="Data (AAAA-MM-DD)" value={date} change={chooseDate} placeholder="2026-12-01" />}
        {loading ? <Text style={styles.description}>Consultando agenda…</Text> : null}
        {!admin && day && <>
          <Text style={styles.heading}>Horários de Brasília</Text>
          <View style={styles.row}>{day.times?.map(item =>
            <Button key={item} title={item} secondary={item !== time} action={() => setTime(item)} />)}</View>
          {!day.times?.length && <Text style={styles.description}>Sem horários disponíveis nesta data.</Text>}
          {time ? <>
            <Field label="Seu nome" value={name} change={setName} />
            <Field label="WhatsApp com DDD" value={phone} change={setPhone} />
            <Text style={styles.description}>Seu contato será usado para tratar deste atendimento.</Text>
            <Button title={'Confirmar às ' + time} disabled={saving || !name.trim() || !phone.trim()} action={reserve} />
          </> : null}
        </>}
        {admin && day && <>
          <Text style={styles.heading}>Disponibilidade do dia</Text>
          <Field label="Abertura (HH:MM)" value={start} change={setStart} placeholder="09:00" />
          <Field label="Encerramento (HH:MM)" value={end} change={setEnd} placeholder="18:00" />
          <View style={styles.row}>
            <Button title="Salvar horários" disabled={saving} action={() => saveAdmin({ action: 'hours', start, end }, 'Horários salvos.')} />
            <Button title="Fechar novas reservas" secondary disabled={saving} action={() =>
              saveAdmin({ action: 'hours', start: '', end: '' }, 'Data fechada para novas reservas.')} />
          </View>
        </>}
      </View>
      {admin && day && <>
        <View style={styles.card}>
          <Text style={styles.heading}>Atendimentos do dia</Text>
          {!day.bookings?.length && <Text style={styles.description}>Nenhum atendimento nesta data.</Text>}
          {[...(day.bookings || [])].sort((a, b) => a.time.localeCompare(b.time)).map(item => <View key={item.id} style={styles.booking}>
            <Text style={styles.label}>{item.time} · {item.service} · {item.status}</Text>
            <Text style={styles.description}>{item.name} · {item.phone}</Text>
            {item.status === 'confirmado' && <View style={styles.row}>
              <Button title="Concluir" secondary disabled={saving} action={() =>
                saveAdmin({ action: 'status', id: item.id, status: 'concluído' }, 'Atendimento concluído.')} />
              <Button title="Cancelar reserva" secondary disabled={saving} action={() =>
                saveAdmin({ action: 'status', id: item.id, status: 'cancelado' }, 'Reserva cancelada.')} />
            </View>}
          </View>)}
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>Serviços</Text>
          {services.map(item => <View key={item.id} style={styles.booking}>
            <Field label="Nome do serviço" value={item.name} change={value => setServices(list =>
              list.map(entry => entry.id === item.id ? { ...entry, name: value } : entry))} />
            <Field label="Duração em minutos" value={String(item.duration || '')} change={value => setServices(list =>
              list.map(entry => entry.id === item.id ? { ...entry, duration: Number(value) } : entry))} />
            <Button title="Remover" secondary disabled={services.length <= 1 || saving} action={() =>
              setServices(list => list.filter(entry => entry.id !== item.id))} />
          </View>)}
          <Field label="Novo serviço" value={draftName} change={setDraftName} />
          <Field label="Duração do novo serviço" value={draftDuration} change={setDraftDuration} />
          <View style={styles.row}>
            <Button title="Adicionar à lista" secondary disabled={saving || !draftName.trim() || services.length >= 12} action={() => {
              setServices(list => [...list, {
                id: 'service-' + Date.now(), name: draftName, duration: Number(draftDuration),
              }]);
              setDraftName('');
            }} />
            <Button title="Salvar serviços" disabled={saving} action={() => saveAdmin({ action: 'services', services }, 'Serviços salvos.')} />
          </View>
        </View>
      </>}
    </>}
    {!embedded && <View style={styles.row}>
      <Link style={styles.link} href={admin ? './agenda-unhas' : './agenda-unhas-admin'}>{admin ? 'Ver página de agendamento' : 'Área administrativa'}</Link>
      {admin && user && <Button title="Sair" secondary action={() => run(() => signOut(adminAuth()))} />}
    </View>}
  </>;
  if (embedded) return <View style={styles.embedded}>{content}</View>;
  return <ScrollView style={styles.page} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    {content}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#fff5f7' },
  embedded: { gap: 12, width: '100%' },
  container: { width: '100%', maxWidth: 780, alignSelf: 'center', gap: 18, padding: 20, paddingBottom: 48 },
  hero: { paddingVertical: 32, gap: 12 },
  brand: { fontSize: 14, letterSpacing: 2.5, fontWeight: '700', color: '#8a3358' },
  title: { fontFamily: 'Georgia', fontSize: 46, color: '#43152f', lineHeight: 50 },
  heading: { color: '#43152f', fontSize: 22, fontWeight: '700' },
  description: { fontSize: 16, color: '#604052', lineHeight: 24 },
  card: { backgroundColor: '#fff', borderColor: '#efd9e3', borderWidth: 1, borderRadius: 20, padding: 20, gap: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  field: { gap: 6 },
  label: { fontSize: 16, fontWeight: '600', color: '#43152f' },
  input: { borderWidth: 1, borderColor: '#d6afc0', borderRadius: 10, padding: 12, fontSize: 16, color: '#321026' },
  button: { backgroundColor: '#812b55', paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-start' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: { backgroundColor: '#f7e5ed' },
  secondaryText: { color: '#6d2148' },
  disabled: { opacity: 0.5 },
  notice: { backgroundColor: '#f4dbe7', color: '#561b3b', borderRadius: 12, padding: 14, fontSize: 16 },
  booking: { borderTopWidth: 1, borderColor: '#efd9e3', paddingTop: 12, gap: 8 },
  link: { color: '#74264f', fontSize: 16, textDecorationLine: 'underline' },
});
