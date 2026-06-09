/* App bootstrap — navigation, clock, market ticker */
class App {
  constructor() {
    this.currentSection = 'portfolio';
  }

  init() {
    // Init all modules
    portfolio.init();
    etfAnalyzer.init();
    research.init();
    macro.init();
    mc.init();
    this.initNav();
    this.startClock();
    this.renderTicker();
    this.initSettings();
    this.checkApiKey();

    // Resize canvas on section show
    window.addEventListener('resize', () => {
      if (this.currentSection === 'montecarlo') mc.redraw();
    });
  }

  initNav() {
    document.querySelectorAll('.nav-item[data-section]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        this.navigate(el.dataset.section);
      });
    });
  }

  navigate(section) {
    this.currentSection = section;
    document.querySelectorAll('.section').forEach(s => {
      s.classList.toggle('active', s.id === `section-${section}`);
      s.style.display = s.id === `section-${section}` ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-item[data-section]').forEach(el => {
      el.classList.toggle('active', el.dataset.section === section);
    });

    // Lazy init / refresh
    if (section === 'montecarlo') {
      setTimeout(() => { const c = document.getElementById('mc-canvas'); if (c) { c.width = c.offsetWidth * window.devicePixelRatio; c.height = c.offsetHeight * window.devicePixelRatio; }}, 50);
    }
  }

  startClock() {
    const update = () => {
      const now = new Date();
      setText('clock', now.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + ' CET');
    };
    update();
    setInterval(update, 1000);
  }

  renderTicker() {
    const tickers = [
      { sym: 'S&P 500',  val: '5,460.48', chg: '+0.51%', pos: true },
      { sym: 'NASDAQ',   val: '17,862.23',chg: '+0.84%', pos: true },
      { sym: 'DAX',      val: '18,421.00',chg: '-0.12%', pos: false },
      { sym: 'MSCI World',val:'3,754.80', chg: '+0.38%', pos: true },
      { sym: 'EUR/USD',  val: '1.0842',   chg: '+0.09%', pos: true },
      { sym: 'Gold',     val: '$2,324',   chg: '+0.32%', pos: true },
      { sym: 'BTC',      val: '$67,420',  chg: '+2.14%', pos: true },
      { sym: 'VIX',      val: '14.82',    chg: '-3.8%',  pos: false },
      { sym: '10Y UST',  val: '4.28%',    chg: '-0.04',  pos: false },
    ];
    document.getElementById('market-ticker').innerHTML = tickers.map(t => `
      <div class="ticker-item">
        <span class="ticker-sym">${t.sym}</span>
        <span class="ticker-val">${t.val}</span>
        <span class="ticker-chg ${t.pos ? 'green' : 'red'}">${t.chg}</span>
      </div>`).join('');
  }

  initSettings() {
    document.getElementById('save-av-btn').addEventListener('click', () => {
      const key = document.getElementById('av-key-input').value.trim();
      if (key) {
        localStorage.setItem('av_key', key);
        showToast('API key saved', 'success');
        this.checkApiKey();
      }
    });

    document.getElementById('test-av-btn').addEventListener('click', async () => {
      const key = document.getElementById('av-key-input').value.trim();
      if (!key) { showToast('Enter a key first', 'error'); return; }
      try {
        const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${key}`);
        const d   = await res.json();
        if (d['Global Quote'] && d['Global Quote']['05. price']) {
          document.getElementById('av-test-result').innerHTML = `<span class="green">✓ Connected — AAPL: $${parseFloat(d['Global Quote']['05. price']).toFixed(2)}</span>`;
          localStorage.setItem('av_key', key);
          this.checkApiKey();
        } else if (d.Note || d.Information) {
          document.getElementById('av-test-result').innerHTML = `<span class="red">Rate limited — try again in a minute</span>`;
        } else {
          document.getElementById('av-test-result').innerHTML = `<span class="red">Invalid key or no response</span>`;
        }
      } catch {
        document.getElementById('av-test-result').innerHTML = `<span class="red">Network error</span>`;
      }
    });
  }

  checkApiKey() {
    const hasKey = !!localStorage.getItem('av_key');
    const badge  = document.getElementById('av-status-indicator');
    if (badge) {
      badge.textContent  = hasKey ? 'Active' : 'Needs Key';
      badge.className    = `badge ${hasKey ? 'badge-green' : 'badge-yellow'}`;
    }
    if (hasKey) {
      const inp = document.getElementById('av-key-input');
      if (inp && !inp.value) inp.value = localStorage.getItem('av_key');
    }
  }
}

// First-time section visibility setup
document.querySelectorAll('.section').forEach(s => {
  s.style.display = s.classList.contains('active') ? 'block' : 'none';
});

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
