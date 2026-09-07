import { useState } from 'react'
import { NavBar, Avatar, Modal } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { PayMethodRow, PayPicker, PayPwdPanel } from '../../components/PaySheet'
import { loadFriends, loadWallet, updateWallet } from '../../store'
import type { RelativeCard } from '../../types'
import { checkAmount } from '../../utils/pay'
import { formatMoney } from '../../utils/qr'

const fmtFull = (t: number) => {
  const d = new Date(t)
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}年${p(d.getMonth() + 1)}月${p(d.getDate())}日 ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const rcStatusText = (c: RelativeCard) => {
  if (c.direction === 'received') {
    if (c.status === 'claimed') return '已领取'
    if (c.status === 'rejected') return '已退还'
    return '待领取'
  }
  if (c.status === 'claimed') return '对方已领取'
  if (c.status === 'rejected') return '对方已退还'
  return '待对方领取'
}

const rcSpendable = (c: RelativeCard) => c.status !== 'rejected' && (c.direction !== 'received' || c.status === 'claimed')

export default function RelativeCardPage({
  onBack,
  onGiftSubmit,
  onSpendSubmit,
}: {
  onBack: () => void
  onGiftSubmit: (friendId: string, limit: number, payId: string, pwd: string | null) => string | null
  onSpendSubmit: (cardId: string, amount: number, note: string, payId: string, pwd: string | null) => string | null
}) {
  const [tick, setTick] = useState(0)
  const [gift, setGift] = useState(false)
  const [spendCard, setSpendCard] = useState<RelativeCard | null>(null)
  const [detailCard, setDetailCard] = useState<RelativeCard | null>(null)
  const [amount, setAmount] = useState('')
  const [limit, setLimit] = useState('200')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [hint, setHint] = useState('')
  const [payId, setPayId] = useState('balance')
  const [payOpen, setPayOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pending, setPending] = useState<'gift' | 'spend'>('gift')
  const [pickFriend, setPickFriend] = useState(false)
  const [target, setTarget] = useState<{ id: string; name: string; avatar?: string } | null>(null)
  const w = (() => {
    void tick
    return loadWallet()
  })()

  const flash = (t: string) => {
    setHint(t)
    window.setTimeout(() => setHint(''), 1600)
  }

  const unbind = (card: RelativeCard) => {
    updateWallet((x) => ({ ...x, relativeCards: x.relativeCards.filter((c) => c.id !== card.id) }))
    setTick((t) => t + 1)
    flash(`已解绑 ${card.friendName} 的亲属卡`)
  }

  const runGift = (pwd: string | null): string | null => {
    if (!target) {
      if (pwd === null) setErr('请选择赠送对象')
      return '请选择赠送对象'
    }
    const n = Math.round(Number(limit) * 100) / 100
    const e = onGiftSubmit(target.id, n, payId, pwd)
    if (e && pwd === null) setErr(e)
    return e
  }

  const tryGift = () => {
    if (!target) {
      setErr('请选择赠送对象')
      return
    }
    const n = Math.round(Number(limit) * 100) / 100
    if (!n || n <= 0 || n > 3000) {
      setErr('每月消费上限需在 0.01 - 3000 元之间')
      return
    }
    setErr('')
    setPending('gift')
    if (loadWallet().payPassword) setPwdOpen(true)
    else runGift(null)
  }

  const runSpend = (pwd: string | null): string | null => {
    if (!spendCard) {
      if (pwd === null) setErr('请选择亲属卡')
      return '请选择亲属卡'
    }
    const n = Math.round(Number(amount) * 100) / 100
    const e = onSpendSubmit(spendCard.id, n, note, payId, pwd)
    if (e && pwd === null) setErr(e)
    return e
  }

  const trySpend = () => {
    if (!spendCard) return
    const n = Math.round(Number(amount) * 100) / 100
    if (!n || n <= 0) {
      setErr('请输入正确的金额')
      return
    }
    const rest = Math.round((spendCard.monthlyLimit - spendCard.used) * 100) / 100
    if (n > rest) {
      setErr('超过本卡当月剩余额度')
      return
    }
    const a = checkAmount(w, payId, n)
    if (a) {
      setErr(a)
      return
    }
    setErr('')
    setPending('spend')
    if (loadWallet().payPassword) setPwdOpen(true)
    else runSpend(null)
  }

  const openSpend = (c: RelativeCard) => {
    setSpendCard(c)
    setAmount('')
    setNote('')
    setErr('')
    setPayId('balance')
  }

  return (
    <div className="page relative-page">
      <NavBar
        title="亲属卡"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="relative-intro">为爸妈、子女等亲人赠送亲属卡，对方消费时由你代付，每月上限由你设定。</div>
        {w.relativeCards.length === 0 && (
          <div className="relative-empty">
            <span className="relative-empty-icon">亲</span>
            <span>还没有赠送过亲属卡</span>
          </div>
        )}
        {w.relativeCards.map((c) => {
          const rest = Math.round((c.monthlyLimit - c.used) * 100) / 100
          const pct = Math.min(100, Math.round((c.used / c.monthlyLimit) * 100))
          return (
            <div key={c.id} className="relative-card" onClick={() => setDetailCard(c)}>
              <div className="relative-card-top">
                <Avatar name={c.friendName} size={38} />
                <div className="relative-card-info">
                  <span className="relative-card-name">{c.direction === 'received' ? `来自${c.friendName}的亲属卡` : `${c.friendName}的亲属卡`}</span>
                  <span className="relative-card-limit">每月上限 ¥{formatMoney(c.monthlyLimit)}</span>
                </div>
                <span className={`relative-card-state ${c.status === 'claimed' ? '' : 'warn'}`}>{rcStatusText(c)}</span>
                <button className="relative-card-unbind" onClick={(e) => { e.stopPropagation(); unbind(c) }}>
                  解绑
                </button>
              </div>
              <div className="relative-card-bar">
                <span className="relative-card-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="relative-card-bottom">
                <span className="relative-card-rest">本月剩余 ¥{formatMoney(Math.max(rest, 0))}</span>
                {rcSpendable(c) && (
                  <button
                    className="relative-card-spend"
                    onClick={() => {
                      openSpend(c)
                    }}
                  >
                    记一笔消费
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <button className="btn-green-big relative-gift-btn" onClick={() => { setGift(true); setErr(''); setLimit('200'); setTarget(null) }}>
          赠送亲属卡
        </button>
      </div>

      <Modal
        open={gift}
        title="赠送亲属卡"
        buttons={[
          { label: '取消', onClick: () => setGift(false) },
          { label: '赠送', primary: true, onClick: tryGift },
        ]}
      >
        <button className="row relative-pick" onClick={() => setPickFriend(true)}>
          {target ? (
            <>
              <Avatar name={target.name} src={target.avatar} size={32} />
              <div className="row-main">
                <span className="row-title">{target.name}</span>
              </div>
            </>
          ) : (
            <div className="row-main">
              <span className="row-title" style={{ color: '#8e8e93' }}>
                选择赠送对象
              </span>
            </div>
          )}
          <span className="arrow-right" />
        </button>
        <div className="wallet-money-input">
          <span>¥</span>
          <input type="number" inputMode="decimal" placeholder="每月消费上限" value={limit} onChange={(e) => { setLimit(e.target.value); setErr('') }} />
        </div>
        <PayMethodRow w={w} value={payId} onOpen={() => setPayOpen(true)} />
        {err && <div className="wallet-money-err">{err}</div>}
        <div className="wallet-money-tip">上限范围 0.01 - 3000 元，每月 1 日自动重置额度</div>
      </Modal>

      <Modal open={pickFriend} title="选择对象" buttons={[{ label: '取消', onClick: () => setPickFriend(false) }]}>
        <div className="transfer-pick-list">
          {loadFriends().map((f) => (
            <button
              key={f.id}
              className="row"
              onClick={() => {
                setTarget({ id: f.id, name: f.name, avatar: f.avatar })
                setPickFriend(false)
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

      <Modal
        open={spendCard !== null}
        title={spendCard ? `${spendCard.friendName} 的亲属卡消费` : '记一笔'}
        buttons={[
          { label: '取消', onClick: () => setSpendCard(null) },
          { label: '确认', primary: true, onClick: trySpend },
        ]}
      >
        {spendCard && <div className="wallet-money-tip">本月剩余额度 ¥{formatMoney(Math.max(spendCard.monthlyLimit - spendCard.used, 0))}</div>}
        <div className="wallet-money-input">
          <span>¥</span>
          <input type="number" inputMode="decimal" placeholder="消费金额" value={amount} autoFocus onChange={(e) => { setAmount(e.target.value); setErr('') }} />
        </div>
        <div className="wallet-money-input">
          <span style={{ fontSize: 13 }}>用途</span>
          <input placeholder="选填，如：早午餐" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <PayMethodRow w={w} value={payId} onOpen={() => setPayOpen(true)} />
        {err && <div className="wallet-money-err">{err}</div>}
      </Modal>

      <PayPicker open={payOpen} onClose={() => setPayOpen(false)} w={w} value={payId} onSelect={(k) => { setPayId(k); setErr('') }} />

      <PayPwdPanel
        open={pwdOpen}
        onClose={() => setPwdOpen(false)}
        amountDesc={pending === 'gift' ? `每月消费上限 ¥${formatMoney(Math.round(Number(limit) * 100) / 100 || 0)}` : `消费金额 ¥${formatMoney(Math.round(Number(amount) * 100) / 100 || 0)}`}
        onVerify={(p) => (pending === 'gift' ? runGift(p) : runSpend(p))}
      />

      {hint && <div className="chat-toast">{hint}</div>}

      {detailCard && (
        <div className="wd-page relative-detail-overlay" onClick={() => setDetailCard(null)}>
          <div className="wd-detail-content" onClick={(e) => e.stopPropagation()}>
            <NavBar title="亲属卡详情" left={<button className="nav-btn" onClick={() => setDetailCard(null)} aria-label="返回"><BackIcon /></button>} />
            <div className="page-body wd-body">
              <div className="wd-rc-badge">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
              <div className="wd-rc-subject">{detailCard.direction === 'received' ? `来自 ${detailCard.friendName} 的亲属卡` : `给 ${detailCard.friendName} 的亲属卡`}</div>
              <div className="wd-rc-amount">
                <span className="wd-rc-amount-label">每月可用额度</span>
                <span className="wd-rc-amount-value">¥{formatMoney(detailCard.monthlyLimit)}</span>
              </div>
              <div className="wd-divider" />
              <div className="wd-rc-bar-wrap">
                <div className="wd-rc-bar">
                  <span className="wd-rc-bar-fill" style={{ width: `${Math.min(100, Math.round((detailCard.used / detailCard.monthlyLimit) * 100))}%` }} />
                </div>
                <span className="wd-rc-remaining">本月剩余 ¥{formatMoney(Math.max(Math.round((detailCard.monthlyLimit - detailCard.used) * 100) / 100, 0))}</span>
              </div>
              <div className="wd-divider" />
              <div className="wd-info-rows">
                <div className="wd-info-row">
                  <span className="wd-info-label">当前状态</span>
                  <span className={`wd-info-value ${detailCard.status === 'claimed' ? '' : 'wd-info-warn'}`}>
                    {detailCard.direction === 'received'
                      ? detailCard.status === 'claimed'
                        ? '已领取，可使用'
                        : detailCard.status === 'rejected'
                          ? '已退还'
                          : '待领取'
                      : detailCard.status === 'claimed'
                        ? '对方已领取'
                        : detailCard.status === 'rejected'
                          ? '对方已退还'
                          : '待对方领取'}
                  </span>
                </div>
                <div className="wd-info-row">
                  <span className="wd-info-label">扣款方式</span>
                  <span className="wd-info-value">{detailCard.direction === 'received' ? '由对方代付' : '零钱'}</span>
                </div>
                <div className="wd-info-row">
                  <span className="wd-info-label">创建时间</span>
                  <span className="wd-info-value">{fmtFull(detailCard.createdAt)}</span>
                </div>
                {detailCard.status === 'claimed' && detailCard.claimedAt && (
                  <div className="wd-info-row">
                    <span className="wd-info-label">领取时间</span>
                    <span className="wd-info-value">{fmtFull(detailCard.claimedAt)}</span>
                  </div>
                )}
                {detailCard.status === 'rejected' && detailCard.rejectedAt && (
                  <div className="wd-info-row">
                    <span className="wd-info-label">退还时间</span>
                    <span className="wd-info-value">{fmtFull(detailCard.rejectedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
