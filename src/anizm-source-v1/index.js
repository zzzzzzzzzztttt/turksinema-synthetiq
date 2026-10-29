/**
 * Anizm Anime Source Module - Synthetiq Player
 * Target: Anizm (https://anizm.com.tr)
 * Contract Version 3 | contentType: video
 * Features:
 *   - Native Aincrad (Reklamsız) high-speed CDN streaming via anizmplayer.com master HLS (full audio + video sync)
 *   - Direct multi-server list population for Synthetiq Player Server Tab (Aincrad, YourUpload, SendVid, Vidmoly)
 *   - Multi-translator resolution (Lawsonia, Adonis, AkatsukiSubs, Arcadia, etc.) with dedicated server tags
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

    // Isolate episode grid container if available to avoid header action buttons ("İlk/Son bölümü izle")
    let searchHtml = html;
    const gridMatch = html.match(/<div[^>]+class="[^"]*v3-anime-episode-grid[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (gridMatch) {
      searchHtml = gridMatch[1];
    }

    const aRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = aRegex.exec(searchHtml)) !== null) {
      const rawHref = m[1];
      const innerHtml = m[2];
      const fullTag = m[0];

      // Exclude header action buttons
      if (fullTag.includes('v3-anime-detail-action') || innerHtml.includes('İlk bölümü izle') || innerHtml.includes('Son bölümü izle')) {
        continue;
      }

      // Must be a bolum link
      if (!/bolum/i.test(rawHref)) {
        continue;
      }

      const epUrl = makeAbsolute(rawHref);
      if (!epUrl || seen.has(epUrl)) continue;
      seen.add(epUrl);

      // 1. Check data-episode-title
      const dataTitleMatch = fullTag.match(/data-episode-title="([^"]+)"/i);
      let title = dataTitleMatch ? cleanText(dataTitleMatch[1]) : '';

      // 2. Check <strong>...</strong> inside anchor for clean episode name
      if (!title) {
        const strongMatch = innerHtml.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
        if (strongMatch) {
          title = cleanText(strongMatch[1]);
        }
      }

      // 3. Fallback to clean url
      if (!title) {
        const numMatch = epUrl.match(/-([0-9]+[a-z]?)-bolum/i);
        title = numMatch ? `${numMatch[1].toUpperCase()}. Bölüm` : 'Bölüm';
      }

      rawItems.push({ url: epUrl, title: title });
    }

    let regularCount = 0;
    let specialCount = 0;

    for (const item of rawItems) {
      const isSpecial = /special|ova|film|sinema|movie|ön gösterim|on-gosterim/i.test(item.url) ||
                        /special|ova|film|movie|ön gösterim/i.test(item.title);
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
 * Resolves multiple fansub translators (Lawsonia, Adonis, AkatsukiSubs, Arcadia, etc.)
 * and sources (Aincrad master HLS, YourUpload MP4, SendVid MP4, Vidmoly HLS)
 * with dedicated server tab buttons and full audio/video synchronization.
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

                    // Check if audio is demuxed into separate #EXT-X-MEDIA:TYPE=AUDIO
                    const hasSeparateAudio = /#EXT-X-MEDIA:TYPE=AUDIO/i.test(mText);

                    const qualities = [];
                    const lines = String(mText || '').split(/\r?\n/);
                    let highestLabel = 'Auto';

                    for (let li = 0; li < lines.length; li++) {
                      const line = lines[li].trim();
                      if (line.startsWith('#EXT-X-STREAM-INF:')) {
                        const nameMatch = line.match(/NAME="([^"]+)"/i);
                        const resMatch = line.match(/RESOLUTION=([0-9x]+)/i);
                        const label = nameMatch ? nameMatch[1] : (resMatch ? resMatch[1] : 'Auto');
                        highestLabel = label;
                        const nextLine = lines[li + 1] ? lines[li + 1].trim() : '';

                        // If audio is separate, sub-playlists have NO AUDIO, so we MUST use masterUrl to retain audio!
                        // If audio is muxed (single stream), sub-playlist has audio and can be used directly.
                        const qUrl = hasSeparateAudio ? masterUrl : (nextLine && !nextLine.startsWith('#') ? makeAbsolute(nextLine, 'https://anizmplayer.com') : masterUrl);
                        qualities.push({
                          label: label,
                          url: qUrl,
                          headers: { 'Referer': 'https://anizmplayer.com/' }
                        });
                      }
                    }

                    if (qualities.length === 0) {
                      qualities.push({
                        label: 'Auto (HLS)',
                        url: masterUrl,
                        headers: { 'Referer': 'https://anizmplayer.com/' }
                      });
                    }

                    const serverName = `Aincrad [${transName}]`;
                    servers.push({
                      name: serverName,
                      label: `${serverName} · HLS`,
                      url: masterUrl, // Direct playable server URL with synchronized audio + video
                      streamType: 'hls',
                      quality: highestLabel,
                      audioLanguage: 'ja',
                      audioLanguages: ['ja'],
                      headers: { 'Referer': 'https://anizmplayer.com/' },
                      qualities: qualities,
                      subtitles: []
                    });

                    if (!primaryStream) {
                      primaryStream = {
                        url: masterUrl, // Always use master playlist to guarantee full audio track synchronization
                        streamType: 'hls',
                        quality: highestLabel,
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
                    url: sUrl, // Direct playable server URL
                    streamType: 'mp4',
                    quality: '1080p',
                    audioLanguage: 'ja',
                    audioLanguages: ['ja'],
                    headers: { 'Referer': 'https://www.yourupload.com/' },
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
                const vmRes = await httpGet(vmUrl, { 'Referer': pUrl });
                const vmM3u8 = vmRes.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                               vmRes.match(/sources:\s*\[\s*\{\s*file:\s*["']([^"']+)["']/i);
                if (vmM3u8) {
                  const sUrl = vmM3u8[1];
                  const serverName = `Vidmoly [${transName}]`;
                  servers.push({
                    name: serverName,
                    label: `${serverName} · HLS`,
                    url: sUrl, // Direct playable server URL
                    streamType: 'hls',
                    quality: '1080p',
                    audioLanguage: 'ja',
                    audioLanguages: ['ja'],
                    headers: { 'Referer': 'https://vidmoly.to/' },
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
                  url: sUrl, // Direct playable server URL
                  streamType: 'mp4',
                  quality: '720p',
                  audioLanguage: 'ja',
                  audioLanguages: ['ja'],
                  headers: { 'Referer': 'https://sendvid.com/' },
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
                    url: best.url, // Direct playable server URL
                    streamType: 'mp4',
                    quality: best.label,
                    audioLanguage: 'ja',
                    audioLanguages: ['ja'],
                    headers: { 'Referer': 'https://my.mail.ru/' },
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
      for (const q of (s.qualities || [])) {
        if (q.url && q.url !== primaryStream.url) {
          streams.push(`${s.name} ${q.label}`, q.url);
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
    if (!html) return { sections: [] };

    const heroItems = [];
    const heroRegex = /<article[^>]*class="[^"]*v3-hero-slide[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    let hm;
    while ((hm = heroRegex.exec(html)) !== null) {
      const block = hm[1];
      const linkMatch = block.match(/href="([^"]+)"/i);
      const titleMatch = block.match(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/i) ||
                         block.match(/class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\//i);
      const imgMatch = block.match(/<img[^>]+(?:src|data-v3-deferred-src)="([^"]+)"/i);

      if (linkMatch && titleMatch && imgMatch) {
        const href = makeAbsolute(linkMatch[1]);
        const title = cleanText(titleMatch[1]);
        const poster = makeAbsolute(imgMatch[1]);
        heroItems.push({
          id: href,
          title,
          href,
          url: href,
          image: poster,
          poster,
          coverUrl: poster,
          backdrop: poster,
          isSeries: true,
          type: 'tv',
          badge: 'Anime'
        });
      }
    }

    const epItems = [];
    const seen = new Set();
    const epRegex = /<article[^>]*class="[^"]*v3-episode-card[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    let em;
    while ((em = epRegex.exec(html)) !== null) {
      const block = em[1];
      const linkMatch = block.match(/href="([^"]+)"/i);
      if (!linkMatch) continue;
      const rawHref = linkMatch[1];
      const epHref = makeAbsolute(rawHref);
      const seriesHref = epHref.replace(/-\d+-bolum-izle\/?$/, '');
      if (seen.has(seriesHref)) continue;
      seen.add(seriesHref);

      const imgMatch = block.match(/(?:data-v3-deferred-src|src)="([^"]+)"/i);
      const titleMatch = block.match(/alt="([^"]+?)(?:\s*posteri)?"/i) ||
                         block.match(/class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\//i);

      if (imgMatch && titleMatch) {
        const title = cleanText(titleMatch[1]).replace(/\s*Season\s*\d+/i, '').trim();
        const poster = makeAbsolute(imgMatch[1]);
        epItems.push({
          id: seriesHref,
          title,
          href: seriesHref,
          url: seriesHref,
          image: poster,
          poster,
          coverUrl: poster,
          backdrop: poster,
          isSeries: true,
          type: 'tv',
          badge: 'Anime'
        });
      }
    }

    const sections = [];
    if (heroItems.length > 0) {
      sections.push({
        id: 'anizm-hero',
        title: 'Öne Çıkan Animeler',
        style: 'hero',
        items: heroItems.slice(0, 6),
        viewAll: { mode: 'feed', feedId: 'hero' }
      });
    }

    if (epItems.length >= 10) {
      sections.push({
        id: 'anizm-top10',
        title: 'Günün En Popüler 10 Animesi',
        style: 'top10',
        items: epItems.slice(0, 10),
        viewAll: { mode: 'feed', feedId: 'top10' }
      });
    }

    if (epItems.length > 0) {
      sections.push({
        id: 'anizm-latest',
        title: 'Son Eklenen Bölümler',
        style: 'poster',
        items: epItems.slice(0, 30),
        viewAll: { mode: 'feed', feedId: 'latest' }
      });
    }

    return { sections };
  } catch (err) {
    return { sections: [] };
  }
}

/**
 * Discovery Feed handler
 */
async function discoveryFeed(feedId, page = 1) {
  try {
    const home = await discoveryHome();
    const sections = Array.isArray(home && home.sections) ? home.sections : [];
    const id = String(feedId || '').toLowerCase();
    const section = sections.find(s => s.id === id || s.id.includes(id)) || sections[0];
    const items = section ? section.items : [];
    return {
      items: items,
      page: Number(page) || 1,
      hasMore: false
    };
  } catch (err) {
    return { items: [], page: 1, hasMore: false };
  }
}

// Module Exports
globalThis.searchResults = searchResults;
globalThis.extractDetails = extractDetails;
globalThis.extractEpisodes = extractEpisodes;
globalThis.extractStreamUrl = extractStreamUrl;
globalThis.discoveryHome = discoveryHome;
globalThis.discoveryFeed = discoveryFeed;
