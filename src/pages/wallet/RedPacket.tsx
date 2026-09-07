import { useState } from 'react'
import { NavBar, Avatar } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { PayMethodRow, PayPicker, PayPwdPanel } from '../../components/PaySheet'
import { loadBills, loadFriends, loadWallet } from '../../store'
import { checkAmount } from '../../utils/pay'
import { formatMoney } from '../../utils/qr'

export default function RedPacket({
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
  onSubmit: (friendId: string, amount: number, blessing: string, payId: string, pwd: string | null) => string | null
}) {
  const [amount, setAmount] = useState('')
  const [blessing, setBlessing] = useState('恭喜发财，大吉大利')
  const [err, setErr] = useState('')
  const [payId, setPayId] = useState('balance')
  const [payOpen, setPayOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [target, setTarget] = useState<{ id: string; name: string; avatar?: string } | null>(
    friendId ? { id: friendId, name: friendName || '好友', avatar: friendAvatar } : null
  )
  const w = loadWallet()

  const finish = (pwd: string | null): string | null => {
    const n = Math.round(Number(amount) * 100) / 100
    const e = onSubmit(target!.id, n, blessing.trim() || '恭喜发财，大吉大利', payId, pwd)
    if (e && pwd === null) setErr(e)
    return e
  }

  const submit = () => {
    if (!target) {
      setErr('请选择红包接收人')
      return
    }
    const n = Math.round(Number(amount) * 100) / 100
    if (!n || n <= 0) {
      setErr('请输入红包金额')
      return
    }
    if (n > 200) {
      setErr('单个红包金额不可超过 200 元')
      return
    }
    const a = checkAmount(w, payId, n)
    if (a) {
      setErr(a)
      return
    }
    if (loadWallet().payPassword) setPwdOpen(true)
    else finish(null)
  }

  return (
    <div className="page rp-page">
      <NavBar
        title=""
        left={
          <button className="nav-btn light" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="rp-head">
          <span className="rp-head-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3.5" y="6" width="17" height="14" rx="2.6" fill="rgba(255,255,255,0.18)" stroke="#fff" strokeWidth="1.7" />
              <path d="M3.8 9.6h16.4" stroke="#fff" strokeWidth="1.7" />
              <path d="m6.2 9.6 5.8 4.9 5.8-4.9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="rp-head-title">发红包</span>
        </div>
        {target ? (
          <>
            <div className="list-group rp-form">
              <div className="row">
                <div className="row-main">
                  <span className="row-title">单个金额</span>
                </div>
                <div className="rp-amount-input">
                  <span>¥</span>
                  <input type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => { setAmount(e.target.value); setErr('') }} />
                </div>
              </div>
              <div className="rp-amount-max">单个金额不可超过 200 元</div>
              <div className="row">
                <div className="row-main">
                  <span className="row-title">祝福语</span>
                </div>
                <input className="rp-input" value={blessing} maxLength={25} onChange={(e) => setBlessing(e.target.value)} />
              </div>
              <PayMethodRow w={w} value={payId} onOpen={() => setPayOpen(true)} />
            </div>
            <button className="rp-send-btn" onClick={submit}>
              塞钱进红包
            </button>
            {err && <div className="wallet-money-err center">{err}</div>}
            <div className="rp-tip">未领取的红包，将于 24 小时后发起退款</div>
            <div className="rp-form-footer">
              <span className="rp-form-friend">
                <Avatar name={target.name} src={target.avatar} size={22} />
                发给 {target.name}
              </span>
            </div>
          </>
        ) : (
          <div className="list-group">
            {loadFriends().map((f) => (
              <button key={f.id} className="row" onClick={() => setTarget({ id: f.id, name: f.name, avatar: f.avatar })}>
                <Avatar name={f.name} src={f.avatar} size={38} />
                <div className="row-main">
                  <span className="row-title">{f.name}</span>
                </div>
                <span className="arrow-right" />
              </button>
            ))}
          </div>
        )}
      </div>
      <PayPicker open={payOpen} onClose={() => setPayOpen(false)} w={w} value={payId} onSelect={(k) => { setPayId(k); setErr('') }} />
      <PayPwdPanel
        open={pwdOpen}
        onClose={() => setPwdOpen(false)}
        amountDesc={`红包金额 ¥${formatMoney(Math.round(Number(amount) * 100) / 100 || 0)}`}
        onVerify={(p) => finish(p)}
      />
    </div>
  )
}

export function RedPacketRecords({ onBack }: { onBack: () => void }) {
  const bills = loadBills().filter((b) => b.kind === '红包')
  return (
    <div className="page">
      <NavBar
        title="红包记录"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        {bills.length === 0 ? (
          <div className="bills-empty">暂无红包记录</div>
        ) : (
          <div className="list-group">
            {bills.map((b) => (
              <div key={b.id} className="row">
                <span className="wi-icon" style={{ background: '#fa5151' }}>
                  红
                </span>
                <div className="row-main">
                  <span className="row-title">{b.title}</span>
                  <span className="row-preview">{new Date(b.time).toLocaleString('zh-CN', { hour12: false })}</span>
                </div>
                <span className={`bill-amount ${b.amount > 0 ? 'in' : ''}`}>
                  {b.amount > 0 ? '+' : ''}
                  {formatMoney(b.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
