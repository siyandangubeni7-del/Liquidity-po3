import { useState, useRef, useCallback } from 'react';
import './App.css';

const PO3_PHASES = [
  { key: 'accumulation', label: 'Accumulation' },
  { key: 'manipulation', label: 'Manipulation' },
  { key: 'distribution', label: 'Distribution' },
];

const PREFERRED_KILLZONES = new Set(['london', 'nyam']);

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

function DataCell({ label, value }) {
  return (
    <div className="cell">
      <div className="cell-label">{label}</div>
      <div className="cell-value">{value ?? '—'}</div>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

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
    } catch (err) {
      setError(err.message || 'Scan failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const filter = result ? evaluateFilter(result) : null;
  const isBuy = result && (result.direction || '').toLowerCase().includes('buy');

  return (
    <div className="page">
      <header className="header">
        <div className="wordmark">
          <span className="w-top">LIQUIDITY</span>
          <span className="w-bottom">PO3</span>
        </div>
        <SweepMark />
      </header>

      <main className="main">
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

        {result && (
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
        )}
      </main>

      <footer className="footer">
        Screenshot analysis, not live market data. Not financial advice.
      </footer>
    </div>
  );
}
