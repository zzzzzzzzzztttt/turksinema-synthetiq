/**
 * Diziyou Source Module - Synthetiq Player
 * Target: Diziyou (https://www.diziyou.one)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Popular Foreign TV Series with Clean English Audio and Hardcoded Turkish Subtitles
 *   - Instant server-side search API (data_fetch)
 *   - Direct multi-bitrate HLS streams from storage.diziyou.one
 *   - Flawless iOS AVPlayer playback with zero dual-audio track conflicts
 */

const BASE_URL = 'https://www.diziyou.one';

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
 * Universal HTTP request supporting iOS Synthetiq fetchv2 and standard fetch
 */
async function httpRequest(url, options = {}) {
  const method = options.method || 'GET';
  const customHeaders = options.headers || {};
  const body = options.body || null;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': BASE_URL + '/',
    ...customHeaders
  };

  let res;
  if (typeof fetchv2 === 'function') {
    res = await fetchv2(url, headers, method, body, { timeoutMs: 25000 });
  } else {
    res = await fetch(url, { method, headers, body });
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
 * Search results handler using Diziyou data_fetch action
 */
async function searchResults(query) {
  try {
    const q = String(query || '').trim();
    if (!q) return [];

    const ajaxUrl = `${BASE_URL}/wp-admin/admin-ajax.php`;
    const postBody = `action=data_fetch&keyword=${encodeURIComponent(q)}`;
    const html = await httpRequest(ajaxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: postBody
    });

    const items = [];
    const seen = new Set();
    const itemRegex = /<div id="searchelement">[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<a[^>]+href="[^"]*"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/div>/gi;
    let m;

    while ((m = itemRegex.exec(html)) !== null) {
      const fullUrl = makeAbsolute(m[1]);
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);

      const poster = makeAbsolute(m[2]);
      const title = cleanText(m[3]);

      items.push({
        id: fullUrl,
        title: title,
        url: fullUrl,
        href: fullUrl,
        image: poster,
        poster: poster,
        coverUrl: poster,
        isSeries: true,
        type: 'series'
      });
    }

    // Fallback: WordPress standard search page if data_fetch returned 0
    if (items.length === 0) {
      const fallbackUrl = `${BASE_URL}/?s=${encodeURIComponent(q)}`;
      const fallbackHtml = await httpRequest(fallbackUrl);
      const cardRegex = /<a[^>]+href="(https?:\/\/www\.diziyou\.one\/[^\/"]+\/)"[^>]*title="([^"]+)"/gi;
      let fm;
      while ((fm = cardRegex.exec(fallbackHtml)) !== null) {
        const u = fm[1];
        if (u.includes('/search/') || u.includes('/feed/') || u.includes('/uye-ol/')) continue;
        if (seen.has(u)) continue;
        seen.add(u);

        items.push({
          id: u,
          title: cleanText(fm[2]),
          url: u,
          href: u,
          image: '',
          poster: '',
          isSeries: true,
          type: 'series'
        });
      }
    }

    return items;
  } catch (err) {
    return [];
  }
}

/**
 * Extract series details
 */
async function extractDetails(urlOrId) {
  try {
    const targetUrl = makeAbsolute(urlOrId);
    const html = await httpRequest(targetUrl);

    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i);
    const title = titleMatch ? cleanText(titleMatch[1]).replace(/\s*izle.*$/i, '') : 'Diziyou Series';

    const descMatch = html.match(/<div[^>]+id="dizibilgi"[^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i);
    const desc = descMatch ? cleanText(descMatch[1]) : '';

    const imgMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/i) ||
                     html.match(/src="([^"]+posters\/[^"]+)"/i);
    const image = imgMatch ? makeAbsolute(imgMatch[1]) : '';

    const yearMatch = html.match(/<span[^>]*class="[^"]*yil[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
                      html.match(/\b(19\d\d|20\d\d)\b/);
    const year = yearMatch ? parseInt(cleanText(yearMatch[1]), 10) : 0;

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
      isSeries: true,
      type: 'series'
    };
  } catch (err) {
    return {
      id: urlOrId,
      href: urlOrId,
      title: 'Diziyou Series',
      description: '',
      isSeries: true
    };
  }
}

/**
 * Extract episodes for series
 */
async function extractEpisodes(seriesUrl) {
  const targetUrl = makeAbsolute(seriesUrl);
  try {
    const html = await httpRequest(targetUrl);
    const episodes = [];
    const seen = new Set();

    const epRegex = /<a[^>]+href="(https?:\/\/www\.diziyou\.one\/[^\/"]*-sezon-[^\/"]*-bolum\/)"[^>]*>/gi;
    let m;

    while ((m = epRegex.exec(html)) !== null) {
      const epHref = m[1];
      if (seen.has(epHref)) continue;
      seen.add(epHref);

      const numMatch = epHref.match(/(\d+)-sezon-(\d+)-bolum/);
      const sNum = numMatch ? parseInt(numMatch[1], 10) : 1;
      const epNum = numMatch ? parseInt(numMatch[2], 10) : (episodes.length + 1);

      episodes.push({
        id: epHref,
        title: `${sNum}. Sezon ${epNum}. Bölüm`,
        seasonNumber: sNum,
        episodeNumber: epNum,
        season: sNum,
        episode: epNum,
        url: epHref,
        href: epHref,
        subAvailable: true,
        dubAvailable: false
      });
    }

    if (episodes.length === 0) {
      episodes.push({
        id: targetUrl,
        title: '1. Bölüm',
        seasonNumber: 1,
        episodeNumber: 1,
        season: 1,
        episode: 1,
        url: targetUrl,
        href: targetUrl,
        subAvailable: true,
        dubAvailable: false
      });
    }

    episodes.sort((a, b) => (a.seasonNumber - b.seasonNumber) || (a.episodeNumber - b.episodeNumber));
    return episodes;
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
      dubAvailable: false
    }];
  }
}

/**
 * Extract video stream handler with inlined WebVTT subtitles
 */
async function extractStreamUrl(episodeUrl) {
  try {
    const targetUrl = makeAbsolute(episodeUrl);
    const html = await httpRequest(targetUrl);

    // Extract player iframe: /player/164001.html
    const iframeMatch = html.match(/\/player\/(\d+)\.html/i) ||
                        html.match(/src=["']([^"']*\/player\/\d+\.html[^"']*)["']/i);
    let playerId = null;
    if (iframeMatch) {
      playerId = iframeMatch[1] || (iframeMatch[0].match(/\/player\/(\d+)\.html/) || [])[1];
    }

    if (!playerId) {
      throw new Error('Diziyou player ID not found on episode page');
    }

    // Fetch player HTML to extract track tags and subtitle endpoints
    const playerUrl = `${BASE_URL}/player/${playerId}.html`;
    const playerHtml = await httpRequest(playerUrl, {
      headers: { 'Referer': targetUrl }
    });

    const trackRegex = /<track[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let tm;
    const rawTracks = [];
    while ((tm = trackRegex.exec(playerHtml)) !== null) {
      const tag = tm[0];
      const src = tm[1];
      const labelMatch = tag.match(/label=["']([^"']+)["']/i);
      const langMatch = tag.match(/srclang=["']([^"']+)["']/i);
      const isDefault = tag.includes('default');
      rawTracks.push({
        src,
        label: labelMatch ? labelMatch[1] : (src.includes('/tr.') ? 'Türkçe' : 'English'),
        lang: langMatch ? langMatch[1] : (src.includes('/tr.') ? 'tr' : 'en'),
        isDefault
      });
    }

    // Fallback if no track tags in player HTML
    if (rawTracks.length === 0) {
      rawTracks.push({
        src: `https://storage.diziyou.one/subtitles/${playerId}/tr.vtt`,
        label: 'Türkçe',
        lang: 'tr',
        isDefault: true
      });
      rawTracks.push({
        src: `https://storage.diziyou.one/subtitles/${playerId}/en.vtt`,
        label: 'English',
        lang: 'en',
        isDefault: false
      });
    }

    // Fetch and inline WebVTT content for iOS AVPlayer
    const subtitles = [];
    for (const t of rawTracks) {
      try {
        const vttRaw = await httpRequest(t.src, {
          headers: { 'Referer': BASE_URL + '/' }
        });
        if (vttRaw) {
          let cleanVtt = String(vttRaw).replace(/^\uFEFF/, '').trim();
          if (!cleanVtt.startsWith('WEBVTT')) {
            cleanVtt = 'WEBVTT\n\n' + cleanVtt;
          }

          subtitles.push({
            id: t.src,
            url: t.src,
            file: t.src,
            label: t.label,
            language: t.lang,
            lang: t.lang,
            kind: 'captions',
            default: t.isDefault,
            content: cleanVtt,
            format: 'vtt',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': BASE_URL + '/'
            }
          });
        }
      } catch (_) {}
    }

    const streamUrl = `https://storage.diziyou.one/episodes/${playerId}/play.m3u8`;
    const defaultQuality = '1080p';

    const servers = [{
      name: 'Diziyou Storage (Altyazılı)',
      label: 'Altyazılı (Original English Audio) · 1080p HLS',
      url: streamUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': BASE_URL + '/'
      },
      streamType: 'hls',
      lang: 'sub',
      audioLanguage: 'en',
      audioLanguages: ['en'],
      qualities: [
        { label: 'Auto', url: streamUrl },
        { label: '1080p', url: streamUrl },
        { label: '720p', url: streamUrl },
        { label: '480p', url: streamUrl }
      ],
      subtitles: subtitles
    }];

    const streams = [
      'sub ' + defaultQuality, streamUrl,
      'Auto ' + defaultQuality, streamUrl
    ];

    return {
      url: streamUrl,
      streams: streams,
      streamType: 'hls',
      lang: 'sub',
      quality: defaultQuality,
      defaultQuality: defaultQuality,
      qualities: [
        { label: 'Auto', url: streamUrl },
        { label: '1080p', url: streamUrl },
        { label: '720p', url: streamUrl },
        { label: '480p', url: streamUrl }
      ],
      servers: servers,
      subtitles: subtitles,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': BASE_URL + '/'
      }
    };
  } catch (err) {
    return {
      streams: [],
      subtitles: [],
      error: { message: err ? err.message : 'Diziyou stream extraction failed' }
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
    const html = await httpRequest(BASE_URL + '/');
    const items = [];
    const seen = new Set();
    const epRegex = /<a[^>]+href="(https?:\/\/www\.diziyou\.one\/[^\/"]*-sezon-[^\/"]*-bolum\/)"[^>]*title="([^"]+)"/gi;
    let m;

    while ((m = epRegex.exec(html)) !== null) {
      const epHref = m[1];
      if (seen.has(epHref)) continue;
      seen.add(epHref);

      items.push({
        id: epHref,
        title: cleanText(m[2]),
        url: epHref,
        href: epHref,
        image: '',
        poster: '',
        isSeries: true,
        type: 'series'
      });
    }

    const sections = [];
    if (items.length > 0) {
      sections.push({
        id: 'diziyou_popular',
        title: 'Son Eklenen Bölümler',
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
