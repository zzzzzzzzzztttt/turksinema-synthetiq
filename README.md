# TurkSinema Synthetiq Repository

Custom Turkish streaming source modules for [Synthetiq Player](https://apps.apple.com/app/synthetiq-player/id6757483803) (iOS).

In compliance with Synthetiq Player's architecture (strict 1 site per module ZIP), providers are separated into dedicated, isolated modules:

| Module | Target Provider | Category | Features | Direct ZIP Link |
|---|---|---|---|---|
| **HDFilmCehennemi Source** (`hdfilmcehennemi2-source-v1`) | `hdfilmcehennemi2.biz` | Movies & TV Series | **Dedicated "Altyazılı" (Original Audio + Turkish CC) & "Dublaj" (Turkish Audio)** streams via VIP & VidMoly. Multi-server fallback, inlined WebVTT subtitles, instant Meilisearch JSON search, and zero audio track conflicts on iOS AVPlayer. | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/hdfilmcehennemi2-source-v1.zip) |
| **AsyaDizi Source** (`asyadizi-source-v1`) | `asyadizi.com` | Asian Dramas (K-Drama & C-Drama) | **Dedicated Asian Drama catalogue** with verified OK.ru master HLS, Mail.ru direct 720p MP4, and multi-kaynak (Kaynak 1..4) automatic fallback. High-bitrate 1080p/720p streams with zero WebTorrent/P2P junk. | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/asyadizi-source-v1.zip) |
| **JetFilmizle Source** (`jetfilmizle-source-v1`) | `jetfilmizle.app` | Movies & TV Series | **Dedicated "Altyazılı" (Original Audio) & "Dublaj" (Turkish Audio)** streams via Gold (Direct MP4 up to 1080p), VIP & Apollo HLS. Clean JSON search API, multi-season series parser, and inlined WebVTT subtitles. | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/jetfilmizle-source-v1.zip) |
| **Dizci Source** (`dizci-source-v1`) | `dizci.net` | Movies & TV Series | **Dedicated "Altyazılı" (English Original Audio) & "Dublaj" (Turkish Dub)** streams via VidMoly & Dzen. Instant JSON search with English movie title alias mapping (*Pulp Fiction*, *The Matrix*, *Inception*, etc.). | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/dizci-source-v1.zip) |
| **Diziyou Source** (`diziyou-source-v1`) | `diziyou.one` | TV Series (Altyazılı) | **Clean English Original Audio with Hardcoded Turkish Subtitles** via direct adaptive HLS from `storage.diziyou.one`. | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/diziyou-source-v1.zip) |
| **DiziMom Source** (`dizimom-source-v1`) | `ddizimom.net` | Movies & TV Series | Turkish Movies & Series with Turkish Dub (`Türkçe Dublaj`) | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/dizimom-source-v1.zip) |
| **Dizigom Source** (`dizigom-source-v1`) | `dizigom3.top` | Movies, TV & Asian Drama | Turkish Dub & inlined WebVTT Turkish subtitles, instant autocomplete search, multi-season series parser | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/dizigom-source-v1.zip) |
| **Animland Source** (`animland-source-v1`) | `animland.net` | Anime | Direct 1080p MP4 streams (*Death Note*, *One Piece*, etc.) with pre-fetched inlined WebVTT subtitles | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/animland-source-v1.zip) |
| **Animeniz Source** (`animeniz-source-v1`) | `animeniz.com` | Anime | Live Next.js search API, complete flight-data episode parser (e.g. all 74 episodes for *Monster*), 1080p MP4 | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/animeniz-source-v1.zip) |
| **Anizm Source** (`anizm-source-v1`) | `anizm.com.tr` | Anime | Direct 1080p MP4 streams with hardcoded Turkish fansub subtitles burned into video frames (zero subtitle errors) | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/anizm-source-v1.zip) |

---

## 📱 How to Install in Synthetiq Player

### Option 1: Direct Module Import (Recommended)
1. On your iPhone, download any or all of the module ZIP files:
   - [hdfilmcehennemi2-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/hdfilmcehennemi2-source-v1.zip)
   - [asyadizi-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/asyadizi-source-v1.zip)
   - [jetfilmizle-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/jetfilmizle-source-v1.zip)
   - [dizci-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/dizci-source-v1.zip)
   - [diziyou-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/diziyou-source-v1.zip)
   - [dizimom-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/dizimom-source-v1.zip)
   - [dizigom-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/dizigom-source-v1.zip)
   - [animland-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/animland-source-v1.zip)
   - [animeniz-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/animeniz-source-v1.zip)
   - [anizm-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/anizm-source-v1.zip)
2. Save to **Files** on your device.
3. Open **Synthetiq Player**, go to **Settings > Modules > Import Module** (or tap `+`).
4. Select the `.zip` file to import.

---

### Option 2: Add External Catalogue / Repository
1. Open **Synthetiq Player**.
2. Go to **Settings > Media & Sources (or Modules) > Advanced / External Repository**.
3. Add the catalogue URL:
   ```text
   https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/catalogue.json
   ```
   or repository URL:
   ```text
   https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/repository.json
   ```
4. All 10 modules will appear in your repository list for 1-tap installation.
