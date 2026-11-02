const WIDTH = 360
const HEIGHT = 560
const ART_PATH = '/assets/wannan-violin-poster.jpg'
const DEFAULT_QUOTE = '把日子过成自己喜欢的模样。'
const LAYOUT = {
  width: WIDTH, height: HEIGHT, inset: 30,
  art: { x: 0, y: 0, width: WIDTH, height: 164 },
  quote: { x: 42, y: 252, width: 276, lineHeight: 30, maxLines: 5 },
}

function plain(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/[*_`#]/g, '').trim()
}

function extractQuote(report) {
  const lines = String(report || '').split('\n')
  const index = lines.findIndex((line) => /命格金句|分享金句|专属金句/.test(line) && plain(line).length <= 60)
  if (index < 0) return ''
  const inline = lines[index].split(/命格金句|分享金句|专属金句/)[1].replace(/^[\s*#：:）)·、]+/, '')
  const section = lines.slice(index + 1)
  const end = section.findIndex((line) => /^\s*(?:#{1,6}\s|---)/.test(line))
  const content = [inline, ...section.slice(0, end < 0 ? section.length : end)].join('\n').trim()
  const quoted = content.match(/[“「"]([^”」"\n]{4,120})[”」"]/) || content.match(/^>\s*(.+)$/m)
  const result = plain(quoted ? quoted[1] : content.split('\n').find((line) => line.trim()) || '')
  return Array.from(result).slice(0, 100).join('')
}

function cardData({ profile, chartSummary, quote, report, includePrivate = false }) {
  const chart = chartSummary || {}
  const life = (chart.palaces || []).find((palace) => palace.name === '命宫')
  const stars = life && (life.majorStarsText || (life.majorStars || []).join('、'))
  const result = {
    title: '弦上星盘',
    quote: Array.from(plain(quote) || extractQuote(report) || DEFAULT_QUOTE).slice(0, 100).join(''),
    stars: plain(stars || '无主星 · 借对宫参看'),
    elements: plain(chart.fiveElementsClass || ''),
  }
  if (includePrivate && profile) {
    result.birthLine = `${profile.year}年${profile.month}月${profile.day}日 · ${String(profile.hour).padStart(2, '0')}:00 · ${profile.gender === 'female' ? '女' : '男'}`
    result.placeLine = plain(profile.birthplace || '未填写出生地').slice(0, 40)
  }
  return result
}

function wrapText(text, maxWidth, measure, maxLines) {
  const lines = []
  let line = ''
  for (const char of Array.from(String(text || ''))) {
    if (char === '\n') {
      lines.push(line)
      line = ''
    } else if (line && measure(line + char) > maxWidth) {
      lines.push(line)
      line = char
    } else {
      line += char
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const visible = lines.slice(0, maxLines)
  let last = Array.from(visible[maxLines - 1])
  while (last.length && measure(last.join('') + '…') > maxWidth) last.pop()
  visible[maxLines - 1] = last.join('') + '…'
  return visible
}

function fittedText(ctx, text, x, y, width, fontSize, color, align = 'center') {
  ctx.font = `${fontSize}px sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = align
  const lines = wrapText(text, width, (value) => ctx.measureText(value).width, 1)
  ctx.fillText(lines[0] || '', x, y)
}

function drawCard(ctx, data, image) {
  ctx.fillStyle = '#f8f1e6'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  if (image) {
    const scale = Math.max(WIDTH / image.width, 164 / image.height)
    const sw = WIDTH / scale
    const sh = 164 / scale
    ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, 0, 0, WIDTH, 164)
    const shade = ctx.createLinearGradient(0, 110, 0, 180)
    shade.addColorStop(0, 'rgba(248,241,230,0)')
    shade.addColorStop(1, '#f8f1e6')
    ctx.fillStyle = shade
    ctx.fillRect(0, 110, WIDTH, 70)
  }
  ctx.strokeStyle = 'rgba(89,100,87,.25)'
  ctx.lineWidth = 1
  ctx.strokeRect(14, 14, WIDTH - 28, HEIGHT - 28)
  fittedText(ctx, '皖南 · 一弦一星河', 180, 187, 280, 10, '#7c8377')
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#3d4b41'
  ctx.font = 'bold 28px serif'
  ctx.fillText(data.title, 180, 222)
  ctx.fillStyle = '#7f3036'
  ctx.fillRect(169, 234, 22, 2)

  ctx.font = '22px serif'
  ctx.fillStyle = '#4b4e43'
  const lines = wrapText(data.quote, LAYOUT.quote.width, (value) => ctx.measureText(value).width, LAYOUT.quote.maxLines)
  const top = LAYOUT.quote.y + (LAYOUT.quote.maxLines - lines.length) * LAYOUT.quote.lineHeight / 2
  lines.forEach((line, index) => ctx.fillText(line, WIDTH / 2, top + index * LAYOUT.quote.lineHeight))
  ctx.strokeStyle = 'rgba(89,100,87,.22)'
  ctx.beginPath()
  ctx.moveTo(64, 413)
  ctx.lineTo(296, 413)
  ctx.stroke()
  fittedText(ctx, `命宫 · ${data.stars}`, 180, 440, 278, 13, '#4d5d50')
  fittedText(ctx, data.elements, 180, 461, 278, 11, '#8c806e')
  if (data.birthLine) fittedText(ctx, data.birthLine, 180, 489, 278, 10, '#8c806e')
  if (data.placeLine) fittedText(ctx, data.placeLine, 180, 507, 278, 10, '#8c806e')
  fittedText(ctx, '星盘是参考，日子由自己落笔', 180, 535, 278, 10, '#9b8e7c')
}

module.exports = { WIDTH, HEIGHT, ART_PATH, DEFAULT_QUOTE, LAYOUT, extractQuote, cardData, wrapText, drawCard }
