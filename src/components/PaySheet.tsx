import { useEffect, useState } from 'react'
import { setPayPassword } from '../store'
import type { WalletState } from '../types'
import { paySource, paySources } from '../utils/pay'
import { formatMoney } from '../utils/qr'

/** 发送/支付页面里的一行：左侧「支付方式」，右侧当前选中项 + 箭头 */
export function PayMethodRow({ w, value, onOpen }: { w: WalletState; value: string; onOpen: () => void }) {
  const cur = paySource(w, value) ?? { key: 'balance', label: '零钱余额', desc: '', amount: 0 }
  const tail = cur.key !== 'balance' ? w.bankCards.find((c) => c.id === cur.key)?.cardTail : ''
  return (
    <button className="row pay-method-row" onClick={onOpen}>
      <div className="row-main">
        <span className="row-title">支付方式</span>
      </div>
      <span className="pay-method-name">{cur.key === 'balance' ? '零钱余额' : cur.label}</span>
      {tail && <span className="pay-method-tail">尾号 {tail}</span>}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="m9 5 7 7-7 7" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/** 支付方式选择弹层 */
export function PayPicker({ open, onClose, w, value, onSelect }: { open: boolean; onClose: () => void; w: WalletState; value: string; onSelect: (key: string) => void }) {
  if (!open) return null
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">选择支付方式</div>
        <div className="payp-pick-list">
          {paySources(w).map((s) => (
            <button
              key={s.key}
              className={`payp-pick-row ${s.key === value ? 'on' : ''}`}
              onClick={() => {
                onSelect(s.key)
                onClose()
              }}
            >
              <span className={`payp-pick-ico ${s.key === 'balance' ? 'bal' : 'bank'}`}>{s.key === 'balance' ? '¥' : '卡'}</span>
              <span className="payp-pick-info">
                <span className="payp-pick-name">{s.key === 'balance' ? '零钱余额' : s.label}</span>
                <span className="payp-pick-desc">{s.desc}</span>
              </span>
              <span className={`payp-pick-radio ${s.key === value ? 'on' : ''}`} />
            </button>
          ))}
        </div>
        <div className="payp-pick-hint">默认使用零钱余额支付</div>
        <div className="modal-buttons">
          <button className="modal-btn" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

/** 微信支付同款数字键盘（1-9 / 空 / 0 / 退格） */
function Keypad({ onDigit, onDelete }: { onDigit: (d: string) => void; onDelete: () => void }) {
  const keys: (string | number)[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'blank', 0, 'del']
  return (
    <div className="keypad">
      {keys.map((k) =>
        k === 'del' ? (
          <button key="del" type="button" className="keypad-key del" aria-label="删除" onClick={onDelete}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M7.5 5.5 5.6 5.5 3 8l3.3 3.3v5.4a1 1 0 0 0 1 1h8.4a1 1 0 0 0 1-1V6.7a1 1 0 0 0-1-1h-1.2"
                stroke="#3c3c43"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M4 8h14M13.5 9.8l3.4 3.4M16.9 9.8l-3.4 3.4" stroke="#3c3c43" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        ) : k === 'blank' ? (
          <span key="blank" className="keypad-key blank" />
        ) : (
          <button key={k} type="button" className="keypad-key" onClick={() => onDigit(String(k))}>
            {k}
          </button>
        )
      )}
    </div>
  )
}

/** 6 位密码点阵（不含键盘） */
export function SixDots({ value }: { value: string }) {
  return (
    <div className="sixpwd-dots">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className={`sixpwd-dot ${i < value.length ? 'filled' : ''}`} />
      ))}
    </div>
  )
}

/** 设置页用的整组输入：点阵 + 自绘键盘（不使用系统键盘） */
export function PwdDots({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="sixpwd">
      <SixDots value={value} />
      <Keypad
        onDigit={(d) => onChange((value + d).replace(/\D/g, '').slice(0, 6))}
        onDelete={() => onChange(value.slice(0, -1))}
      />
    </div>
  )
}

/**
 * 支付时的密码验证底部面板（像手机键盘一样从底部弹出）。
 * onVerify(pwd) 由调用方核对支付密码并执行支付，返回错误文案或 null（成功后需自行收起面板）。
 */
export function PayPwdPanel({
  open,
  onClose,
  onVerify,
  amountDesc,
}: {
  open: boolean
  onClose: () => void
  onVerify: (pwd: string) => string | null
  amountDesc?: string
}) {
  const [mode, setMode] = useState<'verify' | 'reset'>('verify')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [rstep, setRstep] = useState(1)
  const [rpwd, setRpwd] = useState('')

  useEffect(() => {
    if (open) {
      setMode('verify')
      setPwd('')
      setErr('')
      setRstep(1)
      setRpwd('')
    }
  }, [open])

  const commit = (v: string) => {
    if (v.length < 6) return
    const e = onVerify(v)
    if (e) {
      setErr(e)
      setPwd('')
    } else {
      setPwd('')
      onClose()
    }
  }

  const digit = (d: string) => {
    if (mode === 'verify') {
      const v = (pwd + d).slice(0, 6)
      setPwd(v)
      setErr('')
      if (v.length === 6) commit(v)
    } else if (rstep === 1) {
      const v = (rpwd + d).slice(0, 6)
      setRpwd(v)
      setErr('')
      if (v.length === 6) setRstep(2)
    } else {
      const v = (pwd + d).slice(0, 6)
      setPwd(v)
      setErr('')
      if (v.length === 6) {
        if (v !== rpwd) {
          setErr('两次输入的密码不一致，请重新输入')
          setPwd('')
          setRstep(1)
          setRpwd('')
        } else {
          setPayPassword(v)
          setMode('verify')
          setPwd('')
          setRpwd('')
        }
      }
    }
  }

  const backspace = () => {
    setErr('')
    if (mode === 'verify') setPwd((p) => p.slice(0, -1))
    else if (rstep === 1) setRpwd((r) => r.slice(0, -1))
  }

  if (!open) return null
  return (
    <div className="pay-keyboard-mask" onClick={onClose}>
      <div className="pay-keyboard-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="pay-keyboard-bar" />
        <div className="pay-keyboard-top">
          <span className="pay-keyboard-title">{mode === 'verify' ? '请输入支付密码' : rstep === 1 ? '设置新的支付密码' : '请再次输入以确认'}</span>
          <button
            className="pay-keyboard-act"
            onClick={() => {
              if (mode === 'verify') onClose()
              else if (rstep === 1) setMode('verify')
              else setRstep(1)
            }}
          >
            {mode === 'verify' ? '取消' : '返回'}
          </button>
        </div>
        {mode === 'verify' ? (
          <>
            {amountDesc && <div className="sixpwd-amount">{amountDesc}</div>}
            <div className="sixpwd-area">
              <SixDots value={pwd} />
            </div>
            {err ? (
              <div className="sixpwd-err">{err}</div>
            ) : (
              <button
                className="sixpwd-forgot"
                onClick={() => {
                  setMode('reset')
                  setErr('')
                  setRstep(1)
                  setRpwd('')
                }}
              >
                忘记支付密码？
              </button>
            )}
          </>
        ) : rstep === 1 ? (
          <div className="sixpwd-area">
            <SixDots value={rpwd} />
            {err && <div className="sixpwd-err">{err}</div>}
          </div>
        ) : (
          <div className="sixpwd-area">
            <SixDots value={pwd} />
            {err && <div className="sixpwd-err">{err}</div>}
          </div>
        )}
        <div className="pay-keyboard-pad">
          <Keypad onDigit={digit} onDelete={backspace} />
        </div>
      </div>
    </div>
  )
}

/** 支付成功后再展示支付方式标签时用 */
export function fmtBalance(w: WalletState) {
  return formatMoney(w.balance)
}
