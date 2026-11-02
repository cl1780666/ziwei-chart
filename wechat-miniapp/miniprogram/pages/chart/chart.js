const api = require('../../utils/api')

const POSITIONS = { '巳': [0, 0], '午': [0, 1], '未': [0, 2], '申': [0, 3], '辰': [1, 0], '酉': [1, 3], '卯': [2, 0], '戌': [2, 3], '寅': [3, 0], '丑': [3, 1], '子': [3, 2], '亥': [3, 3] }

function arrangePalaces(palaces) {
  return (palaces || []).map((palace) => {
    const branch = palace.earthlyBranch || palace.stemBranch.slice(-1)
    const position = POSITIONS[branch] || [0, 0]
    return { ...palace, position: `top:${position[0] * 25}%;left:${position[1] * 25}%;` }
  })
}

Page({
  data: {
    loading: true,
    profile: null,
    chart: null,
    palaces: [],
    selected: null,
    report: '',
    analyzing: false,
    remaining: 20,
    error: '',
  },

  onShow() {
    this.loadState()
  },

  onUnload() {
    this._unloaded = true
    this.loadRequest = (this.loadRequest || 0) + 1
  },

  isCurrent(request) {
    return !this._unloaded && (request === undefined || request === this.loadRequest)
  },

  async loadState() {
    if (this._unloaded) return
    const request = this.loadRequest = (this.loadRequest || 0) + 1
    this.setData({ loading: true, chart: null, profile: null, report: '', error: '' })
    try {
      const state = await api.getState()
      if (!this.isCurrent(request)) return
      if (!state.profile) {
        wx.redirectTo({ url: '/pages/profile/profile' })
        return
      }
      const palaces = arrangePalaces(state.chartSummary.palaces)
      const cached = await api.getFeatureCache('natal')
      if (!this.isCurrent(request)) return
      this.setData({ profile: state.profile, chart: state.chartSummary, palaces, selected: palaces.find((palace) => palace.name === '命宫') || palaces[0], report: cached && cached.text || '', remaining: state.quota.remaining })
    } catch (error) {
      if (this.isCurrent(request)) this.setData({ error: error.message })
    } finally {
      if (this.isCurrent(request)) this.setData({ loading: false })
    }
  },

  openChat() {
    wx.navigateTo({ url: '/pages/chat/chat' })
  },

  editProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  selectPalace(event) {
    this.setData({ selected: this.data.palaces[Number(event.currentTarget.dataset.index)] })
  },

  openFeature(event) {
    const page = event.currentTarget.dataset.page
    if (['fortune', 'kline', 'match', 'share'].includes(page)) wx.navigateTo({ url: `/pages/${page}/${page}` })
  },

  async analyze() {
    if (this._unloaded || this.data.analyzing) return
    const request = this.loadRequest
    this.setData({ analyzing: true, error: '' })
    try {
      const result = await api.analyze('natal')
      if (!this.isCurrent(request)) return
      this.setData({ report: result.text || '', remaining: result.quota.remaining })
    } catch (error) {
      if (this.isCurrent(request)) this.setData({ error: error.message, ...(error.quota ? { remaining: error.quota.remaining } : {}) })
    } finally {
      if (!this._unloaded) this.setData({ analyzing: false })
    }
  },
})
