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
 *   - High-res Metahub posters via IMDb ID detection
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
      image: rawPoster,
      poster: rawPoster,
      coverUrl: rawPoster,
      rating: rating,
      duration: duration,
      subAvailable: true,
      dubAvailable: isDual || isDub,
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
    const html = await httpGet(searchUrl, { Referer: BASE_URL + '/' });
    const results = parseCards(html);

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

    const movies = allItems.filter(i => i.type === 'movie');
    const series = allItems.filter(i => i.type === 'series');

    const sections = [];

    if (movies.length > 0) {
      sections.push({
        title: 'Öne Çıkan Filmler',
        items: movies.slice(0, 18)
      });
      if (movies.length > 18) {
        sections.push({
          title: 'Yeni Eklenenler',
          items: movies.slice(18, 36)
        });
      }
    }

    if (series.length > 0) {
      sections.push({
        title: 'Popüler Yabancı Diziler',
        items: series.slice(0, 18)
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
async function discoveryFeed(page = 1) {
  try {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const feedUrl = p === 1 ? `${BASE_URL}/filmler-1/` : `${BASE_URL}/filmler-1/page/${p}/`;
    const html = await httpGet(feedUrl, { Referer: BASE_URL + '/' });
    return parseCards(html);
  } catch (_) {
    return [];
  }
}

/**
 * Extract item details handler
 */
async function extractDetails(targetUrl) {
  try {
    const cleanUrl = String(targetUrl || '').replace(/#.*$/, '');
    const html = await httpGet(cleanUrl, { Referer: BASE_URL + '/' });

    // Title
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<meta property="og:title" content="([^"]+)"/i);
    let title = cleanText(titleMatch ? titleMatch[1] : '');
    title = title.replace(/\s+(?:izle|Full HD izle)$/i, '').trim();

    // Check IMDb ID for high-res Metahub poster
    const imdbMatch = html.match(/data-id="(tt\d+)"/i) || html.match(/[?&]imdb_id=(tt\d+)/i);
    let poster = '';
    let backdrop = '';
    if (imdbMatch) {
      const tt = imdbMatch[1];
      poster = `https://images.metahub.space/poster/medium/${tt}/img`;
      backdrop = `https://images.metahub.space/background/medium/${tt}/img`;
    } else {
      const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i) ||
                       html.match(/<img[^>]+class="[^"]*thumbnail[^"]*"[^>]+src="([^"]+)"/i);
      poster = imgMatch ? makeAbsolute(imgMatch[1], BASE_URL) : '';
    }

    // Official movie description (schema.org or og:description, NOT footer text)
    const schemaDescMatch = html.match(/"description"\s*:\s*"([^"]+)"/);
    const ogDescMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    let description = cleanText(schemaDescMatch ? schemaDescMatch[1] : (ogDescMatch ? ogDescMatch[1] : ''));
    if (description.includes('Tecrübeli çeviri')) description = '';

    // Duration & Rating
    const durMatch = html.match(/data-duration="([^"]+)"/i) || html.match(/(\d+)\s*Dakika/i);
    const duration = durMatch ? parseInt(durMatch[1], 10) : null;
    const scoreMatch = html.match(/data-star="([^"]+)"/i) || html.match(/class="rating"[^>]*>([\s\S]*?)<\/div>/i);
    let rating = null;
    if (scoreMatch) {
      const parsed = parseFloat(cleanText(scoreMatch[1]));
      if (!isNaN(parsed)) rating = parsed;
    }

    // Cast / Actors
    const actors = [];
    const actorMatches = [...html.matchAll(/<(?:span|div|a)[^>]*class="[^"]*(?:item-title|actor|oyuncu)[^"]*"[^>]*>([^<]+)<\/(?:span|div|a)>/gi)];
    actorMatches.forEach(m => {
      const name = cleanText(m[1]);
      if (name && name.length > 2 && !actors.includes(name) && !/kadro|göster|tüm/i.test(name)) {
        actors.push(name);
      }
    });

    const isDual = /dual/i.test(html);
    const isDub = /dublaj/i.test(html) || /dublaj/i.test(title);

    return {
      id: cleanUrl,
      title: title,
      description: description,
      summary: description,
      image: poster,
      poster: poster,
      coverUrl: poster,
      backdropUrl: backdrop || undefined,
      rating: rating,
      duration: duration,
      actors: actors,
      subAvailable: true,
      dubAvailable: isDual || isDub,
      type: cleanUrl.includes('/dizi/') ? 'series' : 'movie'
    };
  } catch (err) {
    return {
      id: targetUrl,
      title: 'FilmMakinesi Content',
      url: targetUrl,
      subAvailable: true,
      dubAvailable: true
    };
  }
}

/**
 * Extract episodes handler
 */
async function extractEpisodes(targetUrl) {
  try {
    const cleanUrl = String(targetUrl || '').replace(/#.*$/, '');
    const html = await httpGet(cleanUrl, { Referer: BASE_URL + '/' });

    // If it's a TV series, check for episode links
    if (cleanUrl.includes('/dizi/')) {
      const epMatches = [...html.matchAll(/<a[^>]+href="([^"]*(?:\/sezon-[0-9]+|\/bolum-[0-9]+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
      const episodes = [];
      const seen = new Set();

      for (const m of epMatches) {
        const epClean = m[1].replace(/#.*$/, '');
        const epUrl = makeAbsolute(epClean, BASE_URL);
        if (seen.has(epUrl)) continue;
        seen.add(epUrl);

        const sMatch = epUrl.match(/sezon-(\d+)/i);
        const eMatch = epUrl.match(/bolum-(\d+)/i);
        const sNum = sMatch ? parseInt(sMatch[1], 10) : 1;
        const eNum = eMatch ? parseInt(eMatch[1], 10) : (episodes.length + 1);

        const epTitle = cleanText(m[2]) || `${sNum}. Sezon ${eNum}. Bölüm`;

        episodes.push({
          id: epUrl,
          title: epTitle,
          url: epUrl,
          href: epUrl,
          season: sNum,
          episode: eNum,
          seasonNumber: sNum,
          episodeNumber: eNum,
          number: eNum,
          subAvailable: true,
          dubAvailable: true
        });
      }

      if (episodes.length > 0) {
        return episodes;
      }
    }

    // Default movie: Single full-feature episode
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = cleanText(titleMatch ? titleMatch[1] : 'Full Film');

    return [
      {
        id: cleanUrl,
        title: title,
        url: cleanUrl,
        href: cleanUrl,
        season: 1,
        episode: 1,
        seasonNumber: 1,
        episodeNumber: 1,
        number: 1,
        subAvailable: true,
        dubAvailable: true
      }
    ];
  } catch (_) {
    const cleanUrl = String(targetUrl || '').replace(/#.*$/, '');
    return [
      {
        id: cleanUrl,
        title: 'Full Film',
        url: cleanUrl,
        href: cleanUrl,
        season: 1,
        episode: 1,
        seasonNumber: 1,
        episodeNumber: 1,
        number: 1,
        subAvailable: true,
        dubAvailable: true
      }
    ];
  }
}

/**
 * Extract video stream handler with isolated Audio & Subtitles support
 */
async function extractStreamUrl(targetUrl, lang) {
  try {
    const cleanUrl = String(targetUrl || '').replace(/#.*$/, '');
    const want = String(lang || 'sub').trim().toLowerCase() === 'dub' ? 'dub' : 'sub';
    const html = await httpGet(cleanUrl, { Referer: BASE_URL + '/' });

    // Collect embed URLs from player tabs and iframes
    let rapidEmbedUrl = '';
    let closeLoadEmbedUrl = '';

    const tabMatches = [...html.matchAll(/data-video_url="([^"]+)"/gi)];
    for (const tm of tabMatches) {
      const u = tm[1];
      if (u.includes('rapid') && !rapidEmbedUrl) rapidEmbedUrl = u;
      else if (u.includes('closeload') && !closeLoadEmbedUrl) closeLoadEmbedUrl = u;
    }

    if (!rapidEmbedUrl && !closeLoadEmbedUrl) {
      const iframes = [...html.matchAll(/<iframe[^>]+(?:data-src|src)="([^"]+)"/gi)];
      for (const im of iframes) {
        const u = im[1];
        if (u.includes('rapid') && !rapidEmbedUrl) rapidEmbedUrl = u;
        else if (u.includes('closeload') && !closeLoadEmbedUrl) closeLoadEmbedUrl = u;
      }
    }

    const subtitles = [];
    const seenSubUrls = new Set();
    let totalInlinedChars = 0;
    const MAX_INLINE_BUDGET = 350000;

    async function addSub(subUrl, label, language, isDefault, referer) {
      if (!subUrl || seenSubUrls.has(subUrl)) return;
      seenSubUrls.add(subUrl);

      let vttContent = '';
      if (totalInlinedChars < MAX_INLINE_BUDGET) {
        try {
          vttContent = await httpGet(subUrl, { Referer: referer });
          if (vttContent && vttContent.includes('WEBVTT')) {
            totalInlinedChars += vttContent.length;
          } else {
            vttContent = '';
          }
        } catch (_) {}
      }

      subtitles.push({
        id: subUrl,
        url: subUrl,
        file: subUrl,
        label: label,
        language: language,
        lang: language,
        kind: 'captions',
        default: isDefault,
        content: vttContent || undefined,
        headers: { Referer: referer }
      });
    }

    let rapidStreamUrl = '';
    let rapidSubUrl = '';
    let rapidDubUrl = '';

    // Process Rapid embed
    if (rapidEmbedUrl) {
      try {
        const rHostname = getHostname(rapidEmbedUrl);
        const rHtml = await httpGet(rapidEmbedUrl, { Referer: BASE_URL + '/' });
        const masterUrl = decodeEmbedStream(rHtml, rHostname);

        if (masterUrl) {
          rapidStreamUrl = masterUrl;

          const baseMasterDir = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
          const masterQuery = masterUrl.includes('?') ? masterUrl.substring(masterUrl.indexOf('?')) : '';

          rapidDubUrl = `${baseMasterDir}index-f2-v1-a1.m3u8${masterQuery}`;
          rapidSubUrl = `${baseMasterDir}index-f2-v1-a2.m3u8${masterQuery}`;

          const tracksMatch = rHtml.match(/tracks\s*:\s*(\[[^\]]+\])/);
          if (tracksMatch) {
            try {
              const tracks = JSON.parse(tracksMatch[1]);
              for (const tr of tracks) {
                if (tr && tr.file && tr.file.includes('.vtt')) {
                  const fullSubUrl = makeAbsolute(tr.file, `https://${rHostname}`);
                  const label = tr.label || 'Türkçe Altyazı';
                  const isTr = /türk|tur|tr/i.test(label) || tr.language === 'tr';
                  await addSub(fullSubUrl, label, isTr ? 'tr' : (tr.language || 'en'), isTr, `https://${rHostname}/`);
                }
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    let closeLoadStreamUrl = '';

    // Process CloseLoad embed
    if (closeLoadEmbedUrl) {
      try {
        const cHostname = getHostname(closeLoadEmbedUrl);
        const cHtml = await httpGet(closeLoadEmbedUrl, { Referer: BASE_URL + '/' });
        const streamUrl = decodeEmbedStream(cHtml, cHostname);

        if (streamUrl) {
          closeLoadStreamUrl = streamUrl;

          const tracksMatch = cHtml.match(/tracks\s*:\s*(\[[^\]]+\])/);
          if (tracksMatch) {
            try {
              const tracks = JSON.parse(tracksMatch[1]);
              for (const tr of tracks) {
                if (tr && tr.file && tr.file.includes('.vtt')) {
                  const fullSubUrl = makeAbsolute(tr.file, `https://${cHostname}`);
                  const label = tr.label || 'Türkçe Altyazı';
                  const isTr = /türk|tur|tr/i.test(label) || tr.language === 'tr';
                  await addSub(fullSubUrl, label, isTr ? 'tr' : (tr.language || 'en'), isTr, `https://${cHostname}/`);
                }
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    // Determine primary stream based on requested audio (sub vs dub)
    let selectedUrl = '';
    let streamLabel = '';

    if (want === 'sub') {
      if (rapidSubUrl) {
        selectedUrl = rapidSubUrl;
        streamLabel = 'sub 1080p';
      } else if (closeLoadStreamUrl) {
        selectedUrl = closeLoadStreamUrl;
        streamLabel = 'sub Auto';
      } else if (rapidStreamUrl) {
        selectedUrl = rapidStreamUrl;
        streamLabel = 'sub 1080p';
      }
    } else {
      if (rapidDubUrl) {
        selectedUrl = rapidDubUrl;
        streamLabel = 'dub 1080p';
      } else if (closeLoadStreamUrl) {
        selectedUrl = closeLoadStreamUrl;
        streamLabel = 'dub Auto';
      } else if (rapidStreamUrl) {
        selectedUrl = rapidStreamUrl;
        streamLabel = 'dub 1080p';
      }
    }

    if (!selectedUrl) {
      throw new Error(`Failed to extract playable stream for ${cleanUrl}`);
    }

    // Build servers list
    const servers = [];

    if (rapidStreamUrl) {
      const rUrl = want === 'sub' ? rapidSubUrl : rapidDubUrl;
      servers.push({
        name: `Rapid (${want.toUpperCase()})`,
        label: `Rapid 1080p · ${want === 'dub' ? 'Türkçe Dublaj' : 'Orijinal Ses + Türkçe Altyazı'}`,
        url: rUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://rapid.filmmakinesi.to/'
        },
        streamType: 'hls',
        lang: want,
        audioLanguage: want === 'dub' ? 'tr' : 'en',
        audioLanguages: ['tr', 'en'],
        quality: '1080p',
        qualities: [
          { label: '1080p', url: rUrl, headers: { Referer: 'https://rapid.filmmakinesi.to/' } }
        ]
      });
    }

    if (closeLoadStreamUrl) {
      servers.push({
        name: `CloseLoad (${want.toUpperCase()})`,
        label: `CloseLoad · ${want === 'dub' ? 'Türkçe Dublaj' : 'Dual Audio (TR Dub / EN Sub)'}`,
        url: closeLoadStreamUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://closeload.filmmakinesi.to/'
        },
        streamType: 'hls',
        lang: want,
        audioLanguage: want === 'dub' ? 'tr' : 'en',
        audioLanguages: ['tr', 'en'],
        quality: 'Auto',
        qualities: [
          { label: 'Auto', url: closeLoadStreamUrl, headers: { Referer: 'https://closeload.filmmakinesi.to/' } }
        ]
      });
    }

    // Sort subtitles so Turkish is always primary, and set default flag accordingly
    subtitles.sort((a, b) => {
      const aTr = a.language === 'tr' ? 1 : 0;
      const bTr = b.language === 'tr' ? 1 : 0;
      return bTr - aTr;
    });

    if (subtitles.length > 0 && want === 'sub') {
      subtitles.forEach((s, idx) => {
        s.default = idx === 0 && s.language === 'tr';
      });
    }

    return {
      url: selectedUrl,
      streams: [streamLabel, selectedUrl],
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': BASE_URL + '/'
      },
      streamType: 'hls',
      lang: want,
      quality: '1080p',
      defaultQuality: '1080p',
      qualities: [
        { label: '1080p', url: selectedUrl, headers: { Referer: BASE_URL + '/' } }
      ],
      subtitles: subtitles,
      captions: subtitles,
      servers: servers
    };
  } catch (err) {
    return {
      url: targetUrl,
      streams: [],
      subtitles: [],
      error: { message: err ? err.message : 'FilmMakinesi stream extraction failed' }
    };
  }
}

/**
 * Dedicated Subtitles extractor
 */
async function extractSubtitles(episodeUrl) {
  try {
    const stream = await extractStreamUrl(episodeUrl, 'sub');
    return stream.subtitles || [];
  } catch (_) {
    return [];
  }
}

// Module Exports
globalThis.searchResults = searchResults;
globalThis.extractDetails = extractDetails;
globalThis.extractEpisodes = extractEpisodes;
globalThis.extractStreamUrl = extractStreamUrl;
globalThis.extractSubtitles = extractSubtitles;
globalThis.discoveryHome = discoveryHome;
globalThis.discoveryFeed = discoveryFeed;
