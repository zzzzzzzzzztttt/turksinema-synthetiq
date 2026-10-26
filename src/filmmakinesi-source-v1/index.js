/**
 * FilmMakinesi Video Source Module - Synthetiq Player
 * Target: FilmMakinesi (https://filmmakinesi.to)
 * Contract Version 3 | contentType: video
 * Features:
 *   - 1080p Full HD Turkish & Hollywood Movies & Series
 *   - Dedicated Subtitled (Original Audio + Turkish CC) via Rapid a2 variant stream
 *   - Dedicated Dubbed (Turkish Audio) via Rapid a1 variant and CloseLoad streams
 *   - Native Audio & Subtitles switcher integration for Synthetiq Player
 *   - Inlined WebVTT subtitles to prevent iOS AVPlayer 403 blocks
 *   - Pure JavaScript unpacking & deobfuscation (Dean Edwards unpacker + hostname cipher)
 */

const BASE_URL = 'https://filmmakinesi.to';

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
 * Dean Edwards JS unpacker implementation for packed scripts
 */
function unpackDeanEdwards(script) {
  let out = '';
  let cur = 0;
  while (cur < script.length) {
    const idx = script.indexOf('eval(function(p,a,c,k,e,d)', cur);
    if (idx === -1) {
      out += script.slice(cur);
      break;
    }
    out += script.slice(cur, idx);
    let depth = 0;
    let end = -1;
    for (let i = idx + 4; i < script.length; i++) {
      if (script[i] === '(') depth++;
      else if (script[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== -1) {
      const code = script.slice(idx + 5, end);
      try {
        const fn = new Function('return (' + code + ')');
        out += fn();
      } catch (_) {
        out += script.slice(idx, end + 1);
      }
      cur = end + 1;
    } else {
      out += script.slice(idx);
      break;
    }
  }
  return out;
}

/**
 * Generic deobfuscator for FilmMakinesi internal embeds (CloseLoad & Rapid)
 */
function decodeEmbedStream(html, hostname) {
  const cleanHtml = html.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const jwMatch = cleanHtml.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*([a-zA-Z0-9_$]+)/);
  const targetVar = jwMatch ? jwMatch[1] : null;

  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const processedScripts = scripts.map(s => {
    if (s.includes('eval(function(p,a,c,k,e,d)')) {
      return unpackDeanEdwards(s);
    }
    return s;
  });

  // Strategy 1: If targetVar is identified, locate its definition and execute
  if (targetVar) {
    for (const s of processedScripts) {
      if (s.includes(targetVar + ' =') || s.includes(targetVar + '=')) {
        try {
          const runner = new Function('hostname', `
            const noop = function() { return {}; };
            const self = { location: { hostname: hostname } };
            const document = { location: { hostname: hostname }, addEventListener: noop, querySelector: noop };
            const window = { location: { hostname: hostname }, addEventListener: noop, localStorage: { getItem: noop, setItem: noop } };
            const localStorage = { getItem: noop, setItem: noop };
            ${s}
            return ${targetVar};
          `);
          const res = runner(hostname);
          if (res && typeof res === 'string' && res.startsWith('http')) {
            return res;
          }
        } catch (_) {}
      }
    }
  }

  // Strategy 2: Search for decoder pattern: var <varName> = <funcName>("...".split("..."));
  for (const s of processedScripts) {
    const match = s.match(/(var\s+([a-zA-Z0-9_$]+)\s*=\s*([a-zA-Z0-9_$]+)\s*\(\s*["'][^"']+["']\.split\([^)]+\)\s*\)\s*;)/);
    if (match) {
      const varName = match[2];
      const funcName = match[3];
      const funcIdx = s.lastIndexOf('var ' + funcName + '=', match.index);
      if (funcIdx !== -1) {
        const funcDef = s.slice(funcIdx, match.index);
        try {
          const runner = new Function('hostname', `
            const self = { location: { hostname: hostname } };
            const document = { location: { hostname: hostname } };
            const window = { location: { hostname: hostname } };
            ${funcDef}
            ${match[1]}
            return ${varName};
          `);
          const res = runner(hostname);
          if (res && typeof res === 'string' && res.startsWith('http')) {
            return res;
          }
        } catch (_) {}
      }
    }
  }

  // Strategy 3: Direct HLS or MP4 regex match fallback
  const directMatch = html.match(/(https?:\/\/[^\s"'<>]+\.(?:m3u8|txt)[^\s"'<>]*)/i);
  if (directMatch) {
    return directMatch[1];
  }

  return null;
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

    const itemUrl = makeAbsolute(rawHref, BASE_URL);
    if (!itemUrl || seenUrls.has(itemUrl)) continue;

    // Skip utility and category pages
    if (
      itemUrl.includes('/kategori/') ||
      itemUrl.includes('/tur/') ||
      itemUrl.includes('/ulke/') ||
      itemUrl.includes('/yil/') ||
      itemUrl.includes('/kanal/') ||
      itemUrl.includes('/oyuncular/')
    ) continue;

    seenUrls.add(itemUrl);

    // Parse title from data-title, img alt, or inner text
    const titleMatch = attrs.match(/data-title="([^"]+)"/i) || innerHtml.match(/alt="([^"]+)"/i);
    let title = cleanText(titleMatch ? titleMatch[1] : '');
    if (!title) {
      const slug = itemUrl.replace(/.*(?:\/film\/|\/dizi\/)/, '').replace(/\/$/, '');
      title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // Parse image
    const imgMatch = innerHtml.match(/<img[^>]+(?:data-src|src)="([^"]+)"/i);
    const poster = imgMatch ? makeAbsolute(imgMatch[1], BASE_URL) : '';

    // Check Sub & Dub availability
    const isDual = /dual/i.test(innerHtml) || /dual/i.test(attrs);
    const isDub = /dublaj/i.test(innerHtml) || /dublaj/i.test(title);
    const isSub = /altyaz/i.test(innerHtml) || /altyaz/i.test(title) || isDual;

    // Duration & rating
    const durationMatch = attrs.match(/data-duration="([^"]+)"/i);
    const duration = durationMatch ? parseInt(durationMatch[1], 10) : null;
    const scoreMatch = attrs.match(/data-score="([^"]+)"/i);
    const rating = scoreMatch ? parseFloat(scoreMatch[1]) : null;

    items.push({
      id: itemUrl,
      title: title,
      href: itemUrl,
      url: itemUrl,
      image: poster,
      poster: poster,
      coverUrl: poster,
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

    // Sort exact matches to the top
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
    const html = await httpGet(targetUrl, { Referer: BASE_URL + '/' });

    // Title
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<meta property="og:title" content="([^"]+)"/i);
    let title = cleanText(titleMatch ? titleMatch[1] : '');
    title = title.replace(/\s+(?:izle|Full HD izle)$/i, '').trim();

    // Description
    const descMatch = html.match(/<div class="description">([\s\S]*?)<\/div>/i) ||
                      html.match(/<meta property="og:description" content="([^"]+)"/i);
    const description = cleanText(descMatch ? descMatch[1] : '');

    // Poster
    const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i) ||
                     html.match(/<img[^>]+class="[^"]*thumbnail[^"]*"[^>]+src="([^"]+)"/i);
    const poster = imgMatch ? makeAbsolute(imgMatch[1], BASE_URL) : '';

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

    // Check dual audio
    const isDual = /dual/i.test(html);
    const isDub = /dublaj/i.test(html) || /dublaj/i.test(title);

    return {
      id: targetUrl,
      title: title,
      description: description,
      summary: description,
      image: poster,
      poster: poster,
      coverUrl: poster,
      rating: rating,
      duration: duration,
      actors: actors,
      subAvailable: true,
      dubAvailable: isDual || isDub,
      type: targetUrl.includes('/dizi/') ? 'series' : 'movie'
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
    const html = await httpGet(targetUrl, { Referer: BASE_URL + '/' });

    // If it's a TV series, check for episode links
    if (targetUrl.includes('/dizi/')) {
      const epMatches = [...html.matchAll(/<a[^>]+href="([^"]*(?:\/sezon-[0-9]+|\/bolum-[0-9]+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
      const episodes = [];
      const seen = new Set();

      for (const m of epMatches) {
        const epUrl = makeAbsolute(m[1], BASE_URL);
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
        id: targetUrl,
        title: title,
        url: targetUrl,
        href: targetUrl,
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
    return [
      {
        id: targetUrl,
        title: 'Full Film',
        url: targetUrl,
        href: targetUrl,
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
    const want = String(lang || 'sub').trim().toLowerCase() === 'dub' ? 'dub' : 'sub';
    const html = await httpGet(targetUrl, { Referer: BASE_URL + '/' });

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
        const rHostname = new URL(rapidEmbedUrl).hostname;
        const rHtml = await httpGet(rapidEmbedUrl, { Referer: BASE_URL + '/' });
        const masterUrl = decodeEmbedStream(rHtml, rHostname);

        if (masterUrl) {
          rapidStreamUrl = masterUrl;

          // Check if Rapid master.m3u8 has isolated audio variants (a1 = Turkish, a2 = English)
          // index-f2-v1-a1.m3u8 (1080p Dub) vs index-f2-v1-a2.m3u8 (1080p Sub / Original Audio)
          const baseMasterDir = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
          const masterQuery = masterUrl.includes('?') ? masterUrl.substring(masterUrl.indexOf('?')) : '';

          rapidDubUrl = `${baseMasterDir}index-f2-v1-a1.m3u8${masterQuery}`;
          rapidSubUrl = `${baseMasterDir}index-f2-v1-a2.m3u8${masterQuery}`;

          // Extract subtitles from Rapid embed HTML
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
        const cHostname = new URL(closeLoadEmbedUrl).hostname;
        const cHtml = await httpGet(closeLoadEmbedUrl, { Referer: BASE_URL + '/' });
        const streamUrl = decodeEmbedStream(cHtml, cHostname);

        if (streamUrl) {
          closeLoadStreamUrl = streamUrl;

          // Extract subtitles from CloseLoad embed HTML
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
      // Subtitled: Prefer Rapid isolated English Audio stream (a2)
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
      // Dubbed: Prefer Rapid Turkish Dub (a1) or CloseLoad
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
      throw new Error(`Failed to extract playable stream for ${targetUrl}`);
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
