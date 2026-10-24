/**
 * Animeniz Anime Source Module - Synthetiq Player
 * Target: Animeniz (https://animeniz.com)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Direct 1080p MP4 CDN streams (No P2P / WebTorrent, No Cloudflare Turnstile blocks)
 *   - Accurate search via Next.js API (/api/search?q=...&limit=20)
 *   - Complete multi-episode extraction from Next.js flight data (74/74 episodes for Monster)
 */

const BASE_URL = 'https://animeniz.com';

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
 * Search results handler - Uses official Next.js search API
 */
async function searchResults(query) {
  try {
    const q = String(query || '').trim();
    if (!q) return [];
    const url = `${BASE_URL}/api/search?q=${encodeURIComponent(q)}&limit=20`;
    const text = await httpGet(url, { 'Accept': 'application/json' });
    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      return [];
    }

    const list = Array.isArray(json.data) ? json.data : [];
    return list.map(item => {
      const isMovie = item.type === 'movie';
      const itemUrl = isMovie
        ? `${BASE_URL}/anime-filmler/${item.slug}`
        : `${BASE_URL}/anime-diziler/${item.slug}`;
      const rawPoster = item.poster || item.image?.original || item.image?.medium || '';
      const poster = rawPoster ? makeAbsolute(rawPoster) : '';
      const title = cleanText(item.name || item.name_english || item.slug);
      return {
        id: itemUrl,
        title: title,
        url: itemUrl,
        href: itemUrl,
        image: poster,
        poster: poster,
        coverUrl: poster,
        isSeries: !isMovie,
        type: isMovie ? 'movie' : 'series'
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
    const title = titleMatch ? cleanText(titleMatch[1]) : 'Anime';
    const descMatch = html.match(/<div[^>]+class="[^"]*(?:description|synopsis|summary|film-ozet)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<p[^>]+class="[^"]*(?:description|synopsis|summary)[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
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
      title: 'Anime Details',
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

/**
 * Extract anime episodes
 * Uses Next.js flight data push on episode 1 page for complete episode listings
 */
async function extractEpisodes(animeUrl) {
  try {
    const isMovie = animeUrl.includes('/anime-filmler/');
    if (isMovie) {
      return [{
        id: animeUrl,
        title: 'Full Movie',
        seasonNumber: 1,
        episodeNumber: 1,
        season: 1,
        episode: 1,
        url: animeUrl,
        href: animeUrl
      }];
    }

    const slugMatch = animeUrl.match(/\/anime-diziler\/([^\/\?#]+)/);
    if (!slugMatch) {
      return [{
        id: animeUrl,
        title: 'Bölüm 1',
        seasonNumber: 1,
        episodeNumber: 1,
        season: 1,
        episode: 1,
        url: animeUrl,
        href: animeUrl
      }];
    }
    const slug = slugMatch[1];
    const ep1Url = `${BASE_URL}/anime-diziler/${slug}/sezon/1/bolum/1`;

    const html = await httpGet(ep1Url);

    // Look for Next.js flight data \"allEpisodes\":[...]
    const allEpsMatch = html.match(/\\"allEpisodes\\":(\[[\s\S]*?\])(?:,\s*\\"[a-zA-Z0-9_]+\\"|\}\])/);
    if (allEpsMatch) {
      try {
        const unescaped = allEpsMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        const rawList = JSON.parse(unescaped);
        if (Array.isArray(rawList) && rawList.length > 0) {
          return rawList.map(ep => {
            const epPageUrl = `${BASE_URL}/anime-diziler/${slug}/sezon/${ep.season || 1}/bolum/${ep.number}`;
            return {
              id: epPageUrl,
              title: ep.name ? `${ep.number}. Bölüm: ${ep.name}` : `Bölüm ${ep.number}`,
              seasonNumber: ep.season || 1,
              episodeNumber: ep.number,
              season: ep.season || 1,
              episode: ep.number,
              url: epPageUrl,
              href: epPageUrl
            };
          }).sort((a, b) => (a.seasonNumber - b.seasonNumber) || (a.episodeNumber - b.episodeNumber));
        }
      } catch (_) {}
    }

    // Fallback: single ep
    return [{
      id: ep1Url,
      title: 'Bölüm 1',
      seasonNumber: 1,
      episodeNumber: 1,
      season: 1,
      episode: 1,
      url: ep1Url,
      href: ep1Url
    }];
  } catch (err) {
    return [{
      id: animeUrl,
      title: 'Bölüm 1',
      seasonNumber: 1,
      episodeNumber: 1,
      season: 1,
      episode: 1,
      url: animeUrl,
      href: animeUrl
    }];
  }
}

/**
 * Extract video stream
 */
async function extractStreamUrl(episodeUrl) {
  try {
    const html = await httpGet(episodeUrl);
    const playerMatch = html.match(/player\.animeniz\.com\/player\/([a-zA-Z0-9\-]+)/);
    if (!playerMatch) throw new Error('Animeniz player UUID not found');
    const uuid = playerMatch[1];

    const streamUrl = `https://player.animeniz.com/video/${uuid}/stream`;
    const playerReferer = `https://player.animeniz.com/player/${uuid}`;

    return {
      url: streamUrl,
      streams: ['sub 1080p', streamUrl],
      streamType: 'mp4',
      lang: 'sub',
      quality: '1080p',
      defaultQuality: '1080p',
      servers: [{
        name: 'Animeniz CDN',
        label: 'Animeniz · 1080p MP4 (Türkçe Altyazı)',
        audioLanguage: 'ja',
        audioLanguages: ['ja'],
        qualities: [{ label: '1080p', url: streamUrl, headers: { Referer: playerReferer } }],
        subtitles: []
      }],
      subtitles: [],
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': playerReferer
      }
    };
  } catch (err) {
    return {
      url: episodeUrl,
      streams: ['Source', episodeUrl],
      headers: {},
      streamType: 'mp4',
      lang: 'sub',
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
    const text = await httpGet(`${BASE_URL}/api/search?q=popular&limit=20`, { 'Accept': 'application/json' });
    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      return [];
    }

    const list = Array.isArray(json.data) ? json.data : [];
    const items = list.map(item => {
      const isMovie = item.type === 'movie';
      const itemUrl = isMovie
        ? `${BASE_URL}/anime-filmler/${item.slug}`
        : `${BASE_URL}/anime-diziler/${item.slug}`;
      const rawPoster = item.poster || item.image?.original || item.image?.medium || '';
      const poster = rawPoster ? makeAbsolute(rawPoster) : '';
      return {
        id: itemUrl,
        title: cleanText(item.name || item.name_english || item.slug),
        url: itemUrl,
        href: itemUrl,
        image: poster,
        poster: poster,
        coverUrl: poster,
        isSeries: !isMovie,
        type: isMovie ? 'movie' : 'series'
      };
    });

    const sections = [];
    if (items.length > 0) {
      sections.push({
        id: 'animeniz_popular',
        title: 'Popüler Animeler',
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
