import { useEffect, useState } from 'react'
import { NavBar, Avatar } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { loadProfile, loadWallet } from '../../store'
import { barcodeDataUrl, formatMoney, qrDataUrl } from '../../utils/qr'

export default function PayCode({ onBack, onOpenReceive }: { onBack: () => void; onOpenReceive: () => void }) {
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60000))
  const me = loadProfile()
  const w = loadWallet()

  useEffect(() => {
    const t = window.setInterval(() => setMinute(Math.floor(Date.now() / 60000)), 5000)
    return () => window.clearInterval(t)
  }, [])

  const seed = `pay-${me.name}-${minute}`
  const qr = qrDataUrl(seed)
  const barcode = barcodeDataUrl(seed)

  return (
    <div className="page paycode-page">
      <NavBar
        title=""
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="paycode-card">
          <div className="paycode-me">
            <Avatar name={me.name} src={me.avatar} size={30} />
            <span>{me.name}</span>
          </div>
          <img className="paycode-barcode" src={barcode} alt="付款条形码" draggable={false} />
          <img className="paycode-qr" src={qr} alt="付款二维码" draggable={false} />
          <div className="paycode-amount">零钱 ¥{formatMoney(w.balance)}</div>
          <div className="paycode-refresh">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" stroke="#c7c7cc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            每分钟自动更新
          </div>
        </div>
        <div className="paycode-note">向商家付款</div>
        <button className="paycode-switch" onClick={onOpenReceive}>
          收款码
        </button>
      </div>
    </div>
  )
}
