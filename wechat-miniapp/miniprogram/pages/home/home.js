const api = require('../../utils/api')
const { pickQuote } = require('../../utils/quotes')

Page({
  data: {
    quote: '',
    loading: true,
    hasProfile: false,
    profileLabel: '',
    remaining: 5,
    error: '',
  },

  onLoad() {
    this.setData({ quote: pickQuote() })
  },

  onShow() {
    this.loadState()
  },

  async loadState() {
    this.setData({ loading: true, error: '' })
    try {
      const state = await api.getState()
      const profile = state.profile
      this.setData({
        hasProfile: Boolean(profile),
        profileLabel: profile
          ? `${profile.year}年${profile.month}月${profile.day}日 · ${profile.gender === 'female' ? '女' : '男'}`
          : '',
        remaining: state.quota.remaining,
      })
    } catch (error) {
      this.setData({ error: error.message })
    } finally {
      this.setData({ loading: false })
    }
  },

  openProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  start() {
    if (this.data.hasProfile) return this.openChat()
    return this.openProfile()
  },

  openChart() {
    if (!this.data.hasProfile) return this.openProfile()
    wx.navigateTo({ url: '/pages/chart/chart' })
  },

  openChat() {
    if (!this.data.hasProfile) return this.openProfile()
    wx.navigateTo({ url: '/pages/chat/chat' })
  },
})
