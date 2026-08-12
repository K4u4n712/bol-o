import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";

const API_URL =
  "https://bol-o-rouge.vercel.app/api/admin-bonde62";

type Section =
  | "overview"
  | "sales"
  | "traffic"
  | "tickets";

type Purchase = {
  id: string;
  codigo: string;
  nome: string;
  email: string;
  whatsapp: string;
  quantidade: number;
  valor: number;
  lote: string;
  pagamentoStatus: string;
  ingressoStatus: string;
  status:
    | "approved"
    | "used"
    | "pending"
    | "rejected"
    | "blocked";
  criadoEm: string;
  utilizadoEm: string;
};

type Dashboard = {
  generatedAt: string;
  summary: {
    onlineNow: number;
    totalViews: number;
    uniqueVisitors: number;
    approvedOrders: number;
    pendingOrders: number;
    rejectedOrders: number;
    blockedOrders: number;
    ticketsSold: number;
    ticketsUsed: number;
    ticketsAvailable: number;
    revenue: number;
    conversion: number;
  };
  trafficDaily: {
    date: string;
    views: number;
    uniqueVisitors: number;
  }[];
  salesDaily: {
    date: string;
    orders: number;
    tickets: number;
    revenue: number;
  }[];
  purchases: Purchase[];
};

const EMPTY: Dashboard = {
  generatedAt: "",
  summary: {
    onlineNow: 0,
    totalViews: 0,
    uniqueVisitors: 0,
    approvedOrders: 0,
    pendingOrders: 0,
    rejectedOrders: 0,
    blockedOrders: 0,
    ticketsSold: 0,
    ticketsUsed: 0,
    ticketsAvailable: 0,
    revenue: 0,
    conversion: 0,
  },
  trafficDaily: [],
  salesDaily: [],
  purchases: [],
};

export default function Bonde62Admin() {
  const { width } = useWindowDimensions();
  const wide = width >= 960;

  const [pin, setPin] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [section, setSection] =
    useState<Section>("overview");
  const [dashboard, setDashboard] =
    useState<Dashboard>(EMPTY);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  useEffect(() => {
    if (Platform.OS === "web") {
      try {
        const saved =
          window.sessionStorage.getItem(
            "bonde62_admin_pin"
          );

        if (saved) {
          setPin(saved);
          login(saved);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;

    const id = setInterval(() => {
      loadDashboard(true);
    }, 5000);

    return () => clearInterval(id);
  }, [authorized, pin]);

  function money(value: number) {
    return Number(value || 0).toLocaleString(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL",
      }
    );
  }

  function shortDate(value: string) {
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}`;
  }

  async function request(
    method: "GET" | "POST",
    body?: any,
    pinOverride?: string
  ) {
    const response = await fetch(API_URL, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Pin": (
          pinOverride || pin
        ).trim(),
      },
      ...(method === "POST"
        ? { body: JSON.stringify(body || {}) }
        : {}),
    });

    const data = await response
      .json()
      .catch(() => ({}));

    return { response, data };
  }

  async function login(pinOverride?: string) {
    const currentPin = (
      pinOverride || pin
    ).trim();

    if (!currentPin) {
      setError("Digite o PIN administrativo.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { response, data } = await request(
        "GET",
        undefined,
        currentPin
      );

      if (!response.ok || !data?.success) {
        setAuthorized(false);
        setError(
          data?.message ||
            "Não foi possível entrar."
        );
        return;
      }

      setPin(currentPin);
      setDashboard(data);
      setAuthorized(true);

      if (Platform.OS === "web") {
        try {
          window.sessionStorage.setItem(
            "bonde62_admin_pin",
            currentPin
          );
        } catch {}
      }
    } catch {
      setError(
        "Não foi possível conectar ao servidor."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard(silent = false) {
    if (!authorized) return;

    if (!silent) setRefreshing(true);

    try {
      const { response, data } =
        await request("GET");

      if (response.status === 403) {
        logout();
        return;
      }

      if (response.ok && data?.success) {
        setDashboard(data);
      }
    } catch (e) {
      console.log("admin refresh:", e);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  function logout() {
    setAuthorized(false);
    setDashboard(EMPTY);
    setPin("");
    setError("");

    if (Platform.OS === "web") {
      try {
        window.sessionStorage.removeItem(
          "bonde62_admin_pin"
        );
      } catch {}
    }
  }

  async function confirmAction(
    purchase: Purchase,
    status: "confirmed" | "used" | "cancelled"
  ) {
    const texts = {
      confirmed:
        "Reativar este ingresso e permitir entrada novamente?",
      used:
        "Marcar este ingresso como UTILIZADO manualmente?",
      cancelled:
        "Bloquear este ingresso? Ele não poderá ser validado na portaria.",
    };

    let ok = true;

    if (
      Platform.OS === "web" &&
      typeof window !== "undefined"
    ) {
      ok = window.confirm(texts[status]);
    } else {
      Alert.alert(
        "Confirmação",
        texts[status]
      );
      return;
    }

    if (!ok) return;

    try {
      setRefreshing(true);

      const { response, data } =
        await request("POST", {
          action: "ticket_status",
          paymentId: purchase.id,
          status,
        });

      if (!response.ok || !data?.success) {
        setError(
          data?.message ||
            "Não foi possível alterar o ingresso."
        );
        return;
      }

      await loadDashboard(true);
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return dashboard.purchases.filter((p) => {
      const matchesText =
        !q ||
        p.nome.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        p.whatsapp.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        p.status === statusFilter;

      return matchesText && matchesStatus;
    });
  }, [
    dashboard.purchases,
    search,
    statusFilter,
  ]);

  if (!authorized) {
    return (
      <View style={styles.loginPage}>
        <View style={styles.glowA} />
        <View style={styles.glowB} />

        <View style={styles.loginCard}>
          <View style={styles.logoRow}>
            <View>
              <Text style={styles.logo}>
                BONDE{" "}
                <Text style={styles.pink}>62</Text>
              </Text>
              <Text style={styles.logoSub}>
                ADMIN CENTER
              </Text>
            </View>

            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>
                ADMIN
              </Text>
            </View>
          </View>

          <Text style={styles.loginTitle}>
            Central administrativa
          </Text>

          <Text style={styles.loginText}>
            Vendas, tráfego, ingressos e portaria
            em um único painel.
          </Text>

          <Text style={styles.fieldLabel}>
            PIN ADMINISTRATIVO
          </Text>

          <TextInput
            value={pin}
            onChangeText={(v) => {
              setPin(v);
              setError("");
            }}
            style={styles.input}
            placeholder="Digite o PIN"
            placeholderTextColor="#6e6078"
            secureTextEntry
            keyboardType="number-pad"
            onSubmitEditing={() => login()}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.primary}
            onPress={() => login()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>
                ENTRAR NO PAINEL
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.back}
            onPress={() =>
              router.push("/bonde62")
            }
          >
            <Text style={styles.backText}>
              ← VOLTAR AO SITE
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const content = (
    <ScrollView
      style={[styles.content, !wide && { marginLeft: 0, marginBottom: 68 }]}
      contentContainerStyle={
        styles.contentInner
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            BONDE 62 / ADMIN
          </Text>
          <Text style={styles.pageTitle}>
            {section === "overview"
              ? "Visão geral"
              : section === "sales"
              ? "Vendas"
              : section === "traffic"
              ? "Tráfego"
              : "Ingressos"}
          </Text>
          <Text style={styles.pageSubtitle}>
            Atualização automática a cada 5
            segundos.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() =>
            loadDashboard(false)
          }
        >
          {refreshing ? (
            <ActivityIndicator
              color="#ff1684"
              size="small"
            />
          ) : (
            <Text style={styles.refreshText}>
              ↻ ATUALIZAR
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {section === "overview" ? (
        <>
          <View style={styles.liveBanner}>
            <View style={styles.liveDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.liveLabel}>
                PESSOAS NO SITE AGORA
              </Text>
              <Text style={styles.liveNumber}>
                {dashboard.summary.onlineNow}
              </Text>
            </View>

            <Text style={styles.liveHint}>
              tempo quase real
            </Text>
          </View>

          <View style={styles.cards}>
            <Metric
              icon="👁"
              label="Visualizações"
              value={String(
                dashboard.summary.totalViews
              )}
              sub="aberturas do site"
            />
            <Metric
              icon="👥"
              label="Visitantes únicos"
              value={String(
                dashboard.summary.uniqueVisitors
              )}
              sub="navegadores diferentes"
            />
            <Metric
              icon="🎟"
              label="Ingressos vendidos"
              value={String(
                dashboard.summary.ticketsSold
              )}
              sub={`${dashboard.summary.ticketsAvailable} ainda válidos`}
            />
            <Metric
              icon="💰"
              label="Faturamento"
              value={money(
                dashboard.summary.revenue
              )}
              sub="pagamentos aprovados"
            />
            <Metric
              icon="✓"
              label="Entraram no evento"
              value={String(
                dashboard.summary.ticketsUsed
              )}
              sub="ingressos utilizados"
            />
            <Metric
              icon="⚡"
              label="Conversão"
              value={`${dashboard.summary.conversion}%`}
              sub="visitantes → compras"
            />
          </View>

          <View style={styles.twoColumns}>
            <Panel
              title="Acessos nos últimos 7 dias"
              subtitle="Visualizações por dia"
            >
              <BarChart
                data={dashboard.trafficDaily.map(
                  (x) => ({
                    label: shortDate(x.date),
                    value: x.views,
                  })
                )}
              />
            </Panel>

            <Panel
              title="Ingressos vendidos"
              subtitle="Quantidade por dia"
            >
              <BarChart
                data={dashboard.salesDaily.map(
                  (x) => ({
                    label: shortDate(x.date),
                    value: x.tickets,
                  })
                )}
              />
            </Panel>
          </View>

          <View style={styles.twoColumns}>
            <Panel
              title="Status das vendas"
              subtitle="Resumo das compras"
            >
              <StatusRow
                label="Aprovadas"
                value={
                  dashboard.summary.approvedOrders
                }
                tone="green"
              />
              <StatusRow
                label="Pendentes"
                value={
                  dashboard.summary.pendingOrders
                }
                tone="yellow"
              />
              <StatusRow
                label="Rejeitadas"
                value={
                  dashboard.summary.rejectedOrders
                }
                tone="red"
              />
              <StatusRow
                label="Ingressos bloqueados"
                value={
                  dashboard.summary.blockedOrders
                }
                tone="muted"
              />
            </Panel>

            <Panel
              title="Portaria"
              subtitle="Situação dos ingressos"
            >
              <StatusRow
                label="Vendidos"
                value={
                  dashboard.summary.ticketsSold
                }
                tone="pink"
              />
              <StatusRow
                label="Já utilizados"
                value={
                  dashboard.summary.ticketsUsed
                }
                tone="green"
              />
              <StatusRow
                label="Ainda podem entrar"
                value={
                  dashboard.summary
                    .ticketsAvailable
                }
                tone="yellow"
              />

              <TouchableOpacity
                style={styles.validatorButton}
                onPress={() =>
                  router.push(
                    "/validar-ingresso"
                  )
                }
              >
                <Text
                  style={
                    styles.validatorButtonText
                  }
                >
                  ABRIR VALIDADOR →
                </Text>
              </TouchableOpacity>
            </Panel>
          </View>

          <Panel
            title="Últimas compras"
            subtitle="Movimentação mais recente"
          >
            <PurchaseTable
              purchases={dashboard.purchases.slice(
                0,
                8
              )}
              money={money}
              onAction={confirmAction}
              compact
            />
          </Panel>
        </>
      ) : null}

      {section === "sales" ? (
        <>
          <View style={styles.cards}>
            <Metric
              icon="💰"
              label="Faturamento"
              value={money(
                dashboard.summary.revenue
              )}
              sub="total aprovado"
            />
            <Metric
              icon="🧾"
              label="Compras aprovadas"
              value={String(
                dashboard.summary.approvedOrders
              )}
              sub="pedidos pagos"
            />
            <Metric
              icon="⏳"
              label="Pendentes"
              value={String(
                dashboard.summary.pendingOrders
              )}
              sub="aguardando pagamento"
            />
            <Metric
              icon="🎟"
              label="Ingressos"
              value={String(
                dashboard.summary.ticketsSold
              )}
              sub="unidades vendidas"
            />
          </View>

          <Panel
            title="Faturamento / vendas"
            subtitle="Últimos 7 dias"
          >
            <BarChart
              data={dashboard.salesDaily.map(
                (x) => ({
                  label: shortDate(x.date),
                  value: x.revenue,
                  money: true,
                })
              )}
            />
          </Panel>

          <Panel
            title="Todas as compras"
            subtitle={`${dashboard.purchases.length} registros carregados`}
          >
            <AdminFilters
              search={search}
              setSearch={setSearch}
              status={statusFilter}
              setStatus={setStatusFilter}
            />
            <PurchaseTable
              purchases={filtered}
              money={money}
              onAction={confirmAction}
            />
          </Panel>
        </>
      ) : null}

      {section === "traffic" ? (
        <>
          <View style={styles.cards}>
            <Metric
              icon="🟢"
              label="Online agora"
              value={String(
                dashboard.summary.onlineNow
              )}
              sub="últimos 45 segundos"
            />
            <Metric
              icon="👁"
              label="Visualizações"
              value={String(
                dashboard.summary.totalViews
              )}
              sub="total acumulado"
            />
            <Metric
              icon="👥"
              label="Visitantes únicos"
              value={String(
                dashboard.summary.uniqueVisitors
              )}
              sub="estimativa por navegador"
            />
            <Metric
              icon="⚡"
              label="Conversão"
              value={`${dashboard.summary.conversion}%`}
              sub="compras / visitantes"
            />
          </View>

          <Panel
            title="Tráfego do site"
            subtitle="Visualizações nos últimos 7 dias"
          >
            <BarChart
              data={dashboard.trafficDaily.map(
                (x) => ({
                  label: shortDate(x.date),
                  value: x.views,
                })
              )}
            />
          </Panel>

          <Panel
            title="Visitantes únicos"
            subtitle="Novos navegadores por dia"
          >
            <BarChart
              data={dashboard.trafficDaily.map(
                (x) => ({
                  label: shortDate(x.date),
                  value: x.uniqueVisitors,
                })
              )}
            />
          </Panel>

          <View style={styles.infoNotice}>
            <Text style={styles.infoNoticeTitle}>
              Como o “online agora” funciona
            </Text>
            <Text style={styles.infoNoticeText}>
              O site envia um sinal periódico.
              Uma pessoa é considerada online
              quando o navegador foi visto nos
              últimos 45 segundos. O painel
              consulta esses dados a cada 5
              segundos.
            </Text>
          </View>
        </>
      ) : null}

      {section === "tickets" ? (
        <>
          <View style={styles.cards}>
            <Metric
              icon="🎟"
              label="Vendidos"
              value={String(
                dashboard.summary.ticketsSold
              )}
              sub="ingressos aprovados"
            />
            <Metric
              icon="✅"
              label="Utilizados"
              value={String(
                dashboard.summary.ticketsUsed
              )}
              sub="já passaram na portaria"
            />
            <Metric
              icon="🟡"
              label="Disponíveis"
              value={String(
                dashboard.summary
                  .ticketsAvailable
              )}
              sub="ainda podem ser validados"
            />
            <Metric
              icon="⛔"
              label="Bloqueados"
              value={String(
                dashboard.summary.blockedOrders
              )}
              sub="não entram na portaria"
            />
          </View>

          <Panel
            title="Gerenciar ingressos"
            subtitle="Pesquise e altere o status de um ingresso"
          >
            <AdminFilters
              search={search}
              setSearch={setSearch}
              status={statusFilter}
              setStatus={setStatusFilter}
            />

            <PurchaseTable
              purchases={filtered}
              money={money}
              onAction={confirmAction}
            />
          </Panel>
        </>
      ) : null}
    </ScrollView>
  );

  return (
    <View style={styles.app}>
      {wide ? (
        <View style={styles.sidebar}>
          <View>
            <Text style={styles.logo}>
              BONDE{" "}
              <Text style={styles.pink}>62</Text>
            </Text>
            <Text style={styles.logoSub}>
              ADMIN CENTER
            </Text>
          </View>

          <View style={styles.menu}>
            <MenuButton
              active={section === "overview"}
              icon="⌂"
              label="Visão geral"
              onPress={() =>
                setSection("overview")
              }
            />
            <MenuButton
              active={section === "sales"}
              icon="₿"
              label="Vendas"
              onPress={() =>
                setSection("sales")
              }
            />
            <MenuButton
              active={section === "traffic"}
              icon="↗"
              label="Tráfego"
              onPress={() =>
                setSection("traffic")
              }
            />
            <MenuButton
              active={section === "tickets"}
              icon="◫"
              label="Ingressos"
              onPress={() =>
                setSection("tickets")
              }
            />
          </View>

          <View style={styles.sidebarBottom}>
            <TouchableOpacity
              style={styles.siteButton}
              onPress={() =>
                router.push("/bonde62")
              }
            >
              <Text style={styles.siteButtonText}>
                VER SITE ↗
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={logout}
            >
              <Text style={styles.logoutText}>
                SAIR DO ADMIN
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.mobileNav}>
          <MenuButton
            active={section === "overview"}
            icon="⌂"
            label="Geral"
            onPress={() =>
              setSection("overview")
            }
            mobile
          />
          <MenuButton
            active={section === "sales"}
            icon="₿"
            label="Vendas"
            onPress={() =>
              setSection("sales")
            }
            mobile
          />
          <MenuButton
            active={section === "traffic"}
            icon="↗"
            label="Tráfego"
            onPress={() =>
              setSection("traffic")
            }
            mobile
          />
          <MenuButton
            active={section === "tickets"}
            icon="◫"
            label="Ingressos"
            onPress={() =>
              setSection("tickets")
            }
            mobile
          />
        </View>
      )}

      {content}
    </View>
  );
}

function MenuButton({
  active,
  icon,
  label,
  onPress,
  mobile = false,
}: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.menuButton,
        mobile && styles.menuButtonMobile,
        active && styles.menuButtonActive,
      ]}
    >
      <Text
        style={[
          styles.menuIcon,
          active && styles.menuTextActive,
        ]}
      >
        {icon}
      </Text>
      <Text
        style={[
          styles.menuText,
          mobile && styles.menuTextMobile,
          active && styles.menuTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
}: any) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricTop}>
        <Text style={styles.metricIcon}>
          {icon}
        </Text>
        <View style={styles.metricSpark} />
      </View>
      <Text style={styles.metricLabel}>
        {label}
      </Text>
      <Text style={styles.metricValue}>
        {value}
      </Text>
      <Text style={styles.metricSub}>
        {sub}
      </Text>
    </View>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: any) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>
        {title}
      </Text>
      <Text style={styles.panelSubtitle}>
        {subtitle}
      </Text>
      <View style={styles.panelBody}>
        {children}
      </View>
    </View>
  );
}

function BarChart({
  data,
}: {
  data: {
    label: string;
    value: number;
    money?: boolean;
  }[];
}) {
  const max = Math.max(
    1,
    ...data.map((x) => Number(x.value || 0))
  );

  return (
    <View style={styles.chart}>
      {data.map((item, index) => {
        const height = Math.max(
          5,
          Math.round(
            (Number(item.value || 0) / max) *
              130
          )
        );

        return (
          <View
            key={`${item.label}-${index}`}
            style={styles.chartColumn}
          >
            <Text
              style={styles.chartValue}
              numberOfLines={1}
            >
              {item.money
                ? Number(
                    item.value || 0
                  ).toLocaleString("pt-BR", {
                    maximumFractionDigits: 0,
                  })
                : item.value}
            </Text>

            <View
              style={[
                styles.chartBar,
                { height },
              ]}
            />

            <Text style={styles.chartLabel}>
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: any) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusLeft}>
        <View
          style={[
            styles.statusDot,
            tone === "green" &&
              styles.bgGreen,
            tone === "yellow" &&
              styles.bgYellow,
            tone === "red" &&
              styles.bgRed,
            tone === "pink" &&
              styles.bgPink,
            tone === "muted" &&
              styles.bgMuted,
          ]}
        />
        <Text style={styles.statusLabel}>
          {label}
        </Text>
      </View>

      <Text style={styles.statusValue}>
        {value}
      </Text>
    </View>
  );
}

function AdminFilters({
  search,
  setSearch,
  status,
  setStatus,
}: any) {
  return (
    <>
      <TextInput
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
        placeholder="Buscar nome, e-mail, WhatsApp ou código..."
        placeholderTextColor="#71647b"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={
          styles.filterRow
        }
      >
        {[
          ["all", "Todos"],
          ["approved", "Válidos"],
          ["used", "Utilizados"],
          ["pending", "Pendentes"],
          ["blocked", "Bloqueados"],
          ["rejected", "Rejeitados"],
        ].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            onPress={() => setStatus(key)}
            style={[
              styles.filterPill,
              status === key &&
                styles.filterPillActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                status === key &&
                  styles.filterTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
}

function PurchaseTable({
  purchases,
  money,
  onAction,
  compact = false,
}: any) {
  if (!purchases.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>
          🎟
        </Text>
        <Text style={styles.emptyTitle}>
          Nenhum registro encontrado
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.purchaseList}>
      {purchases.map((p: Purchase) => (
        <View
          key={p.id}
          style={styles.purchaseCard}
        >
          <View style={styles.purchaseHeader}>
            <View style={{ flex: 1 }}>
              <Text
                style={styles.purchaseName}
              >
                {p.nome || "Sem nome"}
              </Text>
              <Text
                style={styles.purchaseCode}
              >
                {p.codigo}
              </Text>
            </View>

            <StatusBadge status={p.status} />
          </View>

          <View style={styles.purchaseGrid}>
            <Info
              label="E-MAIL"
              value={p.email || "—"}
            />
            <Info
              label="WHATSAPP"
              value={p.whatsapp || "—"}
            />
            <Info
              label="QTD."
              value={String(p.quantidade)}
            />
            <Info
              label="VALOR"
              value={money(p.valor)}
            />
            <Info
              label="COMPRA"
              value={p.criadoEm || "—"}
            />
            <Info
              label="LOTE"
              value={p.lote || "—"}
            />
          </View>

          {!compact ? (
            <View style={styles.actions}>
              {p.status !== "approved" ? (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.actionGreen,
                  ]}
                  onPress={() =>
                    onAction(p, "confirmed")
                  }
                >
                  <Text
                    style={
                      styles.actionButtonText
                    }
                  >
                    REATIVAR
                  </Text>
                </TouchableOpacity>
              ) : null}

              {p.status !== "used" ? (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.actionYellow,
                  ]}
                  onPress={() =>
                    onAction(p, "used")
                  }
                >
                  <Text
                    style={
                      styles.actionButtonTextDark
                    }
                  >
                    MARCAR USADO
                  </Text>
                </TouchableOpacity>
              ) : null}

              {p.status !== "blocked" ? (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.actionRed,
                  ]}
                  onPress={() =>
                    onAction(p, "cancelled")
                  }
                >
                  <Text
                    style={
                      styles.actionButtonText
                    }
                  >
                    BLOQUEAR
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Info({ label, value }: any) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>
      <Text
        style={styles.infoValue}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function StatusBadge({
  status,
}: {
  status: Purchase["status"];
}) {
  const label =
    status === "approved"
      ? "VÁLIDO"
      : status === "used"
      ? "UTILIZADO"
      : status === "pending"
      ? "PENDENTE"
      : status === "blocked"
      ? "BLOQUEADO"
      : "REJEITADO";

  return (
    <View
      style={[
        styles.badge,
        status === "approved" &&
          styles.badgeGreen,
        status === "used" &&
          styles.badgePurple,
        status === "pending" &&
          styles.badgeYellow,
        status === "blocked" &&
          styles.badgeRed,
        status === "rejected" &&
          styles.badgeMuted,
      ]}
    >
      <Text style={styles.badgeText}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: "#07030a",
  },
  loginPage: {
    flex: 1,
    minHeight: 700,
    backgroundColor: "#07030a",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    overflow: "hidden",
  },
  glowA: {
    position: "absolute",
    width: 560,
    height: 560,
    borderRadius: 280,
    backgroundColor:
      "rgba(255, 22, 132, 0.13)",
    top: -220,
    right: -200,
  },
  glowB: {
    position: "absolute",
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor:
      "rgba(115, 36, 255, 0.12)",
    bottom: -220,
    left: -180,
  },
  loginCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#110915",
    borderWidth: 1,
    borderColor: "#2a1830",
    borderRadius: 28,
    padding: 28,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    color: "#fff",
    fontSize: 29,
    fontWeight: "900",
  },
  pink: {
    color: "#ff1684",
  },
  logoSub: {
    color: "#ff1684",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 3,
  },
  adminBadge: {
    backgroundColor: "#ff1684",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  adminBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  loginTitle: {
    color: "#fff",
    fontSize: 31,
    fontWeight: "900",
    marginTop: 38,
  },
  loginText: {
    color: "#9c8da5",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 24,
  },
  fieldLabel: {
    color: "#cbbfd2",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0b060d",
    borderWidth: 1,
    borderColor: "#302037",
    color: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
  },
  errorBox: {
    backgroundColor:
      "rgba(255, 71, 92, 0.09)",
    borderColor:
      "rgba(255, 71, 92, 0.35)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    color: "#ff7a8c",
    fontSize: 12,
    fontWeight: "700",
  },
  primary: {
    backgroundColor: "#ff1684",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 15,
  },
  primaryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  back: {
    paddingVertical: 15,
    alignItems: "center",
  },
  backText: {
    color: "#8f8198",
    fontSize: 11,
    fontWeight: "800",
  },
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 245,
    backgroundColor: "#0c0710",
    borderRightWidth: 1,
    borderRightColor: "#211526",
    padding: 25,
    zIndex: 2,
  },
  menu: {
    marginTop: 50,
    gap: 7,
  },
  menuButton: {
    minHeight: 48,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 12,
  },
  menuButtonMobile: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    gap: 2,
    minHeight: 58,
    paddingHorizontal: 4,
  },
  menuButtonActive: {
    backgroundColor:
      "rgba(255, 22, 132, 0.11)",
  },
  menuIcon: {
    color: "#726879",
    fontSize: 18,
    fontWeight: "900",
  },
  menuText: {
    color: "#8d8294",
    fontSize: 13,
    fontWeight: "800",
  },
  menuTextMobile: {
    fontSize: 9,
  },
  menuTextActive: {
    color: "#ff1684",
  },
  sidebarBottom: {
    position: "absolute",
    left: 25,
    right: 25,
    bottom: 25,
    gap: 20,
  },
  siteButton: {
    backgroundColor: "#18101c",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  siteButtonText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
  logoutText: {
    color: "#6e6374",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  mobileNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 68,
    backgroundColor: "#0c0710",
    borderTopWidth: 1,
    borderTopColor: "#28182e",
    flexDirection: "row",
    zIndex: 10,
    paddingHorizontal: 5,
  },
  content: {
    flex: 1,
    marginLeft: 245,
  },
  contentInner: {
    width: "100%",
    maxWidth: 1440,
    alignSelf: "center",
    padding: 30,
    paddingBottom: 100,
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginBottom: 30,
  },
  eyebrow: {
    color: "#ff1684",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2.2,
  },
  pageTitle: {
    color: "#fff",
    fontSize: 33,
    fontWeight: "900",
    marginTop: 4,
  },
  pageSubtitle: {
    color: "#776c7d",
    fontSize: 12,
    marginTop: 4,
  },
  refreshButton: {
    minWidth: 105,
    backgroundColor: "#130c16",
    borderWidth: 1,
    borderColor: "#2a1a30",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  refreshText: {
    color: "#ff1684",
    fontSize: 9,
    fontWeight: "900",
  },
  liveBanner: {
    backgroundColor:
      "rgba(24, 201, 110, 0.07)",
    borderWidth: 1,
    borderColor:
      "rgba(24, 201, 110, 0.25)",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#18c96e",
    marginRight: 14,
  },
  liveLabel: {
    color: "#88a994",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  liveNumber: {
    color: "#36e783",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
  },
  liveHint: {
    color: "#577261",
    fontSize: 10,
  },
  cards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 13,
    marginBottom: 18,
  },
  metric: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 165,
    backgroundColor: "#100a13",
    borderWidth: 1,
    borderColor: "#241729",
    borderRadius: 18,
    padding: 17,
  },
  metricTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricIcon: {
    fontSize: 20,
  },
  metricSpark: {
    width: 28,
    height: 3,
    borderRadius: 3,
    backgroundColor:
      "rgba(255, 22, 132, 0.55)",
  },
  metricLabel: {
    color: "#8c8093",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 18,
  },
  metricValue: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 3,
  },
  metricSub: {
    color: "#5f5664",
    fontSize: 9,
    marginTop: 4,
  },
  twoColumns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
  },
  panel: {
    flexGrow: 1,
    flexBasis: 430,
    backgroundColor: "#100a13",
    borderWidth: 1,
    borderColor: "#241729",
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
  },
  panelTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  panelSubtitle: {
    color: "#706576",
    fontSize: 10,
    marginTop: 3,
  },
  panelBody: {
    marginTop: 20,
  },
  chart: {
    height: 185,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 7,
    paddingTop: 15,
  },
  chartColumn: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  chartValue: {
    color: "#8e8196",
    fontSize: 8,
    marginBottom: 5,
    maxWidth: "100%",
  },
  chartBar: {
    width: "65%",
    maxWidth: 48,
    minHeight: 5,
    borderRadius: 6,
    backgroundColor: "#ff1684",
  },
  chartLabel: {
    color: "#6e6374",
    fontSize: 8,
    marginTop: 7,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#1c121f",
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bgGreen: { backgroundColor: "#18c96e" },
  bgYellow: { backgroundColor: "#f2b84b" },
  bgRed: { backgroundColor: "#ff5068" },
  bgPink: { backgroundColor: "#ff1684" },
  bgMuted: { backgroundColor: "#655a6b" },
  statusLabel: {
    color: "#a99fac",
    fontSize: 11,
  },
  statusValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  validatorButton: {
    backgroundColor: "#ff1684",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 17,
  },
  validatorButtonText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
  searchInput: {
    backgroundColor: "#0a060c",
    color: "#fff",
    borderWidth: 1,
    borderColor: "#281a2e",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 12,
  },
  filterRow: {
    gap: 7,
    marginTop: 10,
    paddingBottom: 3,
  },
  filterPill: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#18101b",
  },
  filterPillActive: {
    backgroundColor: "#ff1684",
  },
  filterText: {
    color: "#887d8e",
    fontSize: 9,
    fontWeight: "900",
  },
  filterTextActive: {
    color: "#fff",
  },
  purchaseList: {
    gap: 10,
    marginTop: 12,
  },
  purchaseCard: {
    backgroundColor: "#0a060c",
    borderWidth: 1,
    borderColor: "#211526",
    borderRadius: 15,
    padding: 15,
  },
  purchaseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  purchaseName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  purchaseCode: {
    color: "#ff1684",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
  },
  purchaseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 13,
  },
  info: {
    flexGrow: 1,
    flexBasis: 130,
    minWidth: 110,
  },
  infoLabel: {
    color: "#665b6c",
    fontSize: 8,
    fontWeight: "900",
  },
  infoValue: {
    color: "#bcb1c1",
    fontSize: 10,
    marginTop: 3,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeGreen: {
    backgroundColor:
      "rgba(24,201,110,0.14)",
  },
  badgePurple: {
    backgroundColor:
      "rgba(154,94,255,0.17)",
  },
  badgeYellow: {
    backgroundColor:
      "rgba(242,184,75,0.14)",
  },
  badgeRed: {
    backgroundColor:
      "rgba(255,80,104,0.14)",
  },
  badgeMuted: {
    backgroundColor:
      "rgba(120,110,125,0.14)",
  },
  badgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 14,
  },
  actionButton: {
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  actionGreen: {
    backgroundColor: "#168a50",
  },
  actionYellow: {
    backgroundColor: "#e4b246",
  },
  actionRed: {
    backgroundColor: "#a72d44",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
  },
  actionButtonTextDark: {
    color: "#261b05",
    fontSize: 8,
    fontWeight: "900",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 35,
  },
  emptyIcon: {
    fontSize: 30,
  },
  emptyTitle: {
    color: "#7f7386",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },
  infoNotice: {
    backgroundColor:
      "rgba(255,22,132,0.06)",
    borderColor:
      "rgba(255,22,132,0.17)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 17,
  },
  infoNoticeTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  infoNoticeText: {
    color: "#928698",
    fontSize: 10,
    lineHeight: 17,
    marginTop: 7,
  },
});

if (
  typeof styles.content === "object" &&
  Platform.OS === "web"
) {
  // No-op: mantém o arquivo compatível com Expo Web.
}