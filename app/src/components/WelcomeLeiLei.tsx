import { useEffect } from 'react'
import { ViolinIcon } from '@/components/icons/ViolinIcon'

interface WelcomeLeiLeiProps {
  onEnter: () => void
}

export function WelcomeLeiLei({ onEnter }: WelcomeLeiLeiProps) {
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
        <p className="lei-welcome-copy">
          你好，少妇没你年轻，少女没你有钱
        </p>

        <button type="button" className="lei-enter-button" onClick={onEnter}>
          <span>打开蕾蕾的星盘</span>
          <span aria-hidden="true">✦</span>
        </button>

        <p className="lei-welcome-signature">LEI LEI · 0819 ♪</p>
      </div>
    </div>
  )
}
