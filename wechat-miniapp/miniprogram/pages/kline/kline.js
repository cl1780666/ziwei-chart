const api = require('../../utils/api')
const { candleLayout, drawRadar } = require('../../utils/plot')

Page({
  data: {
    loading: true, analyzing: false, analyzingYear: false, error: '', reportError: '',
    points: [], candles: [], grid: [], chartWidth: 3400, selectedIndex: 0, selected: null,
    yearLabels: [], yearReport: '', remaining: 20, sourceLabel: '基础推演', scrollTarget: '',
  },

  onShow() { this.visible = true; this.loadState() },
  onHide() { this.visible = false },
  onReady() { this.drawRadar() },

  onUnload() {
    this._unloaded = true
    this.visible = false
    this.loadRequest = (this.loadRequest || 0) + 1
    this.selectionRequest = (this.selectionRequest || 0) + 1
  },

  isCurrent(request) {
    return !this._unloaded && (request === undefined || request === this.loadRequest)
  },

  async loadState() {
    if (this._unloaded) return
    const request = this.loadRequest = (this.loadRequest || 0) + 1
    this.setData({ loading: true, error: '' })
    try {
      const state = await api.getState()
      if (!this.isCurrent(request)) return
      if (!state.profile) return wx.redirectTo({ url: '/pages/profile/profile' })
      const cached = await api.getFeatureCache('kline')
      if (!this.isCurrent(request)) return
      const result = cached && cached.points ? cached : await api.getLifetime()
      if (!this.isCurrent(request)) return
      this.setData({ remaining: cached && cached.points ? state.quota.remaining : result.quota.remaining, sourceLabel: cached && cached.points ? 'AI 推演' : '基础推演' })
      await this.applyPoints(result.points, request)
    } catch (error) {
      if (this.isCurrent(request)) this.setData({ error: error.message })
    } finally {
      if (this.isCurrent(request)) this.setData({ loading: false }, () => this.drawRadar())
    }
  },

  async applyPoints(points, request) {
    if (!this.isCurrent(request)) return
    if (!Array.isArray(points) || points.length === 0) throw new Error('曲线数据暂未生成，请重试')
    const previousYear = this.data.selected && this.data.selected.year || new Date().getFullYear()
    const matchingIndex = points.findIndex((point) => point.year >= previousYear)
    const selectedIndex = matchingIndex < 0 ? points.length - 1 : matchingIndex
    const layout = candleLayout(points)
    this.setData({ points, candles: layout.candles, grid: layout.grid, chartWidth: layout.width, yearLabels: points.map((point) => `${point.year}年 · 第${point.age}年${point.nominalAge ? ` · 虚岁${point.nominalAge}岁` : ''}`) })
    await this.selectIndex(selectedIndex)
  },

  selectPoint(event) {
    if (!this.data.analyzingYear) this.selectIndex(Number(event.currentTarget.dataset.index))
  },

  changeYear(event) {
    if (!this.data.analyzingYear) this.selectIndex(Number(event.detail.value))
  },

  async selectIndex(index) {
    if (this._unloaded) return
    const point = this.data.points[index]
    if (!point) return
    const request = (this.selectionRequest || 0) + 1
    this.selectionRequest = request
    this.setData({ selectedIndex: index, selected: { ...point, ageLabel: point.nominalAge ? `虚岁${point.nominalAge}岁` : `第${point.age}年` }, yearReport: '', reportError: '', scrollTarget: `candle-${index}` }, () => this.drawRadar())
    try {
      const cached = await api.getFeatureCache('klineYear', { year: point.year, age: point.age })
      if (!this._unloaded && request === this.selectionRequest) this.setData({ yearReport: cached && cached.text || '' })
    } catch (error) {
      if (!this._unloaded && request === this.selectionRequest) this.setData({ reportError: error.message })
    }
  },

  drawRadar() {
    if (this._unloaded || !this.visible || !this.data.selected) return
    wx.nextTick(() => {
      if (this._unloaded || !this.visible) return
      wx.createSelectorQuery().in(this).select('#score-radar').boundingClientRect((rectangle) => {
        if (this._unloaded || !this.visible || !rectangle || !rectangle.width || !this.data.selected) return
        drawRadar(wx.createCanvasContext('score-radar', this), this.data.selected.dimensions, rectangle.width, rectangle.height)
      }).exec()
    })
  },

  async analyzeLifetime() {
    if (this._unloaded || this.data.analyzing || this.data.analyzingYear) return
    const request = this.loadRequest
    this.setData({ analyzing: true, error: '' })
    try {
      const result = await api.analyze('kline')
      if (!this.isCurrent(request)) return
      this.setData({ remaining: result.quota.remaining, sourceLabel: 'AI 推演' })
      await this.applyPoints(result.points, request)
    } catch (error) {
      if (this.isCurrent(request)) this.setData({ error: error.message, ...(error.quota ? { remaining: error.quota.remaining } : {}) })
    } finally {
      if (!this._unloaded) this.setData({ analyzing: false })
    }
  },

  async analyzeYear() {
    if (this._unloaded || this.data.analyzing || this.data.analyzingYear || !this.data.selected) return
    const { year, age } = this.data.selected
    const request = this.selectionRequest
    this.setData({ analyzingYear: true, reportError: '' })
    try {
      const result = await api.analyze('klineYear', { year, age })
      if (this._unloaded || request !== this.selectionRequest) return
      this.setData({ yearReport: result.text || '', remaining: result.quota.remaining })
    } catch (error) {
      if (!this._unloaded && request === this.selectionRequest) this.setData({ reportError: error.message, ...(error.quota ? { remaining: error.quota.remaining } : {}) })
    } finally {
      if (!this._unloaded) this.setData({ analyzingYear: false })
    }
  },

  openYearly() {
    const year = this.data.selected && this.data.selected.year
    wx.navigateTo({ url: `/pages/fortune/fortune${year ? `?year=${year}` : ''}` })
  },
})
