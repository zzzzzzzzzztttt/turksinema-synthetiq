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

  return await readResponseBody(res);
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
        url: pageUrl,
        href: pageUrl,
        title: 'Film',
        season: 1,
        episode: 1,
        seasonNumber: 1,
        episodeNumber: 1
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
                const epUrl = `${pageUrl}?season=${sNum}&episode=${eNum}`;
                episodes.push({
                  id: epUrl,
                  url: epUrl,
                  href: epUrl,
                  title: ep.name ? cleanText(ep.name) : `Sezon ${sNum} Bölüm ${eNum}`,
                  season: sNum,
                  episode: eNum,
                  seasonNumber: sNum,
                  episodeNumber: eNum
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
        const epUrl = `${pageUrl}?season=${sNum}&episode=${eNum}`;
        episodes.push({
          id: epUrl,
          url: epUrl,
          href: epUrl,
          title: `Sezon ${sNum} Bölüm ${eNum}`,
          season: sNum,
          episode: eNum,
          seasonNumber: sNum,
          episodeNumber: eNum
        });
      }
    }

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
  } catch (err) {
    return [];
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

    const epObj = typeof episode === 'object' && episode !== null ? episode : {};
    const serverObj = typeof server === 'object' && server !== null ? server : {};
    const serverPref = String(serverObj.name || serverObj.id || server || '').toLowerCase();

    // Parse URL components safely without URLSearchParams (JSC compatibility)
    const [baseUrl, queryPart] = rawEp.split('?');
    let seasonNum = 1;
    let episodeNum = 1;
    if (epObj.season != null && !isNaN(parseInt(epObj.season, 10))) {
      seasonNum = parseInt(epObj.season, 10);
    } else if (epObj.seasonNumber != null && !isNaN(parseInt(epObj.seasonNumber, 10))) {
      seasonNum = parseInt(epObj.seasonNumber, 10);
    }
    if (epObj.episode != null && !isNaN(parseInt(epObj.episode, 10))) {
      episodeNum = parseInt(epObj.episode, 10);
    } else if (epObj.episodeNumber != null && !isNaN(parseInt(epObj.episodeNumber, 10))) {
      episodeNum = parseInt(epObj.episodeNumber, 10);
    }

    if (queryPart) {
      const sM = queryPart.match(/(?:^|&)season=(\d+)/i);
      if (sM) seasonNum = parseInt(sM[1], 10);
      const eM = queryPart.match(/(?:^|&)episode=(\d+)/i);
      if (eM) episodeNum = parseInt(eM[1], 10);
    }

    // Fetch the main content page to get film_id and available player types
    const html = await httpGet(baseUrl);
    if (!html) {
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
        error: { message: 'Sayfa içeriği yüklenemedi' }
      };
    }

    // Match film_id with multiple strategies
    let filmId = '';
    const fIdMatch = html.match(/name=["']film_id["'][^>]*value=["'](\d+)["']/i) ||
                     html.match(/value=["'](\d+)["'][^>]*name=["']film_id["']/i) ||
                     html.match(/data-film-id=["'](\d+)["']/i) ||
                     html.match(/data-id=["'](\d+)["']/i) ||
                     html.match(/film_id\s*[:=]\s*["']?(\d+)["']?/i);
    if (fIdMatch) {
      filmId = fIdMatch[1];
    }

    if (!filmId) {
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
        error: { message: 'Video kimliği (film_id) bulunamadı' }
      };
    }

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
                streamUrl: mp4Url,
                streamType: 'mp4',
                format: 'mp4',
                quality: `${q}p`,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
                },
                streams: [`${q}p Direct`, mp4Url],
                servers: [
                  { name: `Gold ${q}p (${playerType.toUpperCase()})`, url: mp4Url },
                  { name: `VIP (${playerType.toUpperCase()})`, url: baseUrl }
                ],
                subtitles: []
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
                const hlsUrl = sData.hlsSource.file;
                return {
                  url: hlsUrl,
                  streamUrl: hlsUrl,
                  streamType: 'hls',
                  format: 'hls',
                  quality: 'Auto',
                  headers: {
                    'Referer': 'https://videopark.top/'
                  },
                  streams: ['Auto 1080p', hlsUrl],
                  servers: [
                    { name: `VIP HLS (${playerType.toUpperCase()})`, url: hlsUrl }
                  ],
                  subtitles: []
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
                  streamUrl: fullHls,
                  streamType: 'hls',
                  format: 'hls',
                  quality: 'Auto',
                  headers: {
                    'Referer': embedUrl
                  },
                  streams: ['Auto 1080p', fullHls],
                  servers: [
                    { name: `Apollo HLS (${playerType.toUpperCase()})`, url: fullHls }
                  ],
                  subtitles: []
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
                const subs = [];
                const subtitleList = sdData.subtitles || [];
                for (const sub of subtitleList) {
                  if (sub.file) {
                    try {
                      const subContent = await httpGet(sub.file, { 'Referer': 'https://videopark.top/' });
                      if (subContent && subContent.includes('WEBVTT')) {
                        subs.push({
                          url: sub.file,
                          language: sub.label || 'Türkçe',
                          label: sub.label || 'Türkçe Altyazı',
                          content: subContent
                        });
                      }
                    } catch (_) {}
                  }
                }

                return {
                  url: sdData.stream_url,
                  streamUrl: sdData.stream_url,
                  streamType: 'hls',
                  format: 'hls',
                  quality: 'Auto',
                  headers: {
                    'Referer': 'https://videopark.top/'
                  },
                  streams: ['Auto 1080p', sdData.stream_url],
                  servers: [
                    { name: `Titan HLS (${playerType.toUpperCase()})`, url: sdData.stream_url }
                  ],
                  subtitles: subs
                };
              }
            }
          } catch (_) {}
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
      error: { message: 'JetFilmizle: Video kaynağı bulunamadı veya oynatılamıyor.' }
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
      error: { message: err ? err.message : 'JetFilmizle stream extraction failed' }
    };
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

    const fIdMatch = html.match(/name=["']film_id["'][^>]*value=["'](\d+)["']/i) ||
                     html.match(/value=["'](\d+)["'][^>]*name=["']film_id["']/i) ||
                     html.match(/data-film-id=["'](\d+)["']/i) ||
                     html.match(/data-id=["'](\d+)["']/i) ||
                     html.match(/film_id\s*[:=]\s*["']?(\d+)["']?/i);
    if (!fIdMatch) return [];
    const filmId = fIdMatch[1];

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
