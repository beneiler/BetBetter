// Guard to ensure we only wire listeners once
if (!window.__betbetterOnce) {
  window.__betbetterOnce = true;

  // ===== Odds table =====
  let oddsFetchInFlight = false;
  const MAX_ROWS = 500;

  const statusEl = document.getElementById('status');
  const tbody = document.querySelector('#oddsTable tbody');

  function setStatus(msg) { if (statusEl) statusEl.textContent = msg || ''; }

  async function fetchJSON(url) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) throw new Error(`Non-JSON from ${url}`);
    return res.json();
  }

  async function fetchOdds() {
    const json = await fetchJSON('/api/odds');
    return Array.isArray(json.data) ? json.data : [];
  }

  function formatAmerican(v) {
    if (v == null || v === '') return '';
    const n = Number(v);
    if (Number.isNaN(n)) return v;
    return n > 0 ? `+${n}` : `${n}`;
  }

  function renderTable(rows) {
    // hard clear to avoid growth
    tbody.innerHTML = '';
    const slice = rows.slice(0, MAX_ROWS);
    for (const r of slice) {
      const tr = document.createElement('tr');
      if (r.isBest) tr.classList.add('best');
      tr.innerHTML = `
        <td>${r.eventName ?? ''}</td>
        <td>${r.selection ?? ''}</td>
        <td>${r.market ?? ''}</td>
        <td>${r.book ?? ''}</td>
        <td>${formatAmerican(r.priceAmerican)}</td>
        <td>${r.isBest ? '★' : ''}</td>`;
      tbody.appendChild(tr);
    }
  }

  async function loadOddsOnce() {
    if (oddsFetchInFlight) return;
    oddsFetchInFlight = true;
    setStatus('Loading odds…');
    try {
      const rows = await fetchOdds();
      renderTable(rows);
      setStatus(`Loaded ${rows.length} rows`);
    } catch (e) {
      console.error(e);
      setStatus('Failed to load odds');
      alert('Could not load odds. See console for details.');
    } finally {
      oddsFetchInFlight = false;
    }
  }

  document.getElementById('refreshBtn')?.addEventListener('click', loadOddsOnce);
  // IMPORTANT: manual only to avoid surprise loops
  // loadOddsOnce();


  // ===== Team Trends charts =====
  let winChart, ouChart, streakChart;

  async function fetchMetric(teamId, metric, windowSize, kind) {
    const u = new URL('/api/metrics', window.location.origin);
    u.searchParams.set('teamId', teamId);
    u.searchParams.set('metric', metric);
    if (windowSize) u.searchParams.set('window', String(windowSize));
    if (kind) u.searchParams.set('kind', kind);
    const json = await fetchJSON(u.toString());
    return Array.isArray(json.points) ? json.points : [];
  }

  function toLabelAndValues(points, fraction = false) {
    const labels = points.map(p => p.asOf);
    const values = points.map(p => (fraction ? Math.round(p.value * 1000) / 1000 : p.value));
    return { labels, values };
  }

  // Fixed-size chart creator (prevents infinite canvas growth)
  function makeOrUpdateLine(canvasEl, chartRef, label, labels, values, options = {}) {
    if (!canvasEl) return chartRef;

    // Hard-pin canvas size so Chart.js can't inflate it
    canvasEl.style.height = '220px';
    canvasEl.height = 220;          // device pixels
    canvasEl.style.width = '100%';

    if (chartRef && chartRef.destroy) chartRef.destroy();

    return new Chart(canvasEl, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        responsive: false,          // we control size explicitly
        maintainAspectRatio: false,
        animations: false,
        scales: {
          x: { type: 'category' },
          y: options.y || { beginAtZero: true }
        },
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false }
        }
      }
    });
  }

  async function loadTrends() {
    const teamId = document.getElementById('teamIdInput').value.trim().toUpperCase();
    const windowSize = Number(document.getElementById('windowSelect').value);
    try {
      const [winPts, ouPts, streakPts] = await Promise.all([
        fetchMetric(teamId, 'rolling_win_rate', windowSize),
        fetchMetric(teamId, 'rolling_ou_hit_rate', windowSize, 'OVER'),
        fetchMetric(teamId, 'streak_len')
      ]);

      const { labels: wL, values: wV } = toLabelAndValues(winPts, true);
      winChart = makeOrUpdateLine(
        document.getElementById('winRateChart'),
        winChart,
        'Win Rate',
        wL, wV,
        { y: { min: 0, max: 1, ticks: { stepSize: 0.2 } } }
      );

      const { labels: oL, values: oV } = toLabelAndValues(ouPts, true);
      ouChart = makeOrUpdateLine(
        document.getElementById('ouRateChart'),
        ouChart,
        'OU OVER Rate',
        oL, oV,
        { y: { min: 0, max: 1, ticks: { stepSize: 0.2 } } }
      );

      const { labels: sL, values: sV } = toLabelAndValues(streakPts, false);
      streakChart = makeOrUpdateLine(
        document.getElementById('streakChart'),
        streakChart,
        'Streak',
        sL, sV,
        { y: { ticks: { stepSize: 1 } } }
      );
    } catch (e) {
      console.error(e);
      alert('Failed to load trends. See console for details.');
    }
  }

  document.getElementById('loadTrends')?.addEventListener('click', loadTrends);
}
