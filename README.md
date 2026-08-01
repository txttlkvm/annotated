# Book Voice Reader

A high-quality Android ebook reader with Google Cloud TTS (Text-to-Speech) integration. Read your MOBI ebook files with natural-sounding voices, customize reading settings, and share audio segments from your books.

## Features

- 📚 **MOBI File Support** - Upload and read MOBI ebook files directly on your phone
- 🎤 **High-Quality TTS** - Google Cloud Text-to-Speech with premium neural voices
- 🎨 **Customizable Reading** - Adjust font size, line height, voice pitch, and speaking rate
- 📤 **Share Audio** - Share voice-read passages with friends and family
- 🔒 **Private & Local** - All processing happens on your device; books stored locally
- 🌙 **Dark Theme** - Easy on the eyes with a dark, professional interface

## Setup

### 1. Installation

```bash
npm install
```

### 2. Get Google Cloud API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable "Cloud Text-to-Speech API"
4. Create an API key credential
5. Copy your API key

### 3. Run the App

```bash
npm start
```

For Android specifically:
```bash
npm run android
```

### 4. Configure TTS

1. Open the app
2. Go to **Settings**
3. Paste your Google Cloud API key
4. Save it

## Usage

### Adding Books

1. Tap **"+ Add Book"** in the Library tab
2. Select a MOBI file from your phone
3. The book will be added to your library

### Reading with TTS

1. Tap a book to open it
2. Tap **"▶ Read Aloud"** to hear the current page read
3. Adjust voice settings:
   - **Pitch** - Make the voice higher or lower
   - **Speaking Rate** - Speed up or slow down reading
   - **Font Size** - Adjust text size for comfort

### Sharing Audio

1. While reading with TTS enabled
2. Tap **"📤 Share"** to share the audio passage
3. Choose how to share (Bluetooth, messaging apps, etc.)

## Architecture

- **Frontend**: React Native with Expo
- **TTS Engine**: Google Cloud Text-to-Speech API
- **Storage**: Local device storage (no cloud sync)
- **Audio Playback**: Expo AV (Audio Video)

## File Structure

```
src/
├── screens/
│   ├── LibraryScreen.tsx      # Book library and upload
│   ├── ReaderScreen.tsx        # Main reading interface
│   └── SettingsScreen.tsx      # Settings and API configuration
├── services/
│   ├── FileService.ts          # MOBI file handling
│   ├── TTSService.ts           # Google Cloud TTS integration
│   └── AudioService.ts         # Audio playback control
└── context/
    └── BookContext.tsx         # Global app state
```

## Customization

### Voice Options

The app uses Google Cloud Neural2 voices. You can customize:
- **Voice** - Neural2-C (default) or other available voices
- **Pitch** - 0.8 to 1.2x
- **Speaking Rate** - 0.8x to 1.3x speed

### Display Settings

- **Font Size** - 14px to 24px
- **Line Height** - 1.3 to 2.1x
- **Background Color** - Dark theme (customizable)
- **Text Color** - Light gray (customizable)

## API Keys & Security

Your Google Cloud API key is stored securely using the device's native secure storage. It is **never** transmitted or stored anywhere except on your device.

## Troubleshooting

### "No audio content in response"
- Check that your Google Cloud API key is correct
- Verify the Cloud Text-to-Speech API is enabled in Google Cloud Console
- Ensure you have available API quota

### Audio won't play
- Check device permissions (Settings > Apps > Book Voice Reader > Permissions)
- Ensure your device volume is not muted

### MOBI file won't upload
- Verify the file is a valid MOBI ebook
- Check that you have enough storage space

## Pricing

The app itself is free. Google Cloud TTS pricing applies based on your usage:
- Free tier: 1 million monthly characters
- Paid tier: $4 per 1 million characters (after free tier)

## License

MIT
