/* ETF Holdings Database — top holdings for 20 popular European-listed ETFs */
const ETF_DB = {
  "IWDA": {
    name: "iShares Core MSCI World", isin: "IE00B4L5Y983",
    ter: 0.20, aum: 68000, currency: "USD",
    description: "MSCI World Index — ~1500 large/mid cap from 23 developed markets",
    holdings: {
      "AAPL":  4.87, "MSFT":  4.38, "NVDA":  3.91, "AMZN":  2.78, "META":  2.08,
      "GOOGL": 1.75, "GOOG":  1.52, "AVGO":  1.41, "TSLA":  1.18, "LLY":   1.14,
      "BRK.B": 0.98, "JPM":   0.92, "WMT":   0.81, "V":     0.79, "UNH":   0.78,
      "XOM":   0.71, "MA":    0.69, "JNJ":   0.62, "HD":    0.61, "PG":    0.60,
      "COST":  0.58, "ORCL":  0.55, "CRM":   0.52, "NFLX":  0.50, "BAC":   0.49,
      "ASML":  0.48, "TM":    0.45, "SAP":   0.44, "NVO":   0.43, "NESN":  0.41
    },
    regions: { "North America":69.5, "Europe":16.2, "Japan":5.8, "Pacific ex-JP":4.8, "Other":3.7 },
    sectors: { "Technology":23.4, "Financials":14.8, "Healthcare":12.1, "Consumer Disc":11.2, "Industrials":10.8, "Communication":8.7, "Consumer Staples":6.9, "Energy":4.5, "Materials":3.8, "Utilities":2.5, "Real Estate":1.3 }
  },
  "VWCE": {
    name: "Vanguard FTSE All-World", isin: "IE00BK5BQT80",
    ter: 0.22, aum: 22000, currency: "USD",
    description: "FTSE All-World Index — ~3700 stocks across developed and emerging markets",
    holdings: {
      "AAPL":  4.12, "MSFT":  3.88, "NVDA":  3.42, "AMZN":  2.51, "META":  1.81,
      "GOOGL": 1.58, "GOOG":  1.31, "AVGO":  1.19, "TSLA":  1.08, "2330.TW":0.98,
      "LLY":   0.97, "BRK.B": 0.91, "JPM":   0.87, "WMT":   0.76, "V":     0.74,
      "XOM":   0.68, "UNH":   0.67, "MA":    0.65, "ASML":  0.56, "SAP":   0.50,
      "TM":    0.49, "700.HK":0.47, "9988.HK":0.44,"NVO":   0.43, "NESN":  0.42,
      "JNJ":   0.41, "HD":    0.40, "PG":    0.39, "COST":  0.38, "005930.KS":0.37
    },
    regions: { "North America":63.2, "Europe":14.8, "Emerging Markets":11.2, "Japan":5.1, "Pacific ex-JP":3.9, "Other":1.8 },
    sectors: { "Technology":21.8, "Financials":15.4, "Healthcare":11.2, "Consumer Disc":11.0, "Industrials":10.5, "Communication":8.2, "Consumer Staples":6.8, "Energy":4.9, "Materials":4.2, "Utilities":2.8, "Real Estate":3.2 }
  },
  "CSPX": {
    name: "iShares Core S&P 500", isin: "IE00B5BMR087",
    ter: 0.07, aum: 85000, currency: "USD",
    description: "S&P 500 Index — 500 largest US companies",
    holdings: {
      "AAPL":  7.12, "MSFT":  6.67, "NVDA":  5.84, "AMZN":  4.21, "META":  3.08,
      "GOOGL": 2.72, "GOOG":  2.21, "AVGO":  2.08, "TSLA":  1.82, "LLY":   1.71,
      "BRK.B": 1.68, "JPM":   1.52, "WMT":   1.41, "V":     1.32, "UNH":   1.31,
      "XOM":   1.21, "MA":    1.18, "COST":  1.12, "HD":    1.04, "ORCL":  1.02,
      "CRM":   0.97, "NFLX":  0.95, "PG":    0.92, "BAC":   0.91, "JNJ":   0.88,
      "AMD":   0.84, "AMGN":  0.79, "KO":    0.78, "MRK":   0.76, "ABBV":  0.72
    },
    regions: { "United States": 100 },
    sectors: { "Technology":31.8, "Financials":13.2, "Healthcare":11.8, "Consumer Disc":10.8, "Communication":9.4, "Industrials":8.5, "Consumer Staples":5.8, "Energy":3.9, "Materials":2.5, "Utilities":2.1, "Real Estate":2.2 }
  },
  "EIMI": {
    name: "iShares Core MSCI EM IMI", isin: "IE00BKM4GZ66",
    ter: 0.18, aum: 18000, currency: "USD",
    description: "MSCI Emerging Markets IMI — ~2800 stocks from 27 emerging markets",
    holdings: {
      "2330.TW": 7.21, "005930.KS":4.82, "700.HK":4.12, "9988.HK":3.24,
      "INFY":   1.81, "SBIN.BO":  1.44, "RELIANCE.BO":0.98, "1810.HK":0.91,
      "3690.HK":0.89, "HDFC.BO": 0.87, "9999.HK":0.84, "LT.BO":  0.81,
      "ITUB4.SA":0.79,"NPN.JO":  0.76, "VALE3.SA":0.72, "BIDU":   0.68,
      "JD":     0.61, "2382.HK": 0.59, "600519.SS":0.56,"HDFCBANK.BO":0.54
    },
    regions: { "China":27.4, "India":17.8, "Taiwan":17.2, "South Korea":11.8, "Brazil":5.2, "Saudi Arabia":3.8, "South Africa":3.1, "Other":13.7 },
    sectors: { "Technology":22.4, "Financials":21.8, "Consumer Disc":12.4, "Communication":9.1, "Materials":7.8, "Industrials":6.9, "Consumer Staples":5.8, "Energy":4.9, "Healthcare":4.2, "Utilities":2.8, "Real Estate":1.9 }
  },
  "XDWD": {
    name: "Xtrackers MSCI World Swap", isin: "LU0274208692",
    ter: 0.19, aum: 7200, currency: "USD",
    description: "MSCI World Index (synthetic replication)",
    holdings: {
      "AAPL":  4.85, "MSFT":  4.35, "NVDA":  3.88, "AMZN":  2.75, "META":  2.05,
      "GOOGL": 1.72, "GOOG":  1.50, "AVGO":  1.38, "TSLA":  1.15, "LLY":   1.11,
      "BRK.B": 0.96, "JPM":   0.90, "WMT":   0.79, "V":     0.77, "UNH":   0.76,
      "XOM":   0.69, "MA":    0.67, "JNJ":   0.60, "HD":    0.59, "PG":    0.58,
      "ASML":  0.47, "NVO":   0.42, "SAP":   0.42, "NESN":  0.40, "TM":    0.43
    },
    regions: { "North America":70.1, "Europe":15.8, "Japan":5.6, "Pacific ex-JP":4.5, "Other":4.0 },
    sectors: { "Technology":23.1, "Financials":14.6, "Healthcare":12.0, "Consumer Disc":11.0, "Industrials":10.7, "Communication":8.5, "Consumer Staples":6.8, "Energy":4.4, "Materials":3.7, "Utilities":2.4, "Real Estate":2.8 }
  },
  "SXR8": {
    name: "iShares Core S&P 500 (EUR-hedged)", isin: "IE00B3XXRP09",
    ter: 0.10, aum: 32000, currency: "EUR",
    description: "S&P 500 with EUR currency hedge",
    holdings: {
      "AAPL":  7.10, "MSFT":  6.64, "NVDA":  5.80, "AMZN":  4.18, "META":  3.05,
      "GOOGL": 2.70, "GOOG":  2.19, "AVGO":  2.06, "TSLA":  1.80, "LLY":   1.69,
      "BRK.B": 1.65, "JPM":   1.50, "WMT":   1.39, "V":     1.30, "UNH":   1.29,
      "XOM":   1.19, "MA":    1.16, "COST":  1.10, "HD":    1.02, "ORCL":  1.00
    },
    regions: { "United States": 100 },
    sectors: { "Technology":31.9, "Financials":13.1, "Healthcare":11.7, "Consumer Disc":10.7, "Communication":9.3, "Industrials":8.4, "Consumer Staples":5.9, "Energy":3.8, "Materials":2.6, "Utilities":2.2, "Real Estate":2.4 }
  },
  "IUSN": {
    name: "iShares MSCI World Small Cap", isin: "IE00BF4RFH31",
    ter: 0.35, aum: 4800, currency: "USD",
    description: "MSCI World Small Cap Index — ~3500 smaller companies",
    holdings: {
      "SMCI":  0.28, "CIVI":  0.22, "HLI":   0.21, "INSM":  0.20, "TREX":  0.19,
      "LGND":  0.18, "AIXI":  0.17, "FTAI":  0.16, "VIRT":  0.15, "TNL":   0.15,
      "MDGL":  0.14, "IBKR":  0.14, "RDW":   0.13, "HIMS":  0.13, "PRCT":  0.12
    },
    regions: { "North America":61.2, "Europe":22.4, "Japan":7.8, "Pacific ex-JP":5.1, "Other":3.5 },
    sectors: { "Industrials":16.8, "Technology":14.2, "Financials":13.9, "Consumer Disc":12.4, "Healthcare":11.8, "Materials":8.4, "Real Estate":6.8, "Energy":5.2, "Consumer Staples":4.8, "Communication":3.1, "Utilities":2.6 }
  },
  "EXSA": {
    name: "iShares STOXX Europe 600", isin: "DE0002635307",
    ter: 0.20, aum: 8900, currency: "EUR",
    description: "STOXX Europe 600 — 600 largest European companies",
    holdings: {
      "ASML":  5.12, "NESN":  4.21, "NOVN":  3.84, "ROG":   3.21, "NOVO-B":3.18,
      "SAP":   3.05, "LSEG":  1.89, "SHEL":  1.82, "AZN":   1.78, "MC.PA": 1.71,
      "SIE":   1.68, "INGA":  1.42, "BNP":   1.38, "TTE":   1.28, "HSBA":  1.21,
      "VOW3":  1.18, "BMW":   1.12, "ALV":   1.08, "DBK":   0.98, "DHL":   0.92
    },
    regions: { "United Kingdom":22.4, "France":17.8, "Switzerland":14.2, "Germany":12.8, "Netherlands":6.8, "Denmark":4.9, "Sweden":4.8, "Spain":4.1, "Other":12.2 },
    sectors: { "Financials":18.4, "Healthcare":15.8, "Industrials":14.2, "Consumer Disc":10.8, "Technology":9.4, "Consumer Staples":9.1, "Energy":7.8, "Materials":5.8, "Communication":4.2, "Utilities":2.8, "Real Estate":1.7 }
  },
  "DBXD": {
    name: "Xtrackers DAX", isin: "LU0274211480",
    ter: 0.09, aum: 4200, currency: "EUR",
    description: "DAX Performance Index — 40 largest German companies",
    holdings: {
      "SAP":   15.82, "SIE":  9.41, "ALV":   7.88, "DTE":   6.21, "MRK.DE":5.84,
      "MUV2":  5.12, "AIR":  4.98, "ADS":   4.42, "VOW3":  3.88, "BMW":   3.82,
      "BAYN":  3.41, "HEI":  3.22, "DBK":   2.98, "BAS":   2.81, "RWE":   2.74,
      "ENR":   2.42, "CON":  2.31, "MBG":   2.18, "HAB.DE":1.98, "DHL":   1.88
    },
    regions: { "Germany": 100 },
    sectors: { "Technology":18.4, "Industrials":16.8, "Financials":14.2, "Consumer Disc":12.8, "Healthcare":11.4, "Materials":8.8, "Communication":6.8, "Energy":5.4, "Utilities":3.8, "Consumer Staples":1.6 }
  },
  "VUSA": {
    name: "Vanguard S&P 500", isin: "IE00B3XXRP09",
    ter: 0.07, aum: 42000, currency: "USD",
    description: "S&P 500 Index — Vanguard version",
    holdings: {
      "AAPL":  7.08, "MSFT":  6.62, "NVDA":  5.78, "AMZN":  4.16, "META":  3.02,
      "GOOGL": 2.68, "GOOG":  2.17, "AVGO":  2.04, "TSLA":  1.78, "LLY":   1.67,
      "BRK.B": 1.63, "JPM":   1.48, "WMT":   1.37, "V":     1.28, "UNH":   1.27,
      "XOM":   1.17, "MA":    1.14, "COST":  1.08, "HD":    1.00, "PG":    0.90
    },
    regions: { "United States": 100 },
    sectors: { "Technology":31.7, "Financials":13.3, "Healthcare":11.9, "Consumer Disc":10.9, "Communication":9.5, "Industrials":8.6, "Consumer Staples":5.7, "Energy":4.0, "Materials":2.4, "Utilities":2.0, "Real Estate":2.0 }
  },
  /* IS3N removed — identical ISIN IE00BKM4GZ66 as EIMI; both are exchange tickers for the same fund */
  "IQQW": {
    name: "iShares MSCI World Quality", isin: "IE00BP3QZD73",
    ter: 0.30, aum: 3100, currency: "USD",
    description: "MSCI World Quality Factor — high ROE, stable earnings, low leverage",
    holdings: {
      "MSFT":  8.42, "NVDA":  7.18, "AAPL":  6.91, "META":  5.84, "LLY":   5.21,
      "GOOGL": 4.88, "GOOG":  4.12, "MA":    3.84, "V":     3.21, "UNH":   2.98,
      "ASML":  2.42, "NOVO-B":2.31, "NVO":   2.18, "HD":    1.98, "COST":  1.84
    },
    regions: { "North America":72.8, "Europe":14.4, "Japan":6.8, "Pacific ex-JP":4.2, "Other":1.8 },
    sectors: { "Technology":38.4, "Healthcare":16.8, "Consumer Disc":12.4, "Financials":10.8, "Communication":9.4, "Consumer Staples":6.8, "Industrials":5.4 }
  },
  "QDVE": {
    name: "iShares S&P 500 IT Sector", isin: "IE00B3WJKG14",
    ter: 0.15, aum: 2800, currency: "USD",
    description: "S&P 500 Information Technology sector",
    holdings: {
      "MSFT":  21.42, "NVDA":  18.84, "AAPL":  17.91, "AVGO":  6.84, "AMD":  3.41,
      "ORCL":  3.21, "CRM":   2.98, "ACN":   2.84, "INTU":  2.41, "IBM":  2.18,
      "ADBE":  1.98, "TXN":   1.84, "CSCO":  1.72, "QCOM":  1.58, "NOW":  1.41
    },
    regions: { "United States": 100 },
    sectors: { "Technology": 100 }
  },
  "FLXG": {
    name: "Franklin FTSE Germany", isin: "IE00BHZRR147",
    ter: 0.09, aum: 210, currency: "EUR",
    description: "FTSE Germany Index",
    holdings: {
      "SAP":   16.1, "SIE":  9.8, "ALV":  8.2, "DTE":   6.4, "MUV2": 5.9,
      "AIR":   5.1, "ADS":  4.6, "VOW3": 4.0, "BMW":   3.9, "BAYN": 3.5,
      "DBK":   3.1, "BAS":  2.9, "RWE":  2.8, "MRK.DE":2.4, "DHL":  2.1
    },
    regions: { "Germany": 100 },
    sectors: { "Technology":18.8, "Industrials":16.4, "Financials":14.8, "Consumer Disc":12.4, "Healthcare":11.2, "Materials":9.1, "Communication":6.8, "Energy":5.4, "Utilities":3.2, "Consumer Staples":1.9 }
  },
  "MEUD": {
    name: "Amundi MSCI EMU", isin: "LU1681044563",
    ter: 0.12, aum: 3200, currency: "EUR",
    description: "MSCI Economic and Monetary Union — Eurozone equities",
    holdings: {
      "ASML":  8.42, "SAP":   5.81, "SIE":   4.98, "AIR":   4.41, "LVMH": 4.21,
      "INGA":  3.84, "BNP":   3.41, "TTE":   3.18, "ENEL":  2.98, "ALV":  2.84,
      "ADS":   2.72, "DTE":   2.58, "VOW3":  2.41, "ENI":   2.21, "SAN":  2.18
    },
    regions: { "France":30.8, "Germany":26.4, "Netherlands":14.8, "Italy":9.8, "Spain":7.8, "Other":10.4 },
    sectors: { "Technology":18.4, "Industrials":14.8, "Financials":18.4, "Consumer Disc":10.8, "Healthcare":8.8, "Energy":8.4, "Consumer Staples":6.8, "Materials":6.8, "Communication":4.1, "Utilities":3.7 }
  },

  /* ── Austrian fund — SPK OÖ KAG (Sparkasse OÖ Kapitalanlagegesellschaft) ── */

  /* AT0000859848 "INTERSTOCK T" — Interstock Thesaurierend
     International equity fund managed by Sparkasse OÖ KAG.
     Sector/region data is an estimate based on the fund's international-equity mandate.
     Benchmark: broadly similar to MSCI World with a slight European tilt. */
  "INTERSTOCK-T": {
    name: "Interstock Thesaurierend (SPK OÖ KAG)", isin: "AT0000859848",
    ter: 1.50, aum: null, currency: "EUR",
    description: "Aktiv verwalteter internationaler Aktienfonds der Sparkasse OÖ KAG (thesaurierend). Sektor- und Regionaldaten sind Schätzwerte.",
    holdings: {},
    regions: { "North America": 62.0, "Europe": 22.0, "Japan": 7.0, "Pacific ex-JP": 4.0, "Emerging Markets": 5.0 },
    sectors: { "Technology": 19.0, "Financials": 17.0, "Healthcare": 12.0, "Industrials": 11.0, "Consumer Disc": 10.0, "Communication": 8.0, "Consumer Staples": 7.0, "Energy": 5.0, "Materials": 4.0, "Utilities": 4.0, "Real Estate": 3.0 }
  },

  /* ── User's actual ETFs (from securities_export) ── */

  /* Xtrackers MSCI World 1C — accumulating share class, IE-domicile */
  "XMWD": {
    name: "Xtrackers MSCI World UCITS ETF 1C", isin: "IE00BK1PV551",
    ter: 0.19, aum: 9200, currency: "USD",
    description: "MSCI World Index — synthetische Replikation, thesaurierend (accumulating). Gleiche Index-Exposition wie XDWD2, andere Anteilsklasse.",
    holdings: {
      "AAPL":4.85,"MSFT":4.35,"NVDA":3.88,"AMZN":2.75,"META":2.05,
      "GOOGL":1.72,"GOOG":1.50,"AVGO":1.38,"TSLA":1.15,"LLY":1.11,
      "BRK.B":0.96,"JPM":0.90,"WMT":0.79,"V":0.77,"UNH":0.76,
      "XOM":0.69,"MA":0.67,"JNJ":0.60,"HD":0.59,"PG":0.58,
      "ASML":0.47,"SAP":0.42,"NVO":0.42,"NESN":0.40,"TM":0.43
    },
    regions: { "North America":70.1,"Europe":15.8,"Japan":5.6,"Pacific ex-JP":4.5,"Other":4.0 },
    sectors: { "Technology":23.1,"Financials":14.6,"Healthcare":12.0,"Consumer Disc":11.0,"Industrials":10.7,"Communication":8.5,"Consumer Staples":6.8,"Energy":4.4,"Materials":3.7,"Utilities":2.4,"Real Estate":2.8 }
  },

  /* Amundi MSCI Emerging Markets UCITS ETF Dist — LU-domicile */
  "PAEEM": {
    name: "Amundi MSCI Emerging Markets UCITS ETF Dist", isin: "LU2573966905",
    ter: 0.20, aum: 5400, currency: "USD",
    description: "MSCI Emerging Markets Index — physische Replikation, ausschüttend. Größte Märkte: China, Taiwan, Indien, Südkorea.",
    holdings: {
      "2330.TW":6.98,"005930.KS":4.68,"700.HK":3.98,"9988.HK":3.12,
      "INFY":1.72,"SBIN.BO":1.38,"3690.HK":0.86,"HDFC.BO":0.84,
      "9999.HK":0.81,"JD":0.65,"BIDU":0.64,"VALE3.SA":0.69,
      "005935.KS":0.62,"RELIANCE.BO":0.58,"ITUB4.SA":0.52
    },
    regions: { "China":28.8,"India":18.4,"Taiwan":16.8,"South Korea":12.2,"Brazil":5.1,"Saudi Arabia":3.9,"Other":14.8 },
    sectors: { "Technology":23.1,"Financials":21.4,"Consumer Disc":12.8,"Communication":9.4,"Materials":7.4,"Industrials":6.8,"Consumer Staples":5.4,"Energy":5.1,"Healthcare":4.8,"Utilities":2.4,"Real Estate":1.4 }
  },

  "XDWD2": {
    name: "Xtrackers MSCI World Swap UCITS ETF 1D", isin: "LU2263803533",
    ter: 0.19, aum: 7800, currency: "USD",
    description: "MSCI World Index — synthetic swap replication, distributing",
    holdings: {
      "AAPL":4.85,"MSFT":4.35,"NVDA":3.88,"AMZN":2.75,"META":2.05,
      "GOOGL":1.72,"GOOG":1.50,"AVGO":1.38,"TSLA":1.15,"LLY":1.11,
      "BRK.B":0.96,"JPM":0.90,"WMT":0.79,"V":0.77,"UNH":0.76,
      "XOM":0.69,"MA":0.67,"JNJ":0.60,"HD":0.59,"PG":0.58,
      "ASML":0.47,"SAP":0.42,"NVO":0.42,"NESN":0.40,"TM":0.43
    },
    regions: { "North America":70.1,"Europe":15.8,"Japan":5.6,"Pacific ex-JP":4.5,"Other":4.0 },
    sectors: { "Technology":23.1,"Financials":14.6,"Healthcare":12.0,"Consumer Disc":11.0,"Industrials":10.7,"Communication":8.5,"Consumer Staples":6.8,"Energy":4.4,"Materials":3.7,"Utilities":2.4,"Real Estate":2.8 }
  },
  "XDWT": {
    name: "Xtrackers MSCI World IT Sector UCITS ETF", isin: "IE00BM67HT60",
    ter: 0.25, aum: 2100, currency: "USD",
    description: "MSCI World Information Technology sector — ~150 global IT companies, market-cap weighted",
    holdings: {
      /* Mega-cap US tech */
      "MSFT":18.12,"NVDA":16.54,"AAPL":15.68,"AVGO":5.72,"AMD":3.34,
      "ORCL":3.14,"CRM":2.92,"ACN":2.78,"INTU":2.34,"ASML":2.12,
      "IBM":1.94,"ADBE":1.81,"TXN":1.68,"CSCO":1.54,"NOW":1.38,
      "SAP":1.34,"QCOM":1.28,"AMAT":1.24,"LRCX":1.08,"SNPS":0.96,
      /* Tier 2 US & global IT */
      "CDNS":0.91,"PANW":0.88,"KLAC":0.84,"MRVL":0.81,"MU":0.78,
      "FTNT":0.74,"MSI":0.71,"ANSS":0.68,"KEYS":0.64,"EPAM":0.61,
      "TEL":0.58,"GLW":0.55,"HPQ":0.52,"STX":0.49,"WDC":0.47,
      "CTSH":0.44,"JNPR":0.42,"IT":0.39,"GDDY":0.37,"VRSN":0.35,
      /* Asian IT (Japan, Korea, Taiwan incl.) */
      "6758.T":0.88,"6861.T":0.84,"9432.T":0.78,"6954.T":0.74,"8035.T":0.68,
      "000660.KS":0.64,"035420.KS":0.58,"2454.TW":0.54,"2308.TW":0.48,"3008.TW":0.44,
      /* European IT */
      "CAP.PA":0.62,"DASSF":0.58,"LONN.SW":0.52,"NOKIA.HE":0.48,"ERICB.ST":0.44,
      "NESTE.HE":0.38,"SOPRA.PA":0.34,"SOFTWARE.DE":0.31,"TEMN.SW":0.28,"KNEBV.HE":0.24,
      /* Additional US IT */
      "ANET":0.42,"ZS":0.38,"CRWD":0.35,"OKTA":0.32,"SNOW":0.29,
      "DDOG":0.27,"NET":0.25,"MDB":0.23,"TEAM":0.21,"ZM":0.18
    },
    regions: { "United States":75.4,"Europe":12.8,"Japan":5.1,"South Korea":3.4,"Other":3.3 },
    sectors: { "Technology":100 }
  },
  "ACWI-SC": {
    name: "Xtrackers MSCI ACWI Small Cap Swap UCITS ETF", isin: "IE00BGHQ0G80",
    ter: 0.40, aum: 1800, currency: "USD",
    description: "MSCI ACWI Small Cap — ~5000 global small-cap stocks",
    holdings: {
      "SMCI":0.18,"CIVI":0.16,"HLI":0.15,"INSM":0.14,"TREX":0.13,
      "LGND":0.12,"FTAI":0.11,"VIRT":0.10,"TNL":0.10,"MDGL":0.10
    },
    regions: { "North America":57.4,"Europe":18.8,"Japan":9.2,"Pacific ex-JP":6.8,"Emerging Markets":5.4,"Other":2.4 },
    sectors: { "Industrials":15.8,"Technology":13.4,"Financials":13.2,"Consumer Disc":12.8,"Healthcare":11.4,"Materials":7.8,"Real Estate":6.4,"Energy":5.8,"Consumer Staples":5.1,"Communication":3.8,"Utilities":4.3 }
  },
  "ICOM": {
    name: "iShares Diversified Commodity Swap UCITS ETF", isin: "IE00BDFL4P12",
    ter: 0.19, aum: 2400, currency: "USD",
    description: "Bloomberg Commodity Index — synthetische Swap-Replikation auf 23 Rohstoff-Futures (Energie, Metalle, Agrar, Vieh)",
    holdings: {
      "Gold (GC)":       14.21,
      "Rohöl WTI (CL)":  8.74,
      "Brent Crude (CO)": 8.12,
      "Kupfer (HG)":      7.84,
      "Erdgas (NG)":      7.31,
      "Soybeans (S)":     5.92,
      "Corn (C)":         5.61,
      "Aluminium (LA)":   4.83,
      "Silber (SI)":      4.48,
      "Zucker (SB)":      3.82,
      "Live Cattle (LC)": 3.41,
      "Weizen (W)":       3.18,
      "Soybean Oil (BO)": 2.94,
      "Zink (LX)":        2.76,
      "Kaffee (KC)":      2.12,
      "Lean Hogs (LH)":   1.94,
      "Kansas Wheat (KW)":1.82,
      "Baumwolle (CT)":   1.58,
      "Nickel (LN)":      1.47,
      "Blei (LL)":        0.84,
      "HRW Wheat":        0.79,
      "Sojamehl (SM)":    0.74,
      "Kakao (CC)":       0.52
    },
    regions: { "Global Commodities": 100 },
    sectors: { "Energy":32.4,"Agriculture":28.8,"Metals":22.4,"Livestock":10.2,"Other Commodities":6.2 }
  },
  "BNKS": {
    name: "iShares S&P U.S. Banks UCITS ETF", isin: "IE00BD3V0B10",
    ter: 0.35, aum: 980, currency: "USD",
    description: "S&P Banks Select Industry Index — all 46 US bank constituents (modified equal-weight)",
    holdings: {
      /* Large-cap / S&P 500 banks */
      "JPM":9.84,"BAC":9.12,"WFC":7.84,"GS":7.21,"MS":6.84,
      "C":6.12,"USB":4.61,"TFC":3.82,"PNC":3.68,"SCHW":3.42,
      "COF":2.98,"BK":2.84,"STT":2.71,"KEY":2.28,"FITB":2.14,
      "MTB":2.08,"HBAN":1.98,"RF":1.92,"CFG":1.84,"NTRS":1.62,
      /* Mid-cap / S&P MidCap 400 banks */
      "FHN":1.41,"ZION":1.34,"CMA":1.28,"WTFC":0.98,"WAL":0.94,
      "WBS":0.88,"BOKF":0.84,"CBSH":0.81,"BFH":0.78,"GBCI":0.68,
      "FFIN":0.64,"FULT":0.61,"HWC":0.58,"WAFD":0.54,"FNB":0.51,
      "COLB":0.48,"SFBS":0.46,"EBC":0.43,"WSFS":0.41,"NBT":0.39,
      "BANR":0.37,"IBCP":0.34,"BUSE":0.32,"BCAL":0.30,"SBCF":0.28,
      "PFIS":0.22
    },
    regions: { "United States": 100 },
    sectors: { "Financials": 100 }
  },
  "INRG": {
    name: "iShares Global Clean Energy UCITS ETF", isin: "IE00B1XNHC34",
    ter: 0.65, aum: 3200, currency: "USD",
    description: "S&P Global Clean Energy Index — ~60 clean energy producers and technology companies",
    holdings: {
      /* Top holdings */
      "ENPH":8.21,"NEE":7.64,"CEG":7.08,"FSLR":6.72,"ORSTED":6.12,
      "RUN":5.41,"BEP":4.98,"AES":4.72,"SEDG":4.42,"PLUG":3.21,
      "VESTAS":2.98,"EDP":2.84,"IBERDROLA":2.72,"ENEL":2.41,"BEPC":2.18,
      /* Additional holdings */
      "ORA":1.98,"CWEN":1.84,"BLX":1.72,"ERG.MI":1.58,"CPFE3.SA":1.42,
      "CSIQ":1.34,"JKS":1.28,"DQ":1.21,"GWH":1.14,"MAXN":1.08,
      "NOVA":0.98,"ARRY":0.92,"SHLS":0.88,"HASI":0.84,"AZRE":0.78,
      "PEGI":0.72,"AMPS":0.68,"SPWR":0.64,"VWSYF":0.61,"IBE.MC":0.58,
      "9RE.SI":0.54,"PIF":0.48,"EDPR.LS":0.44,"GREEN.OL":0.41,"SCATC.OL":0.38,
      "EVN.AX":0.35,"INFIGEN":0.32,"GRL.AX":0.28,"OPTT":0.24,"AMPE":0.21
    },
    regions: { "United States":42.4,"Europe":28.8,"Canada":8.4,"China":6.8,"Other":13.6 },
    sectors: { "Energy":60.4,"Utilities":28.8,"Technology":7.4,"Industrials":3.4 }
  },
  "DFNS": {
    name: "VanEck Defense UCITS ETF", isin: "IE000YYE6WK5",
    ter: 0.55, aum: 1800, currency: "USD",
    description: "MarketVector Global Defense Industry Index — ~100 global defence and aerospace companies",
    holdings: {
      /* US prime contractors */
      "RTX":9.42,"LMT":9.08,"NOC":8.64,"GD":7.98,"BA":7.72,
      "L3H":5.61,"LHX":5.28,"HII":4.72,"LDOS":4.08,"BAH":3.84,
      /* European defence */
      "RHM.DE":3.68,"AIR":3.28,"BA.L":2.98,"SAAB-B":2.31,"LEI.PA":2.18,
      "DASSAULT":2.08,"TKMS":1.84,"TXT":1.72,"HEICO":1.58,"HWM":1.44,
      /* US aerospace & services */
      "AXON":1.38,"KTOS":1.28,"MOOG":1.18,"DRS":1.08,"CACI":0.98,
      "SAIC":0.92,"SPAR":0.88,"MSAI":0.84,"PLTR":0.78,"OSIS":0.72,
      /* Additional global defence */
      "BAEL.WA":0.68,"DFEN":0.64,"IEC":0.61,"ESYS":0.58,"CWST":0.54,
      "AVAV":0.51,"KRATOS":0.48,"AEROJET":0.44,"SPCE":0.38,"VSAT":0.35,
      "FLIR":0.32,"DRS.TO":0.29,"OTIS":0.25,"AXYS":0.22,"ELBIT.TA":0.19
    },
    regions: { "United States":66.8,"Europe":26.4,"Other":6.8 },
    sectors: { "Industrials":72.4,"Technology":18.8,"Consumer Disc":8.8 }
  },

  /* ── Thematic ETFs ── */

  "SEMI": {
    name: "Invesco Semiconductors UCITS ETF", isin: "",
    ter: 0.35, aum: 1200, currency: "USD",
    description: "Halbleiter-Index — die größten globalen Chip-Hersteller und -Ausrüster",
    holdings: {
      "NVDA":10.4,"AVGO":8.2,"AMD":6.1,"TXN":5.2,"QCOM":4.8,
      "AMAT":4.6,"MU":4.4,"LRCX":4.1,"ADI":3.9,"KLAC":3.7,
      "NXPI":3.4,"MCHP":3.1,"MRVL":2.9,"INTC":2.8,"ON":2.4,
      "ASML":2.6,"2330.TW":2.5,"SNPS":2.3,"CDNS":2.1,"TER":1.8,
      "SWKS":1.6,"MPWR":1.5,"QRVO":1.2,"STM":1.1,"ENTG":1.0
    },
    regions: { "United States":80.4,"Taiwan":6.2,"Europe":7.8,"Other":5.6 },
    sectors: { "Technology":100 }
  },

  "NUCL": {
    name: "VanEck Uranium and Nuclear Technologies UCITS ETF", isin: "",
    ter: 0.55, aum: 900, currency: "USD",
    description: "MarketVector Global Uranium & Nuclear Energy — Versorger, Uranminen und Nukleartechnik",
    holdings: {
      "CEG":8.4,"CCJ":7.9,"VST":6.8,"PEG":5.4,"BWXT":4.8,
      "D":4.2,"DUK":4.0,"SO":3.8,"EXC":3.4,"AEP":3.1,
      "KAP.IL":3.6,"UEC":2.9,"NXE":2.6,"DNN":2.2,"PDN.AX":2.4,
      "9501.T":2.8,"9503.T":2.1,"OKLO":2.0,"SMR":2.3,"LEU":1.9,
      "LTBR":1.2,"UUUU":1.4,"URG":0.9,"BWLPG":0.8,"PALAF":0.7
    },
    regions: { "United States":54.8,"Canada":13.4,"Japan":8.2,"Australia":6.4,"Kazakhstan":5.8,"Other":11.4 },
    sectors: { "Utilities":52.4,"Energy":24.8,"Materials":12.4,"Industrials":10.4 }
  },

  "CNXT": {
    name: "VanEck ChiNext Innovators UCITS ETF", isin: "",
    ter: 0.65, aum: 400, currency: "USD",
    description: "ChiNext-Index (Shenzhen) — chinesische Wachstums- und Innovationsunternehmen",
    holdings: {
      "300750.SZ":18.2,"300059.SZ":7.4,"300760.SZ":5.8,"300274.SZ":4.6,"300124.SZ":4.1,
      "300014.SZ":3.8,"300498.SZ":3.4,"300782.SZ":2.9,"300999.SZ":2.7,"301269.SZ":2.4,
      "300347.SZ":2.2,"300450.SZ":2.1,"300661.SZ":1.9,"300433.SZ":1.8,"300316.SZ":1.7,
      "300122.SZ":1.6,"300142.SZ":1.5,"300628.SZ":1.4,"300896.SZ":1.3,"300979.SZ":1.2
    },
    regions: { "China":100 },
    sectors: { "Technology":34.2,"Industrials":22.8,"Healthcare":14.4,"Consumer Disc":12.6,"Materials":8.4,"Communication":7.6 }
  }
};

/* Helper: list of all ETF tickers for the dropdown */
const ETF_LIST = Object.entries(ETF_DB).map(([ticker, d]) => ({
  ticker, name: d.name, isin: d.isin, ter: d.ter
}));

/* Predefined chart colors */
const CHART_COLORS = [
  '#06c8d8','#3b82f6','#10c980','#f59e0b','#8b5cf6',
  '#f97316','#ef4466','#14b8a6','#84cc16','#ec4899',
  '#6366f1','#0ea5e9','#22c55e','#eab308','#a855f7'
];
