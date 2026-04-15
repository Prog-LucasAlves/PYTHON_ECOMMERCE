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
  const priceLine = p.originalPrice && p.originalPrice > p.price
    ? `~~R$ ${Number(p.originalPrice).toFixed(2).replace('.',',')}~~  →  *R$ ${Number(p.price).toFixed(2).replace('.',',')}*`
    : `*R$ ${Number(p.price).toFixed(2).replace('.',',')}*`;
  const summary = [
    `🔥 *${p.name}*`,
    `📂 ${categoryLabel(p.category)}`,
    discount ? `🏷️ Economia de *${discount}%*` : null,
    `💰 ${priceLine}`,
    `⚠️ Preço promocional sujeito a alteração sem aviso prévio.`,
    p.desc ? `📝 ${stripHtml(p.desc)}` : null,
    `🛒 Confira na Shopee: ${p.link}`,
  ].filter(Boolean).join('\n');
  const url = `https://t.me/share/url?url=${encodeURIComponent(p.link)}&text=${encodeURIComponent(summary)}`;
  window.open(url, '_blank');
}

async function loadProductsFromFirestore() {
  if (!db || !getDocs_fn || !collection_fn) return;
  try {
    const snap = await getDocs_fn(query_fn(collection_fn(db, 'products'), orderBy_fn('updatedAt', 'desc')));
    const remote = snap.docs.map(d => ({ ...d.data(), id: d.data().id || d.id })).filter(Boolean);
    if (remote.length) {
      products = remote;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
      console.log('[FIRESTORE] ✅ Loaded', products.length, 'products from Firestore');
    }
  } catch (e) {
    console.warn('[FIRESTORE] Failed to load products:', e.message);
  }
}

async function migrateLocalStorageProductsToFirestore() {
  if (!db || !collection_fn || !doc_fn || !setDoc_fn) return;
  try {
    const localProducts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!localProducts.length) return;

    const remoteIds = new Set(products.map(p => String(p.id)));
    const legacy = localProducts.filter(p => !remoteIds.has(String(p.id)));
    if (!legacy.length) return;

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
