import { useState } from 'react'
import { NavBar } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { PwdDots } from '../../components/PaySheet'
import { loadWallet, setPayPassword } from '../../store'
import { formatMoney } from '../../utils/qr'

type Op = 'none' | 'set' | 'change' | 'close' | 'reset'

const STEP_TITLES: Record<Op, string[]> = {
  none: [],
  set: ['设置支付密码', '请再次输入以确认'],
  change: ['请输入当前支付密码', '设置新的支付密码', '请再次输入以确认'],
  close: ['请输入支付密码以关闭'],
  reset: ['设置新的支付密码', '请再次输入以确认'],
}

function StepDots({ onCommit }: { onCommit: (v: string) => string | null }) {
  const [v, setV] = useState('')
  const [err, setErr] = useState('')
  return (
    <div className="pp-step-dots">
      <PwdDots
        value={v}
        onChange={(s) => {
          setV(s)
          setErr('')
          if (s.length === 6) {
            const e = onCommit(s)
            if (e) {
              setErr(e)
              setV('')
            }
          }
        }}
      />
      {err && <div className="sixpwd-err">{err}</div>}
    </div>
  )
}

export default function PayPasswordSet({ onBack }: { onBack: () => void }) {
  const [tick, setTick] = useState(0)
  const [op, setOp] = useState<Op>('none')
  const [step, setStep] = useState(0)
  const [buf, setBuf] = useState('')
  const [hint, setHint] = useState('')

  const w = (() => {
    void tick
    return loadWallet()
  })()
  const enabled = !!w.payPassword

  const flash = (t: string) => {
    setHint(t)
    window.setTimeout(() => {
      setHint('')
      setTick((x) => x + 1)
    }, 1400)
  }

  const backHome = () => {
    setOp('none')
    setStep(0)
    setBuf('')
  }

  const commit = (v: string): string | null => {
    if (op === 'set') {
      if (step === 0) {
        setBuf(v)
        setStep(1)
        return null
      }
      if (v !== buf) {
        setStep(0)
        setBuf('')
        return '两次输入的密码不一致，请重新输入'
      }
      setPayPassword(v)
      backHome()
      flash('支付密码已开启')
      return null
    }
    if (op === 'change') {
      if (step === 0) {
        if (v !== w.payPassword) return '支付密码错误，请重试'
        setStep(1)
        return null
      }
      if (step === 1) {
        setBuf(v)
        setStep(2)
        return null
      }
      if (v !== buf) {
        setStep(1)
        setBuf('')
        return '两次输入的密码不一致，请重新输入'
      }
      setPayPassword(v)
      backHome()
      flash('支付密码已修改')
      return null
    }
    if (op === 'close') {
      if (v !== w.payPassword) return '支付密码错误，请重试'
      setPayPassword(null)
      backHome()
      flash('支付密码已关闭')
      return null
    }
    if (op === 'reset') {
      if (step === 0) {
        setBuf(v)
        setStep(1)
        return null
      }
      if (v !== buf) {
        setStep(0)
        setBuf('')
        return '两次输入的密码不一致，请重新输入'
      }
      setPayPassword(v)
      backHome()
      flash('支付密码已重置')
      return null
    }
    return null
  }

  const titles: Record<string, string> = {
    set: '开启支付密码',
    change: '修改支付密码',
    close: '关闭支付密码',
    reset: '重置支付密码',
  }

  const start = (o: Op) => {
    setOp(o)
    setStep(0)
    setBuf('')
  }

  return (
    <div className="page pp-page">
      <NavBar
        title={op === 'none' ? '支付密码' : titles[op]}
        left={
          <button className="nav-btn" onClick={op === 'none' ? onBack : backHome} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        {op === 'none' ? (
          <>
            <div className={`pp-status ${enabled ? 'on' : ''}`}>
              <span className="pp-status-dot" />
              {enabled ? '支付密码已开启' : '支付密码未开启'}
              {enabled && <span className="pp-status-sub">付款时需输入 6 位密码</span>}
            </div>
            <div className="list-group">
              {!enabled && (
                <button className="row" onClick={() => start('set')}>
                  <div className="row-main">
                    <span className="row-title">开启支付密码</span>
                  </div>
                  <span className="arrow-right" />
                </button>
              )}
              {enabled && (
                <>
                  <button className="row" onClick={() => start('change')}>
                    <div className="row-main">
                      <span className="row-title">修改支付密码</span>
                    </div>
                    <span className="arrow-right" />
                  </button>
                  <button className="row" onClick={() => start('close')}>
                    <div className="row-main">
                      <span className="row-title">关闭支付密码</span>
                    </div>
                    <span className="arrow-right" />
                  </button>
                  <button className="row" onClick={() => start('reset')}>
                    <div className="row-main">
                      <span className="row-title">忘记支付密码</span>
                      <span className="row-preview">无需原密码，重新设置即可</span>
                    </div>
                    <span className="arrow-right" />
                  </button>
                </>
              )}
            </div>
            <div className="pp-intro">支付密码用于发红包、转账、亲属卡等付款操作时的身份验证，保障资金安全。默认关闭，开启后付款时需验证。</div>
            <div className="wallet-footer">
              <span className="wallet-shield">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3.5 5.5 6v5c0 4.2 2.7 7.4 6.5 9.5 3.8-2.1 6.5-5.3 6.5-9.5V6L12 3.5Z" stroke="#9aa4b2" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </span>
              微信安全支付
            </div>
          </>
        ) : (
          <div className="pp-wizard">
            <div className="pp-wizard-title">{STEP_TITLES[op][step]}</div>
            <div className="pp-wizard-balance">零钱余额 ¥{formatMoney(w.balance)}</div>
            <StepDots key={`${op}-${step}`} onCommit={commit} />
            <button className="pp-cancel" onClick={backHome}>
              取消
            </button>
          </div>
        )}
      </div>
      {hint && <div className="chat-toast">{hint}</div>}
    </div>
  )
}
