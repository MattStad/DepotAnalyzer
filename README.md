# DepotAnalyzer

A portfolio analyzer that runs completely in the browser. Drop in a broker export and it shows you what's actually inside your portfolio: the real stocks hiding inside your ETFs, where two funds overlap, how your money splits across regions and sectors, plus a live macro dashboard for context.

Live version: **https://mattstad.github.io/DepotAnalyzer/**

There's no backend and no login. Your portfolio file is parsed locally and never leaves your machine.

## Why I built it

I hold a handful of ETFs plus a few single stocks across a couple of brokers, and I could never get a straight answer to simple questions. How much Apple do I really own once you add up every ETF? Are IWDA and VWCE basically selling me the same thing twice? Is the yield curve still inverted today? Nothing I tried answered those without either an account, a paywall, or a spreadsheet afternoon. So this scratches that itch.

## What it does

**Portfolio overview.** Import a CSV or Excel export, or several at once and it merges them. ETFs are recognised by ISIN (40-odd funds out of the box), positions are broken down by type, currency, region and sector, and P&L is weighted across the whole depot.

**ETF overlap.** Every ETF is expanded into its underlying holdings, with a heatmap of which stocks turn up in more than one fund and a ranked list of your portfolio's effective top holdings. Click any holding to jump straight to its research page; that works for commodities too, not just stocks.

**Stock research.** Search a ticker, a name, or an ISIN: Apple, Erste Group on the Vienna exchange, whatever. You get a one-year price chart, valuation ratios, the key balance-sheet figures and a peer comparison. All live, no key.

**Macro dashboard.** Central bank rates, inflation, GDP growth, the US yield curve, commodities, FX, crypto and a sentiment gauge, plus a rolling economic calendar. Sources are listed further down.

**Monte Carlo.** Project the portfolio forward with adjustable return, volatility and horizon, drawn as a percentile fan chart.

## Running it

Use the hosted version above, or serve the folder yourself.

One thing to watch: don't just double-click `index.html`. Opened that way it runs as a `file://` page, the browser reports the origin as `null`, and the free data proxies refuse it so nothing loads. It has to be served over `http`.

On Windows the easiest path is to double-click `start.bat` — it starts a small Python (or Node) web server and opens the app at `http://localhost:8765`. Leave that little server window open while you use it. On macOS or Linux, run `python -m http.server 8765` in the project folder and open the same address.

To load a portfolio, export it from your broker (the securities / Wertpapierdepot export) and drop the file onto the page. Tested with comdirect, ING, DKB, Flatex and Trade Republic; anything else falls back to a generic CSV importer with a column-mapping step.

## Where the data comes from

No keys, no accounts. Everything is fetched live from free, official sources and cached in the browser so a normal visit stays light:

- Prices, charts, fundamentals, commodities, the yield curve and the top ticker — Yahoo Finance
- Fed funds rate — New York Fed
- US inflation, unemployment and payrolls — Bureau of Labor Statistics
- Euro-area and German inflation, and the ECB rate — European Central Bank
- GDP growth for the US, euro area and Germany — World Bank
- Exchange rates from open.er-api.com, crypto from CoinGecko, market sentiment from Alternative.me

Yahoo doesn't send CORS headers, so those calls are routed through a few public CORS proxies tried in parallel — whichever answers first wins. The Bank of England, Japan, Switzerland and Australia policy rates are the only figures left as static references; there's no free feed for them a browser can reach directly.

## How it's built

Plain JavaScript, no framework, no build step. The only things pulled from a CDN are Chart.js for the charts, SheetJS for reading Excel files, Font Awesome, and the fonts.

```
index.html       layout and markup
css/app.css      styling
js/app.js        navigation, top ticker, clock
js/portfolio.js  file parsing, P&L, allocation
js/etf.js        overlap engine
js/etf-data.js   the ETF database
js/research.js   stock research
js/macro.js      macro dashboard
js/montecarlo.js simulation
```

ETFs are matched by ISIN first and by name as a fallback, covering world and developed-market funds, emerging markets, factor and sector ETFs, S&P 500 trackers, bonds, commodities and a few thematics. Adding one is a single entry in `js/etf-data.js` — ISIN, TER, the top holdings with weights, and the region and sector splits.

## License

MIT. Do what you like with it.
