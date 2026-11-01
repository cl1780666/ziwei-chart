const { astro } = require('iztro')
const birthplaces = require('./birthplace-data.json')

const BEIJING_STANDARD_LONGITUDE = 120
const MINUTES_PER_LONGITUDE_DEGREE = 4
const SHICHEN_NAMES = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时']

astro.config({
  yearDivide: 'normal',
  horoscopeDivide: 'normal',
  ageDivide: 'normal',
  dayDivide: 'forward',
  algorithm: 'zhongzhou',
})

function validateProfile(value) {
  if (!value || typeof value !== 'object') throw new Error('出生资料不完整')

  const year = Number(value.year)
  const month = Number(value.month)
  const day = Number(value.day)
  const hour = Number(value.hour)
  const gender = value.gender
  const date = new Date(Date.UTC(year, month - 1, day))

  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('出生年份不正确')
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('出生月份不正确')
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('出生日期不正确')
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('出生日期不存在')
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error('出生时辰不正确')
  if (!['male', 'female'].includes(gender)) throw new Error('性别不正确')

  return {
    year,
    month,
    day,
    hour,
    gender,
    birthplace: String(value.birthplace || '').trim().slice(0, 80),
    trueSolarEnabled: value.trueSolarEnabled !== false,
  }
}

function normalizePlace(value) {
  return String(value || '').trim().replace(/\s+/g, '')
}

function stripSuffix(value) {
  return value.replace(/(特别行政区|自治州|地区|盟|市|县|区|省)$/u, '')
}

function isSpecific(value) {
  return value.length >= 2
}

function joinPlace() {
  return Array.from(arguments).filter(Boolean).join('')
}

function scorePlace(input, place) {
  const fullTokens = [
    joinPlace(place.province, place.city, place.area),
    joinPlace(place.province, place.city),
    joinPlace(place.city, place.area),
  ].filter(Boolean).map(normalizePlace)
  const localTokens = [place.name, place.area, place.city].filter(Boolean).map(normalizePlace)
  const tokens = Array.from(new Set([
    place.name,
    place.province,
    place.city,
    place.area,
    ...fullTokens,
  ].filter(Boolean).map(normalizePlace)))

  if (tokens.some((token) => token === input)) return 100
  if (fullTokens.some((token) => isSpecific(stripSuffix(input)) && stripSuffix(input) === stripSuffix(token))) return 95
  if (localTokens.some((token) => isSpecific(stripSuffix(input)) && stripSuffix(input) === stripSuffix(token))) return 90
  if (fullTokens.some((token) => isSpecific(token) && input.includes(token))) return 85
  if (localTokens.some((token) => isSpecific(token) && input.includes(token))) return 80
  if (localTokens.some((token) => isSpecific(stripSuffix(token)) && input.includes(stripSuffix(token)))) return 60
  return 0
}

function findBirthplace(value) {
  const input = normalizePlace(value)
  if (!input) return null

  let best = null
  let bestScore = 0
  for (const place of birthplaces) {
    const score = scorePlace(input, place)
    if (score > bestScore) {
      best = place
      bestScore = score
    }
  }
  return best
}

function getEquationOfTimeMinutes(year, month, day) {
  const date = Date.UTC(year, month - 1, day)
  const start = Date.UTC(year, 0, 0)
  const dayOfYear = Math.floor((date - start) / 86400000)
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
}

function timeIndexForHour(hour) {
  if (hour === 23) return 12
  if (hour === 0) return 0
  return Math.floor((hour + 1) / 2)
}

function shichenName(timeIndex) {
  return timeIndex === 12 ? SHICHEN_NAMES[0] : SHICHEN_NAMES[timeIndex] || ''
}

function resolveBirthTime(profile) {
  const originalTimeIndex = timeIndexForHour(profile.hour)
  const location = findBirthplace(profile.birthplace)
  const applied = profile.trueSolarEnabled && Boolean(location)
  const correction = applied
    ? (location.longitude - BEIJING_STANDARD_LONGITUDE) * MINUTES_PER_LONGITUDE_DEGREE
      + getEquationOfTimeMinutes(profile.year, profile.month, profile.day)
    : 0
  const corrected = new Date(Date.UTC(profile.year, profile.month - 1, profile.day, profile.hour) + correction * 60000)
  const timeIndex = applied ? timeIndexForHour(corrected.getUTCHours()) : originalTimeIndex

  return {
    year: corrected.getUTCFullYear(),
    month: corrected.getUTCMonth() + 1,
    day: corrected.getUTCDate(),
    hour: corrected.getUTCHours(),
    minute: corrected.getUTCMinutes(),
    timeIndex,
    originalShichen: shichenName(originalTimeIndex),
    correctedShichen: shichenName(timeIndex),
    correctionMinutes: Math.round(correction),
    applied,
    crossedDate: corrected.getUTCFullYear() !== profile.year
      || corrected.getUTCMonth() + 1 !== profile.month
      || corrected.getUTCDate() !== profile.day,
    locationName: location ? joinPlace(location.province, location.city, location.area || location.name) : '',
  }
}

function formatStar(star) {
  let value = String(star.name || '')
  if (star.brightness) value += `(${star.brightness})`
  if (star.mutagen) value += `[${star.mutagen}]`
  return value
}

function createChartSummary(profile) {
  const resolved = resolveBirthTime(profile)
  const chart = astro.bySolar(
    `${resolved.year}-${resolved.month}-${resolved.day}`,
    resolved.timeIndex,
    profile.gender === 'female' ? '女' : '男',
    true,
    'zh-CN',
  )

  const palaces = (chart.palaces || []).map((palace) => {
    const majorStars = (palace.majorStars || []).map(formatStar)
    const minorStars = (palace.minorStars || []).map(formatStar)
    const decadalRange = palace.decadal && palace.decadal.range
      ? `${palace.decadal.range[0]}–${palace.decadal.range[1]}岁`
      : ''
    return {
      name: String(palace.name || ''),
      isBodyPalace: Boolean(palace.isBodyPalace),
      stemBranch: `${palace.heavenlyStem || ''}${palace.earthlyBranch || ''}`,
      majorStars,
      minorStars,
      majorStarsText: majorStars.length ? majorStars.join('、') : '无主星（借对宫）',
      minorStarsText: minorStars.join('、'),
      decadalRange,
    }
  })

  const currentYear = new Date().getUTCFullYear()
  const annual = []
  for (let year = currentYear; year <= currentYear + 2; year += 1) {
    try {
      const yearly = chart.horoscope(new Date(`${year}-06-15T00:00:00+08:00`)).yearly
      annual.push({
        year,
        stemBranch: `${yearly.heavenlyStem || ''}${yearly.earthlyBranch || ''}`,
        palaceName: String((yearly.palaceNames || [])[0] || ''),
        mutagens: (yearly.mutagen || []).map(String),
      })
    } catch (error) {
      // Individual annual calculations should not block the natal chart.
    }
  }

  return {
    solarDate: String(chart.solarDate || ''),
    lunarDate: String(chart.lunarDate || ''),
    chineseDate: String(chart.chineseDate || ''),
    time: String(chart.time || ''),
    timeRange: String(chart.timeRange || ''),
    sign: String(chart.sign || ''),
    zodiac: String(chart.zodiac || ''),
    soul: String(chart.soul || ''),
    body: String(chart.body || ''),
    fiveElementsClass: String(chart.fiveElementsClass || ''),
    soulPalaceBranch: String(chart.earthlyBranchOfSoulPalace || ''),
    bodyPalaceBranch: String(chart.earthlyBranchOfBodyPalace || ''),
    palaces,
    annual,
    timeCorrection: resolved,
  }
}

function buildChartContext(profile, chart) {
  const lines = [
    '【命主资料】',
    `阳历：${profile.year}年${profile.month}月${profile.day}日`,
    `性别：${profile.gender === 'female' ? '女' : '男'}`,
    `五行局：${chart.fiveElementsClass}`,
    `命主/身主：${chart.soul || '未知'} / ${chart.body || '未知'}`,
    `命宫/身宫地支：${chart.soulPalaceBranch || '未知'} / ${chart.bodyPalaceBranch || '未知'}`,
    '',
    '【十二宫星曜】',
  ]

  for (const palace of chart.palaces) {
    lines.push(`${palace.name}${palace.isBodyPalace ? '（身宫）' : ''}：主星 ${palace.majorStarsText}${palace.minorStarsText ? `；辅星 ${palace.minorStarsText}` : ''}`)
  }

  if (chart.annual.length) {
    lines.push('', '【近三年流年】')
    for (const year of chart.annual) {
      lines.push(`${year.year}年 ${year.stemBranch}：流年命宫 ${year.palaceName || '未知'}；四化 ${year.mutagens.join('、') || '未知'}`)
    }
  }

  return lines.join('\n')
}

function shanghaiDay(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function quotaState(quota, limit, date = new Date()) {
  const day = shanghaiDay(date)
  const count = quota && quota.day === day ? Number(quota.count) || 0 : 0
  return { day, count, limit, remaining: Math.max(0, limit - count) }
}

module.exports = {
  buildChartContext,
  createChartSummary,
  findBirthplace,
  quotaState,
  resolveBirthTime,
  shanghaiDay,
  validateProfile,
}
