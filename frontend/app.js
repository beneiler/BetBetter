
async function fetchOdds() {
  const res = await fetch('/api/odds');
  if (!res.ok) throw new Error('Failed to fetch odds');
  const json = await res.json();
  return json.data || [];
}

function formatAmerican(value) {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num > 0 ? `+${num}` : `${num}`;
}

function renderTable(rows) {
  const tbody = document.querySelector('#oddsTable tbody');
  tbody.innerHTML = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    if (r.isBest) tr.classList.add('best');
    tr.innerHTML = `
      <td data-label="Event">${r.eventName}</td>
      <td data-label="Selection">${r.selection}</td>
      <td data-label="Market">${r.market}</td>
      <td data-label="Book">${r.book}</td>
      <td data-label="Odds">${formatAmerican(r.priceAmerican)}</td>
      <td data-label="Best?">${r.isBest ? '★' : ''}</td>
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
