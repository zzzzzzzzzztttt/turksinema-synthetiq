# TurkSinema Synthetiq Repository

Custom Turkish streaming source modules for [Synthetiq Player](https://apps.apple.com/app/synthetiq-player/id6757483803) (iOS).

In compliance with Synthetiq Player's architecture (strict 1 site per module ZIP), providers are separated into dedicated, isolated modules:

| Module | Target Provider | Category | Features | Direct ZIP Link |
|---|---|---|---|---|
| **DiziMom Source** (`dizimom-source-v1`) | `ddizimom.net` | Movies & TV Series | Native iOS AVPlayer multi-audio HLS track switching (`Türkçe Dublaj` + `English Original`) | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/dizimom-source-v1.zip) |
| **HDFilmizle Source** (`hdfilmizle-source-v1`) | `hdfilmizle.live` | Movies & TV Series | Dedicated Original English Audio (`Altyazılı`) & Turkish Dubbed (`Dublaj`) streams via Vidrame multi-track HLS | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/hdfilmizle-source-v1.zip) |
| **Animland Source** (`animland-source-v1`) | `animland.net` | Anime | Direct 1080p MP4 streams, full 37-episode anime catalog (e.g. *Death Note*), multilingual WebVTT subtitles | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/animland-source-v1.zip) |
| **Erenime Source** (`erenime-source-v1`) | `erenime.com` | Anime | Direct 1080p HLS manifests from high-speed CDN, Turkish subbed anime (*Frieren*, etc.), no P2P / Turnstile | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/erenime-source-v1.zip) |
| **Animeniz Source** (`animeniz-source-v1`) | `animeniz.com` | Anime | Direct 1080p MP4 stream endpoints, Turkish subbed anime catalog, no P2P / Turnstile | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/animeniz-source-v1.zip) |
| **DramaVakti Source** (`dramavakti-source-v1`) | `dramavakti.com` | Asian & Korean Drama | Korean, Chinese & Asian Dramas with direct HTML5 MP4 CDN playback supporting HTTP Range requests | [Download ZIP](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/dramavakti-source-v1.zip) |

---

## 📲 How to Install in Synthetiq Player

### Option 1: Direct Module Import (Recommended)
1. On your iPhone, download any or all of the module ZIP files:
   - [dizimom-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/dizimom-source-v1.zip)
   - [hdfilmizle-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/hdfilmizle-source-v1.zip)
   - [animland-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/animland-source-v1.zip)
   - [erenime-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/erenime-source-v1.zip)
   - [animeniz-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/animeniz-source-v1.zip)
   - [dramavakti-source-v1.zip](https://raw.githubusercontent.com/zzzzzzzzzztttt/turksinema-synthetiq/main/modules/dramavakti-source-v1.zip)
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
4. All 6 modules will appear in your repository list for 1-tap installation.
