/**
 * HDFilmizle Movies & Series Module - Synthetiq Player
 * Target: HDFilmizle (https://www.hdfilmizle.live)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Dedicated Original English Audio (Altyazılı) & Turkish Dubbed (Dublaj) streams
 *   - Vidrame multi-track HLS (1080p, 720p, 480p)
 *   - Full Movie & Multi-Season Series extraction
 */

const BASE_URL = 'https://www.hdfilmizle.live';

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

function makeAbsolute(path, base = BASE_URL) {
  if (!path) return '';
  const trimmed = String(path).trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('//')) return 'https:' + trimmed;
  const cleanBase = base.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? cleanBase + trimmed : cleanBase + '/' + trimmed;
}

function decodeVidrame(d, k) {
  let o = '';
  for (let i = 0; i < d.length; i++) {
    o += String.fromCharCode(d[i] ^ k.charCodeAt(i % k.length) ^ ((i * 17 + 13) & 255));
  }
  return o;
}

async function httpGet(url, customHeaders = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': BASE_URL + '/',
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

  return text || '';
}

async function httpPost(url, body, customHeaders = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': BASE_URL + '/',
    ...customHeaders
  };

  let res;
  if (typeof fetchv2 === 'function') {
    res = await fetchv2(url, headers, 'POST', body, { timeoutMs: 25000 });
  } else {
    res = await fetch(url, { method: 'POST', headers, body });
  }

  let text = '';
  if (res && typeof res.text === 'function') {
    try { text = await res.text(); } catch (_) {}
  } else if (res && typeof res.body === 'string') {
    text = res.body;
  } else if (res && res.body != null) {
    text = String(res.body);
  }

  return text || '';
}

/**
 * Search results handler
 */
async function searchResults(query) {
  try {
    const raw = await httpPost(`${BASE_URL}/search/`, `query=${encodeURIComponent(query)}`);
    if (!raw) return [];
    let list = [];
    try {
      list = JSON.parse(raw);
    } catch (_) {
      return [];
    }
    if (!Array.isArray(list)) return [];

    return list.map(item => {
      const isSeries = item.type === 'dizi';
      const itemUrl = isSeries
        ? `${BASE_URL}/dizi/${item.slug}/`
        : `${BASE_URL}/${item.slug}/`;
      const cover = item.thumb_url ? makeAbsolute(item.thumb_url) : '';
      return {
        id: itemUrl,
        title: cleanText(item.name),
        url: itemUrl,
        href: itemUrl,
        image: cover,
        poster: cover,
        coverUrl: cover,
        isSeries: isSeries,
        type: isSeries ? 'series' : 'movie',
        year: item.year ? parseInt(item.year, 10) : undefined,
        rating: item.imdb_rating ? parseFloat(item.imdb_rating) : undefined
      };
    });
  } catch (err) {
    return [];
  }
}

/**
 * Extract item details
 */
async function extractDetails(targetUrl) {
  try {
    const html = await httpGet(targetUrl);
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch ? cleanText(titleMatch[1]) : 'Video';
    const descMatch = html.match(/<div[^>]+class="[^"]*(?:film-ozeti|description|story)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i);
    const description = descMatch ? cleanText(descMatch[1]) : '';
    const imgMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
                     html.match(/<img[^>]+class="[^"]*poster[^"]*"[^>]+src="([^"]+)"/i);
    const poster = imgMatch ? makeAbsolute(imgMatch[1]) : '';

    return {
      id: targetUrl,
      title: title,
      url: targetUrl,
      href: targetUrl,
      image: poster,
      poster: poster,
      coverUrl: poster,
      description: description,
      plot: description
    };
  } catch (err) {
    return {
      id: targetUrl,
      title: 'Video',
      url: targetUrl,
      href: targetUrl
    };
  }
}

/**
 * Extract episodes (Movies return 1 item, series return full list)
 */
async function extractEpisodes(itemUrl) {
  try {
    const isSeries = itemUrl.includes('/dizi/');
    if (!isSeries) {
      return [{
        id: itemUrl,
        title: 'Full Movie',
        seasonNumber: 1,
        episodeNumber: 1,
        season: 1,
        episode: 1,
        url: itemUrl,
        href: itemUrl
      }];
    }

    const html = await httpGet(itemUrl);
    const episodes = [];
    const epRegex = /href="(\/dizi\/[^"']+\/sezon-([0-9]+)\/bolum-([0-9]+)\/)"/gi;
    let m;
    const seen = new Set();
    while ((m = epRegex.exec(html)) !== null) {
      const epUrl = makeAbsolute(m[1]);
      const season = parseInt(m[2], 10);
      const episode = parseInt(m[3], 10);
      if (seen.has(epUrl)) continue;
      seen.add(epUrl);
      episodes.push({
        id: epUrl,
        title: `Sezon ${season} Bölüm ${episode}`,
        seasonNumber: season,
        episodeNumber: episode,
        season: season,
        episode: episode,
        url: epUrl,
        href: epUrl
      });
    }

    episodes.sort((a, b) => (a.seasonNumber - b.seasonNumber) || (a.episodeNumber - b.episodeNumber));
    if (!episodes.length) {
      episodes.push({
        id: itemUrl,
        title: 'Episode 1',
        seasonNumber: 1,
        episodeNumber: 1,
        season: 1,
        episode: 1,
        url: itemUrl,
        href: itemUrl
      });
    }
    return episodes;
  } catch (err) {
    return [{
      id: itemUrl,
      title: 'Episode 1',
      seasonNumber: 1,
      episodeNumber: 1,
      season: 1,
      episode: 1,
      url: itemUrl,
      href: itemUrl
    }];
  }
}

/**
 * Extract video stream
 */
async function extractStreamUrl(watchUrl, extra = 'sub') {
  const want = String(extra || 'sub').toLowerCase();
  try {
    const html = await httpGet(watchUrl);
    const partsMatch = html.match(/let parts = (\[[\s\S]*?\]);/);
    if (!partsMatch) throw new Error('Player parts not found');
    const parts = JSON.parse(partsMatch[1]);
    if (!parts.length) throw new Error('No video parts available');

    let chosenPart = parts.find(p => p.name === 'Vidrame');
    if (!chosenPart) chosenPart = parts[0];

    const iframeSrcMatch = chosenPart.data.match(/src="([^"]+)"/);
    if (!iframeSrcMatch) throw new Error('Iframe source not found in part');
    const iframeUrl = makeAbsolute(iframeSrcMatch[1]);

    const vrHtml = await httpGet(iframeUrl, { Referer: BASE_URL + '/' });

    const xorMatch = vrHtml.match(/file:\s*\(function[\s\S]*?\)\((\[[0-9,\s]+\]),\s*"([^"]+)"\)/i);
    let masterUrl = '';
    if (xorMatch) {
      const bytes = JSON.parse(xorMatch[1]);
      const key = xorMatch[2];
      masterUrl = decodeVidrame(bytes, key);
    } else {
      const getMatch = vrHtml.match(/https?:\/\/[^"'\s]+\/vr\/get\/[a-zA-Z0-9]+\/master\.txt/);
      if (getMatch) masterUrl = getMatch[0];
    }

    if (!masterUrl) throw new Error('Vidrame master playlist not resolved');

    const streamPrefix = (want === 'dub') ? 'dub ' : 'sub ';
    const label = want === 'dub' ? 'Vidrame · Türkçe Dublaj' : 'Vidrame · Orijinal Dil (Altyazılı)';

    return {
      url: masterUrl,
      streams: [streamPrefix + '1080p', masterUrl],
      streamType: 'hls',
      lang: want === 'dub' ? 'dub' : 'sub',
      quality: '1080p',
      defaultQuality: '1080p',
      servers: [{
        name: 'Vidrame',
        label: label,
        audioLanguage: want === 'dub' ? 'tr' : 'en',
        audioLanguages: ['tr', 'en'],
        qualities: [{ label: '1080p', url: masterUrl, headers: { Referer: 'https://vidrame.live/' } }],
        subtitles: [{ language: 'tr', label: 'Türkçe Altyazı', default: want === 'sub' }]
      }],
      subtitles: [{ language: 'tr', label: 'Türkçe Altyazı', default: want === 'sub' }],
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://vidrame.live/'
      }
    };
  } catch (err) {
    return {
      url: watchUrl,
      streams: ['Source', watchUrl],
      headers: {},
      streamType: 'hls',
      lang: want === 'dub' ? 'dub' : 'sub',
      quality: '1080p',
      defaultQuality: '1080p',
      subtitles: [],
      servers: []
    };
  }
}

/**
 * Discovery Home handler
 */
async function discoveryHome() {
  try {
    const html = await httpGet(BASE_URL + '/');
    const sections = [];
    const cardRegex = /<a[^>]+href="(\/(?:dizi\/)?[^"#?\/]+\/)"[^>]*>([\s\S]*?)<\/a>/gi;
    const items = [];
    const seen = new Set();
    let m;
    while ((m = cardRegex.exec(html)) !== null) {
      const slug = m[1];
      if (slug.includes('/kategori/') || slug.includes('/tur/') || slug.includes('/iletisim/')) continue;
      const fullUrl = makeAbsolute(slug);
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);
      const block = m[2];
      const imgMatch = block.match(/src="([^"]+)"/i);
      const titleMatch = block.match(/class="[^"]*(?:title|name)[^"]*"[^>]*>([\s\S]*?)<\//i);
      const title = titleMatch ? cleanText(titleMatch[1]) : '';
      if (!title) continue;
      const cover = imgMatch ? makeAbsolute(imgMatch[1]) : '';
      items.push({
        id: fullUrl,
        title: title,
        url: fullUrl,
        href: fullUrl,
        image: cover,
        poster: cover,
        coverUrl: cover
      });
      if (items.length >= 30) break;
    }

    if (items.length > 0) {
      sections.push({
        id: 'hdfilmizle_featured',
        title: 'Öne Çıkan Filmler & Diziler',
        type: 'featured',
        items: items
      });
    }

    return sections;
  } catch (err) {
    return [];
  }
}

/**
 * Discovery Feed handler
 */
async function discoveryFeed(feedId, page = 1) {
  try {
    const home = await discoveryHome();
    const section = home.find(s => s.id === feedId) || home[0];
    return section ? section.items : [];
  } catch (err) {
    return [];
  }
}

// Module Exports
globalThis.searchResults = searchResults;
globalThis.extractDetails = extractDetails;
globalThis.extractEpisodes = extractEpisodes;
globalThis.extractStreamUrl = extractStreamUrl;
globalThis.discoveryHome = discoveryHome;
globalThis.discoveryFeed = discoveryFeed;
