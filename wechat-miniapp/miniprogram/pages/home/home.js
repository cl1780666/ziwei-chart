const api = require('../../utils/api')
const { pickQuote } = require('../../utils/quotes')

const HERO_IMAGES = [
  '/assets/wannan-violin-poster.jpg',
  '/assets/wannan-spring-tea.jpg',
  '/assets/wannan-courtyard.jpg',
  '/assets/wannan-summer-lotus.jpg',
  '/assets/wannan-autumn-tree.jpg',
  '/assets/wannan-winter-window.jpg',
  '/assets/violin-rain-window.jpg',
  '/assets/wannan-moon-violinist.jpg',
  '/assets/wannan-night.jpg',
]

Page({
  data: {
    quote: '',
    loading: true,
    clearing: false,
    hasProfile: false,
    remaining: 20,
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
    this.quoteTimer = setInterval(() => this.advanceQuote(), 7000)
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
    this.setData({ loading: true, hasProfile: false, error: '' })
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
    if (this.data.hasProfile) return this.openChart()
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

  openFeature(event) {
    const routes = {
      fortune: '/pages/fortune/fortune', kline: '/pages/kline/kline',
      match: '/pages/match/match', share: '/pages/share/share', chat: '/pages/chat/chat',
    }
    const route = routes[event.currentTarget.dataset.feature]
    if (!route) return
    if (!this.data.hasProfile) return this.openProfile()
    wx.navigateTo({ url: route })
  },

  async clearLocalData() {
    if (this.data.clearing) return
    const answer = await wx.showModal({
      title: '清除本机数据',
      content: '删除这部手机当前微信账号的出生资料、命盘、聊天、合盘资料和解读报告，无法找回。今日已用额度不会重置。',
      confirmText: '确认清除',
      confirmColor: '#7f3036',
    })
    if (!answer.confirm) return
    this.setData({ clearing: true, error: '' })
    try {
      await api.clearLocalData()
      this.setData({ hasProfile: false })
      wx.showToast({ title: '本机数据已清除', icon: 'success' })
    } catch (error) {
      this.setData({ error: error.message })
    } finally {
      this.setData({ clearing: false })
    }
  },
})
