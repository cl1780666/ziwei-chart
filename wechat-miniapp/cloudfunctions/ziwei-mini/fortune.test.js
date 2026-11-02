const test = require('node:test')
const assert = require('node:assert/strict')
const { createAstrolabe, createChartSummary, validateProfile, buildChartContext } = require('./domain')
const { createYearlySummary, generateLifetime, parseAIKLine, yearGanZhi, createMonthlySampler, AI_KLINE_PROTOCOL } = require('./fortune')
const { prepareAnalysis, AnalysisInputError } = require('./analysis')

const profile = validateProfile({ year: 2002, month: 8, day: 19, hour: 12, gender: 'female', birthplace: '宣城', trueSolarEnabled: true })
const grouped = (rows) => ({ decades: Array.from({ length: Math.ceil(rows.length / 10) }, (_, index) => ({
  startAge: index * 10 + 1, rows: rows.slice(index * 10, index * 10 + 10),
})) })

test('full chart preserves original iztro stars, brightness, mutagens, gods and decadal data', () => {
  const summary = createChartSummary(profile)
  const { chart } = createAstrolabe(profile)
  assert.equal(summary.schemaVersion, 2)
  assert.equal(summary.yinYang, '阳女')
  assert.equal(summary.nayin, '杨柳木')
  assert.equal(summary.palaces.length, 12)
  for (const [index, palace] of summary.palaces.entries()) {
    const original = chart.palaces[index]
    assert.equal(palace.index, original.index)
    assert.deepEqual(palace.adjectiveStars, original.adjectiveStars.map((star) => String(star.name)))
    assert.deepEqual(palace.starDetails.major.map((star) => [star.name, star.brightness, star.mutagen]),
      original.majorStars.map((star) => [String(star.name), String(star.brightness || ''), String(star.mutagen || '')]))
    assert.deepEqual(palace.starDetails.minor.map((star) => star.name), original.minorStars.map((star) => String(star.name)))
    for (const key of ['changsheng12', 'boshi12', 'jiangqian12', 'suiqian12']) assert.equal(palace[key], original[key])
    assert.deepEqual(palace.decadal.range, original.decadal.range)
    assert.deepEqual(palace.ages, original.ages)
    assert.ok(palace.majorStars.every((star) => typeof star === 'string'))
  }
  assert.doesNotThrow(() => JSON.stringify(summary))
  assert.equal(summary.annual.length, 3)
  for (const annual of summary.annual) {
    const actual = chart.horoscope(`${annual.year}-6-15`).yearly
    assert.equal(annual.palaceName, chart.palaces[actual.index].name)
    assert.deepEqual(annual.mutagens, actual.mutagen)
  }
})

test('a selected year maps all twelve palaces and positional four transformations correctly', () => {
  const yearly = createYearlySummary(profile, 2028)
  const { chart } = createAstrolabe(profile)
  const original = chart.horoscope('2028-6-15')
  assert.equal(yearly.year, 2028)
  assert.equal(yearly.age, 27)
  assert.equal(yearly.stemBranch, `${original.yearly.heavenlyStem}${original.yearly.earthlyBranch}`)
  assert.equal(yearly.palaceName, chart.palaces[original.yearly.index].name)
  assert.deepEqual(yearly.mutagens.map((item) => item.type), ['禄', '权', '科', '忌'])
  assert.deepEqual(yearly.mutagens.map((item) => item.star), original.yearly.mutagen)
  for (const item of yearly.mutagens) {
    assert.ok([...chart.palaces[item.index].majorStars, ...chart.palaces[item.index].minorStars].some((star) => star.name === item.star))
    assert.equal(item.palace, chart.palaces[item.index].name)
  }
  for (const [index, palace] of yearly.palaces.entries()) {
    assert.equal(palace.name, original.yearly.palaceNames[index])
    assert.equal(palace.originalName, chart.palaces[index].name)
  }
  assert.equal(yearly.months.length, 12)
  assert.ok(yearly.months.every((month, index) => month.month === index + 1 && month.mutagens.length === 4))
  assert.throws(() => createYearlySummary(profile, 1899), /INVALID_YEAR/)
  assert.throws(() => createYearlySummary(profile, 2001), /INVALID_YEAR/)
})

test('the natal context includes a trusted current year, nominal age and exact active decadal', () => {
  const reference = new Date('2026-11-02T00:00:00Z')
  const summary = createChartSummary(profile, reference)
  const current = summary.currentFortune
  const actual = createAstrolabe(profile).chart.horoscope('2026-11-2')
  assert.equal(summary.schemaVersion, 2)
  assert.equal(current.asOfDate, '2026-11-02')
  assert.equal(current.year, 2026)
  assert.equal(current.nominalAge, 25)
  assert.equal(current.available, true)
  assert.deepEqual(current.decadal.range, [24, 33])
  assert.equal(current.decadal.palaceName, '夫妻')
  assert.equal(current.decadal.index, actual.decadal.index)
  assert.deepEqual(current.decadal.mutagen, actual.decadal.mutagen)
  const context = buildChartContext(profile, summary).split('【十二宫星曜】')[0]
  assert.match(context, /当前公历年份：2026；农历虚岁：25岁/)
  assert.match(context, /当前大限：24–33虚岁，落本命夫妻/)
  assert.equal(context.includes('当前大限：14–23'), false)
})

test('the current decadal respects pre-lunar-year birthdays and the actual Shanghai reference date', () => {
  const early = { ...profile, year: 1990, month: 1, day: 1, trueSolarEnabled: false }
  const chart = createAstrolabe(early).chart
  for (const [date, age, range] of [['2023-01-01', 34, [25, 34]], ['2023-02-01', 35, [35, 44]]]) {
    const current = createChartSummary(early, new Date(`${date}T00:00:00Z`)).currentFortune
    const actual = chart.horoscope(date)
    assert.equal(current.nominalAge, age)
    assert.deepEqual(current.decadal.range, range)
    assert.equal(current.decadal.palaceName, chart.palaces[actual.decadal.index].name)
    assert.equal(current.decadal.stemBranch, `${actual.decadal.heavenlyStem}${actual.decadal.earthlyBranch}`)
  }
  const boundary = createChartSummary(profile, new Date('2026-12-31T16:30:00Z')).currentFortune
  assert.equal(boundary.asOfDate, '2027-01-01')
  assert.equal(boundary.year, 2027)
})

test('future birth dates and dates beyond the supported decades do not invent a current decadal', () => {
  const reference = new Date('2026-11-02T00:00:00Z')
  for (const [year, reason] of [[2100, 'BEFORE_BIRTH'], [1900, 'OUTSIDE_DECADAL_RANGE']]) {
    const current = createChartSummary({ ...profile, year, month: 1, day: 1 }, reference).currentFortune
    assert.equal(current.available, false)
    assert.equal(current.reason, reason)
    assert.equal(Object.hasOwn(current, 'decadal'), false)
  }
})

test('the 100-year baseline is deterministic with bounded dimensions and continuous valid OHLC', () => {
  const first = generateLifetime(profile)
  const second = generateLifetime(profile)
  assert.deepEqual(first, second)
  assert.equal(first.length, 100)
  assert.equal(first[0].open, 50)
  for (const [index, point] of first.entries()) {
    assert.equal(point.age, index + 1)
    assert.equal(point.year, profile.year + index)
    assert.equal(point.ganZhi, yearGanZhi(point.year))
    for (const score of [point.open, point.close, point.high, point.low, point.score, ...Object.values(point.dimensions)]) {
      assert.ok(Number.isInteger(score) && score >= 0 && score <= 100)
    }
    assert.ok(point.high >= Math.max(point.open, point.close))
    assert.ok(point.low <= Math.min(point.open, point.close))
    if (index) assert.equal(point.open, first[index - 1].close)
    assert.match(point.daYunRange, /^\d+-\d+$/)
    assert.equal(point.yearlyMutagens.length, 4)
  }
  assert.ok(new Set(first.map((point) => point.close)).size > 10)
})

test('lightweight quarter scopes match iztro across leap months, new year and solar-time date correction', () => {
  const profiles = [profile,
    { ...profile, year: 1990, month: 1, day: 1, trueSolarEnabled: false },
    { ...profile, year: 2023, month: 4, day: 10, trueSolarEnabled: false },
    { ...profile, hour: 0, birthplace: '乌鲁木齐', trueSolarEnabled: true },
  ]
  const dates = ['2020-5-15', '2020-6-15', '2023-3-22', '2023-4-10', '2023-4-19', '2026-1-15', '2026-4-15', '2026-10-15']
  for (const input of profiles) {
    const { chart } = createAstrolabe(input)
    const sample = createMonthlySampler(chart)
    for (const date of dates) {
      const actual = chart.horoscope(date).monthly
      assert.deepEqual(sample(date), {
        index: actual.index, heavenlyStem: actual.heavenlyStem,
        earthlyBranch: actual.earthlyBranch, mutagen: actual.mutagen,
      })
    }
  }
})

test('pre-lunar-new-year birthdays use one coherent nominal-age decadal scope including childhood', () => {
  const early = { ...profile, year: 1990, month: 1, day: 1, trueSolarEnabled: false }
  const { chart } = createAstrolabe(early)
  for (const year of [2003, 2013, 2023]) {
    const summary = createYearlySummary(early, year, chart)
    const actual = chart.horoscope(`${year}-6-15`)
    const palace = chart.palaces[actual.decadal.index]
    assert.deepEqual(summary.decadal.range, palace.decadal.range)
    assert.equal(summary.decadal.daYun, `${actual.decadal.heavenlyStem}${actual.decadal.earthlyBranch}`)
    assert.equal(summary.decadal.palaceName, palace.name)
    assert.equal(summary.nominalAge, actual.age.nominalAge)
  }
  const childhood = createYearlySummary(early, 1990, chart)
  const firstAge = Math.min(...chart.palaces.map((palace) => palace.decadal.range[0]))
  assert.equal(childhood.decadal.daYun, '童限')
  assert.deepEqual(childhood.decadal.range, [1, firstAge - 1])
  assert.equal(childhood.decadal.palaceName, chart.palaces[chart.horoscope('1990-6-15').decadal.index].name)
  const point = generateLifetime(early, chart)[33]
  const yearly = createYearlySummary(early, point.year, chart)
  assert.equal(point.age, 34)
  assert.equal(point.nominalAge, 35)
  assert.equal(point.daYunRange, yearly.decadal.range.join('-'))
  assert.equal(point.daYun, yearly.decadal.daYun)
})

test('wick protocol requires exactly 100 complete valid rows and preserves zero inputs', () => {
  const basis = Array.from({ length: 100 }, (_, index) => ({ age: index + 1, year: 2002 + index, daYun: '壬子' }))
  const rows = Array.from({ length: 100 }, () => [0, 0, 0, 0, 0, 0, 0])
  const result = parseAIKLine(JSON.stringify(grouped(rows)), basis)
  assert.equal(result.length, 100)
  assert.equal(result[0].close, 0)
  assert.equal(result[0].dimensions.career, 0)
  assert.equal(result[1].open, 0)
  assert.equal(result[99].year, 2101)
  const invalid = [
    [grouped(rows.slice(0, 99)), 'KLINE_ROW_COUNT'], [grouped([...rows, rows[0]]), 'KLINE_GROUP_COUNT'],
    [{ decades: grouped(rows).decades.slice(0, 9) }, 'KLINE_GROUP_COUNT'],
    [{ decades: grouped(rows).decades.map((group, index) => index === 0 ? { ...group, startAge: 2 } : group) }, 'KLINE_START_AGE'],
    [{ decades: grouped(rows).decades.map((group, index) => index === 1 ? { ...group, startAge: 1 } : group) }, 'KLINE_START_AGE'],
    [{ decades: grouped(rows).decades.map((group, index) => index === 0 ? { ...group, startAge: '1' } : group) }, 'KLINE_START_AGE'],
    [{ decades: grouped(rows).decades.map((group, index) => index === 0 ? { ...group, rows: [...group.rows, rows[0]] } : group) }, 'KLINE_ROW_COUNT'],
    [{ decades: grouped(rows).decades.map((group, index) => index === 0 ? { ...group, extra: true } : group) }, 'KLINE_ROW_SHAPE'],
    [rows, 'KLINE_ROW_SHAPE'], [{ rows }, 'KLINE_ROW_SHAPE'], [{ ...grouped(rows), extra: true }, 'KLINE_ROW_SHAPE'],
    [null, 'KLINE_ROW_SHAPE'], [{ decades: null }, 'KLINE_ROW_SHAPE'],
    [{ points: rows }, 'KLINE_ROW_SHAPE'],
    [grouped(rows.map((row, index) => index === 0 ? ['0', 0, 0, 0, 0, 0, 0] : row)), 'KLINE_NUMBER_RANGE'],
    [grouped(rows.map((row, index) => index === 0 ? [0, 101, 0, 0, 0, 0, 0] : row)), 'KLINE_NUMBER_RANGE'],
    [grouped(rows.map((row, index) => index === 0 ? [0, -1, 0, 0, 0, 0, 0] : row)), 'KLINE_NUMBER_RANGE'],
    [grouped(rows.map((row, index) => index === 0 ? [0.5, 0, 0, 0, 0, 0, 0] : row)), 'KLINE_NUMBER_RANGE'],
    [grouped(rows.map((row, index) => index === 0 ? [0, 0, 0] : row)), 'KLINE_ROW_SHAPE'],
  ]
  for (const [value, code] of invalid) assert.throws(() => parseAIKLine(JSON.stringify(value), basis), (error) => error.code === code && error.message === code)
  assert.throws(() => parseAIKLine(JSON.stringify(grouped(rows)).slice(0, -2), basis), (error) => error.code === 'KLINE_JSON_PARSE')
})

test('wick amplitudes construct continuous legal OHLC including zero and hundred saturation', () => {
  const basis = Array.from({ length: 100 }, (_, index) => ({ age: index + 1, year: 2002 + index }))
  const rows = Array.from({ length: 100 }, () => [50, 0, 0, 50, 50, 50, 50])
  rows[0] = [0, 0, 0, 0, 0, 0, 0]
  rows[1] = [100, 100, 100, 100, 100, 100, 100]
  rows[2] = [20, 5, 3, 20, 20, 20, 20]
  rows[3] = [40, 2, 7, 40, 40, 40, 40]
  const points = parseAIKLine(JSON.stringify(grouped(rows)), basis)
  assert.deepEqual(points.slice(0, 4).map(({ open, close, high, low }) => [open, close, high, low]),
    [[50, 0, 50, 0], [0, 100, 100, 0], [100, 20, 100, 17], [20, 40, 42, 13]])
  for (const [index, point] of points.entries()) {
    assert.ok(point.high >= Math.max(point.open, point.close) && point.high <= 100)
    assert.ok(point.low <= Math.min(point.open, point.close) && point.low >= 0)
    if (index) assert.equal(point.open, points[index - 1].close)
  }
  rows[0] = [50, 60, 40, 50, 50, 50, 50]
  const explicit = parseAIKLine(JSON.stringify(grouped(rows)), basis)[0]
  assert.equal(explicit.high, 100)
  assert.equal(explicit.low, 10)
})

test('reports are grounded in canonical profiles and both charts are required for matching', () => {
  assert.throws(() => prepareAnalysis({ task: 'match', profile }), AnalysisInputError)
  const partner = { ...profile, year: 1998, month: 2, day: 3, gender: 'male' }
  const plan = prepareAnalysis({ task: 'match', profile, partner, chartSummary: { soul: 'FORGED' } })
  const result = plan.decode('双方真实命盘分析')
  assert.equal(result.chartSummary.schemaVersion, 2)
  assert.equal(result.partnerChartSummary.schemaVersion, 2)
  assert.notEqual(result.chartSummary.chineseDate, result.partnerChartSummary.chineseDate)
  const prompt = plan.messages[1].content
  assert.match(prompt, /2002年8月19日/)
  assert.match(prompt, /1998年2月3日/)
  assert.match(prompt, /甲命宫干飞入乙本命/)
  assert.equal(prompt.includes('FORGED'), false)
  assert.ok(Buffer.byteLength(JSON.stringify({ messages: plan.messages })) < 110000)
  assert.match(prepareAnalysis({ task: 'natal', profile }).messages[0].content, /命格金句/)
  assert.match(prepareAnalysis({ task: 'yearly', profile, year: 2028 }).messages[1].content, /指定流年】2028年/)
  assert.throws(() => prepareAnalysis({ task: 'klineYear', profile, age: 101 }), AnalysisInputError)
  assert.throws(() => prepareAnalysis({ task: 'klineYear', profile, age: 25, year: 2028 }), AnalysisInputError)
  assert.throws(() => prepareAnalysis({ task: 'unknown', profile }), AnalysisInputError)
})

test('compact 100-year AI request fits the existing proxy input budget', () => {
  const plan = prepareAnalysis({ task: 'kline', profile })
  assert.match(plan.messages[0].content, new RegExp(AI_KLINE_PROTOCOL))
  assert.equal(AI_KLINE_PROTOCOL, 'KLINE_WICK_V3')
  assert.match(plan.messages[0].content, /唯一字段是decades/)
  assert.match(plan.messages[1].content, /"startAge":91,"referenceRows"/)
  assert.match(plan.messages[0].content, /close,upperWick,lowerWick/)
  assert.equal(plan.messages.length, 2)
  assert.ok(plan.messages.every((message) => message.content.length < 60000))
  assert.ok(Buffer.byteLength(JSON.stringify({ messages: plan.messages })) < 110000)
  const rows = Array.from({ length: 100 }, () => [50, 60, 40, 50, 50, 50, 50])
  const points = plan.decode(JSON.stringify(grouped(rows))).points
  assert.equal(points.length, 100)
  assert.ok(points.every((point) => point.yearlyMutagens.length === 4 && point.daYunRange))
})
