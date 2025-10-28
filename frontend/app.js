
async function fetchOdds() {
  const res = await fetch('/api/odds');
  if (!res.ok) throw new Error('Failed to fetch odds');
  const json = await res.json();
  return json.data || [];
}

function renderTable(rows) {
  const tbody = document.querySelector('#oddsTable tbody');
  tbody.innerHTML = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    if (r.isBest) tr.classList.add('best');
    tr.innerHTML = `
      <td>${r.eventName}</td>
      <td>${r.selection}</td>
      <td>${r.market}</td>
      <td>${r.book}</td>
      <td>${r.priceDecimal}</td>
      <td>${r.priceAmerican}</td>
      <td>${r.isBest ? '★' : ''}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function init() {
  try {
    const rows = await fetchOdds();
    renderTable(rows);
  } catch (e) {
    console.error(e);
    alert('Could not load odds.');
  }
}

document.getElementById('refreshBtn').addEventListener('click', init);
init();
