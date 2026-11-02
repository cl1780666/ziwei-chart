const music = require('../../utils/music')

Component({
  properties: { top: { type: String, value: '18rpx' } },
  data: { available: true, playing: false, loading: false, action: '播放', description: '播放背景音乐' },
  lifetimes: {
    attached() {
      this._musicAttached = true
      this._unsubscribeMusic = music.subscribe((state) => {
        if (!this._musicAttached) return
        const pausing = state.wanted && (state.playing || state.loading)
        this.setData({
          available: state.available, playing: state.playing, loading: state.loading,
          action: pausing ? '暂停' : '播放',
          description: pausing ? '暂停背景音乐' : state.error ? '播放背景音乐，点击重试' : '播放背景音乐',
        })
      })
    },
    detached() {
      this._musicAttached = false
      if (this._unsubscribeMusic) this._unsubscribeMusic()
    },
  },
  methods: { toggle() { music.toggle() } },
})
