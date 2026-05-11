const SUPABASE_URL = window.__SUPABASE_URL__ || '';
const SUPABASE_KEY = window.__SUPABASE_KEY__ || '';

let db;

async function init() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    document.getElementById('digest-view').innerHTML = '<div class="empty">Configure Supabase credentials.</div>';
    return;
  }

  const { createClient } = supabase;
  db = createClient(SUPABASE_URL, SUPABASE_KEY);

  const [digestResult, statsResult, sourceResult] = await Promise.all([
    db.from('digests').select('*').order('digest_date', { ascending: false }).limit(30),
    db.from('articles').select('id', { count: 'exact', head: true }),
    db.from('sources').select('*').eq('active', true),
  ]);

  const digests = digestResult.data || [];
  const articleCount = statsResult.count || 0;
  const sources = sourceResult.data || [];

  renderStats(articleCount, digests.length, sources.length);
  renderSources(sources);
  renderDigestList(digests);

  if (digests.length > 0) {
    showDigest(digests[0]);
  }
}

function renderStats(articles, digests, sources) {
  document.getElementById('stat-articles').textContent = articles;
  document.getElementById('stat-digests').textContent = digests;
  document.getElementById('stat-sources').textContent = sources;
}

function renderSources(sources) {
  const el = document.getElementById('source-list');
  el.innerHTML = sources.map(s =>
    `<span class="source-chip">${esc(s.name)}</span>`
  ).join('');
}

function renderDigestList(digests) {
  const el = document.getElementById('digest-list');
  if (!digests.length) {
    el.innerHTML = '<p class="empty-small">No digests yet.</p>';
    return;
  }
  el.innerHTML = digests.map(d => {
    const date = new Date(d.digest_date + 'T00:00:00');
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const statusDot = d.email_status === 'sent' ? '✓' : d.email_status === 'failed' ? '✗' : '○';
    return `
      <div class="digest-item" data-id="${d.id}" onclick="loadDigest('${d.id}')">
        <span class="digest-date">${label}</span>
        <span class="digest-meta">${d.article_count} articles ${statusDot}</span>
      </div>
    `;
  }).join('');
}

window.loadDigest = async function(id) {
  const { data } = await db.from('digests').select('*').eq('id', id).single();
  if (data) showDigest(data);
};

function showDigest(d) {
  const el = document.getElementById('digest-view');
  if (d.html_content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(d.html_content, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed, form').forEach(n => n.remove());
    doc.querySelectorAll('[onload], [onerror], [onclick], [onmouseover]').forEach(n => {
      n.removeAttribute('onload');
      n.removeAttribute('onerror');
      n.removeAttribute('onclick');
      n.removeAttribute('onmouseover');
    });
    el.innerHTML = doc.body.innerHTML;
  } else {
    el.innerHTML = '<div class="empty">This digest has no content yet.</div>';
  }

  document.querySelectorAll('.digest-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === d.id);
  });
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);
