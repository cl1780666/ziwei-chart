const api = require('../../utils/api')
const { pickQuote } = require('../../utils/quotes')

const HERO_IMAGES = [
  '/assets/wannan-violin-poster.jpg',
  '/assets/wannan-autumn-tree.jpg',
  '/assets/wannan-courtyard.jpg',
  '/assets/wannan-night.jpg',
  '/assets/violin-rain-window.jpg',
]

Page({
  data: {
    quote: '',
    loading: true,
    hasProfile: false,
    remaining: 5,
    error: '',
    heroImages: HERO_IMAGES,
    visibleHeroIndex: 0,
    incomingHeroIndex: 1,
    incomingVisible: false,
  },

  onLoad() {
    this.setData({ quote: pickQuote() })
  },

  onShow() {
    this.loadState()
    this.startHeroRotation()
  },

  onHide() {
    this.stopHeroRotation()
  },

  onUnload() {
    this.stopHeroRotation()
  },

  startHeroRotation() {
    this.stopHeroRotation()
    this.heroTimer = setInterval(() => this.advanceHero(), 6500)
  },

  stopHeroRotation() {
    clearInterval(this.heroTimer)
    clearTimeout(this.heroRevealTimer)
    clearTimeout(this.heroSwapTimer)
  },

  advanceHero() {
    if (this.data.incomingVisible) return
    const nextIndex = (this.data.visibleHeroIndex + 1) % HERO_IMAGES.length
    this.setData({ incomingHeroIndex: nextIndex })
    this.heroRevealTimer = setTimeout(() => {
      this.setData({ incomingVisible: true })
      this.heroSwapTimer = setTimeout(() => {
        this.setData({
          visibleHeroIndex: nextIndex,
          incomingVisible: false,
        })
      }, 1800)
    }, 80)
  },

  async loadState() {
    this.setData({ loading: true, error: '' })
    try {
      const state = await api.getState()
      const profile = state.profile
      this.setData({
        hasProfile: Boolean(profile),
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
