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

  let lineMovementChart;

  document.getElementById('captureSnapshotBtn')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('snapshotStatus');
    if (statusEl) statusEl.textContent = 'Capturing snapshot...';
    
    try {
      const res = await fetch('/api/line-movement/snapshot', { 
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });
      const json = await res.json();
      
      if (json.success) {
        if (statusEl) statusEl.textContent = `✓ ${json.message}`;
        await loadEvents();
      } else {
        if (statusEl) statusEl.textContent = `✗ Failed: ${json.error}`;
      }
    } catch (e) {
      console.error(e);
      if (statusEl) statusEl.textContent = '✗ Snapshot failed';
    }
  });

  async function loadEvents() {
    try {
      const json = await fetchJSON('/api/line-movement/events');
      const eventSelect = document.getElementById('eventSelect');
      if (!eventSelect) return;
      
      eventSelect.innerHTML = '<option value="">-- Select Event --</option>';
      
      if (Array.isArray(json.data)) {
        json.data.forEach(evt => {
          const opt = document.createElement('option');
          opt.value = evt.eventId;
          opt.textContent = evt.eventName;
          eventSelect.appendChild(opt);
        });
      }
    } catch (e) {
      console.error('loadEvents error:', e);
    }
  }

  async function loadSelections(eventId) {
    const selectionSelect = document.getElementById('selectionSelect');
    const marketSelect = document.getElementById('marketSelect');
    const loadBtn = document.getElementById('loadLineMovementBtn');
    
    if (!selectionSelect || !marketSelect) return;
    selectionSelect.innerHTML = '<option value="">-- Select Selection --</option>';
    marketSelect.innerHTML = '<option value="">-- Select Market --</option>';
    selectionSelect.disabled = true;
    marketSelect.disabled = true;
    if (loadBtn) loadBtn.disabled = true;
    
    if (!eventId) return;
    
    try {
      const json = await fetchJSON(`/api/line-movement/selections?eventId=${encodeURIComponent(eventId)}`);
      
      if (Array.isArray(json.data)) {
        json.data.forEach(sel => {
          const opt = document.createElement('option');
          opt.value = sel;
          opt.textContent = sel;
          selectionSelect.appendChild(opt);
        });
        selectionSelect.disabled = false;
      }
    } catch (e) {
      console.error('loadSelections error:', e);
    }
  }

  async function loadMarkets(eventId, selection) {
    const marketSelect = document.getElementById('marketSelect');
    const loadBtn = document.getElementById('loadLineMovementBtn');
    
    if (!marketSelect) return;
    
    marketSelect.innerHTML = '<option value="">-- Select Market --</option>';
    marketSelect.disabled = true;
    if (loadBtn) loadBtn.disabled = true;
    
    if (!eventId || !selection) return;
    
    try {
      const json = await fetchJSON(
        `/api/line-movement/markets?eventId=${encodeURIComponent(eventId)}&selection=${encodeURIComponent(selection)}`
      );
      
      if (Array.isArray(json.data)) {
        json.data.forEach(mkt => {
          const opt = document.createElement('option');
          opt.value = mkt;
          opt.textContent = mkt;
          marketSelect.appendChild(opt);
        });
        marketSelect.disabled = false;
      }
    } catch (e) {
      console.error('loadMarkets error:', e);
    }
  }

  document.getElementById('eventSelect')?.addEventListener('change', (e) => {
    const eventId = e.target.value;
    loadSelections(eventId);
  });

  document.getElementById('selectionSelect')?.addEventListener('change', (e) => {
    const eventId = document.getElementById('eventSelect')?.value;
    const selection = e.target.value;
    loadMarkets(eventId, selection);
  });

  document.getElementById('marketSelect')?.addEventListener('change', (e) => {
    const loadBtn = document.getElementById('loadLineMovementBtn');
    if (loadBtn) loadBtn.disabled = !e.target.value;
  });

  async function loadLineMovement() {
    const statusEl = document.getElementById('lineMovementStatus');
    const eventSelect = document.getElementById('eventSelect');
    const selectionSelect = document.getElementById('selectionSelect');
    const marketSelect = document.getElementById('marketSelect');
    const timeWindowSelect = document.getElementById('timeWindowSelect');
    
    if (!eventSelect || !selectionSelect || !marketSelect || !timeWindowSelect) return;
    
    const eventId = eventSelect.value;
    const selection = selectionSelect.value;
    const market = marketSelect.value;
    const window = timeWindowSelect.value;
    
    if (!eventId || !selection || !market) {
      if (statusEl) statusEl.textContent = 'Please select event, selection, and market';
      return;
    }
    
    if (statusEl) statusEl.textContent = 'Loading line movement...';
    
    try {
      const url = new URL('/api/line-movement/chart-data', window.location.origin);
      url.searchParams.set('eventId', eventId);
      url.searchParams.set('selection', selection);
      url.searchParams.set('market', market);
      if (window) url.searchParams.set('window', window);
      
      const json = await fetchJSON(url.toString());
      
      renderLineMovementChart(json.chartData);
      displayMovementMetrics(json.metrics, json.significantMovements);
      
      const eventName = eventSelect.options[eventSelect.selectedIndex].text;
      if (statusEl) statusEl.textContent = `Loaded ${json.dataPoints} data points for ${eventName} - ${selection} - ${market}`;
    } catch (e) {
      console.error('loadLineMovement error:', e);
      if (statusEl) statusEl.textContent = '✗ Failed to load line movement';
    }
  }

  function renderLineMovementChart(chartData) {
    const canvas = document.getElementById('lineMovementChart');
    if (!canvas) return;
    
    canvas.style.height = '280px';
    canvas.height = 280;
    canvas.style.width = '100%';
    
    if (lineMovementChart && lineMovementChart.destroy) {
      lineMovementChart.destroy();
    }
    
    if (chartData.isEmpty || !chartData.datasets || chartData.datasets.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '16px Arial';
      ctx.fillStyle = '#999';
      ctx.textAlign = 'center';
      ctx.fillText('No line movement data available. Capture snapshots first.', canvas.width / 2, canvas.height / 2);
      return;
    }
    
    lineMovementChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: chartData.datasets
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animations: {
          tension: {
            duration: 1000,
            easing: 'easeInOutQuad'
          }
        },
        scales: {
          x: {
            type: 'category',
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            title: {
              display: true,
              text: 'American Odds'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  const val = context.parsed.y;
                  label += val > 0 ? `+${val}` : `${val}`;
                }
                return label;
              }
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
  }

  function displayMovementMetrics(metrics, significantMovements) {
    const metricsPanel = document.getElementById('movementMetrics');
    if (!metricsPanel) return;
    
    if (!metrics || !metrics.movements || metrics.movements.length === 0) {
      metricsPanel.innerHTML = '';
      return;
    }
    
    let html = '<h3>Movement Metrics</h3><div class="metrics-grid">';
    
    metrics.movements.forEach(mv => {
      const deltaSign = mv.delta > 0 ? '+' : '';
      const deltaClass = mv.delta > 0 ? 'positive' : mv.delta < 0 ? 'negative' : 'neutral';
      
      html += `
        <div class="metric-card">
          <h4>${mv.book}</h4>
          <div class="metric-row">
            <span>First Price:</span>
            <span>${mv.firstPrice > 0 ? '+' : ''}${mv.firstPrice}</span>
          </div>
          <div class="metric-row">
            <span>Last Price:</span>
            <span>${mv.lastPrice > 0 ? '+' : ''}${mv.lastPrice}</span>
          </div>
          <div class="metric-row">
            <span>Change:</span>
            <span class="${deltaClass}">${deltaSign}${mv.delta.toFixed(0)} (${deltaSign}${mv.deltaPercent.toFixed(1)}%)</span>
          </div>
          <div class="metric-row">
            <span>Volatility:</span>
            <span>${mv.volatility}</span>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    
    if (significantMovements && significantMovements.length > 0) {
      html += '<h4>Significant Movements (±10+ points)</h4><ul class="significant-movements">';
      significantMovements.slice(0, 5).forEach(sm => {
        const changeSign = sm.change > 0 ? '+' : '';
        html += `<li><strong>${sm.book}:</strong> ${sm.fromPrice} → ${sm.toPrice} (${changeSign}${sm.change})</li>`;
      });
      html += '</ul>';
    }
    
    metricsPanel.innerHTML = html;
  }

  document.getElementById('loadLineMovementBtn')?.addEventListener('click', loadLineMovement);
  loadEvents();
}
