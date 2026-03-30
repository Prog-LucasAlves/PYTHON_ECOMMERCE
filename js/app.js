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
  const grid  = document.getElementById('productGrid');
  const empty = document.getElementById('emptyState');
  const search = document.getElementById('searchInput').value.toLowerCase().trim();

  let filtered = allProducts;
  if (currentCategory !== 'todos') filtered = filtered.filter(p => p.category === currentCategory);
  if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
  filtered = [...filtered.filter(p => p.featured), ...filtered.filter(p => !p.featured)];

  if (!filtered.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  grid.innerHTML = filtered.map(p => cardHTML(p)).join('');
}

function cardHTML(p) {
  const images  = getImages(p);
  const main    = images[0] || 'https://via.placeholder.com/300x300?text=Sem+Imagem';
  const hasMore = images.length > 1 || !!p.video;
  const discount = p.originalPrice && p.originalPrice > p.price
    ? Math.round((1 - p.price / p.originalPrice) * 100) : null;

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
    ${p.featured ? '<span class="badge-featured">⭐ Destaque</span>' : ''}
    ${discount   ? `<span class="badge-discount">-${discount}%</span>` : ''}
    ${hasMore ? `<span class="badge-gallery"><i class="fas fa-images"></i> ${allMedia.length}</span>` : ''}
    <div class="card-img-wrap">
      <img src="${main}" alt="${p.name}" loading="lazy"
           onerror="this.src='https://via.placeholder.com/300x300?text=Sem+Imagem'"/>
    </div>
    ${thumbsHTML}
    <div class="card-body">
      <div class="card-name">${p.name}</div>
      ${p.desc ? `<div class="card-desc">${p.desc}</div>` : ''}
      <div class="card-prices">
        ${p.originalPrice && p.originalPrice > p.price
          ? `<div class="card-original">R$ ${Number(p.originalPrice).toFixed(2).replace('.',',')}</div>` : ''}
        <div class="card-price">R$ ${Number(p.price).toFixed(2).replace('.',',')}</div>
      </div>
    </div>
    <div class="card-btn">�� Comprar na Shopee</div>
  </div>`;
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

renderProducts();
