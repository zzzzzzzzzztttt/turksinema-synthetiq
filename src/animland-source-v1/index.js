/**
 * Animland Anime Source Module - Synthetiq Player
 * Target: Animland (https://www.animland.net / https://api.animland.net)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Direct 1080p MP4 streams (No P2P, No Cloudflare Turnstile blocks)
 *   - Multilingual subtitles (Turkish, English, French, German, Italian)
 *   - Strict adherence to absolute HTTPS URLs (prevents iOS AVPlayer -1002 error)
 */

const BASE_URL = 'https://www.animland.net';
const API_URL = 'https://api.animland.net';

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
 * Robust HTTP GET with fetchv2 signature
 */
async function httpGet(url, customHeaders = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': BASE_URL + '/',
    'Origin': BASE_URL,
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

function parseCards(jsonText) {
  try {
    const parsed = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    const list = (parsed && parsed.page && Array.isArray(parsed.page.data))
      ? parsed.page.data
      : (parsed && Array.isArray(parsed.data) ? parsed.data : (Array.isArray(parsed) ? parsed : []));

    return list.map(item => {
      const animeId = item.ID || item.id;
      const webUrl = `${BASE_URL}/anime-detail/${animeId}`;
      const cover = item.poster || item.logo || item.details_banner || '';
      return {
        id: webUrl,
        title: cleanText(item.name || item.name_tr || item.name_jp),
        href: webUrl,
        url: webUrl,
        image: cover,
        poster: cover,
        coverUrl: cover
      };
    }).filter(it => it.title && it.title.length > 0);
  } catch (_) {
    return [];
  }
}

/**
 * Discovery Home handler
 */
async function discoveryHome() {
  try {
    const [newAnimeRaw, topAnimeRaw] = await Promise.all([
      httpGet(API_URL + '/page/new-anime').catch(() => ''),
      httpGet(API_URL + '/page/search?value=death&page=1').catch(() => '')
    ]);

    const newCards = parseCards(newAnimeRaw);
    const topCards = parseCards(topAnimeRaw);

    const sections = [];
    if (topCards.length > 0) {
      sections.push({
        id: 'animland-hero',
        title: 'Öne Çıkan Animeler',
        style: 'hero',
        items: topCards.slice(0, 6),
        viewAll: { mode: 'feed', feedId: 'hero' }
      });

      if (topCards.length >= 10) {
        sections.push({
          id: 'animland-top10',
          title: 'En Çok İzlenen 10 Anime',
          style: 'top10',
          items: topCards.slice(0, 10),
          viewAll: { mode: 'feed', feedId: 'top10' }
        });
      }
    }

    if (newCards.length > 0) {
      sections.push({
        id: 'animland-latest',
        title: 'Yeni Eklenen Animeler',
        style: 'poster',
        items: newCards,
        viewAll: { mode: 'feed', feedId: 'latest' }
      });
    }

    return { sections: sections };
  } catch (err) {
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
  } catch (err) {
    return { items: [], page: 1, hasMore: false };
  }
}

// Module Exports
globalThis.searchResults = searchResults;
globalThis.extractDetails = extractDetails;
globalThis.extractEpisodes = extractEpisodes;
globalThis.extractSubtitles = extractSubtitles;
globalThis.extractStreamUrl = extractStreamUrl;
globalThis.discoveryHome = discoveryHome;
globalThis.discoveryFeed = discoveryFeed;
