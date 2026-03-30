// ── FIREBASE CONFIG ───────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4yyyPqrVJRx5ZBdKmlJQizcnP4KkaHj0",
  authDomain: "e-commerce-shopee.firebaseapp.com",
  projectId: "e-commerce-shopee",
  storageBucket: "e-commerce-shopee.firebasestorage.app",
  messagingSenderId: "152384004387",
  appId: "1:152384004387:web:7569ae1f73efec9d886c96",
  measurementId: "G-DDCGPWH0XD"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ── CONFIG ────────────────────────────────────────────────────
const STORAGE_KEY = 'shopee_products';

// ── STATE ─────────────────────────────────────────────────────
let products  = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let editingId = null;
let imageCount = 0;

// ── LOGIN ─────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    renderAdminList();
    initImageFields();
  } else {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
  }
});

function doLogin() {
  const email = document.getElementById('loginEmail').value;
  const pw    = document.getElementById('loginPassword').value;
  signInWithEmailAndPassword(auth, email, pw)
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
  signOut(auth);
}

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

// ── IMAGE LIST MANAGEMENT ──────────────────────────────────────
function initImageFields() {
  const list = document.getElementById('imagesList');
  if (!list) return;
  list.innerHTML = '';
  imageCount = 0;
  addImageField();
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
      placeholder="https://..." value="${value || ''}"
      oninput="updateImagesPreview()" />
    <button type="button" class="btn-remove-img" onclick="removeImageField('imgRow_${idx}')">
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

// ── SAVE PRODUCT ───────────────────────────────────────────────
function saveProduct(e) {
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
    featured:      document.getElementById('prodFeatured').checked
  };

  if (editingId) {
    const idx = products.findIndex(p => p.id === editingId);
    if (idx !== -1) products[idx] = product;
  } else {
    products.unshift(product);
  }

  saveToStorage();
  resetForm();
  renderAdminList();
  showToast(editingId ? 'Produto atualizado! ✅' : 'Produto adicionado! ✅');
}

// ── EDIT ──────────────────────────────────────────────────────
function editProduct(id) {
  const p = products.find(pr => pr.id === id);
  if (!p) return;

  editingId = id;
  document.getElementById('formTitle').innerHTML  = '<i class="fas fa-edit"></i> Editar Produto';
  document.getElementById('submitBtn').innerHTML  = '<i class="fas fa-save"></i> Atualizar Produto';

  document.getElementById('prodName').value          = p.name;
  document.getElementById('prodCategory').value      = p.category;
  document.getElementById('prodOriginalPrice').value = p.originalPrice || '';
  document.getElementById('prodPrice').value         = p.price;
  document.getElementById('prodLink').value          = p.link;
  document.getElementById('prodDesc').value          = p.desc || '';
  document.getElementById('prodFeatured').checked    = p.featured || false;
  if (document.getElementById('prodVideo'))
    document.getElementById('prodVideo').value = p.video || '';

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
  products = products.filter(p => p.id !== id);
  saveToStorage();
  renderAdminList();
  showToast('Produto removido. 🗑️');
}

// ── RESET FORM ────────────────────────────────────────────────
function resetForm() {
  editingId = null;
  document.getElementById('productForm').reset();
  document.getElementById('formTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Adicionar Produto';
  document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Salvar Produto';
  document.getElementById('imagesPreviewBox').style.display = 'none';
  if (document.getElementById('videoPreviewBox'))
    document.getElementById('videoPreviewBox').style.display = 'none';
  initImageFields();
}

// ── ADMIN LIST ────────────────────────────────────────────────
function renderAdminList() {
  const search = (document.getElementById('adminSearch')?.value || '').toLowerCase();
  const list   = document.getElementById('adminProductList');
  document.getElementById('prodCount').textContent = products.length;

  let filtered = products;
  if (search) filtered = products.filter(p => p.name.toLowerCase().includes(search));

  if (!filtered.length) {
    list.innerHTML = '<p style="color:#aaa;text-align:center;padding:24px">Nenhum produto cadastrado ainda.</p>';
    return;
  }

  list.innerHTML = filtered.map(p => {
    const imgs     = p.images && p.images.length ? p.images : (p.image ? [p.image] : []);
    const mainImg  = imgs[0] || '';
    const discount = p.originalPrice && p.originalPrice > p.price
      ? Math.round((1 - p.price / p.originalPrice) * 100) : null;
    const mediaCount = imgs.length + (p.video ? 1 : 0);
    return `
    <div class="admin-item">
      <img src="${mainImg}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/60x60?text=?'"/>
      <div class="admin-item-info">
        <div class="name">${p.featured ? '⭐ ' : ''}${p.name}</div>
        <div class="meta">
          R$ ${Number(p.price).toFixed(2).replace('.',',')}
          ${discount ? `· <span style="color:#ee4d2d">-${discount}%</span>` : ''}
          · ${categoryLabel(p.category)}
          ${mediaCount > 1 ? `· <span style="color:#888">📷 ${mediaCount} mídias</span>` : ''}
          ${p.video ? '· <span style="color:#888">🎬 vídeo</span>' : ''}
        </div>
      </div>
      <div class="admin-item-actions">
        <button class="btn-edit"   onclick="editProduct(${p.id})"><i class="fas fa-pen"></i></button>
        <button class="btn-delete" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

// ── HELPERS ───────────────────────────────────────────────────
function saveToStorage() { localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); }

function categoryLabel(cat) {
  const map = { eletronicos:'📱 Eletrônicos', moda:'👗 Moda', casa:'🏠 Casa',
                beleza:'💄 Beleza', esporte:'⚽ Esporte', outros:'✨ Outros' };
  return map[cat] || cat;
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
