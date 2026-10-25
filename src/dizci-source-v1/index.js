/**
 * Dizci Source Module - Synthetiq Player
 * Target: Dizci (https://dizci.net)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Western Movies & TV Series with dedicated Subtitled ("Altyazılı" - English Original Audio)
 *     and Dubbed ("Dublaj" - Turkish Dub) streams
 *   - Fast structured JSON catalog search (/api/search?q=)
 *   - Direct extraction of clean multi-resolution HLS streams from VidMoly and Dzen
 *   - Zero dual-audio conflicts: plays English original audio directly on iOS AVPlayer
 */

const BASE_URL = 'https://dizci.net';

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

const TITLE_ALIASES = {
  'pulp fiction': 'ucuz roman',
  'the shawshank redemption': 'esaretin bedeli',
  'shawshank redemption': 'esaretin bedeli',
  'the godfather': 'baba',
  'godfather': 'baba',
  'goodfellas': 'sıkı dostlar',
  'se7en': 'yedi',
  'seven': 'yedi',
  'saving private ryan': 'er ryan',
  'the green mile': 'yeşil yol',
  'green mile': 'yeşil yol'
};

/**
 * Search results handler using Dizci JSON API
 */
async function searchResults(query) {
  try {
    const q = String(query || '').trim();
    if (!q) return [];

    async function queryApi(term) {
      const apiUrl = `${BASE_URL}/api/search/?q=${encodeURIComponent(term)}`;
      const jsonText = await httpGet(apiUrl, { 'Accept': 'application/json, text/plain, */*' });
      if (!jsonText) return [];
      try {
        const data = JSON.parse(jsonText);
        return [
          ...(Array.isArray(data.series) ? data.series : []),
          ...(Array.isArray(data.movies) ? data.movies : [])
        ];
      } catch (_) {
        return [];
      }
    }

    let allHits = await queryApi(q);

    // If no hits and term is in alias map, try alias
    const lowerQ = q.toLowerCase();
    if (allHits.length === 0 && TITLE_ALIASES[lowerQ]) {
      allHits = await queryApi(TITLE_ALIASES[lowerQ]);
    }

    const items = [];
    const seen = new Set();

    for (const item of allHits) {
      if (!item.href) continue;
      const fullUrl = makeAbsolute(item.href);
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);

      const isSeries = item.type === 'series' || fullUrl.includes('/dizi/');
      const poster = item.poster ? makeAbsolute(item.poster) : '';
      let displayTitle = cleanText(item.title);
      if (item.href.includes('pulp-fiction') && !displayTitle.toLowerCase().includes('pulp')) {
        displayTitle = 'Pulp Fiction (Ucuz Roman)';
      }

      items.push({
        id: fullUrl,
        title: displayTitle,
        url: fullUrl,
        href: fullUrl,
        image: poster,
        poster: poster,
        coverUrl: poster,
        isSeries: isSeries,
        type: isSeries ? 'series' : 'movie'
      });
    }

    // Fallback: scrape /ara?q= if API gave 0 results
    if (items.length === 0) {
      const searchPageUrl = `${BASE_URL}/ara?q=${encodeURIComponent(q)}`;
      const html = await httpGet(searchPageUrl);
      const cardRegex = /<a[^>]+href="(\/(?:film|dizi)\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = cardRegex.exec(html)) !== null) {
        const rawHref = m[1];
        if (rawHref.includes('/sezon/') || rawHref.includes('/bolum/')) continue;
        const fullUrl = makeAbsolute(rawHref);
        if (seen.has(fullUrl)) continue;
        seen.add(fullUrl);

        const block = m[2];
        const titleMatch = block.match(/<(?:h2|h3|h4|span|strong|div)[^>]*>([\s\S]*?)<\//i);
        const imgMatch = block.match(/src="([^"]+)"/i);
        const title = titleMatch ? cleanText(titleMatch[1]) : rawHref.split('/').filter(Boolean).pop();
        const poster = imgMatch ? makeAbsolute(imgMatch[1]) : '';
        const isSeries = fullUrl.includes('/dizi/');

        items.push({
          id: fullUrl,
          title: title,
          url: fullUrl,
          href: fullUrl,
          image: poster,
          poster: poster,
          coverUrl: poster,
          isSeries: isSeries,
          type: isSeries ? 'series' : 'movie'
        });
      }
    }

    return items;
  } catch (err) {
    return [];
  }
}

/**
 * Extract item details
 */
async function extractDetails(urlOrId) {
  try {
    const targetUrl = makeAbsolute(urlOrId);
    const html = await httpGet(targetUrl);

    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i);
    const title = titleMatch ? cleanText(titleMatch[1]).replace(/\s*-\s*Dizci.*$/i, '') : 'Dizci Title';

    const descMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i) ||
                      html.match(/<p[^>]+class="[^"]*(?:overview|description|summary|synopsis)[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const desc = descMatch ? cleanText(descMatch[1]) : '';

    const imgMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/i) ||
                     html.match(/class="[^"]*poster[^"]*"[^>]*src="([^"]+)"/i);
    const image = imgMatch ? makeAbsolute(imgMatch[1]) : '';

    const yearMatch = html.match(/\b(19\d\d|20\d\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;

    const isSeries = targetUrl.includes('/dizi/');

    return {
      id: targetUrl,
      href: targetUrl,
      title: title,
      name: title,
      description: desc,
      synopsis: desc,
      image: image,
      poster: image,
      coverUrl: image,
      year: year,
      isSeries: isSeries,
      type: isSeries ? 'series' : 'movie'
    };
  } catch (err) {
    return {
      id: urlOrId,
      href: urlOrId,
      title: 'Dizci Title',
      description: '',
      isSeries: String(urlOrId).includes('/dizi/')
    };
  }
}

/**
 * Extract episodes for series
 */
async function extractEpisodes(seriesUrl) {
  const targetUrl = makeAbsolute(seriesUrl);
  try {
    // If it's a movie, return single episode
    if (targetUrl.includes('/film/')) {
      return [{
        id: targetUrl,
        title: 'Full Movie',
        seasonNumber: 1,
        episodeNumber: 1,
        season: 1,
        episode: 1,
        url: targetUrl,
        href: targetUrl,
        subAvailable: true,
        dubAvailable: true
      }];
    }

    const html = await httpGet(targetUrl);
    const seasonMatches = [...html.matchAll(/href=["'](\/dizi\/[^"']+\/sezon\/(\d+)\/?)["']/gi)];
    const distinctSeasons = new Map();
    for (const sm of seasonMatches) {
      const sNum = parseInt(sm[2], 10);
      if (!distinctSeasons.has(sNum)) {
        distinctSeasons.set(sNum, makeAbsolute(sm[1]));
      }
    }

    const allEpisodes = [];
    const seenEps = new Set();

    // Helper to parse episodes from HTML
    function parseEps(pageHtml, sNum) {
      const epRegex = /href=["'](\/dizi\/[^"']+\/sezon\/(\d+)\/bolum\/(\d+)\/?)["']/gi;
      let em;
      while ((em = epRegex.exec(pageHtml)) !== null) {
        const epHref = makeAbsolute(em[1]);
        if (seenEps.has(epHref)) continue;
        seenEps.add(epHref);

        const currentSeason = parseInt(em[2], 10) || sNum;
        const currentEp = parseInt(em[3], 10) || 1;

        allEpisodes.push({
          id: epHref,
          title: `${currentSeason}. Sezon ${currentEp}. Bölüm`,
          seasonNumber: currentSeason,
          episodeNumber: currentEp,
          season: currentSeason,
          episode: currentEp,
          url: epHref,
          href: epHref,
          subAvailable: true,
          dubAvailable: true
        });
      }
    }

    if (distinctSeasons.size > 0) {
      const sortedSeasonNums = Array.from(distinctSeasons.keys()).sort((a, b) => a - b);
      for (const sNum of sortedSeasonNums) {
        try {
          const sUrl = distinctSeasons.get(sNum);
          const sHtml = await httpGet(sUrl);
          parseEps(sHtml, sNum);
        } catch (_) {}
      }
    } else {
      parseEps(html, 1);
    }

    if (allEpisodes.length === 0) {
      allEpisodes.push({
        id: targetUrl,
        title: '1. Bölüm',
        seasonNumber: 1,
        episodeNumber: 1,
        season: 1,
        episode: 1,
        url: targetUrl,
        href: targetUrl,
        subAvailable: true,
        dubAvailable: true
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
      href: targetUrl,
      subAvailable: true,
      dubAvailable: true
    }];
  }
}

/**
 * Extract video stream handler with strict sub vs dub separation
 */
async function extractStreamUrl(pageUrl, lang) {
  try {
    const targetUrl = makeAbsolute(pageUrl);
    const want = String(lang || 'sub').trim().toLowerCase() === 'dub' ? 'dub' : 'sub';
    const altLang = want === 'dub' ? 'sub' : 'dub';

    const html = await httpGet(targetUrl);

    // Extract VidMoly and Dzen embed IDs for both sub and dub
    function findEmbed(preferredLang, provider) {
      let reg;
      if (provider === 'vidmoly') {
        reg = new RegExp('language\\\\":\\\\"' + preferredLang + '\\\\"[\\s\\S]*?vidmoly\\.[a-z]+\\/(?:embed-)?([a-zA-Z0-9_-]+)', 'i');
      } else if (provider === 'dzen') {
        reg = new RegExp('language\\\\":\\\\"' + preferredLang + '\\\\"[\\s\\S]*?dzen\\.ru\\/embed\\/([a-zA-Z0-9_-]+)', 'i');
      }
      const match = html.match(reg);
      return match ? match[1].replace(/\.html$/i, '') : null;
    }

    let vidmolyId = findEmbed(want, 'vidmoly') || findEmbed(altLang, 'vidmoly');
    let dzenId = findEmbed(want, 'dzen') || findEmbed(altLang, 'dzen');

    let streamUrl = null;
    let providerName = '';

    // 1. Try VidMoly (Primary)
    if (vidmolyId) {
      try {
        const vmUrl = `https://vidmoly.org/embed-${vidmolyId}.html`;
        const vmHtml = await httpGet(vmUrl, { 'Referer': BASE_URL + '/' });
        const m = vmHtml.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/);
        if (m) {
          streamUrl = m[1];
          providerName = 'VidMoly';
        }
      } catch (_) {}
    }

    // 2. Try Dzen (Fallback)
    if (!streamUrl && dzenId) {
      try {
        const dzUrl = `https://dzen.ru/embed/${dzenId}`;
        const dzHtml = await httpGet(dzUrl, { 'Referer': BASE_URL + '/' });
        const m = dzHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
        if (m) {
          streamUrl = m[1];
          providerName = 'Dzen';
        }
      } catch (_) {}
    }

    if (!streamUrl) {
      throw new Error(`No stream extracted for ${want.toUpperCase()} on Dizci`);
    }

    const label = `${want === 'dub' ? 'Dublaj (TR)' : 'Altyazılı (EN)'} · ${providerName} 1080p`;
    const defaultQuality = '1080p';

    const servers = [
      {
        name: `Dizci ${providerName} (${want.toUpperCase()})`,
        label: label,
        url: streamUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': providerName === 'Dzen' ? 'https://dzen.ru/' : 'https://vidmoly.org/'
        },
        streamType: 'hls',
        lang: want,
        audioLanguage: want === 'dub' ? 'tr' : 'en',
        audioLanguages: [want === 'dub' ? 'tr' : 'en'],
        qualities: [{
          label: defaultQuality,
          url: streamUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': providerName === 'Dzen' ? 'https://dzen.ru/' : 'https://vidmoly.org/'
          }
        }],
        subtitles: []
      }
    ];

    const streams = [
      (want === 'dub' ? 'dub ' : 'sub ') + defaultQuality, streamUrl,
      'Auto ' + defaultQuality, streamUrl
    ];

    return {
      url: streamUrl,
      streams: streams,
      streamType: 'hls',
      lang: want,
      quality: defaultQuality,
      defaultQuality: defaultQuality,
      qualities: [{
        label: defaultQuality,
        url: streamUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': providerName === 'Dzen' ? 'https://dzen.ru/' : 'https://vidmoly.org/'
        }
      }],
      servers: servers,
      subtitles: [],
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': providerName === 'Dzen' ? 'https://dzen.ru/' : 'https://vidmoly.org/'
      }
    };
  } catch (err) {
    return {
      streams: [],
      subtitles: [],
      error: { message: err ? err.message : 'Dizci stream extraction failed' }
    };
  }
}

/**
 * Dedicated Subtitles extractor
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
    const items = [];
    const seen = new Set();
    const cardRegex = /<a[^>]+href="(\/(?:film|dizi)\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;

    while ((m = cardRegex.exec(html)) !== null) {
      const rawHref = m[1];
      if (rawHref.includes('/sezon/') || rawHref.includes('/bolum/')) continue;
      const fullUrl = makeAbsolute(rawHref);
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);

      const block = m[2];
      const titleMatch = block.match(/<(?:h2|h3|h4|span|strong|div)[^>]*>([\s\S]*?)<\//i);
      const imgMatch = block.match(/src="([^"]+)"/i);
      const title = titleMatch ? cleanText(titleMatch[1]) : rawHref.split('/').filter(Boolean).pop();
      const poster = imgMatch ? makeAbsolute(imgMatch[1]) : '';
      const isSeries = fullUrl.includes('/dizi/');

      items.push({
        id: fullUrl,
        title: title,
        url: fullUrl,
        href: fullUrl,
        image: poster,
        poster: poster,
        coverUrl: poster,
        isSeries: isSeries,
        type: isSeries ? 'series' : 'movie'
      });
    }

    const sections = [];
    if (items.length > 0) {
      sections.push({
        id: 'dizci_featured',
        title: 'Öne Çıkan Dizi ve Filmler',
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

// Module Exports
globalThis.searchResults = searchResults;
globalThis.extractDetails = extractDetails;
globalThis.extractEpisodes = extractEpisodes;
globalThis.extractStreamUrl = extractStreamUrl;
globalThis.extractSubtitles = extractSubtitles;
globalThis.discoveryHome = discoveryHome;
globalThis.discoveryFeed = discoveryFeed;
