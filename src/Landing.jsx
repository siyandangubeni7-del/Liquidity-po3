function LogoMark() {
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" fill="none" aria-hidden="true">
      <path d="M0 20 L8 0 L11 0 L3 20 Z" fill="var(--accent)" />
      <path d="M9 20 L17 0 L20 0 L12 20 Z" fill="var(--accent)" opacity="0.65" />
      <path d="M18 20 L26 0 L26 4 L20.5 20 Z" fill="var(--accent)" opacity="0.35" />
    </svg>
  );
}

function ScanBadge() {
  return (
    <div className="scan-badge">
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <path id="badgeCircle" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <text fontSize="7.6" letterSpacing="2.2" fill="var(--text-muted)">
          <textPath href="#badgeCircle" startOffset="0%">
            LIVE SINCE 2026 · ICT / PO3 FRAMEWORK · AI VISION SCAN ·
          </textPath>
        </text>
      </svg>
      <div className="scan-badge-core">
        <span>AI</span>
        <span>SCAN</span>
      </div>
    </div>
  );
}

const HOW_STEPS = [
  { n: '01', title: 'Upload', body: 'Drop in a screenshot of any chart — MT5, TradingView, wherever you trade.' },
  { n: '02', title: 'AI Analysis', body: 'Gemini vision reads the candles, structure, and liquidity visually, like a trader would.' },
  { n: '03', title: 'PO3 Detection', body: 'Direction, phase, entry/SL/TP, and a pass/reject verdict against your risk filter.' },
  { n: '04', title: 'Track Results', body: 'Every scan logs to your journal — mark outcomes and build a real track record.' },
];

const TICKER_ITEMS = ['UPLOAD', 'AI ANALYSIS', 'PO3 DETECTION', 'RISK FILTER', 'TRACK RESULTS'];

export default function Landing({ onEnter }) {
  return (
    <div className="landing">
      <nav className="land-nav">
        <div className="land-brand">
          <LogoMark />
          <span>LIQUIDITY PO3</span>
        </div>
        <div className="land-links">
          <a href="#how">How it works</a>
          <a href="#framework">Framework</a>
        </div>
        <button className="land-cta-small" onClick={onEnter}>
          <span className="dot" /> Scan Chart
        </button>
      </nav>

      <header className="land-hero">
        <div className="land-hero-text">
          <span className="land-kicker">— SINCE 2026 · AI CHART ANALYSIS</span>
          <h1 className="land-headline">
            See the Setup.<br />
            <em>Understand the Liquidity.</em>
          </h1>
          <p className="land-sub">
            Liquidity PO3 reads your uploaded chart screenshots through an ICT / Power of Three
            framework — liquidity sweeps, order blocks, fair value gaps — and hands back a
            structured, filtered verdict. Not live market data. A second pair of eyes.
          </p>
          <div className="land-btn-row">
            <button className="land-cta-main" onClick={onEnter}>Scan Your Chart</button>
            <a className="land-cta-outline" href="#how"><span className="dot" /> How it works</a>
          </div>
        </div>

        <div className="land-hero-visual">
          <div className="land-visual-panel">
            <div className="land-visual-scanline" />
            <div className="land-visual-grid" />
            <div className="land-visual-readout">
              <span>DIRECTION</span>
              <strong>BUY</strong>
              <span>PO3 · DISTRIBUTION</span>
            </div>
          </div>
          <ScanBadge />
        </div>

        <div className="land-bg-word" aria-hidden="true">PO3</div>
      </header>

      <div className="land-tags-row">
        <span>ICT-based analysis</span>
        <span className="sep">·</span>
        <span>Built-in risk filter</span>
        <span className="sep">·</span>
        <span>Free to scan</span>
      </div>

      <section className="land-how" id="how">
        <div className="land-how-heading">
          <span className="land-eyebrow">HOW IT WORKS</span>
          <h2>From screenshot to structured setup, in seconds.</h2>
        </div>
        <div className="land-how-grid">
          {HOW_STEPS.map((s) => (
            <div key={s.n} className="land-how-card">
              <span className="land-how-num">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="land-ticker" id="framework">
        <div className="land-ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
            <span key={i}>{t} <span className="land-ticker-dot">◆</span></span>
          ))}
        </div>
      </div>

      <section className="land-final">
        <h2>Read the next setup properly.</h2>
        <button className="land-cta-main" onClick={onEnter}>Scan Your Chart</button>
        <p className="land-disclaimer">Screenshot analysis, not live market data. Not financial advice.</p>
      </section>
    </div>
  );
}
