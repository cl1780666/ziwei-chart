const api = require('../../utils/api')

Page({
  data: {
    loading: true,
    profile: null,
    chart: null,
    error: '',
  },

  onShow() {
    this.loadState()
  },

  async loadState() {
    this.setData({ loading: true, error: '' })
    try {
      const state = await api.getState()
      if (!state.profile) {
        wx.redirectTo({ url: '/pages/profile/profile' })
        return
      }
      this.setData({ profile: state.profile, chart: state.chartSummary })
    } catch (error) {
      this.setData({ error: error.message })
    } finally {
      this.setData({ loading: false })
    }
  },

  openChat() {
    wx.navigateTo({ url: '/pages/chat/chat' })
  },

  editProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },
})
