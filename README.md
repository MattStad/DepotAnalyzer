# ◈ DepotAnalyzer

**A privacy-first portfolio analytics tool that runs entirely in your browser — no server, no accounts, no data leaving your machine.**

🔗 **Live Demo:** [https://mattstad.github.io/DepotAnalyzer/](https://mattstad.github.io/DepotAnalyzer/)

---

## What it does

You import your brokerage export (XLS), and the app gives you a deep look at what's actually inside your portfolio — not just tickers and values, but the underlying stocks across all your ETFs, overlap between positions, regional and sector allocation, and live macro context.

It's built for someone who holds a mix of ETFs and individual stocks across multiple portfolios and wants answers to questions like:

- *"I own IWDA and VWRL — what am I actually doubling up on?"*
- *"What's my real tech exposure once you look inside every ETF?"*
- *"Is the yield curve still inverted right now?"*

---

## Features

### Portfolio Analysis
- Import XLS files exported from your broker (comdirect, DKB, ING, Flatex, …)
- Combine multiple portfolios and view them side-by-side or merged
- Automatic ETF detection by ISIN — recognises 40+ ETFs out of the box
- Position breakdown by asset type, currency, region, and sector
- Color-coded gain/loss with weighted P&L

### ETF Overlap Matrix
- Expands every ETF into its actual holdings (top 25 positions)
- Visual heatmap showing which individual stocks appear across multiple ETFs
- Detects commodity ETFs separately (shows "Komponenten" not "Aktien")
- Effective top holdings ranked by total weight in your portfolio

### Stock Research
- Search any ticker for fundamental data via Alpha Vantage
- Real insider transactions from the SEC (no mock data — if there's nothing, it says so)
- Price chart, company overview, key ratios

### Macro Dashboard
All data is live — fetched from free, no-key, official sources, cached locally and refreshed on demand.

| Data | Source (free, no key) | Refresh |
|------|--------|---------|
| Fed Funds Rate (EFFR) | New York Fed | 24h |
| ECB Deposit Rate | ECB Data API | 24h |
| US CPI (YoY) | BLS | 24h |
| US Unemployment + NFP | BLS | 24h |
| US / Euro / Germany GDP growth | World Bank | 7d |
| Euro-area & Germany CPI (HICP) | ECB Data API | 24h |
| Treasury Yield Curve (3M–30Y) | Yahoo Finance | 4h |
| WTI / Brent / Gas / Copper / Wheat / Corn | Yahoo Finance (futures) | 4h |
| Gold & Silver | Yahoo Finance (futures) | 4h |
| EUR/USD, JPY, GBP, CHF | open.er-api.com | 1h |
| BTC / ETH | CoinGecko | 1h |
| Fear & Greed Index | Alternative.me | 1h |
| Economic Calendar | Rule-based (auto-rolls: NFP/CPI/GDP) | — |

Cross-origin requests to Yahoo are routed through public CORS proxies (corsproxy.io, allorigins, …) raced in parallel. **No Alpha Vantage key is required** anymore — if you add one (🔑), it's used only as an extra fallback. BoE, BoJ, SNB, RBA policy rates are labelled reference values (no free CORS API exists for these).

### Monte Carlo Simulation
- Simulate future portfolio performance with configurable assumptions
- Adjustable expected return, volatility, time horizon, and number of paths
- Percentile fan chart (5th / 25th / 50th / 75th / 95th)

---

## Getting started

### Running it

Use the [GitHub Pages link](https://mattstad.github.io/DepotAnalyzer/), or run it locally.

> **Important — don't double-click `index.html`.** That loads the page via `file://`, where the browser reports a `null` origin and the free CORS proxies used for live market data reject the request — so prices and charts won't load. The app must be served over `http://`.

**Local (Windows):** double-click **`start.bat`** — it starts a tiny local web server (Python or Node) and opens the app at `http://localhost:8765`. Leave the small server window open while you use the app.

**Local (any OS):** from the project folder run `python -m http.server 8765` (or `npx serve`), then open `http://localhost:8765`.

### Live data — free, no API key

Stock Research and the market ticker pull live data from **Yahoo Finance** through free public CORS proxies — no account, no API key. An Alpha Vantage key is **optional**: if you add one (🔑 icon), Stock Research is additionally enriched with detailed fundamentals (P/E, margins, analyst ratings). Without it you still get real prices, charts and 52-week ranges.

### Importing your portfolio

1. Export your portfolio from your broker as XLS (securities export / Wertpapierdepot-Export)
2. Click **Portfolio importieren** in the sidebar
3. Load one or multiple files — the app merges them automatically

Tested with exports from: comdirect, ING, DKB, Flatex.

---

## Tech stack

Vanilla JS, zero build step, zero dependencies beyond what's loaded from CDN.

```
index.html          — single-page shell, all navigation in JS
css/app.css         — dark theme, CSS custom properties
js/app.js           — routing, topbar ticker, market clock
js/portfolio.js     — XLS parsing, portfolio state, P&L calculations
js/etf.js           — ETF overlap engine, holding detection
js/etf-data.js      — ETF database (ISIN, holdings, regions, sectors)
js/research.js      — Alpha Vantage stock research + insider transactions
js/macro.js         — Live macro dashboard, all API fetching and caching
js/montecarlo.js    — Monte Carlo simulation engine
```

**Runtime dependencies (CDN):**
- [Chart.js 4.4.4](https://www.chartjs.org/) — all charts
- [SheetJS (xlsx)](https://sheetjs.com/) — XLS/XLSX parsing in browser
- [Font Awesome 6](https://fontawesome.com/) — icons
- [Inter](https://rsms.me/inter/) + [JetBrains Mono](https://www.jetbrains.com/leemons/) — fonts

---

## ETF Database

The app ships with data for 40+ ETFs. Detection works by ISIN first, with name-matching as fallback. Currently includes:

**World / Developed Markets:** IWDA, VWRL, SWRD, HMWO, XMWD, LCUW, ISAC, SPYD  
**Emerging Markets:** EIMI, PAEEM, IS3C, MEUD  
**Factor:** IWSZ, WSML, ZPRV, ZPRX, IUSV, IUSQ  
**US / S&P 500:** CSPX, SXR8, VUAA, VUSA, IVV  
**Sectors:** IUIT, QDVE, CNDX, HLTW, IUCM  
**Bonds:** IBCI, IEAG, VGEA, SLXX  
**Commodities:** ICOM, SPPW, AIGI  
**Thematic / Other:** QCLN, RBOT, IFSW, WTEF

To add an ETF: add an entry to `js/etf-data.js` with ISIN, TER, AUM, top holdings (by ticker + weight), region split, and sector split.

---

## Privacy

- No backend, no telemetry, no cookies
- Your portfolio data never leaves the browser
- API calls go directly from your browser to Alpha Vantage / ECB / open.er-api.com
- Everything is stored in `localStorage` — clearing browser data clears everything

---

## License

MIT — do whatever you want with it.
