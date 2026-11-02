const api = require('../../utils/api')
const card = require('../../utils/share-card')

Page({
  data: {
    loading: true, generating: false, saving: false,
    hasChart: false, quote: '', extracted: false, includePrivate: false,
    imagePath: '', error: '', cardWidth: card.WIDTH, cardHeight: card.HEIGHT,
  },

  async onLoad() {
    this._renderVersion = 0
    try {
      const state = await api.getState()
      if (this._unloaded) return
      this._profile = state.profile
      this._chart = state.chartSummary
      if (!state.profile || !state.chartSummary) return
      const cached = await api.getFeatureCache('natal')
      if (this._unloaded) return
      const quote = card.extractQuote(cached && cached.text)
      this.setData({ hasChart: true, quote: quote || card.DEFAULT_QUOTE, extracted: Boolean(quote) })
      if (this._ready) this.refreshImage()
    } catch (error) {
      if (!this._unloaded) this.setData({ error: error.message || '读取本机命盘失败，请重试' })
    } finally {
      if (!this._unloaded) this.setData({ loading: false })
    }
  },

  onReady() {
    if (this._unloaded) return
    this._ready = true
    if (this._chart) this.refreshImage()
  },

  onUnload() {
    this._unloaded = true
    this._renderVersion += 1
    clearTimeout(this._renderTimer)
    this._profile = null
    this._chart = null
  },

  onQuoteInput(event) {
    this.setData({ quote: event.detail.value, imagePath: '', error: '' })
    clearTimeout(this._renderTimer)
    this._renderVersion += 1
    this._renderTimer = setTimeout(() => this.refreshImage(), 450)
  },

  onPrivateChange(event) {
    this.setData({ includePrivate: event.detail.value, imagePath: '', error: '' })
    this.refreshImage()
  },

  getCanvas() {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery().in(this).select('#share-canvas').fields({ node: true, size: true }).exec((results) => {
        const item = results && results[0]
        if (!item || !item.node) return reject(new Error('画布暂未就绪，请点重新生成'))
        resolve(item.node)
      })
    })
  },

  loadArtwork(canvas) {
    return new Promise((resolve) => {
      const image = canvas.createImage()
      image.onload = () => resolve(image)
      image.onerror = () => resolve(null)
      image.src = card.ART_PATH
    })
  },

  async refreshImage() {
    if (!this._chart || !this._ready || this._unloaded) return
    clearTimeout(this._renderTimer)
    const version = ++this._renderVersion
    this.setData({ generating: true, error: '' })
    try {
      const canvas = await this.getCanvas()
      if (version !== this._renderVersion || this._unloaded) return
      const info = wx.getWindowInfo ? wx.getWindowInfo() : { pixelRatio: 2 }
      const scale = Math.max(1, Math.min(3, info.pixelRatio || 2))
      canvas.width = card.WIDTH * scale
      canvas.height = card.HEIGHT * scale
      const ctx = canvas.getContext('2d')
      ctx.scale(scale, scale)
      const image = await this.loadArtwork(canvas)
      if (version !== this._renderVersion || this._unloaded) return
      const data = card.cardData({
        profile: this._profile, chartSummary: this._chart,
        quote: this.data.quote, includePrivate: this.data.includePrivate,
      })
      card.drawCard(ctx, data, image)
      const result = await new Promise((resolve, reject) => wx.canvasToTempFilePath({
        canvas, fileType: 'png',
        width: canvas.width, height: canvas.height,
        destWidth: canvas.width, destHeight: canvas.height,
        success: resolve, fail: reject,
      }, this))
      if (version === this._renderVersion && !this._unloaded) this.setData({ imagePath: result.tempFilePath })
    } catch (error) {
      if (version === this._renderVersion && !this._unloaded) {
        this.setData({ error: '生成图片失败，请点重新生成后再试', imagePath: '' })
      }
    } finally {
      if (version === this._renderVersion && !this._unloaded) this.setData({ generating: false })
    }
  },

  previewImage() {
    if (this.data.imagePath) wx.previewImage({ urls: [this.data.imagePath], current: this.data.imagePath })
  },

  async saveImage() {
    if (this._unloaded || this.data.saving || this.data.generating) return
    if (!this.data.imagePath) {
      await this.refreshImage()
      if (this._unloaded || !this.data.imagePath) return
    }
    this.setData({ saving: true, error: '' })
    try {
      await new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({ filePath: this.data.imagePath, success: resolve, fail: reject }))
      if (!this._unloaded) wx.showToast({ title: '已存入相册', icon: 'success' })
    } catch (error) {
      if (this._unloaded) return
      const denied = /auth deny|authorize|auth denied|permission|scope/i.test(String(error.errMsg || ''))
      if (denied) {
        wx.showModal({
          title: '需要相册权限', content: '图片由你主动保存。允许访问相册后，可以再次点击保存。',
          confirmText: '去设置', cancelText: '暂不保存',
          success: (result) => { if (result.confirm && !this._unloaded) wx.openSetting({}) },
        })
      } else {
        this.setData({ error: '暂时无法保存图片，请检查相册权限或存储空间后重试' })
      }
    } finally {
      if (!this._unloaded) this.setData({ saving: false })
    }
  },

  openProfile() { wx.navigateTo({ url: '/pages/profile/profile' }) },

  onShareAppMessage() {
    // Only a generic entrance is sent; never place local content in a share URL.
    return { title: '一纸星语，来看看你的弦上星盘', path: '/pages/home/home', imageUrl: card.ART_PATH }
  },
})
