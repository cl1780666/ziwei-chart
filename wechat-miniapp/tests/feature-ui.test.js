const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { candleLayout, radarGeometry, drawRadar } = require('../miniprogram/utils/plot')
const { reportNodes } = require('../miniprogram/utils/report')

function points() {
  return Array.from({ length: 100 }, (_, index) => ({ year: 2002 + index, age: index + 1, open: 40, close: 60, high: 75, low: 25, score: 60, daYun: `大限${Math.floor(index / 10)}`, dimensions: { career: 70, wealth: 60, relationship: 50, health: 80 } }))
}

function page(name, api, wxOverrides = {}) {
  let definition
  const source = readFileSync(`${__dirname}/../miniprogram/pages/${name}/${name}.js`, 'utf8')
  new Function('require', 'Page', 'wx', source)((path) => path.endsWith('/api') ? api : require('../miniprogram/utils/plot'), (value) => { definition = value }, { redirectTo() {}, navigateTo() {}, navigateBack() {}, ...wxOverrides })
  const result = { ...definition, data: JSON.parse(JSON.stringify(definition.data)) }
  result.setData = function (data, callback) { Object.assign(this.data, data); if (callback) callback() }
  return result
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('100-year candle geometry keeps OHLC envelopes and marks only decadal transitions', () => {
  const values = points()
  values[1] = { ...values[1], open: 110, close: -10, high: 0, low: 100 }
  values[2] = { ...values[2], open: 50, close: 50, high: 50, low: 50 }
  const layout = candleLayout(values)
  assert.equal(layout.candles.length, 100)
  assert.equal(layout.candles.filter((value) => value.boundary).length, 10)
  assert.ok(layout.width > layout.candles.at(-1).x + 33)
  assert.equal(layout.candles[1].highY, 32)
  assert.equal(layout.candles[1].wickHeight, 300)
  assert.equal(layout.candles[1].up, false)
  assert.equal(layout.candles[2].bodyHeight, 3)
  assert.deepEqual(layout.grid.map((line) => line.value), [100, 75, 50, 25, 0])
})

test('radar geometry preserves four dimensions and never plots nonfinite or out-of-range coordinates', () => {
  const geometry = radarGeometry({ career: 100, wealth: 0, relationship: 150, health: NaN }, 300, 230)
  assert.equal(geometry.rings.length, 4)
  assert.deepEqual(geometry.axes.map((axis) => axis.label), ['事业', '财运', '感情', '健康'])
  assert.deepEqual(geometry.axes.map((axis) => axis.value), [100, 0, 100, 50])
  assert.deepEqual(geometry.values[1], geometry.center)
  assert.ok(geometry.values.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 300 && point.y >= 0 && point.y <= 230))
  const commands = []
  const context = new Proxy({}, { get: (_, name) => (...args) => commands.push([name, ...args]) })
  drawRadar(context, {}, 300, 230)
  assert.equal(commands.at(-1)[0], 'draw')
  assert.equal(commands.filter((command) => command[0] === 'fillText').length, 4)
})

test('report formatting renders basic Markdown while treating HTML and remote-image syntax as text', () => {
  const nodes = reportNodes('## 年度报告\n- **事业**：慢慢来\n> 一句寄语\n<script src="https://bad.example"></script>\n![图](https://bad.example/track.png)')
  assert.equal(nodes[0].children[0].text, '年度报告')
  assert.equal(nodes[1].children.find((child) => child.name === 'strong').children[0].text, '事业')
  assert.equal(nodes[3].children[0].type, 'text')
  assert.match(nodes[3].children[0].text, /<script/)
  assert.ok(!JSON.stringify(nodes).includes('"name":"img"'))
  assert.ok(!JSON.stringify(nodes).includes('"name":"script"'))
})

test('year picker ignores an older response arriving after a newer selection', async () => {
  const pending = new Map()
  const view = page('fortune', {
    getYearly: (year) => new Promise((resolve) => pending.set(year, resolve)),
    getFeatureCache: async (task, { year }) => ({ text: `report ${year}` }),
  })
  view.data.year = 2026
  const older = view.loadYear()
  view.data.year = 2027
  const newer = view.loadYear()
  pending.get(2027)({ yearly: { year: 2027, mutagen: ['A', 'B', 'C', 'D'], decadal: { mutagen: [] } }, quota: { remaining: 20 } })
  await newer
  pending.get(2026)({ yearly: { year: 2026, mutagen: [], decadal: {} }, quota: { remaining: 20 } })
  await older
  assert.equal(view.data.yearly.year, 2027)
  assert.equal(view.data.report, 'report 2027')
  assert.equal(view.data.loadingYear, false)
})

test('opening natal chart restores its local report without consuming an AI request', async () => {
  const branches = ['巳', '午', '未', '申', '辰', '酉', '卯', '戌', '寅', '丑', '子', '亥']
  const palaces = branches.map((branch, index) => ({ name: index === 0 ? '命宫' : `宫${index}`, stemBranch: `甲${branch}` }))
  const view = page('chart', {
    getState: async () => ({ profile: { year: 2002 }, chartSummary: { palaces }, quota: { remaining: 18 } }),
    getFeatureCache: async (task) => { assert.equal(task, 'natal'); return { text: 'local natal report' } },
    analyze: () => { throw new Error('viewing a cache must not generate') },
  })
  await view.loadState()
  assert.equal(view.data.report, 'local natal report')
  assert.equal(new Set(view.data.palaces.map((palace) => palace.position)).size, 12)
  assert.equal(view.data.selected.name, '命宫')
  assert.equal(view.data.remaining, 18)
})

test('K-line opens cached AI points and retrieves single-year text by both year and age', async () => {
  const cacheCalls = []
  const values = points()
  const view = page('kline', {
    getState: async () => ({ profile: { year: 2002 }, quota: { remaining: 16 } }),
    getFeatureCache: async (task, options) => {
      cacheCalls.push({ task, options })
      return task === 'kline' ? { points: values, quota: { remaining: 20 } } : { text: `${options.year} detail` }
    },
    getLifetime: () => { throw new Error('cached AI points should be reused') },
  })
  await view.loadState()
  assert.equal(view.data.sourceLabel, 'AI 推演')
  assert.equal(view.data.points.length, 100)
  assert.equal(view.data.remaining, 16)
  assert.equal(view.data.yearReport, `${view.data.selected.year} detail`)
  assert.deepEqual(cacheCalls.at(-1), { task: 'klineYear', options: { year: view.data.selected.year, age: view.data.selected.age } })
  await view.selectIndex(99)
  assert.equal(view.data.selected.age, 100)
  assert.equal(view.data.scrollTarget, 'candle-99')
})

test('failed AI regeneration keeps an existing report visible and presents a retryable error', async () => {
  const view = page('chart', { analyze: async () => { throw new Error('model unavailable') } })
  view.data.report = 'previous completed report'
  await view.analyze()
  assert.equal(view.data.report, 'previous completed report')
  assert.equal(view.data.analyzing, false)
  assert.equal(view.data.error, 'model unavailable')
})

test('all feature pages discard state loads after unload without another UI update', async () => {
  for (const name of ['chart', 'fortune', 'kline']) {
    const pending = deferred()
    const view = page(name, { getState: () => pending.promise })
    const loading = view.loadState()
    view.onUnload()
    let lateWrites = 0
    view.setData = () => { lateWrites += 1 }
    pending.resolve({ profile: { year: 2002 }, chartSummary: { palaces: [] }, quota: { remaining: 20 } })
    await loading
    assert.equal(lateWrites, 0, `${name} must not render after unload`)
  }
})

test('successful and failed AI completions never render an unloaded feature page', async () => {
  for (const [name, method] of [['chart', 'analyze'], ['fortune', 'analyze'], ['kline', 'analyzeLifetime'], ['kline', 'analyzeYear']]) {
    for (const fails of [false, true]) {
      const pending = deferred()
      const view = page(name, { analyze: () => pending.promise })
      view.data.yearly = { year: 2026 }
      view.data.selected = points()[24]
      const analyzing = view[method]()
      view.onUnload()
      let lateWrites = 0
      view.setData = () => { lateWrites += 1 }
      if (fails) pending.reject(new Error('late model failure'))
      else pending.resolve({ text: 'late report', points: points(), quota: { remaining: 19 } })
      await analyzing
      assert.equal(lateWrites, 0, `${name}.${method} must ignore ${fails ? 'failure' : 'success'} after unload`)
    }
  }
})

test('radar callbacks are page-scoped and cannot draw into a later instance of the same page', () => {
  const callbacks = []
  const drawings = []
  let expectedPage
  const wx = {
    nextTick: (callback) => callback(),
    createSelectorQuery() {
      return {
        in(scope) { assert.equal(scope, expectedPage); return this },
        select(id) { assert.equal(id, '#score-radar'); return this },
        boundingClientRect(callback) { callbacks.push(callback); return this },
        exec() {},
      }
    },
    createCanvasContext(id, scope) {
      assert.equal(id, 'score-radar')
      assert.equal(scope, expectedPage)
      drawings.push(scope)
      return new Proxy({}, { get: () => () => {} })
    },
  }
  const old = page('kline', {}, wx)
  expectedPage = old
  old.visible = true
  old.data.selected = points()[0]
  old.drawRadar()
  old.onUnload()
  const fresh = page('kline', {}, wx)
  expectedPage = fresh
  fresh.visible = true
  fresh.data.selected = points()[24]
  fresh.drawRadar()
  callbacks[0]({ width: 300, height: 230 })
  callbacks[1]({ width: 300, height: 230 })
  assert.deepEqual(drawings, [fresh])
})

test('unloading while the selected-year cache is loading invalidates its late report', async () => {
  const cached = deferred()
  const view = page('kline', { getFeatureCache: () => cached.promise })
  view.data.points = points()
  const selecting = view.selectIndex(24)
  view.onUnload()
  let lateWrites = 0
  view.setData = () => { lateWrites += 1 }
  cached.resolve({ text: 'old year report' })
  await selecting
  assert.equal(lateWrites, 0)
  assert.equal(view.visible, false)
})

test('year sequence and lunar nominal age stay distinct in K-line and yearly display labels', async () => {
  // Before-spring-festival birth: the 23rd calendar year is lunar nominal age 24.
  const values = points().map((point) => ({ ...point, nominalAge: point.age + 1 }))
  const kline = page('kline', { getFeatureCache: async () => null })
  kline.data.selected = { year: 2024 }
  await kline.applyPoints(values)
  assert.equal(kline.data.selected.age, 23)
  assert.equal(kline.data.selected.ageLabel, '虚岁24岁')
  assert.equal(kline.data.yearLabels[22], '2024年 · 第23年 · 虚岁24岁')
  const fortune = page('fortune', {
    getState: async () => ({ profile: { year: 2002 }, quota: { remaining: 20 } }),
    getYearly: async () => ({ yearly: { year: 2024, age: 23, nominalAge: 24, decadal: { range: [24, 33] } }, quota: { remaining: 20 } }),
    getFeatureCache: async () => null,
  })
  fortune.data.year = 2024
  await fortune.loadState()
  assert.equal(fortune.data.ageLabel, '虚岁24岁')
  assert.equal(fortune.data.yearLabels[22], '2024年 · 出生第23年')
  await kline.applyPoints(points())
  assert.equal(kline.data.selected.ageLabel, '第23年', 'an older local cache must not relabel year sequence as nominal age')
})
