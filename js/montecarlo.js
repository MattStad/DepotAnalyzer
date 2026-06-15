/* Monte Carlo Simulation — GBM with animated canvas rendering */
class MonteCarloSim {
  constructor() {
    this.canvas   = null;
    this.ctx      = null;
    this.histChart = null;
    this.paths    = [];
    this.animFrame = null;
    this.animIdx   = 0;
  }

  init() {
    this.canvas = document.getElementById('mc-canvas');
    this.ctx    = this.canvas.getContext('2d');

    // Range input live display
    const rangeMap = [
      ['mc-years',  'mc-years-val',  v => v],
      ['mc-mu',     'mc-mu-val',     v => parseFloat(v).toFixed(1)],
      ['mc-sigma',  'mc-sigma-val',  v => parseFloat(v).toFixed(1)],
    ];
    rangeMap.forEach(([id, valId, fn]) => {
      const el = document.getElementById(id);
      const update = () => setText(valId, fn(el.value));
      el.addEventListener('input', update);
      update();
    });

    document.getElementById('mc-run-btn').addEventListener('click', () => this.run());
    window.addEventListener('resize', () => { if (this.paths.length) this.redraw(); });
  }

  getParams() {
    return {
      S0:      parseFloat(document.getElementById('mc-initial').value)  || 10000,
      monthly: parseFloat(document.getElementById('mc-monthly').value)  || 0,
      years:   parseInt(document.getElementById('mc-years').value)      || 20,
      mu:      parseFloat(document.getElementById('mc-mu').value)    / 100,
      sigma:   parseFloat(document.getElementById('mc-sigma').value) / 100,
      nsims:   parseInt(document.getElementById('mc-nsims').value)       || 1000,
    };
  }

  applyFromPortfolio(stats) {
    if (!stats) { showToast('Kein Portfolio importiert — bitte zuerst CSV hochladen', 'error'); return; }
    document.getElementById('mc-initial').value  = Math.round(stats.totalValue);
    document.getElementById('mc-monthly').value  = stats.monthly;
    document.getElementById('mc-mu').value       = stats.mu;
    document.getElementById('mc-sigma').value    = stats.sigma;
    setText('mc-mu-val',    stats.mu.toFixed(1));
    setText('mc-sigma-val', stats.sigma.toFixed(1));
    showToast(`Portfolio übernommen: ${fmt(stats.totalValue)} · μ=${stats.mu}% · σ=${stats.sigma}%`, 'success');
  }

  applyPreset(preset) {
    const presets = {
      'world-etf':   { mu: 7,  sigma: 15 },
      'sp500':       { mu: 9,  sigma: 18 },
      'conservative':{ mu: 4,  sigma: 7  },
      'aggressive':  { mu: 12, sigma: 25 },
      'crypto':      { mu: 15, sigma: 60 },
    };
    const p = presets[preset]; if (!p) return;
    document.getElementById('mc-mu').value    = p.mu;
    document.getElementById('mc-sigma').value = p.sigma;
    setText('mc-mu-val',    p.mu.toFixed(1));
    setText('mc-sigma-val', p.sigma.toFixed(1));
  }

  /* Box-Muller: standard normal sample */
  randn() {
    let u, v;
    do { u = Math.random(); v = Math.random(); } while (!u);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  run() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    const p = this.getParams();
    const dt = 1 / 252;                    // daily steps
    const steps = Math.ceil(p.years * 252);
    const dailyContrib = p.monthly / 21;   // business days per month ≈ 21

    setText('mc-status', 'Computing…');
    document.getElementById('mc-run-btn').disabled = true;

    // Run simulations in chunks to avoid blocking UI
    this.paths = [];
    const chunk = 50;
    let done = 0;

    const compute = () => {
      for (let s = 0; s < chunk && done < p.nsims; s++, done++) {
        const path = new Float32Array(steps + 1);
        path[0] = p.S0;
        let val = p.S0;
        for (let t = 1; t <= steps; t++) {
          val = val * Math.exp((p.mu - 0.5 * p.sigma * p.sigma) * dt + p.sigma * Math.sqrt(dt) * this.randn());
          val += dailyContrib;
          path[t] = Math.max(val, 0);
        }
        this.paths.push(path);
      }

      setText('mc-status', `${done.toLocaleString()} / ${p.nsims.toLocaleString()} paths`);

      if (done < p.nsims) {
        requestAnimationFrame(compute);
      } else {
        setText('mc-status', `${p.nsims.toLocaleString()} paths computed`);
        document.getElementById('mc-run-btn').disabled = false;
        this.computeStats(p);
        this.animate(p, steps);
      }
    };

    requestAnimationFrame(compute);
  }

  computeStats(p) {
    const finals = this.paths.map(path => path[path.length - 1]).sort((a,b) => a - b);
    const n = finals.length;
    const totalInvested = p.S0 + p.monthly * 12 * p.years;
    const median = finals[Math.floor(n * 0.50)];
    const p10    = finals[Math.floor(n * 0.10)];
    const p90    = finals[Math.floor(n * 0.90)];
    const best   = finals[n - 1];
    const probLoss = finals.filter(v => v < totalInvested).length / n * 100;

    setText('mc-p50',      fmt(median));
    setText('mc-p90',      fmt(p90));
    setText('mc-p10',      fmt(p10));
    setText('mc-best',     fmt(best));
    setText('mc-prob-loss',probLoss.toFixed(1) + '%');
    setText('mc-invested', fmt(totalInvested));

    colorEl('mc-p50',  median >= totalInvested);
    colorEl('mc-p10',  p10 >= totalInvested);
    colorEl('mc-prob-loss', probLoss < 20);

    this.renderHistogram(finals, totalInvested);
  }

  animate(p, steps) {
    const canvas = this.canvas;
    const ctx    = this.ctx;
    canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const PAD = { l:60, r:20, t:20, b:40 };

    // Compute percentile bands at each step
    const sampleSteps = Math.min(steps, 200);
    const stride      = Math.floor(steps / sampleSteps);
    const stepIdxs    = Array.from({length: sampleSteps+1}, (_,i) => Math.min(i * stride, steps));

    const allVals = this.paths.flatMap(path => [path[0], path[steps]]);
    const minV = Math.min(...allVals) * 0.95;
    const maxV = Math.max(...allVals) * 1.05;

    const xScale = i => PAD.l + (stepIdxs[i] / steps) * (W - PAD.l - PAD.r);
    const yScale = v => PAD.t + (1 - (v - minV) / (maxV - minV)) * (H - PAD.t - PAD.b);

    // Draw axes + grid once
    ctx.clearRect(0, 0, W, H);
    this.drawAxes(ctx, W, H, PAD, p, minV, maxV);

    // Draw percentile bands
    const pctBands = [
      { lo: 0.10, hi: 0.90, color: 'rgba(6,200,216,0.06)' },
      { lo: 0.25, hi: 0.75, color: 'rgba(6,200,216,0.10)' },
    ];
    for (const band of pctBands) {
      ctx.beginPath();
      for (let i = 0; i <= sampleSteps; i++) {
        const si = stepIdxs[i];
        const vals = this.paths.map(path => path[si]).sort((a,b) => a - b);
        const lo   = vals[Math.floor(vals.length * band.lo)];
        const hi   = vals[Math.floor(vals.length * band.hi)];
        if (i === 0) { ctx.moveTo(xScale(i), yScale(hi)); } else { ctx.lineTo(xScale(i), yScale(hi)); }
      }
      for (let i = sampleSteps; i >= 0; i--) {
        const si = stepIdxs[i];
        const vals = this.paths.map(path => path[si]).sort((a,b) => a - b);
        const lo   = vals[Math.floor(vals.length * band.lo)];
        ctx.lineTo(xScale(i), yScale(lo));
      }
      ctx.closePath();
      ctx.fillStyle = band.color;
      ctx.fill();
    }

    // Animate individual paths
    this.animIdx = 0;
    const totalInvested = p.S0 + p.monthly * 12 * p.years;
    const BATCH = Math.ceil(this.paths.length / 80);

    const frame = () => {
      for (let b = 0; b < BATCH && this.animIdx < this.paths.length; b++, this.animIdx++) {
        const path   = this.paths[this.animIdx];
        const finalV = path[steps];
        const positive = finalV >= totalInvested;
        ctx.beginPath();
        ctx.strokeStyle = positive ? 'rgba(16,201,128,0.12)' : 'rgba(239,68,102,0.12)';
        ctx.lineWidth   = 0.7;
        for (let i = 0; i <= sampleSteps; i++) {
          const si = stepIdxs[i];
          const x  = xScale(i);
          const y  = yScale(path[si]);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      if (this.animIdx < this.paths.length) {
        this.animFrame = requestAnimationFrame(frame);
      } else {
        // Draw median line on top
        this.drawMedianLine(ctx, xScale, yScale, stepIdxs, sampleSteps);
        setText('mc-status', `✓ ${this.paths.length.toLocaleString()} simulation paths`);
      }
    };

    this.animFrame = requestAnimationFrame(frame);
  }

  drawAxes(ctx, W, H, PAD, p, minV, maxV) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#080e1a';
    ctx.fillRect(0, 0, W, H);

    // Grid lines Y
    const nGridY = 6;
    for (let i = 0; i <= nGridY; i++) {
      const v = minV + (i / nGridY) * (maxV - minV);
      const y = PAD.t + (1 - i / nGridY) * (H - PAD.t - PAD.b);
      ctx.strokeStyle = '#1a2840';
      ctx.lineWidth   = 0.5;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y); ctx.stroke();
      ctx.fillStyle   = '#8899b8';
      ctx.font        = '10px JetBrains Mono, monospace';
      ctx.textAlign   = 'right';
      ctx.fillText(fmtK(v), PAD.l - 6, y + 4);
    }

    // Grid lines X (year marks)
    for (let yr = 0; yr <= p.years; yr += Math.ceil(p.years / 8)) {
      const x = PAD.l + (yr / p.years) * (W - PAD.l - PAD.r);
      ctx.strokeStyle = '#1a2840';
      ctx.lineWidth   = 0.5;
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, H - PAD.b); ctx.stroke();
      ctx.fillStyle   = '#4a6080';
      ctx.font        = '9px Inter, sans-serif';
      ctx.textAlign   = 'center';
      ctx.fillText(`Y${yr}`, x, H - PAD.b + 14);
    }

    // Axis borders
    ctx.strokeStyle = '#1a2840';
    ctx.lineWidth   = 1;
    ctx.strokeRect(PAD.l, PAD.t, W - PAD.l - PAD.r, H - PAD.t - PAD.b);
  }

  drawMedianLine(ctx, xScale, yScale, stepIdxs, sampleSteps) {
    ctx.beginPath();
    ctx.strokeStyle = '#06c8d8';
    ctx.lineWidth   = 2;
    ctx.setLineDash([]);
    for (let i = 0; i <= sampleSteps; i++) {
      const si   = stepIdxs[i];
      const vals = this.paths.map(path => path[si]).sort((a,b) => a - b);
      const med  = vals[Math.floor(vals.length * 0.5)];
      i === 0 ? ctx.moveTo(xScale(i), yScale(med)) : ctx.lineTo(xScale(i), yScale(med));
    }
    ctx.stroke();
  }

  redraw() {
    if (!this.paths.length) return;
    const p = this.getParams();
    const steps = Math.ceil(p.years * 252);
    this.animate(p, steps);
  }

  renderHistogram(finals, invested) {
    const ctx = document.getElementById('mc-hist-chart').getContext('2d');
    if (this.histChart) this.histChart.destroy();

    // Build histogram with 30 bins
    const BINS  = 30;
    const minV  = Math.min(...finals);
    const maxV  = Math.max(...finals);
    const range = maxV - minV || 1;
    const binW  = range / BINS;
    const counts = new Array(BINS).fill(0);
    for (const v of finals) {
      const bi = Math.min(Math.floor((v - minV) / binW), BINS - 1);
      counts[bi]++;
    }

    const labels = counts.map((_,i) => fmtK(minV + (i + 0.5) * binW));
    const colors = counts.map((_,i) => {
      const center = minV + (i + 0.5) * binW;
      return center >= invested ? 'rgba(16,201,128,0.7)' : 'rgba(239,68,102,0.7)';
    });

    this.histChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0, borderRadius: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.parsed.y} paths`, title: arr => arr[0].label }}},
        scales: {
          x: { ticks: { color:'#4a6080', maxTicksLimit:8, font:{size:9} }, grid: { display:false } },
          y: { ticks: { color:'#8899b8', font:{size:10} }, grid: { color:'#1a2840' } }
        }
      }
    });
  }
}

function fmtK(v) {
  if (v >= 1e6) return (v/1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v/1e3).toFixed(0) + 'K';
  return v.toFixed(0);
}

const mc = new MonteCarloSim();
