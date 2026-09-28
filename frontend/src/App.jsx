import { useEffect, useMemo, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PAGES = [
  { id: 'Industry Overview', needsData: false },
  { id: 'Data Quality', needsData: true },
  { id: 'AI Root Cause', needsData: true },
  { id: 'Inventory Risk', needsData: true },
  { id: 'Forecasting', needsData: true },
  { id: 'Anomalies', needsData: true },
  { id: 'Decision Copilot', needsData: true },
  { id: 'Executive Report', needsData: true },
];

const CURRENCIES = {
  INR: { label: '₹ INR', locale: 'en-IN' },
  USD: { label: '$ USD', locale: 'en-US' },
  EUR: { label: '€ EUR', locale: 'en-IE' },
  GBP: { label: '£ GBP', locale: 'en-GB' },
};

const SUGGESTED_QUESTIONS = [
  'Why did sales drop?',
  'Which products risk stockout?',
  'What should we do this week?',
  'Which forecast model should I trust?',
];

const EMPTY_ANALYSIS = {
  profile: {},
  kpis: {},
  insights: [],
  anomalies: [],
  forecast: [],
  model_forecast: [],
  models: {},
  root: '',
  actions: '',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const readStored = (key, allowed, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    if (saved && allowed.includes(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  return fallback;
};

const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};

const getInitialTheme = () => {
  const saved = readStored('theme', ['light', 'dark'], null);
  if (saved) return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const toNum = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
const isEmpty = (v) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));

const numFmt0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const numFmt2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

const fmt0 = (v) => (Number.isFinite(toNum(v)) ? numFmt0.format(toNum(v)) : '—');
const fmt2 = (v) => (Number.isFinite(toNum(v)) ? numFmt2.format(toNum(v)) : '—');

const formatDate = (d) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? String(d ?? '—') : t.toLocaleDateString();
};

const formatBytes = (n) => {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const timeAgo = (ts, now) => {
  if (!ts) return '';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

const levelKey = (level) => {
  const k = String(level ?? '').toLowerCase();
  if (k === 'high' || k === 'critical' || k === 'severe') return 'high';
  if (k === 'medium' || k === 'moderate') return 'medium';
  if (k === 'low') return 'low';
  return 'flag';
};

const SEVERITY_ICON = { high: '▲', medium: '◆', low: '●', flag: '⚑' };

const anomalySeverity = (row) => {
  if (row.severity) return String(row.severity);
  const z = toNum(row.z_score ?? row.zscore ?? row.Z_Score);
  if (Number.isFinite(z)) {
    const a = Math.abs(z);
    return a >= 3 ? 'High' : a >= 2 ? 'Medium' : 'Low';
  }
  return 'Flagged';
};

/* ------------------------------------------------------------------ */
/*  Small presentational components                                    */
/* ------------------------------------------------------------------ */

function SeverityBadge({ level }) {
  const key = levelKey(level);
  const label = level ? String(level) : 'Flagged';
  return (
    <span className={`badge badge-${key}`}>
      <span aria-hidden="true">{SEVERITY_ICON[key]}</span>
      {label}
    </span>
  );
}

function ExpandableText({ text, limit = 220, className = '' }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > limit;
  let shown = text;
  if (long && !open) {
    const cut = text.slice(0, limit);
    const lastSpace = cut.lastIndexOf(' ');
    shown = `${cut.slice(0, lastSpace > limit * 0.6 ? lastSpace : limit)}…`;
  }
  return (
    <div className={className}>
      <p className="expandable-text">{shown}</p>
      {long && (
        <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

const cmpVals = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
};

/* Sortable, searchable table with a sticky header.
   columns: [{ key, label, num?, value(row) -> sortable primitive, text?(row) -> string, render?(row) -> node }] */
function DataTable({ columns, rows, initialSort, searchLabel = 'Search rows', maxHeight = 420, emptyText = 'No rows to show.' }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort || null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = rows.filter((row) =>
        columns.some((c) => {
          const t = c.text ? c.text(row) : c.value(row);
          return String(t ?? '').toLowerCase().includes(q);
        }),
      );
    }
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col) {
      const dir = sort.dir === 'asc' ? 1 : -1;
      out = [...out].sort((r1, r2) => {
        const a = col.value(r1);
        const b = col.value(r2);
        const an = isEmpty(a);
        const bn = isEmpty(b);
        if (an || bn) return an === bn ? 0 : an ? 1 : -1;
        return dir * cmpVals(a, b);
      });
    }
    return out;
  }, [rows, columns, query, sort]);

  const toggleSort = (key) =>
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <div className="table-block">
      <div className="table-tools">
        <input
          type="search"
          className="table-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchLabel}
          aria-label={searchLabel}
        />
        <span className="table-count" aria-live="polite">
          {visible.length} of {rows.length}
        </span>
      </div>
      <div className="table-wrap" style={{ maxHeight }} tabIndex={0} role="region" aria-label="Scrollable table">
        <table className="grid">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort && sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={c.num ? 'num' : ''}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      <span className="sort-mark" aria-hidden="true">
                        {active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.num ? 'num' : ''}>
                      {c.render ? c.render(row) : c.text ? c.text(row) : String(c.value(row) ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="empty-cell">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Forecast chart (dependency-free SVG, driven by real data)          */
/* ------------------------------------------------------------------ */

const CW = 720;
const CH = 280;
const CM = { l: 58, r: 18, t: 14, b: 34 };

const SERIES_STYLE = {
  actual: { color: 'var(--chart-actual)', dash: '', width: 2.6, marker: null },
  hw: { color: 'var(--chart-hw)', dash: '7 5', width: 2.2, marker: null },
  rf: { color: 'var(--chart-rf)', dash: '', width: 2.4, marker: 'circle' },
  dl: { color: 'var(--chart-dl)', dash: '2 4', width: 2.4, marker: 'square' },
};

const pickDate = (it) => it?.date ?? it?.Date ?? it?.Order_Date ?? it?.ds;
const pickValue = (it) => {
  for (const k of ['value', 'sales', 'Sales', 'actual', 'y', 'forecast']) {
    const n = toNum(it?.[k]);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
};

const buildSeries = (analysis) => {
  const mk = (key, label, arr, get) => ({
    key,
    label,
    points: (Array.isArray(arr) ? arr : [])
      .map((it) => ({ t: new Date(pickDate(it)).getTime(), v: get(it) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
      .sort((a, b) => a.t - b.t),
  });
  const history = analysis.history ?? analysis.sales_history ?? analysis.sales_series ?? analysis.trend ?? analysis.series;
  return [
    mk('actual', 'Actual sales', history, pickValue),
    mk('hw', 'Holt-Winters', analysis.forecast, (it) => toNum(it.forecast)),
    mk('rf', 'Random Forest', analysis.model_forecast, (it) => toNum(it.ml_forecast)),
    mk('dl', 'Deep learning (MLP)', analysis.model_forecast, (it) => toNum(it.dl_forecast)),
  ].filter((s) => s.points.length);
};

const niceScale = (min, max, count = 4) => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { ticks: [0, 1], min: 0, max: 1 };
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const rough = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const n = Math.round((hi - lo) / step);
  return { ticks: Array.from({ length: n + 1 }, (_, i) => lo + i * step), min: lo, max: hi };
};

function LegendSwatch({ k }) {
  const s = SERIES_STYLE[k];
  return (
    <svg width="30" height="12" aria-hidden="true">
      <line x1="1" y1="6" x2="29" y2="6" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash || undefined} strokeLinecap="round" />
      {s.marker === 'circle' && <circle cx="15" cy="6" r="3.2" fill={s.color} />}
      {s.marker === 'square' && <rect x="12" y="3" width="6" height="6" fill={s.color} />}
    </svg>
  );
}

function ForecastChart({ analysis, height = 280 }) {
  const series = useMemo(() => buildSeries(analysis), [analysis]);
  const [hidden, setHidden] = useState({});
  const [hoverIdx, setHoverIdx] = useState(null);

  const shown = series.filter((s) => !hidden[s.key]);
  const domainSeries = shown.length ? shown : series;

  const times = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.t)))].sort((a, b) => a - b), [series]);
  const lookups = useMemo(() => Object.fromEntries(series.map((s) => [s.key, new Map(s.points.map((p) => [p.t, p.v]))])), [series]);

  if (!series.length) {
    return <p className="empty-copy">Upload a dataset with a date column and a numeric sales measure to see the trend and forecasts.</p>;
  }

  const tMin = times[0];
  const tMax = times[times.length - 1];
  const allValues = domainSeries.flatMap((s) => s.points.map((p) => p.v));
  const scale = niceScale(Math.min(...allValues), Math.max(...allValues));

  const xOf = (t) => (tMax === tMin ? (CM.l + CW - CM.r) / 2 : CM.l + ((t - tMin) / (tMax - tMin)) * (CW - CM.l - CM.r));
  const yOf = (v) => CM.t + (1 - (v - scale.min) / (scale.max - scale.min)) * (CH - CM.t - CM.b);

  const spanDays = (tMax - tMin) / 86400000;
  const dateFmt = new Intl.DateTimeFormat(undefined, spanDays < 150 ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' });
  const xTicks = tMax === tMin ? [tMin] : Array.from({ length: 5 }, (_, i) => tMin + ((tMax - tMin) * i) / 4);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const x = (e.clientX - rect.left) * (CW / rect.width);
    let best = 0;
    let bd = Infinity;
    times.forEach((t, i) => {
      const d = Math.abs(xOf(t) - x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHoverIdx(best);
  };

  const onKey = (e) => {
    const last = times.length - 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setHoverIdx((i) => Math.min(last, Math.max(0, (i ?? last) + (e.key === 'ArrowRight' ? 1 : -1))));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHoverIdx(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHoverIdx(last);
    } else if (e.key === 'Escape') {
      setHoverIdx(null);
    }
  };

  const hoverT = hoverIdx === null ? null : times[hoverIdx];

  return (
    <div className="chart-wrap">
      <div className="chart-legend" role="group" aria-label="Toggle chart series">
        {series.map((s) => (
          <button
            type="button"
            key={s.key}
            className={`legend-item ${hidden[s.key] ? 'off' : ''}`}
            aria-pressed={!hidden[s.key]}
            onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
          >
            <LegendSwatch k={s.key} />
            {s.label}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${CW} ${CH}`}
        className="trend-chart"
        style={{ height }}
        role="img"
        aria-label={`Line chart of ${series.map((s) => s.label).join(', ')}. Use arrow keys to read values by date.`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverIdx(null)}
        onKeyDown={onKey}
        onBlur={() => setHoverIdx(null)}
        preserveAspectRatio="xMidYMid meet"
      >
        {scale.ticks.map((v) => (
          <g key={v}>
            <line x1={CM.l} x2={CW - CM.r} y1={yOf(v)} y2={yOf(v)} className="grid-line" />
            <text x={CM.l - 8} y={yOf(v) + 4} textAnchor="end" className="axis-text">
              {compactFmt.format(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={xOf(t)} y={CH - 10} textAnchor={i === 0 && xTicks.length > 1 ? 'start' : i === xTicks.length - 1 && xTicks.length > 1 ? 'end' : 'middle'} className="axis-text">
            {dateFmt.format(new Date(t))}
          </text>
        ))}

        {shown.map((s) => {
          const st = SERIES_STYLE[s.key];
          const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.t).toFixed(1)} ${yOf(p.v).toFixed(1)}`).join(' ');
          return (
            <g key={s.key}>
              {s.points.length > 1 && (
                <path d={d} fill="none" stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash || undefined} strokeLinecap="round" strokeLinejoin="round" />
              )}
              {st.marker && s.points.length <= 40 &&
                s.points.map((p) =>
                  st.marker === 'circle' ? (
                    <circle key={p.t} cx={xOf(p.t)} cy={yOf(p.v)} r="3.2" fill={st.color} />
                  ) : (
                    <rect key={p.t} x={xOf(p.t) - 3} y={yOf(p.v) - 3} width="6" height="6" fill={st.color} />
                  ),
                )}
              {s.points.length === 1 && <circle cx={xOf(s.points[0].t)} cy={yOf(s.points[0].v)} r="4" fill={st.color} />}
            </g>
          );
        })}

        {hoverT !== null && (
          <g>
            <line x1={xOf(hoverT)} x2={xOf(hoverT)} y1={CM.t} y2={CH - CM.b} className="hover-line" />
            {shown.map((s) =>
              lookups[s.key].has(hoverT) ? (
                <circle key={s.key} cx={xOf(hoverT)} cy={yOf(lookups[s.key].get(hoverT))} r="5" fill="var(--card)" stroke={SERIES_STYLE[s.key].color} strokeWidth="2.4" />
              ) : null,
            )}
          </g>
        )}
      </svg>

      <div className="chart-readout" aria-live="polite">
        {hoverT === null ? (
          <span className="readout-hint">Hover the chart or focus it and use the arrow keys to read values.</span>
        ) : (
          <>
            <strong>{new Date(hoverT).toLocaleDateString()}</strong>
            {shown.map((s) =>
              lookups[s.key].has(hoverT) ? (
                <span key={s.key} className="readout-item">
                  <LegendSwatch k={s.key} />
                  {s.label} <b>{fmt0(lookups[s.key].get(hoverT))}</b>
                </span>
              ) : null,
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Model comparison                                                   */
/* ------------------------------------------------------------------ */

const findMetric = (obj, name) => {
  if (!obj || typeof obj !== 'object') return NaN;
  const k = Object.keys(obj).find((key) => key.toLowerCase() === name);
  return k ? toNum(obj[k]) : NaN;
};

const normalizeMetrics = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const pick = (names) => {
    const k = Object.keys(raw).find((key) => names.includes(key.toLowerCase().replace(/[\s-]+/g, '_')));
    return k ? raw[k] : null;
  };
  const rf = pick(['rf', 'ml', 'random_forest', 'randomforest']);
  const dl = pick(['dl', 'mlp', 'deep_learning', 'neural']);
  const out = {
    rf: { mae: findMetric(rf, 'mae'), rmse: findMetric(rf, 'rmse') },
    dl: { mae: findMetric(dl, 'mae'), rmse: findMetric(dl, 'rmse') },
  };
  const any = [out.rf.mae, out.rf.rmse, out.dl.mae, out.dl.rmse].some(Number.isFinite);
  return any ? out : null;
};

function ModelComparison({ analysis }) {
  const metrics = normalizeMetrics(analysis.model_metrics ?? analysis.metrics ?? analysis.model_scores);

  const gapPct = useMemo(() => {
    const rows = (analysis.model_forecast || []).filter((r) => Number.isFinite(toNum(r.ml_forecast)) && Number.isFinite(toNum(r.dl_forecast)));
    if (!rows.length) return null;
    const diff = rows.reduce((s, r) => s + Math.abs(toNum(r.ml_forecast) - toNum(r.dl_forecast)), 0) / rows.length;
    const base = rows.reduce((s, r) => s + Math.abs(toNum(r.ml_forecast)), 0) / rows.length;
    return base ? (diff / base) * 100 : null;
  }, [analysis.model_forecast]);

  let best = null;
  if (metrics) {
    const key = Number.isFinite(metrics.rf.rmse) && Number.isFinite(metrics.dl.rmse) ? 'rmse' : 'mae';
    if (Number.isFinite(metrics.rf[key]) && Number.isFinite(metrics.dl[key]) && metrics.rf[key] !== metrics.dl[key]) {
      best = metrics.rf[key] < metrics.dl[key] ? 'rf' : 'dl';
    }
  }

  return (
    <div className="metrics">
      {metrics ? (
        <table className="grid metrics-table">
          <caption className="sr-only">Forecast error by model. Lower is better.</caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col" className="num">MAE</th>
              <th scope="col" className="num">RMSE</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['rf', 'Random Forest'],
              ['dl', 'Deep learning (MLP)'],
            ].map(([k, label]) => (
              <tr key={k} className={best === k ? 'best-row' : ''}>
                <th scope="row">{label}</th>
                <td className="num">{fmt2(metrics[k].mae)}</td>
                <td className="num">{fmt2(metrics[k].rmse)}</td>
                <td>{best === k ? <span className="badge badge-low"><span aria-hidden="true">✓</span>Lower error</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-copy tight">
          Accuracy scores (MAE and RMSE) were not returned by the backend. Return <code>model_metrics</code> from <code>/analyze</code> as{' '}
          <code>{'{ rf: { mae, rmse }, dl: { mae, rmse } }'}</code> and the better model will be highlighted here.
        </p>
      )}
      {gapPct !== null && (
        <p className="agreement">
          Across the forecast window, Random Forest and the MLP differ by <strong>{gapPct.toFixed(1)}%</strong> on average.{' '}
          {gapPct < 10 ? 'The models broadly agree.' : 'A wide gap means the forecast is uncertain.'}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Copilot                                                            */
/* ------------------------------------------------------------------ */

function Copilot({ chat, question, setQuestion, onAsk, loading, disabled, threadHeight = 260 }) {
  const threadRef = useRef(null);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  return (
    <div className="copilot">
      <div className="chips" role="group" aria-label="Suggested questions">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button type="button" key={q} className="chip" disabled={disabled || loading} onClick={() => onAsk(q)}>
            {q}
          </button>
        ))}
      </div>

      <div className="thread" ref={threadRef} role="log" aria-live="polite" aria-label="Copilot conversation" style={{ maxHeight: threadHeight }}>
        {chat.length === 0 && (
          <p className="thread-empty">{disabled ? 'Analyze a dataset to start asking questions.' : 'Pick a suggestion or type your own question.'}</p>
        )}
        {chat.map((m) => (
          <div key={m.id} className="exchange">
            <p className="msg msg-user">{m.q}</p>
            {m.failed ? (
              <p className="msg msg-error">Could not get an answer: {m.failed}</p>
            ) : m.a === null ? (
              <p className="msg msg-ai pending">Thinking…</p>
            ) : (
              <p className="msg msg-ai">{m.a}</p>
            )}
          </div>
        ))}
      </div>

      <form
        className="copilot-form"
        onSubmit={(e) => {
          e.preventDefault();
          onAsk();
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask the manager copilot a question"
          aria-label="Ask the manager copilot a question"
          disabled={disabled || loading}
        />
        <button type="submit" className="action-btn compact-btn" disabled={disabled || loading || !question.trim()}>
          {loading ? 'Thinking…' : 'Ask AI'}
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

function App() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState([]);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [activePage, setActivePage] = useState('Industry Overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  const [currency, setCurrency] = useState(() => readStored('currency', Object.keys(CURRENCIES), 'INR'));
  const [analysis, setAnalysis] = useState(EMPTY_ANALYSIS);
  const [analyzedName, setAnalyzedName] = useState('');
  const [analyzedAt, setAnalyzedAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef(null);

  const hasData = Boolean(analysis.profile?.rows);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    writeStored('theme', theme);
  }, [theme]);

  useEffect(() => {
    writeStored('currency', currency);
  }, [currency]);

  useEffect(() => {
    if (!analyzedAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [analyzedAt]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const money = useMemo(() => {
    const c = CURRENCIES[currency];
    return new Intl.NumberFormat(c.locale, { style: 'currency', currency, maximumFractionDigits: 0 });
  }, [currency]);

  const summaryStats = useMemo(() => {
    const p = analysis.profile || {};
    return [
      { label: 'Rows', value: p.rows ? p.rows.toLocaleString() : '—' },
      { label: 'Columns', value: p.columns ?? '—' },
      { label: 'Missing cells', value: p.missing_cells ?? '—' },
      { label: 'Duplicates', value: p.duplicates ?? '—' },
    ];
  }, [analysis.profile]);

  const riskCounts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0, flag: 0 };
    (analysis.risk || []).forEach((r) => {
      c[levelKey(r.risk_level)] += 1;
    });
    return c;
  }, [analysis.risk]);
  const riskTotal = riskCounts.high + riskCounts.medium + riskCounts.low + riskCounts.flag;

  const anomalyRows = useMemo(() => (Array.isArray(analysis.anomalies) ? analysis.anomalies.filter((r) => r && typeof r === 'object') : []), [analysis.anomalies]);

  /* ---- file handling ---- */
  const pickFile = (f) => {
    if (!f) return;
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) {
      setError('Unsupported file type. Choose a .csv, .xlsx or .xls file.');
      return;
    }
    setError('');
    setFile(f);
  };

  const clearFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  /* ---- API calls ---- */
  const handleSubmit = async () => {
    if (!file) {
      setError('Choose a CSV or Excel file first.');
      return;
    }
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/analyze', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Analysis failed');
      setAnalysis({ ...EMPTY_ANALYSIS, ...data });
      setAnalyzedName(file.name);
      setAnalyzedAt(Date.now());
      setNow(Date.now());
      setChat([]);
      setError('');
      setToast({ tone: 'ok', msg: `Analysis complete for ${file.name}.` });
      setDrawerOpen(false);
    } catch (err) {
      setError(err.message || 'Something went wrong during analysis.');
    } finally {
      setLoading(false);
    }
  };

  const askCopilot = async (text) => {
    const q = (typeof text === 'string' ? text : question).trim();
    if (!q || !hasData || decisionLoading) return;
    const id = Date.now();
    setQuestion('');
    setChat((c) => [...c, { id, q, a: null }]);
    setDecisionLoading(true);
    setError('');
    try {
      const response = await fetch('/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, evidence: analysis }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Decision request failed');
      setChat((c) => c.map((m) => (m.id === id ? { ...m, a: data.answer } : m)));
    } catch (err) {
      const msg = err.message || 'Unable to reach the decision copilot.';
      setChat((c) => c.map((m) => (m.id === id ? { ...m, failed: msg } : m)));
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleReport = async () => {
    if (!hasData) return;
    setReportLoading(true);
    setError('');
    try {
      const response = await fetch('/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: `Analysis completed for ${analysis.profile.rows.toLocaleString()} rows and ${analysis.profile.columns} columns.`,
          kpis: analysis.kpis,
          insights: analysis.insights,
          anomalies: `${analysis.anomalies?.length || 0} records returned by ${analysis.anomaly_method || 'the anomaly detector'}.`,
          forecast_text: analysis.forecast_msg,
          root_cause: analysis.root,
          actions: analysis.actions,
        }),
      });
      if (!response.ok) throw new Error('Report generation failed');
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'industry_ai_decision_report.pdf';
      link.click();
      URL.revokeObjectURL(link.href);
      setError('');
      setToast({ tone: 'ok', msg: 'Report downloaded: industry_ai_decision_report.pdf' });
    } catch (err) {
      setError(err.message || 'Unable to generate the executive report.');
    } finally {
      setReportLoading(false);
    }
  };

  const openPage = (page) => {
    setActivePage(page);
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ---- table definitions ---- */
  const riskColumns = [
    { key: 'date', label: 'Date', value: (r) => (r.Order_Date ? new Date(r.Order_Date).getTime() || String(r.Order_Date) : null), text: (r) => (r.Order_Date ? formatDate(r.Order_Date) : '—') },
    { key: 'item', label: 'Item', value: (r) => r.Product || r.Category || 'Business item' },
    { key: 'level', label: 'Risk level', value: (r) => ({ high: 3, medium: 2, low: 1, flag: 0 })[levelKey(r.risk_level)], text: (r) => String(r.risk_level ?? ''), render: (r) => <SeverityBadge level={r.risk_level} /> },
    { key: 'risk', label: 'Stockout risk', num: true, value: (r) => toNum(r.stockout_risk), text: (r) => (Number.isFinite(toNum(r.stockout_risk)) ? `${(toNum(r.stockout_risk) * 100).toFixed(1)}%` : '—') },
  ];

  const modelColumns = [
    { key: 'date', label: 'Date', value: (r) => new Date(r.date).getTime(), text: (r) => formatDate(r.date) },
    { key: 'rf', label: 'Random Forest', num: true, value: (r) => toNum(r.ml_forecast), text: (r) => fmt0(r.ml_forecast) },
    { key: 'dl', label: 'Deep learning', num: true, value: (r) => toNum(r.dl_forecast), text: (r) => fmt0(r.dl_forecast) },
    { key: 'gap', label: 'Gap', num: true, value: (r) => Math.abs(toNum(r.ml_forecast) - toNum(r.dl_forecast)), text: (r) => fmt0(Math.abs(toNum(r.ml_forecast) - toNum(r.dl_forecast))) },
  ];

  const baselineColumns = [
    { key: 'date', label: 'Date', value: (r) => new Date(r.date).getTime(), text: (r) => formatDate(r.date) },
    { key: 'forecast', label: 'Forecast', num: true, value: (r) => toNum(r.forecast), text: (r) => fmt0(r.forecast) },
  ];

  const anomalyColumns = useMemo(() => {
    if (!anomalyRows.length) return [];
    const sample = anomalyRows[0];
    const keys = Object.keys(sample).filter((k) => typeof sample[k] !== 'object').slice(0, 6);
    const dataCols = keys.map((k) => ({
      key: k,
      label: k.replaceAll('_', ' '),
      num: typeof sample[k] === 'number',
      value: (r) => r[k],
      text: (r) => (typeof r[k] === 'number' ? numFmt2.format(r[k]) : String(r[k] ?? '—')),
    }));
    return [
      ...dataCols,
      {
        key: '__severity',
        label: 'Severity',
        value: (r) => ({ high: 3, medium: 2, low: 1, flag: 0 })[levelKey(anomalySeverity(r))],
        text: (r) => anomalySeverity(r),
        render: (r) => <SeverityBadge level={anomalySeverity(r)} />,
      },
    ];
  }, [anomalyRows]);

  const navBadge = (id) => {
    if (id === 'Anomalies' && anomalyRows.length) return anomalyRows.length;
    if (id === 'Inventory Risk' && riskCounts.high) return riskCounts.high;
    return null;
  };

  const statusText = hasData
    ? `Analyzed ${analyzedName || 'dataset'} · ${analysis.profile.rows.toLocaleString()} rows · ${timeAgo(analyzedAt, now)}`
    : 'No dataset analyzed yet';

  const insightParts = (item) => {
    const s = String(item);
    const i = s.indexOf(':');
    return i > 0 && i < 60 ? { title: s.slice(0, i), body: s.slice(i + 1).trim() } : { title: 'Insight', body: s };
  };

  return (
    <div className="dashboard-shell">
      {drawerOpen && <div className="scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <aside id="sidebar" className={`sidebar ${drawerOpen ? 'open' : ''}`} aria-label="Primary">
        <div className="brand-block">
          <div className="brand-icon" aria-hidden="true">AI</div>
          <div>
            <p className="mini-label">Industry AI</p>
            <h3>Decision Support</h3>
            <span className="week-tag">System</span>
          </div>
          <button type="button" className="drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close navigation">✕</button>
        </div>

        <nav className="nav-stack">
          {PAGES.map(({ id, needsData }) => {
            const locked = needsData && !hasData;
            const badge = navBadge(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => !locked && openPage(id)}
                disabled={locked}
                aria-current={activePage === id ? 'page' : undefined}
                title={locked ? 'Analyze a dataset to unlock this page' : undefined}
                className={`nav-item ${activePage === id ? 'active' : ''}`}
              >
                <span className="nav-dot" aria-hidden="true" />
                <span className="nav-label">{id}</span>
                {locked && <span className="nav-tag">Locked</span>}
                {badge !== null && !locked && <span className="nav-count" aria-label={`${badge} items`}>{badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="upload-box">
          <label
            className={`dropzone ${dragOver ? 'over' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              aria-label="Upload CSV or Excel file"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {file ? (
              <span className="file-meta">
                <strong className="file-name" title={file.name}>{file.name}</strong>
                <small>{formatBytes(file.size)} · ready to analyze</small>
              </span>
            ) : (
              <span className="file-meta">
                <strong>Drop a file here</strong>
                <small>or click to browse CSV / Excel</small>
              </span>
            )}
          </label>
          {file && (
            <button type="button" className="link-btn" onClick={clearFile}>Remove file</button>
          )}
          <button type="button" className="action-btn" onClick={handleSubmit} disabled={loading || !file} aria-busy={loading}>
            {loading ? 'Analyzing…' : 'Analyze data'}
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open navigation" aria-expanded={drawerOpen} aria-controls="sidebar">
              <span aria-hidden="true">☰</span>
            </button>
            <div>
              <p className="topbar-title">{activePage}</p>
              <p className={`status-line ${hasData ? 'ready' : ''}`} aria-live="polite">{statusText}</p>
            </div>
          </div>

          <div className="top-actions">
            <label className="currency-picker">
              <span className="sr-only">Currency</span>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency">
                {Object.entries(CURRENCIES).map(([code, c]) => (
                  <option key={code} value={code}>{c.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <span className="toggle-icon" aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>

        {loading && (
          <div className="progress" role="progressbar" aria-label="Analyzing dataset" aria-busy="true">
            <span />
          </div>
        )}

        {error && (
          <div className="alert error" role="alert">
            <span>{error}</span>
            <button type="button" className="alert-close" onClick={() => setError('')} aria-label="Dismiss error">✕</button>
          </div>
        )}

        {/* ================= OVERVIEW ================= */}
        {activePage === 'Industry Overview' && (
          <>
            {!hasData && !loading && (
              <div className="welcome panel">
                <h1>Start with a dataset</h1>
                <p>Drop a CSV or Excel file into the sidebar and choose Analyze data. Charts, forecasts, risks and the copilot unlock when the analysis finishes.</p>
              </div>
            )}

            <section className="stats-row" aria-label="Dataset summary">
              {summaryStats.map((card) => (
                <div className="stat-card" key={card.label}>
                  <span className="card-label">{card.label}</span>
                  <div className="card-value-row">
                    {loading ? <span className="skeleton sk-value" /> : <strong>{card.value}</strong>}
                    <span className="trend">{hasData ? 'Live' : 'Awaiting data'}</span>
                  </div>
                </div>
              ))}
            </section>

            <section className="content-grid">
              <div className="panel large-panel">
                <div className="panel-header">
                  <div>
                    <span className="panel-kicker">Sales trend</span>
                    <h4>{analysis.kpis?.Sales && Number.isFinite(toNum(analysis.kpis.Sales)) ? money.format(toNum(analysis.kpis.Sales)) : 'Upload dataset'}</h4>
                  </div>
                  <span className="muted-tag">Time series</span>
                </div>
                {loading ? <div className="skeleton sk-chart" /> : <ForecastChart analysis={analysis} height={230} />}
              </div>

              <div className="side-stack">
                <div className="panel small-panel accent-panel">
                  <div className="panel-header compact">
                    <span className="panel-kicker">Inventory risk</span>
                    <span className="mini-flag">AI model</span>
                  </div>
                  <div className="big-number">{riskTotal ? `${riskCounts.high} high-risk` : 'Awaiting data'}</div>
                  {riskTotal > 0 && (
                    <>
                      <div className="risk-bar" role="img" aria-label={`${riskCounts.high} high, ${riskCounts.medium} medium, ${riskCounts.low} low`}>
                        {riskCounts.high > 0 && <span className="seg seg-high" style={{ flexGrow: riskCounts.high }} />}
                        {riskCounts.medium > 0 && <span className="seg seg-medium" style={{ flexGrow: riskCounts.medium }} />}
                        {riskCounts.low > 0 && <span className="seg seg-low" style={{ flexGrow: riskCounts.low }} />}
                      </div>
                      <p className="risk-legend">▲ High {riskCounts.high} · ◆ Medium {riskCounts.medium} · ● Low {riskCounts.low}</p>
                    </>
                  )}
                </div>

                <div className="panel small-panel">
                  <div className="panel-header compact">
                    <span className="panel-kicker">Anomalies</span>
                    <span className={`mini-flag ${anomalyRows.length ? 'warn' : ''}`}>{anomalyRows.length ? 'Review' : 'Clear'}</span>
                  </div>
                  <div className="big-number plain">{hasData ? anomalyRows.length.toLocaleString() : '—'}</div>
                  <p className="small-note">{hasData ? `flagged by ${analysis.anomaly_method || 'the anomaly detector'}` : 'Awaiting data'}</p>
                  {anomalyRows.length > 0 && (
                    <button type="button" className="link-btn" onClick={() => openPage('Anomalies')}>View flagged rows</button>
                  )}
                </div>
              </div>
            </section>

            <section className="bottom-grid">
              <div className="panel list-panel">
                <div className="panel-header">
                  <div>
                    <span className="panel-kicker">Business insight</span>
                    <h4>{analysis.insights?.[0] ? 'Top signals' : 'Awaiting analysis'}</h4>
                  </div>
                  <span className="muted-tag">Evidence based</span>
                </div>
                <div className="ticket-list">
                  {analysis.insights?.length ? (
                    analysis.insights.slice(0, 3).map((item, index) => {
                      const { title, body } = insightParts(item);
                      return (
                        <div className="ticket-row" key={index}>
                          <div className={`avatar ${index % 3 === 0 ? 'blue' : index % 3 === 1 ? 'purple' : 'orange'}`} aria-hidden="true">{index + 1}</div>
                          <div className="ticket-body">
                            <strong>{title}</strong>
                            <ExpandableText text={body} limit={90} className="ticket-text" />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="ticket-row">
                      <div className="avatar blue" aria-hidden="true">•</div>
                      <div className="ticket-body">
                        <strong>Upload dataset</strong>
                        <small>Data quality, forecasting, and AI diagnosis will appear here.</small>
                      </div>
                    </div>
                  )}
                </div>
                {analysis.insights?.length > 3 && (
                  <button type="button" className="link-btn" onClick={() => openPage('AI Root Cause')}>View all {analysis.insights.length} insights</button>
                )}
              </div>

              <div className="panel insights-panel">
                <div className="panel-header">
                  <div>
                    <span className="panel-kicker">AI insights</span>
                    <h4>Decision support</h4>
                  </div>
                </div>
                <div className="insight-stack">
                  {analysis.root ? (
                    <>
                      <ExpandableText text={analysis.root} limit={220} className="insight-card" />
                      <ExpandableText text={analysis.actions} limit={220} className="insight-card" />
                    </>
                  ) : (
                    <p className="empty-copy tight">Upload a dataset to view AI-generated root-cause analysis, forecast signals, and management recommendations.</p>
                  )}
                </div>
                <Copilot chat={chat} question={question} setQuestion={setQuestion} onAsk={askCopilot} loading={decisionLoading} disabled={!hasData} threadHeight={220} />
                <div className="model-status">
                  <span>Models: {Object.values(analysis.models || {}).join(' | ') || 'Awaiting dataset'}</span>
                </div>
              </div>
            </section>

            <section className="model-grid">
              <div className="panel model-panel">
                <div className="panel-header">
                  <div>
                    <span className="panel-kicker">Predictive models</span>
                    <h4>ML and deep learning forecast</h4>
                  </div>
                  <span className="muted-tag">Lag features</span>
                </div>
                <ModelComparison analysis={analysis} />
                {analysis.model_forecast?.length ? (
                  <div className="forecast-table">
                    {analysis.model_forecast.slice(0, 6).map((item) => (
                      <div className="forecast-row" key={item.date}>
                        <span>{formatDate(item.date)}</span>
                        <strong>RF {fmt0(item.ml_forecast)}</strong>
                        <strong>DL {fmt0(item.dl_forecast)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-copy">Upload a dataset with a date column and numeric sales or demand measure.</p>
                )}
                {analysis.model_forecast?.length > 6 && (
                  <button type="button" className="link-btn" onClick={() => openPage('Forecasting')}>View full forecast</button>
                )}
                <small className="model-note">{analysis.model_forecast_msg || 'Random Forest and MLP predictions will appear after analysis.'}</small>
              </div>
              <div className="panel model-panel">
                <div className="panel-header">
                  <div>
                    <span className="panel-kicker">GenAI model</span>
                    <h4>Grounded decision copilot</h4>
                  </div>
                  <span className="muted-tag">Evidence only</span>
                </div>
                <p className="empty-copy">{analysis.models?.genai || 'Gemini or OpenAI model configured through environment variables.'}</p>
                <div className="genai-features">
                  <span>Root-cause analysis</span>
                  <span>Prioritized actions</span>
                  <span>Manager Q&amp;A</span>
                </div>
              </div>
            </section>

            <section className="report-strip">
              <div>
                <span className="panel-kicker">Executive report</span>
                <strong>Export the evidence packet, model outputs, and recommendations.</strong>
              </div>
              <button type="button" className="action-btn report-btn" onClick={handleReport} disabled={!hasData || reportLoading}>
                {reportLoading ? 'Building report…' : 'Download PDF report'}
              </button>
            </section>
          </>
        )}

        {/* ================= DATA QUALITY ================= */}
        {activePage === 'Data Quality' && (
          <section className="page-view">
            <div className="page-heading">
              <span className="panel-kicker">Data Quality</span>
              <h1>Understand and prepare the source dataset</h1>
              <p>Profiling, type detection, duplicate checks, and transparent cleaning actions.</p>
            </div>
            <section className="stats-row">
              {summaryStats.map((card) => (
                <div className="stat-card" key={card.label}>
                  <span className="card-label">{card.label}</span>
                  <strong className="page-stat">{card.value}</strong>
                </div>
              ))}
            </section>
            <div className="quality-grid">
              <div className="panel">
                <div className="panel-header"><h4>Detected column types</h4><span className="muted-tag">Profile</span></div>
                <div className="quality-list">
                  <strong>Numeric</strong><span>{analysis.profile?.numeric?.join(', ') || 'None detected'}</span>
                  <strong>Categorical</strong><span>{analysis.profile?.categorical?.join(', ') || 'None detected'}</span>
                  <strong>Date / time</strong><span>{analysis.profile?.datetime?.join(', ') || 'None detected'}</span>
                </div>
              </div>
              <div className="panel">
                <div className="panel-header"><h4>Cleaning log</h4><span className="muted-tag">Auditable</span></div>
                <div className="quality-list single">
                  {analysis.changes?.length ? analysis.changes.map((change) => <span key={change}>{change}</span>) : <span>No cleaning actions were needed or logged.</span>}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ================= ROOT CAUSE ================= */}
        {activePage === 'AI Root Cause' && (
          <section className="page-view">
            <div className="page-heading">
              <span className="panel-kicker">AI Root Cause</span>
              <h1>Evidence-based diagnosis</h1>
              <p>The GenAI model separates observed signals from probable contributing factors.</p>
            </div>
            <div className="root-page-grid">
              <div className="panel root-output">
                <div className="panel-header"><h4>Root-cause analysis</h4><span className="muted-tag">Grounded GenAI</span></div>
                <p>{analysis.root || 'No root-cause analysis was returned.'}</p>
                {analysis.actions && (
                  <>
                    <h4 className="sub-heading">Recommended actions</h4>
                    <p>{analysis.actions}</p>
                  </>
                )}
              </div>
              <div className="panel">
                <div className="panel-header"><h4>Evidence signals</h4><span className="muted-tag">Computed</span></div>
                <div className="insight-stack">
                  {analysis.insights?.length ? analysis.insights.map((item, i) => <p key={i} className="insight-card">{item}</p>) : <p className="empty-copy tight">No evidence available yet.</p>}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ================= INVENTORY RISK ================= */}
        {activePage === 'Inventory Risk' && (
          <section className="page-view">
            <div className="page-heading">
              <span className="panel-kicker">Inventory Risk</span>
              <h1>Prioritize potential stockout exposure</h1>
              <p>{analysis.risk_msg || 'Inventory-to-sales risk scoring will appear after analysis.'}</p>
            </div>
            <div className="panel table-panel">
              <div className="panel-header"><h4>Highest-risk records</h4><span className="muted-tag">Transparent baseline</span></div>
              {analysis.risk?.length ? (
                <DataTable columns={riskColumns} rows={analysis.risk} initialSort={{ key: 'risk', dir: 'desc' }} searchLabel="Search items or dates" />
              ) : (
                <p className="empty-copy">Inventory risk requires Inventory and Sales columns.</p>
              )}
            </div>
          </section>
        )}

        {/* ================= FORECASTING ================= */}
        {activePage === 'Forecasting' && (
          <section className="page-view">
            <div className="page-heading">
              <span className="panel-kicker">Forecasting</span>
              <h1>Compare baseline, ML, and DL predictions</h1>
              <p>{analysis.model_forecast_msg || 'Upload a dated dataset to train the forecasting models.'}</p>
            </div>
            <div className="panel forecast-hero">
              <div className="panel-header"><h4>Trend and forecasts</h4><span className="muted-tag">Toggle series in the legend</span></div>
              <ForecastChart analysis={analysis} height={300} />
            </div>
            <div className="panel model-compare">
              <div className="panel-header"><h4>Which model should you trust?</h4><span className="muted-tag">Lower error is better</span></div>
              <ModelComparison analysis={analysis} />
            </div>
            <div className="forecast-page-grid">
              <div className="panel table-panel">
                <div className="panel-header"><h4>Random Forest and MLP</h4><span className="muted-tag">Predictive models</span></div>
                {analysis.model_forecast?.length ? <DataTable columns={modelColumns} rows={analysis.model_forecast} initialSort={{ key: 'date', dir: 'asc' }} searchLabel="Search dates" /> : <p className="empty-copy">No ML/DL forecast available yet.</p>}
              </div>
              <div className="panel table-panel">
                <div className="panel-header"><h4>Holt-Winters baseline</h4><span className="muted-tag">Statistical</span></div>
                {analysis.forecast?.length ? <DataTable columns={baselineColumns} rows={analysis.forecast} initialSort={{ key: 'date', dir: 'asc' }} searchLabel="Search dates" /> : <p className="empty-copy">No baseline forecast available yet.</p>}
              </div>
            </div>
          </section>
        )}

        {/* ================= ANOMALIES ================= */}
        {activePage === 'Anomalies' && (
          <section className="page-view">
            <div className="page-heading">
              <span className="panel-kicker">Anomalies</span>
              <h1>Records that look unusual</h1>
              <p>{anomalyRows.length ? `${anomalyRows.length.toLocaleString()} records flagged by ${analysis.anomaly_method || 'the anomaly detector'}. Check each one before acting on it.` : 'The detector did not flag any records in this dataset.'}</p>
            </div>
            <div className="panel table-panel">
              <div className="panel-header"><h4>Flagged rows</h4><span className="muted-tag">{analysis.anomaly_method || 'Detector'}</span></div>
              {anomalyRows.length ? (
                <DataTable columns={anomalyColumns} rows={anomalyRows} initialSort={{ key: '__severity', dir: 'desc' }} searchLabel="Search flagged rows" />
              ) : (
                <p className="empty-copy">Nothing to review.</p>
              )}
            </div>
          </section>
        )}

        {/* ================= COPILOT ================= */}
        {activePage === 'Decision Copilot' && (
          <section className="page-view">
            <div className="page-heading">
              <span className="panel-kicker">Decision Copilot</span>
              <h1>Ask questions about this dataset</h1>
              <p>Answers are grounded in the computed evidence from your analysis.</p>
            </div>
            <div className="panel copilot-page">
              <Copilot chat={chat} question={question} setQuestion={setQuestion} onAsk={askCopilot} loading={decisionLoading} disabled={!hasData} threadHeight={480} />
            </div>
          </section>
        )}

        {/* ================= REPORT ================= */}
        {activePage === 'Executive Report' && (
          <section className="page-view">
            <div className="page-heading">
              <span className="panel-kicker">Executive Report</span>
              <h1>Export the complete decision packet</h1>
              <p>Download KPIs, insights, anomalies, forecasts, root cause, and recommendations as a PDF.</p>
            </div>
            <div className="report-preview panel">
              <div>
                <span className="panel-kicker">Report readiness</span>
                <h4>{hasData ? 'Analysis ready for export' : 'Upload a dataset first'}</h4>
                <p>{hasData ? `${analysis.profile.rows.toLocaleString()} rows processed with analytics, ML, DL, and GenAI evidence.` : 'The report will be generated from the completed analysis.'}</p>
              </div>
              <button type="button" className="action-btn report-btn" onClick={handleReport} disabled={!hasData || reportLoading}>
                {reportLoading ? 'Building report…' : 'Download PDF report'}
              </button>
            </div>
          </section>
        )}
      </main>

      {toast && (
        <div className={`toast ${toast.tone}`} role="status" aria-live="polite">
          <span aria-hidden="true">✓</span> {toast.msg}
        </div>
      )}
    </div>
  );
}

export default App;
