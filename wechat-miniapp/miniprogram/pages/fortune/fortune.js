const api = require('../../utils/api')
const MUTAGENS = ['化禄', '化权', '化科', '化忌']

Page({
  data: {
    loading: true, loadingYear: false, analyzing: false, error: '', reportError: '',
    years: [], yearLabels: [], yearIndex: 0, year: new Date().getFullYear(),
    yearly: null, ageLabel: '', mutagens: [], decadalMutagens: [], report: '', remaining: 20,
  },

  onLoad(options) {
    const year = Number(options && options.year)
    if (Number.isInteger(year) && year >= 1900 && year <= 2199) this.setData({ year })
  },

  onShow() { this.loadState() },

  onUnload() {
    this._unloaded = true
    this.loadRequest = (this.loadRequest || 0) + 1
    this.yearRequest = (this.yearRequest || 0) + 1
  },

  isCurrent(request) { return !this._unloaded && request === this.loadRequest },

  async loadState() {
    if (this._unloaded) return
    const request = this.loadRequest = (this.loadRequest || 0) + 1
    this.setData({ loading: true, error: '' })
    try {
      const state = await api.getState()
      if (!this.isCurrent(request)) return
      if (!state.profile) return wx.redirectTo({ url: '/pages/profile/profile' })
      const years = Array.from({ length: 100 }, (_, index) => state.profile.year + index)
      const year = Math.max(years[0], Math.min(years[99], this.data.year))
      this.setData({ years, yearLabels: years.map((value, index) => `${value}年 · 出生第${index + 1}年`), year, yearIndex: years.indexOf(year), remaining: state.quota.remaining })
      await this.loadYear()
    } catch (error) {
      if (this.isCurrent(request)) this.setData({ error: error.message })
    } finally {
      if (this.isCurrent(request)) this.setData({ loading: false })
    }
  },

  changeYear(event) {
    if (this.data.analyzing) return
    const yearIndex = Number(event.detail.value)
    this.setData({ yearIndex, year: this.data.years[yearIndex] })
    this.loadYear()
  },

  async loadYear() {
    if (this._unloaded) return
    const request = (this.yearRequest || 0) + 1
    this.yearRequest = request
    const year = this.data.year
    this.setData({ loadingYear: true, yearly: null, report: '', error: '', reportError: '' })
    try {
      const result = await api.getYearly(year)
      if (this._unloaded || request !== this.yearRequest) return
      const cached = await api.getFeatureCache('yearly', { year })
      if (this._unloaded || request !== this.yearRequest) return
      const yearly = result.yearly
      this.setData({
        yearly, ageLabel: yearly.nominalAge ? `虚岁${yearly.nominalAge}岁` : `出生第${yearly.age}年`, report: cached && cached.text || '', remaining: result.quota.remaining,
        mutagens: (yearly.mutagen || []).map((name, index) => ({ name, label: MUTAGENS[index], palace: yearly.mutagens && yearly.mutagens[index] ? yearly.mutagens[index].palace : '' })),
        decadalMutagens: (yearly.decadal && yearly.decadal.mutagen || []).map((name, index) => ({ name, label: MUTAGENS[index] })),
      })
    } catch (error) {
      if (!this._unloaded && request === this.yearRequest) this.setData({ error: error.message })
    } finally {
      if (!this._unloaded && request === this.yearRequest) this.setData({ loadingYear: false })
    }
  },

  async analyze() {
    if (this._unloaded || this.data.analyzing || !this.data.yearly) return
    const request = this.yearRequest
    const year = this.data.year
    this.setData({ analyzing: true, reportError: '' })
    try {
      const result = await api.analyze('yearly', { year })
      if (this._unloaded || request !== this.yearRequest) return
      this.setData({ report: result.text || '', remaining: result.quota.remaining })
    } catch (error) {
      if (!this._unloaded && request === this.yearRequest) this.setData({ reportError: error.message, ...(error.quota ? { remaining: error.quota.remaining } : {}) })
    } finally {
      if (!this._unloaded) this.setData({ analyzing: false })
    }
  },

  openChart() { wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/chart/chart' }) }) },
  openChat() { wx.navigateTo({ url: '/pages/chat/chat' }) },
})
