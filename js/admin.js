// ── FIREBASE CONFIG ───────────────────────────────────────────
// SECURITY NOTE: Firebase API keys for web apps are intentionally public.
// Real security is enforced via Firebase Security Rules on the console:
// https://console.firebase.google.com → Authentication → Settings → Authorized domains
// Ensure only melhoresdashopee.com.br and localhost are authorized.

let auth = null;
let signInWithEmailAndPassword_fn = null;
let signOut_fn = null;
let onAuthStateChanged_fn = null;
let db = null;
let collection_fn = null;
let doc_fn = null;
let setDoc_fn = null;
let deleteDoc_fn = null;
let getDocs_fn = null;
let query_fn = null;
let orderBy_fn = null;

// Load Firebase asynchronously - don't block if it fails
(async () => {
  try {
    const { firebaseConfig } = await import("./config.js");
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const fb = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const fs = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    const app = initializeApp(firebaseConfig);
    auth = fb.getAuth(app);
    signInWithEmailAndPassword_fn = fb.signInWithEmailAndPassword;
    signOut_fn = fb.signOut;
    onAuthStateChanged_fn = fb.onAuthStateChanged;
    db = fs.getFirestore(app);
    collection_fn = fs.collection;
    doc_fn = fs.doc;
    setDoc_fn = fs.setDoc;
    deleteDoc_fn = fs.deleteDoc;
    getDocs_fn = fs.getDocs;
    query_fn = fs.query;
    orderBy_fn = fs.orderBy;

    console.log('[FIREBASE] ✅ Firebase loaded successfully');

    // Setup auth listener
    onAuthStateChanged_fn(auth, user => {
      if (user && user.email === ADMIN_EMAIL) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        loadProductsFromFirestore()
          .then(migrateLocalStorageProductsToFirestore)
          .finally(() => {
            renderAdminList();
            renderDashboard();
            initImageFields();
          });
      } else {
        if (user) {
          signOut_fn(auth).catch(() => {});
          const errorBox = document.getElementById('loginError');
          if (errorBox) {
            errorBox.textContent = 'Esta conta não tem acesso ao painel admin.';
            errorBox.style.display = 'block';
            errorBox.style.color = '#b00020';
          }
        }
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('adminPanel').style.display = 'none';
      }
    });
  } catch (e) {
    console.error('[FIREBASE] ⚠️ Firebase failed to load:', e.message);
    const errorBox = document.getElementById('loginError');
    if (errorBox) {
      errorBox.textContent = 'Falha ao carregar o painel. Verifique Firebase/Auth e recarregue a página.';
      errorBox.style.display = 'block';
      errorBox.style.color = '#b00020';
    }
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
  }
})();

// ── CONFIG ────────────────────────────────────────────────────
const STORAGE_KEY  = 'shopee_products';
const HISTORY_KEY  = 'shopee_history';
const CLICKS_KEY   = 'shopee_clicks';
const DEFAULT_DESC  = 'Frete grátis com cupom - Produto original - Entrega rápida -\nPreço promocional sujeito a alteração sem aviso prévio.';
const ADMIN_EMAIL   = 'lucasalves01@bol.com.br';
const SHOPEE_URL_RE = /\/(?:product|[^/?#]+)\/(\d+)\/(\d+)|[?&](?:vShopId|shopId)=(\d+).*?[?&](?:vItemId|itemId)=(\d+)/i;

// Test if localStorage is available and working
function testLocalStorage() {
  try {
    const test = '__test__';
    localStorage.setItem(test, 'ok');
    const result = localStorage.getItem(test);
    localStorage.removeItem(test);
    console.log('[STORAGE] ✅ localStorage is working');
    return true;
  } catch (e) {
    console.error('[STORAGE] ❌ localStorage not available:', e.message);
    console.error('[STORAGE] This might be because: incognito mode, localStorage disabled, or CORS issue');
    return false;
  }
}

testLocalStorage();

// ── STATE ─────────────────────────────────────────────────────
let products  = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
console.log('[ADMIN.JS] Loaded', products.length, 'products from localStorage at', new Date().toLocaleTimeString());
console.log('[ADMIN.JS] localStorage.getItem result:', localStorage.getItem(STORAGE_KEY) ? 'HAS DATA' : 'IS NULL/EMPTY');
let editingId = null;
let imageCount = 0;

function sameId(a, b) {
  return String(a) === String(b);
}

function trackEvent(name, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  }
}

// ── HISTORY HELPER ────────────────────────────────────────────
function addHistory(action, product) {
  const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  hist.unshift({ ts: Date.now(), action, id: product.id, name: product.name });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, 100)));
}

// ── STORAGE EVENT LISTENER ────────────────────────────────────
// Sync data across tabs when localStorage changes from another tab
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    products = JSON.parse(e.newValue || '[]');
    renderAdminList();
    renderDashboard();
  }
});

function doLogin() {
  if (!auth || !signInWithEmailAndPassword_fn) {
    alert('❌ Firebase não carregou. Tente novamente ou abra em modo offline.');
    return;
  }
  const email = document.getElementById('loginEmail').value;
  const pw    = document.getElementById('loginPassword').value;
  signInWithEmailAndPassword_fn(auth, email, pw)
    .then(() => {
      document.getElementById('loginError').style.display = 'none';
    })
    .catch(() => {
      document.getElementById('loginError').style.display = 'block';
      document.getElementById('loginPassword').value = '';
      document.getElementById('loginPassword').focus();
    });
}

function doLogout() {
  if (!auth || !signOut_fn) {
    console.warn('Firebase not available');
    return;
  }
  signOut_fn(auth);
}

function initAdminBindings() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const csvImportBtn = document.getElementById('csvImportBtn');
  const addImageBtn = document.getElementById('addImageBtn');
  const resetFormBtn = document.getElementById('resetFormBtn');
  const shareCloseBtn = document.getElementById('shareAfterSaveClose');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const prodVideo = document.getElementById('prodVideo');
  const prodLink = document.getElementById('prodLink');
  const adminSearch = document.getElementById('adminSearch');
  const adminProductList = document.getElementById('adminProductList');
  const imagesList = document.getElementById('imagesList');
  const productForm = document.getElementById('productForm');
  const csvFileInput = document.getElementById('csvFileInput');

  loginBtn?.addEventListener('click', doLogin);
  logoutBtn?.addEventListener('click', doLogout);
  csvImportBtn?.addEventListener('click', triggerCSVImport);
  csvFileInput?.addEventListener('change', importCSV);
  addImageBtn?.addEventListener('click', () => addImageField());
  resetFormBtn?.addEventListener('click', resetForm);
  shareCloseBtn?.addEventListener('click', () => {
    document.getElementById('shareAfterSave').style.display = 'none';
  });
  loginEmail?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  loginPassword?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  prodVideo?.addEventListener('input', previewVideo);
  prodLink?.addEventListener('input', updateAffiliatePreview);
  adminSearch?.addEventListener('input', renderAdminList);
  adminProductList?.addEventListener('click', handleAdminListClick);
  imagesList?.addEventListener('click', handleImageListClick);
  imagesList?.addEventListener('input', handleImageListInput);
  productForm?.addEventListener('submit', saveProduct);
}

document.addEventListener('DOMContentLoaded', initAdminBindings);

// Expõe funções ao escopo global (necessário com type="module")
window.doLogin            = doLogin;
window.doLogout           = doLogout;
window.saveProduct        = saveProduct;
window.editProduct        = editProduct;
window.deleteProduct      = deleteProduct;
window.resetForm          = resetForm;
window.addImageField      = addImageField;
window.removeImageField   = removeImageField;
window.updateImagesPreview = updateImagesPreview;
window.previewVideo       = previewVideo;
window.renderAdminList    = renderAdminList;
window.renderDashboard    = renderDashboard;
window.importCSV          = importCSV;
window.triggerCSVImport   = triggerCSVImport;
window.shareTelegramAdmin = shareTelegramAdmin;

// ── IMAGE LIST MANAGEMENT ──────────────────────────────────────
function initImageFields() {
  const list = document.getElementById('imagesList');
  if (!list) return;
  list.innerHTML = '';
  imageCount = 0;
  addImageField();
  const desc = document.getElementById('prodDesc');
  if (desc && !desc.value.trim()) desc.value = DEFAULT_DESC;
}

function addImageField(value) {
  const list = document.getElementById('imagesList');
  const idx  = imageCount++;
  const div  = document.createElement('div');
  div.className = 'img-field-row';
  div.id = `imgRow_${idx}`;
  div.innerHTML = `
    <span class="img-num">${idx + 1}</span>
    <input type="url" class="img-url-input" id="imgUrl_${idx}"
      placeholder="https://..." value="${value || ''}" />
    <button type="button" class="btn-remove-img" data-action="remove-image" data-row-id="imgRow_${idx}">
      <i class="fas fa-trash"></i>
    </button>`;
  list.appendChild(div);
  updateImagesPreview();
  renumberImageFields();
}

function removeImageField(rowId) {
  const row = document.getElementById(rowId);
  if (row) { row.remove(); renumberImageFields(); updateImagesPreview(); }
}

function renumberImageFields() {
  document.querySelectorAll('.img-field-row').forEach((row, i) => {
    const num = row.querySelector('.img-num');
    if (num) num.textContent = i + 1;
  });
}

function getImageUrls() {
  return Array.from(document.querySelectorAll('.img-url-input'))
    .map(inp => inp.value.trim()).filter(Boolean);
}

function updateImagesPreview() {
  const urls = getImageUrls();
  const box  = document.getElementById('imagesPreviewBox');
  const strip = document.getElementById('imagesPreviewStrip');
  if (!urls.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  strip.innerHTML = urls.map(u =>
    `<div class="admin-prev-img">
      <img src="${u}" alt="" onerror="this.style.opacity='0.3'"/>
    </div>`
  ).join('');
}

// ── VIDEO PREVIEW ──────────────────────────────────────────────
function previewVideo() {
  const url = (document.getElementById('prodVideo')?.value || '').trim();
  const box  = document.getElementById('videoPreviewBox');
  const cont = document.getElementById('videoPreviewContent');
  if (!url) { box.style.display = 'none'; cont.innerHTML = ''; return; }

  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (m) {
    const thumb = `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`;
    cont.innerHTML = `<div style="display:flex;align-items:center;gap:12px">
      <img src="${thumb}" style="height:64px;border-radius:6px;border:1px solid #eee"/>
      <span style="font-size:.85rem;color:#555">YouTube detectado ✅</span></div>`;
  } else {
    cont.innerHTML = `<video src="${url}" controls style="max-height:100px;border-radius:6px"></video>`;
  }
  box.style.display = 'block';
}

function stripHtml(text) {
  return (text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function parseSoldCount(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const normalized = raw.replace(/[^\d]/g, '');
  if (!normalized) return null;
  return parseInt(normalized, 10);
}

function formatSoldCount(value) {
  const n = parseInt(String(value ?? '').replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR');
}

function validateProductPayload(product) {
  if (!product.name || product.name.length < 3) return 'Nome do produto inválido.';
  if (!product.category) return 'Categoria é obrigatória.';
  if (!Number.isFinite(product.price) || product.price <= 0) return 'Preço com desconto deve ser maior que zero.';
  if (!product.link || !/^https?:\/\//i.test(product.link)) return 'Link de afiliado inválido.';
  if (!Array.isArray(product.images) || !product.images.length) return 'Adicione pelo menos uma imagem.';
  if (product.originalPrice !== null && (!Number.isFinite(product.originalPrice) || product.originalPrice < 0)) {
    return 'Preço original inválido.';
  }
  if (product.soldCount !== null && (!Number.isInteger(product.soldCount) || product.soldCount < 0)) {
    return 'Campo vendidos inválido.';
  }
  return null;
}

function normalizeAffiliateLink(link) {
  const raw = (link || '').trim();
  if (!raw) return { offerLink: '', productLink: '', itemId: null, shopId: null };

  const match = raw.match(SHOPEE_URL_RE);
  const shopId = match?.[1] || match?.[3] || null;
  const itemId = match?.[2] || match?.[4] || null;
  return {
    offerLink: raw,
    productLink: raw,
    itemId: itemId ? String(itemId) : null,
    shopId: shopId ? String(shopId) : null,
  };
}

function updateAffiliatePreview() {
  const linkInput = document.getElementById('prodLink');
  const itemIdInput = document.getElementById('prodItemId');
  const shopIdInput = document.getElementById('prodShopId');
  const status = document.getElementById('affiliateResolveStatus');
  const affiliate = normalizeAffiliateLink(linkInput?.value || '');

  if (itemIdInput) itemIdInput.value = affiliate.itemId || '';
  if (shopIdInput) shopIdInput.value = affiliate.shopId || '';

  if (!status) return;
  if (!affiliate.offerLink) {
    status.textContent = 'Cole a URL completa do produto para preencher os IDs.';
    status.style.color = '#777';
  } else if (affiliate.itemId && affiliate.shopId) {
    status.textContent = `IDs detectados: shopId ${affiliate.shopId} e itemId ${affiliate.itemId}.`;
    status.style.color = '#2e7d32';
  } else {
    status.textContent = 'Este link não trouxe os IDs no navegador. Use a URL completa do produto/variação, ou resolva o link antes de salvar.';
    status.style.color = '#b26a00';
  }
}

// ── SAVE PRODUCT ───────────────────────────────────────────────
async function saveProduct(e) {
  e.preventDefault();
  const images = getImageUrls();
  if (!images.length) { alert('Adicione pelo menos uma imagem.'); return; }

  const product = {
    id:            editingId || Date.now(),
    name:          document.getElementById('prodName').value.trim(),
    category:      document.getElementById('prodCategory').value,
    originalPrice: parseFloat(document.getElementById('prodOriginalPrice').value) || null,
    price:         parseFloat(document.getElementById('prodPrice').value),
    link:          document.getElementById('prodLink').value.trim(),
    images,
    video:         (document.getElementById('prodVideo')?.value || '').trim(),
    desc:          document.getElementById('prodDesc').value.trim(),
    rating:        parseFloat(document.getElementById('prodRating')?.value) || null,
    soldCount:     parseSoldCount(document.getElementById('prodSoldCount')?.value),
    featured:      document.getElementById('prodFeatured').checked,
    homeOrder:     parseInt(document.getElementById('prodHomeOrder')?.value || '', 10) || null,
    campaignId:    document.getElementById('prodCampaignId')?.value.trim() || '',
    campaignCategory: document.getElementById('prodCampaignCategory')?.value || '',
    campaignStart: document.getElementById('prodCampaignStart')?.value || '',
    campaignEnd:   document.getElementById('prodCampaignEnd')?.value || '',
    countdown:     document.getElementById('prodCountdown')?.value || null,
    publishDate:   document.getElementById('prodPublishDate')?.value || null,
  };

  const affiliate = normalizeAffiliateLink(product.link);
  product.offerLink = affiliate.offerLink;
  product.productLink = affiliate.productLink;
  product.itemId = affiliate.itemId;
  product.shopId = affiliate.shopId;
  const itemIdInput = document.getElementById('prodItemId');
  const shopIdInput = document.getElementById('prodShopId');
  if (itemIdInput) itemIdInput.value = affiliate.itemId || '';
  if (shopIdInput) shopIdInput.value = affiliate.shopId || '';
  updateAffiliatePreview();

  const validationError = validateProductPayload(product);
  if (validationError) {
    alert(validationError);
    return;
  }

  if (editingId) {
    const idx = products.findIndex(p => sameId(p.id, editingId));
    if (idx !== -1) products[idx] = product;
  } else {
    const duplicateIdx = products.findIndex(p => sameId(p.id, product.id));
    if (duplicateIdx !== -1) products.splice(duplicateIdx, 1);
    products.unshift(product);
  }

  await saveToStorage();
  addHistory(editingId ? 'edit' : 'create', product);
  const savedId = product.id;
  resetForm();
  renderAdminList();
  renderDashboard();
  // Show share banner
  const shareBanner = document.getElementById('shareAfterSave');
  const shareBtn    = document.getElementById('btnShareTgAfterSave');
  if (shareBanner && shareBtn) {
    shareBanner.style.display = 'flex';
    shareBtn.onclick = () => shareTelegramAdmin(savedId);
  }
}

// ── EDIT ──────────────────────────────────────────────────────
function editProduct(id) {
  const p = products.find(pr => sameId(pr.id, id));
  if (!p) return;

  editingId = p.id;
  document.getElementById('formTitle').innerHTML  = '<i class="fas fa-edit"></i> Editar Produto';
  document.getElementById('submitBtn').innerHTML  = '<i class="fas fa-save"></i> Atualizar Produto';

  document.getElementById('prodName').value          = p.name;
  document.getElementById('prodCategory').value      = p.category;
  document.getElementById('prodOriginalPrice').value = p.originalPrice || '';
  document.getElementById('prodPrice').value         = p.price;
  document.getElementById('prodLink').value          = p.link;
  if (document.getElementById('prodItemId')) document.getElementById('prodItemId').value = p.itemId || '';
  if (document.getElementById('prodShopId')) document.getElementById('prodShopId').value = p.shopId || '';
  updateAffiliatePreview();
  document.getElementById('prodDesc').value          = p.desc || '';
  document.getElementById('prodFeatured').checked    = p.featured || false;
  if (document.getElementById('prodHomeOrder'))
    document.getElementById('prodHomeOrder').value   = p.homeOrder || '';
  if (document.getElementById('prodCampaignId'))
    document.getElementById('prodCampaignId').value = p.campaignId || '';
  if (document.getElementById('prodCampaignCategory'))
    document.getElementById('prodCampaignCategory').value = p.campaignCategory || '';
  if (document.getElementById('prodCampaignStart'))
    document.getElementById('prodCampaignStart').value = p.campaignStart || '';
  if (document.getElementById('prodCampaignEnd'))
    document.getElementById('prodCampaignEnd').value = p.campaignEnd || '';
  if (document.getElementById('prodRating'))
    document.getElementById('prodRating').value    = p.rating || '';
  if (document.getElementById('prodSoldCount'))
    document.getElementById('prodSoldCount').value = p.soldCount ? formatSoldCount(p.soldCount) : '';
  if (document.getElementById('prodVideo'))
    document.getElementById('prodVideo').value = p.video || '';
  if (document.getElementById('prodCountdown'))
    document.getElementById('prodCountdown').value = p.countdown || '';
  if (document.getElementById('prodPublishDate'))
    document.getElementById('prodPublishDate').value = p.publishDate || '';

  // Populate image fields
  const list = document.getElementById('imagesList');
  list.innerHTML = ''; imageCount = 0;
  const imgs = p.images && p.images.length ? p.images : (p.image ? [p.image] : []);
  imgs.forEach(url => addImageField(url));
  if (!imgs.length) addImageField();

  previewVideo();
  updateImagesPreview();
  document.getElementById('prodName').scrollIntoView({ behavior: 'smooth' });
}

// ── DELETE ────────────────────────────────────────────────────
function deleteProduct(id) {
  if (!confirm('Tem certeza que quer remover este produto?')) return;
  const p = products.find(x => sameId(x.id, id));
  const before = products.length;
  products = products.filter(p => !sameId(p.id, id));
  const after = products.length;
  console.log(`[DELETE] "${p?.name}" - antes: ${before}, depois: ${after}`);
  saveToStorage();
  console.log(`[DELETE] localStorage após save:`, localStorage.getItem(STORAGE_KEY)?.substring(0, 100));
  if (p) addHistory('delete', p);
  renderAdminList();
  renderDashboard();
  showToast('Produto removido. 🗑️');
}

// ── RESET FORM ────────────────────────────────────────────────
function resetForm() {
  editingId = null;
  document.getElementById('productForm').reset();
  document.getElementById('formTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Adicionar Produto';
  document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Salvar Produto';
  const desc = document.getElementById('prodDesc');
  if (desc) desc.value = DEFAULT_DESC;
  if (document.getElementById('prodItemId')) document.getElementById('prodItemId').value = '';
  if (document.getElementById('prodShopId')) document.getElementById('prodShopId').value = '';
  if (document.getElementById('prodHomeOrder')) document.getElementById('prodHomeOrder').value = '';
  if (document.getElementById('prodCampaignId')) document.getElementById('prodCampaignId').value = '';
  if (document.getElementById('prodCampaignCategory')) document.getElementById('prodCampaignCategory').value = '';
  if (document.getElementById('prodCampaignStart')) document.getElementById('prodCampaignStart').value = '';
  if (document.getElementById('prodCampaignEnd')) document.getElementById('prodCampaignEnd').value = '';
  updateAffiliatePreview();
  document.getElementById('imagesPreviewBox').style.display = 'none';
  if (document.getElementById('videoPreviewBox'))
    document.getElementById('videoPreviewBox').style.display = 'none';
  initImageFields();
}

// ── ADMIN LIST ────────────────────────────────────────────────
function renderAdminList() {
  const search = (document.getElementById('adminSearch')?.value || '').toLowerCase();
  const list   = document.getElementById('adminProductList');
  const homeTopList = document.getElementById('adminHomeTopList');
  const prodCountEl = document.getElementById('prodCount');
  const homeTopCountEl = document.getElementById('homeTopCount');
  if (prodCountEl) prodCountEl.textContent = products.length;

  let filtered = products;
  if (search) filtered = products.filter(p => p.name.toLowerCase().includes(search));
  const homeTop = filtered
    .filter(p => p.featured || p.homeOrder || p.campaignId || p.campaignStart || p.campaignEnd)
    .sort((a, b) => {
      const aOrder = Number.isFinite(Number(a.homeOrder)) ? Number(a.homeOrder) : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(Number(b.homeOrder)) ? Number(b.homeOrder) : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      if ((a.featured ? 1 : 0) !== (b.featured ? 1 : 0)) return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  const remaining = filtered.filter(p => !(p.featured || p.homeOrder || p.campaignId || p.campaignStart || p.campaignEnd));
  if (homeTopCountEl) homeTopCountEl.textContent = homeTop.length;

  const emptyMsg = search
    ? '<p style="color:#aaa;text-align:center;padding:24px">Nenhum produto encontrado para este filtro.</p>'
    : '<p style="color:#aaa;text-align:center;padding:24px">Nenhum produto cadastrado ainda.</p>';

  if (!filtered.length) {
    if (homeTopList) homeTopList.innerHTML = '';
    if (list) list.innerHTML = emptyMsg;
    return;
  }

  if (homeTopList) {
    homeTopList.innerHTML = homeTop.length
      ? homeTop.map(renderAdminItem).join('')
      : '<p class="admin-empty-inline">Nenhum item fixado na 1ª linha.</p>';
  }

  if (!remaining.length) {
    list.innerHTML = '<p class="admin-empty-inline">Nenhum outro produto encontrado.</p>';
    return;
  }

  list.innerHTML = remaining.map(renderAdminItem).join('');
}

function renderAdminItem(p) {
    const imgs     = p.images && p.images.length ? p.images : (p.image ? [p.image] : []);
    const mainImg  = imgs[0] || '';
    const discount = p.originalPrice && p.originalPrice > p.price
      ? Math.round((1 - p.price / p.originalPrice) * 100) : null;
    const mediaCount = imgs.length + (p.video ? 1 : 0);
    const clicks   = JSON.parse(localStorage.getItem(CLICKS_KEY) || '{}');
    const clickN   = clicks[p.id] || 0;
    const isScheduled = p.publishDate && new Date(p.publishDate) > new Date();
    const isCampaign = p.campaignId || p.campaignStart || p.campaignEnd;
    const isHomeTop = p.featured || p.homeOrder || isCampaign;
    return `
    <div class="admin-item${isScheduled ? ' admin-item-scheduled' : ''}${isHomeTop ? ' admin-item-featured' : ''}">
      <img src="${mainImg}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/60x60?text=?'"/>
      <div class="admin-item-info">
        <div class="name">${p.featured ? 'Destaque · ' : ''}${isCampaign ? 'Campanha · ' : ''}${isScheduled ? 'Agendado · ' : ''}${p.name}</div>
        <div class="meta">
          R$ ${Number(p.price).toFixed(2).replace('.',',')}
          ${discount ? `· <span style="color:#ee4d2d">-${discount}%</span>` : ''}
          · ${categoryLabel(p.category)}
          ${p.homeOrder ? `· <span style="color:#1976d2">1ª linha #${p.homeOrder}</span>` : ''}
          ${isCampaign ? `· <span style="color:#d97706">Campanha${p.campaignId ? ` #${p.campaignId}` : ''}</span>` : ''}
          ${mediaCount > 1 ? `· <span style="color:#888">📷 ${mediaCount} mídias</span>` : ''}
          ${p.video ? '· <span style="color:#888">🎬 vídeo</span>' : ''}
          ${clickN ? `· <span style="color:#1976d2"><i class="fas fa-mouse-pointer"></i> ${clickN}</span>` : ''}
          ${isScheduled ? `· <span style="color:#ff9800">Pub: ${new Date(p.publishDate).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>` : ''}
        </div>
      </div>
      <div class="admin-item-actions">
        <button class="btn-tg-share" type="button" data-action="share-telegram" data-product-id="${p.id}" title="Compartilhar no Telegram"><i class="fab fa-telegram-plane"></i></button>
        <button class="btn-edit" type="button" data-action="edit-product" data-product-id="${p.id}"><i class="fas fa-pen"></i></button>
        <button class="btn-delete" type="button" data-action="delete-product" data-product-id="${p.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
          ${isScheduled ? `· <span style="color:#ff9800">Pub: ${new Date(p.publishDate).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>` : ''}
        </div>
      </div>
      <div class="admin-item-actions">
        <button class="btn-tg-share" type="button" data-action="share-telegram" data-product-id="${p.id}" title="Compartilhar no Telegram"><i class="fab fa-telegram-plane"></i></button>
        <button class="btn-edit" type="button" data-action="edit-product" data-product-id="${p.id}"><i class="fas fa-pen"></i></button>
        <button class="btn-delete" type="button" data-action="delete-product" data-product-id="${p.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
}

function handleAdminListClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { action, productId, rowId } = btn.dataset;
  if (action === 'delete-product') deleteProduct(productId);
  if (action === 'edit-product') editProduct(productId);
  if (action === 'share-telegram') shareTelegramAdmin(productId);
  if (action === 'remove-image' && rowId) removeImageField(rowId);
}

function handleImageListInput(e) {
  if (e.target.classList.contains('img-url-input')) updateImagesPreview();
}

function handleImageListClick(e) {
  const btn = e.target.closest('button[data-action="remove-image"]');
  if (!btn) return;
  const rowId = btn.dataset.rowId;
  if (rowId) removeImageField(rowId);
}

// ── HELPERS ───────────────────────────────────────────────────
async function saveToStorage() {
  try {
    const json = JSON.stringify(products);
    localStorage.setItem(STORAGE_KEY, json);
    await saveProductsToFirestore();
    console.log('[STORAGE] ✅ Saved', products.length, 'products to localStorage');
  } catch (e) {
    console.error('[STORAGE] ❌ Failed to save:', e.message);
    alert('⚠️ Erro ao salvar no armazenamento local. Verifique se está em modo incógnito.');
  }
}

// ── TELEGRAM SHARE ────────────────────────────────────────────
const TG_GROUP = 'https://t.me/ofertasshopeeday';

function shareTelegramAdmin(id) {
  const p = products.find(x => sameId(x.id, id));
  if (!p) return;
  trackEvent('share_telegram_admin', {
    item_id: p.id,
    item_name: p.name,
    item_category: p.category,
  });
  const discount = p.originalPrice && p.originalPrice > p.price
    ? Math.round((1 - p.price / p.originalPrice) * 100) : null;

    const col = collection_fn(db, 'products');
    await Promise.all(legacy.map(product =>
      setDoc_fn(doc_fn(col, String(product.id)), { ...product, updatedAt: Date.now() }, { merge: true })
    ));
    products = [...legacy, ...products];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    console.log('[FIRESTORE] ✅ Migrated', legacy.length, 'legacy products from localStorage');
  } catch (e) {
    console.warn('[FIRESTORE] Migration skipped:', e.message);
  }
}

async function saveProductsToFirestore() {
  if (!db || !collection_fn || !doc_fn || !setDoc_fn || !deleteDoc_fn) return;
  try {
    const col = collection_fn(db, 'products');
    const ids = new Set();
    for (const product of products) {
      const payload = { ...product, updatedAt: Date.now() };
      ids.add(String(product.id));
      await setDoc_fn(doc_fn(col, String(product.id)), payload, { merge: true });
    }
    const snap = await getDocs_fn(collection_fn(db, 'products'));
    await Promise.all(snap.docs
      .filter(d => !ids.has(d.id))
      .map(d => deleteDoc_fn(d.ref)));
    console.log('[FIRESTORE] ✅ Synced products to Firestore');
  } catch (e) {
    console.warn('[FIRESTORE] Failed to save products:', e.message);
  }
}

function shareTelegramGroupAdmin(id) {
  shareTelegramAdmin(id);
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

// ── DASHBOARD ─────────────────────────────────────────────────
function renderDashboard() {
  const el = document.getElementById('dashboardSection');
  if (!el) return;
  const clicks  = JSON.parse(localStorage.getItem(CLICKS_KEY) || '{}');
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

  const totalClicks  = Object.values(clicks).reduce((a, b) => a + b, 0);
  const scheduled    = products.filter(p => p.publishDate && new Date(p.publishDate) > new Date()).length;

  const catCount = {};
  products.forEach(p => { catCount[p.category] = (catCount[p.category] || 0) + 1; });
  const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];

  const topClicked = Object.entries(clicks)
    .map(([id, n]) => ({ p: products.find(x => sameId(x.id, id)), n }))
    .filter(x => x.p)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);

  el.innerHTML = `
    <div class="dash-stats">
      <div class="dash-card">
        <div class="dash-icon"><i class="fas fa-box"></i></div>
        <div class="dash-info"><div class="dash-value">${products.length}</div><div class="dash-label">Produtos</div></div>
      </div>
      <div class="dash-card">
        <div class="dash-icon clicks"><i class="fas fa-mouse-pointer"></i></div>
        <div class="dash-info"><div class="dash-value">${totalClicks}</div><div class="dash-label">Cliques totais</div></div>
      </div>
      <div class="dash-card">
        <div class="dash-icon sched"><i class="fas fa-calendar-alt"></i></div>
        <div class="dash-info"><div class="dash-value">${scheduled}</div><div class="dash-label">Agendados</div></div>
      </div>
      <div class="dash-card">
        <div class="dash-icon cat"><i class="fas fa-tag"></i></div>
        <div class="dash-info"><div class="dash-value">${topCat ? categoryLabel(topCat[0]) : '–'}</div><div class="dash-label">Cat. principal</div></div>
      </div>
    </div>

    <div class="dash-row">
      <div class="dash-panel">
        <h3><i class="fas fa-fire"></i> Top Cliques</h3>
        ${topClicked.length ? topClicked.map(({p, n}) => `
          <div class="dash-top-item">
            <img src="${(p.images&&p.images[0])||''}" alt="" onerror="this.src='https://via.placeholder.com/36?text=?'"/>
            <div class="dash-top-name">${p.name.substring(0,40)}${p.name.length>40?'…':''}</div>
            <span class="dash-top-count">${n} abertura${n > 1 ? 's' : ''}</span>
          </div>`).join('') : '<p class="dash-empty">Nenhum clique registrado ainda.</p>'}
      </div>

      <div class="dash-panel">
        <h3><i class="fas fa-history"></i> Histórico</h3>
        ${history.length ? history.slice(0,10).map(h => {
          const icons = { create:'fas fa-plus-circle', edit:'fas fa-pen', delete:'fas fa-trash' };
          const labels = { create:'Adicionado', edit:'Editado', delete:'Removido' };
          const dt = new Date(h.ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
          return `<div class="dash-hist-item">
            <i class="hist-icon ${h.action} ${icons[h.action]||'fas fa-circle'}"></i>
            <div class="dash-top-name">${h.name.substring(0,38)}${h.name.length>38?'…':''}</div>
            <span class="dash-hist-dt">${dt}</span>
            <span class="dash-hist-lbl ${h.action}">${labels[h.action]||h.action}</span>
          </div>`;
        }).join('') : '<p class="dash-empty">Nenhum histórico ainda.</p>'}
      </div>
    </div>`;
}

// ── CSV IMPORT ────────────────────────────────────────────────
function triggerCSVImport() {
  document.getElementById('csvFileInput').click();
}

function importCSV(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { alert('CSV inválido ou vazio.'); return; }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g,''));
    let imported = 0, errors = 0;
    lines.slice(1).forEach(line => {
      // Split respecting quoted fields
      const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g) || line.split(',');
      const clean = v => (v||'').trim().replace(/^"|"$/g,'');
      const get   = key => { const i = headers.indexOf(key); return i>=0 ? clean(cols[i]) : ''; };

      const name  = get('name') || get('nome');
      const price = parseFloat(get('price') || get('preco') || get('preço'));
      const link  = get('link') || get('url');
      if (!name || isNaN(price) || !link) { errors++; return; }

      const product = {
        id:            Date.now() + Math.random(),
        name,
        category:      get('category') || get('categoria') || 'outros',
        campaignId:    get('campaignid') || get('campaign_id') || '',
        campaignStart: get('campaignstart') || get('campaign_start') || '',
        campaignEnd:   get('campaignend') || get('campaign_end') || '',
        campaignCategory: get('campaigncategory') || get('campaign_category') || '',
        originalPrice: parseFloat(get('originalprice') || get('precooriginal') || get('preco_original')) || null,
        price,
        link,
        images:        [get('image') || get('imagem') || get('img')].filter(Boolean),
        video:         get('video') || '',
        desc:          get('desc') || get('descricao') || get('descrição') || '',
        rating:        parseFloat(get('rating') || get('avaliacao')) || null,
        soldCount:     parseSoldCount(get('soldcount') || get('vendidos')),
        featured:      (get('featured') || get('destaque')) === 'true',
        countdown:     get('countdown') || null,
        publishDate:   get('publishdate') || get('publicacao') || null,
        firstLine:     (get('firstline') || get('primeiralinha')) === 'true',
      };
      const dupIndex = products.findIndex(p => sameId(p.id, product.id) || p.link === product.link || p.name.toLowerCase() === product.name.toLowerCase());
      if (dupIndex !== -1) products.splice(dupIndex, 1);
      products.unshift(product);
      addHistory('create', product);
      imported++;
    });
    saveToStorage();
    renderAdminList();
    renderDashboard();
    e.target.value = '';
    showToast(`${imported} produto${imported === 1 ? '' : 's'} importado${imported === 1 ? '' : 's'}${errors ? `, ${errors} linha${errors === 1 ? '' : 's'} ignorada${errors === 1 ? '' : 's'}` : ''} ✅`);
  };
  reader.readAsText(file);
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'toast';
    t.style = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:#333;color:#fff;padding:12px 24px;border-radius:8px;
      font-size:.9rem;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.25);transition:opacity .3s;`;
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._to);
  t._to = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}
