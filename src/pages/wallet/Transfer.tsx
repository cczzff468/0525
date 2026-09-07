import { useState } from 'react'
import { NavBar, Avatar, Modal } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { loadFriends, loadWallet } from '../../store'
import type { Friend } from '../../types'
import { formatMoney } from '../../utils/qr'

export default function Transfer({
  friendId,
  friendName,
  friendAvatar,
  onBack,
  onSubmit,
}: {
  friendId: string | null
  friendName: string
  friendAvatar?: string
  onBack: () => void
  onSubmit: (friendId: string, amount: number, note: string) => string | null
}) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [pick, setPick] = useState(false)
  const [target, setTarget] = useState<{ id: string; name: string; avatar?: string } | null>(friendId ? { id: friendId, name: friendName || '好友', avatar: friendAvatar } : null)
  const w = loadWallet()

  const submit = () => {
    if (!target) {
      setErr('请选择收款方')
      return
    }
    const n = Math.round(Number(amount) * 100) / 100
    if (!n || n <= 0) {
      setErr('请输入转账金额')
      return
    }
    if (n > w.balance) {
      setErr('零钱余额不足')
      return
    }
    const e = onSubmit(target.id, n, note.trim())
    if (e) setErr(e)
  }

  return (
    <div className="page transfer-page">
      <NavBar
        title="转账"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        {target ? (
          <>
            <div className="list-group">
              <button className="row" onClick={() => setPick(true)}>
                <Avatar name={target.name} src={target.avatar} size={38} />
                <div className="row-main">
                  <span className="row-title">{target.name}</span>
                  <span className="row-preview">点击重新选择</span>
                </div>
                <span className="arrow-right" />
              </button>
            </div>
            <div className="transfer-amount">
              <span className="transfer-cny">¥</span>
              <input type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => { setAmount(e.target.value); setErr('') }} />
            </div>
            <div className="list-group">
              <div className="row">
                <div className="row-main">
                  <input className="rp-input" placeholder="添加转账说明" value={note} maxLength={20} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
            </div>
            <button className="tf-submit-btn" onClick={submit}>
              转账
            </button>
            {err && <div className="wallet-money-err center">{err}</div>}
            <div className="rp-tip">零钱余额 ¥{formatMoney(w.balance)} · 确认收款后资金将直接转入对方零钱</div>
          </>
        ) : (
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
        )}
      </div>
      <Modal
        open={pick}
        title="选择收款方"
        buttons={[{ label: '取消', onClick: () => setPick(false) }]}
      >
        <div className="transfer-pick-list">
          {loadFriends().map((f: Friend) => (
            <button
              key={f.id}
              className="row"
              onClick={() => {
                setTarget({ id: f.id, name: f.name, avatar: f.avatar })
                setPick(false)
              }}
            >
              <Avatar name={f.name} src={f.avatar} size={34} />
              <div className="row-main">
                <span className="row-title">{f.name}</span>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
