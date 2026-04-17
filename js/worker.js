// ── WEB WORKER: Heavy Data Processing ─────────────────────────
// Executes off-main-thread to prevent TBT/blocking

// ── HELPERS ──────────────────────────────────────────────────
function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function productFingerprint(item) {
  if (item._fp) return item._fp;
  const name = normalizeText(item?.name || '');
  const price = Number.isFinite(Number(item?.price)) ? Number(item.price).toFixed(2) : '';
  const image = String(item?.images?.[0] || item?.image || '').trim().replace(/[?#].*$/, '');
  const fp = (name || image || price) ? [name, price, image].join('|') : String(item?.id || '').trim();
  item._fp = fp;
  return fp;
}

function productSoftKey(item) {
  if (item._soft) return item._soft;
  const name = normalizeText(item?.name || '');
  const price = Number.isFinite(Number(item?.price)) ? Number(item.price).toFixed(2) : '';
  const soft = name ? `${name}|${price}` : productFingerprint(item);
  item._soft = soft;
  return soft;
}

function productLinkKey(item) {
  const raw = String(item?.link || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return (url.hostname + url.pathname).toLowerCase().replace(/\/+$/, '');
  } catch { return raw.split('?')[0].toLowerCase(); }
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

function getTimeBucket(mins) {
  return Math.floor(Date.now() / (mins * 60 * 1000));
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

function getDiscount(p) {
  if (!p.originalPrice || p.originalPrice <= p.price) return 0;
  return Math.round((1 - p.price / p.originalPrice) * 100);
}

function getProductScore(p) {
  const discount = getDiscount(p);
  const featured = p.featured ? 50 : 0;
  const orderBoost = Number.isFinite(Number(p.homeOrder)) ? Math.max(0, 100 - Number(p.homeOrder)) : 0;
  const campaignBoost = isCampaignActive(p) ? 30 : 0;
  return discount + featured + orderBoost + campaignBoost;
}

// ── DEDUP ───────────────────────────────────────────────────
function dedupeProducts(items) {
  const seenFp = new Set();
  const seenSoft = new Set();
  const seenLink = new Set();

  return items.filter(item => {
    if (!item._processed) {
      item._priceNum = Number(item.price) || 0;
      item._publishTs = item.publishDate ? new Date(item.publishDate).getTime() : 0;
      item._startTs = (item.campaignStart || item.publishDate) ? new Date(item.campaignStart || item.publishDate).getTime() : 0;
      item._endTs = item.campaignEnd ? new Date(item.campaignEnd).getTime() : 9999999999999;
      item._processed = true;
    }

    const fp = productFingerprint(item);
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

// ── CAMPAIGN ITEMS ──────────────────────────────────────────
function getCampaignItems(items, limit) {
  const bucket = getTimeBucket(5);
  const campaignSet = items
    .filter(p => !p.featured && !p.homeOrder && getCampaignGroupKey(p))
    .sort((a, b) => {
      const hashA = hashString(productFingerprint(a) + bucket);
      const hashB = hashString(productFingerprint(b) + bucket);
      return hashA - hashB;
    })
    .slice(0, limit);

  if (campaignSet.length >= limit) return campaignSet;

  const usedFp = new Set(campaignSet.map(p => productFingerprint(p)));
  const candidates = items
    .filter(p => !p.featured && !p.homeOrder && !usedFp.has(productFingerprint(p)))
    .sort((a, b) => getProductScore(b) - getProductScore(a));

  const byCategory = {};
  for (const p of candidates) {
    const cat = p.category || 'outros';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }

  const catQueues = Object.values(byCategory);
  const fill = [];
  const needed = limit - campaignSet.length;
  while (fill.length < needed && catQueues.some(q => q.length)) {
    for (const q of catQueues) {
      if (fill.length >= needed) break;
      if (q.length) fill.push(q.shift());
    }
  }

  return [...campaignSet, ...fill];
}

// ── ROTATE PRODUCTS ─────────────────────────────────────────
function rotateProducts(items, minutesLong, limit) {
  const bucket = getTimeBucket(minutesLong);
  return [...items]
    .sort((a, b) => {
      const aKey = a._rotKey || hashString(`${bucket}:${a.category}:${a.id}`);
      const bKey = b._rotKey || hashString(`${bucket}:${b.category}:${b.id}`);
      a._rotKey = aKey;
      b._rotKey = bKey;
      if (aKey !== bKey) return aKey - bKey;
      return String(a.id).localeCompare(String(b.id));
    })
    .slice(0, limit);
}

// ── SORT FEATURED ───────────────────────────────────────────
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

// ── PICK UNIQUE ─────────────────────────────────────────────
function pickUnique(items, usedSet, limit) {
  const picked = [];
  const usedSoft = new Set();
  const usedLink = new Set();
  for (const item of items) {
    const key = productFingerprint(item);
    const soft = productSoftKey(item);
    const link = productLinkKey(item);
    if (usedSet.has(key) || usedSoft.has(soft) || (link && usedLink.has(link))) continue;
    usedSet.add(key);
    usedSoft.add(soft);
    if (link) usedLink.add(link);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
}

// ── MESSAGE HANDLER ─────────────────────────────────────────
self.onmessage = function(e) {
  const { type, payload, id } = e.data;

  try {
    if (type === 'DEDUPE') {
      const result = dedupeProducts(payload.items);
      self.postMessage({ id, type: 'DEDUPE_RESULT', result });

    } else if (type === 'PROCESS_RENDER') {
      const { items, homeSectionLimit, campaignLimit, rotationLimit, rotationMinutes, now } = payload;

      // Filter displayable
      const filtered = items.filter(p => p._priceNum > 0 && (!p._publishTs || p._publishTs <= now));

      // Featured
      const featuredRaw = filtered.filter(p => p.featured || p.homeOrder);
      const usedFps = new Set();
      const featuredItems = pickUnique(sortFeaturedFirst(featuredRaw), usedFps, homeSectionLimit);

      // Campaign
      const campaignItems = pickUnique(getCampaignItems(filtered, campaignLimit), usedFps, campaignLimit);

      // Rotation pool (excluding featured + campaign)
      const usedFpSet = usedFps;
      const rotationPool = filtered.filter(p => !(p.featured || p.homeOrder || getCampaignGroupKey(p)));
      const rotatingItems = pickUnique(rotateProducts(rotationPool, rotationMinutes, rotationLimit), usedFpSet, rotationLimit);

      self.postMessage({
        id,
        type: 'RENDER_RESULT',
        result: { featuredItems, campaignItems, rotatingItems }
      });
    }
  } catch (err) {
    self.postMessage({ id, type: 'ERROR', error: err.message });
  }
};
