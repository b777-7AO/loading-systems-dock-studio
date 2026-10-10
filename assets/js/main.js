/* partial includes + mobile nav + contact prefill */
(async () => {
  for (const slot of document.querySelectorAll('[data-include]')) {
    const url = slot.getAttribute('data-include'); const root = slot.getAttribute('data-root') || '';
    try { const res = await fetch(url, { cache: 'no-cache' }); let html = await res.text(); if (root) html = html.replace(/(href|src)="(?!https?:|mailto:|tel:|#)/g, `$1="${root}`); slot.outerHTML = html; } catch (e) {}
  }
  const t = document.querySelector('.nav-toggle'), w = document.getElementById('navWrap'); if (t && w) t.addEventListener('click', () => { const o = w.classList.toggle('is-open'); t.setAttribute('aria-expanded', String(o)); });
  const here = location.pathname.split('/').pop() || 'index.html'; document.querySelectorAll('.nav a').forEach(a => { if (a.getAttribute('href').endsWith(here) && !a.classList.contains('nav-cta')) a.classList.add('is-active'); });
  const sp = new URLSearchParams(location.search); const cfg = sp.get('konfiguration') || (sp.get('thema') ? 'Thema: ' + sp.get('thema') : null); const ta = document.getElementById('message'); if (cfg && ta) ta.value = 'Meine Konfiguration aus dem Dock Studio:\n\n' + cfg;
})();
