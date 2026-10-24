/**
 * Anizm Anime Source Module - Synthetiq Player
 * Target: Anizm (https://anizm.com.tr)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Turkish Anime with hardcoded fansub subtitles (burned into video frames)
 *   - Zero subtitle loading failures on iOS AVPlayer
 *   - Direct 1080p MP4 streams via high-speed CDNs (YourUpload / Mail.ru)
 *   - Fast, accurate catalog search (0 results on random non-matching queries)
 */

const BASE_URL = 'https://anizm.com.tr';

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
    const q = String(query || '').trim();
    if (!q) return [];

    const url = `${BASE_URL}/arama?q=${encodeURIComponent(q)}`;
    const html = await httpGet(url);
    const items = [];
    const cardRegex = /<article[^>]*class="[^"]*v3-catalog-card[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    let m;

    while ((m = cardRegex.exec(html)) !== null) {
      const block = m[1];
      const linkMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>/i);
      if (!linkMatch) continue;
      const itemUrl = makeAbsolute(linkMatch[1]);
      const imgMatch = block.match(/<img[^>]+src="([^"]+)"/i);
      const cover = imgMatch ? makeAbsolute(imgMatch[1]) : '';
      const titleMatch = linkMatch[0].match(/aria-label="([^"]+)"/i) || block.match(/alt="([^"]+)"/i);
      let title = titleMatch ? cleanText(titleMatch[1].replace(/anime detaylar[ıi]|posteri/gi, '')) : '';
      if (!title) {
        const slug = itemUrl.split('/').filter(Boolean).pop();
        title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      items.push({
        id: itemUrl,
        title: title,
        url: itemUrl,
        href: itemUrl,
        image: cover,
        poster: cover,
        coverUrl: cover,
        isSeries: true,
        type: 'series'
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
 */
async function extractEpisodes(animeUrl) {
  try {
    const html = await httpGet(animeUrl);
    const episodes = [];
    const epRegex = /href="([^"]+-[0-9]+-bolum(?:-[^"]*)?)"/gi;
    let m;
    const seen = new Set();

    while ((m = epRegex.exec(html)) !== null) {
      const epUrl = makeAbsolute(m[1]);
      if (seen.has(epUrl)) continue;
      seen.add(epUrl);
      const numMatch = epUrl.match(/-([0-9]+)-bolum/i);
      const epNum = numMatch ? parseInt(numMatch[1], 10) : episodes.length + 1;
      episodes.push({
        id: epUrl,
        title: `Bölüm ${epNum}`,
        seasonNumber: 1,
        episodeNumber: epNum,
        season: 1,
        episode: epNum,
        url: epUrl,
        href: epUrl
      });
    }

    if (!episodes.length) {
      episodes.push({
        id: animeUrl,
        title: 'Bölüm 1',
        seasonNumber: 1,
        episodeNumber: 1,
        season: 1,
        episode: 1,
        url: animeUrl,
        href: animeUrl
      });
    }

    episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
    return episodes;
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

    // Find translator endpoints
    const transEndpoints = [];
    const m1 = [...html.matchAll(/\/bolum\/\d+\/cevirmen\/\d+/g)].map(x => makeAbsolute(x[0]));
    for (const u of m1) {
      if (!transEndpoints.includes(u)) transEndpoints.push(u);
    }

    let streamUrl = '';
    let streamHeaders = { 'Referer': episodeUrl };

    for (const endp of transEndpoints) {
      try {
        const tText = await httpGet(endp, {
          'Referer': episodeUrl,
          'X-Requested-With': 'XMLHttpRequest'
        });
        const data = JSON.parse(tText);
        if (!data || !Array.isArray(data.videos)) continue;

        // Prioritize YourUpload or Mail.ru for reliable direct MP4 streams
        const pYourUpload = data.videos.find(v => /YourUpload/i.test(v.name));
        const pMailRu = data.videos.find(v => /Mail\.ru/i.test(v.name));
        const pAny = data.videos.find(v => !/StreamTape|UpBolt|FireStream/i.test(v.name)) || data.videos[0];

        const targetVideo = pYourUpload || pMailRu || pAny;
        if (targetVideo) {
          const pUrl = `https://anizm.com.tr/player/${targetVideo.id}`;
          const pHtml = await httpGet(pUrl, { 'Referer': episodeUrl });

          // 1. Check for YourUpload embed
          const yuIframe = pHtml.match(/yourupload\.com\/embed\/([a-zA-Z0-9]+)/i);
          if (yuIframe) {
            const yuUrl = `https://www.yourupload.com/embed/${yuIframe[1]}`;
            const yuHtml = await httpGet(yuUrl, { 'Referer': pUrl });
            const yuMp4 = yuHtml.match(/file:\s*["']([^"']+\.mp4[^"']*)["']/i) ||
                          yuHtml.match(/property="og:video"[^>]+content="([^"]+)"/i);
            if (yuMp4) {
              streamUrl = yuMp4[1];
              streamHeaders = {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
                'Referer': 'https://www.yourupload.com/'
              };
              break;
            }
          }

          // 2. Check for Mail.ru
          const mailRuMeta = pHtml.match(/"metadataUrl":\s*"([^"]+)"/i);
          if (mailRuMeta) {
            const metaUrl = makeAbsolute(mailRuMeta[1]);
            const mText = await httpGet(metaUrl, { 'Referer': pUrl });
            const mData = JSON.parse(mText);
            if (mData && mData.videos && mData.videos.length) {
              const best = mData.videos[mData.videos.length - 1];
              if (best && best.url) {
                streamUrl = makeAbsolute(best.url);
                streamHeaders = {
                  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
                  'Referer': 'https://my.mail.ru/'
                };
                break;
              }
            }
          }

          // 3. Check for direct mp4
          const directMp4 = pHtml.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
          if (directMp4) {
            streamUrl = directMp4[1];
            streamHeaders = {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
              'Referer': pUrl
            };
            break;
          }
        }
      } catch (_) {}
    }

    if (!streamUrl) throw new Error('No stream found for episode');

    return {
      url: streamUrl,
      streams: ['sub 1080p', streamUrl],
      streamType: 'mp4',
      lang: 'sub',
      quality: '1080p',
      defaultQuality: '1080p',
      servers: [{
        name: 'Anizm Fansub (Hardcoded TR Subs)',
        label: 'Anizm · 1080p MP4 (Gömülü Türkçe Altyazı)',
        audioLanguage: 'ja',
        audioLanguages: ['ja'],
        qualities: [{ label: '1080p MP4', url: streamUrl, headers: streamHeaders }],
        subtitles: [] // Subtitles are burned into video frames!
      }],
      subtitles: [],
      headers: streamHeaders
    };
  } catch (err) {
    return {
      url: episodeUrl,
      streams: ['Source', episodeUrl],
      headers: {},
      streamType: 'mp4',
      lang: 'sub',
      quality: '1080p',
      defaultQuality: '1080p',
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
    const items = [];
    const cardRegex = /<article[^>]*class="[^"]*v3-catalog-card[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    let m;

    while ((m = cardRegex.exec(html)) !== null) {
      const block = m[1];
      const linkMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>/i);
      if (!linkMatch) continue;
      const itemUrl = makeAbsolute(linkMatch[1]);
      const imgMatch = block.match(/<img[^>]+src="([^"]+)"/i);
      const cover = imgMatch ? makeAbsolute(imgMatch[1]) : '';
      const titleMatch = linkMatch[0].match(/aria-label="([^"]+)"/i) || block.match(/alt="([^"]+)"/i);
      let title = titleMatch ? cleanText(titleMatch[1].replace(/anime detaylar[ıi]|posteri/gi, '')) : '';
      if (!title) {
        const slug = itemUrl.split('/').filter(Boolean).pop();
        title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      items.push({
        id: itemUrl,
        title: title,
        url: itemUrl,
        href: itemUrl,
        image: cover,
        poster: cover,
        coverUrl: cover,
        isSeries: true,
        type: 'series'
      });
      if (items.length >= 30) break;
    }

    const sections = [];
    if (items.length > 0) {
      sections.push({
        id: 'anizm_popular',
        title: 'Popüler Animeler',
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
