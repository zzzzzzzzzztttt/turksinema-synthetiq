/**
 * JetFilmizle Source Module - Synthetiq Player
 * Target: JetFilmizle (https://jetfilmizle.app)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Fast structured JSON catalog search (/arama-json?q=)
 *   - High-quality Hollywood movies & series in Turkish Dubbed (Dublaj) & Original Subtitled (Altyazılı)
 *   - Direct multi-server playback:
 *       * Gold: Direct high-bandwidth MP4 streams (1080p, 720p, 360p)
 *       * VIP: Adaptive master HLS (.m3u8) streams
 *       * Apollo: Multi-bitrate HLS streams
 *       * Titan: Series HLS streams with inlined WebVTT subtitles
 *   - 100% iOS JavaScriptCore safe (zero Buffer/atob dependencies)
 */

const BASE_URL = 'https://jetfilmizle.app';

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
  if (typeof input === 'string') return makeAbsolute(input);
  if (typeof input === 'object') {
    const raw = input.url || input.id || input.href || input.pageUrl || '';
    if (raw) return makeAbsolute(raw);
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

  if (!res) return '';
  if (typeof res.body === 'string' && res.body) return res.body;

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
 * Universal HTTP POST supporting iOS Synthetiq fetchv2 and standard fetch
 */
async function httpPost(url, body, customHeaders = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
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

  if (!res) return '';
  if (typeof res.body === 'string' && res.body) return res.body;

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

const TITLE_ALIASES = {
  'pulp fiction': 'ucuz roman',
  'the shawshank redemption': 'esaretin bedeli',
  'shawshank redemption': 'esaretin bedeli',
  'the godfather': 'baba',
  'godfather': 'baba',
  'the dark knight': 'kara şövalye',
  'dark knight': 'kara şövalye',
  'fight club': 'dövüş kulübü',
  'inception': 'başlangıç',
  'interstellar': 'yıldızlararası',
  'the matrix': 'matrix',
  'matrix': 'matrix',
  'goodfellas': 'sıkı dostlar',
  'se7en': 'yedi',
  'seven': 'yedi',
  'saving private ryan': 'er ryan',
  'the green mile': 'yeşil yol',
  'green mile': 'yeşil yol',
  'spirited away': 'ruhların kaçışı',
  'spaceballs': 'uzay topları'
};

/**
 * Search results using JetFilmizle JSON API
 */
async function searchResults(query) {
  try {
    const q = String(query || '').trim();
    if (!q) return [];

    async function queryApi(term) {
      const apiUrl = `${BASE_URL}/arama-json?q=${encodeURIComponent(term)}`;
      const raw = await httpGet(apiUrl, {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      });
      if (!raw) return [];
      try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const results = data.results || [];
        return results.map(item => {
          const title = cleanText(item.title) + (item.original_title ? ` (${cleanText(item.original_title)})` : '');
          return {
            id: makeAbsolute(item.url),
            title: title || cleanText(item.title),
            posterUrl: item.poster ? makeAbsolute(item.poster) : null,
            year: parseInt(item.year, 10) || null,
            rating: parseFloat(item.rating) || null,
            type: item.type === 'dizi' ? 'tv' : 'movie'
          };
        });
      } catch (_) {
        return [];
      }
    }

    let hits = await queryApi(q);

    // If few hits, check aliases
    const lower = q.toLowerCase();
    if (hits.length === 0 && TITLE_ALIASES[lower]) {
      const aliasHits = await queryApi(TITLE_ALIASES[lower]);
      hits = hits.concat(aliasHits);
    }

    const seen = new Set();
    const deduped = [];
    for (const item of hits) {
      if (!item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      deduped.push(item);
    }

    return deduped;
  } catch (err) {
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

    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch ? cleanText(titleMatch[1]) : 'JetFilmizle Content';

    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)
      || html.match(/<div class="[^"]*film-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const synopsis = descMatch ? cleanText(descMatch[1]) : '';

    const posterMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i)
      || html.match(/<div class="[^"]*film-poster[^"]*"[^>]*>\s*<img[^>]+src="([^"]+)"/i);
    const posterUrl = posterMatch ? makeAbsolute(posterMatch[1]) : null;

    const yearMatch = html.match(/<span class="[^"]*year[^"]*"[^>]*>(\d{4})<\/span>/i)
      || html.match(/<i class="fas fa-calendar-alt"><\/i>\s*(\d{4})/i)
      || html.match(/itemprop="datePublished"[^>]*content="(\d{4})"/i);
    const releaseDate = yearMatch ? yearMatch[1] : null;

    const ratingMatch = html.match(/<span class="[^"]*imdb-rating[^"]*"[^>]*>([\d\.]+)<\/span>/i)
      || html.match(/<i class="fas fa-star text-warning"><\/i>\s*([\d\.]+)/i);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

    const genres = [];
    const genreMatches = html.matchAll(/<a[^>]+href="[^"]*\/tur\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi);
    for (const m of genreMatches) {
      const g = cleanText(m[1]);
      if (g && !genres.includes(g)) genres.push(g);
    }

    return {
      id: pageUrl,
      title,
      synopsis,
      posterUrl,
      releaseDate,
      rating,
      genres,
      status: 'Available'
    };
  } catch (err) {
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

    const isSeries = pageUrl.includes('/dizi/') || html.includes('data-season=') || html.includes('data-episode=');

    if (!isSeries) {
      return [{
        id: pageUrl,
        title: 'Film',
        season: 1,
        episode: 1
      }];
    }

    // Series episode parsing
    const episodes = [];
    const seen = new Set();

    // Strategy A: JSON-LD Schema containsSeason
    const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    for (const jm of jsonLdMatches) {
      try {
        const parsed = JSON.parse(jm[1]);
        if (parsed.containsSeason && Array.isArray(parsed.containsSeason)) {
          for (const s of parsed.containsSeason) {
            const sNum = parseInt(s.seasonNumber, 10) || 1;
            const epList = s.episode || [];
            for (const ep of epList) {
              const eNum = parseInt(ep.episodeNumber, 10) || 1;
              const epKey = `s${sNum}e${eNum}`;
              if (!seen.has(epKey)) {
                seen.add(epKey);
                episodes.push({
                  id: `${pageUrl}?season=${sNum}&episode=${eNum}`,
                  title: ep.name ? cleanText(ep.name) : `Sezon ${sNum} Bölüm ${eNum}`,
                  season: sNum,
                  episode: eNum
                });
              }
            }
          }
        }
      } catch (_) {}
    }

    if (episodes.length > 0) return episodes;

    // Strategy B: DOM parsing of episode buttons
    const btnMatches = html.matchAll(/<button[^>]+(?:episode-btn|player-source-btn)[^>]+data-season="(\d+)"[^>]+data-episode="(\d+)"[^>]*>/gi);
    for (const bm of btnMatches) {
      const sNum = parseInt(bm[1], 10) || 1;
      const eNum = parseInt(bm[2], 10) || 1;
      const epKey = `s${sNum}e${eNum}`;
      if (!seen.has(epKey)) {
        seen.add(epKey);
        episodes.push({
          id: `${pageUrl}?season=${sNum}&episode=${eNum}`,
          title: `Sezon ${sNum} Bölüm ${eNum}`,
          season: sNum,
          episode: eNum
        });
      }
    }

    if (episodes.length === 0) {
      episodes.push({
        id: pageUrl,
        title: 'Bölüm 1',
        season: 1,
        episode: 1
      });
    }

    return episodes;
  } catch (err) {
    return [];
  }
}

/**
 * Extract stream URL for video playback
 */
async function extractStreamUrl(episode, server) {
  try {
    const rawEp = resolvePageUrl(episode);
    if (!rawEp) return null;

    const epObj = typeof episode === 'object' && episode !== null ? episode : {};
    const serverObj = typeof server === 'object' && server !== null ? server : {};
    const serverPref = String(serverObj.name || serverObj.id || server || '').toLowerCase();

    // Parse URL components
    const [baseUrl, queryPart] = rawEp.split('?');
    const queryParams = new URLSearchParams(queryPart || '');

    const seasonNum = epObj.season || queryParams.get('season') || 1;
    const episodeNum = epObj.episode || queryParams.get('episode') || 1;

    // Fetch the main content page to get film_id and available player types
    const html = await httpGet(baseUrl);
    if (!html) return null;

    const filmIdMatch = html.match(/name="film_id"\s+value="(\d+)"/);
    if (!filmIdMatch) return null;
    const filmId = filmIdMatch[1];

    // Determine player types to test:
    // If user prefers Sub or Altyazı, try altyazili first, else dublaj first
    let typeOrder = ['dublaj', 'altyazili', 'genel'];
    if (serverPref.includes('sub') || serverPref.includes('altyaz')) {
      typeOrder = ['altyazili', 'dublaj', 'genel'];
    }

    // Try available source types
    for (const playerType of typeOrder) {
      // Test source indices 0 through 4
      for (let sIdx = 0; sIdx <= 4; sIdx++) {
        let postBody = `film_id=${filmId}&source_index=${sIdx}&player_type=${playerType}`;
        if (rawEp.includes('/dizi/')) {
          postBody += `&season=${seasonNum}&episode=${episodeNum}`;
        }

        const playerResp = await httpPost(`${BASE_URL}/jetplayer`, postBody, {
          'Referer': baseUrl
        });
        if (!playerResp || playerResp.length < 50) continue;

        const iframeMatch = playerResp.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
        if (!iframeMatch) continue;

        let embedUrl = iframeMatch[1];
        if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;
        if (!embedUrl.startsWith('http')) embedUrl = BASE_URL + embedUrl;

        // Skip YouTube trailers
        if (embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be')) continue;

        // 1. Resolve videopark.top/go (Direct MP4 streams from Google Drive worker)
        if (embedUrl.includes('videopark.top/go/')) {
          try {
            const goHtml = await httpGet(embedUrl, { 'Referer': BASE_URL + '/' });
            const vIdMatch = goHtml.match(/VIDEO_ID\s*=\s*(\d+)/);
            const wBaseMatch = goHtml.match(/WORKER_BASE\s*=\s*["']([^"']+)["']/);
            if (vIdMatch && wBaseMatch) {
              const vId = vIdMatch[1];
              const wBase = wBaseMatch[1].replace(/\\/g, '').replace(/\/+$/, '');
              const infoRaw = await httpGet(`${wBase}/v/${vId}/info`, { 'Referer': 'https://videopark.top/' });
              const info = typeof infoRaw === 'string' ? JSON.parse(infoRaw) : infoRaw;
              const qualities = (info && info.qualities && info.qualities.length) ? info.qualities : [1080];
              const q = qualities[0];
              const mp4Url = `${wBase}/v/${vId}?q=${q}`;

              return {
                url: mp4Url,
                quality: `${q}p`,
                format: 'mp4',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
                },
                servers: [
                  { name: `Gold ${q}p (${playerType.toUpperCase()})`, url: mp4Url },
                  { name: `VIP (${playerType.toUpperCase()})`, url: baseUrl }
                ]
              };
            }
          } catch (_) {}
        }

        // 2. Resolve videopark.top/vip (Master HLS streams from dplayer worker)
        if (embedUrl.includes('videopark.top/vip/')) {
          try {
            const vipHtml = await httpGet(embedUrl, { 'Referer': BASE_URL + '/' });
            const pubIdMatch = vipHtml.match(/PUB_ID\s*=\s*["']([^"']+)["']/);
            const wUrlMatch = vipHtml.match(/WORKER_URL\s*=\s*["']([^"']+)["']/);
            if (pubIdMatch && wUrlMatch) {
              const pubId = pubIdMatch[1];
              const wUrl = wUrlMatch[1].replace(/\/+$/, '');
              const streamRaw = await httpGet(`${wUrl}/api/stream?pubId=${pubId}`, {
                'Referer': embedUrl
              });
              const sData = typeof streamRaw === 'string' ? JSON.parse(streamRaw) : streamRaw;
              if (sData && sData.hlsSource && sData.hlsSource.file) {
                return {
                  url: sData.hlsSource.file,
                  quality: 'Auto',
                  format: 'hls',
                  headers: {
                    'Referer': 'https://videopark.top/'
                  },
                  servers: [
                    { name: `VIP HLS (${playerType.toUpperCase()})`, url: sData.hlsSource.file }
                  ]
                };
              }
            }
          } catch (_) {}
        }

        // 3. Resolve videopark.top/apollo (HLS stream from Apollo)
        if (embedUrl.includes('videopark.top/apollo/')) {
          try {
            const aIdMatch = embedUrl.match(/[?&]id=([^&]+)/);
            if (aIdMatch) {
              const aId = aIdMatch[1];
              const aRaw = await httpPost('https://videopark.top/apollo/get_video.php', `id=${aId}`, {
                'Referer': embedUrl
              });
              const aData = typeof aRaw === 'string' ? JSON.parse(aRaw) : aRaw;
              if (aData && aData.hlsUrl) {
                const fullHls = `https://videopark.top/apollo/${aData.hlsUrl.replace(/^\/+/, '')}`;
                return {
                  url: fullHls,
                  quality: 'Auto',
                  format: 'hls',
                  headers: {
                    'Referer': embedUrl
                  },
                  servers: [
                    { name: `Apollo HLS (${playerType.toUpperCase()})`, url: fullHls }
                  ]
                };
              }
            }
          } catch (_) {}
        }

        // 4. Resolve videopark.top/titan (Series HLS & Subtitles)
        if (embedUrl.includes('videopark.top/titan/')) {
          try {
            const titanHtml = await httpGet(embedUrl, { 'Referer': BASE_URL + '/' });
            const sdMatch = titanHtml.match(/var\s+_sd\s*=\s*(\{[\s\S]*?\});/);
            if (sdMatch) {
              const sdData = JSON.parse(sdMatch[1]);
              if (sdData.stream_url) {
                return {
                  url: sdData.stream_url,
                  quality: 'Auto',
                  format: 'hls',
                  headers: {
                    'Referer': 'https://videopark.top/'
                  },
                  servers: [
                    { name: `Titan HLS (${playerType.toUpperCase()})`, url: sdData.stream_url }
                  ]
                };
              }
            }
          } catch (_) {}
        }
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Dedicated Subtitles Handler with Inlined WebVTT
 */
async function extractSubtitles(pageUrl) {
  try {
    const rawUrl = resolvePageUrl(pageUrl);
    if (!rawUrl) return [];

    const html = await httpGet(rawUrl);
    if (!html) return [];

    const filmIdMatch = html.match(/name="film_id"\s+value="(\d+)"/);
    if (!filmIdMatch) return [];
    const filmId = filmIdMatch[1];

    const subs = [];

    // Check altyazili source on jetplayer
    const playerResp = await httpPost(`${BASE_URL}/jetplayer`, `film_id=${filmId}&source_index=0&player_type=altyazili`, {
      'Referer': rawUrl
    });
    if (!playerResp) return [];

    const iframeMatch = playerResp.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
    if (iframeMatch) {
      let embedUrl = iframeMatch[1];
      if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;

      if (embedUrl.includes('videopark.top/titan/')) {
        const titanHtml = await httpGet(embedUrl, { 'Referer': BASE_URL + '/' });
        const sdMatch = titanHtml.match(/var\s+_sd\s*=\s*(\{[\s\S]*?\});/);
        if (sdMatch) {
          try {
            const sdData = JSON.parse(sdMatch[1]);
            const subtitleList = sdData.subtitles || [];
            for (const sub of subtitleList) {
              if (sub.file) {
                const subContent = await httpGet(sub.file, { 'Referer': 'https://videopark.top/' });
                if (subContent && subContent.includes('WEBVTT')) {
                  subs.push({
                    url: sub.file,
                    language: sub.label || 'Türkçe',
                    label: sub.label || 'Türkçe Altyazı',
                    content: subContent
                  });
                }
              }
            }
          } catch (_) {}
        }
      }
    }

    return subs;
  } catch (err) {
    return [];
  }
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

    const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    for (const jm of jsonLdMatches) {
      try {
        const parsed = JSON.parse(jm[1]);
        if (parsed.itemListElement && Array.isArray(parsed.itemListElement)) {
          for (const el of parsed.itemListElement) {
            const it = el.item || {};
            const url = it.url ? makeAbsolute(it.url) : '';
            if (!url || seen.has(url)) continue;
            seen.add(url);
            const isSeries = it['@type'] === 'TVSeries' || url.includes('/dizi/');
            items.push({
              id: url,
              title: cleanText(it.name || ''),
              url: url,
              href: url,
              image: it.image ? makeAbsolute(it.image) : '',
              poster: it.image ? makeAbsolute(it.image) : '',
              coverUrl: it.image ? makeAbsolute(it.image) : '',
              isSeries: isSeries,
              type: isSeries ? 'series' : 'movie'
            });
          }
        }
      } catch (_) {}
    }

    const sections = [];
    if (items.length > 0) {
      sections.push({
        id: 'jetfilmizle_featured',
        title: 'Öne Çıkan Filmler ve Diziler',
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
