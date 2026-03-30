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
    <div class="card-btn">�� Comprar na Shopee</div>
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

// ── FILTER CONTROLS ───────────────────────────────────────────
function setCategory(cat, btn) {
  currentCategory = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProducts();
}
function filterProducts() { renderProducts(); }

function categoryLabel(cat) {
  const map = { eletronicos:'📱 Eletrônicos', moda:'👗 Moda', casa:'🏠 Casa',
                beleza:'💄 Beleza', esporte:'⚽ Esporte', outros:'✨ Outros' };
  return map[cat] || cat;
}

initDarkMode();
updateFavFab();
renderProducts();
