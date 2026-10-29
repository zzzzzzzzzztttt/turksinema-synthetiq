/**
 * KoreDiziizle Video Source Module - Synthetiq Player
 * Target: KoreDiziizle (https://korediziizletr.org)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Korean, Chinese & Asian Dramas & Asian Movies
 *   - High-Speed Ok.ru (Direct 1080p/720p MP4 & HLS), Vidmoly (HLS), and VK Video
 *   - Vibrant Discovery Home with Hero carousel, Top 10 rankings, and categorised shelves
 *   - Instant JSON search via /ajax/ara.php
 *   - No Cloudflare Turnstile blocks, Native iOS AVPlayer compatible
 */

const BASE_URL = 'https://korediziizletr.org';

function makeAbsolute(path, base) {
  if (!path) return '';
  const trimmed = String(path).trim();
  if (trimmed.indexOf('http://') === 0 || trimmed.indexOf('https://') === 0) {
    return trimmed;
  }
  if (trimmed.indexOf('//') === 0) {
    return 'https:' + trimmed;
  }
  const cleanBase = String(base || BASE_URL).replace(/\/+$/, '');
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

function upgradeImg(url) {
  if (!url) return '';
  const abs = makeAbsolute(url, BASE_URL);
  return abs.replace(/\/uploads\/kucuk\/(?:120|240|360)\//, '/uploads/kucuk/720/');
}

function decodeBase64(str) {
  if (typeof atob === 'function') {
    try { return atob(str); } catch (_) {}
  }
  if (typeof Buffer !== 'undefined') {
    try { return Buffer.from(str, 'base64').toString('utf8'); } catch (_) {}
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = String(str).replace(/=+$/, '');
  for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

/**
 * Robust HTTP GET with fetchv2 signature
 */
async function httpGet(url, customHeaders = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
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

/**
 * Robust HTTP POST with fetchv2 signature
 */
async function httpPost(url, data, customHeaders = {}) {
  let body = '';
  if (typeof data === 'string') {
    body = data;
  } else if (data && typeof data === 'object') {
    body = Object.keys(data)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k] == null ? '' : data[k]))
      .join('&');
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': BASE_URL + '/',
    'Origin': BASE_URL,
    ...customHeaders
  };

  let res;
  if (typeof fetchv2 === 'function') {
    res = await fetchv2(url, headers, 'POST', body, { timeoutMs: 25000 });
  } else {
    res = await fetch(url, { method: 'POST', headers, body });
  }

  let text = '';
  if (res && typeof res.text === 'function') {
    try { text = await res.text(); } catch (_) {}
  } else if (res && typeof res.body === 'string') {
    text = res.body;
  } else if (res && res.body != null) {
    text = String(res.body);
  }

  return text || '';
}

/**
 * Stream Resolver: Ok.ru
 * Resolves direct progressive 1080p, 720p, 480p, 360p MP4 videos & Adaptive HLS
 */
async function resolveOkRu(embedUrl) {
  try {
    let cleanUrl = embedUrl.startsWith('//') ? 'https:' + embedUrl : embedUrl;
    const html = await httpGet(cleanUrl, {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      'Referer': 'https://ok.ru/'
    });
    if (!html) return null;

    const dataOptMatch = html.match(/data-options=["']([^"']+)["']/i);
    if (!dataOptMatch) return null;

    const decoded = dataOptMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const opts = JSON.parse(decoded);
    const meta = typeof opts.flashvars?.metadata === 'string' ? JSON.parse(opts.flashvars.metadata) : (opts.flashvars?.metadata || {});

    const streams = [];
    const servers = [];
    const qualities = [];

    if (meta.videos && Array.isArray(meta.videos) && meta.videos.length > 0) {
      const order = ['full', 'hd', 'sd', 'low', 'lowest', 'mobile'];
      const labels = { 'full': '1080p', 'hd': '720p', 'sd': '480p', 'low': '360p', 'lowest': '240p', 'mobile': '144p' };
      const sorted = meta.videos.slice().sort((a, b) => {
        let ia = order.indexOf(a.name);
        let ib = order.indexOf(b.name);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

      sorted.forEach(v => {
        const qLabel = labels[v.name] || v.name;
        streams.push(`${qLabel} MP4`, v.url);
        qualities.push({ label: qLabel, url: v.url });
        servers.push({
          name: `Ok.ru (${qLabel})`,
          label: `Ok.ru · ${qLabel} Direct MP4`,
          url: v.url,
          streamType: 'mp4',
          quality: qLabel
        });
      });

      const best = sorted[0];
      const bestLabel = labels[best.name] || 'HD';
      return {
        url: best.url,
        streamType: 'mp4',
        quality: bestLabel,
        streams,
        servers,
        qualities
      };
    }

    if (meta.hlsManifestUrl) {
      return {
        url: meta.hlsManifestUrl,
        streamType: 'hls',
        quality: 'Auto',
        streams: ['Auto HLS', meta.hlsManifestUrl],
        servers: [{
          name: 'Ok.ru (HLS)',
          label: 'Ok.ru · Adaptive HLS',
          url: meta.hlsManifestUrl,
          streamType: 'hls',
          quality: 'Auto'
        }],
        qualities: [{ label: 'Auto', url: meta.hlsManifestUrl }]
      };
    }

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Stream Resolver: Vidmoly
 * Resolves Adaptive HLS master playlist
 */
async function resolveVidmoly(embedUrl) {
  try {
    let cleanUrl = embedUrl.startsWith('//') ? 'https:' + embedUrl : embedUrl;
    const html = await httpGet(cleanUrl, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': BASE_URL + '/'
    });
    if (!html) return null;

    const fileMatch = html.match(/sources:\s*\[\s*\{\s*file:\s*["']([^"']+)["']/i)
      || html.match(/file:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);

    if (fileMatch && fileMatch[1]) {
      const hlsUrl = fileMatch[1];
      return {
        url: hlsUrl,
        streamType: 'hls',
        quality: 'Auto',
        streams: ['Vidmoly HLS', hlsUrl],
        servers: [{
          name: 'Vidmoly',
          label: 'Vidmoly · Adaptive HLS',
          url: hlsUrl,
          streamType: 'hls',
          quality: 'Auto'
        }],
        qualities: [{ label: 'Auto', url: hlsUrl }]
      };
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Stream Resolver: VK Video
 */
async function resolveVk(embedUrl) {
  try {
    let cleanUrl = embedUrl.startsWith('//') ? 'https:' + embedUrl : embedUrl;
    const html = await httpGet(cleanUrl, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': BASE_URL + '/'
    });
    if (!html) return null;

    const urlMatches = [...html.matchAll(/(url\d+|hls)\s*:\s*["']([^"']+)["']/g)];
    if (urlMatches.length > 0) {
      const best = urlMatches[0];
      const streamUrl = best[2].replace(/\\\//g, '/');
      const isHls = best[1] === 'hls' || streamUrl.includes('.m3u8');
      return {
        url: streamUrl,
        streamType: isHls ? 'hls' : 'mp4',
        quality: 'HD',
        streams: [`VK ${best[1]}`, streamUrl],
        servers: [{
          name: 'VK',
          label: `VK · ${best[1]}`,
          url: streamUrl,
          streamType: isHls ? 'hls' : 'mp4',
          quality: 'HD'
        }],
        qualities: [{ label: 'HD', url: streamUrl }]
      };
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Search Handler
 */
async function searchResults(query, page = 1) {
  try {
    const q = String(query || '').trim();
    if (!q) return [];

    const jsonText = await httpGet(`${BASE_URL}/ajax/ara.php?term=${encodeURIComponent(q)}`);
    const parsed = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;

    if (!Array.isArray(parsed)) return [];

    return parsed.map(item => {
      const itemUrl = makeAbsolute(item.url || `/dizi/${item.permalink}`, BASE_URL);
      const title = cleanText(item.adi || item.value || item.permalink);
      const cover = upgradeImg(item.resim);

      return {
        id: itemUrl,
        title: title,
        url: itemUrl,
        href: itemUrl,
        image: cover,
        poster: cover,
        coverUrl: cover,
        backdrop: cover,
        rating: item.meta ? cleanText(item.meta) : undefined
      };
    }).filter(it => it.title && it.title.length > 0 && it.poster && it.poster.length > 5);
  } catch (_) {
    return [];
  }
}

/**
 * Details Handler
 */
async function extractDetails(targetUrl) {
  try {
    const rawUrl = typeof targetUrl === 'object' && targetUrl !== null ? (targetUrl.url || targetUrl.id) : targetUrl;
    // Normalize episode URL to series URL if needed
    const seriesUrl = rawUrl.replace(/\/sezon-\d+\/bolum-\d+.*$/, '');
    const html = await httpGet(seriesUrl, { 'Referer': BASE_URL + '/' });

    const title = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || 'Asya İçeriği';
    
    const poster = upgradeImg(
      html.match(/<div class="g-poster[^"]*"[^>]*>[\s\S]*?<img src="([^"]+)"/i)?.[1]
      || html.match(/<img[^>]+(?:class="[^"]*(?:poster|cover)[^"]*"|alt="[^"]*afişi")[^>]*src="([^"]+)"/i)?.[1]
      || html.match(/<img[^>]+src="([^"]*\/uploads\/[^"]+)"/i)?.[1]
    );

    const desc = html.match(/<div[^>]*class="[^"]*(?:summary|aciklama|ozet|desc|content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, '').trim()
      || html.match(/<p[^>]*class="[^"]*(?:summary|aciklama|ozet|desc)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1]?.replace(/<[^>]+>/g, '').trim()
      || '';

    const ratingMatch = html.match(/class="[^"]*(?:rating|puan|imdb|score)[^"]*"[^>]*>([\s\S]*?)<\//i)
      || html.match(/<span[^>]*class="g-badge[^"]*"[^>]*>([\d.,]+)<\/span>/i);
    const rating = ratingMatch ? ratingMatch[1].replace(/<[^>]+>/g, '').trim() : undefined;

    return {
      id: seriesUrl,
      title: title,
      url: seriesUrl,
      href: seriesUrl,
      description: desc,
      poster: poster,
      image: poster,
      coverUrl: poster,
      backdrop: poster,
      rating: rating
    };
  } catch (_) {
    const fallbackUrl = String(targetUrl);
    return {
      id: fallbackUrl,
      title: 'Asya Dizisi',
      url: fallbackUrl,
      href: fallbackUrl,
      description: '',
      poster: '',
      image: '',
      coverUrl: '',
      backdrop: ''
    };
  }
}

/**
 * Episodes Handler
 */
async function extractEpisodes(targetUrl) {
  try {
    const rawUrl = typeof targetUrl === 'object' && targetUrl !== null ? (targetUrl.url || targetUrl.id) : targetUrl;
    
    // If it's a single movie
    if (rawUrl.includes('/film/')) {
      const details = await extractDetails(rawUrl).catch(() => null);
      const title = details?.title || 'Film (Tek Parça)';
      return [
        {
          id: rawUrl,
          title: title,
          url: rawUrl,
          href: rawUrl,
          season: 1,
          episode: 1
        }
      ];
    }

    // Series episodes
    const seriesUrl = rawUrl.replace(/\/sezon-\d+\/bolum-\d+.*$/, '');
    const html = await httpGet(seriesUrl, { 'Referer': BASE_URL + '/' });

    const episodes = [];
    const seen = new Set();
    const epLinkRegex = /<a[^>]+href="([^"]*\/dizi\/[^"]*\/sezon-(\d+)\/bolum-(\d+))"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;

    while ((m = epLinkRegex.exec(html)) !== null) {
      const epUrl = makeAbsolute(m[1], BASE_URL);
      if (seen.has(epUrl)) continue;
      seen.add(epUrl);

      const sNum = parseInt(m[2], 10) || 1;
      const epNum = parseInt(m[3], 10) || (episodes.length + 1);

      episodes.push({
        id: epUrl,
        title: `${sNum}. Sezon ${epNum}. Bölüm`,
        url: epUrl,
        href: epUrl,
        season: sNum,
        episode: epNum
      });
    }

    // Sort sequentially by season and episode number
    episodes.sort((a, b) => a.season !== b.season ? a.season - b.season : a.episode - b.episode);

    if (episodes.length === 0) {
      episodes.push({
        id: rawUrl,
        title: '1. Sezon 1. Bölüm',
        url: rawUrl,
        href: rawUrl,
        season: 1,
        episode: 1
      });
    }

    return episodes;
  } catch (_) {
    const fallbackUrl = String(targetUrl);
    return [
      {
        id: fallbackUrl,
        title: '1. Bölüm',
        url: fallbackUrl,
        href: fallbackUrl,
        season: 1,
        episode: 1
      }
    ];
  }
}

/**
 * Stream URL Extractor
 */
async function extractStreamUrl(targetUrl, want = 'sub') {
  try {
    const rawUrl = typeof targetUrl === 'object' && targetUrl !== null ? (targetUrl.url || targetUrl.id) : targetUrl;
    const html = await httpGet(rawUrl, { 'Referer': BASE_URL + '/' });

    const isFilm = rawUrl.includes('/film/');
    const pMatch = html.match(/var (?:playerUrl|filmPlayerUrl)\s*=\s*"([^"]+)"/);
    const playerUrl = pMatch
      ? pMatch[1]
      : (isFilm ? `${BASE_URL}/ajax/request=getFramesFilmler` : `${BASE_URL}/ajax/request=getFrames`);

    // Match all sources with data-code
    const btnMatches = [...html.matchAll(/<div[^>]*data-code="([^"]+)"[^>]*>([\s\S]*?)<\/div>/gi)];
    const sourceList = [];
    if (btnMatches.length > 0) {
      btnMatches.forEach(b => sourceList.push({ code: b[1], name: cleanText(b[2]) || 'Kaynak' }));
    } else {
      const dcMatch = html.match(/var dataCode\s*=\s*"([^"]+)"/);
      if (dcMatch) sourceList.push({ code: dcMatch[1], name: 'Ana Kaynak' });
    }

    const allServers = [];
    let primaryStream = null;

    for (const src of sourceList) {
      try {
        const b64 = await httpPost(playerUrl, { dataCode: src.code }, { 'Referer': rawUrl });
        const frameHtml = decodeBase64(b64);
        const iframeSrc = frameHtml.match(/<iframe[^>]+src="([^"]+)"/i)?.[1];
        if (!iframeSrc) continue;

        let resolved = null;
        if (iframeSrc.includes('ok.ru')) {
          resolved = await resolveOkRu(iframeSrc);
        } else if (iframeSrc.includes('vidmoly')) {
          resolved = await resolveVidmoly(iframeSrc);
        } else if (iframeSrc.includes('vk') || iframeSrc.includes('vkvideo')) {
          resolved = await resolveVk(iframeSrc);
        }

        if (resolved && resolved.url) {
          if (!primaryStream) primaryStream = resolved;
          if (Array.isArray(resolved.servers)) {
            allServers.push(...resolved.servers);
          }
        }
      } catch (_) {}
    }

    if (!primaryStream) {
      throw new Error('No playable stream found for ' + rawUrl);
    }

    return {
      url: primaryStream.url,
      streamType: primaryStream.streamType,
      quality: primaryStream.quality,
      defaultQuality: primaryStream.quality,
      streams: primaryStream.streams,
      servers: allServers.length > 0 ? allServers : primaryStream.servers,
      qualities: primaryStream.qualities,
      headers: { 'Referer': BASE_URL + '/' }
    };
  } catch (err) {
    const fallbackUrl = String(targetUrl);
    return {
      url: fallbackUrl,
      streamType: 'mp4',
      quality: '1080p',
      defaultQuality: '1080p',
      streams: ['Source', fallbackUrl],
      servers: [],
      headers: {}
    };
  }
}

/**
 * Discovery Home Handler
 */
async function discoveryHome() {
  try {
    const html = await httpGet(BASE_URL + '/', { 'Referer': BASE_URL });

    // 1. Hero slides
    const heroSlideRegex = /<div class="g-hero__slide"[^>]*data-bg="([^"]+)"[\s\S]*?<h2 class="g-hero__title">([\s\S]*?)<\/h2>[\s\S]*?<a class="g-hero__poster" href="([^"]+)"[\s\S]*?<img src="([^"]+)"/gi;
    const heroItems = [];
    let hMatch;
    while ((hMatch = heroSlideRegex.exec(html)) !== null) {
      const bg = upgradeImg(hMatch[1]);
      const title = cleanText(hMatch[2]);
      const url = makeAbsolute(hMatch[3], BASE_URL);
      const poster = upgradeImg(hMatch[4]);
      if (title && poster) {
        heroItems.push({
          id: url,
          title: title,
          url: url,
          href: url,
          poster: poster,
          image: poster,
          backdrop: bg || poster,
          coverUrl: poster
        });
      }
    }

    // Helper to parse cards within HTML sections marked by comments
    function parseSectionCards(commentName) {
      const startComment = `<!-- ============ ${commentName} ============ -->`;
      const startIdx = html.indexOf(startComment);
      if (startIdx === -1) return [];
      const nextCommentIdx = html.indexOf('<!-- ============', startIdx + startComment.length);
      const chunk = nextCommentIdx !== -1 ? html.substring(startIdx, nextCommentIdx) : html.substring(startIdx, startIdx + 30000);

      const items = [];
      const seen = new Set();
      const cardRegex = /<a[^>]+href="([^"]*(?:\/dizi\/|\/film\/)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = cardRegex.exec(chunk)) !== null) {
        const itemUrl = makeAbsolute(m[1], BASE_URL);
        if (seen.has(itemUrl)) continue;

        const block = m[2];
        const titleMatch = block.match(/<(?:h2|h3|h4|span|div|p)[^>]*class="[^"]*(?:title|adi|baslik|name)[^"]*"[^>]*>([\s\S]*?)<\//i)
          || block.match(/alt="([^"]+)"/i);
        const imgMatch = block.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i);

        let title = cleanText(titleMatch ? titleMatch[1] : '');
        title = title.replace(/\s*(?:afişi|izle)$/i, '').trim();
        const cover = upgradeImg(imgMatch ? imgMatch[1] : '');

        if (title.length > 1 && cover && cover.length > 5 && !cover.includes('data:image')) {
          seen.add(itemUrl);
          items.push({
            id: itemUrl,
            title: title,
            url: itemUrl,
            href: itemUrl,
            poster: cover,
            image: cover,
            backdrop: cover,
            coverUrl: cover
          });
        }
      }
      return items;
    }

    const sections = [];

    // Section 1: Hero Carousel
    if (heroItems.length > 0) {
      sections.push({
        id: 'kd-hero',
        title: 'Öne Çıkan Asya Dizileri',
        style: 'hero',
        items: heroItems.slice(0, 6),
        viewAll: { mode: 'feed', feedId: 'hero' }
      });
    }

    // Section 2: Top 10 Weekly
    const top10 = parseSectionCards('Haftalık trend');
    if (top10.length >= 8) {
      sections.push({
        id: 'kd-top10',
        title: 'Bu Haftanın En Popüler 10 Asya Dizisi',
        style: 'top10',
        items: top10.slice(0, 10),
        viewAll: { mode: 'feed', feedId: 'top10' }
      });
    }

    // Section 3: Latest Episodes
    const newEpisodes = parseSectionCards('Son bölümler');
    if (newEpisodes.length > 0) {
      sections.push({
        id: 'kd-latest-episodes',
        title: 'Son Eklenen Bölümler',
        style: 'poster',
        items: newEpisodes.slice(0, 20),
        viewAll: { mode: 'feed', feedId: 'latest-episodes' }
      });
    }

    // Section 4: Recommended Dramas
    const recommended = parseSectionCards('İzlemeye değer');
    if (recommended.length > 0) {
      sections.push({
        id: 'kd-recommended',
        title: 'İzlemeye Değer Kore & Asya Dizileri',
        style: 'poster',
        items: recommended.slice(0, 20),
        viewAll: { mode: 'feed', feedId: 'recommended' }
      });
    }

    // Section 5: Asian Movies
    const movies = parseSectionCards('Son eklenen filmler');
    if (movies.length > 0) {
      sections.push({
        id: 'kd-movies',
        title: 'Son Eklenen Asya Filmleri',
        style: 'poster',
        items: movies.slice(0, 20),
        viewAll: { mode: 'feed', feedId: 'movies' }
      });
    }

    // Section 6: Most Liked
    const mostLiked = parseSectionCards('En çok beğenilenler');
    if (mostLiked.length > 0) {
      sections.push({
        id: 'kd-most-liked',
        title: 'En Çok Beğenilen Asya Yapımları',
        style: 'poster',
        items: mostLiked.slice(0, 20),
        viewAll: { mode: 'feed', feedId: 'most-liked' }
      });
    }

    return { sections: sections };
  } catch (_) {
    return { sections: [] };
  }
}

/**
 * Discovery Feed Handler
 */
async function discoveryFeed(feedId, page = 1) {
  try {
    const id = String(feedId || 'popular').toLowerCase();
    let url = `${BASE_URL}/dizi-izle`;

    if (id === 'movies') {
      url = `${BASE_URL}/film-izle`;
    } else if (id === 'korean' || id === 'popular' || id === 'top10' || id === 'hero') {
      url = `${BASE_URL}/kesfet/tur=null&yapimYili=null&ulke=Korea%2C+Republic+of&sirala=null&orderby=null`;
    }

    const html = await httpGet(url, { 'Referer': BASE_URL });
    const items = [];
    const seen = new Set();
    const cardRegex = /<a[^>]+href="([^"]*(?:\/dizi\/|\/film\/)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;

    while ((m = cardRegex.exec(html)) !== null) {
      const itemUrl = makeAbsolute(m[1], BASE_URL);
      if (seen.has(itemUrl)) continue;

      const block = m[2];
      const titleMatch = block.match(/<(?:h2|h3|h4|span|div|p)[^>]*class="[^"]*(?:title|adi|baslik|name)[^"]*"[^>]*>([\s\S]*?)<\//i)
        || block.match(/alt="([^"]+)"/i);
      const imgMatch = block.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i);

      let title = cleanText(titleMatch ? titleMatch[1] : '');
      title = title.replace(/\s*(?:afişi|izle)$/i, '').trim();
      const cover = upgradeImg(imgMatch ? imgMatch[1] : '');

      if (title.length > 1 && cover && cover.length > 5 && !cover.includes('data:image')) {
        seen.add(itemUrl);
        items.push({
          id: itemUrl,
          title: title,
          url: itemUrl,
          href: itemUrl,
          poster: cover,
          image: cover,
          backdrop: cover,
          coverUrl: cover
        });
      }
    }

    return {
      feedId: feedId,
      page: Number(page) || 1,
      items: items.slice(0, 30),
      hasMore: items.length >= 20
    };
  } catch (_) {
    return {
      feedId: feedId,
      page: Number(page) || 1,
      items: [],
      hasMore: false
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    searchResults,
    extractDetails,
    extractEpisodes,
    extractStreamUrl,
    discoveryHome,
    discoveryFeed
  };
}
