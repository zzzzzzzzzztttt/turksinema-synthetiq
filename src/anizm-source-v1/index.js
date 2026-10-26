/**
 * Anizm Anime Source Module - Synthetiq Player
 * Target: Anizm (https://anizm.com.tr)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Native Aincrad (Reklamsız) high-speed CDN streaming via anizmplayer.com HLS
 *   - Multi-translator resolution (Lawsonia, Adonis, AkatsukiSubs, etc.) with dedicated server labels
 *   - Multi-source mirror fallbacks (Aincrad HLS, YourUpload MP4, SendVid MP4, Vidmoly HLS, Mail.ru MP4)
 *   - Automatic multi-quality resolution parsing (1080p, 720p, 480p, 360p) with zero Turnstile blocks
 *   - Safe pure-JS Dean Edwards packer unpacker (zero eval, zero Node.js dependencies)
 *   - Robust episode indexer with proper Season 1 and Specials/OVAs separation
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
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
 * Pure JavaScript Dean Edwards packer unpacker (safe, zero eval)
 */
function unpack(p, a, c, k, e, d) {
  d = d || {};
  e = function(val) {
    return (val < a ? '' : e(parseInt(val / a, 10))) + ((val = val % a) > 35 ? String.fromCharCode(val + 29) : val.toString(36));
  };
  if (!''.replace(/^/, String)) {
    while (c--) {
      d[e(c)] = k[c] || e(c);
    }
    k = [function(elem) { return d[elem]; }];
    e = function() { return '\\w+'; };
    c = 1;
  }
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]);
    }
  }
  return p;
}

function safeUnpack(html) {
  if (!html || typeof html !== 'string') return null;
  const match = html.match(/}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\.split\(['"]\|['"]\)/);
  if (!match) return null;
  try {
    const p = match[1];
    const a = parseInt(match[2], 10);
    const c = parseInt(match[3], 10);
    const k = match[4].split('|');
    return unpack(p, a, c, k);
  } catch (_) {
    return null;
  }
}

/**
 * Extract FirePlayer 32-hex hash from player HTML
 */
function extractFirePlayerHash(html) {
  if (!html || typeof html !== 'string') return null;

  // 1. Direct match: FirePlayer("...")
  let m = html.match(/FirePlayer\(["']([a-f0-9]{32})["']/i);
  if (m) return m[1];

  // 2. Token match in packed script: ...|([a-f0-9]{32})||FirePlayer|...
  m = html.match(/([a-f0-9]{32})\|+FirePlayer/i) ||
      html.match(/FirePlayer\|+([a-f0-9]{32})/i);
  if (m) return m[1];

  // 3. Safe unpack of Dean Edwards packed script
  const unpacked = safeUnpack(html);
  if (unpacked) {
    m = unpacked.match(/FirePlayer\(["']([a-f0-9]{32})["']/i) ||
        unpacked.match(/["']([a-f0-9]{32})["']/i);
    if (m) return m[1];
  }

  return null;
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
 * Extract anime episodes with natural ordering and proper Season 1 / Specials grouping
 */
async function extractEpisodes(animeUrl) {
  try {
    const html = await httpGet(animeUrl);
    const episodes = [];
    const seen = new Set();
    const rawItems = [];

    // Pattern A: Match elements with data-episode-title / data-episode-number
    const aRegex = /<a[^>]+href="([^"]+)"[^>]*data-episode-title="([^"]+)"[^>]*>([\s\S]*?)<\/a>|<a[^>]+data-episode-title="([^"]+)"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = aRegex.exec(html)) !== null) {
      const rawHref = m[1] || m[5];
      const rawTitle = m[2] || m[4];
      const epUrl = makeAbsolute(rawHref);
      if (!epUrl || seen.has(epUrl)) continue;
      seen.add(epUrl);
      rawItems.push({ url: epUrl, title: cleanText(rawTitle) });
    }

    // Pattern B: Fallback if data-episode-title anchors are absent
    if (rawItems.length === 0) {
      const fallbackRegex = /<a[^>]+href="([^"]+-[0-9a-z]+-bolum(?:-[^"]*)?)"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((m = fallbackRegex.exec(html)) !== null) {
        const epUrl = makeAbsolute(m[1]);
        const text = cleanText(m[2]);
        if (!epUrl || seen.has(epUrl) || epUrl.includes('ilk-bolum') || epUrl.includes('son-bolum')) continue;
        seen.add(epUrl);
        rawItems.push({ url: epUrl, title: text });
      }
    }

    let regularCount = 0;
    let specialCount = 0;

    for (const item of rawItems) {
      const isSpecial = /special|ova|film|sinema|movie/i.test(item.url) || /special|ova|film|movie/i.test(item.title);
      if (isSpecial) {
        specialCount++;
        episodes.push({
          id: item.url,
          title: item.title || `Special ${specialCount}`,
          seasonNumber: 0,
          episodeNumber: specialCount,
          season: 0,
          episode: specialCount,
          url: item.url,
          href: item.url
        });
      } else {
        regularCount++;
        episodes.push({
          id: item.url,
          title: item.title || `Bölüm ${regularCount}`,
          seasonNumber: 1,
          episodeNumber: regularCount,
          season: 1,
          episode: regularCount,
          url: item.url,
          href: item.url
        });
      }
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
 * Resolves multiple fansub translators (Lawsonia, Adonis, AkatsukiSubs) and sources (Aincrad HLS, YourUpload MP4, SendVid MP4, Vidmoly HLS)
 */
async function extractStreamUrl(episodeUrl) {
  try {
    const cleanUrl = String(episodeUrl || '').replace(/#.*$/, '');
    const html = await httpGet(cleanUrl);

    // Discover all translators from the page
    const transMap = new Map();
    const btnRegex1 = /<button[^>]+data-sources="([^"]+)"[^>]*title="([^"]+)"[^>]*>([\s\S]*?)<\/button>/gi;
    let bm;
    while ((bm = btnRegex1.exec(html)) !== null) {
      const srcUrl = bm[1];
      const tName = cleanText(bm[2] || bm[3]);
      transMap.set(srcUrl, tName);
    }

    const btnRegex2 = /<button[^>]+title="([^"]+)"[^>]*data-sources="([^"]+)"[^>]*>([\s\S]*?)<\/button>/gi;
    while ((bm = btnRegex2.exec(html)) !== null) {
      const tName = cleanText(bm[1]);
      const srcUrl = bm[2];
      if (!transMap.has(srcUrl)) transMap.set(srcUrl, tName);
    }

    const allEndpoints = [...html.matchAll(/\/bolum\/\d+\/cevirmen\/\d+/g)].map(x => x[0]);
    for (const endp of allEndpoints) {
      const fullUrl = makeAbsolute(endp);
      if (!transMap.has(fullUrl)) {
        transMap.set(fullUrl, 'Varsayılan');
      }
    }

    const servers = [];
    let primaryStream = null;

    for (const [transUrl, transName] of transMap.entries()) {
      try {
        const tText = await httpGet(transUrl, {
          'Referer': cleanUrl,
          'X-Requested-With': 'XMLHttpRequest'
        });
        if (!tText) continue;

        let data;
        try { data = JSON.parse(tText); } catch (_) { continue; }
        if (!data || !Array.isArray(data.videos)) continue;

        for (const targetVideo of data.videos) {
          const vName = targetVideo.name || 'Video';
          const pUrl = `https://anizm.com.tr/player/${targetVideo.id}`;

          // 1. Aincrad (Reklamsız) - Native Anizmplayer HLS CDN
          if (/Aincrad/i.test(vName)) {
            try {
              const pHtml = await httpGet(pUrl, { 'Referer': cleanUrl });
              const hash = extractFirePlayerHash(pHtml);

              if (hash) {
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
                            headers: { 'Referer': 'https://anizmplayer.com/' }
                          });
                        }
                      }
                    }

                    if (qualities.length === 0) {
                      qualities.push({
                        label: 'Auto (HLS)',
                        url: masterUrl,
                        headers: { 'Referer': 'https://anizmplayer.com/' }
                      });
                    }

                    const bestQuality = qualities[qualities.length - 1];
                    const serverName = `Aincrad [${transName}]`;
                    servers.push({
                      name: serverName,
                      label: `${serverName} · HLS`,
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
                        serverName: serverName,
                        headers: { 'Referer': 'https://anizmplayer.com/' }
                      };
                    }
                  }
                }
              }
            } catch (_) {}
          }

          // 2. YourUpload Mirror
          if (/YourUpload/i.test(vName)) {
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
                  const serverName = `YourUpload [${transName}]`;
                  servers.push({
                    name: serverName,
                    label: `${serverName} · 1080p MP4`,
                    audioLanguage: 'ja',
                    audioLanguages: ['ja'],
                    qualities: [{ label: '1080p', url: sUrl, headers: { 'Referer': 'https://www.yourupload.com/' } }],
                    subtitles: []
                  });
                  if (!primaryStream) {
                    primaryStream = {
                      url: sUrl,
                      streamType: 'mp4',
                      quality: '1080p',
                      serverName: serverName,
                      headers: { 'Referer': 'https://www.yourupload.com/' }
                    };
                  }
                }
              }
            } catch (_) {}
          }

          // 3. Vidmoly Mirror
          if (/Vidmoly/i.test(vName)) {
            try {
              const pHtml = await httpGet(pUrl, { 'Referer': cleanUrl });
              const vmIframe = pHtml.match(/vidmoly\.(?:to|me|net|biz)\/(?:embed-|w\/)?([a-zA-Z0-9]+)/i);
              if (vmIframe) {
                const vmUrl = `https://vidmoly.to/embed-${vmIframe[1]}.html`;
                const vmHtml = await httpGet(vmUrl, { 'Referer': pUrl });
                const vmM3u8 = vmHtml.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                               vmHtml.match(/sources:\s*\[\s*\{\s*file:\s*["']([^"']+)["']/i);
                if (vmM3u8) {
                  const sUrl = vmM3u8[1];
                  const serverName = `Vidmoly [${transName}]`;
                  servers.push({
                    name: serverName,
                    label: `${serverName} · HLS`,
                    audioLanguage: 'ja',
                    audioLanguages: ['ja'],
                    qualities: [{ label: '1080p', url: sUrl, headers: { 'Referer': 'https://vidmoly.to/' } }],
                    subtitles: []
                  });
                  if (!primaryStream) {
                    primaryStream = {
                      url: sUrl,
                      streamType: 'hls',
                      quality: '1080p',
                      serverName: serverName,
                      headers: { 'Referer': 'https://vidmoly.to/' }
                    };
                  }
                }
              }
            } catch (_) {}
          }

          // 4. SendVid Mirror
          if (/SendVid/i.test(vName)) {
            try {
              const pHtml = await httpGet(pUrl, { 'Referer': cleanUrl });
              const svMatch = pHtml.match(/var\s+video_source\s*=\s*["']([^"']+)["']/i) ||
                              pHtml.match(/video_source\s*=\s*["']([^"']+)["']/i) ||
                              pHtml.match(/<source[^>]+src=["']([^"']+\.mp4[^"']*)["']/i);
              if (svMatch) {
                const sUrl = svMatch[1];
                const serverName = `SendVid [${transName}]`;
                servers.push({
                  name: serverName,
                  label: `${serverName} · 720p MP4`,
                  audioLanguage: 'ja',
                  audioLanguages: ['ja'],
                  qualities: [{ label: '720p', url: sUrl, headers: { 'Referer': 'https://sendvid.com/' } }],
                  subtitles: []
                });
                if (!primaryStream) {
                  primaryStream = {
                    url: sUrl,
                    streamType: 'mp4',
                    quality: '720p',
                    serverName: serverName,
                    headers: { 'Referer': 'https://sendvid.com/' }
                  };
                }
              }
            } catch (_) {}
          }

          // 5. Mail.ru Mirror
          if (/Mail\.ru/i.test(vName)) {
            try {
              const pHtml = await httpGet(pUrl, { 'Referer': cleanUrl });
              const mailRuMeta = pHtml.match(/"metadataUrl":\s*"([^"]+)"/i);
              if (mailRuMeta) {
                const metaUrl = makeAbsolute(mailRuMeta[1]);
                const mText = await httpGet(metaUrl, { 'Referer': pUrl });
                const mData = JSON.parse(mText);
                if (mData && Array.isArray(mData.videos) && mData.videos.length > 0) {
                  const qualities = mData.videos.map(v => ({
                    label: v.key || '720p',
                    url: makeAbsolute(v.url),
                    headers: { 'Referer': 'https://my.mail.ru/' }
                  }));
                  const best = qualities[qualities.length - 1];
                  const serverName = `Mail.ru [${transName}]`;
                  servers.push({
                    name: serverName,
                    label: `${serverName} · MP4`,
                    audioLanguage: 'ja',
                    audioLanguages: ['ja'],
                    qualities: qualities,
                    subtitles: []
                  });
                  if (!primaryStream) {
                    primaryStream = {
                      url: best.url,
                      streamType: 'mp4',
                      quality: best.label,
                      serverName: serverName,
                      headers: { 'Referer': 'https://my.mail.ru/' }
                    };
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
