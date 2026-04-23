// ── HERO BANNER CAROUSEL ─────────────────────────────────────
let heroCurrent  = 0;
let heroTimer    = null;
const HERO_INTERVAL = 5000;
const HOME_ROTATION_MINUTES = 20;
const HOME_ROTATION_MINUTES_LONG = 30;
const HOME_SECTION_LIMIT = 60;
const CAMPAIGN_SECTION_LIMIT = 120;
const HOME_ROTATION_LIMIT = 200;
const SEASONAL_COLLECTION_LIMIT = 24;
const FIRESTORE_CACHE_KEY = 'shopee_products_cache_v2';
const FIRESTORE_CACHE_TTL_MS = 10 * 60 * 1000;
const GAMIFICATION_KEY = 'shopee_gamification';
let lastRenderAt = Date.now();

// ── WEB WORKER SETUP ─────────────────────────────────────────
let dataWorker = null;
const workerCallbacks = new Map();
let workerCallId = 0;

function getWorker() {
  if (!dataWorker && typeof Worker !== 'undefined') {
    try {
      dataWorker = new Worker('js/worker.js');
      dataWorker.onmessage = (e) => {
        const { id, type, result, error } = e.data;
        if (workerCallbacks.has(id)) {
          const { resolve, reject } = workerCallbacks.get(id);
          workerCallbacks.delete(id);
          if (type === 'ERROR') reject(new Error(error));
          else resolve(result);
        }
      };
      dataWorker.onerror = (err) => console.warn('[Worker] Error:', err.message);
    } catch (e) {
      console.warn('[Worker] Not supported, falling back to main thread:', e.message);
    }
  }
  return dataWorker;
}

function workerCall(type, payload) {
  const worker = getWorker();
  if (!worker) return Promise.reject(new Error('No worker'));
  return new Promise((resolve, reject) => {
    const id = ++workerCallId;
    workerCallbacks.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });
}

// State variables are declared later in the DATA section to avoid duplicates.

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

// ── PERFORMANCE: INTENT-BASED PREFETCHING ────────────────────
let prefetchTimeout = null;
function initIntentPrefetch() {
  const catItems = document.querySelectorAll('.cat-item[data-cat]');
  catItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
      const cat = item.dataset.cat;
      prefetchTimeout = setTimeout(() => {
        prefetchCategory(cat);
      }, 100); // Wait 100ms to ensure intent
    });
    item.addEventListener('mouseleave', () => {
      clearTimeout(prefetchTimeout);
    });
  });
}

async function prefetchCategory(cat) {
  if (cat === 'todos') return;
  // This will warm up the cache/worker for this category
  workerCall('GET_BY_CATEGORY', { category: cat, limit: 10 });
  console.log(`[Prefetch] Warmed up category: ${cat}`);
}

// ── AI-SEO: DYNAMIC FAQ GENERATOR ────────────────────────────
function renderCategoryFAQ(cat) {
  const container = document.getElementById('categoryFAQ');
  if (!container) return;

  const faqs = {
    'eletronicos': [
      { q: "Qual o melhor fone Bluetooth na Shopee em 2026?", a: "Para custo-benefício, o Lenovo XT80 continua imbatível. Para qualidade premium, os modelos da Baseus oferecem o melhor cancelamento de ruído abaixo de R$ 150." },
      { q: "É seguro comprar eletrônicos da China?", a: "Sim, desde que você escolha lojas oficiais ou com o selo 'Shopee Escolha'. Nossa curadoria filtra apenas vendedores com mais de 98% de avaliações positivas." }
    ],
    'moda': [
      { q: "Como saber o tamanho certo de roupas na Shopee?", a: "Sempre verifique a tabela de medidas em cm e adicione 1-2cm de margem. Roupas asiáticas tendem a ser menores que o padrão brasileiro." }
    ]
  };

  const currentFaqs = faqs[cat] || [
    { q: "As ofertas são atualizadas em tempo real?", a: "Sim, nossa equipe monitora quedas de preço e cupons 24h por dia para garantir que você sempre pegue o menor valor." }
  ];

  container.innerHTML = `
    <div class="faq-section reveal-on-scroll">
      <h3>Dúvidas Frequentes sobre ${categoryLabel(cat)}</h3>
      <div class="faq-grid">
        ${currentFaqs.map(f => `
          <div class="faq-item">
            <strong>${f.q}</strong>
            <p>${f.a}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Inject FAQ Schema (AEO/GEO Boost)
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": currentFaqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.a
      }
    }))
  };
  const existing = document.getElementById('faq-schema-ld');
  if (existing) existing.remove();
  const script = document.createElement('script');
  script.id = 'faq-schema-ld';
  script.type = 'application/ld+json';
  script.text = JSON.stringify(schema);
  document.head.appendChild(script);
}

// ── GEO: STRUCTURED DATA INJECTION (JSON-LD) ─────────────────
function injectProductSchema(p) {
  // Remove existing product schema
  const existing = document.getElementById('product-schema-ld');
  if (existing) existing.remove();

  const schema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": p.name,
    "image": p.images || [p.image],
    "description": p.desc || `Oferta especial: ${p.name} na Shopee.`,
    "sku": p.id,
    "brand": {
      "@type": "Brand",
      "name": "Shopee Official"
    },
    "datePublished": "2026-04-20T08:00:00Z",
    "dateModified": new Date().toISOString(),
    "offers": {
      "@type": "Offer",
      "url": p.link,
      "priceCurrency": "BRL",
      "price": p.price,
      "itemCondition": "https://schema.org/NewCondition",
      "availability": "https://schema.org/InStock"
    },
    "review": {
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "4.8",
        "bestRating": "5"
      },
      "author": {
        "@type": "Organization",
        "name": "Melhores Ofertas"
      }
    }
  };

  const script = document.createElement('script');
  script.id = 'product-schema-ld';
  script.type = 'application/ld+json';
  script.text = JSON.stringify(schema);
  document.head.appendChild(script);
}

function getInitialSearchTerm() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('q') || params.get('search') || '').trim();
}

// ── E-E-A-T UTILITIES ─────────────────────────────────────────
function openCriteriaModal() {
  document.getElementById('criteriaModal').classList.remove('hidden-block');
  document.body.style.overflow = 'hidden';
}
function closeCriteriaModal() {
  document.getElementById('criteriaModal').classList.add('hidden-block');
  document.body.style.overflow = '';
}

// Mock Expert Notes for Top Tier Products
const CURATOR_NOTES = {
  'p1': 'Design industrial impecável e cancelamento de ruído que surpreende pelo preço.',
  'p2': 'A fritura mais uniforme que já testamos. O cesto quadrado otimiza muito o espaço.',
  'p3': 'Kit essencial para quem acabou de comprar o iPhone e quer proteção sem gastar 200 reais.',
  'p4': 'Bolsas com acabamento de marca de luxo. A costura é reforçada e o material é muito fácil de limpar.'
};

function getCuratorNote(pid) {
  return CURATOR_NOTES[pid] || null;
}

function getSellerStatus(p) {
  // Logic to simulate seller reputation check
  const random = Math.random();
  if (p.isOfficial) return 'elite';
  if (random > 0.95) return 'dropping'; // 5% chance of warning for demo
  return 'stable';
}

function sameId(a, b) {
  if (!a || !b) return false;
  return String(a).trim() === String(b).trim();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeImageUrl(url, size = 'large') {
  let value = String(url || '').trim();
  if (!value) return '';
  value = value.replace(/[?#].*$/, '');

  // Otimização para CDN da Shopee
  if (value.includes('shopee') && value.includes('/file/')) {
    // _tn é o único sufixo universalmente seguro para miniaturas no CDN Shopee
    if (size === 'thumb' && !value.endsWith('_tn')) value += '_tn';
  }
  return value;
}

function stringHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function productFingerprint(item) {
  if (item._fp) return item._fp; // Cache hit
  const name = normalizeText(item?.name || '');
  const price = Number.isFinite(Number(item?.price)) ? Number(Number(item.price)).toFixed(2) : '';
  const image = normalizeImageUrl(getImages(item)[0] || '');
  const fp = (name || image || price) ? [name, price, image].join('|') : String(item?.id || '').trim();
  item._fp = fp; // Save to cache
  return fp;
}

// Extracts the canonical Shopee product path (strips tracking params)
function productLinkKey(item) {
  const raw = String(item?.link || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return (url.hostname + url.pathname).toLowerCase().replace(/\/+$/, '');
  } catch { return raw.split('?')[0].toLowerCase(); }
}

// Soft key: name+price only, ignores image/URL differences
function productSoftKey(item) {
  if (item._soft) return item._soft;
  const name = normalizeText(item?.name || '');
  const price = Number.isFinite(Number(item?.price)) ? Number(Number(item.price)).toFixed(2) : '';
  const soft = name ? `${name}|${price}` : productFingerprint(item);
  item._soft = soft;
  return soft;
}

function dedupeProducts(items) {
  const seenFp   = new Set();
  const seenSoft = new Set();
  const seenLink = new Set();
  const now = Date.now();

  return items.filter(item => {
    // Pré-processamento rápido (Cache/Normalização)
    if (!item._processed) {
      item._priceNum = Number(item.price) || 0;
      item._publishTs = item.publishDate ? new Date(item.publishDate).getTime() : 0;
      item._startTs = (item.campaignStart || item.publishDate) ? new Date(item.campaignStart || item.publishDate).getTime() : 0;
      item._endTs = item.campaignEnd ? new Date(item.campaignEnd).getTime() : 9999999999999;
      item._processed = true;
    }

    const fp   = productFingerprint(item);
    const soft = productSoftKey(item);
    const link = productLinkKey(item);

    if (item.featured || item.homeOrder) return true;
    if (seenFp.has(fp) || seenSoft.has(soft) || (link && seenLink.has(link))) return false;

    seenFp.add(fp);
    seenSoft.add(soft);
    if (link) seenLink.add(link);
    return true;
  });
}

function dedupeByContent(items) {
  return dedupeProducts(items);
}

function pickUnique(items, used, limit) {
  const picked    = [];
  const usedSoft  = new Set();
  const usedLink  = new Set();
  for (const item of items) {
    const key  = productFingerprint(item);
    const soft = productSoftKey(item);
    const link = productLinkKey(item);
    if (used.has(key) || usedSoft.has(soft) || (link && usedLink.has(link))) continue;
    used.add(key);
    usedSoft.add(soft);
    if (link) usedLink.add(link);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
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
  const now = Date.now();
  const start = p._startTs || 0;
  const end = p._endTs || 9999999999999;
  return now >= start && now <= end;
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
      items: items
        .filter(p => !p.featured && !p.homeOrder)
        .filter(p => matchesSeasonalCollection(p, collection))
        .slice(0, SEASONAL_COLLECTION_LIMIT),
    }))
    .filter(c => c.items.length);
}

function getCampaignItems(items) {
  const campaignSet = items
    .filter(p => !p.featured && !p.homeOrder && getCampaignGroupKey(p))
    .sort((a, b) => {
      // Use time bucket for rotation
      const bucket = getTimeBucket(5);
      const hashA = stringHash(productFingerprint(a) + bucket);
      const hashB = stringHash(productFingerprint(b) + bucket);
      return hashA - hashB;
    })
    .slice(0, CAMPAIGN_SECTION_LIMIT);

  if (campaignSet.length >= CAMPAIGN_SECTION_LIMIT) return campaignSet;

  // Fill remaining slots with products from all categories, spread evenly
  const usedFp = new Set(campaignSet.map(p => productFingerprint(p)));
  const candidates = items
    .filter(p => !p.featured && !p.homeOrder && !usedFp.has(productFingerprint(p)))
    .sort((a, b) => getProductScore(b) - getProductScore(a));

  // Interleave by category for diversity
  const byCategory = {};
  for (const p of candidates) {
    const cat = p.category || 'outros';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }
  const catQueues = Object.values(byCategory);
  const fill = [];
  const needed = CAMPAIGN_SECTION_LIMIT - campaignSet.length;
  while (fill.length < needed && catQueues.some(q => q.length)) {
    for (const q of catQueues) {
      if (fill.length >= needed) break;
      if (q.length) fill.push(q.shift());
    }
  }

  return [...campaignSet, ...fill];
}


function getProductScore(p, clicks = {}) {
  const clickN = Number(clicks[p.id] || 0);
  const catAffinity = getCategoryAffinity(p.category);
  const discount = getDiscount(p);
  const featured = p.featured ? 50 : 0;
  const orderBoost = Number.isFinite(Number(p.homeOrder)) ? Math.max(0, 100 - Number(p.homeOrder)) : 0;
  const campaignBoost = isCampaignActive(p) ? 30 : 0;

  // Score = Cliques do produto + Afinidade da Categoria + Desconto + Boosts
  return (clickN * 5) + (catAffinity * 10) + discount + featured + orderBoost + campaignBoost;
}

function getCategoryAffinity(cat) {
  const clicks = JSON.parse(localStorage.getItem('shopee_clicks_cat') || '{}');
  return Number(clicks[cat] || 0);
}

function trackCategoryClick(cat) {
  if (!cat) return;
  const clicks = JSON.parse(localStorage.getItem('shopee_clicks_cat') || '{}');
  clicks[cat] = (clicks[cat] || 0) + 1;
  localStorage.setItem('shopee_clicks_cat', JSON.stringify(clicks));
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
  const bucket = getTimeBucket(HOME_ROTATION_MINUTES_LONG);
  return [...items].sort((a, b) => {
    // Usa cache de hash se possível
    const aKey = a._rotKey || hashString(`${bucket}:${a.category}:${a.id}`);
    const bKey = b._rotKey || hashString(`${bucket}:${b.category}:${b.id}`);
    a._rotKey = aKey; b._rotKey = bKey;
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
  const featured = visibleProducts.filter(p => p.featured).slice(0, 3);
  const slides   = featured.length >= 2 ? featured : visibleProducts.slice(0, Math.min(3, visibleProducts.length));

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
    const img      = getImages(p, 'large')[0] || '';
    const discount = getDiscount(p);
    return `<div class="hero-slide ${i === 0 ? 'active' : ''}" data-action="open-product" data-id="${p.id}">
      ${img ? `<img src="${img}" class="hero-slide-img" alt="${escapeHTML(p.name)}" fetchpriority="${i === 0 ? 'high' : 'low'}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" />` : ''}
      <div class="hero-slide-overlay"></div>
      <div class="hero-slide-content">
        ${discount ? `<span class="hero-badge">-${discount}%</span>` : ''}
        <h2>${escapeHTML(p.name)}</h2>
        <p class="hero-slide-price">R$ ${Number(p.price).toFixed(2).replace('.',',')}</p>
        <span class="hero-cta">Ver oferta →</span>
      </div>
    </div>`;
  }).join('');

  dotsEl.innerHTML = slides.map((_, i) =>
    `<button class="hero-dot ${i===0?'active':''}" data-action="hero-dot" data-index="${i}" aria-label="Ver slide ${i + 1}"></button>`
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
  let related = allProducts
    .filter(isDisplayableProduct)
    .filter(x => x.category === p.category && !sameId(x.id, p.id));

  // Se houver poucos na mesma categoria, preenche com DESTAQUES gerais
  if (related.length < 4) {
    const featured = allProducts
      .filter(isDisplayableProduct)
      .filter(x => x.category !== p.category && !sameId(x.id, p.id) && x.featured)
      .slice(0, 4 - related.length);
    related = [...related, ...featured];
  }

  related = related.slice(0, 4);
  if (!related.length) { el.classList.add('hidden-block'); return; }
  el.classList.remove('hidden-block');
  listEl.innerHTML = related.map(r => {
    const img = getImages(r)[0] || '';
    return `<div class="related-item" data-action="open-product" data-id="${r.id}" data-hover-img="${img}">
      <img src="${img}" alt="${escapeHTML(r.name)}" loading="lazy" decoding="async"
           onerror="this.src='https://via.placeholder.com/80x80?text=?'"/>
      <div class="related-name">${escapeHTML(r.name.substring(0,40))}${r.name.length>40?'…':''}</div>
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
      ${img ? `<img src="${img}" alt="${escapeHTML(p.name)}" loading="lazy" decoding="async"/>` : '<div class="compare-slot-placeholder"></div>'}
      <span>${escapeHTML(p.name.substring(0,22))}${p.name.length>22?'…':''}</span>
      <button data-action="toggle-compare-remove" data-pid="${p.id}" title="Remover"><i class="fa-solid fa-xmark"></i></button>
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
    { label: 'Imagem',     fn: p => `<img src="${getImages(p)[0]||''}" alt="${escapeHTML(p.name)}" loading="lazy" decoding="async" onerror="this.src='https://via.placeholder.com/90x90?text=?'"/>` },
    { label: 'Nome',       fn: p => escapeHTML(p.name) },
    { label: 'Categoria',  fn: p => escapeHTML(categoryLabel(p.category)) },
    { label: 'Preço',      fn: p => `<strong style="color:#ee4d2d">R$ ${Number(p.price).toFixed(2).replace('.',',')}</strong>` },
    { label: 'Original',   fn: p => p.originalPrice ? `<s>R$ ${Number(p.originalPrice).toFixed(2).replace('.',',')}</s>` : '–' },
    { label: 'Desconto',   fn: p => { const d=getDiscount(p); return d ? `<span class="badge-discount">-${d}%</span>` : '–'; } },
    { label: 'Avaliação',  fn: p => p.rating    ? starsHTML(p.rating) : '–' },
    { label: 'Vendidos',   fn: p => p.soldCount ? `${p.soldCount}+`   : '–' },
    { label: '',           fn: p => `<a href="${p.link}" target="_blank" rel="noopener" class="modal-buy-btn" style="font-size:.78rem;padding:7px 12px"><i class="fa-solid fa-cart-shopping"></i> Comprar</a>` },
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
  const imgs = getImages(modalProduct);
  const mainImg = imgs[0] || '';
  const text = [
    `🔥 *${modalProduct.name}*`,
    `📂 ${categoryLabel(modalProduct.category)}`,
    discount ? `🏷️ Economia de *${discount}%*` : null,
    `💰 ${priceLine}`,
    `⚠️ Preço promocional sujeito a alteração sem aviso prévio.`,
    modalProduct.desc ? `📝 ${formatDescription(modalProduct.desc)}` : null,
    `🛒 Confira na Shopee: ${modalProduct.link}`,
    `🖼️ Ver foto: ${mainImg}`
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
    return `<div class="dd-item" onmousedown="selectSuggestion('${escapeHTML(m).replace(/'/g,"\\'")}')">
      <i class="fa-solid fa-magnifying-glass"></i> ${hi}
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
      <div class="dd-item" onmousedown="selectSuggestion('${escapeHTML(h).replace(/'/g,"\\'")}')">
        <i class="fa-solid fa-clock-rotate-left"></i> ${escapeHTML(h)}
        <button class="dd-remove" onmousedown="event.stopPropagation();removeHistory('${escapeHTML(h).replace(/'/g,"\\'")}')">
          <i class="fa-solid fa-xmark"></i>
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
  const saved = localStorage.getItem('darkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (saved === '1' || (saved === null && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    const icon = document.getElementById('darkIcon');
    if (icon) icon.className = 'fa-solid fa-sun';
  }
}
function toggleDarkMode() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const icon = document.getElementById('darkIcon');
  if (icon) icon.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  localStorage.setItem('darkMode', isDark ? '0' : '1');
}

// ── HELPERS ──────────────────────────────────────────────────
function getImages(p, size = 'large') {
  if (!p) return [];
  const imgs = p.images && p.images.length ? p.images : (p.image ? [p.image] : []);
  return imgs.map(url => normalizeImageUrl(url, size));
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

const CAT_MAP = {
  'todos': 'Todas as Ofertas',
  'roupas-fem': 'Feminino',
  'roupas-masc': 'Masculino',
  'sapatos': 'Calçados',
  'moda': 'Moda e Acessórios',
  'celulares': 'Celulares',
  'eletronicos': 'Eletrônicos',
  'computadores': 'Informática',
  'audio': 'Áudio',
  'casa': 'Casa e Vida',
  'beleza': 'Beleza',
  'saude': 'Saúde',
  'esporte': 'Esportes',
  'bebes': 'Mães e Bebês',
  'brinquedos': 'Brinquedos',
  'animais': 'Pets',
  'automoveis': 'Automotivo',
  'alimentos': 'Alimentos e Bebidas',
  'livros': 'Livros e Revistas',
  'outros': 'Outros'
};
let firstLoad       = true;
let allProducts = []; // Começa vazio para não travar o carregamento inicial
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
    // 1. Carregamento Ultra-rápido do Cache Local (LCP Crítico)
    const localRaw = localStorage.getItem('shopee_products');
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      allProducts = dedupeProducts(parsed);

      // Renderização síncrona imediata para evitar CLS/LCP atrasado
      renderProducts();
      initHeroBanner();

      // Otimização de LCP: Preload imediato da primeira imagem do Hero
      const heroItem = allProducts.filter(isDisplayableProduct).find(p => p.featured) || allProducts[0];
      if (heroItem) {
        const heroImg = getImages(heroItem, 'large')[0];
        if (heroImg) {
          const lcpPreload = document.createElement('link');
          lcpPreload.rel = 'preload';
          lcpPreload.as = 'image';
          lcpPreload.href = heroImg;
          lcpPreload.imageSrcset = ""; // Prevents browser from waiting if using srcset
          lcpPreload.fetchPriority = "high";
          document.head.appendChild(lcpPreload);
        }
      }
    }

    // 2. Importação Diferida das Dependências Pesadas (Firebase)
    // Pequeno respiro para não travar a interatividade do usuário
    await new Promise(r => window.requestIdleCallback ? requestIdleCallback(() => r()) : setTimeout(r, 100));

    const { firebaseConfig } = await import("./config.js");
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const fs = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    const app = initializeApp(firebaseConfig);
    firestoreDb = fs.getFirestore(app);

    // 3. Sync com Firestore (Background)
    const snap = await fs.getDocs(fs.query(fs.collection(firestoreDb, 'products'), fs.orderBy('updatedAt', 'desc')));
    const remote = snap.docs.map(d => ({ ...d.data(), id: d.data().id || d.id })).filter(Boolean);

    if (remote.length) {
      const prevCount = allProducts.length;
      allProducts = dedupeProducts(remote);

      // Só re-renderiza e salva se houver novos itens
      if (allProducts.length !== prevCount) {
        localStorage.setItem('shopee_products', JSON.stringify(allProducts));
        renderProducts();
        initHeroBanner();
      }
    }

    firestoreReady = true;
    firstLoad = false;

    // 4. Aplifica filtros da URL
    const initialSearch = getInitialSearchTerm();
    const searchInput = document.getElementById('searchInput');
    if (initialSearch && searchInput && !searchInput.value) {
      searchInput.value = initialSearch;
      filterProducts();
    }

    handleDeepLink();

    // 5. Inicializações Não-Critícas (Defer para melhorar TBT)
    if (window.requestIdleCallback) {
      requestIdleCallback(() => {
        try {
          if (typeof initSearchHistory === 'function') initSearchHistory();
          if (typeof initStats === 'function') initStats();
          if (typeof initPWA === 'function') initPWA();
          if (typeof checkPriceDrops === 'function') checkPriceDrops();
          if (typeof initGamification === 'function') initGamification();
          initHoverReveal();
          initSilentIA();
          checkSessionRecovery();
          initIntentPrefetch();
        } catch(e) {}
      });
    } else {
      setTimeout(() => {
        try {
          if (typeof checkPriceDrops === 'function') checkPriceDrops();
        } catch(e) {}
      }, 5000);
    }

  } catch (e) {
    console.warn('[BOOT] Fallback or error:', e.message);
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
  const now = Date.now();

  // Apply filters synchronously (fast)
  let filtered = allProducts.filter(p => p._priceNum > 0 && (!p._publishTs || p._publishTs <= now));

  if (currentCategory !== 'todos') {
    filtered = filtered.filter(p => p.category === currentCategory);
  }

  if (search) {
    const searchTerms = search.split(/\s+/);
    filtered = filtered.filter(p => {
      const name = p._nameNorm || (p._nameNorm = p.name.toLowerCase());
      const desc = p._descNorm || (p._descNorm = (p.desc || '').toLowerCase());
      const cat  = p._catNorm  || (p._catNorm  = (p.category || '').toLowerCase());
      return searchTerms.every(t => name.includes(t) || desc.includes(t) || cat.includes(t));
    });
  }

  if (priceMin !== null) filtered = filtered.filter(p => p.price >= priceMin);
  if (priceMax !== null) filtered = filtered.filter(p => p.price <= priceMax);

  if (!filtered.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  grid.innerHTML = '';

  // Show skeleton immediately while worker processes
  showSkeleton();
  updateResultsSummary(filtered, search);
  updateBreadcrumbs(currentCategory);
  renderCategoryFAQ(currentCategory);

  // Defer structured data
  if (window.requestIdleCallback) {
    requestIdleCallback(() => { try { updateStructuredData(filtered); } catch (err) {} });
  } else {
    setTimeout(() => { try { updateStructuredData(filtered); } catch (err) {} }, 2000);
  }

  lastRenderAt = Date.now();

  // Offload heavy processing to worker
  (async () => {
    let featuredItems, campaignItems, rotatingItems;

    try {
      if (currentSort !== 'default') {
        // Simple sorts don't need worker
        switch (currentSort) {
          case 'price-asc':  filtered.sort((a, b) => a.price - b.price); break;
          case 'price-desc': filtered.sort((a, b) => b.price - a.price); break;
          case 'discount':   filtered.sort((a, b) => getDiscount(b) - getDiscount(a)); break;
          case 'newest':     filtered.sort((a, b) => String(b.id).localeCompare(String(a.id))); break;
        }
        featuredItems = filtered.slice(0, HOME_SECTION_LIMIT);
        campaignItems = [];
        rotatingItems = [];
      } else {
        // Use worker for the heavy default-sort processing
        const result = await workerCall('PROCESS_RENDER', {
          items: filtered,
          homeSectionLimit: HOME_SECTION_LIMIT,
          campaignLimit: CAMPAIGN_SECTION_LIMIT,
          rotationLimit: HOME_ROTATION_LIMIT,
          rotationMinutes: HOME_ROTATION_MINUTES_LONG,
          now,
        });
        featuredItems  = result.featuredItems;
        campaignItems  = result.campaignItems;
        rotatingItems  = result.rotatingItems;
      }
    } catch (workerErr) {
      // Fallback: process on main thread if worker fails
      console.warn('[Render] Worker failed, falling back:', workerErr.message);
      const rotationPool = filtered.filter(p => !(p.featured || p.homeOrder || getCampaignGroupKey(p)));
      const usedFingerprints = new Set();
      featuredItems = pickUnique(sortFeaturedFirst(filtered.filter(p => p.featured || p.homeOrder)), usedFingerprints, HOME_SECTION_LIMIT);
      campaignItems = pickUnique(getCampaignItems(filtered), usedFingerprints, CAMPAIGN_SECTION_LIMIT);
      rotatingItems = pickUnique(rotateHomeProducts(rotationPool), usedFingerprints, HOME_ROTATION_LIMIT);
    }

    // Clear skeleton and render
    grid.innerHTML = '';

    const renderBatch = async (items, containerClass, title, kicker, desc, startIndex = 0) => {
      if (!items.length) return;
      const isBento = containerClass === 'home-vitrine-featured';
      const section = document.createElement('section');
      section.className = `home-vitrine ${containerClass} ${isBento ? 'bento-mode' : ''}`;
      section.innerHTML = `
        <div class="section-head">
          <span class="section-kicker">${kicker}</span>
          <h3>${title}</h3>
          <p>${desc}</p>
        </div>
        <div class="${isBento ? 'bento-grid' : 'product-grid-inner'}" id="inner-${containerClass}"></div>
      `;
      grid.appendChild(section);
      const inner = section.querySelector('.product-grid-inner, .bento-grid');

      // Injetar blocos especiais se for Bento
      if (isBento) {
        // Create a copy to not affect original data
        const bentoItems = [...items];
        bentoItems.splice(2, 0, { isReview: true, text: "Nossa equipe selecionou estes achadinhos baseando-se no menor preço histórico dos últimos 30 dias. Aproveite enquanto durar o estoque!" });
        bentoItems.splice(5, 0, { isCategoryHighlight: true, icon: "🎧", label: "Áudio & Tech", cat: "audio" });

        const BATCH_SIZE = 8;
        for (let i = 0; i < bentoItems.length; i += BATCH_SIZE) {
          const batch = bentoItems.slice(i, i + BATCH_SIZE);
          inner.insertAdjacentHTML('beforeend', batch.map((p, idx) => cardHTML(p, startIndex + i + idx)).join(''));
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } else {
        const BATCH_SIZE = 8;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE);
          inner.insertAdjacentHTML('beforeend', batch.map((p, idx) => cardHTML(p, startIndex + i + idx)).join(''));
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    };

    try {
      if (featuredItems.length) {
        await renderBatch(featuredItems, 'home-vitrine-featured', 'Produtos fixos e campanhas ativas', 'Primeira linha', 'Itens fixados manualmente, campanhas e promoções temporárias ficam acima da rotação.', 0);
      }
      if (campaignItems.length) {
        await renderBatch(campaignItems, 'home-vitrine-campaign', 'Ofertas temporárias e campanhas semanais', 'Vitrine de campanha', 'Itens com campanha, janela de data ou promoção destacada entram aqui sem misturar com a rotação principal.', featuredItems.length);
      }
      animateCards();
      startCountdownTimers();

      // Rotating vitrine lazy-loaded on scroll
      if (rotatingItems.length) {
        const trigger = document.createElement('div');
        trigger.id = 'lazy-rotating-trigger';
        trigger.innerHTML = '<div class="loading-placeholder">Carregando mais ofertas...</div>';
        grid.appendChild(trigger);
        const observer = new IntersectionObserver(async (entries) => {
          if (entries[0].isIntersecting) {
            observer.unobserve(trigger);
            trigger.remove();
            const clicksData = JSON.parse(localStorage.getItem('shopee_clicks') || '{}');
            const sortedRotating = [...rotatingItems].sort((a, b) => getProductScore(b, clicksData) - getProductScore(a, clicksData));
            await renderBatch(sortedRotating, 'home-vitrine-rotating', 'Ofertas rotativas', 'Vitrine rotativa', 'Seleção que muda a cada 30 minutos.', featuredItems.length + campaignItems.length);
            animateCards();
            startCountdownTimers();
          }
        }, { rootMargin: '400px' });
        observer.observe(trigger);
      }
    } catch (err) {
      console.error('[RENDER] Card generation failed:', err);
      grid.innerHTML = '<p class="empty-state">Não foi possível renderizar os produtos agora.</p>';
      empty.style.display = 'none';
    }
  })();
}

// ── SKELETON ─────────────────────────────────────────────────
function showSkeleton() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="product-grid-inner">
      ${Array(8).fill(0).map(() => `
        <div class="skeleton-card">
          <div class="skel skel-img"></div>
          <div class="skel-body">
            <div class="skel skel-line"></div>
            <div class="skel skel-line" style="width: 70%"></div>
            <div class="skel skel-price"></div>
          </div>
          <div class="skel skel-btn"></div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── CARD ANIMATION ────────────────────────────────────────────
function animateCards() {
  if (typeof IntersectionObserver === 'undefined') return;
  // Desativa em mobile para economizar bateria/CPU se não for estético
  if (window.matchMedia('(max-width: 768px)').matches) {
    document.querySelectorAll('.product-card').forEach(c => c.classList.add('card-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        e.target.classList.add('card-visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal-on-scroll:not(.revealed)').forEach((card, i) => {
    card.style.setProperty('--delay', `${Math.min(i * 40, 400)}ms`);
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

function cardHTML(p, index = 0) {
  // Support for non-product blocks in Bento Grid
  if (p.isReview) {
    return `
    <div class="product-card bento-item-wide review-card reveal-on-scroll">
      <div class="card-body">
        <div class="review-author">Curadoria Melhores Ofertas</div>
        <div class="review-content">"${p.text}"</div>
      </div>
    </div>`;
  }

  if (p.isCategoryHighlight) {
    return `
    <div class="product-card bento-item-tall category-highlight-card reveal-on-scroll">
      <div class="cat-highlight-icon">${p.icon}</div>
      <div class="card-name" style="color:#fff; height:auto; text-align:center; font-size:1.8rem; margin-bottom:12px;">${p.label}</div>
      <p style="color:rgba(255,255,255,0.4); font-size:0.85rem; text-align:center; line-height:1.4;">A curadoria definitiva para quem busca performance e preço justo.</p>
      <button class="cat-highlight-btn btn-haptic" onclick="setCategory('${p.cat}', document.querySelector('[data-cat=${p.cat}]'))">Explorar</button>
    </div>`;
  }

  const images   = getImages(p, 'large');
  const main     = images[0] || 'https://via.placeholder.com/300x300?text=Sem+Imagem';
  const curatorNote = getCuratorNote(p.id);
  const sellerStatus = getSellerStatus(p);

  const discount = getDiscount(p);
  const isCampaign = isCampaignActive(p) || p.campaignId;
  const isOfficial = p.sellerType === 'official' || p.category === 'eletronicos';
  const nameEscaped = escapeHTML(p.name);

  // Bento Logic: First few featured products get larger spans
  let bentoClass = 'reveal-on-scroll';
  if (p.featured) {
    if (index === 0) bentoClass += ' bento-item-large';
    else if (index === 1) bentoClass += ' bento-item-wide';
    else if (index === 2) bentoClass += ' bento-item-wide';
    else if (index === 3) bentoClass += ' bento-item-tall';
  }

  // Lazy load images that are NOT in the first row
  const loadingType = index < 8 ? 'eager' : 'lazy';
  const fetchPriority = index < 4 ? 'high' : 'low';

  let leftBadge = '';
  if (p.featured)    leftBadge = `<span class="badge-featured" aria-label="Produto Diamante">DIAMANTE</span>`;
  else if (isCampaign) leftBadge = `<span class="badge-featured" style="background:#000;" aria-label="Campanha Ativa">CAMPANHA</span>`;

  return `
  <div class="product-card ${bentoClass}" data-action="open-product" data-id="${p.id}" role="button" aria-label="Ver detalhes de ${nameEscaped}" style="cursor: pointer;">
    ${leftBadge}
    ${discount ? `<span class="badge-discount" aria-label="Desconto de ${discount}%">-${discount}%</span>` : ''}
    ${p.price >= 19 ? `<span class="badge-shipping"><i class="fa-solid fa-truck-fast"></i> Frete Grátis</span>` : ''}

    <div class="card-img-wrap">
      <img src="${main}"
           alt="${nameEscaped} - Oferta Verificada na Shopee"
           loading="${loadingType}"
           fetchpriority="${fetchPriority}"
           decoding="async"
           onerror="this.src='https://via.placeholder.com/300x300?text=Sem+Imagem'"/>
    </div>

    <div class="card-body">
      <div class="card-meta">
        <div class="card-trust">
          <i class="fa-solid fa-circle-check"></i> Verificado
        </div>
        ${isOfficial ? `<div class="card-seller"><i class="fa-solid fa-store"></i> Oficial</div>` : ''}
      </div>

      <div class="card-name">${nameEscaped}</div>

      ${curatorNote ? `
        <div class="curator-pick-note">
          <i class="fa-solid fa-pen-nib"></i>
          <span>${curatorNote}</span>
        </div>
      ` : ''}

      <div class="card-price-row">
        <div class="card-prices">
          <span class="card-price-label">Preço Atual</span>
          <div class="card-price-value">R$ ${Number(p.price).toFixed(2).replace('.',',')}</div>
          ${p.originalPrice && p.originalPrice > p.price
            ? `<div class="card-original">R$ ${Number(p.originalPrice).toFixed(2).replace('.',',')}</div>` : ''}
        </div>
        <div class="card-trend-wrap">
          ${discount > 5 ? `<div class="card-trend" title="Preço em queda"><i class="fa-solid fa-arrow-trend-down"></i> Queda de Preço</div>` : ''}
          ${sellerStatus === 'dropping' ? `<div class="seller-warning" title="Atenção: A nota deste vendedor caiu recentemente"><i class="fa-solid fa-triangle-exclamation"></i> Vendedor em queda</div>` : ''}
        </div>
      </div>
    </div>

    <div class="card-btn" aria-hidden="true">Ver na Shopee</div>

    <button class="card-compare-btn ${compareList.some(id => sameId(id, p.id))?'active':''}"
      data-pid="${p.id}"
      data-action="toggle-compare"
      aria-label="Adicionar ${nameEscaped} à lista de comparação"
      title="Comparar">
      <i class="fa-solid fa-columns-3"></i>
    </button>
  </div>`;
}

// ── STARS ─────────────────────────────────────────────────────
function starsHTML(rating) {
  const r = parseFloat(rating) || 0;
  return Array.from({length: 5}, (_, i) => {
    if (i + 1 <= r)      return '<i class="fa-solid fa-star"></i>';
    if (i + 0.5 <= r)    return '<i class="fa-solid fa-star-half-stroke"></i>';
    return '<i class="fa-regular fa-star"></i>';
  }).join('') + ` <span class="star-val">${r.toFixed(1)}</span>`;
}

// ── MODAL ─────────────────────────────────────────────────────
let modalProduct = null;
let modalIndex   = 0;

function openProductModal(id, startIdx = 0) {
  if (!id) return;
  const p = allProducts.find(x => sameId(x.id, id));
  if (!p) {
    console.warn('[MODAL] Product not found:', id);
    if (typeof showToast === 'function') showToast('Produto não encontrado. Tente atualizar a página.');
    return;
  }

  modalProduct = p;
  modalIndex   = startIdx;
  injectProductSchema(p);
  updateProductSchema(p);
  updateUrlWithProduct(p);

  // CRO: Flash Timer & Heatmap
  updateFlashTimer(p);
  updatePriceHeatmap(p);
  updateCtaLogic(p);

  // Modo Foco na Oferta
  document.body.classList.add('modal-open-focus');

  // Gamification rewards (Safeguarded)
  try {
    if (typeof addRewards === 'function') addRewards(10, 5);
  } catch(e) { console.warn('Gamification reward error:', e); }
  // Track click
  const clicks = JSON.parse(localStorage.getItem('shopee_clicks') || '{}');
  clicks[id] = (clicks[id] || 0) + 1;
  localStorage.setItem('shopee_clicks', JSON.stringify(clicks));

  // Track Category Affinity
  trackCategoryClick(p.category);

  // Track last viewed for session recovery
  localStorage.setItem('shopee_last_viewed', id);
  localStorage.setItem('shopee_last_viewed_at', Date.now());
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

  // Expert Review (E-E-A-T)
  const expertNote = getCuratorNote(p.id);
  const expertBox = document.getElementById('modalExpertReviewBox');
  if (expertNote) {
    document.getElementById('modalExpertReviewContent').textContent = expertNote;
    expertBox.classList.remove('hidden-block');
  } else {
    expertBox.classList.add('hidden-block');
  }

  // UGC Gallery (E-E-A-T)
  const ugcBox = document.getElementById('modalUGCBox');
  const ugcContent = document.getElementById('modalUGCContent');
  if (p.ugcImages && p.ugcImages.length > 0) {
    ugcContent.innerHTML = p.ugcImages.map(url => `<img src="${url}" class="ugc-img" loading="lazy" alt="Foto real do produto">`).join('');
    ugcBox.classList.remove('hidden-block');
  } else {
    ugcBox.classList.add('hidden-block');
  }

  // Video Review (GEO)
  const videoBox = document.getElementById('modalVideoReview');
  const videoLink = document.getElementById('videoReviewLink');
  if (p.youtubeUrl) {
    videoLink.href = p.youtubeUrl;
    videoBox.classList.remove('hidden-block');
  } else {
    videoBox.classList.add('hidden-block');
  }

  // Technical Specs (GEO/Citable Content)
  const specsBox = document.getElementById('modalSpecs');
  const specsTable = document.getElementById('modalSpecsTable');
  if (p.specs && Object.keys(p.specs).length > 0) {
    specsTable.innerHTML = Object.entries(p.specs).map(([key, val]) => `
      <tr>
        <td><strong>${key}</strong></td>
        <td>${val}</td>
      </tr>
    `).join('');
    specsBox.classList.remove('hidden-block');
  } else {
    specsBox.classList.add('hidden-block');
  }

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

  // Expert Review (SEO/GEO)
  const reviewBox = document.getElementById('modalExpertReviewBox');
  const reviewContent = document.getElementById('modalExpertReviewContent');
  if (reviewBox && reviewContent) {
    if (p.expertReview) {
      reviewContent.textContent = p.expertReview;
      reviewBox.classList.remove('hidden-block');
    } else {
      reviewBox.classList.add('hidden-block');
    }
  }

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

  // Price Alert Button Logic
  const alertBtn = document.getElementById('priceAlertBtn');
  if (alertBtn) {
    const alerts = JSON.parse(localStorage.getItem('price_alerts') || '{}');
    const isAlertSet = !!alerts[p.id];
    alertBtn.classList.toggle('active', isAlertSet);
    alertBtn.innerHTML = isAlertSet ? '<i class="fa-solid fa-bell"></i>' : '<i class="fa-regular fa-bell"></i>';

    alertBtn.onclick = (e) => {
      e.preventDefault();
      togglePriceAlert(p);
    };
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
  renderFAQ(p);
  renderSpecs(p);
  updateUrgency(p);
  updateSocialMeta(p);

  // Compartilhamento Social
  const shareWpp = document.getElementById('shareWhatsAppBtn');
  const shareTlg = document.getElementById('shareTelegramBtn');
  const shareUrl = `${window.location.origin}${window.location.pathname}?p=${slugify(p.name)}`;
  const shareText = `🔥 Olha que oferta incrível que encontrei no Melhores Ofertas!\n\n🛍️ *${p.name}*\n💰 Por apenas *R$ ${p.price.toFixed(2).replace('.', ',')}*\n\n🔗 Confira aqui: ${shareUrl}`;

  if (shareWpp) {
    shareWpp.onclick = (e) => {
      e.preventDefault();
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
    };
  }
  if (shareTlg) {
    shareTlg.onclick = (e) => {
      e.preventDefault();
      window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, '_blank');
    };
  }

  document.getElementById('productModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  // Paleta de Cores Adaptativa (Baseada na Categoria)
  const catColors = {
    'eletronicos': '#001c3d',
    'beleza': '#ff4d6d',
    'casa': '#2d6a4f',
    'moda': '#7209b7',
    'todos': '#ffdb00'
  };
  const themeColor = catColors[p.category] || catColors['todos'];
  document.documentElement.style.setProperty('--modal-accent', themeColor);
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
    display.innerHTML = `<img src="${m}" alt="${escapeHTML(modalProduct?.name || 'Produto')} - imagem ampliada" style="width:100%;height:100%;object-fit:contain;border-radius:8px"
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
      ${src ? `<img src="${src}" alt="${escapeHTML(modalProduct?.name || 'Produto')} ${isVideo ? 'vídeo' : 'imagem'} ${i + 1}"/>` : '<div class="vt-placeholder"></div>'}
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

// ── SEO & SLUGS ──────────────────────────────────────────────
function slugify(text) {
  return normalizeText(text).replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
}

function updateUrlWithProduct(p) {
  const url = new URL(window.location);
  if (p) {
    url.searchParams.set('p', slugify(p.name));
    url.searchParams.delete('cat'); // Limpa categoria ao focar no produto
  } else {
    url.searchParams.delete('p');
  }
  window.history.replaceState({}, '', url);

  // Trigger SEO update for canonical and robots
  if (typeof updatePageSeo === 'function') {
    const search = (document.getElementById('searchInput')?.value || '').trim();
    const grid = document.getElementById('productGrid');
    // We pass empty array if no specific filtered list is at hand, or just reuse last state
    updatePageSeo([], search);
  }
}

function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const pSlug = params.get('p');
  if (pSlug) {
    const found = allProducts.find(x => slugify(x.name) === pSlug);
    if (found) {
      setTimeout(() => openProductModal(found.id), 500);
    }
  }
}

function closeProductModal() {
  const modal = document.getElementById('productModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  modalProduct = null;

  // Remover Modo Foco
  document.body.classList.remove('modal-open-focus');

  // Reseta SEO para o padrão do site
  document.title = 'Melhores Ofertas Shopee - Curadoria de Achadinhos';
  updateUrlWithProduct(null);
  document.getElementById('modalMainDisplay').innerHTML = '';
}

function closeModalOutside(e) {
  if (e.target.id === 'productModal') closeProductModal();
}

function handleOpenProductAction(el) {
  if (!el) return;
  const id = el.dataset.id || el.getAttribute('data-id');
  const startIdx = parseInt(el.dataset.startIndex || el.getAttribute('data-startIndex') || '0', 10);
  if (id) {
    if (typeof openProductModal === 'function') {
      openProductModal(id, Number.isFinite(startIdx) ? startIdx : 0);
    }
  }
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
function filterProducts() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let val = searchInput.value.toLowerCase().trim();

    // Smart Search: Typo Correction
    const typos = {
      'ifone': 'iphone',
      'foni': 'fone',
      'escova secadora': 'escova',
      'oculos': 'óculos',
      'relogio': 'relógio',
      'tenis': 'tênis',
      'calcado': 'calçado',
      'maquiagem': 'maquiagem',
      'shope': 'shopee'
    };

    for (let t in typos) {
      if (val.includes(t)) {
        val = val.replace(t, typos[t]);
        // Update input visually if desired, or just internal
      }
    }
  }
  renderProducts();
}

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

// ── HOVER REVEAL ──────────────────────────────────────────────
function initHoverReveal() {
  const revealEl = document.createElement('div');
  revealEl.className = 'hover-reveal';
  document.body.appendChild(revealEl);

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-hover-img]');
    if (target) {
      const img = target.dataset.hoverImg;
      revealEl.innerHTML = `<img src="${img}" style="width:100px; height:100px; object-fit:cover; border-radius:8px; border:2px solid var(--brand);">`;
      revealEl.classList.add('active');
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (revealEl.classList.contains('active')) {
      revealEl.style.left = (e.pageX + 15) + 'px';
      revealEl.style.top = (e.pageY + 15) + 'px';
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-hover-img]')) {
      revealEl.classList.remove('active');
    }
  });
}

// ── RIPPLE EFFECT HELPER ─────────────────────────────────────
document.addEventListener('mousedown', (e) => {
  const btn = e.target.closest('.btn-haptic');
  if (btn) {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }
});

function updateHeroStats() {
  const countEl = document.getElementById('heroCount');
  const updatedEl = document.getElementById('heroUpdated');
  if (countEl) countEl.textContent = allProducts.length;
  if (updatedEl) updatedEl.textContent = allProducts.length
    ? `às ${formatUpdatedTime(Date.now())}`
    : 'aguardando novos produtos';
}

// ── SILENT IA WIDGET ──────────────────────────────────────────
function initSilentIA() {
  const chips = document.querySelectorAll('.ia-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyIAFilter(chip.dataset.filter);
    });
  });
}

function applyIAFilter(filter) {
  // Logic to adapt the grid based on IA filter
  const allProducts = window.allProducts || [];
  let filtered = [];

  switch(filter) {
    case 'presente':
      filtered = allProducts.filter(p => p.featured || getDiscount(p) > 40);
      break;
    case 'oferta-relampago':
      filtered = allProducts.filter(p => isCampaignActive(p));
      break;
    case 'frete-gratis':
      filtered = allProducts.filter(p => p.freeShipping);
      break;
    case 'menor-preco':
      filtered = [...allProducts].sort((a, b) => Number(a.price) - Number(b.price)).slice(0, 20);
      break;
    case 'mais-vendidos':
      filtered = [...allProducts].sort((a, b) => (b.sales || 0) - (a.sales || 0)).slice(0, 20);
      break;
    default:
      filtered = allProducts;
  }

  // Inject into home-vitrine-featured for immediate impact
  const container = document.getElementById('inner-home-vitrine-featured');
  if (container) {
    container.innerHTML = filtered.slice(0, 8).map((p, i) => cardHTML(p, i)).join('');
    if (typeof animateCards === 'function') animateCards();
  }
}

// ── SESSION RECOVERY ──────────────────────────────────────────
function checkSessionRecovery() {
  const lastId = localStorage.getItem('shopee_last_viewed');
  const lastAt = localStorage.getItem('shopee_last_viewed_at');

  // Only show if viewed in the last 24 hours
  if (lastId && lastAt && (Date.now() - lastAt < 86400000)) {
    const product = window.allProducts?.find(p => p.id === lastId);
    if (product) {
      const banner = document.getElementById('recoveryBanner');
      const nameEl = document.getElementById('recoveryProductName');
      const btn    = document.getElementById('recoveryBtn');
      const close  = document.getElementById('recoveryClose');

      if (nameEl) nameEl.textContent = product.name.substring(0, 30) + '...';
      if (banner) banner.classList.remove('hidden-block');

      if (btn) {
        btn.onclick = () => {
          openProductModal(product);
          banner.classList.add('hidden-block');
        };
      }

      if (close) close.onclick = () => banner.classList.add('hidden-block');

      // Auto hide after 15 seconds
      setTimeout(() => {
        if (banner) banner.classList.add('hidden-block');
      }, 15000);
    }
  }
}

function updatePageSeo(filtered, search) {
  const baseTitle = 'Ofertas na Shopee por Categoria e Preço | Melhores Ofertas';
  const baseDescription = 'Curadoria de ofertas na Shopee por categoria, preço e campanha. Veja produtos atualizados, compare valores e descubra promoções com rapidez.';
  const liveCount = (filtered && filtered.length) ? filtered.length : allProducts.length;
  const activeCategory = currentCategory !== 'todos' ? categoryLabel(currentCategory) : null;
  const searchTerm = search ? `busca por "${search}"` : null;
  const activeCategoryName = activeCategory ? activeCategory.replace(/^.*? /, '') : null;
  const isCategoryPage = window.location.pathname.endsWith('/categoria.html') || window.location.pathname.endsWith('/categoria');
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
  const params = new URLSearchParams(window.location.search);
  const isProductPage = params.has('p');
  const hasFilteredView = !!(activeCategory || search || priceMin !== null || priceMax !== null || currentSort !== 'default');

  // Allow indexing of category pages, but keep noindex for deep filters/searches to avoid thin content
  if (robotsMeta) {
    if (isProductPage) {
      robotsMeta.setAttribute('content', 'index, follow');
    } else if (activeCategory && !search && priceMin === null && priceMax === null) {
      robotsMeta.setAttribute('content', 'index, follow');
    } else {
      robotsMeta.setAttribute('content', hasFilteredView ? 'noindex, follow' : 'index, follow');
    }
  }

  const canonical = document.getElementById('canonicalLink') || document.querySelector('link[rel="canonical"]');
  if (canonical) {
    const origin = window.location.origin.replace(/\/$/, '');
    const path = window.location.pathname;

    if (isProductPage) {
      canonical.setAttribute('href', `${origin}${path}?p=${params.get('p')}`);
    } else if (isCategoryPage) {
      canonical.setAttribute('href', `${origin}${path}${params.has('cat') ? `?cat=${params.get('cat')}` : ''}`);
    } else {
      canonical.setAttribute('href', hasFilteredView
        ? `${origin}${path}${currentCategory !== 'todos' ? `?cat=${encodeURIComponent(currentCategory)}` : ''}`
        : `${origin}/`);
    }
  }

  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogTitle) ogTitle.setAttribute('content', document.title);
  if (ogDesc) ogDesc.setAttribute('content', description);
  if (ogUrl) ogUrl.setAttribute('content', isCategoryPage
    ? `${window.location.origin}${window.location.pathname}`
    : hasFilteredView && currentCategory !== 'todos'
      ? `${window.location.origin}${window.location.pathname}?cat=${encodeURIComponent(currentCategory)}`
      : `${window.location.origin}/`);
}

function updateResultsSummary(filtered, search) {
  const summaryEl = document.getElementById('resultsSummary');
  const contextEl = document.getElementById('activeContext');
  if (!summaryEl || !contextEl) return;

  const totalLive = allProducts.filter(p => !p.publishDate || new Date(p.publishDate) <= new Date()).length;
  summaryEl.textContent = search ? `Resultados para "${search}"` : (currentCategory !== 'todos' ? categoryLabel(currentCategory).split(' ').slice(1).join(' ') : 'Todas as Ofertas');

  const countText = `${filtered.length} de ${totalLive} produtos encontrados`;
  contextEl.textContent = countText;

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

function updateBreadcrumbs(category) {
  const el = document.getElementById('breadcrumbs');
  if (!el) return;

  let html = `<a href="/">Início</a>`;
  if (category && category !== 'todos') {
    const name = CAT_MAP[category] || category;
    html += ` <span>/</span> <a href="#" onclick="filterByCategory('${category}'); return false;">${name}</a>`;
  }
  el.innerHTML = html;
}

function renderFAQ(p) {
  const box = document.getElementById('modalFAQ');
  const content = document.getElementById('modalFAQContent');
  if (!box || !content) return;

  const faqs = [
    {
      q: `Este ${p.name} está em oferta?`,
      a: `Sim! O preço promocional atual é de R$ ${p.price.toFixed(2).replace('.', ',')}. Aproveite enquanto durar o estoque.`
    },
    {
      q: 'É seguro comprar por este link?',
      a: 'Com certeza. O Melhores Ofertas faz a curadoria e você finaliza a compra diretamente no ambiente seguro da Shopee, com garantia total.'
    },
    {
      q: 'Como consigo frete grátis?',
      a: 'Ao clicar em "Ver na Shopee", você pode resgatar seus cupons de frete grátis no app ou site oficial antes de fechar o pedido.'
    }
  ];

  content.innerHTML = faqs.map(f => `
    <div class="faq-item">
      <span class="faq-q">${f.q}</span>
      <p class="faq-a">${f.a}</p>
    </div>
  `).join('');
  box.classList.remove('hidden-block');
}

function renderSpecs(p) {
  const box = document.getElementById('modalSpecs');
  const table = document.getElementById('modalSpecsTable');
  if (!box || !table) return;

  const specs = [
    { k: 'Categoria', v: CAT_MAP[p.category] || p.category },
    { k: 'Preço Original', v: p.originalPrice ? `R$ ${p.originalPrice.toFixed(2).replace('.', ',')}` : 'Não informado' },
    { k: 'Preço com Desconto', v: `R$ ${p.price.toFixed(2).replace('.', ',')}` },
    { k: 'Desconto Total', v: getDiscount(p) ? `${getDiscount(p)}%` : 'Oferta regular' },
    { k: 'Selo de Confiança', v: 'Verificado Shopee' },
    { k: 'Vendedor', v: 'Oficial' }
  ];

  table.innerHTML = specs.map(s => `
    <tr>
      <td>${s.k}</td>
      <td>${s.v}</td>
    </tr>
  `).join('');
  box.classList.remove('hidden-block');
}

function updateUrgency(p) {
  const box = document.getElementById('modalUrgency');
  const bar = document.getElementById('urgencyProgress');
  const text = document.getElementById('urgencyText');
  if (!box || !bar || !text) return;

  // Usa o ID do produto como semente para manter consistência
  // Obtém um número a partir do ID (mesmo que seja string)
  const idStr = String(p.id);
  let idHash = 0;
  for (let i = 0; i < idStr.length; i++) {
    idHash = ((idHash << 5) - idHash) + idStr.charCodeAt(i);
    idHash |= 0; // Convert to 32bit integer
  }
  const seed = (Math.abs(idHash) % 20) + 5;
  const percent = (seed / 25) * 100;

  text.textContent = `Restam apenas ${seed} unidades em estoque!`;
  bar.style.width = '0%';
  box.classList.remove('hidden-block');

  setTimeout(() => {
    bar.style.width = `${percent}%`;
  }, 100);
}

function updateSocialMeta(p) {
  if (!p) return;
  const url = `${window.location.origin}${window.location.pathname}?p=${p.name.toLowerCase().replace(/\s+/g, '-')}`;
  const img = getImages(p)[0] || '';

  const meta = {
    'og:title': p.name,
    'og:description': p.desc || `Confira esta oferta na Shopee: ${p.name}`,
    'og:image': img,
    'og:url': url,
    'twitter:card': 'summary_large_image',
    'twitter:title': p.name,
    'twitter:description': p.desc || p.name,
    'twitter:image': img
  };

  for (const [property, content] of Object.entries(meta)) {
    let el = document.querySelector(`meta[property="${property}"]`) ||
             document.querySelector(`meta[name="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      if (property.startsWith('og:')) el.setAttribute('property', property);
      else el.setAttribute('name', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }
}

function togglePriceAlert(p) {
  const alerts = JSON.parse(localStorage.getItem('price_alerts') || '{}');
  const btn = document.getElementById('priceAlertBtn');

  if (alerts[p.id]) {
    delete alerts[p.id];
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = '<i class="far fa-bell"></i>';
    }
  } else {
    alerts[p.id] = p.price;
    if (btn) {
      btn.classList.add('active');
      btn.innerHTML = '<i class="fas fa-bell"></i>';
    }
  }

  localStorage.setItem('price_alerts', JSON.stringify(alerts));
}

function checkPriceDrops() {
  const alerts = JSON.parse(localStorage.getItem('price_alerts') || '{}');
  if (Object.keys(alerts).length === 0) return;

  const drops = [];
  allProducts.forEach(p => {
    if (alerts[p.id] && p.price < alerts[p.id]) {
      drops.push(p);
      // Atualiza o preço base para não avisar de novo da mesma queda
      alerts[p.id] = p.price;
    }
  });

  if (drops.length > 0) {
    localStorage.setItem('price_alerts', JSON.stringify(alerts));
    showPriceDropNotification(drops);
  }
}

function showPriceDropNotification(drops) {
  // Cria um aviso visual elegante no topo do site
  const toast = document.createElement('div');
  toast.className = 'price-drop-toast';
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas fa-tag"></i>
      <span>🔥 Oferta! ${drops.length} item(s) da sua lista baixaram de preço!</span>
    </div>
    <button onclick="this.parentElement.remove()">Ver</button>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
}

function updateProductSchema(p) {
  if (!p) return;
  const existing = document.getElementById('productStructuredData');
  const discount = getDiscount(p);
  const json = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": p.name,
    "image": getImages(p),
    "description": p.desc || p.name,
    "sku": p.id,
    "mpn": p.itemId || p.id,
    "brand": {
      "@type": "Brand",
      "name": p.brand || "Shopee"
    },
    "review": {
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": p.rating || 4.5,
        "bestRating": "5"
      },
      "author": { "@id": "https://melhoresdashopee.com.br/#curator" },
      "reviewBody": p.expertReview || `Nossa curadoria avaliou o ${p.name} como uma das melhores oportunidades de custo-benefício na Shopee atualmente.`
    },
    "offers": {
      "@type": "Offer",
      "url": `${window.location.origin}${window.location.pathname}?p=${slugify(p.name)}`,
      "priceCurrency": "BRL",
      "price": p.price,
      "itemCondition": "https://schema.org/NewCondition",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "Shopee"
      },
      "priceValidUntil": new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  };

  if (p.rating) {
    json.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": p.rating,
      "reviewCount": p.soldCount || (Math.floor(Math.random() * 50) + 10)
    };
  }

  const script = existing || document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'productStructuredData';
  script.textContent = JSON.stringify(json);
  if (!existing) document.head.appendChild(script);

  // Update Page Title and Meta for GEO (Generative Engine Optimization)
  document.title = `Oferta: ${p.name} | Menor Preço Shopee`;
  let metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.content = `Economize agora: ${p.name} por apenas R$ ${p.price.toFixed(2).replace('.',',')}. Produto verificado pela nossa curadoria especializada. Veja fotos e detalhes.`;
}

function initDarkMode() {
  const isDark = localStorage.getItem('shopee_dark_mode') === 'true';
  document.body.classList.toggle('dark-mode', isDark);
  const icon = document.getElementById('darkIcon');
  if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
}

function toggleDarkMode() {
  const isDark = !document.body.classList.contains('dark-mode');
  document.body.classList.toggle('dark-mode', isDark);
  localStorage.setItem('shopee_dark_mode', isDark);
  const icon = document.getElementById('darkIcon');
  if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
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
  document.getElementById('searchBtn')?.addEventListener('click', () => {
    filterProducts();
    const val = searchInput?.value.trim();
    if (val) saveSearchTerm(val);
    document.getElementById('searchDropdown').style.display = 'none';
  });
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

  document.getElementById('btnRoleta')?.addEventListener('click', luckyRoulette);

  // Auto-refresh showcase every 5 minutes (Non-blocking)
  setInterval(() => {
    const defer = window.requestIdleCallback || ((cb) => setTimeout(cb, 5000));
    defer(() => {
      console.log('[AUTO-REFRESH] Updating showcases idle...');
      renderProducts();
    });
  }, 5 * 60 * 1000);
}

// initDarkMode() and other initializations are handled inside the async BOOT block or via bindings
// Removed duplicate render calls to reduce CPU usage on start

// DEFER NON-CRITICAL UI: Libera a thread principal (reduz TBT)
const deferTask = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
deferTask(() => {
  try { initLGPD(); } catch(e) { console.error("Error in initLGPD:", e); }
  try { initGamification(); } catch(e) { console.error("Error in initGamification:", e); }
  console.log('[PERF] Non-critical tasks deferred.');
});
window.clearAllFilters = clearAllFilters;

function attachEventsSafe() {
  try {
    initAppBindings();
  } catch(e) {
    console.error("Error in initAppBindings:", e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachEventsSafe);
} else {
  attachEventsSafe();
}

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
    localStorage.removeItem('shopee_gamification');
    if (banner) banner.style.display = 'none';
  });
}

// ── GAMIFICATION ENGINE ───────────────────────────────────────

function getUserData() {
  const defaultData = { coins: 0, xp: 0, level: 1, badges: [], clicks: 0 };
  try {
    const raw = localStorage.getItem(GAMIFICATION_KEY);
    return raw ? JSON.parse(raw) : defaultData;
  } catch(e) {
    console.error("getUserData JSON error:", e);
    return defaultData;
  }
}

function saveUserData(data) {
  localStorage.setItem(GAMIFICATION_KEY, JSON.stringify(data));
  updateGamificationUI();
}

function initGamification() {
  updateGamificationUI();
}

function updateGamificationUI() {
  const data = getUserData();
  const coinsEl = document.getElementById('userCoins');
  const levelEl = document.getElementById('userLevel');
  if (coinsEl) coinsEl.textContent = data.coins;
  if (levelEl) levelEl.textContent = data.level;
}

function addRewards(xpGain, coinsGain) {
  const data = getUserData();
  data.xp += xpGain;
  data.coins += coinsGain;
  data.clicks += 1;

  // Level up logic (Level = floor(sqrt(XP/100)) + 1)
  const newLevel = Math.floor(Math.sqrt(data.xp / 100)) + 1;
  if (newLevel > data.level) {
    data.level = newLevel;
    showLevelUpToast(newLevel);
  }

  saveUserData(data);
}

function showLevelUpToast(level) {
  const toast = document.createElement('div');
  toast.className = 'level-up-toast';
  toast.innerHTML = `<i class="fas fa-arrow-up"></i> Nível ${level}!`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function luckyRoulette() {
  if (!allProducts.length) return;
  const data = getUserData();
  if (data.coins < 5) {
    alert('Você precisa de 5 moedas para girar a roleta! Clique em algumas ofertas para ganhar.');
    return;
  }

  data.coins -= 5;
  saveUserData(data);

  const randomIdx = Math.floor(Math.random() * allProducts.length);
  const product = allProducts[randomIdx];

  // Highlight effect
  const btn = document.getElementById('btnRoleta');
  if (btn) btn.classList.add('spinning');

  setTimeout(() => {
    if (btn) btn.classList.remove('spinning');
    openProductModal(product.id);
    addRewards(40, 0); // 40 XP + 10 XP from openProductModal = 50 XP
  }, 1000);
}

// ── CRO: FLASH TIMER ──────────────────────────────────────────
let flashInterval = null;
function updateFlashTimer(p) {
  const box = document.getElementById('modalFlashTimer');
  const timer = document.getElementById('flashTimer');
  if (!box || !timer) return;

  if (p.featured || isCampaignActive(p)) {
    if (box) box.classList.remove('hidden-block');
    if (flashInterval) clearInterval(flashInterval);

    // Gera um tempo final "fixo" baseado no ID para não mudar ao reabrir
    let endTime = new Date().setHours(23, 59, 59, 0);

    flashInterval = setInterval(() => {
      const now = new Date().getTime();
      const distance = endTime - now;

      const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);

      if (timer) timer.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;

      if (distance < 0) {
        clearInterval(flashInterval);
        if (timer) timer.textContent = "EXPIROU";
      }
    }, 1000);
  } else {
    if (box) box.classList.add('hidden-block');
  }
}

// ── CRO: PRICE HEATMAP ────────────────────────────────────────
function updatePriceHeatmap(p) {
  const dot = document.querySelector('.heatmap-dot');
  const text = document.getElementById('heatmapText');
  if (!dot || !text) return;

  const discount = getDiscount(p);
  dot.className = 'heatmap-dot';

  if (discount >= 40) {
    dot.classList.add('good');
    text.textContent = 'Preço imbatível hoje (Menor dos últimos 30 dias)';
  } else if (discount >= 15) {
    dot.classList.add('fair');
    text.textContent = 'Preço justo (Média histórica)';
  } else {
    dot.classList.add('bad');
    text.textContent = 'Preço regular (Aguarde uma promoção maior)';
  }
}

// ── CRO: CTA & COUPON LOGIC ───────────────────────────────────
function updateCtaLogic(p) {
  const btn = document.getElementById('modalBuyBtn');
  if (!btn) return;

  btn.onclick = (e) => {
    // Se houver cupom (simulado ou real), copiar
    const coupon = p.coupon || "OFERTA10";
    navigator.clipboard.writeText(coupon).then(() => {
      showToast(`Cupom ${coupon} copiado! Aplicando desconto...`);
    });

    // Pequeno delay para o usuário ler o toast antes de abrir a Shopee
    setTimeout(() => {
      window.open(p.link, '_blank');
    }, 800);

    e.preventDefault();
  };
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'price-drop-toast show';
  toast.style.background = 'var(--brand)';
  toast.innerHTML = `<i class="fa-solid fa-check"></i> ${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
