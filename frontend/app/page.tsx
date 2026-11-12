"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon, ArrowRight, BarChart3, BriefcaseBusiness, Check,
  CircleDollarSign, FileText, Home, Network as NetworkIcon, Radio, RefreshCw,
  Rocket, Settings, ShieldAlert, ShieldCheck, Wallet, X,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ---------------- helpers ---------------- */

const money = (cents: number | undefined, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" })
    .format((cents || 0) / 100);

async function call(path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({ detail: "Unexpected server response" }));
  if (!res.ok) throw new Error(json.detail || `Request failed (${res.status})`);
  return json;
}

/* ---------------- types ---------------- */

interface DashData {
  demo_mode: boolean;
  activated: boolean;
  setup_complete: boolean;
  network_status: string;
  instances: number;
  revenue_cents: number;
  expenses_cents: number;
  net_profit_cents: number;
  currency: string;
  owner_name: string;
  destination_masked: string;
  activities: ActivityItem[];
  opportunities: Opportunity[];
}

interface ActivityItem {
  id: number;
  event: string;
  status: string;
  instance_id: string | null;
  details: string;
  created: string;
}

interface Opportunity {
  id: string;
  title: string;
  category: string;
  rationale: string;
  status: string;
  cost_cents: number;
  created: string;
}

interface Instance {
  id: string;
  generation: number;
  parent: string | null;
  name: string;
  status: string;
  threshold_cents: number;
  used_cents: number;
  created: string;
}

interface NetworkData {
  instances: Instance[];
  businesses: unknown[];
  emergency_stop: boolean;
}

interface Txn {
  id: string;
  instance_id: string | null;
  type: string;
  amount_cents: number;
  currency: string;
  status: string;
  created: string;
}

const NAV = [
  { label: "Dashboard", Icon: Home },
  { label: "Network", Icon: NetworkIcon },
  { label: "Businesses", Icon: BriefcaseBusiness },
  { label: "Earnings", Icon: CircleDollarSign },
  { label: "Activity Log", Icon: ActivityIcon },
  { label: "Settings", Icon: Settings },
  { label: "About", Icon: FileText },
] as const;

type Page = (typeof NAV)[number]["label"];

/* ---------------- shell pieces ---------------- */

function BrandMark() {
  return (
    <div className="brandmark" aria-hidden="true">
      <CircleDollarSign size={22} />
    </div>
  );
}

function HeroArt() {
  return (
    <div className="heroArt" aria-hidden="true">
      <svg viewBox="0 0 360 240" fill="none">
        <defs>
          <radialGradient id="pearl">
            <stop stopColor="#fff" />
            <stop offset="0.42" stopColor="#b5faff" />
            <stop offset="1" stopColor="#58a9ff" />
          </radialGradient>
          <linearGradient id="shell" x1="40" y1="50" x2="250" y2="220">
            <stop stopColor="#cb70ff" />
            <stop offset="0.52" stopColor="#5346f8" />
            <stop offset="1" stopColor="#00d9ff" />
          </linearGradient>
        </defs>
        <circle cx="185" cy="124" r="86" fill="#712dff" opacity="0.14" />
        <path d="M55 166c17-54 48-84 98-88-13 25-12 58 6 96-36 24-70 23-104-8Z" fill="url(#shell)" />
        <path d="M259 166c-17-54-48-84-98-88 13 25 12 58-6 96 36 24 70 23 104-8Z" fill="url(#shell)" />
        <path d="M83 151c21-35 44-53 70-57M105 171c20-31 37-49 54-61m117 41c-21-35-44-53-70-57m48 77c-20-31-37-49-54-61" stroke="#d5d5ff" strokeOpacity="0.65" strokeWidth="2" />
        <circle cx="157" cy="130" r="25" fill="url(#pearl)" />
        <circle cx="148" cy="121" r="6" fill="white" opacity="0.85" />
        <circle className="particle" cx="93" cy="35" r="2" fill="#a9f7ff" />
        <circle className="particle" cx="284" cy="92" r="2" fill="#d6a1ff" />
      </svg>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls = status.includes("paused")
    ? "red"
    : status.includes("ready") || status.includes("initialis")
      ? "amber"
      : "";
  return <i className={`statusdot ${cls}`} />;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <div className="activityItem">
      <div className="activityIcon"><ActivityIcon size={14} /></div>
      <div>
        <p>{item.event}</p>
        <small>{item.instance_id || "System"} · {item.created} · {item.status}</small>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone || ""}>{value}</strong>
    </div>
  );
}

/* ---------------- main page ---------------- */

export default function Page() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [data, setData] = useState<DashData | null>(null);
  const [network, setNetwork] = useState<NetworkData | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [acts, setActs] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [showLaunch, setShowLaunch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    owner_name: "", destination_type: "crypto", destination: "", currency: "USD",
    provider: "manual reference",
  });

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 4200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const d = await call("/api/dashboard") as DashData;
      setData(d);
      setNetwork(await call("/api/network") as NetworkData);
      const e = await call("/api/earnings") as { transactions: Txn[] };
      setTxns(e.transactions || []);
      const a = await call("/api/activity") as { items: ActivityItem[] };
      setActs(a.items || []);
      setOffline(false);
    } catch (err) {
      setOffline(true);
      notify(`API not connected: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 15000);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => window.clearInterval(id);
  }, [refresh]);

  const act = useCallback(async (path: string, body: unknown, msg: string) => {
    setBusy(true);
    try {
      await call(path, body);
      notify(msg);
      await refresh();
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [notify, refresh]);

  /* chart data: real daily sums from the verified ledger */
  const chartData = useMemo(() => {
    const days: { key: string; label: string; revenue: number; expenses: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: d.toLocaleDateString("en-US", { weekday: "short" }), revenue: 0, expenses: 0 });
    }
    const map = new Map(days.map((d) => [d.key, d]));
    for (const t of txns) {
      const key = (t.created || "").slice(0, 10);
      const bucket = map.get(key);
      if (!bucket) continue;
      if (t.type === "revenue") bucket.revenue += t.amount_cents / 100;
      if (t.type === "expense") bucket.expenses += t.amount_cents / 100;
    }
    return days;
  }, [txns]);

  const saveSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await call("/api/setup", form) as { message: string };
      setShowSetup(false);
      notify(res.message);
      await refresh();
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const launch = async () => {
    setBusy(true);
    try {
      await call("/api/activate", { acknowledged: true, accepts_no_guarantees: true });
      setShowLaunch(false);
      notify("Monitoring network initialized. No external operations started.");
      await refresh();
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const status = data?.network_status || "ready to launch";

  /* ---------------- pages ---------------- */

  const DashboardPage = (
    <>
      <section className="hero">
        <div className="heroCopy">
          <div className="eyebrow">YOUR GROWTH NETWORK</div>
          <h2>AUTONOMOUS<br />AI NETWORK</h2>
          <p>Set it once. Let it grow — responsibly.</p>
          <button className="smallbutton" onClick={() => setPage("Network")}>
            Explore network <ArrowRight size={13} style={{ verticalAlign: "middle" }} />
          </button>
        </div>
        <HeroArt />
      </section>

      <div className="sectionTitle">Initial setup <small>{data?.setup_complete ? "Destination configured" : "Complete before activation"}</small></div>
      <div className="grid2">
        <div className="card">
          <div className="setupRow">
            <div className="stepIcon"><Wallet size={17} /></div>
            <div>
              <strong>Owner payout destination</strong>
              <p>{data?.setup_complete ? `Saved · ${data.destination_masked}` : "Add a public destination reference; no withdrawal access"}</p>
            </div>
            <button className="smallbutton" onClick={() => setShowSetup(true)}>
              {data?.setup_complete ? "Edit" : "Configure"}
            </button>
          </div>
        </div>
        <div className="card">
          <div className="setupRow">
            <div className="stepIcon"><ShieldCheck size={17} /></div>
            <div>
              <strong>Safety &amp; permissions</strong>
              <p>Proposal-only demo · external actions disabled · no credentials stored</p>
            </div>
            <span className="pillstatus">Protected</span>
          </div>
        </div>
      </div>

      {!data?.activated ? (
        <>
          <div className="sectionTitle">Ready when you are <small>Manual confirmation required</small></div>
          <div className="card launchCard">
            <p>Activate the autonomous growth loop.</p>
            <button className="launchbutton" disabled={!data?.setup_complete || busy} onClick={() => setShowLaunch(true)}>
              <Rocket size={17} style={{ verticalAlign: "middle", marginRight: 11 }} /> LAUNCH
              <ArrowRight size={16} style={{ verticalAlign: "middle", marginLeft: 12 }} />
            </button>
            <div className="warning">
              <ShieldAlert size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Once activated, the ecosystem operates within its approved permissions in this demo:
              monitoring and proposal generation only. Profits are not guaranteed, and this build
              does not deploy businesses or move money.
            </div>
            {!data?.setup_complete && (
              <p style={{ margin: "13px 0 0", color: "#ffcf80" }}>
                Configure a payout destination reference to enable launch.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="sectionTitle">Network controls <small>Monitoring first · external actions disabled</small></div>
          <div className="grid2">
            <div className="card">
              <h3>Opportunity research</h3>
              <p className="muted">Create a small set of zero-cost proposal records for owner review.</p>
              <button className="primary" disabled={busy} onClick={() => act("/api/opportunities/discover", {}, "Proposal research complete.")}>
                Discover opportunities
              </button>
            </div>
            <div className="card">
              <h3>Verified finances</h3>
              <p className="muted">No payment provider is connected. Revenue stays $0.00 until independently verified records exist.</p>
              <button className="ghost" onClick={() => setPage("Earnings")}>
                Open earnings ledger <ArrowRight size={13} style={{ verticalAlign: "middle" }} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );

  const NetworkPage = (
    <>
      <div className="pagehead">
        <div>
          <h2>Network</h2>
          <p>Instance lineage and independently tracked operating records.</p>
        </div>
        <span className="pillstatus">{data?.instances || 0} instances</span>
      </div>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3><ShieldAlert size={16} style={{ verticalAlign: "middle", marginRight: 7 }} />Emergency safety control</h3>
          <p className="muted">Owner-controlled stop blocks activation, discovery, and multiplication.</p>
        </div>
        <button
          className={network?.emergency_stop ? "primary" : "ghost"}
          disabled={busy}
          onClick={() => act("/api/safety-stop", { enabled: !network?.emergency_stop, reason: "Owner safety control" }, "Safety setting updated.")}
        >
          {network?.emergency_stop ? "Clear stop" : "Pause system"}
        </button>
      </div>
      {(network?.instances || []).map((i) => (
        <div className="card" key={i.id} style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <h3><NetworkIcon size={15} style={{ verticalAlign: "middle", marginRight: 7, color: "#b18aff" }} />{i.name}</h3>
              <p className="muted">{i.id} · Generation {i.generation} · Parent: {i.parent || "Root"} · {i.status}</p>
            </div>
            <span className="pillstatus">{i.status}</span>
          </div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <Metric label="Verified net available" value={money(0)} />
            <Metric label={`Generation ${i.generation + 1} threshold`} value={money(i.threshold_cents + 100)} />
          </div>
        </div>
      ))}
      {!network?.instances?.length && (
        <div className="card empty" style={{ marginTop: 14 }}>
          No instances yet. Complete setup and launch to initialize the root monitoring instance.
        </div>
      )}
      <p className="subtext" style={{ marginTop: 14 }}>
        Child instances require verified, uncommitted net earnings. No balance is simulated or spendable in this demo.
      </p>
    </>
  );

  const BusinessesPage = (
    <>
      <div className="pagehead">
        <div>
          <h2>Businesses</h2>
          <p>Legitimate opportunity proposals and lifecycle monitoring.</p>
        </div>
        <span className="pillstatus">{(data?.opportunities || []).length} proposals</span>
      </div>
      {(data?.opportunities || []).map((o) => (
        <div className="card" key={o.id} style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h3>{o.title}</h3>
            <span className="pillstatus">Research proposal</span>
          </div>
          <p className="muted">{o.category.replaceAll("_", " ")} · estimated upfront cost {money(o.cost_cents)}</p>
          <p style={{ fontSize: 12, color: "#bdc8ed", lineHeight: 1.55 }}>{o.rationale}</p>
          <small className="subtext">Not launched. Review feasibility, demand, ownership, and platform terms before any implementation.</small>
        </div>
      ))}
      {!(data?.opportunities || []).length && (
        <div className="card empty">No proposals yet. Opportunity research is available after activation.</div>
      )}
    </>
  );

  const EarningsPage = (
    <>
      <div className="pagehead">
        <div>
          <h2>Earnings</h2>
          <p>Verified ledger totals only. Unconfirmed sales never count as collected money.</p>
        </div>
        <span className="pillstatus">{data?.currency || "USD"}</span>
      </div>
      <div className="grid2">
        {[
          ["Gross revenue", data?.revenue_cents, ""],
          ["Operating expenses", data?.expenses_cents, ""],
          ["Net profit", data?.net_profit_cents, (data?.net_profit_cents || 0) >= 0 ? "successText" : "dangerText"],
          ["Pending confirmation", 0, ""],
        ].map(([label, cents, tone]) => (
          <div className="card" key={label as string}>
            <span className="muted">{label as string}</span>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 10, fontVariantNumeric: "tabular-nums" }} className={tone as string}>
              {money(cents as number, data?.currency)}
            </div>
            <small className="subtext">Verified ledger value</small>
          </div>
        ))}
      </div>
      <div className="sectionTitle">Revenue — last 7 days <small>· computed from verified transactions</small></div>
      <div className="card">
        <div className="chartbox" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d9ff" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#00d9ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#252d58" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#7885b7", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#10152e", border: "1px solid #252d58", borderRadius: 8 }} />
              <Area type="monotone" dataKey="revenue" stroke="#00d9ff" fill="url(#rev)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" stroke="#a020f0" fill="transparent" strokeWidth={1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="sectionTitle">Transaction history</div>
      <div className="card tablewrap">
        <table>
          <thead>
            <tr><th>Timestamp</th><th>Type</th><th>Instance</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {txns.length ? txns.map((t) => (
              <tr key={t.id}>
                <td>{t.created}</td><td>{t.type}</td><td>{t.instance_id || "—"}</td>
                <td>{money(t.amount_cents, t.currency)}</td><td>{t.status}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="empty">No transactions recorded. This is a real zero, not simulated revenue.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="warning">
        No payouts, reinvestments, or payment integrations are enabled. Destination configuration
        does not grant wallet or bank access.
      </div>
    </>
  );

  const ActivityPage = (
    <>
      <div className="pagehead">
        <div>
          <h2>Activity Log</h2>
          <p>Timestamped records of system actions and safety events.</p>
        </div>
        <button className="ghost" onClick={refresh}><RefreshCw size={14} /> Refresh</button>
      </div>
      <div className="card activity">
        {acts.length ? acts.map((a) => <ActivityRow key={a.id} item={a} />) : (
          <div className="empty">No actions have been logged.</div>
        )}
      </div>
    </>
  );

  const SettingsPage = (
    <>
      <div className="pagehead">
        <div>
          <h2>Settings</h2>
          <p>Configuration and safety boundaries.</p>
        </div>
      </div>
      <div className="card">
        <h3><Wallet size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />Payout destination</h3>
        <p className="muted">{data?.setup_complete ? `${data.owner_name} · ${data.destination_masked}` : "Not configured"}</p>
        <button className="ghost" onClick={() => setShowSetup(true)}>Configure destination</button>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3><BarChart3 size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />AI provider</h3>
        <p className="muted">No AI provider is connected. Local deterministic proposal rules are active. Paid APIs are disabled.</p>
        <span className="pillstatus">Provider-independent adapter: not connected</span>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3><ShieldCheck size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />Security &amp; permissions</h3>
        <p className="muted">No secret keys accepted · no external actions · no wallet withdrawal permission.</p>
        <button
          className={network?.emergency_stop ? "primary" : "ghost"}
          disabled={busy}
          onClick={() => act("/api/safety-stop", { enabled: !network?.emergency_stop, reason: "Owner safety control" }, "Safety setting updated.")}
        >
          {network?.emergency_stop ? "Clear emergency stop" : "Enable emergency stop"}
        </button>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3>System information</h3>
        <p className="muted">OYSTER AI v0.1 foundation · {data?.demo_mode ? "Demo mode" : "Guarded mode"} · API-connected</p>
      </div>
    </>
  );

  const AboutPage = (
    <>
      <div className="pagehead">
        <div>
          <h2>About OYSTER AI</h2>
          <p>Your Self-Growing AI Business Ecosystem · Build. Grow. Earn.</p>
        </div>
      </div>
      <div className="card">
        <h3>Set it once. Let it grow — responsibly.</h3>
        <p style={{ color: "#b8c4eb", lineHeight: 1.7 }}>
          OYSTER AI is a safety-first foundation for researching and monitoring legitimate online
          business opportunities. This build is honest about its limits: it can save setup,
          activate a monitoring record, generate logged opportunity proposals, and enforce an
          earnings-threshold multiplication policy. It cannot launch a real business, collect
          payments, guarantee income, or autonomously move funds.
        </p>
        <p className="muted">
          Every financial value on this screen comes from the local ledger. An empty ledger means
          $0.00 — never simulated earnings dressed up as real ones.
        </p>
      </div>
    </>
  );

  const content =
    page === "Network" ? NetworkPage
    : page === "Businesses" ? BusinessesPage
    : page === "Earnings" ? EarningsPage
    : page === "Activity Log" ? ActivityPage
    : page === "Settings" ? SettingsPage
    : page === "About" ? AboutPage
    : DashboardPage;

  /* ---------------- render ---------------- */

  return (
    <div>
      <div className="layout">
        {/* desktop sidebar */}
        <aside className="left">
          <div className="brand">
            <BrandMark />
            <div>
              <strong>OYSTER AI</strong>
              <small>Autonomous Growth Network</small>
            </div>
          </div>
          <div className="navlabel">WORKSPACE</div>
          <nav className="nav">
            {NAV.map(({ label, Icon }) => (
              <button key={label} className={page === label ? "active" : ""} onClick={() => setPage(label)}>
                <Icon size={17} />{label}
              </button>
            ))}
          </nav>
          <div className="sidebottom">
            <div className="system">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                <strong style={{ fontSize: 11 }}>System Status</strong>
                <Radio size={15} color="#00e879" />
              </div>
              <div><StatusDot status={status} />{data?.activated ? "Active" : "Ready to Launch"}</div>
              <small style={{ display: "block", marginTop: 8, color: "var(--sub)" }}>All systems online · demo-safe</small>
            </div>
            <div className="brandline">BUILD. &nbsp;GROW. &nbsp;EARN.</div>
          </div>
        </aside>

        {/* main column */}
        <main className="main">
          {/* mobile header */}
          <div className="mobileHeader">
            <div className="brand">
              <BrandMark />
              <div>
                <strong>OYSTER AI</strong>
                <small>Build. Grow. Earn.</small>
              </div>
            </div>
            <span className="pill"><StatusDot status={status} />{data?.activated ? "Active" : "Ready"}</span>
          </div>

          <div className="topbar">
            <div>
              <h1>OYSTER AI <span style={{ color: "#7885b7", fontWeight: 400 }}>v1.0</span></h1>
              <p>Your Self-Growing AI Business Ecosystem</p>
            </div>
            <span className="pill"><StatusDot status={status} />{data?.demo_mode ? "Demo Mode" : "System"}</span>
          </div>

          {offline && (
            <div className="warning bad" style={{ marginBottom: 14 }}>
              Cannot reach the API at {API}. Start the backend (uvicorn) and refresh.
            </div>
          )}
          {loading ? <div className="card empty">Connecting to the Oyster API…</div> : content}

          {/* mobile: right-rail summary inline after content */}
          <div className="mobileHeader" style={{ display: "none" }} />
        </main>

        {/* desktop right rail */}
        <aside className="right">
          <h2>Network Overview</h2>
          <div className="card">
            <Metric label="Status" value={status} tone={status === "active" ? "successText" : status.includes("paused") ? "dangerText" : "warnText"} />
            <Metric label="Total instances" value={String(data?.instances || 0)} />
            <Metric label="Verified revenue" value={money(data?.revenue_cents, data?.currency)} />
            <Metric label="Net profit" value={money(data?.net_profit_cents, data?.currency)} />
          </div>
          <h2 className="railGap">Earnings Overview <small style={{ color: "var(--sub)", fontWeight: 400 }}>· 7D</small></h2>
          <div className="card">
            <div className="chartbox" style={{ height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00d9ff" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#00d9ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#252d58" strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#7885b7", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: "#10152e", border: "1px solid #252d58", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#00d9ff" fill="url(#rev2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="subtext" style={{ marginTop: 10 }}>
              Zero verified earnings is real data — the ledger is empty until a verified payment integration exists.
            </p>
          </div>
          <h2 className="railGap">Recent Activity</h2>
          <div className="activity">
            {(data?.activities || []).slice(0, 5).map((a) => <ActivityRow key={a.id} item={a} />)}
            {!(data?.activities || []).length && <p className="subtext">No activity recorded yet.</p>}
          </div>
        </aside>
      </div>

      {/* mobile bottom nav */}
      <nav className="bottomnav">
        {[
          { label: "Home", Icon: Home, page: "Dashboard" as Page },
          { label: "Network", Icon: NetworkIcon, page: "Network" as Page },
          { label: "Business", Icon: BriefcaseBusiness, page: "Businesses" as Page },
          { label: "Earnings", Icon: CircleDollarSign, page: "Earnings" as Page },
          { label: "More", Icon: Settings, page: (["Settings", "Activity Log", "About"] as Page[]).includes(page) ? page : "Settings" },
        ].map(({ label, Icon, page: target }) => {
          const active = target === page || (label === "More" && (["Settings", "Activity Log", "About"] as Page[]).includes(page));
          return (
            <button key={label} className={active ? "active" : ""} onClick={() => setPage(target as Page)}>
              <Icon size={18} /><span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* setup modal */}
      {showSetup && (
        <div className="overlay" role="dialog" aria-modal="true">
          <form className="modal" onSubmit={saveSetup}>
            <button type="button" className="ghost" style={{ float: "right", padding: 7 }} onClick={() => setShowSetup(false)} aria-label="Close">
              <X size={15} />
            </button>
            <h2>Configure payout destination</h2>
            <p>Destination reference only. Never enter seed phrases, private keys, bank passwords, or card PINs. This demo cannot initiate a payout.</p>
            <div className="formgrid">
              <div className="field">
                <label>Owner / business name</label>
                <input required maxLength={100} value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Your name or business" />
              </div>
              <div className="field">
                <label>Destination type</label>
                <select value={form.destination_type} onChange={(e) => setForm({ ...form, destination_type: e.target.value })}>
                  <option value="crypto">Public crypto wallet</option>
                  <option value="bank">Bank / payout reference</option>
                  <option value="provider">Approved payment provider</option>
                </select>
              </div>
              <div className="field span2">
                <label>Public address or provider reference</label>
                <input required minLength={4} maxLength={180} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder={form.destination_type === "crypto" ? "Public wallet address only" : "Provider reference (no login credentials)"} />
                <small className="subtext">Stored as a reference. Grants no spending or withdrawal permission.</small>
              </div>
              <div className="field">
                <label>Currency</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option>USD</option><option>EUR</option><option>GBP</option><option>INR</option>
                </select>
              </div>
              <div className="field">
                <label>Payout provider</label>
                <input maxLength={80} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
              </div>
            </div>
            <div className="modalActions">
              <button type="button" className="ghost" onClick={() => setShowSetup(false)}>Cancel</button>
              <button className="primary" disabled={busy}>{busy ? "Saving…" : "Save destination"}</button>
            </div>
          </form>
        </div>
      )}

      {/* launch confirmation modal */}
      {showLaunch && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>Confirm network activation</h2>
            <p>This creates a local root-instance monitoring record. It does not deploy a business, call an AI provider, spend money, or initiate payouts.</p>
            <div className="warning">
              Profits are not guaranteed. This demo has no verified revenue source; all balances remain zero until a secure, audited payment integration is added and reconciled.
            </div>
            <p><strong>Financial permissions:</strong> the destination is reference-only. No private keys, withdrawal permission, or payment credentials are used. External actions stay disabled.</p>
            <p><strong>Safety:</strong> you can pause everything at any time with the emergency safety control on the Network page.</p>
            <div className="modalActions">
              <button className="ghost" onClick={() => setShowLaunch(false)}>Not now</button>
              <button className="primary" disabled={busy} onClick={launch}>
                <Check size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                {busy ? "Initializing…" : "Confirm & initialize"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status" onClick={() => setToast("")}>{toast}</div>}
    </div>
  );
}