import { useEffect, useState } from 'react'
import { ViolinIcon } from '@/components/icons/ViolinIcon'

const CONTRAST_QUOTES = [
  '你好，少妇没你年轻，少女没你有钱',
  '别问姐爱谁，姐连明天穿什么都没决定',
  '心动归心动，排队还是要排队',
  '消息可以回，态度看我今天漂不漂亮',
  '感情可以慢慢谈，漂亮必须按时',
  '你很好，下一个也会这么说',
  '低山臭水遇知音，今天先算你一个',
  '从从容容游刃有余，回不回你看我心情',
  '真心可以给，保质期看天气',
  '可以心动，不能影响我睡美容觉',
  '姐不养鱼，姐只是认识的人比较会游泳',
  '说我难追？姐只是没开免密支付',
]

const LAST_QUOTE_KEY = 'lei-last-contrast-quote'

function pickContrastQuote(): string {
  try {
    const lastIndex = Number(window.localStorage.getItem(LAST_QUOTE_KEY))
    const hasPrevious = Number.isInteger(lastIndex)
      && lastIndex >= 0
      && lastIndex < CONTRAST_QUOTES.length
    const randomRange = hasPrevious ? CONTRAST_QUOTES.length - 1 : CONTRAST_QUOTES.length
    const randomIndex = Math.floor(Math.random() * randomRange)
    const nextIndex = hasPrevious && randomIndex >= lastIndex ? randomIndex + 1 : randomIndex
    window.localStorage.setItem(LAST_QUOTE_KEY, String(nextIndex))
    return CONTRAST_QUOTES[nextIndex]
  } catch {
    return CONTRAST_QUOTES[Math.floor(Math.random() * CONTRAST_QUOTES.length)]
  }
}

interface WelcomeLeiLeiProps {
  onEnter: () => void
}

export function WelcomeLeiLei({ onEnter }: WelcomeLeiLeiProps) {
  const [quote] = useState(pickContrastQuote)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') onEnter()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onEnter])

  return (
    <div className="lei-welcome" role="dialog" aria-modal="true" aria-labelledby="lei-welcome-title">
      <div className="lei-welcome-glow lei-welcome-glow-one" />
      <div className="lei-welcome-glow lei-welcome-glow-two" />

      <span className="lei-floating-note lei-note-one" aria-hidden="true">♪</span>
      <span className="lei-floating-note lei-note-two" aria-hidden="true">♫</span>
      <span className="lei-floating-heart lei-heart-one" aria-hidden="true">♡</span>
      <span className="lei-floating-heart lei-heart-two" aria-hidden="true">♥</span>

      <div className="lei-welcome-card">
        <p className="lei-kicker">FOR LEI · 0819</p>

        <div className="lei-violin-stage" aria-hidden="true">
          <span className="lei-spark lei-spark-one">✦</span>
          <span className="lei-spark lei-spark-two">✧</span>
          <ViolinIcon className="lei-welcome-violin" />
        </div>

        <h1 id="lei-welcome-title">欢迎蕾蕾大王</h1>
        <p className="lei-quote-label">今日反差语录</p>
        <p className="lei-welcome-copy">
          “{quote}”
        </p>

        <button type="button" className="lei-enter-button" onClick={onEnter}>
          <span>开始测一测</span>
          <span aria-hidden="true">✦</span>
        </button>

        <p className="lei-welcome-signature">LEI LEI · 0819 ♪</p>
      </div>
    </div>
  )
}
