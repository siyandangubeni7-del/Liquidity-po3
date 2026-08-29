import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';

const PO3_PHASES = [
  { key: 'accumulation', label: 'Accumulation' },
  { key: 'manipulation', label: 'Manipulation' },
  { key: 'distribution', label: 'Distribution' },
];

const PREFERRED_KILLZONES = new Set(['london', 'nyam']);
const HISTORY_KEY = 'liquidity-po3-history';
const HISTORY_LIMIT = 200;
const THEME_KEY = 'liquidity-po3-accent';

const THEMES = [
  { id: 'cyan', accent: '#00d4ff', dim: '#00a8cc' },
  { id: 'violet', accent: '#8b5cf6', dim: '#6d3fd1' },
  { id: 'magenta', accent: '#ff2e9a', dim: '#d1187a' },
  { id: 'emerald', accent: '#00ffb2', dim: '#00cc8e' },
  { id: 'amber', accent: '#ffb300', dim: '#cc8f00' },
  { id: 'ice', accent: '#7dd3fc', dim: '#38bdf8' },
];

function hexToRgbString(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-dim', theme.dim);
  root.style.setProperty('--accent-rgb', hexToRgbString(theme.accent));
}

function normalizeKillzone(kz = '') {
  return kz.toLowerCase().replace(/[\s_-]/g, '');
}

function evaluateFilter(result) {
  const reasons = [];
  const rr = Number(result.riskReward);
  if (!Number.isFinite(rr) || rr < 2) {
    reasons.push(`R:R is ${Number.isFinite(rr) ? rr.toFixed(2) : 'unknown'} — below the 1:2 minimum`);
  }
  const kz = normalizeKillzone(result.killzone);
  if (!PREFERRED_KILLZONES.has(kz)) {
    reasons.push(`Session "${result.killzone || 'unknown'}" is outside London / NY AM killzones`);
  }
  return { pass: reasons.length === 0, reasons };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
  } catch {
    // storage full or unavailable — fail silently, journal is a nice-to-have
  }
}

function SweepMark() {
  return (
    <svg width="72" height="28" viewBox="0 0 72 28" fill="none" aria-hidden="true">
      <path d="M2 20 L18 20 L24 8 L30 24 L36 4 L42 22 L48 12 L54 20 L70 20"
        stroke="var(--accent)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="8" r="2" fill="var(--accent-sell)" />
      <circle cx="36" cy="4" r="2" fill="var(--accent)" />
    </svg>
  );
}

function Phase3Strip({ current }) {
  return (
    <div className="phase-strip" role="list" aria-label="PO3 phase">
      {PO3_PHASES.map((p, i) => {
        const active = p.key === (current || '').toLowerCase();
        return (
          <div key={p.key} className={`phase-seg ${active ? 'active' : ''}`} role="listitem">
            <span className="phase-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="phase-label">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function LiquidityBar({ entry, stopLoss, takeProfit, direction }) {
  const e = Number(entry), sl = Number(stopLoss), tp = Number(takeProfit);
  if (![e, sl, tp].every(Number.isFinite)) return null;
  const risk = Math.abs(e - sl);
  const reward = Math.abs(tp - e);
  const total = risk + reward || 1;
  const riskPct = (risk / total) * 100;
  const rewardPct = 100 - riskPct;
  const isBuy = (direction || '').toLowerCase().includes('buy');
  return (
    <div className="liq-bar-wrap">
      <div className="liq-bar-label">
        <span>SELL-SIDE POOL</span>
        <span>BUY-SIDE POOL</span>
      </div>
      <div className="liq-bar">
        <div className="liq-seg risk" style={{ width: `${isBuy ? riskPct : rewardPct}%` }} />
        <div className="liq-seg reward" style={{ width: `${isBuy ? rewardPct : riskPct}%` }} />
        <div className="liq-marker" style={{ left: `${isBuy ? riskPct : rewardPct}%` }} />
      </div>
      <div className="liq-bar-vals">
        <span>{sl.toFixed(2)}</span>
        <span className="entry-val">{e.toFixed(2)} entry</span>
        <span>{tp.toFixed(2)}</span>
      </div>
    </div>
  );
}

function ThemeSwitcher({ current, onSelect }) {
  return (
    <div className="theme-row">
      <span className="theme-label">COLOR</span>
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`swatch ${current === t.id ? 'active' : ''}`}
          style={{ background: t.accent }}
          onClick={() => onSelect(t)}
          aria-label={`${t.id} theme`}
        />
      ))}
    </div>
  );
}

const SESSIONS = [
  { key: 'asia', label: 'Asian', start: 0, end: 7 },
  { key: 'london', label: 'London Killzone', start: 7, end: 12 },
  { key: 'nyam', label: 'NY AM Killzone', start: 12, end: 15 },
  { key: 'nylunch', label: 'NY Lunch', start: 15, end: 17 },
  { key: 'nypm', label: 'NY PM', start: 17, end: 20 },
  { key: 'latenyc', label: 'Late NY', start: 20, end: 24 },
];

function getUtcHourDecimal(date) {
  return date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
}

function minutesUntil(currentHour, targetHour) {
  let diff = targetHour - currentHour;
  if (diff <= 0) diff += 24;
  return Math.round(diff * 60);
}

function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function getKillzoneStatus(date) {
  const hour = getUtcHourDecimal(date);
  const current = SESSIONS.find((s) => hour >= s.start && hour < s.end) || SESSIONS[SESSIONS.length - 1];
  const isPreferred = PREFERRED_KILLZONES.has(current.key);

  if (isPreferred) {
    const minsLeft = minutesUntil(hour, current.end === 24 ? 0 : current.end);
    return { current, isPreferred: true, message: `Ends in ${formatMinutes(minsLeft)}` };
  }

  const londonStart = minutesUntil(hour, 7);
  const nyStart = minutesUntil(hour, 12);
  const next = londonStart <= nyStart ? { label: 'London', mins: londonStart } : { label: 'NY AM', mins: nyStart };
  return { current, isPreferred: false, message: `${next.label} opens in ${formatMinutes(next.mins)}` };
}

function KillzoneClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const status = getKillzoneStatus(now);
  const utcLabel = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const localLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`clock-card ${status.isPreferred ? 'pass' : 'flag'}`}>
      <div className="clock-top">
        <span className="verdict-dot" />
        <span className="clock-session">{status.current.label}</span>
      </div>
      <div className="clock-times">
        <span>{localLabel} local</span>
        <span className="clock-sep">·</span>
        <span>{utcLabel} UTC</span>
      </div>
      <div className="clock-msg">{status.message}</div>
    </div>
  );
}

function DataCell({ label, value }) {
  return (
    <div className="cell">
      <div className="cell-label">{label}</div>
      <div className="cell-value">{value ?? '—'}</div>
    </div>
  );
}

function ResultCard({ result }) {
  const filter = evaluateFilter(result);
  const isBuy = (result.direction || '').toLowerCase().includes('buy');
  return (
    <section className="result-card">
      <Phase3Strip current={result.po3Phase} />

      <div className={`verdict ${filter.pass ? 'pass' : 'flag'}`}>
        <span className="verdict-dot" />
        {filter.pass ? (
          <span>PASSES RISK FILTER — ≥1:2 R:R, preferred killzone</span>
        ) : (
          <span>FLAGGED — {filter.reasons.join('; ')}</span>
        )}
      </div>

      <div className="direction-row">
        <div className={`direction ${isBuy ? 'buy' : 'sell'}`}>
          {isBuy ? '↗' : '↘'} {(result.direction || '—').toUpperCase()}
        </div>
        <div className="confidence">
          <span className="conf-label">CONFIDENCE</span>
          <span className="conf-val">{result.confidence ?? '—'}%</span>
        </div>
      </div>

      <div className="strategy-box">
        <div className="cell-label">STRATEGY</div>
        <div className="strategy-text">{result.strategy}</div>
        {result.grade && <div className="grade-pill">{result.grade}</div>}
      </div>

      <LiquidityBar
        entry={result.entry}
        stopLoss={result.stopLoss}
        takeProfit={result.takeProfit}
        direction={result.direction}
      />

      <div className="grid">
        <DataCell label="PAIR" value={result.pair} />
        <DataCell label="TIMEFRAME" value={result.chartTimeframe} />
        <DataCell label="MACRO FRAME" value={result.macroFrame} />
        <DataCell label="MICRO FRAME" value={result.microFrame} />
        <DataCell label="SESSION" value={result.killzone} />
        <DataCell label="RISK : REWARD" value={result.riskReward} />
        <DataCell label="ENTRY" value={result.entry} />
        <DataCell label="STOP LOSS" value={result.stopLoss} />
        <DataCell label="TAKE PROFIT" value={result.takeProfit} />
      </div>

      {result.nextTrigger && (
        <div className="trigger-box">
          <div className="cell-label">NEXT TRIGGER</div>
          <div className="trigger-text">{result.nextTrigger}</div>
        </div>
      )}
    </section>
  );
}

function HistoryView({ entries, onSetOutcome, onDelete, onClear }) {
  const total = entries.length;
  const passCount = entries.filter((e) => e.pass).length;
  const decided = entries.filter((e) => e.outcome === 'tp' || e.outcome === 'sl');
  const wins = decided.filter((e) => e.outcome === 'tp').length;
  const winRate = decided.length ? Math.round((wins / decided.length) * 100) : null;

  if (total === 0) {
    return (
      <div className="history-empty">
        <p>No scans saved yet.</p>
        <p className="dz-sub">Run a scan and it'll show up here automatically.</p>
      </div>
    );
  }

  return (
    <div className="history-wrap">
      <div className="stats-row">
        <div className="stat-card">
          <div className="cell-label">TOTAL SCANS</div>
          <div className="stat-val">{total}</div>
        </div>
        <div className="stat-card">
          <div className="cell-label">PASSED FILTER</div>
          <div className="stat-val">{Math.round((passCount / total) * 100)}%</div>
        </div>
        <div className="stat-card">
          <div className="cell-label">WIN RATE</div>
          <div className="stat-val">{winRate === null ? '—' : `${winRate}%`}</div>
        </div>
      </div>
      {winRate === null && (
        <p className="hint-text">Mark outcomes below (TP / SL) as trades play out to start tracking your real win rate.</p>
      )}

      <div className="history-list">
        {entries.map((e) => (
          <div key={e.id} className="history-item">
            <div className="hist-top">
              <span className={`hist-dir ${e.direction === 'buy' ? 'buy' : 'sell'}`}>
                {e.direction === 'buy' ? '↗ BUY' : '↘ SELL'}
              </span>
              <span className="hist-date">{new Date(e.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="hist-mid">
              <span>{e.pair || 'unknown pair'} · {e.chartTimeframe || '—'}</span>
              <span className={`hist-badge ${e.pass ? 'pass' : 'flag'}`}>{e.pass ? 'PASS' : 'FLAGGED'}</span>
            </div>
            <div className="hist-vals">
              R:R {e.riskReward ?? '—'} · Entry {e.entry ?? '—'} · SL {e.stopLoss ?? '—'} · TP {e.takeProfit ?? '—'}
            </div>
            <div className="hist-actions">
              <button
                className={`outcome-btn tp ${e.outcome === 'tp' ? 'active' : ''}`}
                onClick={() => onSetOutcome(e.id, e.outcome === 'tp' ? 'pending' : 'tp')}
              >TP HIT</button>
              <button
                className={`outcome-btn sl ${e.outcome === 'sl' ? 'active' : ''}`}
                onClick={() => onSetOutcome(e.id, e.outcome === 'sl' ? 'pending' : 'sl')}
              >SL HIT</button>
              <button className="outcome-btn del" onClick={() => onDelete(e.id)}>DELETE</button>
            </div>
          </div>
        ))}
      </div>

      <button className="clear-btn" onClick={onClear}>Clear all history</button>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('scan');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [themeId, setThemeId] = useState('cyan');
  const inputRef = useRef(null);

  useEffect(() => {
    setHistory(loadHistory());
    const savedId = localStorage.getItem(THEME_KEY);
    const found = THEMES.find((t) => t.id === savedId) || THEMES[0];
    setThemeId(found.id);
    applyTheme(found);
  }, []);

  const selectTheme = (theme) => {
    setThemeId(theme.id);
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme.id); } catch {}
  };

  const handleFile = useCallback((f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setPreview(URL.createObjectURL(f));
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const scan = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: file.type || 'image/jpeg' }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setResult(data);

      const filter = evaluateFilter(data);
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        direction: (data.direction || '').toLowerCase(),
        pair: data.pair,
        chartTimeframe: data.chartTimeframe,
        riskReward: data.riskReward,
        entry: data.entry,
        stopLoss: data.stopLoss,
        takeProfit: data.takeProfit,
        killzone: data.killzone,
        pass: filter.pass,
        outcome: 'pending',
      };
      setHistory((prev) => {
        const next = [entry, ...prev];
        saveHistory(next);
        return next;
      });
    } catch (err) {
      setError(err.message || 'Scan failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const setOutcome = (id, outcome) => {
    setHistory((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, outcome } : e));
      saveHistory(next);
      return next;
    });
  };

  const deleteEntry = (id) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveHistory(next);
      return next;
    });
  };

  const clearHistory = () => {
    if (!window.confirm('Clear all saved scan history? This can\'t be undone.')) return;
    setHistory([]);
    saveHistory([]);
  };

  return (
    <div className="page">
      <header className="header">
        <div className="wordmark">
          <span className="w-top">LIQUIDITY</span>
          <span className="w-bottom">PO3</span>
        </div>
        <SweepMark />
      </header>

      <ThemeSwitcher current={themeId} onSelect={selectTheme} />

      <div className="tabs">
        <button className={`tab-btn ${tab === 'scan' ? 'active' : ''}`} onClick={() => setTab('scan')}>SCAN</button>
        <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          HISTORY {history.length > 0 && <span className="tab-count">{history.length}</span>}
        </button>
      </div>

      {tab === 'scan' ? (
        <main className="main">
          <KillzoneClock />
          <section
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {preview ? (
              <img src={preview} alt="Uploaded chart preview" className="preview" />
            ) : (
              <div className="dropzone-empty">
                <div className="dz-icon">⌁</div>
                <p>Tap to upload a chart screenshot</p>
                <p className="dz-sub">PNG or JPG · M5–H4 works best</p>
              </div>
            )}
          </section>

          <button className="scan-btn" onClick={scan} disabled={!file || loading}>
            {loading ? 'SCANNING…' : 'SCAN CHART'}
          </button>

          {error && <div className="error-banner">{error}</div>}

          {result && <ResultCard result={result} />}
        </main>
      ) : (
        <main className="main">
          <HistoryView entries={history} onSetOutcome={setOutcome} onDelete={deleteEntry} onClear={clearHistory} />
        </main>
      )}

      <footer className="footer">
        Screenshot analysis, not live market data. Not financial advice. History is saved only on this device/browser.
      </footer>
    </div>
  );
}
