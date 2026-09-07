import { useEffect, useState } from 'react'
import { NavBar, Modal } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { addBill, loadWallet, updateWallet } from '../../store'
import type { BankCard } from '../../types'
import { formatMoney } from '../../utils/qr'

const CARD_META: Record<string, { bg: string; abbr: string }> = {
  招商银行: { bg: '#d94a3d', abbr: 'CMB' },
  工商银行: { bg: '#d64541', abbr: 'ICBC' },
  建设银行: { bg: '#1a5dad', abbr: 'CCB' },
  农业银行: { bg: '#2e9e5b', abbr: 'ABC' },
  中国银行: { bg: '#c0392b', abbr: 'BOC' },
  交通银行: { bg: '#2c5aa0', abbr: 'BCM' },
  邮储银行: { bg: '#2e9e5b', abbr: 'PSBC' },
}

function MoneyModal({
  open,
  mode,
  cards,
  balance,
  onClose,
  onCommitted,
  onOpenBankCards,
}: {
  open: boolean
  mode: '充值' | '提现' | null
  cards: BankCard[]
  balance: number
  onClose: () => void
  onCommitted: () => void
  onOpenBankCards: () => void
}) {
  const [val, setVal] = useState('')
  const [cardId, setCardId] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setVal('')
      setErr('')
      setCardId(cards[0]?.id ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const card = cards.find((c) => c.id === cardId)

  const submit = () => {
    if (!mode) return
    if (!card) {
      setErr('请选择银行卡')
      return
    }
    const n = Math.round(Number(val) * 100) / 100
    if (!n || n <= 0) {
      setErr('请输入正确的金额')
      return
    }
    if (mode === '充值') {
      if (n > card.available) {
        setErr('该银行卡可用余额不足')
        return
      }
      updateWallet((x) => ({
        ...x,
        balance: Math.round((x.balance + n) * 100) / 100,
        bankCards: x.bankCards.map((c) => (c.id === card.id ? { ...c, available: Math.round((c.available - n) * 100) / 100 } : c)),
      }))
      addBill({ kind: '充值', title: '零钱充值', amount: n, status: '已存入零钱', note: `付款方式：${card.bankName}（**** ${card.cardTail}）` })
    } else {
      if (n > balance) {
        setErr('零钱余额不足')
        return
      }
      updateWallet((x) => ({
        ...x,
        balance: Math.round((x.balance - n) * 100) / 100,
        bankCards: x.bankCards.map((c) => (c.id === card.id ? { ...c, available: Math.round((c.available + n) * 100) / 100 } : c)),
      }))
      addBill({ kind: '提现', title: '零钱提现', amount: -n, status: '已到账银行卡', note: `到账账户：${card.bankName}（**** ${card.cardTail}），免手续费` })
    }
    onCommitted()
    onClose()
  }

  return (
    <Modal
      open={open}
      title={mode === '充值' ? '从银行卡充值' : '提现到银行卡'}
      buttons={[
        { label: '取消', onClick: onClose },
        { label: mode === '充值' ? '充值' : '提现', primary: true, onClick: submit },
      ]}
    >
      <div className="change-mode-desc">
        {mode === '充值' ? `充值金额将从所选银行卡转入零钱（卡内可用 ¥${card ? formatMoney(card.available) : '--'}）` : `提现金额将从零钱转入所选银行卡（零钱余额 ¥${formatMoney(balance)}）`}
      </div>
      {cards.length === 0 ? (
        <div className="change-card-empty">
          <span>还没有绑定银行卡</span>
          <button onClick={onOpenBankCards}>去添加银行卡</button>
        </div>
      ) : (
        <div className="change-card-list">
          {cards.map((c) => {
            const meta = CARD_META[c.bankName] ?? { bg: '#576b95', abbr: 'BANK' }
            return (
              <button
                key={c.id}
                className={`change-card-item ${cardId === c.id ? 'on' : ''}`}
                onClick={() => {
                  setCardId(c.id)
                  setErr('')
                }}
              >
                <span className="change-card-logo" style={{ background: meta.bg }}>
                  {meta.abbr}
                </span>
                <span className="change-card-main">
                  <span className="change-card-name">
                    {c.bankName} {c.cardType}
                  </span>
                  <span className="change-card-no">**** **** **** {c.cardTail} · 可用 ¥{formatMoney(c.available)}</span>
                </span>
                <span className={`change-card-radio ${cardId === c.id ? 'on' : ''}`} />
              </button>
            )
          })}
        </div>
      )}
      <div className="wallet-money-input">
        <span>¥</span>
        <input type="number" inputMode="decimal" placeholder="0.00" value={val} autoFocus onChange={(e) => { setVal(e.target.value); setErr('') }} />
      </div>
      {err && <div className="wallet-money-err">{err}</div>}
    </Modal>
  )
}

export default function Change({ onBack, onOpenFund, onOpenBills, onOpenBankCards }: { onBack: () => void; onOpenFund: () => void; onOpenBills: () => void; onOpenBankCards: () => void }) {
  const [mode, setMode] = useState<null | '充值' | '提现'>(null)
  const [hint, setHint] = useState('')
  const [tick, setTick] = useState(0)
  const wallet = (() => {
    void tick
    return loadWallet()
  })()

  const flash = (t: string) => {
    setHint(t)
    window.setTimeout(() => setHint(''), 1600)
  }

  return (
    <div className="page change-page">
      <NavBar
        title=""
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
        right={
          <button className="nav-link-btn" onClick={onOpenBills}>
            零钱明细
          </button>
        }
      />
      <div className="page-body change-body">
        <div className="change-hero">
          <span className="change-coin">¥</span>
          <span className="change-title">我的零钱</span>
          <span className="change-amount">¥ {formatMoney(wallet.balance)}</span>
          <button className="change-fund-link" onClick={onOpenFund}>
            转入零钱通，能赚又能花 &gt;
          </button>
        </div>
        <div className="change-bottom">
          <div className="change-actions">
            <button className="btn-green-big" onClick={() => setMode('充值')}>
              充值
            </button>
            <button className="btn-gray-big" onClick={() => setMode('提现')}>
              提现
            </button>
          </div>
          <div className="change-faq">
            常见问题 <span className="change-bank-entry" onClick={onOpenBankCards}>· 银行卡管理</span>
          </div>
          <div className="change-note">本服务由财付通提供</div>
        </div>
      </div>
      <MoneyModal
        open={mode !== null}
        mode={mode}
        cards={wallet.bankCards}
        balance={wallet.balance}
        onClose={() => setMode(null)}
        onCommitted={() => {
          setTick((t) => t + 1)
          flash(mode === '充值' ? '充值成功' : '提现成功')
        }}
        onOpenBankCards={onOpenBankCards}
      />
      {hint && <div className="chat-toast">{hint}</div>}
    </div>
  )
}
