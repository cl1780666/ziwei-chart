const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const vm = require('node:vm')

const profile = { year: 2002, month: 8, day: 19, hour: 0, gender: 'female', birthplace: '安徽宣城', trueSolarEnabled: true }
const partner = { year: 2001, month: 4, day: 2, hour: 16, gender: 'male', birthplace: '合肥', trueSolarEnabled: false }
const chart = { fiveElementsClass: '木三局', palaces: [{ name: '命宫', majorStarsText: '紫微' }, { name: '夫妻', majorStarsText: '天府' }], timeCorrection: {} }

function createPage(api) {
  let definition
  vm.runInNewContext(readFileSync(require.resolve('../miniprogram/pages/match/match'), 'utf8'), {
    require() { return api },
    Page(value) { definition = value },
    wx: { showToast() {}, setClipboardData() {} },
    setInterval() { return 1 }, clearInterval() {},
  })
  const page = { ...definition, data: structuredClone(definition.data) }
  page.setData = (patch) => {
    for (const [key, value] of Object.entries(patch)) {
      const match = key.match(/^people\[(\d)\]\.(.+)$/)
      if (match) page.data.people[Number(match[1])][match[2]] = value
      else page.data[key] = value
    }
  }
  return page
}

test('match loads only device profiles and a partner-keyed local report cache', async () => {
  let cacheOptions
  const page = createPage({
    async getState() { return { profile, partner, chartSummary: chart, quota: { remaining: 18 } } },
    async getFeatureCache(task, options) { assert.equal(task, 'match'); cacheOptions = options; return { text: '## 两人合参\n\n旧报告' } },
  })
  await page.onLoad()
  assert.equal(page.data.people[0].date, '2002-08-19')
  assert.equal(page.data.people[1].date, '2001-04-02')
  assert.equal(page.data.cached, true)
  assert.equal(page.data.remaining, 18)
  assert.equal(JSON.stringify(cacheOptions.partner), JSON.stringify(partner))
  assert.equal(page.data.summaries[0].spouse, '天府')
})

test('match previews partner without replacing primary and sends one independent analysis', async () => {
  const operations = []
  const page = createPage({
    async getState() { return { profile, partner, chartSummary: chart, quota: { remaining: 18 } } },
    async getFeatureCache() { return null },
    async saveProfile(value) { operations.push(['primary', value]); return { profile: value, chartSummary: chart } },
    async previewProfile(value) { operations.push(['preview', value]); return { profile: value, chartSummary: chart, quota: { remaining: 18 } } },
    async saveMatchPartner(value) { operations.push(['partner', value]); return value },
    async analyze(task, options) { operations.push([task, options]); return { text: '## 相处建议\n\n认真沟通。', quota: { remaining: 17 } } },
  })
  await page.onLoad()
  await page.analyze()
  assert.equal(operations.length, 4)
  assert.equal(operations[0][1].hour, 0)
  assert.equal(operations[0][1].gender, 'female')
  assert.equal(operations[1][0], 'preview')
  assert.equal(operations[1][1].gender, 'male')
  assert.equal(operations[3][0], 'match')
  assert.equal(operations[3][1].partner.birthplace, '合肥')
  assert.equal(page.data.summaries.length, 2)
  assert.equal(page.data.remaining, 17)
  assert.match(page.data.report, /认真沟通/)
  assert.equal(page.data.busy, false)
})

test('editing either person hides the previous report, while failed analysis unlocks retry', async () => {
  const page = createPage({ async analyze() { throw new Error('服务暂时不可用，本次额度已退回') } })
  page.data.report = '旧报告'
  page.updatePerson({ currentTarget: { dataset: { index: 1 } } }, 'birthplace', '宣城')
  assert.equal(page.data.report, '')
  assert.equal(page.data.people[1].birthplace, '宣城')
  page.prepareCharts = async () => partner
  // Failure is surfaced without falling back to a previous conversation/report.
  await page.analyze()
  assert.equal(page.data.busy, false)
  assert.equal(page.data.analyzing, false)
  assert.ok(page.data.error)
  assert.equal(page.data.report, '')
})

test('a destroyed match page ignores late local-state reads', async () => {
  let finishRead
  const waiting = new Promise((resolve) => { finishRead = resolve })
  const page = createPage({ async getState() { return waiting } })
  const loading = page.onLoad()
  page.onUnload()
  finishRead({ profile, partner, chartSummary: chart, quota: { remaining: 18 } })
  await loading
  assert.equal(page.data.people[1].date, '2002-08-19')
  assert.equal(page.data.remaining, 20)
  assert.equal(page.data.summaries.length, 0)
})

test('leaving during free chart preparation does not start a later paid analysis', async () => {
  let finishSave
  const waiting = new Promise((resolve) => { finishSave = resolve })
  let furtherCalls = 0
  const page = createPage({
    async saveProfile() { return waiting },
    async previewProfile() { furtherCalls += 1 },
    async analyze() { furtherCalls += 1 },
  })
  const analyzing = page.analyze()
  page.onUnload()
  finishSave({ profile, chartSummary: chart })
  await analyzing
  assert.equal(furtherCalls, 0)
  assert.equal(page.data.report, '')
})
