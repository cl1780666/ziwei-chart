const api = require('../../utils/api')

const SHICHEN_OPTIONS = [
  '子时（23:00–00:59）', '丑时（01:00–02:59）', '寅时（03:00–04:59）',
  '卯时（05:00–06:59）', '辰时（07:00–08:59）', '巳时（09:00–10:59）',
  '午时（11:00–12:59）', '未时（13:00–14:59）', '申时（15:00–16:59）',
  '酉时（17:00–18:59）', '戌时（19:00–20:59）', '亥时（21:00–22:59）',
]
const SHICHEN_HOURS = [23, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]

Page({
  data: {
    date: '2002-08-19',
    gender: 'female',
    shichenIndex: 6,
    shichenOptions: SHICHEN_OPTIONS,
    birthplace: '',
    trueSolarEnabled: true,
    saving: false,
    error: '',
  },

  async onLoad() {
    try {
      const state = await api.getState()
      if (!state.profile) return
      const profile = state.profile
      const hourIndex = SHICHEN_HOURS.indexOf(profile.hour)
      this.setData({
        date: `${profile.year}-${String(profile.month).padStart(2, '0')}-${String(profile.day).padStart(2, '0')}`,
        gender: profile.gender,
        shichenIndex: hourIndex >= 0 ? hourIndex : 6,
        birthplace: profile.birthplace || '',
        trueSolarEnabled: profile.trueSolarEnabled !== false,
      })
    } catch (error) {
      this.setData({ error: error.message })
    }
  },

  onDateChange(event) {
    this.setData({ date: event.detail.value })
  },

  onShichenChange(event) {
    this.setData({ shichenIndex: Number(event.detail.value) })
  },

  onGenderChange(event) {
    this.setData({ gender: event.detail.value })
  },

  onBirthplaceInput(event) {
    this.setData({ birthplace: event.detail.value })
  },

  onTrueSolarChange(event) {
    this.setData({ trueSolarEnabled: event.detail.value })
  },

  async save() {
    if (this.data.saving) return
    const [year, month, day] = this.data.date.split('-').map(Number)
    this.setData({ saving: true, error: '' })

    try {
      await api.saveProfile({
        year,
        month,
        day,
        hour: SHICHEN_HOURS[this.data.shichenIndex],
        gender: this.data.gender,
        birthplace: this.data.birthplace.trim(),
        trueSolarEnabled: this.data.trueSolarEnabled,
      })
      wx.showToast({ title: '命盘已保存', icon: 'success' })
      setTimeout(() => wx.redirectTo({ url: '/pages/chart/chart' }), 500)
    } catch (error) {
      this.setData({ error: error.message })
    } finally {
      this.setData({ saving: false })
    }
  },
})
