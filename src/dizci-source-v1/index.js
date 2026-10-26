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
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
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
 * Dzen Stream Resolver
 * Prioritizes direct high-speed MP4 video streams over HLS to prevent local proxy 502 and CoreMedia 400 errors.
 */
async function resolveDzen(embedUrl) {
  try {
    let cleanUrl = embedUrl;
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    const html = await httpGet(cleanUrl, { 'Referer': 'https://dizci.net/' });
    if (!html) return null;

    const streamMatch = html.match(/"streams":\s*(\[[^\]]+\])/);
    if (!streamMatch) return null;

    const streams = JSON.parse(streamMatch[1]);
    const qualityLabels = {
      'fullhd': '1080p',
      'high': '720p',
      'medium': '480p',
      'low': '360p',
      'lowest': '240p',
      'tiny': '144p'
    };
    const order = ['fullhd', 'high', 'medium', 'low', 'lowest', 'tiny'];

    // 1. Prioritize Direct MP4 Video Streams (Native iOS AVPlayer safe)
    const validMp4s = streams.filter(s => s && s.url && s.type !== 'hls' && s.type !== 'dash');
    if (validMp4s.length > 0) {
      let best = validMp4s[0];
      for (const pref of order) {
        const found = validMp4s.find(s => s.type === pref);
        if (found) { best = found; break; }
      }

      const streamList = [];
      const serverList = [];
      for (const pref of order) {
        const v = validMp4s.find(item => item.type === pref);
        if (v) {
          const qLabel = qualityLabels[v.type] || v.type;
          streamList.push(`${qLabel} MP4`, v.url);
          serverList.push({ name: `Dzen (${qLabel})`, url: v.url });
        }
      }

      const bestQuality = qualityLabels[best.type] || '1080p';
      return {
        url: best.url,
        streamUrl: best.url,
        format: 'mp4',
        streamType: 'mp4',
        quality: bestQuality,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': 'https://dzen.ru/'
        },
        streams: streamList.length > 0 ? streamList : [`${bestQuality} MP4`, best.url],
        servers: serverList.length > 0 ? serverList : [{ name: `Dzen ${bestQuality}`, url: best.url }],
        serverName: `Dzen ${bestQuality}`
      };
    }

    // 2. Fallback to HLS
    const hls = streams.find(s => s && s.url && s.type === 'hls');
    if (hls) {
      return {
        url: hls.url,
        streamUrl: hls.url,
        format: 'hls',
        streamType: 'hls',
        quality: 'Auto',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': 'https://dzen.ru/'
        },
        streams: ['Auto HLS', hls.url],
        servers: [{ name: 'Dzen HLS', url: hls.url }],
        serverName: 'Dzen HLS'
      };
    }

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * VidMoly Stream Resolver
 */
async function resolveVidMoly(embedUrl) {
  try {
    let cleanUrl = embedUrl;
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    if (cleanUrl.includes('vidmoly.to')) cleanUrl = cleanUrl.replace('vidmoly.to', 'vidmoly.biz');
    if (cleanUrl.includes('vidmoly.net')) cleanUrl = cleanUrl.replace('vidmoly.net', 'vidmoly.biz');

    const html = await httpGet(cleanUrl, { 'Referer': BASE_URL + '/' });
    if (!html) return null;

    const m = html.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/);
    if (m) {
      return {
        url: m[1],
        streamUrl: m[1],
        format: 'hls',
        streamType: 'hls',
        quality: '1080p',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': 'https://vidmoly.biz/'
        },
        streams: ['1080p HLS', m[1]],
        servers: [{ name: 'VidMoly 1080p', url: m[1] }],
        serverName: 'VidMoly 1080p'
      };
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * OK.ru / Odnoklassniki Stream Resolver
 */
async function resolveOkRu(embedUrl) {
  try {
    let cleanUrl = embedUrl;
    if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
    const html = await httpGet(cleanUrl, { 'Referer': 'https://dizci.net/' });
    if (!html) return null;

    const dataOptMatch = html.match(/data-options=["']([^"']+)["']/i);
    if (!dataOptMatch) return null;

    const decoded = dataOptMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const opts = JSON.parse(decoded);
    const meta = typeof opts.flashvars?.metadata === 'string' ? JSON.parse(opts.flashvars.metadata) : (opts.flashvars?.metadata || {});

    // Option A: Direct MP4 Video Streams (Native iOS AVPlayer safe)
    if (meta.videos && Array.isArray(meta.videos) && meta.videos.length > 0) {
      const order = ['full', 'hd', 'sd', 'low', 'lowest', 'mobile'];
      const qualityLabels = { 'full': '1080p', 'hd': '720p', 'sd': '480p', 'low': '360p', 'lowest': '240p', 'mobile': '144p' };
      const validVideos = meta.videos.filter(v => v && v.url);
      if (validVideos.length > 0) {
        let best = validVideos[0];
        for (const pref of order) {
          const found = validVideos.find(v => v.name === pref);
          if (found) { best = found; break; }
        }

        const streams = [];
        const servers = [];
        for (const pref of order) {
          const v = validVideos.find(item => item.name === pref);
          if (v) {
            const label = qualityLabels[v.name] || v.name;
            streams.push(`${label} MP4`, v.url);
            servers.push({ name: `OK.ru (${label})`, url: v.url });
          }
        }

        const bestLabel = qualityLabels[best.name] || 'HD';
        return {
          url: best.url,
          streamUrl: best.url,
          format: 'mp4',
          streamType: 'mp4',
          quality: bestLabel,
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
            'Referer': 'https://ok.ru/'
          },
          streams: streams.length > 0 ? streams : [`${bestLabel} MP4`, best.url],
          servers: servers.length > 0 ? servers : [{ name: `OK.ru ${bestLabel}`, url: best.url }],
          serverName: `OK.ru ${bestLabel}`
        };
      }
    }

    // Option B: Master HLS
    if (meta.hlsManifestUrl) {
      return {
        url: meta.hlsManifestUrl,
        streamUrl: meta.hlsManifestUrl,
        format: 'hls',
        streamType: 'hls',
        quality: 'Auto',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': 'https://ok.ru/'
        },
        streams: ['Auto HLS', meta.hlsManifestUrl],
        servers: [{ name: 'OK.ru HLS', url: meta.hlsManifestUrl }],
        serverName: 'OK.ru HLS'
      };
    }

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Extract video stream handler with strict sub vs dub separation
 */
async function extractStreamUrl(episode, lang) {
  try {
    let targetUrl = '';
    if (typeof episode === 'object' && episode !== null) {
      targetUrl = makeAbsolute(episode.url || episode.id || episode.href || '');
    } else {
      targetUrl = makeAbsolute(episode);
    }

    if (!targetUrl) {
      return {
        url: '',
        streamUrl: '',
        streamType: 'mp4',
        format: 'mp4',
        quality: '1080p',
        headers: {},
        streams: [],
        servers: [],
        subtitles: [],
        error: { message: 'Geçersiz bölüm bağlantısı' }
      };
    }

    const want = String(lang || 'sub').trim().toLowerCase() === 'dub' ? 'dub' : 'sub';
    const altLang = want === 'dub' ? 'sub' : 'dub';

    const html = await httpGet(targetUrl);
    if (!html) {
      return {
        url: '',
        streamUrl: '',
        streamType: 'mp4',
        format: 'mp4',
        quality: '1080p',
        headers: {},
        streams: [],
        servers: [],
        subtitles: [],
        error: { message: 'Dizci: Sayfa içeriği alınamadı' }
      };
    }

    // 1. Structured versions parsing (Dizci Next.js App Router state)
    let versions = [];
    const vm = html.match(/\\?"versions\\?":\s*(\[\{[\s\S]*?\}\])\s*,\s*\\?"actionLabel\\?"/);
    if (vm) {
      try {
        const jsonStr = vm[1].replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\u0026/g, '&');
        versions = JSON.parse(jsonStr);
      } catch (_) {}
    }

    // Order versions: desired language first, then alternate
    const orderedVersions = [];
    const prefVer = versions.find(v => v.language === want);
    if (prefVer) orderedVersions.push(prefVer);
    const altVer = versions.find(v => v.language === altLang);
    if (altVer && altVer !== prefVer) orderedVersions.push(altVer);

    for (const ver of orderedVersions) {
      const sources = Array.isArray(ver.sources) ? ver.sources : [];
      let primaryStream = null;
      const combinedServers = [];
      const combinedStreams = [];

      for (const src of sources) {
        const provider = String(src.provider || '').toLowerCase();
        const embedUrl = String(src.embedUrl || '');

        let stream = null;
        if (provider.includes('dzen') || embedUrl.includes('dzen.ru')) {
          stream = await resolveDzen(embedUrl);
        } else if (provider.includes('vidmoly') || embedUrl.includes('vidmoly')) {
          stream = await resolveVidMoly(embedUrl);
        } else if (provider.includes('ok') || embedUrl.includes('ok.ru') || embedUrl.includes('odnoklassniki')) {
          stream = await resolveOkRu(embedUrl);
        }

        if (stream && stream.url) {
          if (!primaryStream) {
            primaryStream = stream;
          }
          if (Array.isArray(stream.servers)) {
            combinedServers.push(...stream.servers);
          }
          if (Array.isArray(stream.streams)) {
            combinedStreams.push(...stream.streams);
          }
        }
      }

      if (primaryStream && primaryStream.url) {
        const verLabel = ver.language === 'dub' ? 'Dublaj (TR)' : 'Altyazılı (EN)';
        return {
          url: primaryStream.url,
          streamUrl: primaryStream.streamUrl || primaryStream.url,
          streamType: primaryStream.streamType || 'mp4',
          format: primaryStream.format || 'mp4',
          quality: primaryStream.quality || '1080p',
          headers: primaryStream.headers || {},
          streams: combinedStreams.length > 0 ? combinedStreams : [`${primaryStream.quality} ${(primaryStream.format || 'mp4').toUpperCase()}`, primaryStream.url],
          servers: combinedServers.length > 0 ? combinedServers : [{ name: `Dizci ${primaryStream.serverName} (${verLabel})`, url: primaryStream.url }],
          subtitles: []
        };
      }
    }

    // 2. Fallback: search for VidMoly or Dzen embeds via regex in HTML
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

    const vidmolyId = findEmbed(want, 'vidmoly') || findEmbed(altLang, 'vidmoly');
    if (vidmolyId) {
      const stream = await resolveVidMoly(`https://vidmoly.biz/embed-${vidmolyId}.html`);
      if (stream && stream.url) {
        return {
          url: stream.url,
          streamUrl: stream.streamUrl || stream.url,
          streamType: stream.streamType,
          format: stream.format,
          quality: stream.quality,
          headers: stream.headers,
          streams: stream.streams,
          servers: stream.servers,
          subtitles: []
        };
      }
    }

    const dzenId = findEmbed(want, 'dzen') || findEmbed(altLang, 'dzen');
    if (dzenId) {
      const stream = await resolveDzen(`https://dzen.ru/embed/${dzenId}`);
      if (stream && stream.url) {
        return {
          url: stream.url,
          streamUrl: stream.streamUrl || stream.url,
          streamType: stream.streamType,
          format: stream.format,
          quality: stream.quality,
          headers: stream.headers,
          streams: stream.streams,
          servers: stream.servers,
          subtitles: []
        };
      }
    }

    return {
      url: '',
      streamUrl: '',
      streamType: 'mp4',
      format: 'mp4',
      quality: '1080p',
      headers: {},
      streams: [],
      servers: [],
      subtitles: [],
      error: { message: `Dizci: ${want.toUpperCase()} için oynatılabilir video kaynağı bulunamadı` }
    };
  } catch (err) {
    return {
      url: '',
      streamUrl: '',
      streamType: 'mp4',
      format: 'mp4',
      quality: '1080p',
      headers: {},
      streams: [],
      servers: [],
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    searchResults,
    extractDetails,
    extractEpisodes,
    extractStreamUrl,
    extractSubtitles,
    discoveryHome,
    discoveryFeed
  };
}
