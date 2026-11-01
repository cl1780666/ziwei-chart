import { useEffect, useRef, useState } from 'react'

const TRACK_URI = 'spotify:track:3XVBdLihbNbxUwZosxcGuJ'
const SPOTIFY_IFRAME_API = 'https://open.spotify.com/embed/iframe-api/v1'

interface SpotifyPlaybackEvent {
  data: {
    isPaused: boolean
  }
}

interface SpotifyEmbedController {
  addListener: (
    event: 'playback_update',
    listener: (event: SpotifyPlaybackEvent) => void,
  ) => void
  destroy: () => void
  togglePlay: () => void
}

interface SpotifyIframeApi {
  createController: (
    element: HTMLElement,
    options: { uri: string; width: number; height: number },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void
}

declare global {
  interface Window {
    __leiSpotifyIframeApi?: SpotifyIframeApi
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void
  }
}

let spotifyApiPromise: Promise<SpotifyIframeApi> | null = null

function loadSpotifyIframeApi() {
  if (window.__leiSpotifyIframeApi) {
    return Promise.resolve(window.__leiSpotifyIframeApi)
  }

  if (!spotifyApiPromise) {
    spotifyApiPromise = new Promise((resolve) => {
      window.onSpotifyIframeApiReady = (api) => {
        window.__leiSpotifyIframeApi = api
        resolve(api)
      }

      if (!document.querySelector(`script[src="${SPOTIFY_IFRAME_API}"]`)) {
        const script = document.createElement('script')
        script.src = SPOTIFY_IFRAME_API
        script.async = true
        document.body.appendChild(script)
      }
    })
  }

  return spotifyApiPromise
}

export function BackgroundMusic() {
  const playerHostRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<SpotifyEmbedController | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    let cancelled = false

    void loadSpotifyIframeApi().then((api) => {
      if (cancelled || !playerHostRef.current) return

      api.createController(
        playerHostRef.current,
        { uri: TRACK_URI, width: 300, height: 152 },
        (controller) => {
          if (cancelled) {
            controller.destroy()
            return
          }

          controllerRef.current = controller
          controller.addListener('playback_update', (event) => {
            setIsPlaying(!event.data.isPaused)
          })
          setIsReady(true)
        },
      )
    })

    return () => {
      cancelled = true
      controllerRef.current?.destroy()
      controllerRef.current = null
    }
  }, [])

  const togglePlayback = () => {
    controllerRef.current?.togglePlay()
  }

  return (
    <div className={`lei-music-player ${isPlaying ? 'is-playing' : ''}`}>
      <div className="lei-music-frame" aria-hidden="true">
        <div ref={playerHostRef} />
      </div>

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
          <small>If I Ain't Got You</small>
        </span>
        <span className="lei-music-bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>
    </div>
  )
}
