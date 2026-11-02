const { createAstrolabe, serializePalace, serializeStar, scopeMutagens, serializeScope, activeDecadal } = require('./domain')
const { STAR_BASE_SCORE, BRIGHTNESS_COEF, SIHUA_MODIFIER } = require('./chart-data')
const { createRequire } = require('node:module')
const { astro } = require('iztro')
const { fixIndex, fixEarthlyBranchIndex, getMutagensByHeavenlyStem } = require('iztro/lib/utils')
// Resolve the same calendar dependency used by the pinned iztro installation,
// including when pnpm keeps transitive dependencies outside this module's root.
const { solar2lunar, getHeavenlyStemAndEarthlyBranchBySolarDate } = createRequire(require.resolve('iztro'))('lunar-lite')

const DIMENSION_PALACES = {
  career: ['官禄', '命宫', '迁移'],
  wealth: ['财帛', '福德', '田宅'],
  relationship: ['夫妻', '子女', '兄弟'],
  health: ['疾厄', '父母', '命宫'],
}
const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)))
const AI_KLINE_PROTOCOL = 'KLINE_WICK_V3'

function validateYear(value) {
  const year = Number(value)
  if (!Number.isInteger(year) || year < 1900 || year > 2199) throw new Error('INVALID_YEAR')
  return year
}

function yearGanZhi(year) {
  const index = ((year - 1984) % 60 + 60) % 60
  return '甲乙丙丁戊己庚辛壬癸'[index % 10] + '子丑寅卯辰巳午未申酉戌亥'[index % 12]
}

function createMonthlySampler(chart) {
  const birthday = solar2lunar(chart.solarDate)
  const birthMonth = birthday.lunarMonth + (birthday.isLeap && birthday.lunarDay > 15 ? 1 : 0)
  const birthHour = fixIndex(fixEarthlyBranchIndex(chart.rawDates.chineseDate.hourly[1]) + 2)
  const divide = astro.getConfig().horoscopeDivide
  return (date) => {
    const lunar = solar2lunar(date)
    const chinese = getHeavenlyStemAndEarthlyBranchBySolarDate(date, 0, { year: divide, month: divide })
    const month = lunar.lunarMonth + (lunar.isLeap && lunar.lunarDay > 15 ? 1 : 0)
    // Same monthly-index expression as iztro 2.5.8 FunctionalAstrolabe.
    // Only index/four transformations are needed; skip unrelated day/hour stars.
    return {
      index: fixIndex(fixEarthlyBranchIndex(chinese.yearly[1]) - birthMonth + birthHour + month),
      heavenlyStem: String(chinese.monthly[0]),
      earthlyBranch: String(chinese.monthly[1]),
      mutagen: getMutagensByHeavenlyStem(chinese.monthly[0]),
    }
  }
}

function createYearlySummary(profile, rawYear, astrolabe) {
  const year = validateYear(rawYear)
  if (year < profile.year) throw new Error('INVALID_YEAR')
  const chart = astrolabe || createAstrolabe(profile).chart
  const horoscope = chart.horoscope(`${year}-6-15`)
  const scope = serializeScope(chart, horoscope.yearly)
  const age = year - profile.year + 1
  const decadal = activeDecadal(chart, horoscope)
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    return { month, ...serializeScope(chart, chart.horoscope(`${year}-${month}-15`).monthly) }
  })
  return {
    year, age, nominalAge: Number(horoscope.age.nominalAge), ...scope,
    decadal: { ...serializeScope(chart, horoscope.decadal), range: decadal.range, daYun: decadal.daYun },
    palaces: chart.palaces.map((palace, index) => ({
      ...serializePalace(palace),
      name: String(horoscope.yearly.palaceNames[index]),
      originalName: String(palace.name),
      scopeStars: ((horoscope.yearly.stars || [])[index] || []).map(serializeStar),
      yearlyMutagens: scope.mutagens.filter((item) => item.index === index),
      yearlySuiqian12: (horoscope.yearly.yearlyDecStar && horoscope.yearly.yearlyDecStar.suiqian12[index]) || '',
      yearlyJiangqian12: (horoscope.yearly.yearlyDecStar && horoscope.yearly.yearlyDecStar.jiangqian12[index]) || '',
    })),
    months,
  }
}

function palaceScore(palace, decadal = false) {
  if (!palace) return 50
  let score = decadal ? 45 : 50
  for (const star of palace.majorStars) {
    const brightness = BRIGHTNESS_COEF[String(star.brightness)] || 1
    score += (STAR_BASE_SCORE[String(star.name)] || 0) * brightness * (decadal ? 1.2 : 1)
    for (const mutagen of String(star.mutagen || '')) score += SIHUA_MODIFIER[mutagen] || 0
  }
  for (const star of palace.minorStars) {
    score += (STAR_BASE_SCORE[String(star.name)] || 0) * (decadal ? 0.8 : 1)
    for (const mutagen of String(star.mutagen || '')) score += SIHUA_MODIFIER[mutagen] || 0
  }
  for (const star of palace.adjectiveStars || []) score += (STAR_BASE_SCORE[String(star.name)] || 0) * 0.5
  return clamp(score)
}

function scopeInfluence(chart, scope, targetIndex = scope.index) {
  return scopeMutagens(chart, scope).reduce((sum, item) => {
    const distance = (item.index - targetIndex + 12) % 12
    const relevance = distance === 0 ? 1 : [4, 6, 8].includes(distance) ? 0.55 : 0.1
    return sum + (SIHUA_MODIFIER[item.type] || 0) * relevance
  }, 0)
}

function dimensionScores(chart, yearly, decadalBase) {
  return Object.fromEntries(Object.entries(DIMENSION_PALACES).map(([dimension, names]) => {
    const scores = names.map((name) => {
      const palace = chart.palaces.find((item) => item.name === name)
      return palaceScore(palace) + scopeInfluence(chart, yearly, palace.index)
    })
    const base = scores.reduce((sum, score) => sum + score, 0) / scores.length
    return [dimension, clamp(base * 0.75 + decadalBase * 0.25)]
  }))
}

function generateLifetime(profile, astrolabe) {
  const chart = astrolabe || createAstrolabe(profile).chart
  const sampleMonth = createMonthlySampler(chart)
  const points = []
  let previousClose = 50
  for (let age = 1; age <= 100; age += 1) {
    const year = profile.year + age - 1
    const horoscope = chart.horoscope(`${year}-6-15`)
    const decadal = activeDecadal(chart, horoscope)
    const decadalBase = palaceScore(decadal.palace, true)
    const yearly = horoscope.yearly
    const target = clamp(decadalBase * 0.65 + palaceScore(chart.palaces[yearly.index]) * 0.35 + scopeInfluence(chart, yearly))
    const open = previousClose
    const close = clamp(open + (target - open) * 0.55)
    // Four quarterly samples provide deterministic within-year variation while
    // keeping a 100-year request comfortably below the function's time budget.
    const monthly = [1, 4, 7, 10].map((monthNumber) => {
      const month = sampleMonth(`${year}-${monthNumber}-15`)
      return clamp(target + scopeInfluence(chart, month) * 0.45 + (palaceScore(chart.palaces[month.index]) - 50) * 0.1)
    })
    const high = Math.max(open, close, ...monthly)
    const low = Math.min(open, close, ...monthly)
    const mutagens = scopeMutagens(chart, yearly)
    points.push({
      age, nominalAge: Number(horoscope.age.nominalAge), year, ganZhi: yearGanZhi(year), daYun: decadal.daYun, daYunRange: decadal.range.join('-'),
      open, close, high, low, score: clamp((open + close + high + low) / 4),
      dimensions: dimensionScores(chart, yearly, decadalBase),
      yearlyMutagens: mutagens.map((item) => `${item.star}化${item.type}`),
      reason: `流年命宫叠本命${chart.palaces[yearly.index].name}；${decadal.range.join('–')}岁${decadal.palaceName}大限。基础算法示意，仅供参考。`,
    })
    previousClose = close
  }
  return points
}

function parseAIKLine(text, basis) {
  // Do not fill in absent years or replace valid zeros with a default value.
  // KLINE_WICK_V3 requires ten exact decades. Never guess legacy arrays
  // or absolute high/low values, even if the provider accepts a looser schema.
  const invalid = (code) => Object.assign(new Error(code), { code })
  const raw = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let result
  try { result = JSON.parse(raw) } catch { throw invalid('KLINE_JSON_PARSE') }
  if (!result || typeof result !== 'object' || Array.isArray(result) || Object.keys(result).length !== 1
    || !Object.hasOwn(result, 'decades') || !Array.isArray(result.decades)) throw invalid('KLINE_ROW_SHAPE')
  if (result.decades.length !== 10) throw invalid('KLINE_GROUP_COUNT')
  const rows = []
  for (const [index, decade] of result.decades.entries()) {
    if (!decade || typeof decade !== 'object' || Array.isArray(decade) || Object.keys(decade).length !== 2
      || !Object.hasOwn(decade, 'startAge') || !Object.hasOwn(decade, 'rows') || !Array.isArray(decade.rows)) throw invalid('KLINE_ROW_SHAPE')
    if (decade.startAge !== index * 10 + 1) throw invalid('KLINE_START_AGE')
    if (decade.rows.length !== 10) throw invalid('KLINE_ROW_COUNT')
    rows.push(...decade.rows)
  }
  if (!Array.isArray(basis) || basis.length !== 100) throw new Error('INVALID_KLINE_BASIS')
  let open = 50
  return rows.map((row, index) => {
    if (!Array.isArray(row) || row.length !== 7) throw invalid('KLINE_ROW_SHAPE')
    if (row.some((value) => !Number.isInteger(value) || value < 0 || value > 100)) {
      throw invalid('KLINE_NUMBER_RANGE')
    }
    const [close, upperWick, lowerWick, career, wealth, relationship, health] = row
    const high = Math.min(100, Math.max(open, close) + upperWick)
    const low = Math.max(0, Math.min(open, close) - lowerWick)
    const point = {
      ...basis[index], open, close, high, low, score: clamp((open + close + high + low) / 4),
      dimensions: { career, wealth, relationship, health }, reason: '',
    }
    open = close
    return point
  })
}

module.exports = { createYearlySummary, generateLifetime, parseAIKLine, validateYear, scopeMutagens, serializeScope, yearGanZhi, createMonthlySampler, AI_KLINE_PROTOCOL }
