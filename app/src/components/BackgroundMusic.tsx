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
    src: 'https://cdn.pixabay.com/download/audio/2025/06/13/audio_4d2920bf9f.mp3?filename=tunetank-soothing-cafe-music-349586.mp3',
    title: 'Soothing Café Bossa',
    duration: '2:43',
  },
  {
    src: 'https://cdn.pixabay.com/download/audio/2024/10/11/audio_9114fa0972.mp3?filename=alanajordan-priscilla-bossa-nova-249846.mp3',
    title: 'Priscilla Bossa Nova',
    duration: '2:37',
  },
  {
    src: 'https://cdn.pixabay.com/download/audio/2022/01/17/audio_8ddeaf7dc7.mp3?filename=capitalnerd2617-bossa-nova-14396.mp3',
    title: 'Quiet Bossa Nova',
    duration: '3:38',
  },
  {
    src: 'https://cdn.pixabay.com/download/audio/2025/06/13/audio_e08413f251.mp3?filename=tunetank-bossa-nova-cafe-music-347362.mp3',
    title: 'Bossa Nova Café',
    duration: '2:18',
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

    audio.load()
    if (shouldPlayRef.current) play(true)
  }, [play, trackIndex])

  const nextTrack = useCallback(() => {
    shouldPlayRef.current = true
    setIsReady(false)
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
    </div>
  )
})
