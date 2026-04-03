// ── HERO BANNER CAROUSEL ─────────────────────────────────────
let heroCurrent  = 0;
let heroTimer    = null;
const HERO_INTERVAL = 5000;
const HOME_ROTATION_MINUTES = 20;
const HOME_CATEGORY_LIMIT = 5;
const HOME_SECTION_LIMIT = 8;
const CAMPAIGN_SECTION_LIMIT = 12;
const SEASONAL_COLLECTION_LIMIT = 8;
let lastRenderAt = Date.now();

const SEASONAL_COLLECTIONS = [
  {
    id: 'easter-2026',
    title: 'Páscoa e mesa posta',
    kicker: 'Coleção sazonal',
    start: '2026-03-15T00:00:00',
    end: '2026-04-30T23:59:59',
    categories: ['casa', 'alimentos', 'beleza'],
  },
  {
    id: 'mothers-day',
    title: 'Dia das Mães',
    kicker: 'Coleção especial',
    start: '2026-04-20T00:00:00',
    end: '2026-05-15T23:59:59',
    categories: ['beleza', 'moda', 'casa', 'eletronicos'],
  },
  {
    id: 'midyear-tech',
    title: 'Semana de Tecnologia',
    kicker: 'Coleção sazonal',
    start: '2026-06-01T00:00:00',
    end: '2026-06-14T23:59:59',
    categories: ['computadores', 'celulares', 'eletronicos', 'audio', 'cameras'],
  },
  {
    id: 'black-friday',
    title: 'Black Friday Preparatória',
    kicker: 'Campanha sazonal',
    start: '2026-11-01T00:00:00',
    end: '2026-11-30T23:59:59',
    categories: ['todos'],
  },
  {
    id: 'christmas',
    title: 'Natal e presentes',
    kicker: 'Coleção sazonal',
    start: '2026-12-01T00:00:00',
    end: '2026-12-26T23:59:59',
    categories: ['moda', 'beleza', 'bebes', 'brinquedos', 'casa'],
  },
];

function getInitialSearchTerm() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('q') || params.get('search') || '').trim();
}

function sameId(a, b) {
  return String(a) === String(b);
}

function updateShareableUrl() {
  const params = new URLSearchParams();
  if (currentCategory && currentCategory !== 'todos') params.set('cat', currentCategory);
  const search = (document.getElementById('searchInput')?.value || '').trim();
  if (search) params.set('q', search);
  if (currentSort && currentSort !== 'default') params.set('sort', currentSort);
  if (priceMin !== null) params.set('min', String(priceMin));
  if (priceMax !== null) params.set('max', String(priceMax));
  const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

function trackEvent(name, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  }
}

function getInitialCategory() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('cat') || 'todos').trim();
}

function getHomeRotationBucket() {
  return Math.floor(Date.now() / (HOME_ROTATION_MINUTES * 60 * 1000));
}

function getTimeBucket(mins = HOME_ROTATION_MINUTES) {
  return Math.floor(Date.now() / (mins * 60 * 1000));
}

function sameDayRange(start, end) {
  const now = Date.now();
  const s = start ? new Date(start).getTime() : null;
  const e = end ? new Date(end).getTime() : null;
  if (s && now < s) return false;
  if (e && now > e) return false;
  return true;
}

function isCampaignActive(p) {
  return sameDayRange(p.campaignStart || p.publishDate, p.campaignEnd || null);
}

function getCampaignGroupKey(p) {
  return p.campaignId || p.campaignCategory || (isCampaignActive(p) ? 'campanha-ativa' : '');
}

function matchesSeasonalCollection(p, collection) {
  if (!collection || !sameDayRange(collection.start, collection.end)) return false;
  if (!collection.categories || !collection.categories.length) return false;
  return collection.categories.includes('todos') || collection.categories.includes(p.category) || collection.categories.includes(p.campaignCategory);
}

function getActiveSeasonalCollections(items) {
  return SEASONAL_COLLECTIONS
    .filter(c => sameDayRange(c.start, c.end))
    .map(collection => ({
      ...collection,
      items: items.filter(p => matchesSeasonalCollection(p, collection)).slice(0, SEASONAL_COLLECTION_LIMIT),
    }))
    .filter(c => c.items.length);
}

function getCampaignItems(items) {
  return items
    .filter(p => p.featured || p.homeOrder || getCampaignGroupKey(p))
    .sort((a, b) => {
      const aOrder = Number.isFinite(Number(a.homeOrder)) ? Number(a.homeOrder) : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(Number(b.homeOrder)) ? Number(b.homeOrder) : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return getProductScore(b) - getProductScore(a);
    })
    .slice(0, CAMPAIGN_SECTION_LIMIT);
}

function getProductScore(p) {
  const clicks = JSON.parse(localStorage.getItem('shopee_clicks') || '{}');
  const clickN = Number(clicks[p.id] || 0);
  const discount = getDiscount(p);
  const featured = p.featured ? 50 : 0;
  const orderBoost = Number.isFinite(Number(p.homeOrder)) ? Math.max(0, 100 - Number(p.homeOrder)) : 0;
  const campaignBoost = isCampaignActive(p) ? 30 : 0;
  return clickN * 2 + discount + featured + orderBoost + campaignBoost;
}

function hashString(text) {
  let hash = 0;
  const input = String(text || '');
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function sortFeaturedFirst(items) {
  return [...items].sort((a, b) => {
    const aFeatured = a.featured ? 1 : 0;
    const bFeatured = b.featured ? 1 : 0;
    if (aFeatured !== bFeatured) return bFeatured - aFeatured;
    const aOrder = Number.isFinite(Number(a.homeOrder)) ? Number(a.homeOrder) : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(Number(b.homeOrder)) ? Number(b.homeOrder) : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(b.id).localeCompare(String(a.id));
  });
}

function isDisplayableProduct(p) {
  const price = Number(p?.price);
  return Number.isFinite(price) && price > 0;
}

function rotateHomeProducts(items) {
  const bucket = getHomeRotationBucket();
  return [...items].sort((a, b) => {
    const aKey = hashString(`${bucket}:${a.category}:${a.id}:${a.name}`);
    const bKey = hashString(`${bucket}:${b.category}:${b.id}:${b.name}`);
    if (aKey !== bKey) return aKey - bKey;
    return String(a.id).localeCompare(String(b.id));
  });
}

function groupByCategory(items) {
  return items.reduce((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});
}

function initHeroBanner() {
  const slidesEl = document.getElementById('heroSlides');
  const dotsEl   = document.getElementById('heroDots');
  if (!slidesEl) return;

  const visibleProducts = allProducts.filter(isDisplayableProduct);
  const featured = visibleProducts.filter(p => p.featured).slice(0, 6);
  const slides   = featured.length >= 2 ? featured : visibleProducts.slice(0, Math.min(5, visibleProducts.length));

  if (!slides.length) {
    document.getElementById('heroBanner').innerHTML = `
      <div class="hero-static">
        <div class="hero-content">
          <h1>🔥 Ofertas Imperdíveis</h1>
          <p>Seleção de ofertas online com links para a Shopee.</p>
        </div>
      </div>`;
    updateHeroStats();
    return;
  }

  slidesEl.innerHTML = slides.map((p, i) => {
    const img      = getImages(p)[0] || '';
    const discount = getDiscount(p);
    return `<div class="hero-slide ${i === 0 ? 'active' : ''}" data-action="open-product" data-id="${p.id}">
      ${img ? `<div class="hero-slide-bg" style="background-image:url('${img}')"></div>` : ''}
      <div class="hero-slide-overlay"></div>
      <div class="hero-slide-content">
        ${discount ? `<span class="hero-badge">-${discount}%</span>` : ''}
        <h2>${p.name}</h2>
        <p class="hero-slide-price">R$ ${Number(p.price).toFixed(2).replace('.',',')}</p>
        <span class="hero-cta">Ver oferta →</span>
      </div>
    </div>`;
  }).join('');

  dotsEl.innerHTML = slides.map((_, i) =>
    `<button class="hero-dot ${i===0?'active':''}" data-action="hero-dot" data-index="${i}"></button>`
  ).join('');

  if (heroTimer) clearInterval(heroTimer);
  heroTimer = setInterval(heroNext, HERO_INTERVAL);
  updateHeroStats();
}

function goHeroSlide(n) {
  const slides = document.querySelectorAll('.hero-slide');
  const dots   = document.querySelectorAll('.hero-dot');
  if (!slides.length) return;
  slides[heroCurrent].classList.remove('active');
  dots[heroCurrent]?.classList.remove('active');
  heroCurrent = (n + slides.length) % slides.length;
  slides[heroCurrent].classList.add('active');
  dots[heroCurrent]?.classList.add('active');
}

function heroNext() { goHeroSlide(heroCurrent + 1); }
function heroPrev() { goHeroSlide(heroCurrent - 1); }

window.goHeroSlide = goHeroSlide;
window.heroNext    = heroNext;
window.heroPrev    = heroPrev;

// ── COUNTDOWN TIMER ──────────────────────────────────────────
let cdInterval = null;

function renderCountdownStr(target) {
  const diff = target - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h >= 48) { const d = Math.floor(h / 24); return `${d}d ${h % 24}h`; }
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function startCountdownTimers() {
  if (cdInterval) clearInterval(cdInterval);
  cdInterval = setInterval(() => {
    document.querySelectorAll('[data-countdown]').forEach(el => {
      const t   = parseInt(el.dataset.countdown);
      const str = renderCountdownStr(t);
      if (str) {
        el.textContent = `⏰ Oferta encerra em: ${str}`;
      } else {
        el.closest('.card-countdown-wrap')?.remove();
        el.style.display = 'none';
      }
    });
  }, 1000);
}

// ── RELATED PRODUCTS ─────────────────────────────────────────
function renderRelated(p) {
  const el     = document.getElementById('modalRelated');
  const listEl = document.getElementById('modalRelatedList');
  if (!el || !listEl) return;
  const related = allProducts
    .filter(isDisplayableProduct)
    .filter(x => x.category === p.category && !sameId(x.id, p.id))
    .slice(0, 6);
  if (!related.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  listEl.innerHTML = related.map(r => {
    const img = getImages(r)[0] || '';
    return `<div class="related-item" data-action="open-product" data-id="${r.id}">
      <img src="${img}" alt="${r.name}" loading="lazy"
           onerror="this.src='https://via.placeholder.com/80x80?text=?'"/>
      <div class="related-name">${r.name.substring(0,40)}${r.name.length>40?'…':''}</div>
      <div class="related-price">R$ ${Number(r.price).toFixed(2).replace('.',',')}</div>
    </div>`;
  }).join('');
}

// ── COMPARE PRODUCTS ─────────────────────────────────────────
let compareList = [];

function toggleCompare(id, e) {
  e.stopPropagation();
  const idx = compareList.findIndex(x => sameId(x, id));
  if (idx === -1) {
    if (compareList.length >= 3) { showCompareToast(); return; }
    compareList.push(id);
  } else {
    compareList.splice(idx, 1);
  }
  renderCompareBar();
  document.querySelectorAll('.card-compare-btn').forEach(btn => {
    btn.classList.toggle('active', compareList.some(id => sameId(id, btn.dataset.pid)));
  });
}

function showCompareToast() {
  let t = document.getElementById('compareToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'compareToast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 18px;border-radius:8px;font-size:.85rem;z-index:9999;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = 'Máximo 3 produtos para comparar';
  t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 2000);
}

function renderCompareBar() {
  const bar   = document.getElementById('compareBar');
  const slots = document.getElementById('compareSlots');
  const btn   = document.getElementById('btnCompareNow');
  if (!bar) return;
  compareList = compareList.filter(id => {
    const p = allProducts.find(x => sameId(x.id, id));
    return p && isDisplayableProduct(p);
  });
  if (!compareList.length) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  btn.disabled      = compareList.length < 2;
  slots.innerHTML   = compareList.map(id => {
    const p   = allProducts.find(x => sameId(x.id, id));
    if (!p) return '';
    const img = getImages(p)[0] || '';
    return `<div class="compare-slot">
      ${img ? `<img src="${img}" alt=""/>` : '<div class="compare-slot-placeholder"></div>'}
      <span>${p.name.substring(0,22)}${p.name.length>22?'…':''}</span>
      <button data-action="toggle-compare-remove" data-pid="${p.id}" title="Remover"><i class="fas fa-times"></i></button>
    </div>`;
  }).join('');
}

function clearCompare() {
  compareList = [];
  renderCompareBar();
  document.querySelectorAll('.card-compare-btn').forEach(b => b.classList.remove('active'));
}

function openCompareModal() {
  if (compareList.length < 2) return;
  const modal = document.getElementById('compareModal');
  const table = document.getElementById('compareTable');
  const prods = compareList
    .map(id => allProducts.find(x => sameId(x.id, id)))
    .filter(p => p && isDisplayableProduct(p));

  const rows = [
    { label: 'Imagem',     fn: p => `<img src="${getImages(p)[0]||''}" alt="" onerror="this.src='https://via.placeholder.com/90x90?text=?'"/>` },
    { label: 'Nome',       fn: p => p.name },
    { label: 'Categoria',  fn: p => categoryLabel(p.category) },
    { label: 'Preço',      fn: p => `<strong style="color:#ee4d2d">R$ ${Number(p.price).toFixed(2).replace('.',',')}</strong>` },
    { label: 'Original',   fn: p => p.originalPrice ? `<s>R$ ${Number(p.originalPrice).toFixed(2).replace('.',',')}</s>` : '–' },
    { label: 'Desconto',   fn: p => { const d=getDiscount(p); return d ? `<span class="badge-discount">-${d}%</span>` : '–'; } },
    { label: 'Avaliação',  fn: p => p.rating    ? starsHTML(p.rating) : '–' },
    { label: 'Vendidos',   fn: p => p.soldCount ? `${p.soldCount}+`   : '–' },
    { label: '',           fn: p => `<a href="${p.link}" target="_blank" rel="noopener" class="modal-buy-btn" style="font-size:.78rem;padding:7px 12px"><i class="fas fa-shopping-cart"></i> Comprar</a>` },
  ];

  table.innerHTML = `<table class="compare-tbl">
    <thead><tr>
      <th></th>
      ${prods.map(p => `<th>${p.name.substring(0,28)}${p.name.length>28?'…':''}</th>`).join('')}
    </tr></thead>
    <tbody>
      ${rows.map(row => `<tr>
        <td class="compare-row-label">${row.label}</td>
        ${prods.map(p => `<td>${row.fn(p)}</td>`).join('')}
      </tr>`).join('')}
    </tbody>
  </table>`;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCompareModal() {
  document.getElementById('compareModal').classList.remove('open');
  document.body.style.overflow = '';
}

function closeCompareOutside(e) {
  if (e.target.id === 'compareModal') closeCompareModal();
}

window.toggleCompare      = toggleCompare;
window.clearCompare       = clearCompare;
window.openCompareModal   = openCompareModal;
window.closeCompareModal  = closeCompareModal;
window.closeCompareOutside = closeCompareOutside;

// ── SHARE ─────────────────────────────────────────────────────
function shareWhatsApp() {
  if (!modalProduct) return;
  trackEvent('share_whatsapp', {
    item_id: modalProduct.id,
    item_name: modalProduct.name,
    item_category: modalProduct.category,
  });
  const text = `🔥 *${modalProduct.name}*\n💰 R$ ${Number(modalProduct.price).toFixed(2).replace('.',',')}\n🛒 ${modalProduct.link}\n\n_Via Melhores Ofertas_`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
function shareTelegram() {
  if (!modalProduct) return;
  trackEvent('share_telegram', {
    item_id: modalProduct.id,
    item_name: modalProduct.name,
    item_category: modalProduct.category,
  });
  const discount = modalProduct.originalPrice && modalProduct.originalPrice > modalProduct.price
    ? Math.round((1 - modalProduct.price / modalProduct.originalPrice) * 100) : null;
  const priceLine = modalProduct.originalPrice && modalProduct.originalPrice > modalProduct.price
    ? `~~R$ ${Number(modalProduct.originalPrice).toFixed(2).replace('.',',')}~~  →  *R$ ${Number(modalProduct.price).toFixed(2).replace('.',',')}*`
    : `*R$ ${Number(modalProduct.price).toFixed(2).replace('.',',')}*`;
  const text = [
    `🔥 *${modalProduct.name}*`,
    `📂 ${categoryLabel(modalProduct.category)}`,
    discount ? `🏷️ Economia de *${discount}%*` : null,
    `💰 ${priceLine}`,
    `⚠️ Preço promocional sujeito a alteração sem aviso prévio.`,
    modalProduct.desc ? `📝 ${formatDescription(modalProduct.desc)}` : null,
    `🛒 Confira na Shopee: ${modalProduct.link}`,
  ].filter(Boolean).join('\n');
  window.open(`https://t.me/share/url?url=${encodeURIComponent(modalProduct.link)}&text=${encodeURIComponent(text)}`, '_blank');
}

// ── SEARCH SUGGESTIONS & HISTORY ─────────────────────────────
const SEARCH_HISTORY_KEY = 'shopee_search_history';

function getSearchHistory() {
  return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
}
function saveSearchTerm(term) {
  if (!term.trim()) return;
  let history = getSearchHistory().filter(h => h !== term);
  history.unshift(term);
  if (history.length > 8) history = history.slice(0, 8);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function updateSearchSuggestions() {
  const input = document.getElementById('searchInput').value.trim().toLowerCase();
  const dd    = document.getElementById('searchDropdown');
  if (!input) { showSearchHistory(); return; }

  const matches = [...new Set(allProducts
    .filter(p => p.name.toLowerCase().includes(input))
    .map(p => p.name)
  )].slice(0, 6);

  if (!matches.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = matches.map(m => {
    const hi = m.replace(new RegExp(`(${input})`, 'gi'), '<mark>$1</mark>');
    return `<div class="dd-item" onmousedown="selectSuggestion('${m.replace(/'/g,"\\'")}')">
      <i class="fas fa-search"></i> ${hi}
    </div>`;
  }).join('');
  dd.style.display = 'block';
}

function showSearchHistory() {
  const input   = document.getElementById('searchInput').value.trim();
  if (input) return;
  const history = getSearchHistory();
  const dd      = document.getElementById('searchDropdown');
  if (!history.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = `<div class="dd-header">🕐 Buscas recentes</div>` +
    history.map(h => `
      <div class="dd-item" onmousedown="selectSuggestion('${h.replace(/'/g,"\\'")}')">
        <i class="fas fa-history"></i> ${h}
        <button class="dd-remove" onmousedown="event.stopPropagation();removeHistory('${h.replace(/'/g,"\\'")}')">
          <i class="fas fa-times"></i>
        </button>
      </div>`).join('') +
    `<div class="dd-clear" onmousedown="clearHistory()">Limpar histórico</div>`;
  dd.style.display = 'block';
}

function hideSearchDropdown() {
  setTimeout(() => {
    const input = document.getElementById('searchInput').value.trim();
    if (input) saveSearchTerm(input);
    document.getElementById('searchDropdown').style.display = 'none';
  }, 200);
}

function selectSuggestion(val) {
  document.getElementById('searchInput').value = val;
  saveSearchTerm(val);
  filterProducts();
  document.getElementById('searchDropdown').style.display = 'none';
}

function removeHistory(term) {
  const history = getSearchHistory().filter(h => h !== term);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  showSearchHistory();
}

function clearHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
  document.getElementById('searchDropdown').style.display = 'none';
}

function handleSearchKey(e) {
  if (e.key === 'Enter') {
    const val = e.target.value.trim();
    if (val) saveSearchTerm(val);
    document.getElementById('searchDropdown').style.display = 'none';
  }
  if (e.key === 'Escape') {
    document.getElementById('searchDropdown').style.display = 'none';
  }
}

// ── DARK MODE ─────────────────────────────────────────────────
function initDarkMode() {
  if (localStorage.getItem('darkMode') === '1') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const icon = document.getElementById('darkIcon');
    if (icon) icon.className = 'fas fa-sun';
  }
}
function toggleDarkMode() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const icon = document.getElementById('darkIcon');
  if (icon) icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
  localStorage.setItem('darkMode', isDark ? '0' : '1');
}

// ── HELPERS ──────────────────────────────────────────────────
function getImages(p) {
  if (p.images && p.images.length > 0) return p.images.filter(Boolean);
  if (p.image) return [p.image];
  return [];
}
function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
function getVideoThumb(url) {
  const id = getYouTubeId(url);
  if (id) return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  return null;
}
function stripHtml(text) {
  return (text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}
function formatDescription(text) {
  return stripHtml(text || '')
    .replace(/ - /g, ' -\n')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}
function getEmbedUrl(url) {
  const id = getYouTubeId(url);
  if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
  return url;
}

// ── DATA ─────────────────────────────────────────────────────
let currentCategory = 'todos';
let currentSort     = 'default';
let priceMin        = null;
let priceMax        = null;
let firstLoad       = true;
let allProducts = JSON.parse(localStorage.getItem('shopee_products') || '[]');
let firestoreDb = null;
let firestoreReady = false;

window.addEventListener('storage', (e) => {
  if (e.key === 'shopee_products') {
    allProducts = JSON.parse(e.newValue || '[]');
    renderProducts();
  }
});

(async () => {
  try {
    const { firebaseConfig } = await import("./config.js");
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const fs = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const app = initializeApp(firebaseConfig);
    firestoreDb = fs.getFirestore(app);
    const snap = await fs.getDocs(fs.query(fs.collection(firestoreDb, 'products'), fs.orderBy('updatedAt', 'desc')));
    const remote = snap.docs.map(d => d.data()).filter(Boolean);
    if (remote.length) {
      allProducts = remote;
      localStorage.setItem('shopee_products', JSON.stringify(remote));
    } else if (allProducts.length) {
      // If Firestore is empty, keep showing the last local snapshot.
      console.log('[FIRESTORE] No remote products yet; using localStorage snapshot');
    }
    firestoreReady = true;
    firstLoad = false;
    const initialSearch = getInitialSearchTerm();
    const searchInput = document.getElementById('searchInput');
    if (initialSearch && searchInput && !searchInput.value) searchInput.value = initialSearch;
    currentCategory = getInitialCategory();
    renderProducts();
    initHeroBanner();
    updateResultsSummary(allProducts.filter(p => !p.publishDate || new Date(p.publishDate) <= new Date()), (document.getElementById('searchInput')?.value || '').toLowerCase().trim());
  } catch (e) {
    console.warn('[FIRESTORE] Falling back to localStorage:', e.message);
  }
})();

// ── RENDER ────────────────────────────────────────────────────
function renderProducts() {
  const grid   = document.getElementById('productGrid');
  const empty  = document.getElementById('emptyState');
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  if (!grid || !empty) return;

  try {
    if (firstLoad) {
      firstLoad = false;
      showSkeleton();
      requestAnimationFrame(() => {
        try {
          _renderFiltered(grid, empty, search);
        } catch (err) {
          console.error('[RENDER] Failed after skeleton:', err);
          grid.innerHTML = '';
          empty.style.display = 'block';
          empty.textContent = 'Não foi possível carregar os produtos no momento.';
        }
      });
    } else {
      _renderFiltered(grid, empty, search);
    }
  } catch (err) {
    console.error('[RENDER] Failed to render products:', err);
    grid.innerHTML = '';
    empty.style.display = 'block';
    empty.textContent = 'Não foi possível carregar os produtos no momento.';
  }
  updateShareableUrl();
}

function _renderFiltered(grid, empty, search) {
  if (!grid || !empty) return;
  let filtered = allProducts.filter(isDisplayableProduct);
  // Hide products scheduled for the future
  filtered = filtered.filter(p => !p.publishDate || new Date(p.publishDate) <= new Date());
  if (currentCategory !== 'todos') filtered = filtered.filter(p => p.category === currentCategory);
  if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
  if (priceMin !== null) filtered = filtered.filter(p => p.price >= priceMin);
  if (priceMax !== null) filtered = filtered.filter(p => p.price <= priceMax);

  switch (currentSort) {
    case 'price-asc':  filtered.sort((a, b) => a.price - b.price); break;
    case 'price-desc': filtered.sort((a, b) => b.price - a.price); break;
    case 'discount':   filtered.sort((a, b) => getDiscount(b) - getDiscount(a)); break;
    case 'newest':     filtered.sort((a, b) => b.id - a.id); break;
    default: {
      const featured = sortFeaturedFirst(filtered.filter(p => p.featured || p.homeOrder));
      const rotating = rotateHomeProducts(filtered.filter(p => !(p.featured || p.homeOrder)));
      filtered = [...featured, ...rotating];
      break;
    }
  }

  lastRenderAt = Date.now();
  updateResultsSummary(filtered, search);
  try {
    updateStructuredData(filtered);
  } catch (err) {
    console.warn('[SEO] Structured data skipped:', err);
  }

  if (!filtered.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  try {
    const pinned = sortFeaturedFirst(filtered.filter(p => p.featured || p.homeOrder)).slice(0, HOME_SECTION_LIMIT);
    const campaignItems = getCampaignItems(filtered);
    const rotatingSource = filtered.filter(p => !(p.featured || p.homeOrder || getCampaignGroupKey(p)));
    const rotatingGroups = groupByCategory(rotatingSource);
    const categoryOrder = Object.entries(rotatingGroups)
      .map(([cat, items]) => ({
        cat,
        items: rotateHomeProducts(items)
          .sort((a, b) => getProductScore(b) - getProductScore(a))
          .slice(0, HOME_CATEGORY_LIMIT),
      }))
      .sort((a, b) => b.items.length - a.items.length || a.cat.localeCompare(b.cat));
    const featured = pinned.filter(Boolean);
    const featuredHTML = featured.length ? `
      <section class="home-vitrine home-vitrine-featured">
        <div class="section-head">
          <div>
            <span class="section-kicker">Primeira linha</span>
            <h3>Produtos fixos e campanhas ativas</h3>
          </div>
          <p>Itens fixados manualmente, campanhas e promoções temporárias ficam acima da rotação.</p>
        </div>
        <div class="featured-row">${featured.map(p => cardHTML(p)).join('')}</div>
      </section>` : '';
    const campaignHTML = campaignItems.length ? `
      <section class="home-vitrine home-vitrine-campaign">
        <div class="section-head">
          <div>
            <span class="section-kicker">Vitrine de campanha</span>
            <h3>Ofertas temporárias e campanhas semanais</h3>
          </div>
          <p>Itens com campanha, janela de data ou promoção destacada entram aqui sem misturar com a rotação principal.</p>
        </div>
        <div class="product-grid-inner">${campaignItems.map(p => cardHTML(p)).join('')}</div>
      </section>` : '';
    const rotatingHTML = categoryOrder.length ? `
      <section class="home-vitrine home-vitrine-rotating">
        <div class="section-head">
          <div>
            <span class="section-kicker">Rotação por categoria</span>
            <h3>Vitrine organizada por blocos</h3>
          </div>
          <p>Rotação previsível por janela temporal fixa, sem repetir os fixos na fila rotativa.</p>
        </div>
        ${categoryOrder.map(section => `
          <div class="category-rotation-block">
            <div class="category-rotation-head">
              <h4>${categoryLabel(section.cat)}</h4>
              <span>${section.items.length} oferta${section.items.length === 1 ? '' : 's'}</span>
            </div>
            <div class="product-grid-inner">${section.items.map(p => cardHTML(p)).join('')}</div>
          </div>
        `).join('')}
      </section>` : '';
    const seasonalCollections = getActiveSeasonalCollections(filtered);
    const seasonalHTML = seasonalCollections.length ? `
      <section class="home-vitrine home-vitrine-seasonal">
        <div class="section-head">
          <div>
            <span class="section-kicker">Datas sazonais</span>
            <h3>Coleções especiais por período</h3>
          </div>
          <p>Blocos ativados por janela temporal fixa e previsível.</p>
        </div>
        ${seasonalCollections.map(collection => `
          <div class="category-rotation-block">
            <div class="category-rotation-head">
              <h4>${collection.title}</h4>
              <span>${collection.kicker}</span>
            </div>
            <div class="product-grid-inner">${collection.items.map(p => cardHTML(p)).join('')}</div>
          </div>
        `).join('')}
      </section>` : '';
    grid.innerHTML = `${featuredHTML}${campaignHTML}${seasonalHTML}${rotatingHTML}`;
    animateCards();
    startCountdownTimers();
  } catch (err) {
    console.error('[RENDER] Card generation failed:', err);
    grid.innerHTML = '<p class="empty-state">Não foi possível renderizar os produtos agora.</p>';
    empty.style.display = 'none';
  }
}

// ── SKELETON ─────────────────────────────────────────────────
function showSkeleton() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = Array(8).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skel skel-img"></div>
      <div class="skel-body">
        <div class="skel skel-line"></div>
        <div class="skel skel-line skel-short"></div>
        <div class="skel skel-price"></div>
      </div>
      <div class="skel skel-btn"></div>
    </div>`).join('');
}

// ── CARD ANIMATION ────────────────────────────────────────────
function animateCards() {
  if (typeof IntersectionObserver === 'undefined') return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('card-visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.05 });
  document.querySelectorAll('.product-card').forEach((card, i) => {
    card.style.animationDelay = `${Math.min(i * 60, 500)}ms`;
    observer.observe(card);
  });
}

// ── SORT & PRICE FILTER ───────────────────────────────────────
function setSortMode(val)    { currentSort = val; renderProducts(); }
function setPriceFilter() {
  priceMin = document.getElementById('priceMin').value !== '' ? parseFloat(document.getElementById('priceMin').value) : null;
  priceMax = document.getElementById('priceMax').value !== '' ? parseFloat(document.getElementById('priceMax').value) : null;
  renderProducts();
}
function clearPriceFilter() {
  priceMin = null; priceMax = null;
  document.getElementById('priceMin').value = '';
  document.getElementById('priceMax').value = '';
  renderProducts();
}

function clearAllFilters() {
  currentCategory = 'todos';
  currentSort = 'default';
  priceMin = null;
  priceMax = null;
  const searchEl = document.getElementById('searchInput');
  if (searchEl) searchEl.value = '';
  document.getElementById('priceMin').value = '';
  document.getElementById('priceMax').value = '';
  document.getElementById('sortSelect').value = 'default';
  document.querySelectorAll('.cat-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === 'todos');
  });
  renderProducts();
}

// ── DISCOUNT HELPER ───────────────────────────────────────────
function getDiscount(p) {
  if (!p.originalPrice || p.originalPrice <= p.price) return 0;
  return Math.round((1 - p.price / p.originalPrice) * 100);
}

function cardHTML(p) {
  const images   = getImages(p);
  const main     = images[0] || 'https://via.placeholder.com/300x300?text=Sem+Imagem';
  const hasMore  = images.length > 1 || !!p.video;
  const discount = getDiscount(p);
  const isNew    = p.id && (Date.now() - p.id) < 7 * 24 * 60 * 60 * 1000;
  const isHot    = discount >= 30;
  const isCampaign = isCampaignActive(p) || p.campaignId;

  let leftBadge = '';
  if (p.featured)    leftBadge = '<span class="badge-featured">⭐ Destaque</span>';
  else if (isCampaign) leftBadge = '<span class="badge-featured">🎯 Campanha</span>';
  else if (isHot)    leftBadge = '<span class="badge-hot">🔥 QUENTE</span>';
  else if (isNew)    leftBadge = '<span class="badge-new">✨ NOVO</span>';

  const allMedia = [...images, ...(p.video ? ['__video__'] : [])];
  const thumbsHTML = hasMore ? `
    <div class="card-thumbs">
      ${allMedia.slice(0, 5).map((m, i) => {
        if (m === '__video__') {
          const vt = getVideoThumb(p.video);
          return `<div class="thumb video-thumb" data-action="open-product" data-id="${p.id}" data-start-index="${images.length}">
            ${vt ? `<img src="${vt}" alt="video"/>` : '<div class="vt-placeholder"></div>'}
            <span class="play-icon">▶</span>
          </div>`;
        }
        return `<div class="thumb ${i===0?'active':''}" data-action="open-product" data-id="${p.id}" data-start-index="${i}">
          <img src="${m}" alt="" loading="lazy"/>
        </div>`;
      }).join('')}
      ${allMedia.length > 5 ? `<div class="thumb thumb-more">+${allMedia.length - 5}</div>` : ''}
    </div>` : '';

  return `
  <div class="product-card" data-action="open-product" data-id="${p.id}">
    ${leftBadge}
    ${discount   ? `<span class="badge-discount">-${discount}%</span>` : ''}
    ${hasMore ? `<span class="badge-gallery"><i class="fas fa-images"></i> ${[...images, ...(p.video?['v']:[])].length}</span>` : ''}
    <div class="card-img-wrap">
      <img src="${main}" alt="${p.name} - imagem principal" loading="lazy"
           onerror="this.src='https://via.placeholder.com/300x300?text=Sem+Imagem'"/>
    </div>
    ${thumbsHTML}
    <div class="card-body">
      <div class="card-name">${p.name}</div>
      ${p.desc ? `<div class="card-desc">${formatDescription(p.desc)}</div>` : ''}
      ${p.rating ? `<div class="card-stars">${starsHTML(p.rating)}${p.soldCount ? `<span class="card-sold">${p.soldCount}+ vendidos</span>` : ''}</div>` : (p.soldCount ? `<div class="card-stars"><span class="card-sold">${p.soldCount}+ vendidos</span></div>` : '')}
      <div class="card-prices">
        ${p.originalPrice && p.originalPrice > p.price
          ? `<div class="card-original">R$ ${Number(p.originalPrice).toFixed(2).replace('.',',')}</div>` : ''}
        <div class="card-price">R$ ${Number(p.price).toFixed(2).replace('.',',')}</div>
      </div>
    </div>
        <div class="card-btn">🛒 Comprar na Shopee</div>
    ${(() => { const t = p.countdown ? new Date(p.countdown).getTime() : null; const s = t ? renderCountdownStr(t) : null; return s ? `<div class="card-countdown-wrap"><span class="card-countdown" data-countdown="${t}">⏰ Oferta encerra em: ${s}</span></div>` : ''; })()}
    <button class="card-compare-btn ${compareList.some(id => sameId(id, p.id))?'active':''}" data-pid="${p.id}"
      data-action="toggle-compare" title="Adicionar para comparar">
      <i class="fas fa-columns"></i>
    </button>
  </div>`;
}

// ── STARS ─────────────────────────────────────────────────────
function starsHTML(rating) {
  const r = parseFloat(rating) || 0;
  return Array.from({length: 5}, (_, i) => {
    if (i + 1 <= r)      return '<i class="fas fa-star"></i>';
    if (i + 0.5 <= r)    return '<i class="fas fa-star-half-alt"></i>';
    return '<i class="far fa-star"></i>';
  }).join('') + ` <span class="star-val">${r.toFixed(1)}</span>`;
}

// ── MODAL ─────────────────────────────────────────────────────
let modalProduct = null;
let modalIndex   = 0;

function openProductModal(id, startIdx) {
  const p = allProducts.find(x => sameId(x.id, id));
  if (!p) return;
  // Track click
  const clicks = JSON.parse(localStorage.getItem('shopee_clicks') || '{}');
  clicks[id] = (clicks[id] || 0) + 1;
  localStorage.setItem('shopee_clicks', JSON.stringify(clicks));
  modalProduct = p;
  const images = getImages(p);
  const allMedia = [...images, ...(p.video ? ['__video__'] : [])];
  modalIndex = Math.min(startIdx, allMedia.length - 1);

  // Info panel
  const discount = p.originalPrice && p.originalPrice > p.price
    ? Math.round((1 - p.price / p.originalPrice) * 100) : null;

  trackEvent('view_item', {
    item_id: p.id,
    item_name: p.name,
    item_category: p.category,
    price: Number(p.price) || 0,
    currency: 'BRL',
  });

  document.getElementById('modalName').textContent = p.name;
  document.getElementById('modalCategory').textContent = categoryLabel(p.category);
  document.getElementById('modalDesc').textContent = p.desc || '';
  document.getElementById('modalBuyBtn').href = p.link;
  const buyBtn = document.getElementById('modalBuyBtn');
  if (buyBtn && !buyBtn.dataset.analyticsBound) {
    buyBtn.dataset.analyticsBound = '1';
    buyBtn.addEventListener('click', () => {
      if (!modalProduct) return;
      trackEvent('click_buy_shopee', {
        item_id: modalProduct.id,
        item_name: modalProduct.name,
        item_category: modalProduct.category,
        price: Number(modalProduct.price) || 0,
        currency: 'BRL',
      });
    });
  }

  // Stars & sold count
  const starsEl = document.getElementById('modalStars');
  const soldEl  = document.getElementById('modalSoldCount');
  starsEl.innerHTML  = p.rating ? starsHTML(p.rating) : '';
  soldEl.textContent = p.soldCount ? `🛒 ${p.soldCount}+ vendidos` : '';

  const priceEl    = document.getElementById('modalPrice');
  const origEl     = document.getElementById('modalOriginal');
  const discEl     = document.getElementById('modalDiscount');
  priceEl.textContent = `R$ ${Number(p.price).toFixed(2).replace('.',',')}`;
  if (p.originalPrice && p.originalPrice > p.price) {
    origEl.textContent = `R$ ${Number(p.originalPrice).toFixed(2).replace('.',',')}`;
    discEl.textContent = discount ? `-${discount}%` : '';
    origEl.style.display = ''; discEl.style.display = '';
  } else {
    origEl.style.display = 'none'; discEl.style.display = 'none';
  }

  renderModalMedia(allMedia);
  renderModalThumbs(allMedia);

  // Countdown
  const cdEl     = document.getElementById('modalCountdown');
  const cdTarget = p.countdown ? new Date(p.countdown).getTime() : null;
  const cdStr    = cdTarget ? renderCountdownStr(cdTarget) : null;
  if (cdEl) {
    if (cdStr) { cdEl.textContent = `⏰ Oferta encerra em: ${cdStr}`; cdEl.style.display = ''; }
    else        { cdEl.style.display = 'none'; }
  }

  renderRelated(p);

  document.getElementById('productModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderModalMedia(allMedia) {
  const display = document.getElementById('modalMainDisplay');
  const m = allMedia[modalIndex];
  if (m === '__video__') {
    const embed = getEmbedUrl(modalProduct.video);
    const ytId  = getYouTubeId(modalProduct.video);
    if (ytId) {
      display.innerHTML = `<iframe src="${embed}" frameborder="0" allowfullscreen
        allow="autoplay; encrypted-media" style="width:100%;height:100%;border-radius:8px"></iframe>`;
    } else {
      display.innerHTML = `<video src="${modalProduct.video}" controls autoplay
        style="width:100%;height:100%;border-radius:8px;object-fit:contain;background:#000"></video>`;
    }
  } else {
    display.innerHTML = `<img src="${m}" alt="${modalProduct?.name || 'Produto'} - imagem ampliada" style="width:100%;height:100%;object-fit:contain;border-radius:8px"
      onerror="this.src='https://via.placeholder.com/500x500?text=Imagem+indisponivel'"/>`;
  }
}

function renderModalThumbs(allMedia) {
  const strip = document.getElementById('modalThumbsStrip');
  const images = getImages(modalProduct);
  strip.innerHTML = allMedia.map((m, i) => {
    const isVideo = m === '__video__';
    const src = isVideo ? (getVideoThumb(modalProduct.video) || '') : m;
    return `<div class="modal-thumb ${i===modalIndex?'active':''} ${isVideo?'video-thumb':''}"
      data-action="set-modal-index" data-index="${i}">
      ${src ? `<img src="${src}" alt="${modalProduct?.name || 'Produto'} ${isVideo ? 'vídeo' : 'imagem'} ${i + 1}"/>` : '<div class="vt-placeholder"></div>'}
      ${isVideo ? '<span class="play-icon">▶</span>' : ''}
    </div>`;
  }).join('');
}

function setModalIndex(i) {
  const images   = getImages(modalProduct);
  const allMedia = [...images, ...(modalProduct.video ? ['__video__'] : [])];
  modalIndex = i;
  renderModalMedia(allMedia);
  renderModalThumbs(allMedia);
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
  document.body.style.overflow = '';
  // Stop video
  document.getElementById('modalMainDisplay').innerHTML = '';
  modalProduct = null;
}

function closeModalOutside(e) {
  if (e.target.id === 'productModal') closeProductModal();
}

function handleOpenProductAction(el) {
  const id = el.dataset.id;
  const startIdx = parseInt(el.dataset.startIndex || '0', 10);
  if (id) openProductModal(id, Number.isFinite(startIdx) ? startIdx : 0);
}

// Keyboard navigation
document.addEventListener('keydown', e => {
  if (!modalProduct) return;
  const images   = getImages(modalProduct);
  const allMedia = [...images, ...(modalProduct.video ? ['__video__'] : [])];
  if (e.key === 'Escape')      closeProductModal();
  if (e.key === 'ArrowRight' && modalIndex < allMedia.length - 1) setModalIndex(modalIndex + 1);
  if (e.key === 'ArrowLeft'  && modalIndex > 0)                   setModalIndex(modalIndex - 1);
});

// ── CATEGORY SCROLL ───────────────────────────────────────────
function scrollCat(dir) {
  const track = document.getElementById('catTrack');
  if (track) track.scrollBy({ left: dir * 220, behavior: 'smooth' });
}
window.scrollCat = scrollCat;

// ── FILTER CONTROLS ───────────────────────────────────────────
function setCategory(cat, btn) {
  currentCategory = cat;
  document.querySelectorAll('.cat-item, .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProducts();
}
function filterProducts() { renderProducts(); }

function categoryLabel(cat) {
  const map = {
    'roupas-fem':  '👗 Roupas Femininas',
    'roupas-masc': '👔 Roupas Masculinas',
    'sapatos':     '👟 Sapatos',
    'moda':        '💍 Acessórios de Moda',
    'celulares':   '📱 Celulares',
    'eletronicos': '💻 Eletrônicos',
    'computadores':'🖥️ Computadores',
    'jogos':       '🎮 Jogos e Consoles',
    'cameras':     '📷 Câmeras e Drones',
    'audio':       '🎧 Áudio',
    'eletrodom':   '🏠 Eletrodomésticos',
    'casa':        '🏡 Casa e Construção',
    'alimentos':   '🍎 Alimentos e Bebidas',
    'beleza':      '💄 Beleza',
    'saude':       '💊 Saúde',
    'esporte':     '⚽ Esportes e Lazer',
    'bebes':       '👶 Mãe e Bebê',
    'brinquedos':  '🧸 Brinquedos e Hobbies',
    'animais':     '🐾 Animais Domésticos',
    'automoveis':  '🚗 Automóveis',
    'livros':      '📚 Livros e Revistas',
    'outros':      '✨ Outros',
  };
  return map[cat] || cat;
}

function formatUpdatedTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function updateHeroStats() {
  const countEl = document.getElementById('heroCount');
  const updatedEl = document.getElementById('heroUpdated');
  if (countEl) countEl.textContent = allProducts.length;
  if (updatedEl) updatedEl.textContent = allProducts.length
    ? `às ${formatUpdatedTime(Date.now())}`
    : 'aguardando novos produtos';
}

function updatePageSeo(filtered, search) {
  const baseTitle = 'Ofertas na Shopee com Desconto | Melhores Ofertas';
  const baseDescription = 'Curadoria de ofertas na Shopee com descontos, comparação de preços e links de afiliado. Veja produtos atualizados por categoria, preço, campanha e coleção sazonal.';
  const liveCount = filtered.length;
  const activeCategory = currentCategory !== 'todos' ? categoryLabel(currentCategory) : null;
  const searchTerm = search ? `busca por "${search}"` : null;
  const activeCategoryName = activeCategory ? activeCategory.replace(/^.*? /, '') : null;
  const titleBits = [];
  if (activeCategoryName) titleBits.push(activeCategoryName);
  if (searchTerm) titleBits.push(searchTerm);
  document.title = titleBits.length ? `${titleBits.join(' · ')} | Melhores Ofertas` : baseTitle;

  const description = activeCategoryName
    ? `${activeCategoryName} com ofertas selecionadas, comparação de preços, campanhas e rotação por categoria.`
    : search
      ? `Resultados de busca para ${search} com ofertas atualizadas e filtros por preço e categoria.`
      : `Curadoria de ofertas na Shopee com rotação por categoria, campanhas temporárias e coleções sazonais.`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', `${description} Veja ${liveCount} oferta${liveCount === 1 ? '' : 's'} na vitrine atual.`);

  const robotsMeta = document.querySelector('meta[name="robots"]');
  const hasFilteredView = !!(activeCategory || search || priceMin !== null || priceMax !== null || currentSort !== 'default');
  if (robotsMeta) robotsMeta.setAttribute('content', hasFilteredView ? 'noindex, follow' : 'index, follow');

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    canonical.setAttribute('href', hasFilteredView
      ? `${window.location.origin}${window.location.pathname}${currentCategory !== 'todos' ? `?cat=${encodeURIComponent(currentCategory)}` : ''}`
      : `${window.location.origin}/`);
  }

  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogTitle) ogTitle.setAttribute('content', document.title);
  if (ogDesc) ogDesc.setAttribute('content', description);
  if (ogUrl) ogUrl.setAttribute('content', hasFilteredView && currentCategory !== 'todos'
    ? `${window.location.origin}${window.location.pathname}?cat=${encodeURIComponent(currentCategory)}`
    : `${window.location.origin}/`);
}

function updateResultsSummary(filtered, search) {
  const summaryEl = document.getElementById('resultsSummary');
  const contextEl = document.getElementById('activeContext');
  const updatedEl = document.getElementById('resultsUpdated');
  if (!summaryEl || !contextEl || !updatedEl) return;

  const totalLive = allProducts.filter(p => !p.publishDate || new Date(p.publishDate) <= new Date()).length;
  summaryEl.textContent = `${filtered.length} oferta${filtered.length === 1 ? '' : 's'} encontrada${filtered.length === 1 ? '' : 's'} de ${totalLive}`;

  const parts = [];
  if (currentCategory !== 'todos') parts.push(categoryLabel(currentCategory));
  if (search) parts.push(`busca por "${search}"`);
  if (priceMin !== null || priceMax !== null) {
    const minText = priceMin !== null ? `R$ ${priceMin.toFixed(2).replace('.', ',')}` : 'qualquer valor';
    const maxText = priceMax !== null ? `R$ ${priceMax.toFixed(2).replace('.', ',')}` : 'qualquer valor';
    parts.push(`faixa de ${minText} até ${maxText}`);
  }
  const sortLabel = document.getElementById('sortSelect')?.selectedOptions?.[0]?.textContent?.toLowerCase() || 'destaques';
  parts.push(currentSort === 'default' ? 'ordenado por destaques' : `ordenado por ${sortLabel}`);
  contextEl.textContent = parts.join(' · ');
  updatedEl.textContent = `Última atualização: ${formatUpdatedTime(lastRenderAt)}`;
  updateHeroStats();
  updatePageSeo(filtered, search);
}

function updateStructuredData(filtered) {
  const existing = document.getElementById('dynamicStructuredData');
  const payload = filtered.slice(0, 8).map((p, index) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    "position": index + 1,
    "name": p.name,
    "description": stripHtml(p.desc || ''),
    "image": getImages(p)[0] || '',
    "offers": {
      "@type": "Offer",
      "priceCurrency": "BRL",
      "price": Number.isFinite(Number(p.price)) ? Number(p.price).toFixed(2) : undefined,
      "url": p.link,
      "availability": "https://schema.org/InStock"
    }
  })).filter(item => item.offers.price);

  const itemList = payload.map(item => ({
    "@type": "ListItem",
    "position": item.position,
    "url": item.offers.url,
    "item": item,
  }));

  const breadcrumbs = [
    { name: 'Home', url: 'https://melhoresdashopee.com.br/' },
  ];
  if (currentCategory !== 'todos') {
    breadcrumbs.push({
      name: categoryLabel(currentCategory).replace(/^.*? /, ''),
      url: `${window.location.origin}${window.location.pathname}?cat=${encodeURIComponent(currentCategory)}`,
    });
  }

  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbs.map((crumb, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "name": crumb.name,
          "item": crumb.url,
        }))
      },
      {
        "@type": "ItemList",
        "name": currentCategory !== 'todos' ? `Ofertas de ${categoryLabel(currentCategory).replace(/^.*? /, '')}` : 'Ofertas em destaque',
        "itemListOrder": "https://schema.org/ItemListOrderDescending",
        "numberOfItems": payload.length,
        "itemListElement": itemList
      }
    ]
  };

  const script = existing || document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'dynamicStructuredData';
  script.textContent = JSON.stringify(json);
  if (!existing) document.head.appendChild(script);
}

function initAppBindings() {
  const searchInput = document.getElementById('searchInput');
  const darkToggle = document.getElementById('darkToggle');
  const heroPrevBtn = document.getElementById('heroPrevBtn');
  const heroNextBtn = document.getElementById('heroNextBtn');
  const catLeft = document.getElementById('catLeft');
  const catRight = document.getElementById('catRight');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  const clearPriceBtn = document.getElementById('clearPriceBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const priceMinEl = document.getElementById('priceMin');
  const priceMaxEl = document.getElementById('priceMax');
  const productModal = document.getElementById('productModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
  const shareTelegramBtn = document.getElementById('shareTelegramBtn');
  const btnCompareNow = document.getElementById('btnCompareNow');
  const compareClearBtn = document.getElementById('compareClearBtn');
  const compareModal = document.getElementById('compareModal');
  const compareCloseBtn = document.getElementById('compareCloseBtn');

  searchInput?.addEventListener('input', () => { filterProducts(); updateSearchSuggestions(); });
  searchInput?.addEventListener('focus', showSearchHistory);
  searchInput?.addEventListener('blur', hideSearchDropdown);
  searchInput?.addEventListener('keydown', handleSearchKey);
  darkToggle?.addEventListener('click', toggleDarkMode);
  heroPrevBtn?.addEventListener('click', heroPrev);
  heroNextBtn?.addEventListener('click', heroNext);
  catLeft?.addEventListener('click', () => scrollCat(-1));
  catRight?.addEventListener('click', () => scrollCat(1));
  clearFiltersBtn?.addEventListener('click', clearAllFilters);
  clearPriceBtn?.addEventListener('click', clearPriceFilter);
  clearAllBtn?.addEventListener('click', clearAllFilters);
  priceMinEl?.addEventListener('input', setPriceFilter);
  priceMaxEl?.addEventListener('input', setPriceFilter);
  modalCloseBtn?.addEventListener('click', closeProductModal);
  shareWhatsAppBtn?.addEventListener('click', shareWhatsApp);
  shareTelegramBtn?.addEventListener('click', shareTelegram);
  btnCompareNow?.addEventListener('click', openCompareModal);
  compareClearBtn?.addEventListener('click', clearCompare);
  compareCloseBtn?.addEventListener('click', closeCompareModal);
  productModal?.addEventListener('click', e => { if (e.target === productModal) closeProductModal(); });
  compareModal?.addEventListener('click', e => { if (e.target === compareModal) closeCompareModal(); });

  const productGrid = document.getElementById('productGrid');
  const heroSlides = document.getElementById('heroSlides');
  const heroDots = document.getElementById('heroDots');
  const modalThumbsStrip = document.getElementById('modalThumbsStrip');
  const modalRelatedList = document.getElementById('modalRelatedList');
  const compareSlots = document.getElementById('compareSlots');

  productGrid?.addEventListener('click', e => {
    const openEl = e.target.closest('[data-action="open-product"]');
    if (openEl) handleOpenProductAction(openEl);
    const compareEl = e.target.closest('[data-action="toggle-compare"]');
    if (compareEl) toggleCompare(compareEl.dataset.pid, e);
  });
  heroSlides?.addEventListener('click', e => {
    const openEl = e.target.closest('[data-action="open-product"]');
    if (openEl) handleOpenProductAction(openEl);
  });
  heroDots?.addEventListener('click', e => {
    const dot = e.target.closest('[data-action="hero-dot"]');
    if (dot) goHeroSlide(parseInt(dot.dataset.index || '0', 10));
  });
  modalThumbsStrip?.addEventListener('click', e => {
    const thumb = e.target.closest('[data-action="set-modal-index"]');
    if (thumb) setModalIndex(parseInt(thumb.dataset.index || '0', 10));
  });
  modalRelatedList?.addEventListener('click', e => {
    const openEl = e.target.closest('[data-action="open-product"]');
    if (openEl) handleOpenProductAction(openEl);
  });
  compareSlots?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="toggle-compare-remove"]');
    if (btn) toggleCompare(btn.dataset.pid, e);
  });

  document.querySelectorAll('.cat-item[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => setCategory(btn.dataset.cat, btn));
  });
}

initDarkMode();
renderProducts();
initHeroBanner();
initLGPD();
window.clearAllFilters = clearAllFilters;
document.addEventListener('DOMContentLoaded', initAppBindings);

// ── LGPD CONSENT ──────────────────────────────────────────────
function initLGPD() {
  const consent = localStorage.getItem('lgpd_consent');
  if (consent) return; // already decided
  const banner = document.getElementById('lgpdBanner');
  if (banner) banner.style.display = 'flex';

  document.getElementById('lgpdAccept')?.addEventListener('click', () => {
    localStorage.setItem('lgpd_consent', 'accepted');
    if (banner) banner.style.display = 'none';
  });
  document.getElementById('lgpdDecline')?.addEventListener('click', () => {
    localStorage.setItem('lgpd_consent', 'declined');
    // Clear tracking data on decline
    localStorage.removeItem('shopee_search_history');
    localStorage.removeItem('shopee_clicks');
    if (banner) banner.style.display = 'none';
  });
}
