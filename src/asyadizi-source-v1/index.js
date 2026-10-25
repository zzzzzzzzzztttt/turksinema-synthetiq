/**
 * AsyaDizi Source Module - Synthetiq Player
 * Target: AsyaDizi (https://asyadizi.com)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Comprehensive Korean (K-Drama), Chinese (C-Drama) & Japanese Asian drama catalogue
 *   - Full title alias search matching (English, Turkish, Romanized)
 *   - Direct multi-server playback:
 *       * OK.ru: Adaptive master HLS (.m3u8) streams & direct 1080p/720p MP4
 *       * Mail.ru: Direct 720p/480p MP4 video streams
 *       * VidMoly: Fast adaptive HLS (.m3u8) streams
 *   - Automatic multi-kaynak (Kaynak 1..4) fallback resolution
 *   - 100% iOS JavaScriptCore safe (zero Buffer/atob/URLSearchParams dependencies)
 */

const BASE_URL = 'https://asyadizi.com';

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

function resolvePageUrl(input) {
  if (!input) return '';
  if (typeof input === 'object' && input !== null) {
    input = input.url || input.id || input.href || input.targetUrl || input.pageUrl || input.link || '';
  }
  const str = String(input).trim();
  if (!str) return '';
  return makeAbsolute(str);
}

/**
 * Universal response body unpacker for iOS fetchv2 and standard fetch
 */
async function readResponseBody(res) {
  if (!res) return '';
  if (typeof res === 'string') return res;
  if (typeof res.body === 'string' && res.body) return res.body;
  if (typeof res.response === 'string' && res.response) return res.response;
  if (typeof res.data === 'string' && res.data) return res.data;
  if (res.data != null && typeof res.data === 'object') {
    try { return JSON.stringify(res.data); } catch (_) {}
  }
  if (typeof res.text === 'function') {
    try {
      const t = await res.text();
      if (typeof t === 'string' && t) return t;
    } catch (_) {}
  }
  if (res.json != null) {
    try {
      const v = typeof res.json === 'function' ? await res.json() : res.json;
      if (v != null) return typeof v === 'string' ? v : JSON.stringify(v);
    } catch (_) {}
  }
  return '';
}

/**
 * Universal HTTP GET supporting iOS Synthetiq fetchv2 and standard fetch
 */
async function httpGet(url, customHeaders = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
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

  return await readResponseBody(res);
}

const TITLE_ALIASES = {
  'the glory': 'the glory',
  'glory': 'the glory',
  'my name': 'my name',
  'undercover': 'my name',
  'a killer paradox': 'a killer paradox',
  'killer paradox': 'a killer paradox',
  'katil paradoksu': 'a killer paradox',
  'alchemy of souls': 'alchemy of souls',
  'alchemy of souls light and shadow': 'alchemy of souls',
  'ruhlarin simyasi': 'alchemy of souls',
  'love between fairy and devil': 'love between fairy and devil',
  'fairy and devil': 'love between fairy and devil',
  'cang lan jue': 'love between fairy and devil',
  'mr queen': 'mr. queen',
  'squid game': 'squid game',
  'all of us are dead': 'all of us are dead',
  'crash landing on you': 'crash landing on you',
  'goblin': 'goblin',
  'hotel del luna': 'hotel del luna',
  'vincenzo': 'vincenzo',
  'itaewon class': 'itaewon class',
  'true beauty': 'true beauty',
  'strong girl bong-soon': 'strong woman do bong soon',
  'weightlifting fairy': 'weightlifting fairy kim bok joo',
  'descendants of the sun': 'descendants of the sun',
  'business proposal': 'a business proposal',
  'sweet home': 'sweet home'
};

/**
 * Search results handler
 */
async function searchResults(query) {
  try {
    const raw = String(query || '').trim();
    if (!raw) return [];

    const norm = raw.toLowerCase().replace(/['"’]/g, '');
    const mapped = TITLE_ALIASES[norm] || raw;

    const url = `${BASE_URL}/?s=${encodeURIComponent(mapped)}`;
    const html = await httpGet(url);
    if (!html) return [];

    const items = [];
    const seen = new Set();

    // Strategy 1: Parse single-item card containers
    const cardMatches = html.matchAll(/<div class="single-item">([\s\S]*?)<\/div>\s*<\/div>/gi);
    for (const cm of cardMatches) {
      const block = cm[1];

      const linkM = block.match(/<a[^>]+href=["'](https:\/\/asyadizi\.com\/dizi\/[^"']+)["'][^>]*>/i);
      if (!linkM) continue;
      const itemUrl = linkM[1];
      if (seen.has(itemUrl)) continue;

      const titleM = block.match(/<div class="categorytitle">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
                     block.match(/<a[^>]+href=["'][^"']*\/dizi\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
      const title = titleM ? cleanText(titleM[1]) : 'Asya Dizi';

      const imgM = block.match(/<img[^>]+src=["']([^"']+)["']/i);
      const poster = imgM ? makeAbsolute(imgM[1]) : '';

      const imdbM = block.match(/class="imdbp">[\s\S]*?([\d\.]+)/i);
      const rating = imdbM ? parseFloat(imdbM[1]) : null;

      const yearM = title.match(/\b(19\d{2}|20\d{2})\b/) || itemUrl.match(/-(19\d{2}|20\d{2})-/);
      const year = yearM ? parseInt(yearM[1], 10) : null;

      seen.add(itemUrl);
      items.push({
        id: itemUrl,
        title,
        url: itemUrl,
        href: itemUrl,
        image: poster,
        posterUrl: poster,
        poster: poster,
        year,
        rating,
        type: 'tv',
        isSeries: true
      });
    }

    // Strategy 2: Link fallback if single-item container wasn't matched
    if (items.length === 0) {
      const generalMatches = html.matchAll(/<a[^>]+href=["'](https:\/\/asyadizi\.com\/dizi\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
      for (const gm of generalMatches) {
        const itemUrl = gm[1];
        if (seen.has(itemUrl)) continue;
        const text = cleanText(gm[2]);
        if (!text) continue;

        seen.add(itemUrl);
        items.push({
          id: itemUrl,
          title: text,
          url: itemUrl,
          href: itemUrl,
          image: '',
          posterUrl: '',
          type: 'tv',
          isSeries: true
        });
      }
    }

    return items;
  } catch (_) {
    return [];
  }
}

/**
 * Extract movie or TV show details
 */
async function extractDetails(id) {
  try {
    const pageUrl = resolvePageUrl(id);
    if (!pageUrl) return null;

    const html = await httpGet(pageUrl);
    if (!html) return null;

    const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<meta property="og:title" content="([^"]+)"/i);
    let title = titleM ? cleanText(titleM[1]) : 'Asya Dizi';
    title = title.replace(/\s+arşivleri.*$/i, '').replace(/\s*-\s*Asya\s*Dizi.*$/i, '').trim();

    const descM = html.match(/<meta property="og:description" content="([^"]+)"/i) ||
                  html.match(/<div class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const synopsis = descM ? cleanText(descM[1]) : '';

    const posterM = html.match(/<meta property="og:image" content="([^"]+)"/i) ||
                    html.match(/<div class="cat-img">[\s\S]*?<img[^>]+src="([^"]+)"/i) ||
                    html.match(/<img[^>]+src="([^"]+wp-content\/uploads[^"]+)"/i);
    const posterUrl = posterM ? makeAbsolute(posterM[1]) : null;

    const yearM = (title + ' ' + synopsis + ' ' + pageUrl).match(/\b(19\d{2}|20\d{2})\b/);
    const releaseDate = yearM ? yearM[1] : null;

    const ratingM = html.match(/class="imdbp">[\s\S]*?([\d\.]+)/i) || html.match(/IMDb:\s*([\d\.]+)/i);
    const rating = ratingM ? parseFloat(ratingM[1]) : null;

    const genres = [];
    const genreMatches = html.matchAll(/<a[^>]+href=["'][^"']*\/(?:kategori|tur)\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi);
    for (const gm of genreMatches) {
      const g = cleanText(gm[1]);
      if (g && !genres.includes(g)) genres.push(g);
    }

    return {
      id: pageUrl,
      title,
      synopsis,
      posterUrl,
      releaseDate,
      rating,
      genres: genres.length ? genres : ['Asya Dizisi', 'K-Drama'],
      status: 'Available'
    };
  } catch (_) {
    return null;
  }
}

/**
 * Extract episodes for movies and TV shows
 */
async function extractEpisodes(id) {
  try {
    const pageUrl = resolvePageUrl(id);
    if (!pageUrl) return [];

    const html = await httpGet(pageUrl);
    if (!html) return [];

    const episodes = [];
    const seen = new Set();

    // Match episode links: <a href="https://asyadizi.com/...-bolum-izle/">...</a>
    const epMatches = html.matchAll(/<a[^>]+href=["'](https:\/\/asyadizi\.com\/[^\/"]+-bolum-izle\/?)["'][^>]*>([\s\S]*?)<\/a>/gi);
    for (const m of epMatches) {
      const href = makeAbsolute(m[1]);
      if (seen.has(href)) continue;
      seen.add(href);

      const rawText = cleanText(m[2]);
      let sNum = 1;
      let eNum = 1;

      const sMatch = rawText.match(/(\d+)\.\s*Sezon/i) || href.match(/sezon-(\d+)/i);
      if (sMatch) sNum = parseInt(sMatch[1], 10);

      const eMatch = rawText.match(/(\d+)\.\s*Bölüm/i) || href.match(/(\d+)-bolum/i);
      if (eMatch) eNum = parseInt(eMatch[1], 10);

      let epTitle = `${sNum}. Sezon ${eNum}. Bölüm`;
      if (rawText.toLowerCase().includes('final')) epTitle += ' (Final)';

      episodes.push({
        id: href,
        url: href,
        href: href,
        title: epTitle,
        season: sNum,
        episode: eNum,
        seasonNumber: sNum,
        episodeNumber: eNum
      });
    }

    // Sort ascending by season and episode number
    episodes.sort((a, b) => (a.seasonNumber - b.seasonNumber) || (a.episodeNumber - b.episodeNumber));

    if (episodes.length === 0) {
      episodes.push({
        id: pageUrl,
        url: pageUrl,
        href: pageUrl,
        title: 'Bölüm 1',
        season: 1,
        episode: 1,
        seasonNumber: 1,
        episodeNumber: 1
      });
    }

    return episodes;
  } catch (_) {
    return [];
  }
}

/**
 * OK.ru / Odnoklassniki Stream Resolver
 */
async function resolveOkRu(embedUrl) {
  try {
    let cleanUrl = embedUrl;
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    const html = await httpGet(cleanUrl, { 'Referer': 'https://asyadizi.com/' });
    if (!html) return null;

    const dataOptMatch = html.match(/data-options=["']([^"']+)["']/i);
    if (!dataOptMatch) return null;

    const decoded = dataOptMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const opts = JSON.parse(decoded);
    const meta = typeof opts.flashvars?.metadata === 'string' ? JSON.parse(opts.flashvars.metadata) : (opts.flashvars?.metadata || {});

    // Option A: Master HLS
    if (meta.hlsManifestUrl) {
      return {
        url: meta.hlsManifestUrl,
        format: 'hls',
        streamType: 'hls',
        quality: 'Auto',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://ok.ru/' },
        serverName: 'OK.ru HLS'
      };
    }

    // Option B: Multi-quality MP4 from videos array
    if (meta.videos && Array.isArray(meta.videos) && meta.videos.length > 0) {
      const order = ['full', 'hd', 'sd', 'low', 'lowest', 'mobile'];
      let best = meta.videos[0];
      for (const pref of order) {
        const found = meta.videos.find(v => v.name === pref && v.url);
        if (found) { best = found; break; }
      }
      if (best && best.url) {
        return {
          url: best.url,
          format: 'mp4',
          streamType: 'mp4',
          quality: best.name === 'full' ? '1080p' : (best.name === 'hd' ? '720p' : '480p'),
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://ok.ru/' },
          serverName: `OK.ru ${best.name.toUpperCase()}`
        };
      }
    }

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Mail.ru Stream Resolver
 */
async function resolveMailRu(embedUrl) {
  try {
    let idMatch = embedUrl.match(/embed\/(\d+)/) || embedUrl.match(/meta\/(\d+)/);
    if (!idMatch) return null;
    const vId = idMatch[1];

    const metaUrl = `https://my.mail.ru/+/video/meta/${vId}`;
    const metaRaw = await httpGet(metaUrl, { 'Referer': embedUrl });
    if (!metaRaw) return null;

    const data = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;
    if (data && data.videos && Array.isArray(data.videos) && data.videos.length > 0) {
      const best = data.videos[0];
      let directUrl = best.url;
      if (directUrl.startsWith('//')) directUrl = 'https:' + directUrl;
      const q = best.key || '720p';
      return {
        url: directUrl,
        format: 'mp4',
        streamType: 'mp4',
        quality: q,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://my.mail.ru/' },
        serverName: `Mail.ru ${q}`
      };
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * VidMoly Stream Resolver
 */
async function resolveVidMoly(embedUrl) {
  try {
    let cleanUrl = embedUrl;
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    if (cleanUrl.includes('vidmoly.to')) cleanUrl = cleanUrl.replace('vidmoly.to', 'vidmoly.biz');
    if (cleanUrl.includes('vidmoly.net')) cleanUrl = cleanUrl.replace('vidmoly.net', 'vidmoly.biz');

    const html = await httpGet(cleanUrl, { 'Referer': BASE_URL + '/' });
    if (!html) return null;

    const m = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/);
    if (m) {
      return {
        url: m[1],
        format: 'hls',
        streamType: 'hls',
        quality: 'Auto',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidmoly.biz/' },
        serverName: 'VidMoly HLS'
      };
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Extract stream URL for video playback (Contract Version 3)
 */
async function extractStreamUrl(episode, server) {
  try {
    const rawEp = resolvePageUrl(episode);
    if (!rawEp) {
      return {
        url: '',
        streamUrl: '',
        streamType: 'hls',
        format: 'hls',
        quality: 'Auto',
        headers: {},
        streams: [],
        servers: [],
        subtitles: [],
        error: { message: 'Geçersiz bölüm bağlantısı' }
      };
    }

    // Candidate sources on AsyaDizi: Kaynak 1 (main), Kaynak 2 (/2/), Kaynak 3 (/3/), Kaynak 4 (/4/)
    const cleanBase = rawEp.replace(/\/+\d*\/+$/, '').replace(/\/+$/, '');
    const pagesToCheck = [
      rawEp,
      `${cleanBase}/2/`,
      `${cleanBase}/3/`,
      `${cleanBase}/4/`
    ];

    for (const pageUrl of pagesToCheck) {
      const html = await httpGet(pageUrl);
      if (!html || html.length < 500) continue;

      // Extract all iframes from this source
      const iframes = [];
      const ifrMatches = html.matchAll(/<iframe[^>]+(?:vdo-src|src)=["']([^"']+)["'][^>]*>/gi);
      for (const m of ifrMatches) {
        const u = m[1];
        if (!u.includes('youtube') && !u.includes('vimeo') && !u.includes('javascript') && !u.includes('vzaar')) {
          iframes.push(u);
        }
      }

      for (const embedUrl of iframes) {
        // 1. Try OK.ru / Odnoklassniki
        if (embedUrl.includes('ok.ru') || embedUrl.includes('odnoklassniki.ru')) {
          const stream = await resolveOkRu(embedUrl);
          if (stream) {
            return {
              url: stream.url,
              streamUrl: stream.url,
              streamType: stream.streamType,
              format: stream.format,
              quality: stream.quality,
              headers: stream.headers,
              streams: [`${stream.quality} ${stream.format.toUpperCase()}`, stream.url],
              servers: [
                { name: stream.serverName, url: stream.url }
              ],
              subtitles: []
            };
          }
        }

        // 2. Try Mail.ru
        if (embedUrl.includes('my.mail.ru/video/embed/')) {
          const stream = await resolveMailRu(embedUrl);
          if (stream) {
            return {
              url: stream.url,
              streamUrl: stream.url,
              streamType: stream.streamType,
              format: stream.format,
              quality: stream.quality,
              headers: stream.headers,
              streams: [`${stream.quality} ${stream.format.toUpperCase()}`, stream.url],
              servers: [
                { name: stream.serverName, url: stream.url }
              ],
              subtitles: []
            };
          }
        }

        // 3. Try VidMoly
        if (embedUrl.includes('vidmoly')) {
          const stream = await resolveVidMoly(embedUrl);
          if (stream) {
            return {
              url: stream.url,
              streamUrl: stream.url,
              streamType: stream.streamType,
              format: stream.format,
              quality: stream.quality,
              headers: stream.headers,
              streams: [`${stream.quality} ${stream.format.toUpperCase()}`, stream.url],
              servers: [
                { name: stream.serverName, url: stream.url }
              ],
              subtitles: []
            };
          }
        }
      }
    }

    return {
      url: '',
      streamUrl: '',
      streamType: 'hls',
      format: 'hls',
      quality: 'Auto',
      headers: {},
      streams: [],
      servers: [],
      subtitles: [],
      error: { message: 'AsyaDizi: Video kaynağı bulunamadı veya oynatılamıyor.' }
    };
  } catch (err) {
    return {
      url: '',
      streamUrl: '',
      streamType: 'hls',
      format: 'hls',
      quality: 'Auto',
      headers: {},
      streams: [],
      servers: [],
      subtitles: [],
      error: { message: err ? err.message : 'AsyaDizi stream extraction failed' }
    };
  }
}

/**
 * Dedicated Subtitles Handler
 */
async function extractSubtitles() {
  return [];
}

/**
 * Discovery Home handler
 */
async function discoveryHome() {
  try {
    const html = await httpGet(BASE_URL + '/');
    if (!html) return [];

    const items = [];
    const seen = new Set();

    const matches = html.matchAll(/<a[^>]+href=["'](https:\/\/asyadizi\.com\/dizi\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
    for (const m of matches) {
      const href = m[1];
      if (seen.has(href)) continue;

      const inner = m[2];
      const imgM = inner.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i);
      const poster = imgM ? makeAbsolute(imgM[1]) : '';

      let title = cleanText(inner);
      if (!title) {
        const slug = href.replace(/\/+$/, '').split('/').pop() || '';
        title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }

      seen.add(href);
      items.push({
        id: href,
        title,
        url: href,
        href,
        image: poster,
        poster,
        posterUrl: poster,
        isSeries: true,
        type: 'tv'
      });
    }

    const sections = [];
    if (items.length > 0) {
      sections.push({
        id: 'asyadizi_popular',
        title: 'Öne Çıkan Asya Dizileri',
        type: 'featured',
        items: items.slice(0, 30)
      });
    }

    return sections;
  } catch (_) {
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
  } catch (_) {
    return [];
  }
}

// Module Exports (Contract Version 3)
globalThis.searchResults = searchResults;
globalThis.extractDetails = extractDetails;
globalThis.extractEpisodes = extractEpisodes;
globalThis.extractStreamUrl = extractStreamUrl;
globalThis.extractSubtitles = extractSubtitles;
globalThis.discoveryHome = discoveryHome;
globalThis.discoveryFeed = discoveryFeed;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    searchResults,
    extractDetails,
    extractEpisodes,
    extractStreamUrl,
    extractSubtitles,
    discoveryHome,
    discoveryFeed
  };
}
