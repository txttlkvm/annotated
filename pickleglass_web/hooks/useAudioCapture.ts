// Audio capture for Annotated overlay
// Strategy: microphone first (captures speaker's voice reliably on all platforms).
// System audio via desktopCapturer is unreliable for audio-only on Windows Chromium.

declare global {
  interface Window {
    api: any
  }
}

export async function getZoomAudioStream(): Promise<MediaStream | null> {
  // Microphone — always works, captures the local speaker's voice
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    console.log('[useAudioCapture] Microphone stream started')
    return stream
  } catch (err) {
    console.error('[useAudioCapture] Microphone failed:', err)
    return null
  }
}
