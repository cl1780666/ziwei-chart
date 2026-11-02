const assert = require('node:assert/strict')
const test = require('node:test')
const vm = require('node:vm')
const { readFileSync } = require('node:fs')
const card = require('../miniprogram/utils/share-card')

const profile = { year: 2002, month: 8, day: 19, hour: 12, gender: 'female', birthplace: '安徽宣城' }
const chartSummary = {
  fiveElementsClass: '木三局', solarDate: '2002-08-19',
  palaces: [{ name: '命宫', majorStarsText: '紫微、天府' }],
}

test('share cards default to chart traits without copying birth details', () => {
  const data = card.cardData({ profile, chartSummary, quote: '自己落笔。' })
  assert.equal(data.stars, '紫微、天府')
  assert.equal(data.elements, '木三局')
  assert.equal(data.birthLine, undefined)
  assert.equal(data.placeLine, undefined)
  assert.equal(JSON.stringify(data).includes('2002'), false)
  assert.equal(JSON.stringify(data).includes('安徽宣城'), false)
  const optedIn = card.cardData({ profile, chartSummary, includePrivate: true })
  assert.match(optedIn.birthLine, /2002年8月19日/)
  assert.equal(optedIn.placeLine, '安徽宣城')
})

test('quotes come from the natal report quote section or an editable fallback', () => {
  assert.equal(card.extractQuote('## 生辰\n2002年8月19日\n\n### 陆·命格金句\n> “温柔有锋芒，落笔有自己的方向。”\n\n### 建议\n其他内容'), '温柔有锋芒，落笔有自己的方向。')
  assert.equal(card.extractQuote('## 解读\n这里有生日，但没有金句章节。'), '')
  assert.equal(card.extractQuote('**六、命格金句**\n> “温柔有自己的方向。”'), '温柔有自己的方向。')
  assert.equal(card.cardData({ profile, chartSummary }).quote, card.DEFAULT_QUOTE)
  assert.equal(card.cardData({ profile, chartSummary, quote: '<b>自己写的</b>**话**' }).quote, '自己写的话')
})

test('Unicode text wraps within card bounds and visibly truncates overflow', () => {
  const measure = (text) => Array.from(text).length * 22
  const lines = card.wrapText('山水🎻'.repeat(50), card.LAYOUT.quote.width, measure, card.LAYOUT.quote.maxLines)
  assert.equal(lines.length, 5)
  assert.ok(lines.every((line) => measure(line) <= card.LAYOUT.quote.width))
  assert.ok(lines.at(-1).endsWith('…'))
  assert.equal(lines.join('').includes('\ud83c…'), false)
  assert.ok(card.LAYOUT.quote.y + (lines.length - 1) * card.LAYOUT.quote.lineHeight < 413)
})

test('canvas drawing keeps text in the portrait geometry with opted-in private details', () => {
  const text = []
  const ctx = {
    fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    measureText(value) { return { width: Array.from(value).length * 22 } },
    fillText(value, x, y) { text.push({ value, x, y }) },
  }
  card.drawCard(ctx, card.cardData({ profile, chartSummary, quote: '山水之间，自己落笔。'.repeat(8), includePrivate: true }), null)
  assert.ok(text.every(({ x, y }) => x > 0 && x < card.WIDTH && y > 0 && y < card.HEIGHT))
  assert.equal(text.filter(({ y }) => y >= card.LAYOUT.quote.y && y <= 372).length, 5)
  assert.ok(text.some(({ value }) => value.includes('2002年8月19日')))
})

test('native share sends only the generic entrance and no local content', () => {
  let definition
  vm.runInNewContext(readFileSync(require.resolve('../miniprogram/pages/share/share'), 'utf8'), {
    require(name) { return name === '../../utils/share-card' ? card : {} },
    Page(value) { definition = value },
  })
  const result = definition.onShareAppMessage()
  assert.equal(result.path, '/pages/home/home')
  assert.equal(result.path.includes('?'), false)
  assert.equal(result.imageUrl, '/assets/wannan-violin-poster.jpg')
  assert.equal(JSON.stringify(result).includes('2002'), false)
})

test('PNG generation waits until the native canvas page has rendered', async () => {
  let definition
  vm.runInNewContext(readFileSync(require.resolve('../miniprogram/pages/share/share'), 'utf8'), {
    require(name) {
      return name === '../../utils/share-card' ? card : {
        async getState() { return { profile, chartSummary } },
        async getFeatureCache() { return null },
      }
    },
    Page(value) { definition = value },
  })
  const page = { ...definition, data: structuredClone(definition.data) }
  page.setData = (patch) => Object.assign(page.data, patch)
  let renders = 0
  page.refreshImage = () => { renders += 1 }
  await page.onLoad()
  assert.equal(renders, 0)
  page.onReady()
  assert.equal(renders, 1)
  assert.equal(page.data.hasChart, true)
  assert.equal(page.data.loading, false)
})

test('a destroyed share page cannot retain a late profile or trigger canvas work', async () => {
  let definition
  let finishRead
  const waiting = new Promise((resolve) => { finishRead = resolve })
  vm.runInNewContext(readFileSync(require.resolve('../miniprogram/pages/share/share'), 'utf8'), {
    require(name) { return name === '../../utils/share-card' ? card : { async getState() { return waiting } } },
    Page(value) { definition = value }, clearTimeout() {},
  })
  const page = { ...definition, data: structuredClone(definition.data) }
  page.setData = (patch) => Object.assign(page.data, patch)
  const loading = page.onLoad()
  page.onUnload()
  finishRead({ profile, chartSummary })
  await loading
  assert.equal(page._profile, null)
  assert.equal(page._chart, null)
  assert.equal(page.data.hasChart, false)
})

test('album denial offers settings only after an explicit user confirmation', async () => {
  let definition
  let modal
  let settingsOpened = 0
  const wx = {
    saveImageToPhotosAlbum(options) { options.fail({ errMsg: 'saveImageToPhotosAlbum:fail auth deny' }) },
    showModal(options) { modal = options },
    openSetting() { settingsOpened += 1 },
  }
  vm.runInNewContext(readFileSync(require.resolve('../miniprogram/pages/share/share'), 'utf8'), {
    require(name) { return name === '../../utils/share-card' ? card : {} },
    Page(value) { definition = value }, wx,
  })
  const page = { ...definition, data: { ...definition.data, imagePath: '/tmp/local-card.png' } }
  page.setData = (patch) => Object.assign(page.data, patch)
  await page.saveImage()
  assert.equal(page.data.saving, false)
  assert.equal(modal.title, '需要相册权限')
  assert.equal(settingsOpened, 0)
  modal.success({ confirm: false })
  assert.equal(settingsOpened, 0)
  modal.success({ confirm: true })
  assert.equal(settingsOpened, 1)
  page._unloaded = true
  modal.success({ confirm: true })
  assert.equal(settingsOpened, 1)
})
