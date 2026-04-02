import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { PinMap } from "./components/PinMap";
import {
  exportCsv,
  fetchLeadsFilter,
  fetchMetadataByPincode,
  fetchPortfolio,
  fetchRecommendation,
  login,
  setAuthToken,
} from "./api";
import type {
  EmploymentType,
  GeoPin,
  LeadRow,
  PincodeMetadata,
  PortfolioSummary,
  ProductType,
  RecommendationResponse,
} from "./types";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const PRODUCT_TYPES: ProductType[] = [
  "home_loan",
  "business_loan",
  "personal_loan",
  "auto_loan",
  "education_loan",
  "gold_loan",
];

const EMPLOYMENT_TYPES: EmploymentType[] = [
  "salaried",
  "self_employed",
  "student",
  "retired",
  "homemaker",
];

async function loadGeo(): Promise<GeoPin[]> {
  const res = await fetch("/data/pincodes_geo.json");
  const j = await res.json();
  return j.pincodes as GeoPin[];
}

export default function App() {
  const [geo, setGeo] = useState<GeoPin[]>([]);
  const [metadata, setMetadata] = useState<PincodeMetadata[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rec, setRec] = useState<RecommendationResponse | null>(null);
  const [recLoading, setRecLoading] = useState(false);

  const [productFilter, setProductFilter] = useState<ProductType[]>([]);
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentType[]>([]);
  const [minLoan, setMinLoan] = useState("");
  const [maxLoan, setMaxLoan] = useState("");
  const [minInc, setMinInc] = useState("");
  const [maxInc, setMaxInc] = useState("");

  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const metaByPin = useMemo(() => {
    const m = new Map<string, PincodeMetadata>();
    metadata.forEach((x) => m.set(x.pincode, x));
    return m;
  }, [metadata]);

  const reloadCore = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [meta, port, g] = await Promise.all([
        fetchMetadataByPincode(),
        fetchPortfolio(),
        loadGeo(),
      ]);
      setMetadata(meta);
      setPortfolio(port);
      setGeo(g);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadCore();
  }, [reloadCore]);

  const applyFilters = useCallback(
    async (pin: string | null, p: number) => {
      const body: Record<string, unknown> = {
        page: p,
        page_size: 25,
      };
      if (pin) body.pincode = pin;
      if (productFilter.length) body.product_types = productFilter;
      if (employmentFilter.length) body.employment_types = employmentFilter;
      if (minLoan) body.min_loan_amount = minLoan;
      if (maxLoan) body.max_loan_amount = maxLoan;
      if (minInc) body.min_monthly_income = minInc;
      if (maxInc) body.max_monthly_income = maxInc;
      const data = await fetchLeadsFilter(body);
      setLeads(data.items);
      setLeadTotal(data.total);
      setPage(data.page);
    },
    [productFilter, employmentFilter, minLoan, maxLoan, minInc, maxInc],
  );

  useEffect(() => {
    if (loading || err) return;
    applyFilters(selected, 1).catch((e) => setErr(String(e)));
    // Refetch when pincode selection changes; filters are applied via the Apply button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, loading, err]);

  useEffect(() => {
    if (!selected) {
      setRec(null);
      return;
    }
    setRecLoading(true);
    fetchRecommendation(selected)
      .then(setRec)
      .catch(() => setRec(null))
      .finally(() => setRecLoading(false));
  }, [selected]);

  const onExport = async () => {
    const body: Record<string, unknown> = { page: 1, page_size: 500 };
    if (selected) body.pincode = selected;
    if (productFilter.length) body.product_types = productFilter;
    if (employmentFilter.length) body.employment_types = employmentFilter;
    if (minLoan) body.min_loan_amount = minLoan;
    if (maxLoan) body.max_loan_amount = maxLoan;
    if (minInc) body.min_monthly_income = minInc;
    if (maxInc) body.max_monthly_income = maxInc;
    const blob = await exportCsv(body);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const t = await login(authUser, authPass);
      setToken(t);
      setAuthToken(t);
    } catch {
      setErr("Login failed (demo: admin / admin123)");
    }
  };

  const doughnutData = portfolio
    ? {
        labels: portfolio.by_product_type.map((x) => x.product_type.replace(/_/g, " ")),
        datasets: [
          {
            data: portfolio.by_product_type.map((x) => x.count),
            backgroundColor: [
              "#3b82f6",
              "#8b5cf6",
              "#ec4899",
              "#f97316",
              "#14b8a6",
              "#eab308",
            ],
            borderWidth: 0,
          },
        ],
      }
    : null;

  const empBarData = portfolio
    ? {
        labels: portfolio.by_employment_type.map((x) => x.employment_type.replace(/_/g, " ")),
        datasets: [
          {
            label: "Leads",
            data: portfolio.by_employment_type.map((x) => x.count),
            backgroundColor: "#38bdf8aa",
            borderRadius: 6,
          },
        ],
      }
    : null;

  const incomeBarData = portfolio
    ? {
        labels: portfolio.by_income_band.map((x) => x.band),
        datasets: [
          {
            label: "Count",
            data: portfolio.by_income_band.map((x) => x.count),
            backgroundColor: "#a78bfaaa",
            borderRadius: 6,
          },
        ],
      }
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet" />
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          background: "linear-gradient(180deg, #111827 0%, #0c1118 100%)",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700 }}>Lead Lens</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Pincode analytics, portfolio view, and cross-sell signals
          </p>
        </div>
        <form
          onSubmit={onLogin}
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
        >
          <span style={{ fontSize: 13, color: "var(--muted)" }}>JWT (optional)</span>
          <input
            placeholder="user"
            value={authUser}
            onChange={(e) => setAuthUser(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="password"
            value={authPass}
            onChange={(e) => setAuthPass(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" style={btnStyle}>
            Get token
          </button>
          {token && <span style={{ fontSize: 12, color: "var(--success)" }}>Signed in</span>}
        </form>
      </header>

      {err && (
        <div style={{ padding: "12px 24px", background: "#450a0a", color: "#fecaca", fontSize: 14 }}>
          {err} — start Postgres/Redis, run <code>db/init.sql</code>, seed, then API on :8000.
        </div>
      )}

      <main
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: 16,
          padding: 16,
          maxWidth: 1800,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <section style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 520 }}>
          <div style={{ flex: 1, minHeight: 440, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 24, color: "var(--muted)" }}>Loading map…</div>
            ) : (
              <PinMap geo={geo} metaByPin={metaByPin} selected={selected} onSelect={setSelected} />
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <div style={panelStyle}>
              <h3 style={h3}>Portfolio — product mix</h3>
              {doughnutData && (
                <div style={{ maxHeight: 220 }}>
                  <Doughnut
                    data={doughnutData}
                    options={{
                      plugins: { legend: { position: "bottom", labels: { color: "#cbd5e1", font: { size: 11 } } } },
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              )}
            </div>
            <div style={panelStyle}>
              <h3 style={h3}>Employment</h3>
              {empBarData && (
                <Bar
                  data={empBarData}
                  options={{
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { ticks: { color: "#94a3b8", maxRotation: 45, minRotation: 0 } },
                      y: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
                    },
                  }}
                />
              )}
            </div>
            <div style={panelStyle}>
              <h3 style={h3}>Income bands (monthly)</h3>
              {incomeBarData && (
                <Bar
                  data={incomeBarData}
                  options={{
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { ticks: { color: "#94a3b8" } },
                      y: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
                    },
                  }}
                />
              )}
            </div>
          </div>
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={panelStyle}>
            <h3 style={h3}>Filters</h3>
            <label style={lab}>Product types</label>
            <select
              multiple
              value={productFilter}
              onChange={(e) =>
                setProductFilter(Array.from(e.target.selectedOptions, (o) => o.value as ProductType))
              }
              style={{ ...inputStyle, minHeight: 100, width: "100%" }}
            >
              {PRODUCT_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <label style={lab}>Employment</label>
            <select
              multiple
              value={employmentFilter}
              onChange={(e) =>
                setEmploymentFilter(
                  Array.from(e.target.selectedOptions, (o) => o.value as EmploymentType),
                )
              }
              style={{ ...inputStyle, minHeight: 88, width: "100%" }}
            >
              {EMPLOYMENT_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={lab}>Min loan</label>
                <input style={inputStyle} value={minLoan} onChange={(e) => setMinLoan(e.target.value)} />
              </div>
              <div>
                <label style={lab}>Max loan</label>
                <input style={inputStyle} value={maxLoan} onChange={(e) => setMaxLoan(e.target.value)} />
              </div>
              <div>
                <label style={lab}>Min income</label>
                <input style={inputStyle} value={minInc} onChange={(e) => setMinInc(e.target.value)} />
              </div>
              <div>
                <label style={lab}>Max income</label>
                <input style={inputStyle} value={maxInc} onChange={(e) => setMaxInc(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={btnStyle}
                onClick={() => applyFilters(selected, 1).catch((e) => setErr(String(e)))}
              >
                Apply
              </button>
              <button
                type="button"
                style={{ ...btnStyle, background: "#334155" }}
                onClick={() => {
                  setProductFilter([]);
                  setEmploymentFilter([]);
                  setMinLoan("");
                  setMaxLoan("");
                  setMinInc("");
                  setMaxInc("");
                  fetchLeadsFilter({
                    page: 1,
                    page_size: 25,
                    ...(selected ? { pincode: selected } : {}),
                  })
                    .then((data) => {
                      setLeads(data.items);
                      setLeadTotal(data.total);
                      setPage(data.page);
                    })
                    .catch((e) => setErr(String(e)));
                }}
              >
                Clear
              </button>
              <button type="button" style={{ ...btnStyle, background: "#065f46" }} onClick={onExport}>
                Export CSV
              </button>
            </div>
            {portfolio && (
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
                Total leads in DB: <strong style={{ color: "var(--text)" }}>{portfolio.total_leads}</strong>
              </p>
            )}
          </div>

          <div style={panelStyle}>
            <h3 style={h3}>Selected pincode</h3>
            <p style={{ fontSize: 28, fontWeight: 700, margin: "4px 0" }}>{selected ?? "—"}</p>
            {selected && metaByPin.get(selected) && (
              <div style={{ fontSize: 13, color: "#94a3b8" }}>
                <div>
                  Median loan: ₹
                  {metaByPin.get(selected)!.median_loan_amount?.toLocaleString("en-IN", {
                    maximumFractionDigits: 0,
                  }) ?? "—"}
                </div>
                <div>
                  Median income: ₹
                  {metaByPin.get(selected)!.median_monthly_income?.toLocaleString("en-IN", {
                    maximumFractionDigits: 0,
                  }) ?? "—"}
                </div>
              </div>
            )}
          </div>

          <div style={{ ...panelStyle, flex: 1, minHeight: 200 }}>
            <h3 style={h3}>Cross-sell &amp; similar leads</h3>
            {recLoading && <p style={{ color: "var(--muted)" }}>Loading…</p>}
            {!recLoading && rec && rec.similar_leads.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: 14 }}>No similar leads found.</p>
            )}
            {!recLoading &&
              rec?.similar_leads.slice(0, 6).map((s) => (
                <div
                  key={s.id}
                  style={{
                    borderTop: "1px solid var(--border)",
                    padding: "10px 0",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <strong>{s.name}</strong> · {s.pincode} · score {s.similarity_score}
                  </div>
                  <div style={{ color: "#94a3b8" }}>
                    {s.product_type.replace(/_/g, " ")} · ₹{Number(s.loan_amount).toLocaleString("en-IN")}
                  </div>
                  {s.suggested_products?.length > 0 && (
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#cbd5e1" }}>
                      {s.suggested_products.map((sp) => (
                        <li key={sp.product_type}>
                          <strong>{sp.product_type.replace(/_/g, " ")}</strong> — {sp.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
          </div>
        </aside>
      </main>

      <section style={{ padding: "0 16px 24px", maxWidth: 1800, margin: "0 auto", width: "100%" }}>
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ ...h3, marginBottom: 0 }}>Leads {selected ? `(pincode ${selected})` : "(all filters)"}</h3>
            <span style={{ color: "var(--muted)", fontSize: 14 }}>
              {leadTotal} total · page {page}
            </span>
          </div>
          <div style={{ overflow: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                  <th style={th}>Name</th>
                  <th style={th}>Pincode</th>
                  <th style={th}>Product</th>
                  <th style={th}>Loan</th>
                  <th style={th}>Income / mo</th>
                  <th style={th}>Employment</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={td}>{row.name}</td>
                    <td style={td}>{row.pincode}</td>
                    <td style={td}>{row.product_type.replace(/_/g, " ")}</td>
                    <td style={td}>₹{Number(row.loan_amount).toLocaleString("en-IN")}</td>
                    <td style={td}>₹{Number(row.monthly_income).toLocaleString("en-IN")}</td>
                    <td style={td}>{row.employment_type.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              style={btnStyle}
              disabled={page <= 1}
              onClick={() => applyFilters(selected, page - 1).catch((e) => setErr(String(e)))}
            >
              Prev
            </button>
            <button
              type="button"
              style={btnStyle}
              disabled={leads.length < 25}
              onClick={() => applyFilters(selected, page + 1).catch((e) => setErr(String(e)))}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 16,
};

const h3: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--text)",
};

const inputStyle: CSSProperties = {
  background: "#0f172a",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "var(--text)",
};

const btnStyle: CSSProperties = {
  background: "var(--accent-dim)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  cursor: "pointer",
  fontWeight: 600,
};

const lab: CSSProperties = { display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 };

const th: CSSProperties = { padding: "8px 8px 8px 0", fontWeight: 600 };
const td: CSSProperties = { padding: "8px 8px 8px 0", verticalAlign: "top" };
