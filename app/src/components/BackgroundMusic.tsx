import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

const TRACKS = [
  {
    src: 'https://cdn.pixabay.com/download/audio/2025/01/08/audio_e859480c66.mp3?filename=u_ecplpk4096-emotional-rampb-type-piano-281446.mp3',
    title: 'Emotional R&B Piano',
    duration: '4:16',
  },
  {
    src: 'https://cdn.pixabay.com/download/audio/2024/10/14/audio_0fc8c28daa.mp3?filename=kontraa-inner-desires-rampb-soul-music-250739.mp3',
    title: 'Inner Desires',
    duration: '2:47',
  },
  {
    src: 'https://cdn.pixabay.com/download/audio/2026/01/02/audio_48a6c38ddd.mp3?filename=openusemusic-low-glow-warm-rampb-chill-for-relaxed-focus-460279.mp3',
    title: 'Low Glow',
    duration: '4:40',
  },
  {
    src: 'https://cdn.pixabay.com/download/audio/2023/03/25/audio_75e4ef5b76.mp3?filename=wavemaster-rampb-soul-143905.mp3',
    title: 'R&B Soul',
    duration: '2:52',
  },
] as const

export interface BackgroundMusicHandle {
  startFromBeginning: () => void
}

export const BackgroundMusic = forwardRef<BackgroundMusicHandle>(function BackgroundMusic(
  _props,
  ref,
) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const shouldPlayRef = useRef(true)
  const [trackIndex, setTrackIndex] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const track = TRACKS[trackIndex]

  const play = useCallback((restart = false) => {
    const audio = audioRef.current
    if (!audio) return

    shouldPlayRef.current = true
    if (restart) audio.currentTime = 0
    void audio.play().catch(() => {
      // Mobile browsers may wait for the visitor's first click before playing.
      setIsPlaying(false)
    })
  }, [])

  const startFromBeginning = useCallback(() => {
    play(true)
  }, [play])

  useImperativeHandle(ref, () => ({ startFromBeginning }), [startFromBeginning])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    setIsReady(false)
    audio.load()
    if (shouldPlayRef.current) play(true)
  }, [play, trackIndex])

  const nextTrack = useCallback(() => {
    shouldPlayRef.current = true
    setTrackIndex((current) => (current + 1) % TRACKS.length)
  }, [])

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      play(false)
    } else {
      shouldPlayRef.current = false
      audio.pause()
    }
  }

  return (
    <div className={`lei-music-player ${isPlaying ? 'is-playing' : ''}`}>
      <audio
        ref={audioRef}
        src={track.src}
        preload="auto"
        onCanPlay={() => {
          setIsReady(true)
          if (shouldPlayRef.current && audioRef.current?.paused) play(false)
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={nextTrack}
      />

      <button
        type="button"
        className="lei-music-toggle"
        onClick={togglePlayback}
        disabled={!isReady}
        aria-label={isPlaying ? '暂停背景音乐' : '播放背景音乐'}
        aria-pressed={isPlaying}
      >
        <span className="lei-music-disc" aria-hidden="true">
          <span>♪</span>
        </span>
        <span className="lei-music-copy">
          <strong>{isPlaying ? '正在播放' : '播放背景音乐'}</strong>
          <small>{track.title} · {track.duration}</small>
        </span>
        <span className="lei-music-bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>

      <button
        type="button"
        className="lei-music-next"
        onClick={nextTrack}
        aria-label="播放下一首背景音乐"
        title="下一首"
      >
        ›
      </button>
    </div>
  )
})
