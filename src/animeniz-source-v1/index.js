/**
 * Animeniz Anime Source Module - Synthetiq Player
 * Target: Animeniz (https://animeniz.com)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Direct 1080p MP4 CDN streams (No P2P / WebTorrent, No Cloudflare Turnstile blocks)
 *   - Accurate search via Next.js API (/api/search?q=...&limit=20) with punctuation tolerance
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

  // 1. Check res.body (string from fetchv2 or custom shim)
  if (typeof res.body === 'string' && res.body) return res.body;

  // 2. Check res.text() (standard fetch Response in Node / Web)
  if (typeof res.text === 'function') {
    try {
      const t = await res.text();
      if (typeof t === 'string' && t) return t;
    } catch (_) {}
  }

  // 3. Check res.json (Synthetiq native fetchv2 JSON property)
  if (res.json != null) {
    try {
      const v = typeof res.json === 'function' ? await res.json() : res.json;
      if (v != null) return typeof v === 'string' ? v : JSON.stringify(v);
    } catch (_) {}
  }

  return '';
}

/**
 * Search results handler - Uses official Next.js search API with punctuation tolerance
 */
async function searchResults(query) {
  try {
    const q = String(query || '').trim();
    if (!q) return [];

    const candidatesToTry = [q];
    // If query has 're zero' or 'rezero', add 're:zero'
    if (/re\s*zero/i.test(q) && !q.includes(':')) {
      candidatesToTry.push(q.replace(/re\s*zero/gi, 're:zero'));
    } else if (q.includes(':')) {
      candidatesToTry.push(q.replace(/:/g, ' '));
    }

    let list = [];
    for (const c of candidatesToTry) {
      const url = `${BASE_URL}/api/search?q=${encodeURIComponent(c)}&limit=20`;
      const text = await httpGet(url, { 'Accept': 'application/json' });
      if (!text) continue;
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json.data) && json.data.length > 0) {
          list = json.data;
          break;
        }
      } catch (_) {}
    }

    if (!Array.isArray(list) || list.length === 0) return [];

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
    if (!playerMatch) throw new Error('Animeniz player UUID not found on episode page');
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
      streams: [],
      subtitles: [],
      error: { message: err ? err.message : 'Animeniz stream extraction failed' }
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

    if (html && html.includes('<h2')) {
      const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
      let match;
      const headings = [];
      while ((match = h2Regex.exec(html)) !== null) {
        const title = match[1].replace(/<[^>]+>/g, '').trim();
        if (title && !title.toLowerCase().includes('animeniz')) {
          headings.push({ title, index: match.index });
        }
      }

      const sectionsMap = new Map();
      for (let i = 0; i < headings.length; i++) {
        const cur = headings[i];
        const nextIdx = (i + 1 < headings.length) ? headings[i + 1].index : html.indexOf('</main>');
        const sectionHtml = html.substring(cur.index, nextIdx > cur.index ? nextIdx : cur.index + 50000);

        const cards = [];
        const cardRegex = /<a[^>]+href="(\/anime-(?:diziler|filmler)\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let cm;
        while ((cm = cardRegex.exec(sectionHtml)) !== null) {
          const href = makeAbsolute(cm[1]);
          const inner = cm[2];
          const imgMatch = inner.match(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"/i) || inner.match(/<img[^>]+alt="([^"]*)"[^>]*src="([^"]+)"/i);
          const isAltFirst = !!inner.match(/<img[^>]+alt="([^"]*)"[^>]*src="([^"]+)"/i);
          const poster = imgMatch ? makeAbsolute(isAltFirst ? imgMatch[2] : imgMatch[1]) : '';
          const rawTitle = imgMatch ? (isAltFirst ? imgMatch[1] : imgMatch[2]) : '';
          const title = cleanText(rawTitle) || href.split('/').pop().replace(/-/g, ' ');

          const ratingMatch = inner.match(/<span[^>]*class="[^"]*font-semibold[^"]*"[^>]*>([\d\.]+)<\/span>/i);
          const rating = ratingMatch ? ratingMatch[1] : '';
          const isMovie = href.includes('/anime-filmler/');

          if (href && title) {
            cards.push({
              id: href,
              url: href,
              href: href,
              title: title,
              image: poster,
              poster: poster,
              coverUrl: poster,
              backdrop: poster,
              type: isMovie ? 'movie' : 'tv',
              isSeries: !isMovie,
              badge: rating ? '★ ' + rating : 'Anime'
            });
          }
        }
        if (cards.length > 0) {
          sectionsMap.set(cur.title, cards);
        }
      }

      const popular = sectionsMap.get('Popüler Animeler') || [];
      const topRated = sectionsMap.get('En Yüksek Oy Alanlar') || [];
      const action = sectionsMap.get('Action') || sectionsMap.get('Action-Adventure') || [];
      const scifi = sectionsMap.get('Science-Fiction') || [];
      const comedy = sectionsMap.get('Comedy') || [];
      const adventure = sectionsMap.get('Adventure') || [];

      // 1. Hero Carousel (Top 6-8 popular anime with big backdrop banners)
      if (popular.length > 0) {
        sections.push({
          id: 'animeniz-hero',
          title: 'Öne Çıkanlar & Trendler',
          style: 'hero',
          items: popular.slice(0, 8),
          viewAll: { mode: 'feed', feedId: 'popular' }
        });
      }

      // 2. Top 10 Shelf (Ranked 1..10)
      if (topRated.length >= 10 || popular.length >= 10) {
        const topSource = topRated.length >= 10 ? topRated : popular;
        sections.push({
          id: 'animeniz-top10',
          title: 'En Çok İzlenen 10 Anime',
          style: 'top10',
          items: topSource.slice(0, 10),
          viewAll: { mode: 'feed', feedId: 'top10' }
        });
      }

      // 3. Popüler Animeler
      if (popular.length > 0) {
        sections.push({
          id: 'animeniz-popular',
          title: 'Popüler Animeler',
          style: 'poster',
          items: popular,
          viewAll: { mode: 'feed', feedId: 'popular' }
        });
      }

      // 4. En Yüksek Oy Alanlar
      if (topRated.length > 0) {
        sections.push({
          id: 'animeniz-toprated',
          title: 'En Yüksek Puanlılar (Top Rated)',
          style: 'poster',
          items: topRated,
          viewAll: { mode: 'feed', feedId: 'toprated' }
        });
      }

      // 5. Aksiyon & Dövüş
      if (action.length > 0) {
        sections.push({
          id: 'animeniz-action',
          title: 'Aksiyon & Dövüş',
          style: 'poster',
          items: action,
          viewAll: { mode: 'feed', feedId: 'action' }
        });
      }

      // 6. Bilim Kurgu & Doğaüstü
      if (scifi.length > 0) {
        sections.push({
          id: 'animeniz-scifi',
          title: 'Bilim Kurgu & Doğaüstü',
          style: 'poster',
          items: scifi,
          viewAll: { mode: 'feed', feedId: 'scifi' }
        });
      }

      // 7. Komedi & Eğlence
      if (comedy.length > 0) {
        sections.push({
          id: 'animeniz-comedy',
          title: 'Komedi & Eğlence',
          style: 'poster',
          items: comedy,
          viewAll: { mode: 'feed', feedId: 'comedy' }
        });
      }

      // 8. Macera & Keşif
      if (adventure.length > 0) {
        sections.push({
          id: 'animeniz-adventure',
          title: 'Macera & Keşif',
          style: 'poster',
          items: adventure,
          viewAll: { mode: 'feed', feedId: 'adventure' }
        });
      }
    }

    // Fallback if HTML parsing yielded nothing
    if (sections.length === 0) {
      const text = await httpGet(BASE_URL + '/api/search?q=popular&limit=24', { 'Accept': 'application/json' });
      if (text) {
        let json;
        try { json = JSON.parse(text); } catch (_) {}
        const list = Array.isArray(json && json.data) ? json.data : [];
        const items = list.map(item => {
          const isMovie = item.type === 'movie';
          const itemUrl = isMovie
            ? BASE_URL + '/anime-filmler/' + item.slug
            : BASE_URL + '/anime-diziler/' + item.slug;
          const rawPoster = item.poster || (item.image && (item.image.original || item.image.medium)) || '';
          const poster = rawPoster ? makeAbsolute(rawPoster) : '';
          return {
            id: itemUrl,
            title: cleanText(item.name || item.name_english || item.slug),
            url: itemUrl,
            href: itemUrl,
            image: poster,
            poster: poster,
            coverUrl: poster,
            backdrop: poster,
            isSeries: !isMovie,
            type: isMovie ? 'movie' : 'tv',
            badge: 'Anime'
          };
        });
        if (items.length > 0) {
          sections.push({
            id: 'animeniz-hero',
            title: 'Öne Çıkan Anime',
            style: 'hero',
            items: items.slice(0, 6),
            viewAll: { mode: 'feed', feedId: 'popular' }
          });
          sections.push({
            id: 'animeniz-popular',
            title: 'Popüler Animeler',
            style: 'poster',
            items: items,
            viewAll: { mode: 'feed', feedId: 'popular' }
          });
        }
      }
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
globalThis.extractStreamUrl = extractStreamUrl;
globalThis.discoveryHome = discoveryHome;
globalThis.discoveryFeed = discoveryFeed;
