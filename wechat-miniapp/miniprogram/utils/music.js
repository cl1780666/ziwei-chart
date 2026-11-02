const AUDIO_BASE = 'https://supposed-bovid-d4gcywfkh2af1db6e-1522903512.ap-shanghai.app.tcloudbase.com/audio/'
const TRACKS = Object.freeze([
  'soothing-cafe-bossa.mp3',
  'priscilla-bossa-nova.mp3',
  'quiet-bossa-nova.mp3',
  'bossa-nova-cafe.mp3',
].map((file) => AUDIO_BASE + file))

function createMusicController(platform) {
  let audio = null
  let launched = false
  let disposed = false
  let ended = false
  const listeners = new Set()
  const state = {
    available: Boolean(platform && typeof platform.createInnerAudioContext === 'function'),
    trackIndex: 0, playing: false, loading: false,
    wanted: false, foreground: true, error: false,
  }

  function snapshot() {
    return { ...state }
  }

  function publish(patch) {
    Object.assign(state, patch)
    for (const listener of listeners) {
      try { listener(snapshot()) } catch { /* A detached view must not stop audio. */ }
    }
  }

  function unavailable() {
    // Native error objects can contain URLs or platform details; keep no logs.
    publish({ playing: false, loading: false, wanted: false, error: true })
  }

  function ensureAudio() {
    if (audio) return true
    if (!state.available || disposed) return false
    try {
      audio = platform.createInnerAudioContext({ useWebAudioImplement: false })
      audio.autoplay = false
      audio.loop = false
      audio.volume = 0.24
      audio.startTime = 0
      audio.onPlay(() => {
        if (disposed) return
        // An asynchronous play event can arrive after a pause or app hide.
        if (!state.wanted || !state.foreground) {
          try { audio.pause() } catch { /* Remain paused in UI. */ }
          publish({ playing: false, loading: false })
          return
        }
        publish({ playing: true, loading: false, error: false })
      })
      audio.onPause(() => {
        if (!disposed) publish({ playing: false, loading: false })
      })
      audio.onStop(() => {
        if (!disposed) publish({ playing: false, loading: false })
      })
      audio.onEnded(() => {
        if (disposed) return
        ended = true
        publish({ playing: false, loading: false })
        if (state.wanted && state.foreground) selectTrack((state.trackIndex + 1) % TRACKS.length)
      })
      audio.onError(() => { if (!disposed) unavailable() })
      return true
    } catch {
      try { if (audio) audio.destroy() } catch { /* Retry creates a clean context. */ }
      audio = null
      unavailable()
      return false
    }
  }

  function play() {
    if (disposed || !state.wanted || !state.foreground || !ensureAudio()) return
    publish({ loading: true, error: false })
    try { audio.play() } catch { unavailable() }
  }

  function selectTrack(index) {
    if (!ensureAudio()) return
    try {
      audio.stop()
      ended = false
      publish({ trackIndex: index, playing: false, loading: true, error: false })
      audio.startTime = 0
      audio.src = TRACKS[index]
      play()
    } catch {
      unavailable()
    }
  }

  function start() {
    if (launched || disposed) return snapshot()
    launched = true
    publish({ wanted: true })
    selectTrack(0)
    return snapshot()
  }

  function toggle() {
    if (disposed) return
    if (!launched) return start()
    if (state.wanted && (state.playing || state.loading)) {
      publish({ wanted: false, playing: false, loading: false })
      try { if (audio) audio.pause() } catch { /* User's pause intent persists. */ }
      return
    }
    const retry = state.error
    publish({ wanted: true, error: false })
    if (retry || !audio || !audio.src) selectTrack(state.trackIndex)
    else if (ended) selectTrack((state.trackIndex + 1) % TRACKS.length)
    else play()
  }

  function onAppHide() {
    if (disposed) return
    publish({ foreground: false, playing: false, loading: false })
    try { if (audio) audio.pause() } catch { /* No playback retries in background. */ }
  }

  function onAppShow() {
    if (disposed) return
    const wasHidden = !state.foreground
    publish({ foreground: true })
    if (!wasHidden || !state.wanted || state.error) return
    if (ended) selectTrack((state.trackIndex + 1) % TRACKS.length)
    else play()
  }

  function subscribe(listener) {
    if (disposed) return () => {}
    listeners.add(listener)
    listener(snapshot())
    return () => listeners.delete(listener)
  }

  function destroy() {
    if (disposed) return
    disposed = true
    listeners.clear()
    Object.assign(state, { playing: false, loading: false, wanted: false })
    try { if (audio) audio.destroy() } catch { /* Native lifecycle cleanup only. */ }
    audio = null
  }

  return { start, toggle, onAppHide, onAppShow, subscribe, snapshot, destroy }
}

let shared
function controller() {
  if (!shared) shared = createMusicController(typeof wx === 'undefined' ? null : wx)
  return shared
}

module.exports = {
  TRACKS, createMusicController,
  start: () => controller().start(),
  toggle: () => controller().toggle(),
  onAppShow: () => controller().onAppShow(),
  onAppHide: () => controller().onAppHide(),
  subscribe: (listener) => controller().subscribe(listener),
}
