/**
 * HDFilmCehennemi Source Module - Synthetiq Player
 * Target: HD Film Cehennemi (https://www.hdfilmcehennemi2.biz)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Movies & TV Series with VidMoly HLS streams
 *   - Fast Meilisearch JSON search (/api/search/?q=)
 *   - Automatic English title matching & alias tagging for Synthetiq search filters
 *   - Dedicated Subtitled (Original Audio + Turkish CC) and Dubbed (Turkish Audio) stream isolation
 *   - Zero dual-audio conflicts on iOS AVPlayer (selects dedicated audio variant)
 *   - Direct extraction of inlined WebVTT subtitles
 *   - Universal support for string URLs, episode objects, and series auto-routing
 */

const BASE_URL = 'https://www.hdfilmcehennemi2.biz';

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
  if (typeof path === 'object' && path !== null) {
    path = path.url || path.id || path.href || path.targetUrl || '';
  }
  let trimmed = String(path).trim();
  if (!trimmed || trimmed === '[object Object]') return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('//')) return 'https:' + trimmed;
  const cleanBase = base.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? cleanBase + trimmed : cleanBase + '/' + trimmed;
}

function normalizePageUrl(url) {
  let u = makeAbsolute(url);
  if (!u.endsWith('/') && !u.includes('?') && !u.includes('#')) {
    u += '/';
  }
  return u;
}

function resolvePageUrl(input) {
  if (!input) return '';
  if (typeof input === 'object' && input !== null) {
    input = input.url || input.id || input.href || input.targetUrl || input.pageUrl || '';
  }
  let str = String(input).trim();
  if (!str || str === '[object Object]') return '';
  return normalizePageUrl(str);
}

/**
 * Pure JavaScript Base64 decode (works in JavaScriptCore, V8, and standard runtimes)
 */
function base64Decode(str) {
  if (!str) return '';
  if (typeof Buffer !== 'undefined') {
    try {
      return Buffer.from(str, 'base64').toString('utf8');
    } catch (_) {}
  }
  if (typeof atob === 'function') {
    try {
      return atob(str);
    } catch (_) {}
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  const input = String(str).replace(/[^A-Za-z0-9\+\/\=]/g, '');
  let i = 0;

  while (i < input.length) {
    const enc1 = chars.indexOf(input.charAt(i++));
    const enc2 = chars.indexOf(input.charAt(i++));
    const enc3 = chars.indexOf(input.charAt(i++));
    const enc4 = chars.indexOf(input.charAt(i++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64 && enc3 !== -1) {
      output += String.fromCharCode(chr2);
    }
    if (enc4 !== 64 && enc4 !== -1) {
      output += String.fromCharCode(chr3);
    }
  }

  try {
    return decodeURIComponent(escape(output));
  } catch (_) {
    return output;
  }
}

/**
 * Universal HTTP GET supporting iOS Synthetiq fetchv2 and standard fetch
 */
async function httpGet(url, customHeaders = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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

  if (typeof res === 'string') return res;
  try {
    return JSON.stringify(res);
  } catch (_) {
    return String(res);
  }
}

/**
 * Common English-Turkish Title Aliases for foreign movies
 */
const COMMON_ALIASES = {
  'pulp fiction': 'ucuz roman',
  'spirited away': 'ruhların kaçışı',
  'inception': 'başlangıç',
  'the dark knight': 'kara şövalye',
  'dark knight': 'kara şövalye',
  'the shawshank redemption': 'esaretin bedeli',
  'shawshank redemption': 'esaretin bedeli',
  'the godfather': 'baba',
  'godfather': 'baba',
  'fight club': 'dövüş kulübü',
  'interstellar': 'yıldızlararası',
  'the lord of the rings': 'yüzüklerin efendisi',
  'lord of the rings': 'yüzüklerin efendisi'
};

/**
 * Search results using Meilisearch API (/api/search/?q=)
 */
async function searchResults(query) {
  try {
    const q = String(query || '').trim();
    if (!q) return [];

    async function queryApi(term) {
      const searchUrl = `${BASE_URL}/api/search/?q=${encodeURIComponent(term)}`;
      const raw = await httpGet(searchUrl, {
        'Accept': 'application/json, text/plain, */*'
      });

      if (!raw) return [];

      let data = null;
      if (typeof raw === 'object' && raw !== null) {
        data = raw;
      } else if (typeof raw === 'string') {
        try {
          data = JSON.parse(raw);
        } catch (_) {
          data = null;
        }
      }

      if (!data) return [];
      if (data.json) data = data.json;

      return Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
    }

    let list = await queryApi(q);

    // If no hits and term is in alias map, try Turkish alias
    const lowerQ = q.toLowerCase();
    if (list.length === 0 && COMMON_ALIASES[lowerQ]) {
      list = await queryApi(COMMON_ALIASES[lowerQ]);
    }

    const items = [];
    const seen = new Set();

    for (const item of list) {
      if (!item.slug) continue;
      const cleanSlug = String(item.slug).replace(/^\/+/, '').replace(/\/+$/, '');
      const isSeries = item.contentableType === 'App\\Models\\TVSeries' || cleanSlug.includes('dizi/');

      // Ensure trailing slash to prevent HTTP 301 redirect
      const fullUrl = makeAbsolute('/' + cleanSlug + '/');
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);

      let displayTitle = cleanText(item.title || cleanSlug);
      // Ensure the search query is represented in the title so Synthetiq's client-side filter preserves it
      if (!displayTitle.toLowerCase().includes(lowerQ)) {
        const formattedQ = q.replace(/\b\w/g, l => l.toUpperCase());
        displayTitle = `${displayTitle} (${formattedQ})`;
      }

      const poster = item.posterUrl ? makeAbsolute(item.posterUrl) : '';

      items.push({
        id: fullUrl,
        title: displayTitle,
        url: fullUrl,
        href: fullUrl,
        image: poster,
        poster: poster,
        coverUrl: poster,
        releaseYear: item.releaseYear ? String(item.releaseYear) : '',
        rating: item.imdbRating ? String(item.imdbRating) : '',
        isSeries: isSeries,
        type: isSeries ? 'series' : 'movie'
      });
    }

    return items;
  } catch (_) {
    return [];
  }
}

/**
 * Extract detail metadata for a movie or TV series
 */
async function extractDetails(pageUrl) {
  try {
    const targetUrl = resolvePageUrl(pageUrl);
    const html = await httpGet(targetUrl);

    // Title
    let title = '';
    const titleOg = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    const titleTag = html.match(/<title>([^<]+)<\/title>/i);
    if (titleOg) {
      title = cleanText(titleOg[1].split('|')[0].replace(/\s*izle\s*$/i, ''));
    } else if (titleTag) {
      title = cleanText(titleTag[1].split('|')[0].replace(/\s*izle\s*$/i, ''));
    }

    // Description
    let desc = '';
    const descOg = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (descOg) {
      desc = cleanText(descOg[1]);
    } else {
      const summaryMatch = html.match(/(?:Özet|Hakkında)[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
      if (summaryMatch) desc = cleanText(summaryMatch[1]);
    }

    // Poster
    let poster = '';
    const posterMatch = html.match(/<img[^>]+src="([^"]*uploads\/posters[^"]*)"/i) ||
                        html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (posterMatch) poster = makeAbsolute(posterMatch[1]);

    // Rating
    let rating = '';
    const ratingMatch = html.match(/class="[^"]*imdb[^"]*"[^>]*>[\s\S]*?(\d+(?:\.\d+)?)/i) ||
                        html.match(/(\d+\.\d+)\s*\/\s*10/);
    if (ratingMatch) rating = ratingMatch[1];

    // Year
    let year = '';
    const yearMatch = html.match(/(?:Yıl|Vizyon Tarihi|Yapım Yılı)[^>]*>[\s\S]*?(\b(19\d\d|20\d\d)\b)/i) ||
                      html.match(/\b(19\d\d|20\d\d)\b/);
    if (yearMatch) year = yearMatch[1];

    // Genres
    const genres = [];
    const genreMatches = [...html.matchAll(/<a[^>]+href="[^"]*\/tur\/([^"\/]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi)];
    for (const gm of genreMatches) {
      const g = cleanText(gm[2]);
      if (g && !genres.includes(g)) genres.push(g);
    }

    const isSeries = targetUrl.includes('/dizi/');

    return {
      id: targetUrl,
      title: title || 'HDFilmCehennemi Media',
      description: desc,
      synopsis: desc,
      poster: poster,
      image: poster,
      coverUrl: poster,
      rating: rating,
      releaseYear: year,
      genres: genres,
      isSeries: isSeries,
      type: isSeries ? 'series' : 'movie'
    };
  } catch (err) {
    const fallbackUrl = resolvePageUrl(pageUrl);
    return {
      id: fallbackUrl,
      title: 'HDFilmCehennemi Media',
      description: '',
      poster: '',
      isSeries: fallbackUrl.includes('/dizi/'),
      type: fallbackUrl.includes('/dizi/') ? 'series' : 'movie'
    };
  }
}

/**
 * Extract episodes for a movie or TV series
 */
async function extractEpisodes(pageUrl) {
  try {
    const targetUrl = resolvePageUrl(pageUrl);
    const isSeries = targetUrl.includes('/dizi/');

    // For movies, return a single episode
    if (!isSeries) {
      return [
        {
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
        }
      ];
    }

    // For TV Series, parse episode links
    const html = await httpGet(targetUrl);
    const episodes = [];
    const seen = new Set();

    const epRegex = /<a[^>]+href="([^"]*\/dizi\/[^"]*\/sezon-(\d+)\/bolum-(\d+))"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;

    while ((m = epRegex.exec(html)) !== null) {
      const epUrl = resolvePageUrl(m[1]);
      if (seen.has(epUrl)) continue;
      seen.add(epUrl);

      const seasonNum = parseInt(m[2], 10) || 1;
      const episodeNum = parseInt(m[3], 10) || 1;
      const rawText = cleanText(m[4]);
      const epTitle = rawText || `Sezon ${seasonNum} Bölüm ${episodeNum}`;

      episodes.push({
        id: epUrl,
        title: epTitle,
        episodeNumber: episodeNum,
        seasonNumber: seasonNum,
        season: seasonNum,
        episode: episodeNum,
        url: epUrl,
        href: epUrl,
        subAvailable: true,
        dubAvailable: true
      });
    }

    // Sort by season number, then episode number ascending
    episodes.sort((a, b) => {
      if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
      return a.episodeNumber - b.episodeNumber;
    });

    return episodes.length > 0 ? episodes : [
      {
        id: targetUrl,
        title: 'Bölüm 1',
        episodeNumber: 1,
        seasonNumber: 1,
        season: 1,
        episode: 1,
        url: targetUrl,
        href: targetUrl,
        subAvailable: true,
        dubAvailable: true
      }
    ];
  } catch (_) {
    const fallbackUrl = resolvePageUrl(pageUrl);
    return [
      {
        id: fallbackUrl,
        title: 'Bölüm 1',
        episodeNumber: 1,
        seasonNumber: 1,
        season: 1,
        episode: 1,
        url: fallbackUrl,
        href: fallbackUrl,
        subAvailable: true,
        dubAvailable: true
      }
    ];
  }
}

/**
 * Extract HLS stream and subtitles from VidMoly (with DUAL audio track separation)
 */
async function extractStreamUrl(pageUrl, lang) {
  try {
    let targetUrl = resolvePageUrl(pageUrl);
    const want = String(lang || 'sub').trim().toLowerCase() === 'dub' ? 'dub' : 'sub';

    // If a series main page was passed without an episode slug, automatically route to Episode 1
    if (targetUrl.includes('/dizi/') && !targetUrl.includes('/bolum-')) {
      const epList = await extractEpisodes(targetUrl);
      if (epList && epList.length > 0 && epList[0].url) {
        targetUrl = resolvePageUrl(epList[0].url);
      }
    }

    const html = await httpGet(targetUrl);
    if (!html) {
      throw new Error(`Failed to load page (empty response from ${targetUrl})`);
    }

    // Multi-strategy videoPlayerData extraction
    let rawJson = null;

    // Strategy 1: Flexible Regex supporting single/double quotes, spaces, and newlines
    const vpdMatch = html.match(/videoPlayerData\s*\(\s*JSON\.parse\s*\(\s*(['"])([\s\S]*?)\1\s*\)\s*,\s*['"]([^'"]*)['"]/i);
    if (vpdMatch) {
      rawJson = vpdMatch[2];
    }

    // Strategy 2: Direct substring extraction between JSON.parse(' and ')
    if (!rawJson) {
      const vpdIdx = html.indexOf('videoPlayerData');
      if (vpdIdx !== -1) {
        const parseIdx = html.indexOf('JSON.parse(', vpdIdx);
        if (parseIdx !== -1 && parseIdx - vpdIdx < 120) {
          const quoteChar = html[parseIdx + 11];
          if (quoteChar === "'" || quoteChar === '"') {
            const start = parseIdx + 12;
            let searchPos = start;
            while ((searchPos = html.indexOf(quoteChar, searchPos)) !== -1) {
              const after = html.substring(searchPos + 1, searchPos + 15).trim();
              if (after.startsWith(')') || after.startsWith(',')) {
                rawJson = html.substring(start, searchPos);
                break;
              }
              searchPos++;
            }
          }
        }
      }
    }

    // Strategy 3: Direct JSON object extraction containing dual/en/tr
    if (!rawJson) {
      const directMatch = html.match(/\{(?:\u0022|\\")?(?:dual|en|tr|sub)(?:\u0022|\\")?\s*:\s*\[[\s\S]*?\]\s*\}/);
      if (directMatch) {
        rawJson = directMatch[0];
      }
    }

    if (!rawJson) {
      if (html.includes('cf-browser-verification') || html.includes('Just a moment...')) {
        throw new Error('Cloudflare verification triggered on target page');
      }
      if (html.includes('404 Not Found') || html.includes('<title>404')) {
        throw new Error(`Target page returned 404 Not Found: ${targetUrl}`);
      }
      throw new Error(`videoPlayerData not found on page (${targetUrl}, length: ${html.length})`);
    }

    const unescaped = rawJson.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    let parsed;
    try {
      parsed = JSON.parse(unescaped);
    } catch (e) {
      throw new Error(`Failed to parse videoPlayerData: ${e.message}`);
    }

    // Route language
    let sourceList = [];
    let isDual = false;

    if (want === 'dub') {
      sourceList = parsed.tr || parsed.dub || parsed.dual || [];
      if (!parsed.tr && !parsed.dub && parsed.dual) isDual = true;
    } else {
      sourceList = parsed.en || parsed.sub || parsed.altyazi || parsed.dual || [];
      if (!parsed.en && !parsed.sub && !parsed.altyazi && parsed.dual) isDual = true;
    }

    if (sourceList.length === 0) {
      for (const k of Object.keys(parsed)) {
        if (Array.isArray(parsed[k]) && parsed[k].length > 0) {
          sourceList = parsed[k];
          if (k === 'dual') isDual = true;
          break;
        }
      }
    }

    if (sourceList.length === 0) {
      throw new Error(`No video sources available for ${want.toUpperCase()}`);
    }

    // Select VidMoly (moly) first
    let molySource = sourceList.find(s => s.service_slug === 'moly') || sourceList[0];

    // Decode embed URL
    let embedUrl = '';
    if (molySource.template) {
      const decodedTmpl = base64Decode(molySource.template);
      const replaced = decodedTmpl.replace('{url}', molySource.link).replace('{slug}', molySource.slug);
      const srcMatch = replaced.match(/(?:src|data-src)="([^"]+)"/i);
      if (srcMatch) embedUrl = srcMatch[1];
    }

    if (!embedUrl) {
      embedUrl = `https://vidmoly.net/embed-${molySource.link}.html`;
    }
    if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;

    // Fetch VidMoly embed HTML
    const vmHtml = await httpGet(embedUrl, {
      'Referer': BASE_URL + '/'
    });

    // Extract master M3U8
    const fileMatch = vmHtml.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/);
    if (!fileMatch) {
      throw new Error('No m3u8 playlist found in VidMoly embed');
    }
    const masterM3u8 = fileMatch[1];

    // Extract inlined WebVTT subtitles
    const subtitles = [];
    const tracksMatch = vmHtml.match(/var\s+baseTracks\s*=\s*(\[[\s\S]*?\]);/);
    if (tracksMatch) {
      const fileMatches = [...tracksMatch[1].matchAll(/file:\s*["']([^"']+)["'][^}]*?label:\s*["']([^"']+)["']/gi)];
      for (const fm of fileMatches) {
        let fUrl = fm[1];
        if (fUrl.startsWith('//')) fUrl = 'https:' + fUrl;
        else if (fUrl.startsWith('/')) fUrl = new URL(fUrl, embedUrl).href;
        subtitles.push({
          url: fUrl,
          lang: fm[2],
          format: fUrl.endsWith('.vtt') ? 'vtt' : 'srt'
        });
      }
    }

    // Audio stream isolation (prevents iOS AVPlayer defaulting to Turkish dub)
    let finalStreamUrl = masterM3u8;

    if (isDual) {
      try {
        const plText = await httpGet(masterM3u8, {
          'Referer': embedUrl
        });

        const hasA2 = plText.includes('index-v1-a2.m3u8') || plText.includes('index-a2.m3u8');
        const hasA1 = plText.includes('index-v1-a1.m3u8') || plText.includes('index-a1.m3u8');

        if (want === 'sub' && hasA2) {
          const a2Match = plText.match(/https?:\/\/[^\s]+\/index-v1-a2\.m3u8[^\s]*/);
          if (a2Match) {
            finalStreamUrl = a2Match[0];
          }
        } else if (want === 'dub' && hasA1) {
          const a1Match = plText.match(/https?:\/\/[^\s]+\/index-v1-a1\.m3u8[^\s]*/);
          if (a1Match) {
            finalStreamUrl = a1Match[0];
          } else if (hasA2) {
            const a2Url = plText.match(/https?:\/\/[^\s]+\/index-v1-a2\.m3u8[^\s]*/)[0];
            finalStreamUrl = a2Url.replace('index-v1-a2.m3u8', 'index-v1-a1.m3u8');
          }
        } else {
          const stdMatch = plText.match(/https?:\/\/[^\s]+\/index-v1-a1\.m3u8[^\s]*/);
          if (stdMatch) finalStreamUrl = stdMatch[0];
        }
      } catch (_) {
        finalStreamUrl = masterM3u8;
      }
    }

    const label = `${want === 'dub' ? 'Türkçe Dublaj' : 'Türkçe Altyazılı'} · Moly 1080p`;

    const servers = [
      {
        name: `HDFilmCehennemi Moly (${want.toUpperCase()})`,
        label: label,
        url: finalStreamUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://vidmoly.net/'
        },
        streamType: 'hls',
        lang: want,
        audioLanguage: want === 'dub' ? 'tr' : 'en',
        audioLanguages: [want === 'dub' ? 'tr' : 'en'],
        quality: '1080p',
        subtitles: subtitles
      }
    ];

    const flatStreams = [
      (want === 'dub' ? 'dub ' : 'sub ') + '1080p', finalStreamUrl,
      'Auto 1080p', finalStreamUrl
    ];

    return {
      url: finalStreamUrl,
      streamUrl: finalStreamUrl,
      streamType: 'hls',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://vidmoly.net/'
      },
      streams: flatStreams,
      servers: servers,
      subtitles: subtitles
    };
  } catch (err) {
    return {
      streams: [],
      subtitles: [],
      error: { message: err ? err.message : 'HDFilmCehennemi stream extraction failed' }
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
    const html = await httpGet(BASE_URL + '/filmler/');
    const items = [];
    const seen = new Set();
    const cardRegex = /<a[^>]+href="([^"]+)"[^>]*class="[^"]*poster[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;

    while ((m = cardRegex.exec(html)) !== null) {
      const fullUrl = resolvePageUrl(m[1]);
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);

      const block = m[2];
      const titleMatch = block.match(/alt="([^"]+)"/i) || block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const imgMatch = block.match(/src="([^"]+)"/i);
      const yearMatch = block.match(/\b(19\d\d|20\d\d)\b/);
      const ratingMatch = block.match(/(\d+\.\d+)/);

      const title = titleMatch ? cleanText(titleMatch[1]) : fullUrl.split('/').filter(Boolean).pop();
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
        releaseYear: yearMatch ? yearMatch[1] : '',
        rating: ratingMatch ? ratingMatch[1] : '',
        isSeries: isSeries,
        type: isSeries ? 'series' : 'movie'
      });
    }

    const sections = [];
    if (items.length > 0) {
      sections.push({
        id: 'hdf_featured',
        title: 'Yeni Eklenen Filmler',
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
