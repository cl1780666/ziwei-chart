const QUOTES = [
  '你好，少妇没你年轻，少女没你有钱',
  '别问姐爱谁，姐连明天穿什么都没决定',
  '心动归心动，排队还是要排队',
  '消息可以回，态度看我今天漂不漂亮',
  '感情可以慢慢谈，漂亮必须按时',
  '你很好，下一个也会这么说',
  '皖南的路会拐弯，姐的心情也会',
  '从从容容游刃有余，回不回你看我心情',
  '真心可以给，保质期看天气',
  '可以心动，不能影响我睡美容觉',
  '姐不养鱼，姐只是认识的人比较会游泳',
  '说我难追？姐只是没开免密支付',
  '白墙黛瓦很安静，姐不一定',
  '小提琴有四根弦，姐的耐心看缘分',
]

const LAST_QUOTE_KEY = 'lei-last-contrast-quote'

function pickQuote() {
  const lastIndex = Number(wx.getStorageSync(LAST_QUOTE_KEY))
  const hasPrevious = Number.isInteger(lastIndex) && lastIndex >= 0 && lastIndex < QUOTES.length
  const range = hasPrevious ? QUOTES.length - 1 : QUOTES.length
  const randomIndex = Math.floor(Math.random() * range)
  const nextIndex = hasPrevious && randomIndex >= lastIndex ? randomIndex + 1 : randomIndex
  wx.setStorageSync(LAST_QUOTE_KEY, nextIndex)
  return QUOTES[nextIndex]
}

module.exports = { pickQuote }
