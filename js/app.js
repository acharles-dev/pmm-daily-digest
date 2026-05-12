const SUPABASE_URL = window.__SUPABASE_URL__ || '';
const SUPABASE_KEY = window.__SUPABASE_KEY__ || '';

let db, allArticles = [], sources = [];
let filterCategory = null, filterSource = null;

const CATEGORIES = {
  pmm: 'Campaigns',
  strategy: 'Strategy',
  growth: 'Growth',
  product: 'Launches',
  marketing: 'Tactics',
};

async function init() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const { createClient } = supabase;
  db = createClient(SUPABASE_URL, SUPABASE_KEY);

  const [a, s] = await Promise.all([
    db.from('articles').select('*, sources(name, category)')
      .order('fetched_at', { ascending: false }).limit(200),
    db.from('sources').select('*').eq('active', true),
  ]);

  allArticles = a.data || [];
  sources = s.data || [];
  render();
}

function render() {
  renderStats();
  renderNav();
  renderArticles();
}

function renderStats() {
  document.getElementById('stat-articles').textContent = allArticles.length;
  document.getElementById('stat-sources').textContent = sources.length;
  const today = new Date().toISOString().split('T')[0];
  const todayCount = allArticles.filter(a => a.fetched_at?.startsWith(today)).length;
  document.getElementById('stat-today').textContent = todayCount;
}

function renderNav() {
  const catEl = document.getElementById('nav-categories');
  const srcEl = document.getElementById('nav-sources');

  const catCounts = {};
  allArticles.forEach(a => {
    const cat = a.sources?.category || 'general';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  let catHtml = `<div class="nav-item ${!filterCategory ? 'active' : ''}" data-cat="">All <span class="count">${allArticles.length}</span></div>`;
  Object.entries(CATEGORIES).forEach(([key, label]) => {
    catHtml += `<div class="nav-item ${filterCategory === key ? 'active' : ''}" data-cat="${key}">${label} <span class="count">${catCounts[key] || 0}</span></div>`;
  });
  catEl.innerHTML = catHtml;

  let srcHtml = '';
  sources.forEach(s => {
    srcHtml += `<span class="source-tag">${esc(s.name)}</span>`;
  });
  srcEl.innerHTML = srcHtml;

  catEl.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      filterCategory = item.dataset.cat || null;
      render();
    });
  });
}

function renderArticles() {
  const el = document.getElementById('articles');
  let filtered = allArticles;

  if (filterCategory) {
    filtered = filtered.filter(a => a.sources?.category === filterCategory);
  }

  const catLabel = filterCategory ? CATEGORIES[filterCategory] || filterCategory : 'All';
  document.getElementById('view-title').textContent = catLabel;
  document.getElementById('view-subtitle').textContent = `${filtered.length} articles`;

  if (!filtered.length) {
    el.innerHTML = '<div class="empty">No articles yet. The fetch function runs every 6 hours.</div>';
    return;
  }

  el.innerHTML = filtered.map(a => {
    const cat = a.sources?.category || 'general';
    const catLabel = CATEGORIES[cat] || cat;
    const source = a.sources?.name || 'Unknown';
    const date = a.fetched_at ? timeAgo(new Date(a.fetched_at)) : '';

    return `
      <div class="card">
        <div class="card-top">
          <span class="card-source">${esc(source)}</span>
          <span class="card-category cat-${esc(cat)}">${esc(catLabel)}</span>
        </div>
        <div class="card-title"><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a></div>
        ${a.summary ? `<div class="card-summary">${esc(a.summary)}</div>` : ''}
        <div class="card-meta">${date}${a.author ? ' · ' + esc(a.author) : ''}</div>
      </div>`;
  }).join('');
}

function timeAgo(d) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);
