const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const vm = require('node:vm')
const { TRACKS, createMusicController } = require('../miniprogram/utils/music')

function harness() {
  const events = {}
  const sources = []
  const calls = { create: 0, play: 0, pause: 0, stop: 0, destroy: 0 }
  const audio = {
    currentTime: 0,
    play() { calls.play += 1 },
    pause() { calls.pause += 1; if (events.Pause) events.Pause() },
    stop() { calls.stop += 1; this.currentTime = 0; if (events.Stop) events.Stop() },
    destroy() { calls.destroy += 1 },
    onPlay(fn) { events.Play = fn },
    onPause(fn) { events.Pause = fn },
    onStop(fn) { events.Stop = fn },
    onEnded(fn) { events.Ended = fn },
    onError(fn) { events.Error = fn },
    set src(value) { sources.push(value); this._source = value },
    get src() { return this._source },
  }
  const platform = {
    createInnerAudioContext(options) {
      calls.create += 1
      assert.equal(options.useWebAudioImplement, false)
      return audio
    },
  }
  const controller = createMusicController(platform)
  return { audio, events, sources, calls, controller }
}

test('cold launch attempts the first owned track once without claiming native playback succeeded', () => {
  const { controller, calls, audio, sources, events } = harness()
  controller.start()
  controller.start()
  controller.onAppShow()
  assert.equal(calls.create, 1)
  assert.equal(calls.play, 1)
  assert.deepEqual(sources, [TRACKS[0]])
  assert.equal(audio.startTime, 0)
  assert.equal(audio.loop, false)
  assert.equal(controller.snapshot().playing, false)
  assert.equal(controller.snapshot().loading, true)
  events.Play()
  assert.equal(controller.snapshot().playing, true)
  assert.equal(controller.snapshot().loading, false)
  assert.ok(TRACKS.every((src) => src.startsWith('https://supposed-bovid-d4gcywfkh2af1db6e-1522903512.ap-shanghai.app.tcloudbase.com/audio/')))
})

test('ended events advance all four tracks and wrap to the first track from the beginning', () => {
  const { controller, calls, audio, sources, events } = harness()
  controller.start()
  for (let index = 0; index < 4; index += 1) {
    audio.currentTime = 160
    events.Play()
    events.Ended()
    assert.equal(audio.currentTime, 0)
    assert.equal(audio.startTime, 0)
  }
  assert.deepEqual(sources, [...TRACKS, TRACKS[0]])
  assert.equal(calls.play, 5)
  assert.equal(calls.create, 1)
  assert.equal(controller.snapshot().trackIndex, 0)
})

test('app hide pauses foreground music and app show resumes at the same position', () => {
  const { controller, calls, audio, sources, events } = harness()
  controller.start()
  events.Play()
  audio.currentTime = 37
  controller.onAppHide()
  assert.equal(controller.snapshot().playing, false)
  assert.equal(controller.snapshot().foreground, false)
  assert.equal(controller.snapshot().wanted, true)
  assert.equal(calls.pause, 1)
  controller.onAppShow()
  controller.onAppShow()
  assert.equal(calls.play, 2)
  assert.equal(audio.currentTime, 37)
  assert.equal(sources.length, 1)
})

test('an explicit pause survives navigation subscriptions and background/foreground transitions', () => {
  const { controller, calls, audio, events } = harness()
  controller.start()
  events.Play()
  audio.currentTime = 51
  controller.toggle()
  assert.equal(controller.snapshot().wanted, false)
  const unsubscribe = controller.subscribe(() => {})
  unsubscribe()
  controller.onAppHide()
  controller.onAppShow()
  assert.equal(calls.play, 1)
  controller.toggle()
  assert.equal(calls.play, 2)
  assert.equal(audio.currentTime, 51)
})

test('network errors stop automatic playback attempts until the user chooses retry', () => {
  const { controller, calls, events, sources } = harness()
  controller.start()
  events.Error({ errMsg: 'network or provider details' })
  assert.equal(controller.snapshot().error, true)
  assert.equal(controller.snapshot().wanted, false)
  controller.onAppHide()
  controller.onAppShow()
  assert.equal(calls.play, 1)
  assert.equal(sources.length, 1)
  controller.toggle()
  assert.equal(calls.play, 2)
  assert.deepEqual(sources, [TRACKS[0], TRACKS[0]])
  events.Play()
  assert.equal(controller.snapshot().error, false)
})

test('a late native play event cannot undo a user pause or app hide', () => {
  for (const stop of ['toggle', 'onAppHide']) {
    const { controller, calls, events } = harness()
    controller.start()
    controller[stop]()
    const previousPauses = calls.pause
    events.Play()
    assert.equal(controller.snapshot().playing, false)
    assert.equal(calls.pause, previousPauses + 1)
  }
})

test('unsubscribed views and destroyed controllers ignore late native events', () => {
  const { controller, calls, events } = harness()
  let updates = 0
  const unsubscribe = controller.subscribe(() => { updates += 1 })
  controller.start()
  unsubscribe()
  const count = updates
  events.Play()
  assert.equal(updates, count)
  controller.destroy()
  controller.destroy()
  events.Play()
  events.Ended()
  events.Error({})
  assert.equal(calls.destroy, 1)
  assert.equal(controller.snapshot().playing, false)
  assert.equal(updates, count)
})

test('missing native audio support does not throw or request other permissions', () => {
  const controller = createMusicController(null)
  assert.doesNotThrow(() => controller.start())
  assert.doesNotThrow(() => controller.toggle())
  assert.equal(controller.snapshot().available, false)
})

test('app lifecycle owns music while page navigation is free of audio lifecycle changes', () => {
  let app
  const events = []
  const music = {
    start() { events.push('start') },
    onAppShow() { events.push('show') },
    onAppHide() { events.push('hide') },
  }
  vm.runInNewContext(readFileSync(require.resolve('../miniprogram/app'), 'utf8'), {
    require(name) { return name.endsWith('/music') ? music : { ENV_ID: 'test-env', ensureLogin: () => Promise.resolve() } },
    App(value) { app = value },
  })
  app.onLaunch()
  app.onShow()
  app.onHide()
  app.onShow()
  assert.deepEqual(events, ['start', 'show', 'hide', 'show'])
})
