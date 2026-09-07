import { useState } from 'react'
import { NavBar } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { loadProfile, loadWallet, updateWallet, uid } from '../../store'
import type { BankCard } from '../../types'
import { formatMoney } from '../../utils/qr'

const BANKS = [
  { name: '招商银行', bg: '#d94a3d', abbr: 'CMB', prefix: '622580' },
  { name: '工商银行', bg: '#d64541', abbr: 'ICBC', prefix: '622202' },
  { name: '建设银行', bg: '#1a5dad', abbr: 'CCB', prefix: '621700' },
  { name: '农业银行', bg: '#2e9e5b', abbr: 'ABC', prefix: '622848' },
  { name: '中国银行', bg: '#c0392b', abbr: 'BOC', prefix: '621661' },
  { name: '交通银行', bg: '#2c5aa0', abbr: 'BCM', prefix: '622260' },
  { name: '邮储银行', bg: '#2e9e5b', abbr: 'PSBC', prefix: '621799' },
]

const detectBankIdx = (no: string) => {
  const digits = no.replace(/\D/g, '')
  if (!digits) return 0
  for (let i = 0; i < BANKS.length; i++) if (digits.startsWith(BANKS[i].prefix)) return i
  return Number(digits.slice(-1)) % BANKS.length
}

export default function BankCards({ onBack }: { onBack: () => void }) {
  const [tick, setTick] = useState(0)
  const [adding, setAdding] = useState(false)
  const [cardType, setCardType] = useState<'储蓄卡' | '信用卡'>('储蓄卡')
  const [bankIdx, setBankIdx] = useState(0)
  const [cardNo, setCardNo] = useState('')
  const [amount, setAmount] = useState('10000')
  const [holder, setHolder] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState('')
  const w = (() => {
    void tick
    return loadWallet()
  })()
  const me = loadProfile()

  const open = () => {
    setAdding(true)
    setCardType('储蓄卡')
    setBankIdx(0)
    setCardNo('')
    setAmount('10000')
    setHolder(me.name)
    setPhone('138' + String(Math.floor(Math.random() * 90000000 + 10000000)))
    setErr('')
  }

  const genNo = () => {
    const len = cardType === '信用卡' ? 16 : 19
    let no = BANKS[bankIdx].prefix
    while (no.length < len) no += String(Math.floor(Math.random() * 10))
    setCardNo(no.replace(/(\d{4})(?=\d)/g, '$1 '))
    setErr('')
  }

  const fmtCardNo = (v: string) =>
    v
      .replace(/\D/g, '')
      .slice(0, 19)
      .replace(/(\d{4})(?=\d)/g, '$1 ')

  const save = () => {
    const digits = cardNo.replace(/\s/g, '')
    if (digits.length < 15 || !/^\d+$/.test(digits)) {
      setErr('请输入或自动生成正确的银行卡号')
      return
    }
    if (!holder.trim()) {
      setErr('请输入持卡人姓名')
      return
    }
    if (!/^1\d{10}$/.test(phone)) {
      setErr('请输入正确的手机号')
      return
    }
    const av = Math.round(Number(amount) * 100) / 100
    if (!(av >= 0)) {
      setErr('请输入正确的可用金额')
      return
    }
    const bank = BANKS[detectBankIdx(digits)]
    const card: BankCard = {
      id: uid(),
      bankName: bank.name,
      cardTail: digits.slice(-4),
      holder: holder.trim(),
      phone,
      cardType,
      available: av,
      createdAt: Date.now(),
    }
    updateWallet((x) => ({ ...x, bankCards: [...x.bankCards, card] }))
    setAdding(false)
    setTick((t) => t + 1)
  }

  const removeCard = (id: string) => {
    updateWallet((x) => ({ ...x, bankCards: x.bankCards.filter((c) => c.id !== id) }))
    setTick((t) => t + 1)
  }

  if (adding) {
    return (
      <div className="page bank-page">
        <NavBar
          title="添加银行卡"
          left={
            <button className="nav-btn" onClick={() => setAdding(false)} aria-label="返回">
              <BackIcon />
            </button>
          }
        />
        <div className="page-body bank-form-page">
          <div className="bank-form-label">卡类型</div>
          <div className="bank-type-seg">
            {(['储蓄卡', '信用卡'] as const).map((t) => (
              <button key={t} className={`bank-seg ${cardType === t ? 'on' : ''}`} onClick={() => { setCardType(t); setErr('') }}>
                {t}
              </button>
            ))}
          </div>

          <div className="bank-form-label">选择银行</div>
          <div className="bank-chips">
            {BANKS.map((b, i) => (
              <button
                key={b.name}
                className={`bank-chip ${bankIdx === i ? 'on' : ''}`}
                onClick={() => { setBankIdx(i); setCardNo(''); setErr('') }}
              >
                <span className="bank-chip-logo" style={{ background: b.bg }}>
                  {b.abbr}
                </span>
                {b.name.replace('银行', '')}
              </button>
            ))}
          </div>

          <div className="bank-form-label">卡号</div>
          <div className="bank-gen-row">
            <div className="wallet-money-input bank-no-input">
              <span>卡</span>
              <input
                inputMode="numeric"
                placeholder="银行卡号"
                value={cardNo}
                autoFocus
                onChange={(e) => {
                  const v = fmtCardNo(e.target.value)
                  setCardNo(v)
                  setBankIdx(detectBankIdx(v))
                  setErr('')
                }}
              />
            </div>
            <button className="bank-gen-btn" onClick={genNo}>
              自动生成
            </button>
          </div>

          <div className="bank-form-label">可用金额</div>
          <div className="wallet-money-input bank-no-input">
            <span>¥</span>
            <input inputMode="decimal" placeholder="卡内可用余额" value={amount} onChange={(e) => { setAmount(e.target.value); setErr('') }} />
          </div>

          <div className="bank-step-row">
            <span>持卡人</span>
            <input placeholder="持卡人姓名" value={holder} onChange={(e) => { setHolder(e.target.value); setErr('') }} />
          </div>
          <div className="bank-step-row">
            <span>手机号</span>
            <input inputMode="numeric" maxLength={11} placeholder="预留手机号" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setErr('') }} />
          </div>
          <div className="bank-step-hint">「自动生成」会按所选银行生成卡号，可用金额用于从该卡充值到零钱</div>

          {err && <div className="wallet-money-err">{err}</div>}

          <button className="bank-save-btn" onClick={save}>
            保存银行卡
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page bank-page">
      <NavBar
        title="银行卡"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        {w.bankCards.map((c) => {
          const bank = BANKS.find((b) => b.name === c.bankName) ?? BANKS[0]
          return (
            <div key={c.id} className="bank-card">
              <span className="bank-card-logo" style={{ background: bank.bg }}>
                {bank.abbr}
              </span>
              <span className="bank-card-main">
                <span className="bank-card-name">
                  {c.bankName} {c.cardType}
                </span>
                <span className="bank-card-no">
                  {c.holder || '本人'} · **** **** **** {c.cardTail}
                </span>
                <span className="bank-card-bal">可用 ¥{formatMoney(c.available)}</span>
              </span>
              <button className="bank-card-del" onClick={() => removeCard(c.id)}>
                解绑
              </button>
            </div>
          )
        })}
        {w.bankCards.length === 0 && (
          <div className="bank-empty">
            <span className="bank-empty-icon">卡</span>
            <span>还没有绑定银行卡</span>
            <span className="bank-empty-sub">添加银行卡后可用于充值、提现</span>
          </div>
        )}
        <button className="bank-add-btn" onClick={open}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#0a84ff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          添加银行卡
        </button>
        <div className="bank-tip">零钱余额 ¥{formatMoney(w.balance)} · 银行卡信息仅保存在本地（模拟）</div>
      </div>
    </div>
  )
}
