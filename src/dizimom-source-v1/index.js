/**
 * DiziMom Video Source Module - Synthetiq Player
 * Target: DiziMom (https://ddizimom.net)
 * Contract Version 3 | contentType: video
 * Features:
 *   - TV Series & Movies
 *   - Native iOS AVPlayer multi-audio HLS (Turkish Dub + English Original)
 *   - Exactly ONE stream object returned to prevent audio selector collisions
 */

const BASE_URL = 'https://ddizimom.net';

function makeAbsolute(path, base) {
  if (!path) return '';
  const trimmed = String(path).trim();
  if (trimmed.indexOf('http://') === 0 || trimmed.indexOf('https://') === 0) {
    return trimmed;
  }
  if (trimmed.indexOf('//') === 0) {
    return 'https:' + trimmed;
  }
  const cleanBase = String(base).replace(/\/+$/, '');
  if (trimmed.indexOf('/') === 0) {
    return cleanBase + trimmed;
  }
  return cleanBase + '/' + trimmed;
}

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
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
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

function parseCards(htmlChunk) {
  const items = [];
  const seenUrls = {};

  const cardRegex = /<a[^>]+href="([^"]*(?:\/film\/|\/dizi\/)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = cardRegex.exec(htmlChunk)) !== null) {
    const rawHref = match[1];
    const block = match[2];

    const itemUrl = makeAbsolute(rawHref, BASE_URL);

    if (
      !seenUrls[itemUrl] &&
      itemUrl.indexOf('/sezon-') === -1 &&
      itemUrl.indexOf('/bolum-') === -1 &&
      itemUrl.indexOf('/kategori/') === -1 &&
      itemUrl.indexOf('/tur/') === -1 &&
      itemUrl.indexOf('/oyuncu/') === -1 &&
      itemUrl.indexOf('#') === -1
    ) {
      const imgMatch = block.match(/<img[^>]+(?:data-src|src)="([^"]+)"/i);
      const altMatch = block.match(/alt="([^"]+)"/i);
      const titleMatch = block.match(/<(?:h2|h3|h4|p|span|div)[^>]*class="[^"]*(?:title|name|truncate)[^"]*"[^>]*>([\s\S]*?)<\//i);

      let rawTitle = altMatch ? altMatch[1] : (titleMatch ? titleMatch[1] : '');
      let title = cleanText(rawTitle);
      title = title.replace(/\s+(?:Film|Dizi)\s+izle$/i, '').trim();

      if (!title) {
        const slug = itemUrl.replace(/.*(?:\/film\/|\/dizi\/)/, '').replace(/\/$/, '');
        title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }

      if (title.length > 1) {
        seenUrls[itemUrl] = true;
        const cover = imgMatch ? makeAbsolute(imgMatch[1], BASE_URL) : '';

        items.push({
          id: itemUrl,
          title: title,
          href: itemUrl,
          image: cover,
          poster: cover,
          url: itemUrl,
          coverUrl: cover
        });
      }
    }
  }

  return items;
}

/**
 * Discovery Home handler
 */
async function discoveryHome() {
  try {
    const html = await httpGet(BASE_URL + '/', { Referer: BASE_URL });
    const headings = ['Trend Diziler', 'Trend Filmler', 'Son Eklenen Filmler'];
    const sections = [];

    for (let i = 0; i < headings.length; i++) {
      const name = headings[i];
      const idx = html.indexOf(name);
      if (idx !== -1) {
        const nextIdx = i < headings.length - 1 ? html.indexOf(headings[i + 1]) : html.length;
        const sub = html.substring(idx, nextIdx !== -1 ? nextIdx : idx + 30000);
        const cards = parseDizimomCards(sub);
        if (cards.length > 0) {
          if (i === 0) {
            sections.push({
              id: 'dizimom-hero',
              title: 'Öne Çıkan Trend Diziler',
              style: 'hero',
              items: cards.slice(0, 6),
              viewAll: { mode: 'feed', feedId: 'hero' }
            });
            if (cards.length >= 10) {
              sections.push({
                id: 'dizimom-top10',
                title: 'En Çok İzlenen 10 Dizi',
                style: 'top10',
                items: cards.slice(0, 10),
                viewAll: { mode: 'feed', feedId: 'top10' }
              });
            }
          }
          sections.push({
            id: 'dizimom-' + i,
            title: name,
            style: 'poster',
            items: cards,
            viewAll: { mode: 'feed', feedId: 'feed-' + i }
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
