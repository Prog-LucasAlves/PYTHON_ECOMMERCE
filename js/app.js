// ── HERO BANNER CAROUSEL ─────────────────────────────────────
let heroCurrent  = 0;
let heroTimer    = null;
const HERO_INTERVAL = 5000;

function initHeroBanner() {
  const slidesEl = document.getElementById('heroSlides');
  const dotsEl   = document.getElementById('heroDots');
  if (!slidesEl) return;

  const featured = allProducts.filter(p => p.featured).slice(0, 6);
  const slides   = featured.length >= 2 ? featured : allProducts.slice(0, Math.min(5, allProducts.length));

  if (!slides.length) {
    document.getElementById('heroBanner').innerHTML = `
      <div class="hero-static">
        <div class="hero-content">
          <h1>🔥 Ofertas Imperdíveis</h1>
          <p>Os melhores preços da Shopee, direto pra você!</p>
        </div>
      </div>`;
    return;
  }

  slidesEl.innerHTML = slides.map((p, i) => {
    const img      = getImages(p)[0] || '';
    const discount = getDiscount(p);
    return `<div class="hero-slide ${i === 0 ? 'active' : ''}" onclick="openProductModal(${p.id},0)">
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
    `<button class="hero-dot ${i===0?'active':''}" onclick="goHeroSlide(${i})"></button>`
  ).join('');

  if (heroTimer) clearInterval(heroTimer);
  heroTimer = setInterval(heroNext, HERO_INTERVAL);
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
  const related = allProducts.filter(x => x.category === p.category && x.id !== p.id).slice(0, 6);
  if (!related.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  listEl.innerHTML = related.map(r => {
    const img = getImages(r)[0] || '';
    return `<div class="related-item" onclick="openProductModal(${r.id},0)">
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
  const idx = compareList.indexOf(id);
  if (idx === -1) {
    if (compareList.length >= 3) { showCompareToast(); return; }
    compareList.push(id);
  } else {
    compareList.splice(idx, 1);
  }
  renderCompareBar();
  document.querySelectorAll('.card-compare-btn').forEach(btn => {
    btn.classList.toggle('active', compareList.includes(parseInt(btn.dataset.pid)));
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
  if (!compareList.length) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  btn.disabled      = compareList.length < 2;
  slots.innerHTML   = compareList.map(id => {
    const p   = allProducts.find(x => x.id === id);
    if (!p) return '';
    const img = getImages(p)[0] || '';
    return `<div class="compare-slot">
      ${img ? `<img src="${img}" alt=""/>` : '<div class="compare-slot-placeholder"></div>'}
      <span>${p.name.substring(0,22)}${p.name.length>22?'…':''}</span>
      <button onclick="toggleCompare(${p.id},event)" title="Remover"><i class="fas fa-times"></i></button>
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
  const prods = compareList.map(id => allProducts.find(x => x.id === id)).filter(Boolean);

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

// ── FAVORITES ────────────────────────────────────────────────
let favorites = JSON.parse(localStorage.getItem('shopee_favs') || '[]');

function saveFavorites() { localStorage.setItem('shopee_favs', JSON.stringify(favorites)); }

function toggleFavorite() {
  if (!modalProduct) return;
  const id  = modalProduct.id;
  const idx = favorites.indexOf(id);
  if (idx === -1) { favorites.push(id); }
  else            { favorites.splice(idx, 1); }
  saveFavorites();
  updateFavBtn();
  updateFavFab();
}

function isFav(id) { return favorites.includes(id); }

function updateFavBtn() {
  const btn  = document.getElementById('modalFavBtn');
  const text = document.getElementById('modalFavText');
  if (!btn || !modalProduct) return;
  const faved = isFav(modalProduct.id);
  btn.classList.toggle('active', faved);
  text.textContent = faved ? 'Favoritado' : 'Favoritar';
}

function updateFavFab() {
  const fab   = document.getElementById('favFab');
  const count = document.getElementById('favCount');
  if (!fab) return;
  fab.style.display  = favorites.length > 0 ? 'flex' : 'none';
  count.textContent  = favorites.length;
}

function openFavPanel() {
  const panel   = document.getElementById('favPanel');
  const listEl  = document.getElementById('favList');
  const favProds = allProducts.filter(p => favorites.includes(p.id));
  if (!favProds.length) {
    listEl.innerHTML = '<p class="fav-empty">Nenhum favorito ainda.</p>';
  } else {
    listEl.innerHTML = favProds.map(p => {
      const img = getImages(p)[0] || '';
      return `<div class="fav-item" onclick="closeFavPanel();openProductModal(${p.id},0)">
        <img src="${img}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/60x60?text=?'"/>
        <div class="fav-item-info">
          <div class="fav-name">${p.name}</div>
          <div class="fav-price">R$ ${Number(p.price).toFixed(2).replace('.',',')}</div>
        </div>
        <button class="fav-remove" onclick="event.stopPropagation();removeFav(${p.id})">
          <i class="fas fa-times"></i>
        </button>
      </div>`;
    }).join('');
  }
  panel.style.display = 'flex';
}

function closeFavPanel() {
  document.getElementById('favPanel').style.display = 'none';
}

function removeFav(id) {
  favorites = favorites.filter(f => f !== id);
  saveFavorites();
  updateFavFab();
  openFavPanel();
}

// ── SHARE ─────────────────────────────────────────────────────
function shareWhatsApp() {
  if (!modalProduct) return;
  const text = `🔥 *${modalProduct.name}*\n💰 R$ ${Number(modalProduct.price).toFixed(2).replace('.',',')}\n🛒 ${modalProduct.link}\n\n_Via MelhoresDaShopee_`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
function shareTelegram() {
  if (!modalProduct) return;
  const text = `🔥 ${modalProduct.name}\n💰 R$ ${Number(modalProduct.price).toFixed(2).replace('.',',')}\n🛒 ${modalProduct.link}`;
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

if (allProducts.length === 0) {
  allProducts = [
    {
      id: Date.now() + 1,
      name: 'Fone Bluetooth sem fio com cancelamento de ruído',
      category: 'eletronicos',
      price: 49.90, originalPrice: 89.90,
      link: 'https://s.shopee.com.br/BPTGynFRK',
      images: [
        'https://cf.shopee.com.br/file/br-11134207-7qukw-lf8h7j5wfu9v8a_tn',
        'https://cf.shopee.com.br/file/br-11134207-7r98o-lt3d5txqb2pm75_tn'
      ],
      video: '',
      desc: 'Frete grátis · Mais de 2 mil vendidos · Produto original',
      featured: true
    }
  ];
  localStorage.setItem('shopee_products', JSON.stringify(allProducts));
}

// ── RENDER ────────────────────────────────────────────────────
function renderProducts() {
  const grid   = document.getElementById('productGrid');
  const empty  = document.getElementById('emptyState');
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

  if (firstLoad) {
    firstLoad = false;
    showSkeleton();
    setTimeout(() => _renderFiltered(grid, empty, search), 400);
  } else {
    _renderFiltered(grid, empty, search);
  }
}

function _renderFiltered(grid, empty, search) {
  let filtered = [...allProducts];
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
    default:           filtered = [...filtered.filter(p => p.featured), ...filtered.filter(p => !p.featured)];
  }

  if (!filtered.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  grid.innerHTML = filtered.map(p => cardHTML(p)).join('');
  animateCards();
  startCountdownTimers();
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

  let leftBadge = '';
  if (p.featured)    leftBadge = '<span class="badge-featured">⭐ Destaque</span>';
  else if (isHot)    leftBadge = '<span class="badge-hot">🔥 QUENTE</span>';
  else if (isNew)    leftBadge = '<span class="badge-new">✨ NOVO</span>';

  const allMedia = [...images, ...(p.video ? ['__video__'] : [])];
  const thumbsHTML = hasMore ? `
    <div class="card-thumbs">
      ${allMedia.slice(0, 5).map((m, i) => {
        if (m === '__video__') {
          const vt = getVideoThumb(p.video);
          return `<div class="thumb video-thumb" onclick="openProductModal(${p.id},${images.length});event.stopPropagation()">
            ${vt ? `<img src="${vt}" alt="video"/>` : '<div class="vt-placeholder"></div>'}
            <span class="play-icon">▶</span>
          </div>`;
        }
        return `<div class="thumb ${i===0?'active':''}" onclick="openProductModal(${p.id},${i});event.stopPropagation()">
          <img src="${m}" alt="" loading="lazy"/>
        </div>`;
      }).join('')}
      ${allMedia.length > 5 ? `<div class="thumb thumb-more">+${allMedia.length - 5}</div>` : ''}
    </div>` : '';

  return `
  <div class="product-card" onclick="openProductModal(${p.id},0)">
    ${leftBadge}
    ${discount   ? `<span class="badge-discount">-${discount}%</span>` : ''}
    ${hasMore ? `<span class="badge-gallery"><i class="fas fa-images"></i> ${[...images, ...(p.video?['v']:[])].length}</span>` : ''}
    <div class="card-img-wrap">
      <img src="${main}" alt="${p.name}" loading="lazy"
           onerror="this.src='https://via.placeholder.com/300x300?text=Sem+Imagem'"/>
    </div>
    ${thumbsHTML}
    <div class="card-body">
      <div class="card-name">${p.name}</div>
      ${p.desc ? `<div class="card-desc">${p.desc}</div>` : ''}
      ${p.rating ? `<div class="card-stars">${starsHTML(p.rating)}${p.soldCount ? `<span class="card-sold">${p.soldCount}+ vendidos</span>` : ''}</div>` : (p.soldCount ? `<div class="card-stars"><span class="card-sold">${p.soldCount}+ vendidos</span></div>` : '')}
      <div class="card-prices">
        ${p.originalPrice && p.originalPrice > p.price
          ? `<div class="card-original">R$ ${Number(p.originalPrice).toFixed(2).replace('.',',')}</div>` : ''}
        <div class="card-price">R$ ${Number(p.price).toFixed(2).replace('.',',')}</div>
      </div>
    </div>
        <div class="card-btn">🛒 Comprar na Shopee</div>
    ${(() => { const t = p.countdown ? new Date(p.countdown).getTime() : null; const s = t ? renderCountdownStr(t) : null; return s ? `<div class="card-countdown-wrap"><span class="card-countdown" data-countdown="${t}">⏰ Oferta encerra em: ${s}</span></div>` : ''; })()}
    <button class="card-compare-btn ${compareList.includes(p.id)?'active':''}" data-pid="${p.id}"
      onclick="toggleCompare(${p.id},event)" title="Adicionar para comparar">
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
  const p = allProducts.find(x => x.id === id);
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

  document.getElementById('modalName').textContent = p.name;
  document.getElementById('modalCategory').textContent = categoryLabel(p.category);
  document.getElementById('modalDesc').textContent = p.desc || '';
  document.getElementById('modalBuyBtn').href = p.link;

  // Stars & sold count
  const starsEl = document.getElementById('modalStars');
  const soldEl  = document.getElementById('modalSoldCount');
  starsEl.innerHTML  = p.rating ? starsHTML(p.rating) : '';
  soldEl.textContent = p.soldCount ? `🛒 ${p.soldCount}+ vendidos` : '';

  // Favorite button
  updateFavBtn();

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
    display.innerHTML = `<img src="${m}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:8px"
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
      onclick="setModalIndex(${i})">
      ${src ? `<img src="${src}" alt=""/>` : '<div class="vt-placeholder"></div>'}
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

initDarkMode();
updateFavFab();
renderProducts();
initHeroBanner();
initLGPD();

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
