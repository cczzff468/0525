import { useEffect, useState } from 'react'
import { NavBar } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { loadWallet, settleDailyYield } from '../../store'
import { formatMoney } from '../../utils/qr'

export default function WalletHome({
  onBack,
  onOpen,
  onOpenPassword,
}: {
  onBack: () => void
  onOpen: (page: 'change' | 'fund' | 'paycode' | 'receivecode' | 'scan' | 'bills' | 'redpacket' | 'redpacketRecords' | 'transfer' | 'relatives' | 'bankcards') => void
  onOpenPassword: () => void
}) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    settleDailyYield()
    setTick((t) => t + 1)
  }, [])
  const w = (() => {
    void tick
    return loadWallet()
  })()

  const services: { key: 'change' | 'fund' | 'redpacket' | 'redpacketRecords' | 'transfer' | 'relatives' | 'bankcards' | 'bills'; name: string; desc: string; icon: JSX.Element }[] = [
    {
      key: 'change',
      name: '零钱',
      desc: formatMoney(w.balance),
      icon: (
        <span className="wi-icon" style={{ background: 'linear-gradient(135deg,#ffd53d,#ffb800)' }}>
          ¥
        </span>
      ),
    },
    {
      key: 'fund',
      name: '零钱通',
      desc: formatMoney(w.changeFund),
      icon: (
        <span className="wi-icon" style={{ background: 'linear-gradient(135deg,#ffc93d,#ff9d00)' }}>
          ◆
        </span>
      ),
    },
    {
      key: 'relatives',
      name: '亲属卡',
      desc: '亲情消费我买单',
      icon: (
        <span className="wi-icon" style={{ background: 'linear-gradient(135deg,#4cd97b,#07c160)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="7" width="17" height="11" rx="2" stroke="#fff" strokeWidth="1.7" />
            <path d="M3.5 11h17" stroke="#fff" strokeWidth="1.7" />
          </svg>
        </span>
      ),
    },
    {
      key: 'bankcards',
      name: '银行卡',
      desc: '添加银行卡，充值提现更方便',
      icon: (
        <span className="wi-icon" style={{ background: 'linear-gradient(135deg,#6ba8ff,#1a7dff)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5.5" width="18" height="13" rx="2.2" stroke="#fff" strokeWidth="1.7" />
            <path d="M3 10h18" stroke="#fff" strokeWidth="1.7" />
            <path d="M6.5 14.5h4" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
      ),
    },
    {
      key: 'bills',
      name: '账单',
      desc: '收支明细',
      icon: (
        <span className="wi-icon" style={{ background: 'linear-gradient(135deg,#8aa2c4,#576b95)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 4.5h12v15l-3-1.8-3 1.8-3-1.8-3 1.8v-15Z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M9 9h6M9 12.5h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      ),
    },
  ]

  return (
    <div className="page wallet-page">
      <NavBar
        title="钱包"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
        right={
          <button className="nav-btn wallet-pwd-btn" onClick={onOpenPassword} aria-label="支付密码">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="10.5" width="14" height="9" rx="2.4" stroke="#576b95" strokeWidth="1.7" />
              <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="#576b95" strokeWidth="1.7" />
              <circle cx="12" cy="15" r="1.4" fill="#576b95" />
            </svg>
          </button>
        }
      />
      <div className="page-body">
        <button className="wallet-balance-card" onClick={() => onOpen('change')}>
          <span className="wallet-balance-main">
            <span className="wallet-balance-label">零钱</span>
            <span className="wallet-balance-amount">¥{formatMoney(w.balance)}</span>
          </span>
          <span className="wallet-card-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="m9 5 7 7-7 7" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        <div className="wallet-pay-grid">
          <button className="wallet-pay-item" onClick={() => onOpen('paycode')}>
            <span className="wallet-pay-icon" style={{ background: 'linear-gradient(135deg,#2fd66f,#07c160)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" stroke="#fff" strokeWidth="1.7" />
                <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" stroke="#fff" strokeWidth="1.7" />
                <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" stroke="#fff" strokeWidth="1.7" />
                <path d="M13.5 17h3m3 0h.5M13.5 13.5h.5M17 20h3.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </span>
            <span className="wallet-pay-name">付款码</span>
          </button>
          <button className="wallet-pay-item" onClick={() => onOpen('receivecode')}>
            <span className="wallet-pay-icon" style={{ background: '#fa8c16' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" stroke="#fff" strokeWidth="1.7" />
                <path d="M13.5 5h5.5v5.5M13.5 13.5h5.5V19" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M4 13.5h6.5V19H4z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="wallet-pay-name">收款码</span>
          </button>
          <button className="wallet-pay-item" onClick={() => onOpen('scan')}>
            <span className="wallet-pay-icon" style={{ background: 'linear-gradient(135deg,#6ba8ff,#1a7dff)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M4 12h16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="wallet-pay-name">扫一扫</span>
          </button>
        </div>

        <div className="list-group wallet-services">
          {services.map((s) => (
            <button key={s.key} className="row" onClick={() => onOpen(s.key)}>
              {s.icon}
              <div className="row-main">
                <span className="row-title">{s.name}</span>
                <span className="row-preview">{s.desc}</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="m9 5 7 7-7 7" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>

        <div className="wallet-footer">
          <span className="wallet-shield">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 3.5 5.5 6v5c0 4.2 2.7 7.4 6.5 9.5 3.8-2.1 6.5-5.3 6.5-9.5V6L12 3.5Z" stroke="#9aa4b2" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          微信安全支付
        </div>
      </div>
    </div>
  )
}
