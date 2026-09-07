import { useState } from 'react'
import { NavBar, Avatar } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { addBill, loadFriends, loadMessages, loadProfile, patchFriendMsg, updateWallet } from '../../store'
import type { RelativeCard } from '../../types'
import { formatMoney } from '../../utils/qr'

const fmtFull = (t: number) => {
  const d = new Date(t)
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}年${p(d.getMonth() + 1)}月${p(d.getDate())}日 ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function RedPacketDetail({ friendId, msgId, onBack }: { friendId: string; msgId: string; onBack: () => void }) {
  const msg = loadMessages().find((m) => m.id === msgId)
  const friend = loadFriends().find((f) => f.id === friendId)
  const me = loadProfile()
  if (!msg?.redpacket) {
    return (
      <div className="page wd-page">
        <NavBar title="" left={<button className="nav-btn" onClick={onBack} aria-label="返回"><BackIcon /></button>} />
        <div className="page-body"><div className="bills-empty">红包不存在</div></div>
      </div>
    )
  }
  const rp = msg.redpacket
  const senderName = msg.from === 'me' ? me.name : friend?.name ?? '好友'
  const senderAvatar = msg.from === 'me' ? me.avatar : friend?.avatar
  const received = rp.status === '已领取'
  const openerName = rp.openedBy === '我' ? me.name : rp.openedBy ?? ''

  let heroState: string
  if (received && msg.from === 'me') heroState = `${openerName}领取了你的红包`
  else if (received) heroState = '已领取，金额已存入零钱'
  else if (msg.from === 'me') heroState = '等待对方领取'
  else heroState = '等待你领取'

  return (
    <div className="page wd-page">
      <NavBar
        title="红包详情"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body wd-body wd-rp-detail">
        <div className="wd-rp-hero">
          <span className="wd-rp-badge">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3.5" y="5.5" width="17" height="13" rx="2.4" fill="rgba(255,255,255,0.16)" stroke="#fff" strokeWidth="1.7" />
              <path d="M3.8 9.4h16.4" stroke="#fff" strokeWidth="1.7" />
              <path d="m6.2 9.4 5.8 4.8 5.8-4.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="wd-rp-sender">
            <Avatar name={senderName} src={senderAvatar} size={40} />
            <span className="wd-rp-name">{senderName}的红包</span>
          </span>
          <span className="wd-rp-state-line">{heroState}</span>
          <span className="wd-rp-amount">
            <span className="wd-rp-cny">¥</span>
            {formatMoney(rp.amount)}
          </span>
          {rp.blessing && <span className="wd-rp-bless">“{rp.blessing}”</span>}
        </div>
        <div className="wd-rp-record">
          {received ? (
            <>
              <div className="wd-rp-record-title">领取详情</div>
              <div className="wd-rp-record-row">
                <span className="wd-rp-record-avatar">
                  <Avatar name={openerName} src={msg.from === 'me' ? friend?.avatar : me.avatar} size={38} />
                </span>
                <span className="wd-rp-record-main">
                  <span className="wd-rp-record-name">{openerName}</span>
                  <span className="wd-rp-record-time">{fmtFull(rp.openedAt ?? msg.time)}</span>
                </span>
                <span className="wd-rp-record-amt">{formatMoney(rp.amount)}元</span>
              </div>
            </>
          ) : (
            <div className="wd-rp-wait-tip">未领取的红包，将于 24 小时后发起退款</div>
          )}
        </div>
      </div>
    </div>
  )
}

export function TransferDetail({ friendId, msgId, onBack, onOpenBills }: { friendId: string; msgId: string; onBack: () => void; onOpenBills: () => void }) {
  const [tick, setTick] = useState(0)
  const [hint, setHint] = useState('')
  const msg = loadMessages().find((m) => m.id === msgId)
  void tick

  if (!msg?.transfer) {
    return (
      <div className="page wd-page">
        <NavBar title="" left={<button className="nav-btn" onClick={onBack} aria-label="返回"><BackIcon /></button>} />
        <div className="page-body"><div className="bills-empty">转账不存在</div></div>
      </div>
    )
  }
  const t = msg.transfer
  const waiting = t.status === '待收款' && msg.from === 'friend'
  const received = t.status === '已收款'

  const confirm = () => {
    if (!waiting) return
    updateWallet((x) => ({ ...x, balance: Math.round((x.balance + t.amount) * 100) / 100 }))
    addBill({ kind: '转账', title: `${loadFriends().find((f) => f.id === friendId)?.name ?? '好友'}的转账`, amount: t.amount, status: '已存入零钱', friendName: loadFriends().find((f) => f.id === friendId)?.name, note: t.note })
    patchFriendMsg(friendId, msgId, { transfer: { ...t, status: '已收款', confirmedAt: Date.now() } })
    setHint(`已收钱 ¥${formatMoney(t.amount)}`)
    window.setTimeout(() => setHint(''), 1600)
    setTick((x) => x + 1)
  }

  return (
    <div className="page wd-page">
      <NavBar
        title="转账详情"
        left={<button className="nav-btn" onClick={onBack} aria-label="返回"><BackIcon /></button>}
        right={
          <button className="nav-btn" aria-label="更多">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="5" cy="12" r="1.7" fill="#5a5a5e" />
              <circle cx="12" cy="12" r="1.7" fill="#5a5a5e" />
              <circle cx="19" cy="12" r="1.7" fill="#5a5a5e" />
            </svg>
          </button>
        }
      />
      <div className="page-body wd-body">
        <div className="wd-tf-status">
          <span className={`wd-tf-icon ${received ? 'done' : ''}`}>
            {received ? (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="m6 12.5 4 4 8-9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8" stroke="#fff" strokeWidth="2" />
                <path d="M12 7.5V12l3 2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="wd-tf-state">{t.status === '已收款' ? '已收款' : t.status === '已退还' ? '已退还' : '待收款'}</span>
          <span className="wd-tf-amount">¥{formatMoney(t.amount)}</span>
          <span className="wd-tf-note">
            {waiting ? (
              <>
                1天内对方未收款，将退还给你。<em>提醒对方收款</em>
              </>
            ) : received ? (
              '已存入零钱，可在账单中查看'
            ) : (
              t.note
            )}
          </span>
        </div>
        <div className="wd-divider" />
        <div className="wd-info-rows">
          <div className="wd-info-row">
            <span className="wd-info-label">转账时间</span>
            <span className="wd-info-value">{fmtFull(msg.time)}</span>
          </div>
          <div className="wd-info-row">
            <span className="wd-info-label">收款方式</span>
            <span className="wd-info-value">零钱</span>
          </div>
          {t.note && (
            <div className="wd-info-row">
              <span className="wd-info-label">转账说明</span>
              <span className="wd-info-value">{t.note}</span>
            </div>
          )}
        </div>
        {waiting && (
          <button className="btn-green-big wd-confirm-btn" onClick={confirm}>
            确认收款
          </button>
        )}
        <button className="wd-bill-link" onClick={onOpenBills}>
          账单详情
        </button>
      </div>
      {hint && <div className="chat-toast">{hint}</div>}
    </div>
  )
}

export function RelativeCardDetail({ card, onBack }: { card: RelativeCard; onBack: () => void }) {
  const rest = Math.round((card.monthlyLimit - card.used) * 100) / 100
  const pct = Math.min(100, Math.round((card.used / card.monthlyLimit) * 100))
  return (
    <div className="page wd-page">
      <NavBar title="亲属卡详情" left={<button className="nav-btn" onClick={onBack} aria-label="返回"><BackIcon /></button>} />
      <div className="page-body wd-body">
        <div className="wd-rc-badge">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
        <div className="wd-rc-subject">给 {card.friendName} 的亲属卡</div>
        <div className="wd-rc-amount">
          <span className="wd-rc-amount-label">每月可用额度</span>
          <span className="wd-rc-amount-value">¥{formatMoney(card.monthlyLimit)}</span>
        </div>
        <div className="wd-divider" />
        <div className="wd-rc-bar-wrap">
          <div className="wd-rc-bar">
            <span className="wd-rc-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="wd-rc-remaining">本月剩余 ¥{formatMoney(Math.max(rest, 0))}</span>
        </div>
        <div className="wd-divider" />
        <div className="wd-info-rows">
          <div className="wd-info-row">
            <span className="wd-info-label">当前状态</span>
            <span className={`wd-info-value ${card.status === 'claimed' ? '' : 'wd-info-warn'}`}>{card.status === 'claimed' ? '对方已领取' : '待对方领取'}</span>
          </div>
          <div className="wd-info-row">
            <span className="wd-info-label">扣款方式</span>
            <span className="wd-info-value">零钱</span>
          </div>
          <div className="wd-info-row">
            <span className="wd-info-label">创建时间</span>
            <span className="wd-info-value">{fmtFull(card.createdAt)}</span>
          </div>
          {card.status === 'claimed' && card.claimedAt && (
            <div className="wd-info-row">
              <span className="wd-info-label">领取时间</span>
              <span className="wd-info-value">{fmtFull(card.claimedAt)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
