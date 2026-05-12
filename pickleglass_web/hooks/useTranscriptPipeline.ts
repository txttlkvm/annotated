'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { getZoomAudioStream } from './useAudioCapture'
import { connectDeepgram } from './useDeepgram'

function float32ToInt16(f32: Float32Array): Int16Array {
  const int16 = new Int16Array(f32.length)
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16
}

export function useTranscriptPipeline({
  onInterim,
  onFinal,
}: {
  onInterim: (text: string, speaker: number) => void
  onFinal: (text: string, speaker: number) => void
}) {
  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  // Always-current refs so the WebSocket onmessage never holds a stale closure
  const onInterimRef = useRef(onInterim)
  const onFinalRef = useRef(onFinal)
  useEffect(() => { onInterimRef.current = onInterim }, [onInterim])
  useEffect(() => { onFinalRef.current = onFinal }, [onFinal])

  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async () => {
    try {
      setError(null)
      const stream = await getZoomAudioStream()
      if (!stream) {
        setError('Microphone not available. Check permissions.')
        return
      }
      streamRef.current = stream

      // Pass ref-wrappers so Deepgram always calls the latest callback version
      const ws = connectDeepgram(
        (t, s) => onInterimRef.current(t, s),
        (t, s) => onFinalRef.current(t, s),
      )
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        const audioCtx = new AudioContext({ sampleRate: 16000 })
        audioCtxRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)
        const processor = audioCtx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return
          const input = e.inputBuffer.getChannelData(0)
          const pcm16 = float32ToInt16(input)
          ws.send(pcm16.buffer)
        }

        source.connect(processor)
        processor.connect(audioCtx.destination)
      }

      ws.onclose = () => setIsConnected(false)
    } catch (err) {
      setError(String(err))
      console.error('[useTranscriptPipeline] start error', err)
    }
  }, []) // stable — refs handle callback freshness

  const stop = useCallback(() => {
    processorRef.current?.disconnect()
    audioCtxRef.current?.close()
    wsRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    processorRef.current = null
    audioCtxRef.current = null
    wsRef.current = null
    streamRef.current = null
    setIsConnected(false)
  }, [])

  return { start, stop, isConnected, error }
}
