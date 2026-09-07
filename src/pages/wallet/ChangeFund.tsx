import { useState } from 'react'
import { NavBar, Modal } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { addBill, loadWallet, settleDailyYield, updateWallet } from '../../store'
import { formatMoney } from '../../utils/qr'

const RATE = '1.9860%'

export default function ChangeFund({ onBack, onOpenBills }: { onBack: () => void; onOpenBills: () => void }) {
  const [mode, setMode] = useState<null | '转入' | '转出'>(null)
  const [val, setVal] = useState('')
  const [err, setErr] = useState('')
  const [hint, setHint] = useState('')
  const [tick, setTick] = useState(0)
  const w = (() => {
    void tick
    settleDailyYield()
    return loadWallet()
  })()

  const flash = (t: string) => {
    setHint(t)
    window.setTimeout(() => setHint(''), 1600)
  }

  const submit = () => {
    const n = Math.round(Number(val) * 100) / 100
    if (!n || n <= 0) {
      setErr('请输入正确的金额')
      return
    }
    if (mode === '转入') {
      if (n > w.balance) {
        setErr('零钱余额不足')
        return
      }
      updateWallet((x) => ({
        ...x,
        balance: Math.round((x.balance - n) * 100) / 100,
        changeFund: Math.round((x.changeFund + n) * 100) / 100,
      }))
      addBill({ kind: '零钱通', title: '转入零钱通', amount: -n, status: '已转入', note: '零钱自动转入，随时可转出' })
      flash(`已转入零钱通 ¥${formatMoney(n)}`)
    } else {
      if (n > w.changeFund) {
        setErr('零钱通余额不足')
        return
      }
      updateWallet((x) => ({
        ...x,
        balance: Math.round((x.balance + n) * 100) / 100,
        changeFund: Math.round((x.changeFund - n) * 100) / 100,
      }))
      addBill({ kind: '零钱通', title: '零钱通转出', amount: n, status: '已到账零钱', note: '转出到零钱，最快秒到账' })
      flash(`已转出到零钱 ¥${formatMoney(n)}`)
    }
    setVal('')
    setErr('')
    setMode(null)
    setTick((t) => t + 1)
  }

  const close = () => {
    setMode(null)
    setVal('')
    setErr('')
  }

  const yesterday = Math.round(((w.changeFund * 0.01986) / 365) * 100) / 100

  return (
    <div className="page fund-page">
      <NavBar
        title=""
        left={
          <button className="nav-btn light" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="fund-brand">
          <span className="fund-logo">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 3 4.5 7v7c0 4 3 7 7.5 9 4.5-2 7.5-5 7.5-9V7L12 3Z" fill="#ffc300" />
              <path d="m12 7.5 1.6 3.4 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5L12 7.5Z" fill="#fff" />
            </svg>
          </span>
          <span className="fund-title">零钱通</span>
          <span className="fund-safe">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 3.5 5.5 6v5c0 4.2 2.7 7.4 6.5 9.5 3.8-2.1 6.5-5.3 6.5-9.5V6L12 3.5Z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
            资金安全保障中
          </span>
        </div>

        <div className="fund-card">
          <div className="fund-balance">
            <span className="fund-balance-label">账户余额</span>
            <span className="fund-balance-amount">¥ {formatMoney(w.changeFund)}</span>
            <button className="fund-detail-link" onClick={onOpenBills}>
              资金明细
            </button>
          </div>
          <div className="fund-metrics">
            <div className="fund-metric">
              <span className="fund-metric-label">七日年化收益率</span>
              <span className="fund-metric-value">{RATE}</span>
              <span className="fund-pill">易方达易理财货币A</span>
            </div>
            <span className="fund-divider" />
            <div className="fund-metric">
              <span className="fund-metric-label">累计收益</span>
              <span className="fund-metric-value">¥{formatMoney(w.fundYield)}</span>
              <span className="fund-pill">昨日 ¥{formatMoney(Math.max(yesterday, 0))}</span>
            </div>
          </div>
          <div className="fund-actions">
            <button className="btn-gray-big" onClick={() => setMode('转出')}>
              转出
            </button>
            <button className="btn-orange-big" onClick={() => setMode('转入')}>
              转入
            </button>
          </div>
        </div>

        <div className="fund-products-title">更多产品</div>
        <div className="list-group fund-products">
          <div className="row">
            <span className="fund-product-icon" style={{ background: '#3a7afe' }}>
              理
            </span>
            <div className="row-main">
              <span className="row-title">活期理财</span>
              <span className="row-preview">转出最快秒到账</span>
            </div>
            <div className="fund-product-rate">
              <span className="rate-num">1.11%</span>
              <span className="rate-label">七日年化</span>
            </div>
          </div>
          <div className="row">
            <span className="fund-product-icon" style={{ background: '#ff7a1a' }}>
              定
            </span>
            <div className="row-main">
              <span className="row-title">定期理财</span>
              <span className="row-preview">追求更高收益</span>
            </div>
            <div className="fund-product-rate">
              <span className="rate-num">2.34%</span>
              <span className="rate-label">最高收益率</span>
            </div>
          </div>
        </div>

        <div className="fund-footer">
          <span>了解零钱通</span>
          <span>常见问题</span>
        </div>
      </div>

      <Modal
        open={mode !== null}
        title={mode === '转入' ? '转入零钱通' : '转出到零钱'}
        buttons={[
          { label: '取消', onClick: close },
          { label: mode ?? '确定', primary: true, onClick: submit },
        ]}
      >
        <div className="wallet-money-input">
          <span>¥</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={val}
            autoFocus
            onChange={(e) => {
              setVal(e.target.value)
              setErr('')
            }}
          />
        </div>
        {err && <div className="wallet-money-err">{err}</div>}
        <div className="wallet-money-tip">{mode === '转入' ? `零钱可用余额 ¥${formatMoney(w.balance)}` : `零钱通可转出 ¥${formatMoney(w.changeFund)}`}</div>
      </Modal>
      {hint && <div className="chat-toast">{hint}</div>}
    </div>
  )
}
