const api = require('../../utils/api')

const HOURS = [23, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]
const SHICHEN = ['子时（23:00–00:59）', '丑时（01:00–02:59）', '寅时（03:00–04:59）', '卯时（05:00–06:59）', '辰时（07:00–08:59）', '巳时（09:00–10:59）', '午时（11:00–12:59）', '未时（13:00–14:59）', '申时（15:00–16:59）', '酉时（17:00–18:59）', '戌时（19:00–20:59）', '亥时（21:00–22:59）']

function formOf(profile, index) {
  const value = profile || { year: 2002, month: 8, day: 19, hour: 12, gender: index ? 'male' : 'female' }
  const hour = HOURS.indexOf(value.hour)
  return {
    label: index ? '乙方 · 合盘对象' : '甲方 · 本机命盘',
    date: `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`,
    hourIndex: hour >= 0 ? hour : Math.floor((Number(value.hour) + 1) / 2) % 12,
    hourValue: value.hour,
    gender: value.gender, birthplace: value.birthplace || '',
    trueSolarEnabled: value.trueSolarEnabled !== false,
  }
}

function profileOf(form) {
  const [year, month, day] = form.date.split('-').map(Number)
  return { year, month, day, hour: form.hourValue, gender: form.gender, birthplace: form.birthplace.trim(), trueSolarEnabled: form.trueSolarEnabled }
}

function summaryOf(chart, label) {
  const life = (chart.palaces || []).find((palace) => palace.name === '命宫')
  const spouse = (chart.palaces || []).find((palace) => palace.name === '夫妻宫' || palace.name === '夫妻')
  return {
    label, elements: chart.fiveElementsClass || '—',
    life: life ? life.majorStarsText : '—', spouse: spouse ? spouse.majorStarsText : '—',
    soul: chart.soul || '—', body: chart.body || '—',
    corrected: chart.timeCorrection && chart.timeCorrection.applied
      ? `${chart.timeCorrection.correctedShichen} · 校正 ${chart.timeCorrection.correctionMinutes} 分钟` : '',
  }
}

function reportBlocks(text) {
  return String(text || '').split(/\n\s*\n/).filter(Boolean).map((part) => {
    const heading = /^#{1,6}\s+/.test(part)
    return { heading, text: part.replace(/^#{1,6}\s+/gm, '').replace(/\*\*/g, '').replace(/^---+$/gm, '').trim() }
  }).filter((part) => part.text)
}

Page({
  data: {
    loading: true, busy: false, analyzing: false, remaining: 20,
    people: [formOf(null, 0), formOf(null, 1)], shichenOptions: SHICHEN,
    summaries: [], report: '', blocks: [], cached: false, progress: '', error: '',
  },

  async onLoad() {
    try {
      const state = await api.getState()
      if (this._unloaded) return
      const partner = state.partner || await api.getMatchPartner()
      if (this._unloaded) return
      this.setData({
        people: [formOf(state.profile, 0), formOf(partner, 1)],
        remaining: state.quota ? state.quota.remaining : 20,
      })
      if (state.profile && state.chartSummary) {
        this.setData({ summaries: [summaryOf(state.chartSummary, '甲方')] })
      }
      if (partner) {
        const cache = await api.getFeatureCache('match', { partner })
        if (cache && cache.text) this.showReport(cache.text, true)
      }
    } catch (error) {
      if (!this._unloaded) this.setData({ error: error.message || '读取本机资料失败，请重试' })
    } finally {
      if (!this._unloaded) this.setData({ loading: false })
    }
  },

  onUnload() { this._unloaded = true; clearInterval(this._progressTimer) },

  updatePerson(event, field, value) {
    if (this.data.busy) return
    const index = Number(event.currentTarget.dataset.index)
    if (![0, 1].includes(index)) return
    this.setData({ [`people[${index}].${field}`]: value, report: '', blocks: [], cached: false, summaries: [], error: '' })
  },

  onDateChange(event) { this.updatePerson(event, 'date', event.detail.value) },
  onHourChange(event) {
    this.updatePerson(event, 'hourIndex', Number(event.detail.value))
    this.updatePerson(event, 'hourValue', HOURS[Number(event.detail.value)])
  },
  onGenderChange(event) { this.updatePerson(event, 'gender', event.detail.value) },
  onPlaceInput(event) { this.updatePerson(event, 'birthplace', event.detail.value) },
  onSolarChange(event) { this.updatePerson(event, 'trueSolarEnabled', event.detail.value) },

  showReport(text, cached) {
    if (!this._unloaded) this.setData({ report: text, blocks: reportBlocks(text), cached })
  },

  async prepareCharts() {
    const primary = profileOf(this.data.people[0])
    const partner = profileOf(this.data.people[1])
    this.setData({ progress: '正在核对两份出生资料…' })
    // Updating the primary deliberately updates only this phone's active chart.
    const first = await api.saveProfile(primary)
    if (this._unloaded) return null
    const second = await api.previewProfile(partner)
    if (this._unloaded) return null
    const savedPartner = await api.saveMatchPartner(second.profile || partner)
    if (!this._unloaded) this.setData({
      summaries: [summaryOf(first.chartSummary, '甲方'), summaryOf(second.chartSummary, '乙方')],
      remaining: second.quota ? second.quota.remaining : this.data.remaining,
    })
    return savedPartner
  },

  async previewCharts() {
    if (this.data.busy) return
    this.setData({ busy: true, error: '' })
    try {
      const partner = await this.prepareCharts()
      if (this._unloaded || !partner) return
      const cache = await api.getFeatureCache('match', { partner })
      if (cache && cache.text) this.showReport(cache.text, true)
      if (!this._unloaded) wx.showToast({ title: '两份命盘已展开', icon: 'success' })
    } catch (error) {
      if (!this._unloaded) this.setData({ error: error.message || '生成命盘失败，请检查出生资料' })
    } finally {
      if (!this._unloaded) this.setData({ busy: false, progress: '' })
    }
  },

  async analyze() {
    if (this.data.busy) return
    this.setData({ busy: true, analyzing: true, cached: false, report: '', blocks: [], error: '' })
    try {
      const partner = await this.prepareCharts()
      if (this._unloaded || !partner) return
      const steps = ['正在对照双方命宫与夫妻宫…', '正在梳理相合之处与磨合难点…', '正在整理相处建议，请稍候…']
      let step = 0
      this.setData({ progress: steps[0] })
      this._progressTimer = setInterval(() => {
        step = Math.min(step + 1, steps.length - 1)
        if (!this._unloaded) this.setData({ progress: steps[step] })
      }, 5000)
      const result = await api.analyze('match', { partner })
      if (!result.text || !result.text.trim()) throw new Error('没有收到完整合盘报告，请稍后重试')
      this.showReport(result.text, false)
      if (!this._unloaded && result.quota) this.setData({ remaining: result.quota.remaining })
    } catch (error) {
      if (!this._unloaded) this.setData({
        error: error.message || '合盘暂时没有完成，请稍后重试',
        ...(error.quota ? { remaining: error.quota.remaining } : {}),
      })
    } finally {
      clearInterval(this._progressTimer)
      if (!this._unloaded) this.setData({ busy: false, analyzing: false, progress: '' })
    }
  },

  copyReport() {
    if (this.data.report) wx.setClipboardData({ data: this.data.report })
  },
})
