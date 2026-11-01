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
    quoteVisible: true,
  },

  onLoad() {
    this.setData({ quote: pickQuote() })
  },

  onShow() {
    this.loadState()
    this.startHeroRotation()
    this.startQuoteRotation()
  },

  onHide() {
    this.stopHeroRotation()
    this.stopQuoteRotation()
  },

  onUnload() {
    this.stopHeroRotation()
    this.stopQuoteRotation()
  },

  startHeroRotation() {
    this.stopHeroRotation()
    const visibleHeroIndex = this.data.incomingVisible
      ? this.data.incomingHeroIndex
      : this.data.visibleHeroIndex
    this.setData({ visibleHeroIndex, incomingVisible: false })
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

  startQuoteRotation() {
    this.stopQuoteRotation()
    this.setData({ quoteVisible: true })
    this.quoteTimer = setInterval(() => this.advanceQuote(), 3000)
  },

  stopQuoteRotation() {
    clearInterval(this.quoteTimer)
    clearTimeout(this.quoteSwapTimer)
  },

  advanceQuote() {
    this.setData({ quoteVisible: false })
    this.quoteSwapTimer = setTimeout(() => {
      this.setData({
        quote: pickQuote(),
        quoteVisible: true,
      })
    }, 220)
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
