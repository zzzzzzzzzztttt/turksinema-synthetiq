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
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
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
  'under the queens umbrella': 'umbrella',
  'the queens umbrella': 'umbrella',
  'queens umbrella': 'umbrella',
  'under the queen\'s umbrella': 'umbrella',
  'the queen\'s umbrella': 'umbrella',
  'queen\'s umbrella': 'umbrella',
  'kralicenin semsiyesi': 'umbrella',
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

    // Match episode links: <a href="https://asyadizi.com/...-bolum-izle/"> or ...-bolum/
    const epMatches = html.matchAll(/<a[^>]+href=["'](https:\/\/asyadizi\.com\/[^\/"]+-bolum(?:-izle)?\/?)["'][^>]*>([\s\S]*?)<\/a>/gi);
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
 * Prioritizes direct MP4 video streams over HLS to ensure seamless native iOS AVPlayer playback.
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

    // Option A: Direct MP4 Video Streams (Native iOS AVPlayer safe, avoids local HLS proxy 502 & 400 errors)
    if (meta.videos && Array.isArray(meta.videos) && meta.videos.length > 0) {
      const order = ['full', 'hd', 'sd', 'low', 'lowest', 'mobile'];
      const qualityLabels = {
        'full': '1080p',
        'hd': '720p',
        'sd': '480p',
        'low': '360p',
        'lowest': '240p',
        'mobile': '144p'
      };

      const validVideos = meta.videos.filter(v => v && v.url);
      if (validVideos.length > 0) {
        let best = validVideos[0];
        for (const pref of order) {
          const found = validVideos.find(v => v.name === pref);
          if (found) {
            best = found;
            break;
          }
        }

        const streams = [];
        const servers = [];
        for (const pref of order) {
          const v = validVideos.find(item => item.name === pref);
          if (v) {
            const label = qualityLabels[v.name] || v.name;
            streams.push(`${label} MP4`, v.url);
            servers.push({
              name: `OK.ru (${label})`,
              url: v.url
            });
          }
        }

        const bestLabel = qualityLabels[best.name] || 'HD';
        return {
          url: best.url,
          streamUrl: best.url,
          format: 'mp4',
          streamType: 'mp4',
          quality: bestLabel,
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
            'Referer': 'https://ok.ru/'
          },
          streams: streams.length > 0 ? streams : [`${bestLabel} MP4`, best.url],
          servers: servers.length > 0 ? servers : [{ name: `OK.ru ${bestLabel}`, url: best.url }],
          serverName: `OK.ru ${bestLabel}`
        };
      }
    }

    // Option B: Master HLS (only if direct MP4 is unavailable)
    if (meta.hlsManifestUrl) {
      return {
        url: meta.hlsManifestUrl,
        streamUrl: meta.hlsManifestUrl,
        format: 'hls',
        streamType: 'hls',
        quality: 'Auto',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
          'Referer': 'https://ok.ru/'
        },
        streams: ['Auto HLS', meta.hlsManifestUrl],
        servers: [{ name: 'OK.ru HLS', url: meta.hlsManifestUrl }],
        serverName: 'OK.ru HLS'
      };
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
      const validVideos = data.videos.filter(v => v && v.url);
      if (validVideos.length > 0) {
        const best = validVideos[0];
        let directUrl = best.url;
        if (directUrl.startsWith('//')) directUrl = 'https:' + directUrl;
        const q = best.key || '720p';

        const streams = [];
        const servers = [];
        for (const v of validVideos) {
          let u = v.url;
          if (u.startsWith('//')) u = 'https:' + u;
          const k = v.key || 'Direct';
          streams.push(`${k} MP4`, u);
          servers.push({ name: `Mail.ru (${k})`, url: u });
        }

        return {
          url: directUrl,
          streamUrl: directUrl,
          format: 'mp4',
          streamType: 'mp4',
          quality: q,
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
            'Referer': 'https://my.mail.ru/'
          },
          streams: streams.length > 0 ? streams : [`${q} MP4`, directUrl],
          servers: servers.length > 0 ? servers : [{ name: `Mail.ru ${q}`, url: directUrl }],
          serverName: `Mail.ru ${q}`
        };
      }
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
        streamUrl: m[1],
        format: 'hls',
        streamType: 'hls',
        quality: 'Auto',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
          'Referer': 'https://vidmoly.biz/'
        },
        streams: ['Auto HLS', m[1]],
        servers: [{ name: 'VidMoly HLS', url: m[1] }],
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
          if (stream && stream.url) {
            return {
              url: stream.url,
              streamUrl: stream.streamUrl || stream.url,
              streamType: stream.streamType || 'mp4',
              format: stream.format || 'mp4',
              quality: stream.quality || 'HD',
              headers: stream.headers || {},
              streams: stream.streams && stream.streams.length > 0 ? stream.streams : [`${stream.quality} ${(stream.format || 'mp4').toUpperCase()}`, stream.url],
              servers: stream.servers && stream.servers.length > 0 ? stream.servers : [{ name: stream.serverName || 'Server', url: stream.url }],
              subtitles: []
            };
          }
        }

        // 2. Try Mail.ru
        if (embedUrl.includes('my.mail.ru/video/embed/') || embedUrl.includes('mail.ru')) {
          const stream = await resolveMailRu(embedUrl);
          if (stream && stream.url) {
            return {
              url: stream.url,
              streamUrl: stream.streamUrl || stream.url,
              streamType: stream.streamType || 'mp4',
              format: stream.format || 'mp4',
              quality: stream.quality || 'HD',
              headers: stream.headers || {},
              streams: stream.streams && stream.streams.length > 0 ? stream.streams : [`${stream.quality} ${(stream.format || 'mp4').toUpperCase()}`, stream.url],
              servers: stream.servers && stream.servers.length > 0 ? stream.servers : [{ name: stream.serverName || 'Server', url: stream.url }],
              subtitles: []
            };
          }
        }

        // 3. Try VidMoly
        if (embedUrl.includes('vidmoly')) {
          const stream = await resolveVidMoly(embedUrl);
          if (stream && stream.url) {
            return {
              url: stream.url,
              streamUrl: stream.streamUrl || stream.url,
              streamType: stream.streamType || 'hls',
              format: stream.format || 'hls',
              quality: stream.quality || 'Auto',
              headers: stream.headers || {},
              streams: stream.streams && stream.streams.length > 0 ? stream.streams : [`${stream.quality} ${(stream.format || 'hls').toUpperCase()}`, stream.url],
              servers: stream.servers && stream.servers.length > 0 ? stream.servers : [{ name: stream.serverName || 'Server', url: stream.url }],
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
    const [h1, h2] = await Promise.all([
      httpGet(BASE_URL + '/'),
      httpGet(BASE_URL + '/kore-dizileri-izle/').catch(() => '')
    ]);
    if (!h1) return { sections: [] };

    const items = [];
    const seen = new Set();

    function parseHtml(html) {
      if (!html) return;
      const blockRegex = /<div[^>]*class="[^"]*(?:film-kutusu|dizi-kutusu|item|box|poster|card|col-)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      let bm;
      while ((bm = blockRegex.exec(html)) !== null) {
        const block = bm[1];
        const linkMatch = block.match(/href=["'](https:\/\/asyadizi\.com\/dizi\/[^"']+)["']/i);
        if (!linkMatch) continue;
        const href = linkMatch[1];
        if (seen.has(href)) continue;

        const imgMatch = block.match(/data-src=["'](https?:[^"']+)["']/i) ||
                         block.match(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
        const titleMatch = block.match(/title=["']([^"']+)["']/i) ||
                           block.match(/alt=["']([^"']+)["']/i) ||
                           block.match(/<(?:h2|h3|h4|span|a)[^>]*>([^<]{2,60})<\//i);

        if (imgMatch && titleMatch) {
          seen.add(href);
          const poster = imgMatch[1];
          const hires = poster.replace(/\/thumb_\/[^\/]+\//, '/');
          const title = titleMatch[1].replace(/&amp;/g, '&').trim();
          items.push({
            id: href,
            title,
            url: href,
            href,
            image: hires,
            poster: hires,
            coverUrl: hires,
            backdrop: hires,
            isSeries: true,
            type: 'tv',
            badge: 'K-Drama'
          });
        }
      }
    }

    parseHtml(h1);
    if (h2) parseHtml(h2);

    const sections = [];
    if (items.length > 0) {
      // 1. Hero Carousel
      sections.push({
        id: 'asyadizi-hero',
        title: 'Öne Çıkan Asya Dizileri',
        style: 'hero',
        items: items.slice(0, 6),
        viewAll: { mode: 'feed', feedId: 'hero' }
      });

      // 2. Top 10 Shelf
      if (items.length >= 10) {
        sections.push({
          id: 'asyadizi-top10',
          title: 'En Çok İzlenen 10 Dizi',
          style: 'top10',
          items: items.slice(0, 10),
          viewAll: { mode: 'feed', feedId: 'top10' }
        });
      }

      // 3. Regular Poster Shelf
      sections.push({
        id: 'asyadizi-latest',
        title: 'Trend Kore & Asya Dizileri',
        style: 'poster',
        items: items.slice(6),
        viewAll: { mode: 'feed', feedId: 'latest' }
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
    const home = await discoveryHome();
    const sections = Array.isArray(home && home.sections) ? home.sections : [];
    const id = String(feedId || '').toLowerCase();
    const section = sections.find(s => s.id === id || s.id.includes(id)) || sections[0];
    const items = section ? section.items : [];
    return {
      items: items,
      page: Number(page) || 1,
      hasMore: false
    };
  } catch (_) {
    return { items: [], page: 1, hasMore: false };
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
