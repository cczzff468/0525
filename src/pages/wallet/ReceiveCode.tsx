import { useState } from 'react'
import { NavBar, Avatar } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { loadProfile } from '../../store'
import { formatMoney, qrDataUrl } from '../../utils/qr'

export default function ReceiveCode({ onBack }: { onBack: () => void }) {
  const [amount, setAmount] = useState<number | null>(null)
  const [amountOpen, setAmountOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const me = loadProfile()

  const seed = amount ? `receive-${me.name}-${amount}` : `receive-${me.name}`
  const qr = qrDataUrl(seed, 620)

  const save = () => {
    const a = document.createElement('a')
    a.href = qr
    a.download = `收款码-${me.name}.png`
    a.click()
  }

  return (
    <div className="page receivecode-page">
      <NavBar
        title=""
        left={
          <button className="nav-btn light" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="receivecode-head">
          <span className="receivecode-brand">微信收款码</span>
        </div>
        <div className="receivecode-card">
          <div className="paycode-me">
            <Avatar name={me.name} src={me.avatar} size={34} />
            <span>{me.name}</span>
          </div>
          <img className="receivecode-qr" src={qr} alt="收款二维码" draggable={false} />
          <div className="receivecode-amount">{amount ? `¥${formatMoney(amount)}` : '二维码收款'}</div>
          <div className="receivecode-tip">对方扫码后即可向你付款</div>
        </div>
        <div className="receivecode-actions">
          <button
            className="btn-white-big"
            onClick={() => {
              setDraft(amount ? String(amount) : '')
              setAmountOpen(true)
            }}
          >
            设置金额
          </button>
          <button className="btn-white-big" onClick={save}>
            保存收款码
          </button>
        </div>
      </div>
      {amountOpen && (
        <div className="rp-overlay" onClick={() => setAmountOpen(false)}>
          <div className="rp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="rp-sheet-title">设置收款金额</div>
            <div className="wallet-money-input">
              <span>¥</span>
              <input type="number" inputMode="decimal" placeholder="0.00（留空则不设金额）" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} />
            </div>
            <div className="rp-sheet-btns">
              <button
                className="btn-gray-big"
                onClick={() => {
                  setAmount(null)
                  setAmountOpen(false)
                }}
              >
                清除金额
              </button>
              <button
                className="btn-green-big"
                onClick={() => {
                  const n = Math.round(Number(draft) * 100) / 100
                  setAmount(n > 0 ? n : null)
                  setAmountOpen(false)
                }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
