/**
 * Dizigom Source Module - Synthetiq Player
 * Target: Dizigom (https://dizigom3.top)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Movies, TV Series, and Asian Dramas with Dual Audio (TR Dub / EN Sub)
 *   - Fast autocomplete suggestions search with TMDB w780 posters
 *   - Multi-season episode parser
 *   - Pre-fetched inlined WebVTT subtitles to prevent iOS AVPlayer 403 errors
 */

const BASE_URL = 'https://dizigom3.top';

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

/**
 * Search results handler
 * Uses Dizigom autocomplete API for accurate, instant results
 */
async function searchResults(query) {
  try {
    const q = String(query || '').trim();
    if (!q) return [];

    const url = `${BASE_URL}/ara/oneri?q=${encodeURIComponent(q)}`;
    const text = await httpGet(url, {
      'Accept': 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest'
    });

    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      return [];
    }

    const results = [];
    const list = [
      ...(Array.isArray(json.series) ? json.series : []),
      ...(Array.isArray(json.movies) ? json.movies : [])
    ];

    for (const item of list) {
      if (!item.url || !item.title) continue;
      const isSeries = item.type === 'series' || item.url.includes('/dizi/');
      const itemUrl = makeAbsolute(item.url);
      const poster = item.poster ? makeAbsolute(item.poster) : '';
      const title = cleanText(item.title);

      results.push({
        id: itemUrl,
        title: title,
        url: itemUrl,
        href: itemUrl,
        image: poster,
        poster: poster,
        coverUrl: poster,
        isSeries: isSeries,
        type: isSeries ? 'series' : 'movie'
      });
    }

    return results;
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
    const title = titleMatch ? cleanText(titleMatch[1]) : 'Dizi / Film';

    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i) ||
                      html.match(/<div[^>]+class="[^"]*(?:description|synopsis|summary|storyline)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
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
      title: 'Dizi / Film',
      url: targetUrl,
      href: targetUrl,
      image: '',
      poster: '',
      coverUrl: '',
      description: '',
      plot: ''
    };
  }
}

function parseEpisodesFromHtml(html, defaultSeason = 1) {
  const episodes = [];
  const regex = /<a\s+href="([^"]*\/sezon-(\d+)\/bolum-(\d+))"[^>]*class="group">([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const url = makeAbsolute(m[1]);
    const season = parseInt(m[2], 10) || defaultSeason;
    const episode = parseInt(m[3], 10);
    const body = m[4];
    const nameMatch = body.match(/font-semibold[^>]*>([^<]+)<\/p>/i);
    const title = nameMatch ? cleanText(nameMatch[1]) : `Bölüm ${episode}`;
    const imgMatch = body.match(/<img[^>]+src="([^"]+)"/i);
    const still = imgMatch ? makeAbsolute(imgMatch[1]) : '';

    episodes.push({
      id: url,
      title: `${season}. Sezon ${episode}. Bölüm: ${title}`,
      seasonNumber: season,
      episodeNumber: episode,
      season: season,
      episode: episode,
      url: url,
      href: url,
      image: still
    });
  }
  return episodes;
}

/**
 * Extract episodes handler
 */
async function extractEpisodes(targetUrl) {
  try {
    const isMovie = targetUrl.includes('/film/');
    if (isMovie) {
      return [{
        id: targetUrl,
        title: 'Full Movie',
        seasonNumber: 1,
        episodeNumber: 1,
        season: 1,
        episode: 1,
        url: targetUrl,
        href: targetUrl
      }];
    }

    const html = await httpGet(targetUrl);
    let allEpisodes = parseEpisodesFromHtml(html, 1);

    // Look for additional seasons in navigation: ?sezon=2#bolumler, ?sezon=3#bolumler, etc.
    const seasonMatches = [...html.matchAll(/[?&]sezon=(\d+)/gi)];
    const additionalSeasons = new Set();
    for (const sm of seasonMatches) {
      const sNum = parseInt(sm[1], 10);
      if (sNum > 1) additionalSeasons.add(sNum);
    }

    if (additionalSeasons.size > 0) {
      const sortedSeasons = Array.from(additionalSeasons).sort((a, b) => a - b);
      for (const sNum of sortedSeasons) {
        try {
          const sUrl = targetUrl.includes('?') ? `${targetUrl}&sezon=${sNum}` : `${targetUrl}?sezon=${sNum}`;
          const sHtml = await httpGet(sUrl);
          const sEps = parseEpisodesFromHtml(sHtml, sNum);
          allEpisodes.push(...sEps);
        } catch (_) {}
      }
    }

    if (!allEpisodes.length) {
      // Fallback single episode
      allEpisodes.push({
        id: targetUrl,
        title: '1. Bölüm',
        seasonNumber: 1,
        episodeNumber: 1,
        season: 1,
        episode: 1,
        url: targetUrl,
        href: targetUrl
      });
    }

    allEpisodes.sort((a, b) => (a.seasonNumber - b.seasonNumber) || (a.episodeNumber - b.episodeNumber));
    return allEpisodes;
  } catch (err) {
    return [{
      id: targetUrl,
      title: '1. Bölüm',
      seasonNumber: 1,
      episodeNumber: 1,
      season: 1,
      episode: 1,
      url: targetUrl,
      href: targetUrl
    }];
  }
}

/**
 * Extract video stream handler
 */
async function extractStreamUrl(pageUrl) {
  try {
    const html = await httpGet(pageUrl);

    // Find data-pv
    const pvMatch = html.match(/data-pv=["']([^"']+)["']/i);
    if (!pvMatch) throw new Error('data-pv not found on page');
    const slug = pvMatch[1];

    // Find base domain for pilavyer from script src
    const scriptMatch = html.match(/<script[^>]+src=["'](https?:\/\/[^\/]*pilavyer[^\/]*)\/assets\/js\/core\.js/i) ||
                        html.match(/<script[^>]+src=["'](https?:\/\/[^"']*)\/assets\/js\/core\.js/i);
    const pilavyerBase = scriptMatch ? scriptMatch[1] : 'https://play2.pilavyerplay.top';

    const sUrl = `${pilavyerBase}/assets/js/s.php?s=${slug}`;
    const sText = await httpGet(sUrl, { 'Referer': BASE_URL + '/' });

    // Parse player configuration
    const playerMatch = sText.match(/window\.__PLAYER__\s*=\s*(\{[\s\S]*?\});/);
    if (!playerMatch) throw new Error('window.__PLAYER__ not found in player HTML');

    const config = JSON.parse(playerMatch[1]);
    const streamUrl = String(config.stream || '').replace(/\\u0026/g, '&');
    if (!streamUrl) throw new Error('Stream URL missing in player configuration');

    // Fetch and inline subtitles so iOS AVPlayer doesn't fail with 403
    const subtitles = [];
    if (Array.isArray(config.subs)) {
      for (const s of config.subs) {
        if (!s.src) continue;
        const subUrl = String(s.src).replace(/\\u0026/g, '&');
        const subLabel = s.label || 'Türkçe Altyazı';
        let vttContent = '';
        try {
          vttContent = await httpGet(subUrl, { 'Referer': `${pilavyerBase}/` });
        } catch (_) {}

        subtitles.push({
          url: subUrl,
          label: subLabel,
          language: s.lang || 'tr',
          format: 'vtt',
          isDefault: s.default === 1 || subtitles.length === 0,
          content: vttContent
        });
      }
    }

    return {
      url: streamUrl,
      streams: ['sub 1080p', streamUrl],
      streamType: 'hls',
      quality: '1080p',
      servers: [{
        name: 'Pilavyer HLS',
        label: 'Dizigom · HLS (Çift Ses & Türkçe Altyazı)',
        audioLanguage: 'tr',
        audioLanguages: ['tr', 'en'],
        qualities: [{
          label: 'Auto (1080p HLS)',
          url: streamUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': BASE_URL + '/'
          }
        }],
        subtitles: subtitles
      }],
      subtitles: subtitles,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': BASE_URL + '/'
      }
    };
  } catch (err) {
    return {
      url: pageUrl,
      streams: ['Source', pageUrl],
      headers: {},
      streamType: 'hls',
      quality: '1080p',
      subtitles: [],
      servers: []
    };
  }
}

/**
 * Dedicated Subtitles extractor
 */
async function extractSubtitles(episodeUrl) {
  try {
    const stream = await extractStreamUrl(episodeUrl);
    return stream.subtitles || [];
  } catch (_) {
    return [];
  }
}

/**
 * Discovery Home handler
 */
async function discoveryHome() {
  try {
    const html = await httpGet(BASE_URL + '/');
    const items = [];
    const seen = new Set();
    const linkRegex = /<a[^>]+href="([^"]*\/(?:dizi|film)\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;

    while ((m = linkRegex.exec(html)) !== null) {
      const itemUrl = makeAbsolute(m[1]);
      if (seen.has(itemUrl)) continue;
      seen.add(itemUrl);

      const block = m[2];
      const imgMatch = block.match(/src="([^"]+)"/i);
      const titleMatch = block.match(/<(?:h2|h3|h4|span|div|p)[^>]*class="[^"]*(?:title|name|font-semibold)[^"]*"[^>]*>([\s\S]*?)<\//i);
      let title = titleMatch ? cleanText(titleMatch[1]) : '';
      if (!title) {
        const slug = itemUrl.split('/').filter(Boolean).pop();
        title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      const cover = imgMatch ? makeAbsolute(imgMatch[1]) : '';
      const isSeries = itemUrl.includes('/dizi/');

      items.push({
        id: itemUrl,
        title: title,
        url: itemUrl,
        href: itemUrl,
        image: cover,
        poster: cover,
        coverUrl: cover,
        isSeries: isSeries,
        type: isSeries ? 'series' : 'movie'
      });
      if (items.length >= 30) break;
    }

    const sections = [];
    if (items.length > 0) {
      sections.push({
        id: 'dizigom_popular',
        title: 'Popüler Dizi ve Filmler',
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
globalThis.extractSubtitles = extractSubtitles;
globalThis.discoveryHome = discoveryHome;
globalThis.discoveryFeed = discoveryFeed;
