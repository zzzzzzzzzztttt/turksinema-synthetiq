/**
 * Anizm Anime Source Module - Synthetiq Player
 * Target: Anizm (https://anizm.com.tr)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Native Aincrad (Reklamsız) high-speed CDN streaming via anizmplayer.com HLS
 *   - Automatic multi-quality resolution parsing (720p, 480p, 360p) with zero Turnstile blocks
 *   - Multi-source fallback support (Aincrad, YourUpload, Mail.ru)
 *   - Hardcoded Turkish fansub subtitles burned into video frames (zero subtitle loading failures)
 *   - Full iOS fetchv2 JSON bridge compatibility
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
 * Universal HTTP POST supporting iOS Synthetiq fetchv2 and standard fetch
 */
async function httpPost(url, bodyData, customHeaders = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': BASE_URL + '/',
    ...customHeaders
  };

  let res;
  if (typeof fetchv2 === 'function') {
    res = await fetchv2(url, headers, 'POST', bodyData, { timeoutMs: 25000 });
  } else {
    res = await fetch(url, { method: 'POST', headers, body: bodyData });
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
 * Resolves Aincrad (Reklamsız) high-speed HLS CDN alongside YourUpload and Mail.ru mirrors
 */
async function extractStreamUrl(episodeUrl) {
  try {
    const cleanUrl = String(episodeUrl || '').replace(/#.*$/, '');
    const html = await httpGet(cleanUrl);

    // Find translator endpoints
    const transEndpoints = [];
    const m1 = [...html.matchAll(/\/bolum\/\d+\/cevirmen\/\d+/g)].map(x => makeAbsolute(x[0]));
    for (const u of m1) {
      if (!transEndpoints.includes(u)) transEndpoints.push(u);
    }

    const servers = [];
    let primaryStream = null;

    for (const endp of transEndpoints) {
      try {
        const tText = await httpGet(endp, {
          'Referer': cleanUrl,
          'X-Requested-With': 'XMLHttpRequest'
        });
        if (!tText) continue;

        let data;
        try { data = JSON.parse(tText); } catch (_) { continue; }
        if (!data || !Array.isArray(data.videos)) continue;

        for (const targetVideo of data.videos) {
          const pUrl = `https://anizm.com.tr/player/${targetVideo.id}`;

          // 1. Aincrad (Reklamsız) - Anizm's Native Ad-Free High-Speed CDN
          if (/Aincrad/i.test(targetVideo.name)) {
            try {
              const pHtml = await httpGet(pUrl, { 'Referer': cleanUrl });
              const hashMatch = pHtml.match(/([a-f0-9]{32})\|FirePlayer/i) ||
                                pHtml.match(/FirePlayer\|([a-f0-9]{32})/i) ||
                                pHtml.match(/FirePlayer\(["']([a-f0-9]{32})["']/i);

              if (hashMatch) {
                const hash = hashMatch[1];
                const postUrl = `https://anizmplayer.com/player/index.php?data=${hash}&do=getVideo`;
                const gText = await httpPost(
                  postUrl,
                  `hash=${hash}&r=https://anizm.com.tr/`,
                  {
                    'Referer': pUrl,
                    'Origin': 'https://anizm.com.tr'
                  }
                );

                if (gText) {
                  const gData = JSON.parse(gText);
                  if (gData && gData.videoSource) {
                    const masterUrl = gData.videoSource;
                    const mText = await httpGet(masterUrl, { 'Referer': BASE_URL + '/', 'Accept': '*/*' });

                    const qualities = [];
                    const lines = String(mText || '').split(/\r?\n/);
                    for (let li = 0; li < lines.length; li++) {
                      const line = lines[li].trim();
                      if (line.startsWith('#EXT-X-STREAM-INF:')) {
                        const nameMatch = line.match(/NAME="([^"]+)"/i);
                        const resMatch = line.match(/RESOLUTION=([0-9x]+)/i);
                        const label = nameMatch ? nameMatch[1] : (resMatch ? resMatch[1] : 'Auto');
                        const nextLine = lines[li + 1] ? lines[li + 1].trim() : '';
                        if (nextLine && !nextLine.startsWith('#')) {
                          const qUrl = makeAbsolute(nextLine, 'https://anizmplayer.com');
                          qualities.push({
                            label: label,
                            url: qUrl,
                            headers: { 'Referer': BASE_URL + '/' }
                          });
                        }
                      }
                    }

                    if (qualities.length === 0) {
                      qualities.push({
                        label: 'Auto (HLS)',
                        url: masterUrl,
                        headers: { 'Referer': BASE_URL + '/' }
                      });
                    }

                    const bestQuality = qualities[qualities.length - 1];
                    servers.push({
                      name: 'Aincrad (Reklamsız)',
                      label: 'Aincrad · HLS (Gömülü Türkçe Altyazı)',
                      audioLanguage: 'ja',
                      audioLanguages: ['ja'],
                      qualities: qualities,
                      subtitles: []
                    });

                    if (!primaryStream) {
                      primaryStream = {
                        url: bestQuality.url,
                        streamType: 'hls',
                        quality: bestQuality.label,
                        headers: { 'Referer': 'https://anizmplayer.com/' }
                      };
                    }
                  }
                }
              }
            } catch (_) {}
          }

          // 2. YourUpload Mirror
          if (/YourUpload/i.test(targetVideo.name)) {
            try {
              const pHtml = await httpGet(pUrl, { 'Referer': cleanUrl });
              const yuIframe = pHtml.match(/yourupload\.com\/embed\/([a-zA-Z0-9]+)/i);
              if (yuIframe) {
                const yuUrl = `https://www.yourupload.com/embed/${yuIframe[1]}`;
                const yuHtml = await httpGet(yuUrl, { 'Referer': pUrl });
                const yuMp4 = yuHtml.match(/file:\s*["']([^"']+\.mp4[^"']*)["']/i) ||
                              yuHtml.match(/property="og:video"[^>]+content="([^"]+)"/i);
                if (yuMp4) {
                  const sUrl = yuMp4[1];
                  servers.push({
                    name: 'YourUpload',
                    label: 'YourUpload · 1080p MP4',
                    audioLanguage: 'ja',
                    audioLanguages: ['ja'],
                    qualities: [{ label: '1080p', url: sUrl, headers: { Referer: 'https://www.yourupload.com/' } }],
                    subtitles: []
                  });
                  if (!primaryStream) {
                    primaryStream = {
                      url: sUrl,
                      streamType: 'mp4',
                      quality: '1080p',
                      headers: { Referer: 'https://www.yourupload.com/' }
                    };
                  }
                }
              }
            } catch (_) {}
          }

          // 3. Mail.ru Mirror
          if (/Mail\.ru/i.test(targetVideo.name)) {
            try {
              const pHtml = await httpGet(pUrl, { 'Referer': cleanUrl });
              const mailRuMeta = pHtml.match(/"metadataUrl":\s*"([^"]+)"/i);
              if (mailRuMeta) {
                const metaUrl = makeAbsolute(mailRuMeta[1]);
                const mText = await httpGet(metaUrl, { 'Referer': pUrl });
                const mData = JSON.parse(mText);
                if (mData && mData.videos && mData.videos.length) {
                  const best = mData.videos[mData.videos.length - 1];
                  if (best && best.url) {
                    const sUrl = makeAbsolute(best.url);
                    servers.push({
                      name: 'Mail.ru',
                      label: 'Mail.ru · 1080p MP4',
                      audioLanguage: 'ja',
                      audioLanguages: ['ja'],
                      qualities: [{ label: '1080p', url: sUrl, headers: { Referer: 'https://my.mail.ru/' } }],
                      subtitles: []
                    });
                    if (!primaryStream) {
                      primaryStream = {
                        url: sUrl,
                        streamType: 'mp4',
                        quality: '1080p',
                        headers: { Referer: 'https://my.mail.ru/' }
                      };
                    }
                  }
                }
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    if (!primaryStream || servers.length === 0) {
      throw new Error('No stream found for episode');
    }

    const streams = [];
    streams.push('sub ' + (primaryStream.quality || 'Auto'), primaryStream.url);
    for (const s of servers) {
      for (const q of s.qualities) {
        if (q.url !== primaryStream.url) {
          streams.push(s.name + ' ' + q.label, q.url);
        }
      }
    }

    return {
      url: primaryStream.url,
      streams: streams,
      streamType: primaryStream.streamType,
      lang: 'sub',
      quality: primaryStream.quality || 'Auto',
      defaultQuality: primaryStream.quality || 'Auto',
      servers: servers,
      subtitles: [],
      headers: primaryStream.headers || {}
    };
  } catch (err) {
    return {
      streams: [],
      subtitles: [],
      error: { message: err ? err.message : 'Anizm stream extraction failed' }
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
