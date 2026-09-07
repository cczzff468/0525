import { useState } from 'react'
import { NavBar, Avatar } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { PayMethodRow, PayPicker, PayPwdPanel } from '../../components/PaySheet'
import { loadFriends, loadWallet } from '../../store'
import type { Friend } from '../../types'
import { formatMoney } from '../../utils/qr'

export default function RelativeGift({
  friendId,
  friendName,
  friendAvatar,
  onBack,
  onSubmit,
}: {
  friendId?: string
  friendName?: string
  friendAvatar?: string
  onBack: () => void
  onSubmit: (friendId: string, limit: number, payId: string, pwd: string | null) => string | null
}) {
  const [limit, setLimit] = useState('200')
  const [err, setErr] = useState('')
  const [payId, setPayId] = useState('balance')
  const [payOpen, setPayOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [target, setTarget] = useState<{ id: string; name: string; avatar?: string } | null>(friendId ? { id: friendId, name: friendName || '好友', avatar: friendAvatar } : null)
  const w = loadWallet()

  const finish = (pwd: string | null): string | null => {
    const n = Math.round(Number(limit) * 100) / 100
    const e = onSubmit(target!.id, n, payId, pwd)
    if (e && pwd === null) setErr(e)
    return e
  }

  const submit = () => {
    if (!target) {
      setErr('请选择赠送对象')
      return
    }
    const n = Math.round(Number(limit) * 100) / 100
    if (!n || n <= 0 || n > 3000) {
      setErr('每月消费上限需在 0.01 - 3000 元之间')
      return
    }
    if (loadWallet().payPassword) setPwdOpen(true)
    else finish(null)
  }

  return (
    <div className="page rg-page">
      <NavBar
        title="赠送亲属卡"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="rg-head">
          <span className="rg-head-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="5.5" width="16" height="13" rx="2.6" stroke="#fff" strokeWidth="1.6" />
              <path d="M12 16.1c-2.1-1.5-3.5-2.8-3.5-4.2a2 2 0 0 1 3.5-1.2 2 2 0 0 1 3.5 1.2c0 1.4-1.4 2.7-3.5 4.2Z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="rg-head-title">亲属卡</span>
          <span className="rg-head-sub">对方消费时由你的零钱代付，每月上限你说了算</span>
        </div>
        {target ? (
          <>
            <div className="rg-target">
              <Avatar name={target.name} src={target.avatar} size={42} />
              <div className="rg-target-info">
                <span className="rg-target-name">{target.name}</span>
                <span className="rg-target-sub">对方将收到你的亲属卡</span>
              </div>
            </div>
            <div className="list-group rg-form">
              <div className="row">
                <div className="row-main">
                  <span className="row-title">每月消费上限</span>
                </div>
                <div className="rp-amount-input rg-amount">
                  <span>¥</span>
                  <input type="number" inputMode="decimal" value={limit} onChange={(e) => { setLimit(e.target.value); setErr('') }} />
                </div>
              </div>
              <div className="rp-amount-max">可设置 0.01 - 3000 元/月，随时可调整</div>
              <PayMethodRow w={w} value={payId} onOpen={() => setPayOpen(true)} />
            </div>
            <button className="rg-submit-btn" onClick={submit}>
              赠送亲属卡
            </button>
            {err && <div className="wallet-money-err center">{err}</div>}
            <div className="rg-tip">对方领取后即可使用，消费时从上方代付账户扣款</div>
          </>
        ) : (
          <>
            <div className="tf-pick-title">选择要赠送的好友</div>
            <div className="list-group">
              {loadFriends().map((f: Friend) => (
                <button key={f.id} className="row" onClick={() => setTarget({ id: f.id, name: f.name, avatar: f.avatar })}>
                  <Avatar name={f.name} src={f.avatar} size={38} />
                  <div className="row-main">
                    <span className="row-title">{f.name}</span>
                  </div>
                  <span className="arrow-right" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <PayPicker open={payOpen} onClose={() => setPayOpen(false)} w={w} value={payId} onSelect={(k) => { setPayId(k); setErr('') }} />
      <PayPwdPanel
        open={pwdOpen}
        onClose={() => setPwdOpen(false)}
        amountDesc={`每月消费上限 ¥${formatMoney(Math.round(Number(limit) * 100) / 100 || 0)}`}
        onVerify={(p) => finish(p)}
      />
    </div>
  )
}
