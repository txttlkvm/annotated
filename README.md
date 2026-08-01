# Book Voice Reader Pro v2.0

**Premium ebook reader with high-quality TTS, annotations, reading analytics, and advanced features.**

A comprehensive, high-fidelity ebook reading application inspired by Read Era, Prestigio, and Pocketbook. Read your MOBI, EPUB, PDF, and TXT files with natural-sounding Google Cloud TTS voices, save highlights and bookmarks, track reading statistics, and fully customize your reading experience.

---

## ✨ Features

### 📚 Library Management
- **Multiple Formats** - EPUB, MOBI, PDF, TXT support
- **Advanced Search** - Filter and search by title, author
- **Grid/List Views** - Switch between viewing modes
- **Reading Progress** - Track pages read for each book
- **Favorites & Status** - Mark books as favorites or finished
- **File Organization** - All books stored locally on device

### 📖 Premium Reading Experience
- **Multiple Reading Themes** - Light, Dark, Sepia, Night modes
- **Font Customization** - 6 font sizes (14-24px) + Georgia typography
- **Line Height Control** - 1.3x to 2.1x adjustable spacing
- **Text Alignment** - Left, center, or justified text
- **Margin Sizes** - Small, medium, large content margins
- **Auto-Brightness** - Adaptive or manual brightness control

### 🎤 High-Quality Text-to-Speech
- **Google Cloud TTS** - Premium neural voices (sounds like real humans)
- **Voice Customization** - Pitch (0.8-1.2x) and speed (0.8-1.3x) control
- **Multiple Voices** - Choose from 4+ natural-sounding voices
- **Playback Controls** - Play, pause, seek, speed adjustment
- **Audio Segments** - Synthesize and share voice passages

### ✓ Annotations & Bookmarks
- **Highlights** - Color-coded text highlights (6 colors)
- **Bookmarks** - Mark important pages with optional notes
- **Highlights Collection** - Search and filter highlights
- **Quick Navigation** - Jump to bookmarked sections

### 📊 Reading Analytics
- **Reading Statistics** - Track pages, time, completion rate
- **Reading Sessions** - Automatic session tracking
- **Completion Goals** - Set and monitor reading targets
- **Progress Tracking** - Visual progress bars for each book
- **Recent Books** - Quick access to recently read books

### 🎨 Customization
- **4 Color Themes** - Light, Dark, Sepia, Night
- **User Preferences** - Save all settings persistently
- **Text Styling** - Multiple fonts, sizes, spacing options
- **Display Options** - Scroll or paginated reading modes
- **Status Bar** - Toggle status bar visibility

---

## 🚀 Getting Started

### Installation

```bash
npm install
```

### Configuration

1. **Get Google Cloud API Key** (free tier available)
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a new project
   - Enable "Cloud Text-to-Speech API"
   - Create an API Key credential
   - Copy your API key

2. **Add Books**
   - Open the app → Library tab
   - Tap "+ Add" to upload MOBI/EPUB/PDF/TXT files
   - Books are stored locally on your device

3. **Configure TTS**
   - Go to Settings → Text-to-Speech
   - Paste your Google Cloud API key
   - Tap "Save API Key"
   - Adjust voice pitch and speaking rate

### Running the App

```bash
npm start
```

For Android specifically:
```bash
npm run android
```

---

## 📱 Platform Support

- **Android 8.0+** (primary)
- **iOS** (compatible code, requires build configuration)
- **Web** (experimental, via Expo web)

---

## 🏗️ Architecture

```
src/
├── screens/           # UI screens
│   ├── LibraryScreen         # Book browser with search/filters
│   ├── ReaderScreen          # Main reading interface with TTS
│   ├── SettingsScreen        # Customization and API setup
│   ├── StatsScreen           # Reading analytics
│   ├── BookDetailsScreen     # Individual book info
│   └── HighlightsScreen      # Highlight collection
├── services/          # Business logic
│   ├── DatabaseService       # SQLite local database
│   ├── EbookService          # File parsing & handling
│   ├── TTSService            # Google Cloud TTS API
│   └── AudioService          # Audio playback
├── context/           # State management
│   └── AppContext            # Global app state
└── types/
    └── index.ts              # TypeScript definitions
```

**Storage**
- Local SQLite database for books, highlights, bookmarks, reading sessions
- Local file system for ebook files
- Secure storage for API keys (device keychain)

**Networking**
- Google Cloud Text-to-Speech API (requires internet)
- All book content remains on device
- No cloud sync or account required

---

## 🎯 Use Cases

- **Commute Reading** - Continue reading on the go with progress sync
- **Accessibility** - TTS for users with visual impairments
- **Language Learning** - Hear pronunciation while reading
- **Distraction-Free** - Minimize notifications, focus on reading
- **Personal Library** - Organize and manage your ebook collection
- **Study Tool** - Highlight key passages and take notes

---

## 📊 Reading Statistics Tracked

- **Total Pages Read** - Sum across all books
- **Total Reading Time** - Minutes/hours spent reading
- **Books in Library** - Total and completed count
- **Completion Rate** - Percentage of books finished
- **Average Reading Time** - Per book
- **Reading Sessions** - Number of reading sessions
- **Current Progress** - Page position in each book

---

## 🎤 TTS Pricing

**Google Cloud Text-to-Speech:**
- **Free Tier** - 1 million characters/month (usually sufficient)
- **Paid Tier** - $4 per million additional characters

**Costs Depend On:**
- Number of characters synthesized
- Use of neural voices (slightly higher cost)
- Language used

Most casual readers stay within the free tier.

---

## 🔒 Privacy & Security

- **All Content Local** - Books never leave your device
- **No Account Required** - No login, no tracking
- **Secure API Key Storage** - Encrypted on device keychain
- **No Data Collection** - Privacy-first design
- **Open Approach** - Review source code anytime

---

## ⚙️ Advanced Settings

### Voice Configuration
- **Language** - en-US (other languages coming)
- **Voice Selection** - Natural/Neural2 series voices
- **Pitch Range** - 0.8x to 1.2x (lower = deeper, higher = higher-pitched)
- **Speed Range** - 0.8x to 1.3x (0.8x slower, 1.3x faster)

### Display Settings
- **Font Family** - Georgia (high-readability serif)
- **Font Sizes** - 14px, 16px, 18px, 20px, 22px, 24px
- **Line Height** - 1.3x to 2.1x (tight to generous spacing)
- **Text Alignment** - Left, center, justify
- **Brightness** - Auto-adjust or manual control

### Reading Modes
- **Scroll Mode** - Continuous scrolling (default)
- **Paginated Mode** - Page-by-page reading
- **Page Turns** - Previous/Next page navigation
- **Progress Bar** - Visual progress indicator

---

## 🐛 Troubleshooting

**"API key invalid"**
- Verify key is from Google Cloud Console
- Check "Cloud Text-to-Speech API" is enabled
- Ensure you have characters remaining in free tier

**"Book won't upload"**
- File must be valid MOBI, EPUB, PDF, or TXT
- Check device has sufficient storage (free space)
- Try another file format

**"Audio won't play"**
- Check app permissions (Settings > Apps > Permissions)
- Ensure device volume is not muted
- Verify internet connection for TTS synthesis

**"App crashes on startup"**
- Clear app data (Settings > Apps > BookVoice > Storage > Clear)
- Reinstall the app
- Check device has Android 8.0+

---

## 📚 Import/Export

Currently supports:
- ✅ Import: MOBI, EPUB, PDF, TXT files
- ✅ Export: Share highlights and bookmarks
- 🔜 Export: Personal library backup

---

## 🎓 Keyboard Shortcuts (Future)

- **Space** - Play/pause TTS
- **→/←** - Next/previous page
- **Ctrl+B** - Toggle bookmark
- **Ctrl+H** - Show highlights

---

## 📝 License

MIT License - Free for personal use

---

## 🙋 Support

For issues or feature requests, check the troubleshooting section above or review the code in `src/`.

---

## 📖 About

Built with React Native and Expo for a lightweight, responsive reading experience across Android devices. Designed for readers who value:
- Beautiful typography
- Customizable experience
- Privacy and local-first storage
- High-quality audio (TTS)
- Annotation and note-taking

Enjoy your reading! 📚
