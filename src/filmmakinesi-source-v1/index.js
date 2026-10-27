/**
 * FilmMakinesi Video Source Module - Synthetiq Player
 * Target: FilmMakinesi (https://filmmakinesi.to)
 * Contract Version 3 | contentType: video
 * Features:
 *   - 1080p Full HD Turkish & Hollywood Movies & Series
 *   - Dedicated Subtitled (Original Audio + Turkish CC) via Rapid a2 variant stream
 *   - Dedicated Dubbed (Turkish Audio) via Rapid a1 variant and CloseLoad streams
 *   - Native Audio & Subtitles switcher integration for Synthetiq Player
 *   - Safe pure-JS deobfuscation (Zero eval, Zero new Function, Zero new URL)
 *   - Inlined WebVTT subtitles to prevent iOS AVPlayer 403 blocks
 *   - Unblocked Amazon & Metahub high-res posters via Cinemeta and IMDb ID indexing
 *   - Version 1.0.2
 */

const BASE_URL = 'https://filmmakinesi.to';

function getHostname(url) {
  if (!url) return '';
  const m = String(url).match(/^https?:\/\/([^\/:]+)/i);
  return m ? m[1] : '';
}

function makeAbsolute(path, base = BASE_URL) {
  if (!path) return '';
  const trimmed = String(path).trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return 'https:' + trimmed;
  }
  const cleanBase = String(base).replace(/\/+$/, '');
  if (trimmed.startsWith('/')) {
    return cleanBase + trimmed;
  }
  return cleanBase + '/' + trimmed;
}

function cleanText(text) {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;|&apos;|&#8217;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function safeAtob(str) {
  if (typeof atob === 'function') {
    try { return atob(str); } catch (_) {}
  }
  const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let out = '';
  str = String(str).replace(/[\t\n\f\r ]+/g, '');
  let bits = 0, buffer = 0;
  for (let i = 0; i < str.length; i++) {
    const idx = b64.indexOf(str.charAt(i));
    if (idx === -1) continue;
    if (idx === 64) break;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >>> bits) & 0xff);
    }
  }
  return out;
}

/**
 * Pure JavaScript Dean Edwards unpacker (safe, zero eval)
 */
function unpackDeanEdwards(p, a, c, k) {
  const d = {};
  const e = function(val) {
    return (val < a ? '' : e(parseInt(val / a, 10))) + ((val = val % a) > 35 ? String.fromCharCode(val + 29) : val.toString(36));
  };
  while (c--) {
    d[e(c)] = k[c] || e(c);
  }
  return p.replace(/\b\w+\b/g, (elem) => d[elem] || elem);
}

function safeUnpackAll(html) {
  if (!html || typeof html !== 'string') return '';
  let out = html;
  const regex = /eval\s*\(\s*function\(p,a,c,k,e,d\)[\s\S]*?return\s+p\s*\}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\.split\(['"]\|['"]\)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const p = match[1];
      const a = parseInt(match[2], 10);
      const c = parseInt(match[3], 10);
      const k = match[4].split('|');
      const unpacked = unpackDeanEdwards(p, a, c, k);
      out = out.replace(match[0], unpacked);
    } catch (_) {}
  }
  return out;
}

/**
 * Pure JS FilmMakinesi Embed Decipher (Zero eval, Zero new Function)
 */
function decipherFilmMakinesi(parts, hostname) {
  if (!Array.isArray(parts) || parts.length < 3) return '';
  const arr = [...parts];
  const len = arr.length - 2;
  const splitIdx1 = len % 7;
  const splitIdx2 = 8 + (len % 5);

  const r49 = arr.splice(splitIdx2, 1)[0] || '';
  const n49nn = (arr.splice(splitIdx1, 1)[0] || '') + hostname;
  let text = arr.join('');

  if (n49nn.length > 4096) {
    text = safeAtob(text);
  }

  let eb07 = 0;
  let nuk3 = 0;
  for (let i = 0; i < n49nn.length; i++) {
    const c = n49nn.charCodeAt(i);
    eb07 = (eb07 * 37 + c) % 241;
    nuk3 = (nuk3 + ((c << 1) ^ i)) & 255;
  }

  const n5u3 = (eb07 * 3 + nuk3) % 256;
  const z0a = (nuk3 % 11) + 5;
  let x6c1f = ((nuk3 * 251 + eb07) % 65519) + 1;

  for (let i = r49.length - 1; i >= 0; i--) {
    const c = r49.charAt(i);
    if (c === '7') {
      text = safeAtob(text);
    } else if (c === '3') {
      text = text.split('').reverse().join('');
    } else {
      const shift = (26 - ((c.charCodeAt(0) - 96) % 26)) % 26;
      text = text.replace(/[a-zA-Z]/g, (ch) => {
        const code = ch.charCodeAt(0);
        const base = (code <= 90) ? 65 : 97;
        return String.fromCharCode((code - base + shift) % 26 + base);
      });
    }
  }

  if (r49.length > 2048) {
    text = text.split('').reverse().join('');
  }

  const tLen = text.length;
  const shuffleIndices = [];
  for (let i = tLen - 1; i >= 1; i--) {
    x6c1f = (x6c1f * 97 + 41) % 65519;
    shuffleIndices[i] = x6c1f % (i + 1);
  }

  const chars = text.split('');
  for (let i = 1; i < tLen; i++) {
    const target = shuffleIndices[i];
    const temp = chars[i];
    chars[i] = chars[target];
    chars[target] = temp;
  }
  text = chars.join('');

  let lv4 = n5u3;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    lv4 = (lv4 * 5 + z0a) % 256;
    result += String.fromCharCode(code ^ lv4);
    lv4 = (lv4 + code) % 256;
  }

  return result;
}

function decodeEmbedStream(html, hostname) {
  const fullHtml = safeUnpackAll(html);
  const clean = fullHtml.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  const jwMatch = clean.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*([a-zA-Z0-9_$]+)/);
  if (jwMatch) {
    const targetVar = jwMatch[1];
    const assignRegex = new RegExp('(?:var|let|const)?\\s*' + targetVar + '\\s*=\\s*[a-zA-Z0-9_$]+\\s*\\(\\s*["\']([^"\']+)["\']\\s*\\.\\s*split\\s*\\(\\s*["\']([^"\']+)["\']\\s*\\)\\s*\\)');
    const m = clean.match(assignRegex);
    if (m) {
      const parts = m[1].split(m[2]);
      const decoded = decipherFilmMakinesi(parts, hostname);
      if (decoded && decoded.startsWith('http')) return decoded;
    }
  }

  const allMatches = [...clean.matchAll(/["']([^"']{80,})["']\s*\.\s*split\s*\(\s*["']([^"']+)["']\s*\)/g)];
  for (const am of allMatches) {
    const parts = am[1].split(am[2]);
    const decoded = decipherFilmMakinesi(parts, hostname);
    if (decoded && decoded.startsWith('http')) return decoded;
  }

  return null;
}

/**
 * Robust HTTP GET supporting both Synthetiq fetchv2 bridge and Node.js fetch
 */
async function httpGet(url, customHeaders = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    ...customHeaders
  };

  let res;
  if (typeof fetchv2 === 'function') {
    res = await fetchv2(url, headers, 'GET', null, { timeoutMs: 25000 });
  } else {
    res = await fetch(url, { method: 'GET', headers });
  }

  let text = '';
  if (res && typeof res.text === 'function') {
    try { text = await res.text(); } catch (_) {}
  } else if (res && typeof res.body === 'string') {
    text = res.body;
  } else if (res && res.body != null) {
    text = String(res.body);
  }

  if (!text && res && typeof res.json === 'function') {
    try {
      const parsed = await res.json();
      text = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    } catch (_) {}
  } else if (!text && res && res.json != null) {
    try {
      text = typeof res.json === 'string' ? res.json : JSON.stringify(res.json);
    } catch (_) {}
  }

  return text || '';
}

const posterCache = new Map();

function normalizeStr(str) {
  return String(str || '').toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchCinemetaMetas(query) {
  if (!query) return [];
  const enc = encodeURIComponent(query);
  try {
    const [mResText, sResText] = await Promise.all([
      httpGet(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${enc}.json`).catch(() => ''),
      httpGet(`https://v3-cinemeta.strem.io/catalog/series/top/search=${enc}.json`).catch(() => '')
    ]);
    const mRes = mResText ? JSON.parse(mResText) : {};
    const sRes = sResText ? JSON.parse(sResText) : {};
    return [...(mRes.metas || []), ...(sRes.metas || [])];
  } catch (_) {
    return [];
  }
}

async function resolveCardPoster(card, queryMetas = []) {
  if (card.id && posterCache.has(card.id)) {
    return posterCache.get(card.id);
  }

  const rawPoster = card.rawPoster || card.image || '';
  const slugMatch = rawPoster.match(/\/([^\/]+?)(?:\.jpg|\.webp|-thumb)/i);
  const slug = slugMatch ? slugMatch[1].replace(/[-_]/g, ' ') : '';
  const yearMatch = (rawPoster + ' ' + card.href).match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? yearMatch[1] : '';

  const normTitle = normalizeStr(card.title);
  const normSlug = normalizeStr(slug);

  // 1. Match against query metas
  for (const m of queryMetas) {
    const mName = normalizeStr(m.name);
    const mYear = String(m.releaseInfo || m.year || '');
    const matchName = (normSlug && (normSlug.includes(mName) || mName.includes(normSlug))) ||
                      (normTitle && (normTitle.includes(mName) || mName.includes(normTitle)));
    const matchYear = !year || !mYear || mYear.includes(year) || year.includes(mYear);

    if (matchName && matchYear && (m.poster || m.id)) {
      const p = m.poster || `https://images.metahub.space/poster/medium/${m.id}/img`;
      if (card.id) posterCache.set(card.id, p);
      return p;
    }
  }

  // 2. Direct Cinemeta lookup by slug or card title
  const searchKey = slug || card.title;
  if (searchKey) {
    const isSeries = card.href && card.href.includes('/dizi/');
    const primaryCat = isSeries ? 'series' : 'movie';
    const fallbackCat = isSeries ? 'movie' : 'series';
    try {
      const encKey = encodeURIComponent(searchKey);
      const resText = await httpGet(`https://v3-cinemeta.strem.io/catalog/${primaryCat}/top/search=${encKey}.json`);
      const res = resText ? JSON.parse(resText) : null;
      if (res && res.metas && res.metas.length > 0) {
        const top = res.metas[0];
        const p = top.poster || (top.id ? `https://images.metahub.space/poster/medium/${top.id}/img` : '');
        if (p) {
          if (card.id) posterCache.set(card.id, p);
          return p;
        }
      }
      const fbText = await httpGet(`https://v3-cinemeta.strem.io/catalog/${fallbackCat}/top/search=${encKey}.json`);
      const fb = fbText ? JSON.parse(fbText) : null;
      if (fb && fb.metas && fb.metas.length > 0) {
        const top = fb.metas[0];
        const p = top.poster || (top.id ? `https://images.metahub.space/poster/medium/${top.id}/img` : '');
        if (p) {
          if (card.id) posterCache.set(card.id, p);
          return p;
        }
      }
    } catch (_) {}
  }

  // 3. Fallback to IMDb ID if in href
  const ttMatch = (card.href + ' ' + card.title).match(/(tt\d{5,})/i);
  if (ttMatch) {
    const p = `https://images.metahub.space/poster/medium/${ttMatch[1]}/img`;
    if (card.id) posterCache.set(card.id, p);
    return p;
  }

  return '';
}

/**
 * Parse movie/series cards from HTML
 */
function parseCards(html) {
  const items = [];
  const seenUrls = new Set();

  const cardRegex = /<a[^>]+class="[^"]*item[^"]*"[^>]+href="([^"]*(?:\/film\/|\/dizi\/)[^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = cardRegex.exec(html)) !== null) {
    const rawHref = match[1];
    const attrs = match[2];
    const innerHtml = match[3];

    const cleanHref = rawHref.replace(/#.*$/, '');
    const itemUrl = makeAbsolute(cleanHref, BASE_URL);
    if (!itemUrl || seenUrls.has(itemUrl)) continue;

    if (
      itemUrl.includes('/kategori/') ||
      itemUrl.includes('/tur/') ||
      itemUrl.includes('/ulke/') ||
      itemUrl.includes('/yil/') ||
      itemUrl.includes('/kanal/') ||
      itemUrl.includes('/oyuncular/')
    ) continue;

    seenUrls.add(itemUrl);

    const titleMatch = attrs.match(/data-title="([^"]+)"/i) || innerHtml.match(/alt="([^"]+)"/i);
    let title = cleanText(titleMatch ? titleMatch[1] : '');
    if (!title) {
      const slug = itemUrl.replace(/.*(?:\/film\/|\/dizi\/)/, '').replace(/\/$/, '');
      title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    const imgMatch = innerHtml.match(/<img[^>]+(?:data-src|src)="([^"]+)"/i);
    const rawPoster = imgMatch ? makeAbsolute(imgMatch[1], BASE_URL) : '';

    const isDual = /dual/i.test(innerHtml) || /dual/i.test(attrs);
    const isDub = /dublaj/i.test(innerHtml) || /dublaj/i.test(title);

    const durationMatch = attrs.match(/data-duration="([^"]+)"/i);
    const duration = durationMatch ? parseInt(durationMatch[1], 10) : null;
    const scoreMatch = attrs.match(/data-score="([^"]+)"/i);
    const rating = scoreMatch ? parseFloat(scoreMatch[1]) : null;

    items.push({
      id: itemUrl,
      title: title,
      href: itemUrl,
      url: itemUrl,
      rawPoster: rawPoster,
      image: rawPoster,
      poster: rawPoster,
      coverUrl: rawPoster,
      posterUrl: rawPoster,
      rating: rating,
      duration: duration,
      subAvailable: true,
      dubAvailable: isDual || isDub,
      isSeries: itemUrl.includes('/dizi/'),
      type: itemUrl.includes('/dizi/') ? 'series' : 'movie'
    });
  }

  return items;
}

/**
 * Search results handler
 */
async function searchResults(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim();

  try {
    const searchUrl = `${BASE_URL}/arama/?s=${encodeURIComponent(q)}`;
    const [html, queryMetas] = await Promise.all([
      httpGet(searchUrl, { Referer: BASE_URL + '/' }),
      fetchCinemetaMetas(q)
    ]);

    const results = parseCards(html);

    // Concurrently enrich all search results with unblocked posters
    await Promise.all(results.map(async (item) => {
      const p = await resolveCardPoster(item, queryMetas);
      if (p) {
        item.image = p;
        item.poster = p;
        item.coverUrl = p;
        item.posterUrl = p;
      }
    }));

    const qLower = q.toLowerCase();
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase() === qLower ? 2 : (a.title.toLowerCase().includes(qLower) ? 1 : 0);
      const bExact = b.title.toLowerCase() === qLower ? 2 : (b.title.toLowerCase().includes(qLower) ? 1 : 0);
      return bExact - aExact;
    });

    return results;
  } catch (_) {
    return [];
  }
}

/**
 * Discovery Home handler
 */
async function discoveryHome() {
  try {
    const html = await httpGet(BASE_URL + '/', { Referer: BASE_URL + '/' });
    const allItems = parseCards(html);

    // Enrich top 30 items for discovery home so cards have unblocked posters
    const topItems = allItems.slice(0, 30);
    await Promise.all(topItems.map(async (item) => {
      const p = await resolveCardPoster(item);
      if (p) {
        item.image = p;
        item.poster = p;
        item.coverUrl = p;
        item.backdrop = p;
      }
    }));

    const movies = allItems.filter(i => i.type === 'movie');
    const series = allItems.filter(i => i.type === 'series');

    const sections = [];

    if (movies.length > 0) {
      sections.push({
        id: 'fm-hero',
        title: 'Öne Çıkan Sinema Filmleri',
        style: 'hero',
        items: movies.slice(0, 6),
        viewAll: { mode: 'feed', feedId: 'hero' }
      });

      if (movies.length >= 10) {
        sections.push({
          id: 'fm-top10',
          title: 'Günün En Çok İzlenen 10 İçeriği',
          style: 'top10',
          items: movies.slice(0, 10),
          viewAll: { mode: 'feed', feedId: 'top10' }
        });
      }

      sections.push({
        id: 'fm-movies',
        title: 'Yeni Eklenen Filmler',
        style: 'poster',
        items: movies.slice(0, 24),
        viewAll: { mode: 'feed', feedId: 'movies' }
      });
    }

    if (series.length > 0) {
      sections.push({
        id: 'fm-series',
        title: 'Popüler Yabancı Diziler',
        style: 'poster',
        items: series.slice(0, 24),
        viewAll: { mode: 'feed', feedId: 'series' }
      });
    }

    return { sections };
  } catch (_) {
    return { sections: [] };
  }
}

/**
 * Discovery Feed handler
 */
async function discoveryFeed(feedId, page = 1) {
  try {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const home = await discoveryHome();
    const sections = Array.isArray(home && home.sections) ? home.sections : [];
    const id = String(feedId || '').toLowerCase();
    const section = sections.find(s => s.id === id || s.id.includes(id)) || sections[0];
    const items = section ? section.items : [];
    return {
      items: items,
      page: p,
      hasMore: false
    };
  } catch (_) {
    return { items: [], page: 1, hasMore: false };
  }
}

globalThis.searchResults = searchResults;
globalThis.extractDetails = extractDetails;
globalThis.extractEpisodes = extractEpisodes;
globalThis.extractStreamUrl = extractStreamUrl;
globalThis.extractSubtitles = extractSubtitles;
globalThis.discoveryHome = discoveryHome;
globalThis.discoveryFeed = discoveryFeed;
