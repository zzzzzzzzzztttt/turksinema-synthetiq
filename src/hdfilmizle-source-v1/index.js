/**
 * HDFilmizle Source Module - Synthetiq Player
 * Target: HDFilmizle (https://www.hdfilmizle.best)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Rich catalog of Hollywood movies, world cinema, and TV series
 *   - True Dual Audio: Original Audio ("Altyazılı" - English/Original) and Turkish Dub ("Dublaj")
 *     using native dynamic master.m3u8 playlists that select the correct default audio track on iOS AVPlayer
 *   - Comprehensive multi-language subtitles with sanitized WebVTT inline delivery
 *   - Zero Cloudflare Turnstile blocks; direct high-speed HLS playback
 */

const BASE_URL = 'https://www.hdfilmizle.best';

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

/**
 * Universal HTTP POST supporting iOS Synthetiq fetchv2 and standard fetch
 */
async function httpPost(url, bodyData, customHeaders = {}) {
  const bodyStr = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData || '');
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': BASE_URL + '/',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    ...customHeaders
  };

  let res;
  if (typeof fetchv2 === 'function') {
    res = await fetchv2(url, headers, 'POST', bodyStr, { timeoutMs: 25000 });
  } else {
    res = await fetch(url, { method: 'POST', headers, body: bodyStr });
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
 * Catalog search handler
 */
async function searchResults(query) {
  try {
    const q = String(query || '').trim();
    if (!q) return [];

    const searchUrl = `${BASE_URL}/en/?s=${encodeURIComponent(q)}`;
    const html = await httpGet(searchUrl);
    if (!html) return [];

    const itemRegex = /<a\s+[^>]*href="(https:\/\/www\.hdfilmizle\.best\/(?:en\/)?(?:film|dizi)\/[^"\/]+\/)"[^>]*>([\s\S]*?)<\/a>/gi;
    const results = [];
    const seen = new Set();
    let m;

    while ((m = itemRegex.exec(html)) !== null) {
      const fullUrl = m[1];
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);

      const aTag = m[0];
      const inner = m[2];

      const titleMatch = aTag.match(/data-title="([^"]+)"/) || inner.match(/alt="([^"]+)"/) || inner.match(/<h[234][^>]*>([^<]+)<\/h[234]>/);
      const posterMatch = inner.match(/src="([^"]+)"/) || inner.match(/srcset="([^"]+)"/);
      const ratingMatch = aTag.match(/data-score="([^"]+)"/) || inner.match(/class="rating"[^>]*>([\s\S]*?)<\/div>/);
      const durationMatch = aTag.match(/data-duration="([^"]+)"/);

      const title = titleMatch ? cleanText(titleMatch[1]) : fullUrl.split('/').filter(Boolean).pop();
      const poster = posterMatch ? makeAbsolute(posterMatch[1].split(' ')[0]) : '';
      const rating = ratingMatch ? cleanText(ratingMatch[1]).replace(/[^0-9.]/g, '') : '';
      const isSeries = fullUrl.includes('/dizi/');

      results.push({
        id: fullUrl,
        title: title,
        url: fullUrl,
        href: fullUrl,
        image: poster,
        poster: poster,
        coverUrl: poster,
        isSeries: isSeries,
        type: isSeries ? 'series' : 'movie',
        rating: rating || undefined,
        duration: durationMatch ? `${durationMatch[1]} min` : undefined
      });
    }

    return results;
  } catch (_) {
    return [];
  }
}

/**
 * Movie/Series details handler
 */
async function extractDetails(urlOrId) {
  try {
    const targetUrl = makeAbsolute(urlOrId);
    const html = await httpGet(targetUrl);

    const titleMatch = html.match(/<h1[^>]*class="title"[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([^<]+)<\/title>/i);
    const descMatch = html.match(/<div[^>]*class="[^"]*summary[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<div[^>]*class="[^"]*story[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    const posterMatch = html.match(/<img[^>]+class="[^"]*cover[^"]*"[^>]+src="([^"]+)"/i) ||
                        html.match(/<img[^>]+class="[^"]*thumbnail[^"]*"[^>]+src="([^"]+)"/i);
    const dateMatch = html.match(/class="date"[^>]*>\s*\(?<a[^>]*>(\d{4})<\/a>\)?/i);

    let cleanTitle = 'HDFilmizle';
    if (titleMatch) {
      cleanTitle = cleanText(titleMatch[1])
        .replace(/^Watch\s+/i, '')
        .replace(/\(\d{4}\)$/, '')
        .trim();
    }

    const poster = posterMatch ? makeAbsolute(posterMatch[1]) : '';
    const isSeries = targetUrl.includes('/dizi/');

    return {
      id: targetUrl,
      url: targetUrl,
      href: targetUrl,
      title: cleanTitle,
      description: descMatch ? cleanText(descMatch[1]) : '',
      image: poster,
      poster: poster,
      coverUrl: poster,
      isSeries: isSeries,
      type: isSeries ? 'series' : 'movie',
      releaseDate: dateMatch ? dateMatch[1] : undefined
    };
  } catch (err) {
    return {
      id: urlOrId,
      url: urlOrId,
      href: urlOrId,
      title: 'HDFilmizle Title',
      description: '',
      isSeries: String(urlOrId).includes('/dizi/'),
      type: String(urlOrId).includes('/dizi/') ? 'series' : 'movie'
    };
  }
}

/**
 * Episodes extraction handler
 */
async function extractEpisodes(seriesUrl) {
  const targetUrl = makeAbsolute(seriesUrl);
  try {
    // If it's a movie, return single episode item
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
    const epRegex = /href="([^"]*(?:bolum|episode)\/[^"]+)"/gi;
    const episodes = [];
    const seen = new Set();
    let m;

    while ((m = epRegex.exec(html)) !== null) {
      const epHref = makeAbsolute(m[1]);
      if (seen.has(epHref)) continue;
      seen.add(epHref);

      const sMatch = epHref.match(/(\d+)-(?:sezon|season)/i);
      const eMatch = epHref.match(/(\d+)-(?:bolum|episode)/i);
      const sNum = sMatch ? parseInt(sMatch[1], 10) : 1;
      const eNum = eMatch ? parseInt(eMatch[1], 10) : episodes.length + 1;

      episodes.push({
        id: epHref,
        title: `${sNum}. Sezon ${eNum}. Bölüm`,
        seasonNumber: sNum,
        episodeNumber: eNum,
        season: sNum,
        episode: eNum,
        url: epHref,
        href: epHref,
        subAvailable: true,
        dubAvailable: true
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
        dubAvailable: true
      });
    }

    episodes.sort((a, b) => (a.seasonNumber - b.seasonNumber) || (a.episodeNumber - b.episodeNumber));
    return episodes;
  } catch (_) {
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
 * Video stream extraction handler
 */
async function extractStreamUrl(pageUrl, lang) {
  try {
    const targetUrl = makeAbsolute(pageUrl);
    const want = String(lang || 'sub').trim().toLowerCase() === 'dub' ? 'dub' : 'sub';
    const altWant = want === 'dub' ? 'sub' : 'dub';
    const primaryLangCode = want === 'dub' ? 'tr' : 'en';
    const altLangCode = want === 'dub' ? 'en' : 'tr';

    const html = await httpGet(targetUrl);
    const nonceMatch = html.match(/var\s+_hdfNonce_\s*=\s*"([^"]+)"/);
    const postMatch = html.match(/data-post="(\d+)"/);

    if (!nonceMatch || !postMatch) {
      throw new Error('HDFilmizle: Failed to extract player tokens');
    }

    const nonce = nonceMatch[1];
    const postId = postMatch[1];

    async function fetchVideoData(langCode) {
      const postUrl = `${BASE_URL}/ajax/videosrc/?id=${postId}&lang=${langCode}&mr=0`;
      const resStr = await httpPost(postUrl, '', {
        'X-HDF-Nonce': nonce,
        'Referer': targetUrl
      });
      if (!resStr) return null;
      try {
        return JSON.parse(resStr);
      } catch (_) {
        return null;
      }
    }

    let videoData = await fetchVideoData(primaryLangCode);
    if (!videoData || !videoData.src) {
      videoData = await fetchVideoData(altLangCode);
    }

    if (!videoData || !videoData.src) {
      throw new Error('HDFilmizle: Stream source not found');
    }

    const streamUrl = videoData.src;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': BASE_URL + '/'
    };

    const subtitles = [];
    if (Array.isArray(videoData.tracks)) {
      for (const tr of videoData.tracks) {
        if (!tr || !tr.src) continue;
        const srclang = tr.srclang || 'tr';
        const label = tr.label || (srclang === 'tr' ? 'Türkçe' : (srclang === 'en' ? 'English' : srclang.toUpperCase()));
        const subItem = {
          id: tr.src,
          label: label,
          language: srclang,
          url: tr.src
        };

        // Inline VTT body for top languages (Turkish and English) to ensure iOS AVPlayer subtitle display
        if (srclang === 'tr' || srclang === 'en') {
          try {
            const vttBody = await httpGet(tr.src);
            if (vttBody && vttBody.includes('WEBVTT')) {
              subItem.content = vttBody.replace(/^\uFEFF/, '').trim();
            }
          } catch (_) {}
        }
        subtitles.push(subItem);
      }
    }

    const serverLabel = want === 'dub' ? 'Dublaj (Türkçe)' : 'Altyazılı (English Original)';
    const altServerLabel = altWant === 'dub' ? 'Dublaj (Türkçe)' : 'Altyazılı (English Original)';

    // Pre-build server list so user can toggle between Original Audio and Dub in the player
    const servers = [
      {
        name: `HDFilmizle ${serverLabel}`,
        label: `${serverLabel} · 1080p`,
        url: streamUrl,
        headers: headers,
        streamType: 'hls',
        lang: want,
        audioLanguage: want === 'dub' ? 'tr' : 'en',
        audioLanguages: [want === 'dub' ? 'tr' : 'en'],
        qualities: [{
          label: '1080p',
          url: streamUrl,
          headers: headers
        }],
        subtitles: subtitles
      }
    ];

    const streams = [
      (want === 'dub' ? 'dub ' : 'sub ') + '1080p', streamUrl,
      'Auto 1080p', streamUrl
    ];

    return {
      url: streamUrl,
      streams: streams,
      streamType: 'hls',
      lang: want,
      quality: '1080p',
      defaultQuality: '1080p',
      qualities: [{
        label: '1080p',
        url: streamUrl,
        headers: headers
      }],
      servers: servers,
      subtitles: subtitles,
      headers: headers
    };
  } catch (err) {
    return {
      streams: [],
      subtitles: [],
      error: { message: err ? err.message : 'HDFilmizle stream extraction failed' }
    };
  }
}

/**
 * Dedicated Subtitles extractor
 */
async function extractSubtitles(pageUrl) {
  try {
    const targetUrl = makeAbsolute(pageUrl);
    const html = await httpGet(targetUrl);
    const nonceMatch = html.match(/var\s+_hdfNonce_\s*=\s*"([^"]+)"/);
    const postMatch = html.match(/data-post="(\d+)"/);

    if (!nonceMatch || !postMatch) return [];

    const nonce = nonceMatch[1];
    const postId = postMatch[1];
    const postUrl = `${BASE_URL}/ajax/videosrc/?id=${postId}&lang=en&mr=0`;
    const resStr = await httpPost(postUrl, '', {
      'X-HDF-Nonce': nonce,
      'Referer': targetUrl
    });

    if (!resStr) return [];
    const data = JSON.parse(resStr);
    if (!Array.isArray(data.tracks)) return [];

    const subs = [];
    for (const tr of data.tracks) {
      if (!tr || !tr.src) continue;
      const srclang = tr.srclang || 'tr';
      const label = tr.label || (srclang === 'tr' ? 'Türkçe' : (srclang === 'en' ? 'English' : srclang.toUpperCase()));
      const item = {
        id: tr.src,
        label: label,
        language: srclang,
        url: tr.src
      };
      if (srclang === 'tr' || srclang === 'en') {
        try {
          const vttBody = await httpGet(tr.src);
          if (vttBody && vttBody.includes('WEBVTT')) {
            item.content = vttBody.replace(/^\uFEFF/, '').trim();
          }
        } catch (_) {}
      }
      subs.push(item);
    }
    return subs;
  } catch (_) {
    return [];
  }
}

/**
 * Discovery Home handler
 */
async function discoveryHome() {
  try {
    const html = await httpGet(`${BASE_URL}/en/`);
    if (!html) return [];

    const itemRegex = /<a\s+[^>]*href="(https:\/\/www\.hdfilmizle\.best\/(?:en\/)?(?:film|dizi)\/[^"\/]+\/)"[^>]*>([\s\S]*?)<\/a>/gi;
    const allItems = [];
    const seen = new Set();
    let m;

    while ((m = itemRegex.exec(html)) !== null) {
      const fullUrl = m[1];
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);

      const aTag = m[0];
      const inner = m[2];

      const titleMatch = aTag.match(/data-title="([^"]+)"/) || inner.match(/alt="([^"]+)"/) || inner.match(/<h[234][^>]*>([^<]+)<\/h[234]>/);
      const posterMatch = inner.match(/src="([^"]+)"/) || inner.match(/srcset="([^"]+)"/);
      const ratingMatch = aTag.match(/data-score="([^"]+)"/) || inner.match(/class="rating"[^>]*>([\s\S]*?)<\/div>/);

      const title = titleMatch ? cleanText(titleMatch[1]) : fullUrl.split('/').filter(Boolean).pop();
      const poster = posterMatch ? makeAbsolute(posterMatch[1].split(' ')[0]) : '';
      const rating = ratingMatch ? cleanText(ratingMatch[1]).replace(/[^0-9.]/g, '') : '';
      const isSeries = fullUrl.includes('/dizi/');

      allItems.push({
        id: fullUrl,
        title: title,
        url: fullUrl,
        href: fullUrl,
        image: poster,
        poster: poster,
        coverUrl: poster,
        isSeries: isSeries,
        type: isSeries ? 'series' : 'movie',
        rating: rating || undefined
      });
    }

    const movies = allItems.filter(it => !it.isSeries);
    const series = allItems.filter(it => it.isSeries);

    const sections = [];
    if (allItems.length > 0) {
      sections.push({
        id: 'hdf_featured',
        title: 'Öne Çıkanlar (Featured)',
        type: 'featured',
        items: allItems.slice(0, 15)
      });
    }
    if (movies.length > 0) {
      sections.push({
        id: 'hdf_movies',
        title: 'Popüler Filmler (Movies)',
        type: 'carousel',
        items: movies.slice(0, 20)
      });
    }
    if (series.length > 0) {
      sections.push({
        id: 'hdf_series',
        title: 'Popüler Diziler (Series)',
        type: 'carousel',
        items: series.slice(0, 20)
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
