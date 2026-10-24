# TurkSinema Synthetiq Repository

Custom Turkish streaming source modules for [Synthetiq Player](https://apps.apple.com/app/synthetiq-player/id6757483803) (iOS).

In compliance with Synthetiq Player's architecture (strict 1 site per module ZIP), providers are separated into dedicated, isolated modules:

| Module | Target Provider | Category | Features | Direct ZIP Link |
|---|---|---|---|---|
| **DiziMom Source** (`dizimom-source-v1`) | `ddizimom.net` | Movies & TV Series | Native iOS AVPlayer multi-audio HLS track switching (`Türkçe Dublaj` + `English Original`) | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/dizimom-source-v1.zip) |
| **Dizigom Source** (`dizigom-source-v1`) | `dizigom3.top` | Movies, TV & Asian Drama | Dual Audio & inlined WebVTT Turkish subtitles, instant autocomplete search, multi-season series parser | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/dizigom-source-v1.zip) |
| **Animland Source** (`animland-source-v1`) | `animland.net` | Anime | Direct 1080p MP4 streams (*Death Note*, *One Piece*, etc.) with pre-fetched inlined WebVTT subtitles | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/animland-source-v1.zip) |
| **Animeniz Source** (`animeniz-source-v1`) | `animeniz.com` | Anime | Live Next.js search API, complete flight-data episode parser (e.g. all 74 episodes for *Monster*), 1080p MP4 | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/animeniz-source-v1.zip) |
| **Anizm Source** (`anizm-source-v1`) | `anizm.com.tr` | Anime | Direct 1080p MP4 streams with hardcoded Turkish fansub subtitles burned into video frames (zero subtitle errors) | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/anizm-source-v1.zip) |

---

## 📲 How to Install in Synthetiq Player

### Option 1: Direct Module Import (Recommended)
1. On your iPhone, download any or all of the module ZIP files:
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
4. All 5 modules will appear in your repository list for 1-tap installation.
