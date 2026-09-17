import { useEffect, useRef, useState } from 'react'

export type MicroAudioSource = 'cache' | 'generated' | null

export function useMicroAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentTextRef = useRef('')
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<MicroAudioSource>(null)
  const [error, setError] = useState('')

  const detach = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.onplay = null
    audio.onpause = null
    audio.onended = null
    audio.onerror = null
  }

  const stop = () => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      try { audio.currentTime = 0 } catch { /* noop */ }
    }
    setPlaying(false)
    setPaused(false)
  }

  useEffect(() => () => {
    stop()
    detach()
    audioRef.current = null
  }, [])

  const speak = async (rawText: string) => {
    const text = rawText.replace(/\s+/g, ' ').trim()
    if (!text) return
    setError('')

    if (audioRef.current && currentTextRef.current === text && audioRef.current.src) {
      try {
        await audioRef.current.play()
        return
      } catch {
        // Si la URL firmada expiró, pedimos una nueva abajo.
      }
    }

    stop()
    setLoading(true)
    setSource(null)
    try {
      const response = await fetch('/api/microaudio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.url) throw new Error(data?.error || `Microaudio unavailable (${response.status})`)

      detach()
      const audio = new Audio(data.url)
      audio.preload = 'auto'
      audio.onplay = () => { setPlaying(true); setPaused(false) }
      audio.onpause = () => {
        if (!audio.ended && audio.currentTime > 0) { setPlaying(true); setPaused(true) }
      }
      audio.onended = () => { setPlaying(false); setPaused(false) }
      audio.onerror = () => { setPlaying(false); setPaused(false); setError('No pude reproducir el microaudio.') }
      audioRef.current = audio
      currentTextRef.current = text
      setSource(data.cached ? 'cache' : 'generated')
      await audio.play()
    } catch (err) {
      setPlaying(false)
      setPaused(false)
      setError(err instanceof Error ? err.message : 'No pude preparar el microaudio.')
    } finally {
      setLoading(false)
    }
  }

  const pause = () => {
    const audio = audioRef.current
    if (!audio || audio.paused) return
    audio.pause()
    setPaused(true)
  }

  const resume = async () => {
    const audio = audioRef.current
    if (!audio) return
    try { await audio.play() } catch (err) { setError(err instanceof Error ? err.message : 'No pude reanudar el audio.') }
  }

  return { playing, paused, loading, source, error, speak, pause, resume, stop }
}
