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
      const backdrop = item.details_banner || item.banner || cover;
      return {
        id: webUrl,
        title: cleanText(item.name || item.name_tr || item.name_jp),
        href: webUrl,
        url: webUrl,
        image: cover,
        poster: cover,
        coverUrl: cover,
        backdrop: backdrop,
        rating: item.imdb_point ? String(item.imdb_point) : undefined
      };
    }).filter(it => it.title && it.poster && it.poster.length > 5);
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
      httpGet(`${API_URL}/page/new-anime`).catch(() => ''),
      httpGet(`${API_URL}/page/top?platform=all&page=1`).catch(() => '')
    ]);

    const newCards = parseCards(newAnimeRaw);
    const topCards = parseCards(topAnimeRaw);

    const sections = [];
    if (newCards.length > 0) {
      sections.push({
        id: 'animland-hero',
        title: 'Öne Çıkan Animeler',
        style: 'hero',
        items: newCards.slice(0, 6),
        viewAll: { mode: 'feed', feedId: 'hero' }
      });
    }

    if (topCards.length >= 10) {
      sections.push({
        id: 'animland-top10',
        title: 'Günün En Çok İzlenen 10 Animesi',
        style: 'top10',
        items: topCards.slice(0, 10),
        viewAll: { mode: 'feed', feedId: 'top10' }
      });
    }

    if (newCards.length > 6) {
      sections.push({
        id: 'yeni-animeler',
        title: 'Son Eklenen Animeler',
        style: 'poster',
        items: newCards.slice(6, 30),
        viewAll: { mode: 'feed', feedId: 'new' }
      });
    }

    if (topCards.length > 0) {
      sections.push({
        id: 'populer-animeler',
        title: 'Popüler Animeler',
        style: 'poster',
        items: topCards.slice(0, 24),
        viewAll: { mode: 'feed', feedId: 'popular' }
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
async function discoveryFeed(feedId, page) {
  try {
    const p = Math.max(1, Number(page) || 1);
    const raw = await httpGet(`${API_URL}/page/search?value=a&page=${p}`);
    const items = parseCards(raw);
    return {
      feedId: feedId || 'popular',
      page: p,
      items: items.slice(0, 30),
      hasMore: items.length >= 10
    };
  } catch (err) {
    return {
      feedId: feedId || 'popular',
      page: page || 1,
      items: [],
      hasMore: false
    };
  }
}

/**
 * Search handler
 */
async function searchResults(query, page = 1) {
  try {
    const q = String(query || '').trim();
    if (!q) return [];

    const searchUrl = `${API_URL}/page/search?value=${encodeURIComponent(q)}&page=${page}`;
    const raw = await httpGet(searchUrl);
    const items = parseCards(raw);

    // Score by query relevance so exact matches (e.g. Death Note) rank first
    const qLower = q.toLowerCase();
    const qWords = qLower.split(/\s+/).filter(w => w.length > 1);

    items.sort((a, b) => {
      const aTitle = String(a.title || '').toLowerCase();
      const bTitle = String(b.title || '').toLowerCase();

      let aScore = 0;
      let bScore = 0;

      if (aTitle === qLower) aScore += 1000;
      if (bTitle === qLower) bScore += 1000;

      if (aTitle.startsWith(qLower)) aScore += 500;
      if (bTitle.startsWith(qLower)) bScore += 500;

      if (aTitle.indexOf(qLower) !== -1) aScore += 250;
      if (bTitle.indexOf(qLower) !== -1) bScore += 250;

      qWords.forEach(w => {
        if (aTitle.indexOf(w) !== -1) aScore += 60;
        if (bTitle.indexOf(w) !== -1) bScore += 60;
      });

      return bScore - aScore;
    });

    return items.slice(0, 40);
  } catch (err) {
    return [];
  }
}

function extractAnimeId(url) {
  const match = String(url).match(/(?:anime-detail|watch)\/(\d+)/i) || String(url).match(/[?&]id=(\d+)/i);
  return match ? match[1] : '';
}

/**
 * Details handler
 */
async function extractDetails(url) {
  try {
    const id = extractAnimeId(url);
    if (!id) throw new Error('No anime ID found in URL: ' + url);

    const raw = await httpGet(`${API_URL}/anime/get?id=${id}`);
    const parsed = JSON.parse(raw);
    const data = parsed.data || parsed;

    const title = cleanText(data.name || data.name_tr || data.name_jp || 'Anime');
    const desc = cleanText(data.overview_short || data.overview || '');
    const cover = data.details_banner || data.poster || data.banner || '';
    const canonicalUrl = `${BASE_URL}/anime-detail/${id}`;

    return {
      id: canonicalUrl,
      title: title,
      description: desc,
      coverUrl: cover,
      image: cover,
      poster: cover,
      url: canonicalUrl,
      href: canonicalUrl
    };
  } catch (err) {
    return {
      id: url,
      title: 'Anime',
      description: '',
      coverUrl: '',
      image: '',
      poster: '',
      url: url,
      href: url
    };
  }
}

/**
 * Episodes handler
 * Always returns absolute HTTPS URLs (e.g. https://www.animland.net/watch/<id>?season=1&episode=1)
 */
async function extractEpisodes(url) {
  try {
    const id = extractAnimeId(url);
    if (!id) throw new Error('No anime ID found in URL: ' + url);

    const raw = await httpGet(`${API_URL}/anime/get?id=${id}`);
    const parsed = JSON.parse(raw);
    const data = parsed.data || parsed;
    const episodes = [];

    if (Array.isArray(data.seasons)) {
      data.seasons.forEach(s => {
        const sNum = s.number || 1;
        if (Array.isArray(s.episodes)) {
          s.episodes.forEach(ep => {
            const epNum = ep.number || (episodes.length + 1);
            const epTitle = ep.name ? `S${sNum}E${epNum} - ${ep.name}` : `Bölüm ${epNum}`;
            const epUrl = `${BASE_URL}/watch/${id}?season=${sNum}&episode=${epNum}`;

            episodes.push({
              id: epUrl,
              title: epTitle,
              url: epUrl,
              href: epUrl,
              season: sNum,
              episode: epNum
            });
          });
        }
      });
    }

    return episodes;
  } catch (err) {
    return [
      {
        id: url,
        title: 'Bölüm 1',
        url: url,
        href: url,
        season: 1,
        episode: 1
      }
    ];
  }
}

/**
 * Stream extractor
 * Resolves to the direct unblocked 1080p MP4 stream and WebVTT subtitles
 */
async function extractStreamUrl(targetUrl, want = 'sub') {
  try {
    const id = extractAnimeId(targetUrl);
    const sMatch = String(targetUrl).match(/[?&]season=(\d+)/i);
    const eMatch = String(targetUrl).match(/[?&]episode=(\d+)/i);

    const season = sMatch ? sMatch[1] : '1';
    const episode = eMatch ? eMatch[1] : '1';

    const sourceUrl = `${API_URL}/anime/source?id=${id}&season=${season}&episode=${episode}&server=1`;
    const raw = await httpGet(sourceUrl);
    const parsed = JSON.parse(raw);

    let streamUrl = '';
    if (Array.isArray(parsed.groups) && parsed.groups.length > 0) {
      for (const g of parsed.groups) {
        if (Array.isArray(g.items) && g.items.length > 0 && g.items[0].link) {
          streamUrl = g.items[0].link;
          break;
        }
      }
    }

    if (!streamUrl) {
      throw new Error('Animland stream URL not found in API response');
    }

    const subtitles = [];
    if (Array.isArray(parsed.subtitles)) {
      for (const s of parsed.subtitles) {
        if (s && s.link) {
          let vttContent = '';
          try {
            const rawVtt = await httpGet(s.link, { Referer: BASE_URL + '/', Origin: BASE_URL });
            if (rawVtt && rawVtt.indexOf('-->') !== -1) {
              vttContent = rawVtt.replace(/^\uFEFF/, '').trim();
            }
          } catch (_) {}

          subtitles.push({
            id: s.link,
            url: s.link,
            file: s.link,
            label: s.name || (s.group === 'tr' ? 'Türkçe' : 'English'),
            language: s.group || 'tr',
            lang: s.group || 'tr',
            kind: 'subtitle',
            default: s.group === 'tr',
            content: vttContent || undefined,
            format: 'vtt',
            headers: {
              Referer: BASE_URL + '/',
              Origin: BASE_URL
            }
          });
        }
      }
    }

    const qualityLabel = '1080p';
    const streamLabel = (want === 'dub' ? 'dub ' : 'sub ') + qualityLabel;

    return {
      url: streamUrl,
      streams: [streamLabel, streamUrl],
      headers: { Referer: BASE_URL + '/' },
      streamType: 'mp4',
      lang: 'sub',
      quality: qualityLabel,
      defaultQuality: qualityLabel,
      qualities: [{ label: qualityLabel, url: streamUrl, headers: { Referer: BASE_URL + '/' } }],
      servers: [{
        name: 'Animland',
        label: 'Animland · 1080p MP4 (Direct)',
        url: streamUrl,
        headers: { Referer: BASE_URL + '/' },
        streamType: 'mp4',
        lang: 'sub',
        audioLanguage: 'ja',
        audioLanguages: ['ja'],
        qualities: [{ label: qualityLabel, url: streamUrl, headers: { Referer: BASE_URL + '/' } }],
        subtitles: subtitles
      }],
      subtitles: subtitles,
      captions: subtitles
    };
  } catch (err) {
    return {
      url: targetUrl,
      streams: ['Source', targetUrl],
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

async function extractSubtitles(episodeHref, language = 'tr') {
  try {
    const stream = await extractStreamUrl(episodeHref);
    return stream.subtitles || [];
  } catch (_) {
    return [];
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
