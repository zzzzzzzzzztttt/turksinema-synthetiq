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
        const nextIdx = i < headings.length - 1 ? html.indexOf(headings[i + 1], idx + 10) : -1;
        const chunk = nextIdx !== -1 ? html.substring(idx, nextIdx) : html.substring(idx, idx + 80000);
        const items = parseCards(chunk);
        if (items.length > 0) {
          sections.push({
            id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            title: name,
            style: sections.length === 0 ? 'hero' : 'poster',
            items: items.slice(0, 24),
            viewAll: { mode: 'feed', feedId: name.toLowerCase().replace(/[^a-z0-9]/g, '-') }
          });
        }
      }
    }

    if (sections.length === 0) {
      const allItems = parseCards(html);
      sections.push({
        id: 'trending',
        title: 'Popüler Diziler & Filmler',
        style: 'poster',
        items: allItems.slice(0, 30),
        viewAll: { mode: 'feed', feedId: 'trending' }
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
    const url = p === 1 ? `${BASE_URL}/` : `${BASE_URL}/sayfa/${p}/`;
    const html = await httpGet(url, { Referer: BASE_URL });
    const items = parseCards(html);
    return {
      feedId: feedId || 'trending',
      page: p,
      items: items.slice(0, 30),
      hasMore: items.length >= 10
    };
  } catch (err) {
    return {
      feedId: feedId || 'trending',
      page: page || 1,
      items: [],
      hasMore: false
    };
  }
}

/**
 * Search handler with smart relevance scoring
 */
async function searchResults(query, page = 1) {
  try {
    const q = String(query || '').trim();
    if (!q) {
      const home = await discoveryHome();
      const all = [];
      (home.sections || []).forEach(s => (s.items || []).forEach(it => all.push(it)));
      return all.slice(0, 30);
    }

    const searchUrl = `${BASE_URL}/ara?q=${encodeURIComponent(q)}`;
    const html = await httpGet(searchUrl, { Referer: BASE_URL });
    const items = parseCards(html);

    // Score by query relevance so exact matches (e.g. The Mentalist) rank first
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

/**
 * Details handler
 */
async function extractDetails(url) {
  try {
    const html = await httpGet(url, { Referer: BASE_URL });

    const titleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
      || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const descMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)
      || html.match(/<div[^>]*class="[^"]*(?:description|synopsis|ozet|film-content|entry-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const coverMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
      || html.match(/<img[^>]*class="[^"]*(?:poster|cover)[^"]*"[^>]+(?:data-src|src)="([^"]+)"/i);

    let title = titleMatch ? cleanText(titleMatch[1]) : 'DiziMom';
    title = title
      .replace(/\s*\|\s*DiziMom.*$/i, '')
      .replace(/\s+(?:Film|Dizi)\s+izle.*$/i, '')
      .trim();

    const cleanDesc = descMatch ? cleanText(descMatch[1]) : '';
    const coverUrl = coverMatch ? makeAbsolute(coverMatch[1].trim(), BASE_URL) : '';

    return {
      id: url,
      title: title || 'DiziMom',
      description: cleanDesc,
      coverUrl: coverUrl,
      image: coverUrl,
      poster: coverUrl,
      url: url,
      href: url
    };
  } catch (err) {
    return {
      id: url,
      title: 'DiziMom',
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
 */
async function extractEpisodes(url) {
  try {
    const html = await httpGet(url, { Referer: BASE_URL });
    const episodes = [];
    const seen = {};

    const epRegex = /<a[^>]+href="([^"]*\/dizi\/[^"]*\/sezon-(\d+)\/bolum-(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = epRegex.exec(html)) !== null) {
      const epHref = makeAbsolute(match[1], BASE_URL);
      if (!seen[epHref]) {
        seen[epHref] = true;
        const season = parseInt(match[2], 10);
        const episode = parseInt(match[3], 10);
        const rawText = cleanText(match[4]);
        const title = (rawText && rawText.indexOf('İlk Bölüm') === -1)
          ? rawText
          : `Season ${season} Episode ${episode}`;

        episodes.push({
          id: epHref,
          title: title,
          url: epHref,
          href: epHref,
          season: season,
          episode: episode
        });
      }
    }

    if (episodes.length === 0) {
      episodes.push({
        id: url,
        title: 'Full Video',
        url: url,
        href: url,
        season: 1,
        episode: 1
      });
    }

    return episodes;
  } catch (err) {
    return [
      {
        id: url,
        title: 'Full Video',
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
 * Returns exactly ONE stream object pointing to master.m3u8
 * Native iOS AVPlayer then reads the #EXT-X-MEDIA:TYPE=AUDIO renditions
 * and provides switching between Turkish Dub and English Original cleanly!
 */
async function extractStreamUrl(targetUrl, want = 'sub') {
  try {
    const html = await httpGet(targetUrl, { Referer: BASE_URL });

    const pvMatch = html.match(/data-pv="([^"]+)"/);
    if (pvMatch) {
      const slug = pvMatch[1];
      const scriptMatch = html.match(/<script[^>]+src="([^"]*(?:pilavyer|core\.js|c\.js)[^"]*)"/i);
      let base = 'https://play2.pilavyerplay.top';
      if (scriptMatch) {
        base = scriptMatch[1].replace(/\/(?:e\/c|assets\/js\/core)\.js.*$/, '');
      }

      const playerUrl = `${base}/assets/js/s.php?s=${encodeURIComponent(slug)}`;
      const pHtml = await httpGet(playerUrl, { Referer: BASE_URL });
      const streamMatch = pHtml.match(/["']stream["']:\s*["']([^"']+)["']/i);
      const subsMatch = pHtml.match(/["']subs["']:\s*(\[[^\]]+\])/i);

      if (streamMatch) {
        const streamUrl = streamMatch[1].replace(/\\u0026/g, '&');
        const subtitles = [];

        if (subsMatch) {
          try {
            const rawSubs = JSON.parse(subsMatch[1]);
            rawSubs.forEach(s => {
              if (s && (s.src || s.url)) {
                const subUrl = (s.src || s.url).replace(/\\u0026/g, '&');
                subtitles.push({
                  id: subUrl,
                  url: subUrl,
                  file: subUrl,
                  label: s.label || 'Türkçe Altyazı',
                  language: s.lang || 'tr',
                  lang: s.lang || 'tr',
                  kind: 'subtitle',
                  default: true,
                  headers: { Referer: playerUrl }
                });
              }
            });
          } catch (_) {}
        }

        const streamLabel = (want === 'dub' ? 'dub ' : 'sub ') + 'Auto';
        const servers = [
          {
            name: 'Pilavyer',
            label: 'Pilavyer · Dual Audio (TR Dub / EN Sub)',
            url: streamUrl,
            headers: { Referer: playerUrl },
            streamType: 'hls',
            lang: want === 'dub' ? 'dub' : 'sub',
            audioLanguage: 'tr',
            audioLanguages: ['tr', 'en'],
            qualities: [{ label: 'Auto', url: streamUrl, headers: { Referer: playerUrl } }],
            subtitles: subtitles
          }
        ];

        return {
          url: streamUrl,
          streams: [streamLabel, streamUrl],
          headers: {
            Referer: playerUrl
          },
          streamType: 'hls',
          lang: want === 'dub' ? 'dub' : 'sub',
          quality: 'Auto',
          defaultQuality: 'Auto',
          qualities: [
            { label: 'Auto', url: streamUrl, headers: { Referer: playerUrl } }
          ],
          subtitles: subtitles,
          captions: subtitles,
          servers: servers
        };
      }
    }

    // Direct fallback
    const directMatch = html.match(/(https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*)/i);
    if (directMatch) {
      const streamUrl = directMatch[1];
      return {
        url: streamUrl,
        streams: ['1080p', streamUrl],
        headers: { Referer: targetUrl },
        streamType: streamUrl.indexOf('.m3u8') !== -1 ? 'hls' : 'mp4',
        lang: want === 'dub' ? 'dub' : 'sub',
        quality: '1080p',
        defaultQuality: '1080p',
        subtitles: [],
        servers: []
      };
    }

    throw new Error('No stream found in DiziMom target');
  } catch (err) {
    return {
      url: targetUrl,
      streams: ['Source', targetUrl],
      headers: {},
      streamType: 'hls',
      lang: String(want || 'sub').toLowerCase() === 'dub' ? 'dub' : 'sub',
      quality: 'Auto',
      defaultQuality: 'Auto',
      subtitles: [],
      servers: []
    };
  }
}

// Module Exports
globalThis.searchResults = searchResults;
globalThis.extractDetails = extractDetails;
globalThis.extractEpisodes = extractEpisodes;
globalThis.extractStreamUrl = extractStreamUrl;
globalThis.discoveryHome = discoveryHome;
globalThis.discoveryFeed = discoveryFeed;
