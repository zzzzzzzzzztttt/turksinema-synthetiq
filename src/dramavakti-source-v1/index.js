/**
 * DramaVakti Asian Drama Module - Synthetiq Player
 * Target: DramaVakti (https://dramavakti.com)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Direct HTML5 MP4 CDN streams (No P2P / WebTorrent, No Cloudflare Turnstile blocks)
 *   - Turkish subtitles embedded
 *   - Asian Dramas (K-Drama, C-Drama, J-Drama)
 */

const BASE_URL = 'https://dramavakti.com';

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

async function httpGet(url, customHeaders = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

  return text || '';
}

/**
 * Search results handler
 */
async function searchResults(query) {
  try {
    const url = `${BASE_URL}/ara?q=${encodeURIComponent(query)}`;
    const html = await httpGet(url);
    const items = [];
    const seen = new Set();
    const cardRegex = /<a[^>]+href="(\/dizi\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;

    while ((m = cardRegex.exec(html)) !== null) {
      const itemUrl = makeAbsolute(m[1]);
      if (seen.has(itemUrl)) continue;
      seen.add(itemUrl);
      const block = m[2];
      const imgMatch = block.match(/<img[^>]+(?:data-src|src)="([^"]+)"/i);
      const titleMatch = block.match(/<(?:h2|h3|h4|span|div)[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([\s\S]*?)<\//i) ||
                         block.match(/alt="([^"]+)"/i);
      let title = titleMatch ? cleanText(titleMatch[1]) : '';
      if (!title) {
        const slug = m[1].replace('/dizi/', '').replace(/-turkce.*$/, '');
        title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      const cover = imgMatch ? makeAbsolute(imgMatch[1]) : '';
      items.push({
        id: itemUrl,
        title: title,
        url: itemUrl,
        href: itemUrl,
        image: cover,
        poster: cover,
        coverUrl: cover
      });
    }

    return items;
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
    const title = titleMatch ? cleanText(titleMatch[1]) : 'Drama';
    const descMatch = html.match(/<p[^>]+class="[^"]*(?:description|synopsis|summary)[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
                      html.match(/<div[^>]+class="[^"]*story[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
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
      title: 'Drama',
      url: targetUrl,
      href: targetUrl
    };
  }
}

/**
 * Extract episodes
 */
async function extractEpisodes(dramaUrl) {
  try {
    const html = await httpGet(dramaUrl);
    const episodes = [];
    const epRegex = /href="(\/dizi\/[^"']+\/bolum-([0-9]+))"/gi;
    let m;
    const seen = new Set();

    while ((m = epRegex.exec(html)) !== null) {
      const epUrl = makeAbsolute(m[1]);
      const epNum = parseInt(m[2], 10);
      if (seen.has(epUrl)) continue;
      seen.add(epUrl);
      episodes.push({
        id: epUrl,
        title: `Bölüm ${epNum}`,
        episodeNumber: epNum,
        seasonNumber: 1,
        season: 1,
        episode: epNum,
        url: epUrl,
        href: epUrl
      });
    }

    episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
    if (!episodes.length) {
      episodes.push({
        id: dramaUrl,
        title: 'Bölüm 1',
        episodeNumber: 1,
        seasonNumber: 1,
        season: 1,
        episode: 1,
        url: dramaUrl,
        href: dramaUrl
      });
    }
    return episodes;
  } catch (err) {
    return [{
      id: dramaUrl,
      title: 'Bölüm 1',
      episodeNumber: 1,
      seasonNumber: 1,
      season: 1,
      episode: 1,
      url: dramaUrl,
      href: dramaUrl
    }];
  }
}

/**
 * Extract video stream
 */
async function extractStreamUrl(episodeUrl) {
  try {
    const html = await httpGet(episodeUrl);
    const videoMatch = html.match(/<(?:video|source)[^>]+src="([^"]+)"/i);
    if (!videoMatch) throw new Error('Video tag not found');
    const streamUrl = makeAbsolute(videoMatch[1]);

    return {
      url: streamUrl,
      streams: ['sub 720p', streamUrl],
      streamType: 'mp4',
      lang: 'sub',
      quality: '720p',
      defaultQuality: '720p',
      servers: [{
        name: 'DramaVakti CDN',
        label: 'DramaVakti · Direct MP4 (Türkçe Altyazı)',
        audioLanguage: 'ko',
        audioLanguages: ['ko', 'zh', 'ja'],
        qualities: [{ label: '720p', url: streamUrl, headers: { Referer: BASE_URL + '/' } }],
        subtitles: [{ language: 'tr', label: 'Türkçe Altyazı', default: true }]
      }],
      subtitles: [{ language: 'tr', label: 'Türkçe Altyazı', default: true }],
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': BASE_URL + '/'
      }
    };
  } catch (err) {
    return {
      url: episodeUrl,
      streams: ['Source', episodeUrl],
      headers: {},
      streamType: 'mp4',
      lang: 'sub',
      quality: '720p',
      defaultQuality: '720p',
      subtitles: [],
      servers: []
    };
  }
}

/**
 * Discovery Home handler
 */
async function discoveryHome() {
  try {
    const html = await httpGet(BASE_URL + '/');
    const cardRegex = /<a[^>]+href="(\/dizi\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const items = [];
    const seen = new Set();
    let m;

    while ((m = cardRegex.exec(html)) !== null) {
      const itemUrl = makeAbsolute(m[1]);
      if (seen.has(itemUrl)) continue;
      seen.add(itemUrl);
      const block = m[2];
      const imgMatch = block.match(/<img[^>]+(?:data-src|src)="([^"]+)"/i);
      const titleMatch = block.match(/<(?:h2|h3|h4|span|div)[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([\s\S]*?)<\//i) ||
                         block.match(/alt="([^"]+)"/i);
      let title = titleMatch ? cleanText(titleMatch[1]) : '';
      if (!title) {
        const slug = m[1].replace('/dizi/', '').replace(/-turkce.*$/, '');
        title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      const cover = imgMatch ? makeAbsolute(imgMatch[1]) : '';
      items.push({
        id: itemUrl,
        title: title,
        url: itemUrl,
        href: itemUrl,
        image: cover,
        poster: cover,
        coverUrl: cover
      });
      if (items.length >= 30) break;
    }

    const sections = [];
    if (items.length > 0) {
      sections.push({
        id: 'dramavakti_featured',
        title: 'Popüler Asya Dizileri',
        type: 'featured',
        items: items
      });
    }

    return sections;
  } catch (err) {
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
  } catch (err) {
    return [];
  }
}

// Module Exports
globalThis.searchResults = searchResults;
globalThis.extractDetails = extractDetails;
globalThis.extractEpisodes = extractEpisodes;
globalThis.extractStreamUrl = extractStreamUrl;
globalThis.discoveryHome = discoveryHome;
globalThis.discoveryFeed = discoveryFeed;
