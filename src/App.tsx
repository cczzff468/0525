import { useEffect, useState } from 'react'
import Messages from './pages/Messages'
import Contacts from './pages/Contacts'
import Discover from './pages/Discover'
import Me from './pages/Me'
import AddFriend from './pages/AddFriend'
import AddPersona from './pages/AddPersona'
import Chat from './pages/Chat'
import FriendDetail from './pages/FriendDetail'
import Moments from './pages/Moments'
import MyProfile from './pages/MyProfile'
import Settings from './pages/Settings'
import ApiSettingPage from './pages/ApiSettingPage'
import VisionApiPage from './pages/VisionApiPage'
import VoiceApiPage from './pages/VoiceApiPage'
import MemoryPage from './pages/MemoryPage'
import ChatSettings from './pages/ChatSettings'
import ChatSearch from './pages/ChatSearch'
import ChatBackground from './pages/ChatBackground'
import TranslateLang from './pages/TranslateLang'
import StickerPage from './pages/StickerPage'
import LocationPage from './pages/LocationPage'
import WalletHome from './pages/wallet/WalletHome'
import Change from './pages/wallet/Change'
import ChangeFund from './pages/wallet/ChangeFund'
import PayCode from './pages/wallet/PayCode'
import ReceiveCode from './pages/wallet/ReceiveCode'
import Scan from './pages/wallet/Scan'
import Bills, { BillDetail } from './pages/wallet/Bills'
import type { BillFilter } from './pages/wallet/Bills'
import RedPacket, { RedPacketRecords } from './pages/wallet/RedPacket'
import Transfer from './pages/wallet/Transfer'
import RelativeGift from './pages/wallet/RelativeGift'
import RelativeCardPage from './pages/wallet/RelativeCard'
import { RedPacketDetail, TransferDetail, RelativeCardDetail } from './pages/wallet/WalletDetail'
import BankCards from './pages/wallet/BankCards'
import { ChatIcon, ContactsIcon, DiscoverIcon, MeIcon } from './components/icons'
import { formatMoney } from './utils/qr'
import { checkAmount, deduct, payLabel } from './utils/pay'
import PaySuccess from './pages/wallet/PaySuccess'
import type { PaySuccessData } from './pages/wallet/PaySuccess'
import PayPasswordSet from './pages/wallet/PayPasswordSet'
import { addBill, appendMessage, loadBills, loadFriends, loadMessages, loadUiState, loadWallet, patchFriendMsg, saveFriends, saveMessages, saveUiState, updateWallet, uid } from './store'
import type { Friend, Message, RelativeCard } from './types'

type Tab = 'messages' | 'contacts' | 'discover' | 'me'
type View =
  | { name: 'tabs' }
  | { name: 'addFriend'; friendId?: string }
  | { name: 'chat'; friendId: string; jumpTo?: string }
  | { name: 'friendDetail'; friendId: string }
  | { name: 'moments' }
  | { name: 'myProfile' }
  | { name: 'addPersona'; personaId?: string }
  | { name: 'settings' }
  | { name: 'apiSetting' }
  | { name: 'visionApi' }
  | { name: 'voiceApi' }
  | { name: 'memory'; friendId?: string }
  | { name: 'chatSettings'; friendId: string }
  | { name: 'chatSearch'; friendId: string }
  | { name: 'chatBg'; friendId: string }
  | { name: 'translateLang'; friendId: string }
  | { name: 'stickers' }
  | { name: 'location'; friendId: string }
  | { name: 'wallet' }
  | { name: 'walletChange' }
  | { name: 'walletFund' }
  | { name: 'payCode' }
  | { name: 'receiveCode' }
  | { name: 'scan' }
  | { name: 'bills'; filter?: BillFilter }
  | { name: 'billDetail'; billId: string }
  | { name: 'redPacket'; friendId?: string; fromChat?: boolean }
  | { name: 'redPacketRecords' }
  | { name: 'transfer'; friendId?: string; fromChat?: boolean }
  | { name: 'relativeCard' }
  | { name: 'relativeGift'; friendId?: string; fromChat?: boolean }
  | { name: 'rpDetail'; friendId: string; msgId: string }
  | { name: 'tfDetail'; friendId: string; msgId: string }
  | { name: 'relativeCardDetail'; cardId: string; friendId?: string; fromChat?: boolean }
  | { name: 'payPwd' }
  | { name: 'paySuccess'; data: PaySuccessData }
  | { name: 'bankcards' }

const WALLET_VIEWS = ['wallet', 'walletChange', 'walletFund', 'payCode', 'receiveCode', 'scan', 'bills', 'redPacket', 'redPacketRecords', 'transfer', 'relativeCard', 'relativeGift', 'rpDetail', 'tfDetail', 'relativeCardDetail', 'bankcards', 'payPwd', 'paySuccess']

const TABS: { key: Tab; label: string; icon: (active: boolean) => JSX.Element }[] = [
  { key: 'messages', label: '信息', icon: (a) => <ChatIcon active={a} /> },
  { key: 'contacts', label: '联系人', icon: (a) => <ContactsIcon active={a} /> },
  { key: 'discover', label: '发现', icon: (a) => <DiscoverIcon active={a} /> },
  { key: 'me', label: '我', icon: (a) => <MeIcon active={a} /> },
]

function initialState(): { tab: Tab; view: View } {
  const saved = loadUiState<{ tab?: Tab; view?: View }>({})
  const tab: Tab = TABS.some((t) => t.key === saved.tab) ? (saved.tab as Tab) : 'messages'
  const savedView = saved.view as View | undefined
  let view: View = { name: 'tabs' }
  if (savedView && typeof savedView.name === 'string') {
    if (savedView.name === 'chat') {
      view = loadFriends().some((f) => f.id === savedView.friendId) ? savedView : { name: 'tabs' }
    } else if (savedView.name === 'stickers') {
      view = savedView
    } else if (savedView.name === 'billDetail') {
      view = loadBills().some((b) => b.id === (savedView as { billId: string }).billId) ? savedView : { name: 'tabs' }
    } else if (savedView.name === 'redPacket' || savedView.name === 'transfer') {
      view = savedView.friendId && loadFriends().some((f) => f.id === savedView.friendId) ? savedView : { name: 'tabs' }
    } else if (WALLET_VIEWS.includes(savedView.name)) {
      view = savedView
    } else if (
      ['moments', 'myProfile', 'settings', 'apiSetting', 'visionApi', 'voiceApi', 'memory', 'chatSettings', 'chatSearch', 'chatBg', 'translateLang'].includes(
        savedView.name
      ) &&
      loadFriends().some((f) => f.id === (savedView as { friendId: string }).friendId)
    ) {
      view = savedView
    }
  }
  return { tab, view }
}

export default function App() {
  const [init] = useState(initialState)
  const [friends, setFriends] = useState<Friend[]>(() => loadFriends())
  const [messages, setMessages] = useState<Message[]>(() => loadMessages())
  const [tab, setTab] = useState<Tab>(init.tab)
  const [view, setView] = useState<View>(init.view)
  const [pendingLocation, setPendingLocation] = useState<{ name: string; address?: string } | null>(null)

  useEffect(() => {
    saveUiState({ tab, view })
  }, [tab, view])

  const refreshData = () => {
    setFriends(loadFriends())
    setMessages(loadMessages())
  }

  const openChat = (friendId: string) => {
    if (!friendId) return
    setView({ name: 'chat', friendId })
  }

  const backToTabs = () => {
    refreshData()
    setView({ name: 'tabs' })
  }

  const onFriendCreated = (friendId: string) => {
    refreshData()
    if (view.name === 'addFriend' && view.friendId) {
      setView({ name: 'chat', friendId: view.friendId })
    } else {
      setView({ name: 'chat', friendId })
    }
  }

  const scheduleAIReceive = (friendId: string, msgId: string, kind: 'redpacket' | 'transfer' | 'rc') => {
    window.setTimeout(() => {
      const friend = loadFriends().find((f) => f.id === friendId)
      const msg = loadMessages().find((m) => m.id === msgId)
      if (!friend || !msg) return
      let done = false
      let amount = 0
      let receiptText = ''
      let cardId: string | undefined
      if (kind === 'redpacket' && msg.redpacket) {
        patchFriendMsg(friendId, msgId, { redpacket: { ...msg.redpacket, status: '已领取', openedBy: friend.name, openedAt: Date.now() } })
        amount = msg.redpacket.amount
        receiptText = `领取了你的红包，收到 ¥${amount} 元`
        done = true
      } else if (kind === 'transfer' && msg.transfer) {
        patchFriendMsg(friendId, msgId, { transfer: { ...msg.transfer, status: '已收款', confirmedAt: Date.now() } })
        amount = msg.transfer.amount
        receiptText = `已收款，到账 ¥${amount} 元`
        done = true
      } else if (kind === 'rc' && msg.relativeCard) {
        const card = loadWallet().relativeCards.find((c) => c.id === msg.relativeCard!.cardId)
        if (card) {
          updateWallet((x) => ({ ...x, relativeCards: x.relativeCards.map((c2) => (c2.id === card.id ? { ...c2, status: 'claimed', claimedAt: Date.now() } : c2)) }))
          patchFriendMsg(friendId, msgId, { relativeCard: { cardId: card.id, status: '已领取' } })
          amount = card.monthlyLimit
          cardId = card.id
          receiptText = `已领取你的亲属卡，每月额度 ¥${amount} 元`
          done = true
        }
      }
      if (done) {
        appendMessage({ id: uid(), friendId, from: 'friend', text: receiptText, time: Date.now(), receipt: { kind, amount, srcMsgId: msgId, ...(cardId ? { cardId } : {}) } })
        friend.lastTime = Date.now()
        saveFriends(loadFriends().map((f) => (f.id === friendId ? friend : f)))
        refreshData()
      }
    }, 4000 + Math.random() * 5000)
  }

  const verifyPwd = (pwd: string | null): string | null => {
    const w = loadWallet()
    if (!w.payPassword) return null
    if (pwd === null) return '请输入支付密码'
    return pwd === w.payPassword ? null : '支付密码错误，请重试'
  }

  const submitRedPacket = (friendId: string, amount: number, blessing: string, payId: string, pwd: string | null): string | null => {
    const friend = loadFriends().find((f) => f.id === friendId)
    if (!friend) return '好友不存在'
    const n = Math.round(amount * 100) / 100
    if (!n || n <= 0 || n > 200) return '单个红包金额不可超过 200 元'
    const w = loadWallet()
    const a = checkAmount(w, payId, n)
    if (a) return a
    const v = verifyPwd(pwd)
    if (v) return v
    const label = payLabel(w, payId)
    updateWallet((x) => deduct(x, payId, n))
    addBill({ kind: '红包', title: `发给${friend.name}的红包`, amount: -n, status: '已发出，等待领取', friendName: friend.name, note: blessing })
    const msg: Message = { id: uid(), friendId, from: 'me', text: `[红包:${blessing}|${n}]`, time: Date.now(), redpacket: { amount: n, blessing, status: '待领取' } }
    appendMessage(msg)
    refreshData()
    scheduleAIReceive(friendId, msg.id, 'redpacket')
    setView({
      name: 'paySuccess',
      data: {
        title: '红包已发出',
        amount: n,
        rows: [
          { label: '收款人', value: friend.name },
          { label: '祝福语', value: blessing || '恭喜发财，大吉大利' },
          { label: '支付方式', value: label },
        ],
        back: { name: 'chat', friendId },
      },
    })
    return null
  }

  const submitTransfer = (friendId: string, amount: number, note: string, payId: string, pwd: string | null): string | null => {
    const friend = loadFriends().find((f) => f.id === friendId)
    if (!friend) return '好友不存在'
    const n = Math.round(amount * 100) / 100
    if (!n || n <= 0) return '请输入转账金额'
    const w = loadWallet()
    const a = checkAmount(w, payId, n)
    if (a) return a
    const v = verifyPwd(pwd)
    if (v) return v
    const label = payLabel(w, payId)
    updateWallet((x) => deduct(x, payId, n))
    addBill({ kind: '转账', title: `转账给${friend.name}`, amount: -n, status: '已转账，待对方收款', friendName: friend.name, note: note || '转账' })
    const msg: Message = { id: uid(), friendId, from: 'me', text: `[转账:${n}|${note}]`, time: Date.now(), transfer: { amount: n, note, status: '待收款' } }
    appendMessage(msg)
    refreshData()
    scheduleAIReceive(friendId, msg.id, 'transfer')
    setView({
      name: 'paySuccess',
      data: {
        title: '转账成功',
        amount: n,
        rows: [
          { label: '收款人', value: friend.name },
          { label: '转账说明', value: note.trim() || '转账' },
          { label: '支付方式', value: label },
        ],
        back: { name: 'chat', friendId },
      },
    })
    return null
  }

  const submitGift = (friendId: string, limit: number, payId: string, pwd: string | null): string | null => {
    const friend = loadFriends().find((f) => f.id === friendId)
    if (!friend) return '好友不存在'
    const n = Math.round(limit * 100) / 100
    if (!n || n <= 0 || n > 3000) return '每月消费上限需在 0.01 - 3000 元之间'
    const v = verifyPwd(pwd)
    if (v) return v
    const w = loadWallet()
    const label = payLabel(w, payId)
    const card: RelativeCard = { id: uid(), friendId: friend.id, friendName: friend.name, monthlyLimit: n, used: 0, direction: 'given', status: 'pending', createdAt: Date.now() }
    updateWallet((x) => ({ ...x, relativeCards: [...x.relativeCards, card] }))
    addBill({ kind: '亲属卡', title: `赠送亲属卡 · ${friend.name}`, amount: 0, status: '已赠送', note: `每月消费上限 ¥${formatMoney(n)}` })
    const msg: Message = { id: uid(), friendId: friend.id, from: 'me', text: `赠送给${friend.name}的亲属卡`, time: Date.now(), relativeCard: { cardId: card.id, status: '待领取' } }
    appendMessage(msg)
    refreshData()
    scheduleAIReceive(friend.id, msg.id, 'rc')
    setView({
      name: 'paySuccess',
      data: {
        title: '亲属卡已赠送',
        amount: n,
        amountNote: '每月消费上限',
        rows: [
          { label: '赠送对象', value: friend.name },
          { label: '代付账户', value: label },
          { label: '状态', value: '待对方领取' },
        ],
        back: { name: 'chat', friendId: friend.id },
      },
    })
    return null
  }

  const submitSpend = (cardId: string, amount: number, note: string, payId: string, pwd: string | null): string | null => {
    const w = loadWallet()
    const card = w.relativeCards.find((c) => c.id === cardId)
    if (!card) return '亲属卡不存在'
    const n = Math.round(amount * 100) / 100
    if (!n || n <= 0) return '请输入正确的金额'
    const rest = Math.round((card.monthlyLimit - card.used) * 100) / 100
    if (n > rest) return '超过本卡当月剩余额度'
    const a = checkAmount(w, payId, n)
    if (a) return a
    const v = verifyPwd(pwd)
    if (v) return v
    const label = payLabel(w, payId)
    updateWallet((x) => ({
      ...deduct(x, payId, n),
      relativeCards: x.relativeCards.map((c) => (c.id === cardId ? { ...c, used: Math.round((c.used + n) * 100) / 100 } : c)),
    }))
    addBill({ kind: '亲属卡', title: `${card.friendName} 的亲属卡消费`, amount: -n, status: `已用${label}支付`, friendName: card.friendName, note: note.trim() || '亲属卡消费' })
    setView({
      name: 'paySuccess',
      data: {
        title: '支付成功',
        amount: n,
        rows: [
          { label: '消费项目', value: `${card.friendName} 的亲属卡` },
          { label: '支付方式', value: label },
        ],
        back: { name: 'relativeCard' },
      },
    })
    return null
  }

  const openWalletPage = (page: 'change' | 'fund' | 'paycode' | 'receivecode' | 'scan' | 'bills' | 'redpacket' | 'redpacketRecords' | 'transfer' | 'relatives' | 'bankcards') => {
    const next: Record<string, View> = {
      change: { name: 'walletChange' },
      fund: { name: 'walletFund' },
      paycode: { name: 'payCode' },
      receivecode: { name: 'receiveCode' },
      scan: { name: 'scan' },
      bills: { name: 'bills', filter: 'all' },
      redpacket: { name: 'redPacket' },
      redpacketRecords: { name: 'redPacketRecords' },
      transfer: { name: 'transfer' },
      relatives: { name: 'relativeCard' },
      bankcards: { name: 'bankcards' },
    }
    setView(next[page])
  }

  let content: JSX.Element
  if (view.name === 'addFriend') {
    content = <AddFriend onBack={backToTabs} onCreated={onFriendCreated} friendId={view.friendId} />
  } else if (view.name === 'chat') {
    const friend = friends.find((f) => f.id === view.friendId)
    content = friend ? (
      <Chat
        key={friend.id}
        friend={friend}
        onBack={backToTabs}
        onEditFriend={() => setView({ name: 'addFriend', friendId: view.friendId })}
        onOpenSettings={() => setView({ name: 'apiSetting' })}
        onOpenChatSettings={() => setView({ name: 'chatSettings', friendId: view.friendId })}
        onOpenStickers={() => setView({ name: 'stickers' })}
        onOpenLocation={() => setView({ name: 'location', friendId: view.friendId })}
        onOpenRedPacket={() => setView({ name: 'redPacket', friendId: view.friendId, fromChat: true })}
        onOpenTransfer={() => setView({ name: 'transfer', friendId: view.friendId, fromChat: true })}
        onOpenRelativeGift={() => setView({ name: 'relativeGift', friendId: view.friendId, fromChat: true })}
        onOpenRedPacketDetail={(friendId, msgId) => setView({ name: 'rpDetail', friendId, msgId })}
        onOpenTransferDetail={(friendId, msgId) => setView({ name: 'tfDetail', friendId, msgId })}
        onOpenRelativeCardDetail={(cardId) => setView({ name: 'relativeCardDetail', cardId, friendId: view.friendId, fromChat: true })}
        pendingLocation={pendingLocation}
        onConsumeLocation={() => setPendingLocation(null)}
        jumpTo={view.jumpTo}
      />
    ) : (
      <div className="page">
        <div className="empty-hint">好友不存在</div>
      </div>
    )
  } else if (view.name === 'location') {
    content = (
      <LocationPage
        onBack={() => setView({ name: 'chat', friendId: view.friendId })}
        onSend={(loc) => {
          setPendingLocation(loc)
          setView({ name: 'chat', friendId: view.friendId })
        }}
      />
    )
  } else if (view.name === 'wallet') {
    content = <WalletHome onBack={backToTabs} onOpen={openWalletPage} onOpenPassword={() => setView({ name: 'payPwd' })} />
  } else if (view.name === 'walletChange') {
    content = (
      <Change
        onBack={() => setView({ name: 'wallet' })}
        onOpenFund={() => setView({ name: 'walletFund' })}
        onOpenBills={() => setView({ name: 'bills', filter: 'change' })}
        onOpenBankCards={() => setView({ name: 'bankcards' })}
      />
    )
  } else if (view.name === 'walletFund') {
    content = <ChangeFund onBack={() => setView({ name: 'wallet' })} onOpenBills={() => setView({ name: 'bills', filter: 'fund' })} />
  } else if (view.name === 'payCode') {
    content = <PayCode onBack={() => setView({ name: 'wallet' })} onOpenReceive={() => setView({ name: 'receiveCode' })} />
  } else if (view.name === 'receiveCode') {
    content = <ReceiveCode onBack={() => setView({ name: 'wallet' })} />
  } else if (view.name === 'scan') {
    content = <Scan onBack={() => setView({ name: 'wallet' })} />
  } else if (view.name === 'bills') {
    content = <Bills title="账单" initialFilter={view.filter ?? 'all'} onBack={() => setView({ name: 'wallet' })} onOpenDetail={(billId) => setView({ name: 'billDetail', billId })} />
  } else if (view.name === 'billDetail') {
    content = <BillDetail billId={view.billId} onBack={() => setView({ name: 'bills', filter: 'all' })} />
  } else if (view.name === 'redPacket') {
    content = (
      <RedPacket
        friendId={view.friendId}
        friendName={friends.find((f) => f.id === view.friendId)?.name}
        friendAvatar={friends.find((f) => f.id === view.friendId)?.avatar}
        onBack={() => (view.fromChat ? setView({ name: 'chat', friendId: view.friendId ?? '' }) : setView({ name: 'wallet' }))}
        onSubmit={submitRedPacket}
      />
    )
  } else if (view.name === 'redPacketRecords') {
    content = <RedPacketRecords onBack={() => setView({ name: 'wallet' })} />
  } else if (view.name === 'transfer') {
    content = (
      <Transfer
        friendId={view.friendId ?? null}
        friendName={friends.find((f) => f.id === view.friendId)?.name ?? ''}
        friendAvatar={friends.find((f) => f.id === view.friendId)?.avatar}
        onBack={() => (view.fromChat ? setView({ name: 'chat', friendId: view.friendId ?? '' }) : setView({ name: 'wallet' }))}
        onSubmit={submitTransfer}
      />
    )
  } else if (view.name === 'relativeCard') {
    content = (
      <RelativeCardPage
        onBack={() => setView({ name: 'wallet' })}
        onGiftSubmit={submitGift}
        onSpendSubmit={submitSpend}
      />
    )
  } else if (view.name === 'relativeGift') {
    content = (
      <RelativeGift
        friendId={view.friendId}
        friendName={friends.find((f) => f.id === view.friendId)?.name}
        friendAvatar={friends.find((f) => f.id === view.friendId)?.avatar}
        onBack={() => (view.fromChat ? setView({ name: 'chat', friendId: view.friendId ?? '' }) : setView({ name: 'wallet' }))}
        onSubmit={submitGift}
      />
    )
  } else if (view.name === 'paySuccess') {
    content = <PaySuccess data={view.data} onDone={() => setView(view.data.back)} />
  } else if (view.name === 'rpDetail') {
    const rpMsg = messages.find((m) => m.id === view.msgId && m.friendId === view.friendId)
    content = rpMsg ? (
      <RedPacketDetail friendId={view.friendId} msgId={view.msgId} onBack={() => setView({ name: 'chat', friendId: view.friendId })} />
    ) : (
      <div className="page">
        <div className="empty-hint">红包不存在</div>
      </div>
    )
  } else if (view.name === 'tfDetail') {
    const tfMsg = messages.find((m) => m.id === view.msgId && m.friendId === view.friendId)
    content = tfMsg ? (
      <TransferDetail
        friendId={view.friendId}
        msgId={view.msgId}
        onBack={() => setView({ name: 'chat', friendId: view.friendId })}
        onOpenBills={() => setView({ name: 'bills', filter: 'transfer' })}
      />
    ) : (
      <div className="page">
        <div className="empty-hint">转账不存在</div>
      </div>
    )
  } else if (view.name === 'relativeCardDetail') {
    const card = loadWallet().relativeCards.find((c) => c.id === view.cardId)
    content = card ? (
      <RelativeCardDetail card={card} onBack={() => (view.fromChat ? setView({ name: 'chat', friendId: view.friendId ?? '' }) : setView({ name: 'wallet' }))} />
    ) : (
      <div className="page">
        <div className="empty-hint">亲属卡不存在</div>
      </div>
    )
  } else if (view.name === 'payPwd') {
    content = <PayPasswordSet onBack={() => setView({ name: 'wallet' })} />
  } else if (view.name === 'bankcards') {
    content = <BankCards onBack={() => setView({ name: 'wallet' })} />
  } else if (view.name === 'chatSettings') {
    const friend = friends.find((f) => f.id === view.friendId)
    content = friend ? (
      <ChatSettings
        friend={friend}
        onBack={() => {
          refreshData()
          setView({ name: 'chat', friendId: view.friendId })
        }}
        onOpenProfile={() => setView({ name: 'friendDetail', friendId: view.friendId })}
        onOpenSearch={() => setView({ name: 'chatSearch', friendId: view.friendId })}
        onOpenBg={() => setView({ name: 'chatBg', friendId: view.friendId })}
        onOpenTranslateLang={() => setView({ name: 'translateLang', friendId: view.friendId })}
      />
    ) : (
      <div className="page">
        <div className="empty-hint">好友不存在</div>
      </div>
    )
  } else if (view.name === 'translateLang') {
    const friend = friends.find((f) => f.id === view.friendId)
    content = friend ? (
        <TranslateLang
          friend={friend}
          onBack={() => {
            refreshData()
            setView({ name: 'chatSettings', friendId: view.friendId })
          }}
        />
    ) : (
      <div className="page">
        <div className="empty-hint">好友不存在</div>
      </div>
    )
  } else if (view.name === 'chatSearch') {
    const friend = friends.find((f) => f.id === view.friendId)
    content = friend ? (
      <ChatSearch
        friendId={view.friendId}
        friendName={friend.name}
        onBack={() => setView({ name: 'chatSettings', friendId: view.friendId })}
        onJump={(messageId) => setView({ name: 'chat', friendId: view.friendId, jumpTo: messageId })}
      />
    ) : (
      <div className="page">
        <div className="empty-hint">好友不存在</div>
      </div>
    )
  } else if (view.name === 'chatBg') {
    const friend = friends.find((f) => f.id === view.friendId)
    content = friend ? (
      <ChatBackground
        friendId={view.friendId}
        friendName={friend.name}
        onBack={() => setView({ name: 'chatSettings', friendId: view.friendId })}
      />
    ) : (
      <div className="page">
        <div className="empty-hint">好友不存在</div>
      </div>
    )
  } else if (view.name === 'friendDetail') {
    const friend = friends.find((f) => f.id === view.friendId)
    content = friend ? (
      <FriendDetail
        friend={friend}
        onBack={backToTabs}
        onOpenChat={() => openChat(view.friendId)}
        onEdit={() => setView({ name: 'addFriend', friendId: view.friendId })}
        onDelete={() => {
          saveFriends(loadFriends().filter((f) => f.id !== view.friendId))
          saveMessages(loadMessages().filter((m) => m.friendId !== view.friendId))
          refreshData()
          setView({ name: 'tabs' })
        }}
      />
    ) : (
      <div className="page">
        <div className="empty-hint">好友不存在</div>
      </div>
    )
  } else if (view.name === 'moments') {
    content = <Moments onBack={backToTabs} />
  } else if (view.name === 'myProfile') {
    content = <MyProfile onBack={backToTabs} onEditPersona={(personaId) => setView({ name: 'addPersona', personaId })} onOpenMoments={() => setView({ name: 'moments' })} onOpenMemory={() => setView({ name: 'memory' })} />
  } else if (view.name === 'stickers') {
    content = <StickerPage onBack={() => setView({ name: 'tabs' })} />
  } else if (view.name === 'addPersona') {
    content = <AddPersona onBack={() => setView({ name: 'myProfile' })} personaId={view.personaId} />
  } else if (view.name === 'settings') {
    content = (
      <Settings
        onBack={backToTabs}
        onOpenApi={() => setView({ name: 'apiSetting' })}
        onOpenVision={() => setView({ name: 'visionApi' })}
        onOpenVoice={() => setView({ name: 'voiceApi' })}
      />
    )
  } else if (view.name === 'apiSetting') {
    content = <ApiSettingPage onBack={() => setView({ name: 'settings' })} />
  } else if (view.name === 'visionApi') {
    content = <VisionApiPage onBack={() => setView({ name: 'settings' })} />
  } else if (view.name === 'voiceApi') {
    content = <VoiceApiPage onBack={() => setView({ name: 'settings' })} />
  } else if (view.name === 'memory') {
    content = (
      <MemoryPage
        friendId={view.friendId}
        onBack={backToTabs}
        onPickFriend={(id) => setView({ name: 'memory', friendId: id })}
        onClearFriend={() => setView({ name: 'memory' })}
        onOpenApi={() => setView({ name: 'apiSetting' })}
      />
    )
  } else {
    content = (
      <div className="tab-shell">
        <div className="tab-content" key={tab}>
          {tab === 'messages' && (
            <Messages friends={friends} messages={messages} onOpenChat={openChat} onAddFriend={() => setView({ name: 'addFriend' })} onOpenMoments={() => setView({ name: 'moments' })} onRefresh={refreshData} />
          )}
          {tab === 'contacts' && (
            <Contacts
              friends={friends}
              onOpenChat={openChat}
              onOpenFriend={(friendId) => setView({ name: 'friendDetail', friendId })}
              onAddFriend={() => setView({ name: 'addFriend' })}
              onOpenMoments={() => setView({ name: 'moments' })}
            />
          )}
          {tab === 'discover' && <Discover onOpenMoments={() => setView({ name: 'moments' })} />}
          {tab === 'me' && <Me onOpenProfile={() => setView({ name: 'myProfile' })} onOpenSettings={() => setView({ name: 'settings' })} onOpenMoments={() => setView({ name: 'moments' })} onOpenMemory={() => setView({ name: 'memory' })} onOpenStickers={() => setView({ name: 'stickers' })} onOpenWallet={() => setView({ name: 'wallet' })} />}
        </div>
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.key} className={`tab-item ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.icon(tab === t.key)}
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    )
  }

  return <div className="phone">{content}</div>
}
