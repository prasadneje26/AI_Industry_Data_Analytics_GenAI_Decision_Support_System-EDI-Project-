import { useMemo, useState } from 'react';

const navItems = ['Dashboard', 'Analytics', 'Forecasts', 'Root Cause', 'Decisions'];

const sidebarItems = [
  'Industry Overview',
  'Data Quality',
  'AI Root Cause',
  'Inventory Risk',
  'Forecasting',
  'Executive Report',
];

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [decision, setDecision] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [activeView, setActiveView] = useState('Dashboard');
  const [activePage, setActivePage] = useState('Industry Overview');
  const [analysis, setAnalysis] = useState({
    profile: {},
    kpis: {},
    insights: [],
    anomalies: [],
    forecast: [],
    model_forecast: [],
    models: {},
    root: '',
    actions: '',
  });

  const summaryStats = useMemo(() => {
    const p = analysis.profile || {};
    return [
      { label: 'Rows', value: p.rows ? p.rows.toLocaleString() : '—' },
      { label: 'Columns', value: p.columns ?? '—' },
      { label: 'Missing', value: p.missing_cells ?? '—' },
      { label: 'Duplicates', value: p.duplicates ?? '—' },
    ];
  }, [analysis.profile]);

  const handleSubmit = async () => {
    if (!file) {
      setError('Please choose a CSV or Excel file first.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Analysis failed');
      }

      setAnalysis(data);
    } catch (err) {
      setError(err.message || 'Something went wrong during analysis.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async () => {
    if (!question.trim() || !analysis.profile?.rows) return;
    setDecisionLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:8000/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, evidence: analysis }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Decision request failed');
      setDecision(data.answer);
    } catch (err) {
      setError(err.message || 'Unable to reach the decision copilot.');
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleReport = async () => {
    if (!analysis.profile?.rows) return;
    setReportLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:8000/report', {
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
    } catch (err) {
      setError(err.message || 'Unable to generate the executive report.');
    } finally {
      setReportLoading(false);
    }
  };

  const navigateTo = (view) => {
    setActiveView(view);
    const target = document.getElementById(view.toLowerCase().replaceAll(' ', '-'));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openPage = (page) => {
    setActivePage(page);
    setActiveView(page === 'AI Root Cause' ? 'Root Cause' : page === 'Forecasting' ? 'Forecasts' : 'Dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-icon">AI</div>
          <div>
            <p className="mini-label">Industry AI</p>
            <h3>Decision Support</h3>
            <span className="week-tag">System</span>
          </div>
        </div>

        <div className="nav-stack">
          {sidebarItems.map((item) => (
            <button key={item} onClick={() => openPage(item)} className={`nav-item ${activePage === item ? 'active' : ''}`}>
              <span className="nav-dot" />
              <span>{item}</span>
            </button>
          ))}
        </div>

        <div className="upload-box">
          <label className="upload-label">
            <span>Upload CSV / Excel</span>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <button className="action-btn" onClick={handleSubmit} disabled={loading || !file}>
            {loading ? 'Analyzing...' : 'Analyze Data'}
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header id="dashboard" className="topbar">
          <nav className="topnav">
            {navItems.map((item) => (
              <button key={item} onClick={() => navigateTo(item)} className={activeView === item ? 'nav-pill active' : 'nav-pill'}>{item}</button>
            ))}
          </nav>

          <div className="top-actions">
            <span className="icon">⌕</span>
            <span className="icon">◌</span>
            <div className="user-pill">Operations Lead</div>
          </div>
        </header>

        {error && <div className="alert error">{error}</div>}

        {activePage === 'Industry Overview' && <>

        <section id="analytics" className="stats-row">
          {summaryStats.map((card) => (
            <div className="stat-card" key={card.label}>
              <span className="card-label">{card.label}</span>
              <div className="card-value-row">
                <strong>{card.value}</strong>
                <span className="trend">{analysis.profile?.rows ? 'Live' : 'Awaiting data'}</span>
              </div>
            </div>
          ))}
        </section>

        <section id="forecasts" className="content-grid">
          <div className="panel large-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Sales trend</span>
                <h4>{analysis.kpis?.Sales ? `$ ${Number(analysis.kpis.Sales).toLocaleString()}` : 'Upload dataset'}</h4>
              </div>
              <span className="muted-tag">Time series</span>
            </div>
            <svg viewBox="0 0 640 220" className="line-chart" preserveAspectRatio="none">
              <path d="M0 150 C100 100, 140 160, 220 120 S380 40, 470 90 S590 120, 640 100" />
            </svg>
            <div className="mini-meta">
              <span>ML / DL forecast</span>
              <strong>{analysis.model_forecast?.length ? 'Available' : 'Pending'}</strong>
            </div>
          </div>

          <div className="side-stack">
            <div className="panel small-panel accent-panel">
              <div className="panel-header compact">
                <span className="panel-kicker">Inventory risk</span>
                <span className="mini-flag">AI model</span>
              </div>
              <div className="big-number">{analysis.risk?.length ? `${analysis.risk.filter((item) => item.risk_level === 'High').length} high-risk` : 'Awaiting data'}</div>
              <svg viewBox="0 0 220 70" className="mini-chart" preserveAspectRatio="none">
                <path d="M0 45 C40 30, 60 40, 100 35 S160 30, 220 25" />
              </svg>
            </div>

            <div className="panel small-panel">
              <div className="panel-header compact">
                <span className="panel-kicker">Delivery risk</span>
                <span className="mini-flag warn">Watch</span>
              </div>
              <div className="goal-ring-wrap">
                <div className="goal-ring"><span>{analysis.model_forecast?.length ? 'AI' : '—'}</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel list-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Business insight</span>
                <h4>{analysis.insights?.[0] ? 'Top signal' : 'Awaiting analysis'}</h4>
              </div>
              <span className="muted-tag">Evidence based</span>
            </div>
            <div className="ticket-list">
              {analysis.insights?.length ? (
                analysis.insights.slice(0, 3).map((item, index) => (
                  <div className="ticket-row" key={index}>
                    <div className={`avatar ${index % 3 === 0 ? 'blue' : index % 3 === 1 ? 'purple' : 'orange'}`}>
                      {index + 1}
                    </div>
                    <div>
                      <strong>{item.split(':')[0] || 'Insight'}</strong>
                      <small>{item.length > 45 ? item.slice(0, 45) + '...' : item}</small>
                    </div>
                  </div>
                ))
              ) : (
                <div className="ticket-row">
                  <div className="avatar blue">•</div>
                  <div>
                    <strong>Upload dataset</strong>
                    <small>Data quality, forecasting, and AI diagnosis will appear here.</small>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div id="root-cause" className="panel insights-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">AI insights</span>
                <h4>Decision support</h4>
              </div>
            </div>
            <div className="insight-stack">
              {analysis.root ? (
                <>
                  <p>{analysis.root.slice(0, 220)}{analysis.root.length > 220 ? '...' : ''}</p>
                  {analysis.actions && <p>{analysis.actions.slice(0, 220)}{analysis.actions.length > 220 ? '...' : ''}</p>}
                </>
              ) : (
                <p>Upload a dataset to view AI-generated root-cause analysis, forecast signals, and management recommendations.</p>
              )}
            </div>
            <div id="decisions" className="copilot-form">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask the manager copilot a question"
                disabled={!analysis.profile?.rows || decisionLoading}
              />
              <button className="action-btn compact-btn" onClick={handleDecision} disabled={!question.trim() || decisionLoading}>
                {decisionLoading ? 'Thinking...' : 'Ask AI'}
              </button>
            </div>
            {decision && <p className="decision-answer">{decision}</p>}
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
            {analysis.model_forecast?.length ? (
              <div className="forecast-table">
                {analysis.model_forecast.slice(0, 6).map((item) => (
                  <div className="forecast-row" key={item.date}>
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                    <strong>RF {Number(item.ml_forecast).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                    <strong>DL {Number(item.dl_forecast).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-copy">Upload a dataset with a date column and numeric sales or demand measure.</p>
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
              <span>Manager Q&A</span>
            </div>
          </div>
        </section>

        <section className="report-strip">
          <div>
            <span className="panel-kicker">Executive report</span>
            <strong>Export the evidence packet, model outputs, and recommendations.</strong>
          </div>
          <button className="action-btn report-btn" onClick={handleReport} disabled={!analysis.profile?.rows || reportLoading}>
            {reportLoading ? 'Building report...' : 'Download PDF report'}
          </button>
        </section>
        </>}

        {activePage === 'Data Quality' && <section className="page-view">
          <div className="page-heading">
            <span className="panel-kicker">Data Quality</span>
            <h1>Understand and prepare the source dataset</h1>
            <p>Profiling, type detection, duplicate checks, and transparent cleaning actions.</p>
          </div>
          <section className="stats-row">
            {summaryStats.map((card) => <div className="stat-card" key={card.label}><span className="card-label">{card.label}</span><strong className="page-stat">{card.value}</strong></div>)}
          </section>
          <div className="quality-grid">
            <div className="panel">
              <div className="panel-header"><h4>Detected column types</h4><span className="muted-tag">Profile</span></div>
              <div className="quality-list"><strong>Numeric</strong><span>{analysis.profile?.numeric?.join(', ') || 'Awaiting data'}</span><strong>Categorical</strong><span>{analysis.profile?.categorical?.join(', ') || 'Awaiting data'}</span><strong>Date / time</strong><span>{analysis.profile?.datetime?.join(', ') || 'Awaiting data'}</span></div>
            </div>
            <div className="panel">
              <div className="panel-header"><h4>Cleaning log</h4><span className="muted-tag">Auditable</span></div>
              <div className="quality-list">{analysis.changes?.length ? analysis.changes.map((change) => <span key={change}>{change}</span>) : <span>Upload a dataset to generate a cleaning log.</span>}</div>
            </div>
          </div>
        </section>}

        {activePage === 'AI Root Cause' && <section className="page-view">
          <div className="page-heading"><span className="panel-kicker">AI Root Cause</span><h1>Evidence-based diagnosis</h1><p>The GenAI model separates observed signals from probable contributing factors.</p></div>
          <div className="root-page-grid">
            <div className="panel root-output"><div className="panel-header"><h4>Root-cause analysis</h4><span className="muted-tag">Grounded GenAI</span></div><p>{analysis.root || 'Upload and analyze a dataset to generate the root-cause analysis.'}</p></div>
            <div className="panel"><div className="panel-header"><h4>Evidence signals</h4><span className="muted-tag">Computed</span></div><div className="insight-stack">{analysis.insights?.length ? analysis.insights.map((item) => <p key={item}>{item}</p>) : <p>No evidence available yet.</p>}</div></div>
          </div>
        </section>}

        {activePage === 'Inventory Risk' && <section className="page-view">
          <div className="page-heading"><span className="panel-kicker">Inventory Risk</span><h1>Prioritize potential stockout exposure</h1><p>{analysis.risk_msg || 'Inventory-to-sales risk scoring will appear after analysis.'}</p></div>
          <div className="panel table-panel"><div className="panel-header"><h4>Highest-risk records</h4><span className="muted-tag">Transparent baseline</span></div>{analysis.risk?.length ? <div className="data-table">{analysis.risk.map((item, index) => <div className="data-row" key={`${item.Order_Date || index}-${item.Product || ''}`}><span>{item.Order_Date || 'Record ' + (index + 1)}</span><span>{item.Product || item.Category || 'Business item'}</span><strong className={item.risk_level === 'High' ? 'risk-high' : ''}>{item.risk_level} · {(Number(item.stockout_risk) * 100).toFixed(1)}%</strong></div>)}</div> : <p className="empty-copy">Inventory risk requires Inventory and Sales columns.</p>}</div>
        </section>}

        {activePage === 'Forecasting' && <section className="page-view">
          <div className="page-heading"><span className="panel-kicker">Forecasting</span><h1>Compare baseline, ML, and DL predictions</h1><p>{analysis.model_forecast_msg || 'Upload a dated dataset to train the forecasting models.'}</p></div>
          <div className="forecast-page-grid"><div className="panel table-panel"><div className="panel-header"><h4>Random Forest and MLP</h4><span className="muted-tag">Predictive models</span></div>{analysis.model_forecast?.length ? <div className="data-table">{analysis.model_forecast.map((item) => <div className="data-row" key={item.date}><span>{new Date(item.date).toLocaleDateString()}</span><strong>RF {Number(item.ml_forecast).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong><strong>DL {Number(item.dl_forecast).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div>)}</div> : <p className="empty-copy">No ML/DL forecast available yet.</p>}</div><div className="panel table-panel"><div className="panel-header"><h4>Holt-Winters baseline</h4><span className="muted-tag">Statistical</span></div>{analysis.forecast?.length ? <div className="data-table">{analysis.forecast.map((item) => <div className="data-row" key={item.date}><span>{new Date(item.date).toLocaleDateString()}</span><strong>{Number(item.forecast).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div>)}</div> : <p className="empty-copy">No baseline forecast available yet.</p>}</div></div>
        </section>}

        {activePage === 'Executive Report' && <section className="page-view">
          <div className="page-heading"><span className="panel-kicker">Executive Report</span><h1>Export the complete decision packet</h1><p>Download KPIs, insights, anomalies, forecasts, root cause, and recommendations as a PDF.</p></div>
          <div className="report-preview panel"><div><span className="panel-kicker">Report readiness</span><h4>{analysis.profile?.rows ? 'Analysis ready for export' : 'Upload a dataset first'}</h4><p>{analysis.profile?.rows ? `${analysis.profile.rows.toLocaleString()} rows processed with analytics, ML, DL, and GenAI evidence.` : 'The report will be generated from the completed analysis.'}</p></div><button className="action-btn report-btn" onClick={handleReport} disabled={!analysis.profile?.rows || reportLoading}>{reportLoading ? 'Building report...' : 'Download PDF report'}</button></div>
        </section>}
      </main>
    </div>
  );
}

export default App;
