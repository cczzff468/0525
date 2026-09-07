import { useEffect, useRef, useState } from 'react'
import type { Friend, Message, RelativeCard, Sticker } from '../types'
import { Avatar, Modal, formatTimeFull } from '../components/common'
import { BackIcon, SendIcon, PlusBadgeIcon, MicIcon } from '../components/icons'
import { appendMessage, loadMessages, loadProfile, saveMessages, loadApiSetting, loadChatBgs, loadStickers, saveStickers, uid, patchFriendMsg, updateWallet, addBill, loadWallet } from '../store'
import { AiError, aiStream, chatUrl } from '../utils/ai'
import { friendMemoryContext, maybeAutoSummarize } from '../utils/memory'
import { fileToAvatar, fileToPhoto } from '../utils/image'
import { formatMoney } from '../utils/qr'

interface MenuPos {
  x: number
  y: number
  arrowX: number
  arrowBottom: boolean
}

interface ErrModal {
  title: string
  desc: string
  showSettings?: boolean
}

const ERR_TEXT: Record<string, { desc: string; showSettings?: boolean }> = {
  noapi: { desc: '请先去设置里配置 API', showSettings: true },
  offline: { desc: '网络已断开，检查连接' },
  connect: { desc: '连不上 API 地址，检查网络或地址是否正确' },
  timeout: { desc: '响应太慢，试试增加超时时间或换模型' },
  401: { desc: '密钥不对，去设置里换 Key', showSettings: true },
  403: { desc: '密钥没权限访问这个模型' },
  404: { desc: '地址或模型不存在，检查 API 设置', showSettings: true },
  429: { desc: '请求太频繁被限流，等会儿再试' },
  model: { desc: '模型不存在，重新拉取模型列表' },
  toolong: { desc: '内容太长，增加 MaxTokens 或缩短上下文' },
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const DRAFT_PREFIX = 'chat-draft:'
const loadDraftCache = (id: string) => {
  try {
    return localStorage.getItem(DRAFT_PREFIX + id) ?? ''
  } catch {
    return ''
  }
}
const saveDraftCache = (id: string, text: string) => {
  try {
    localStorage.setItem(DRAFT_PREFIX + id, text)
  } catch {
    /* ignore */
  }
}
const replyBusy: Record<string, boolean> = {}

const fmtClock = (ts: number, withSec: boolean) => {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return withSec ? `${hm}:${pad(d.getSeconds())}` : hm
}

const splitBurst = (text: string, n: number): string[] => {
  const parts = text
    .split(/\s*\|\|\|\s*/)
    .map((s) => s.trim())
    .filter((s) => s && !SEG_PUNCT.test(s))
  if (parts.length > 1 || n <= 1) return parts
  const sentences = text.replace(/\n+/g, '。').match(/[^。！？!?~…]+[。！？!?~…]?/g) ?? []
  const cleaned = sentences.map((s) => s.trim()).filter(Boolean)
  if (cleaned.length < 2) return parts
  const per = Math.max(1, Math.ceil(cleaned.length / n))
  const out: string[] = []
  for (let i = 0; i < cleaned.length; i += per) {
    out.push(cleaned.slice(i, i + per).join(''))
  }
  return out
}

function msgWidth(text: string): number {
  return text.length * 15 + 26
}

const CONTENT_RE = /\[表情[:：]([^\[\]]{1,12})\]|\[位置[:：]([^\[\]]{1,20})\]|\[文字图片[:：]([^\[\]]{1,60})\]|\[红包[:：]([^\[\]]{1,30})\]|\[转账[:：]([^\[\]]{1,30})\]|\[亲属卡[:：]([^\[\]]{1,40})\]/g

type StickerFrag =
  | { t: 'text'; v: string }
  | { t: 'img'; url: string }
  | { t: 'loc'; name: string }
  | { t: 'txtimg'; v: string }
  | { t: 'rp'; blessing: string; amount: number }
  | { t: 'tf'; amount: number; note: string }

function findSticker(custom: Sticker[], name: string): Sticker | undefined {
  return custom.find((s) => s.meaning === name) ?? custom.find((s) => s.meaning.includes(name) || name.includes(s.meaning))
}

function parseChatContent(text: string, custom: Sticker[]): StickerFrag[] {
  const frags: StickerFrag[] = []
  let last = 0
  CONTENT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CONTENT_RE.exec(text))) {
    if (m.index > last) frags.push({ t: 'text', v: text.slice(last, m.index) })
    if (m[1] !== undefined) {
      const c = findSticker(custom, m[1].trim())
      if (c) frags.push({ t: 'img', url: c.url })
    } else if (m[2] !== undefined) {
      frags.push({ t: 'loc', name: m[2].trim() })
    } else if (m[3] !== undefined) {
      frags.push({ t: 'txtimg', v: m[3].trim() })
    } else if (m[4] !== undefined) {
      const [blessing, amountRaw] = m[4].split('|')
      const amount = Math.round(Number(amountRaw) * 100) / 100
      if (amount > 0) frags.push({ t: 'rp', blessing: (blessing || '恭喜发财，大吉大利').trim(), amount })
      else frags.push({ t: 'text', v: m[0] })
    } else {
      const [amountRaw, note] = m[5].split('|')
      const amount = Math.round(Number(amountRaw) * 100) / 100
      if (amount > 0) frags.push({ t: 'tf', amount, note: (note || '转账').trim() })
      else frags.push({ t: 'text', v: m[0] })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) frags.push({ t: 'text', v: text.slice(last) })
  return frags
}

function makeTextImage(text: string): string {
  const W = 800
  const H = 800
  const pad = 90
  const maxW = W - pad * 2
  const font = (size: number) => `600 ${size}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
  const measure = document.createElement('canvas').getContext('2d')!
  const wrap = (size: number): string[] => {
    measure.font = font(size)
    const lines: string[] = []
    let cur = ''
    for (const ch of text) {
      if (ch === '\n') {
        lines.push(cur)
        cur = ''
        continue
      }
      if (cur && measure.measureText(cur + ch).width > maxW) {
        lines.push(cur)
        cur = ch
      } else {
        cur += ch
      }
    }
    lines.push(cur)
    return lines
  }
  let fontSize = text.length <= 6 ? 96 : text.length <= 16 ? 72 : 56
  let lines = wrap(fontSize)
  while (lines.length * fontSize * 1.5 > H - pad * 1.6 && fontSize > 30) {
    fontSize -= 6
    lines = wrap(fontSize)
  }
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.font = font(fontSize)
  ctx.fillStyle = '#1a1a1a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lineH = fontSize * 1.5
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lineH))
  return canvas.toDataURL('image/png')
}

const SEG_PUNCT = /^[\s.,，、;；:：!！?？~～…·—–\-'"“”‘’()（）【】\[\]《》<>「」『』*&#@\\/|+=%￥$^_]+$/
const LEADING_PUNCT = /^[\s.,，、;；:：!！?？~～…·—–\-]+/

function cleanSeg(s: string, stripLead = false): string {
  let t = s.trim()
  if (stripLead) t = t.replace(LEADING_PUNCT, '').trim()
  if (!t || SEG_PUNCT.test(t)) return ''
  return t
}

function splitReplyMsgs(part: string, stickers: Sticker[], friendId: string, friendName: string): Message[] {
  const out: Message[] = []
  const mk = (extra: Partial<Message>): Message => ({ id: uid(), friendId, from: 'friend', text: '', time: Date.now(), ...extra })
  let last = 0
  CONTENT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CONTENT_RE.exec(part))) {
    if (m.index > last) {
      const t = cleanSeg(part.slice(last, m.index))
      if (t) out.push(mk({ text: t }))
    }
    if (m[1] !== undefined) {
      const name = m[1].trim()
      const c = findSticker(stickers, name)
      if (c) out.push(mk({ text: name, sticker: { meaning: name, url: c.url } }))
    } else if (m[2] !== undefined) {
      const name = m[2].trim()
      out.push(mk({ text: `[位置:${name}]`, location: { name } }))
    } else if (m[3] !== undefined) {
      const v = m[3].trim()
      out.push(mk({ text: v, sticker: { meaning: '文字图片', url: makeTextImage(v) } }))
    } else if (m[4] !== undefined) {
      const [blessing, amountRaw] = m[4].split('|')
      const amount = Math.round(Number(amountRaw) * 100) / 100
      const bl = (blessing || '恭喜发财，大吉大利').trim()
      if (amount > 0) out.push(mk({ text: `[红包:${bl}|${amount}]`, redpacket: { amount, blessing: bl, status: '待领取' } }))
      else out.push(mk({ text: m[0] }))
    } else if (m[6] !== undefined) {
      const raw = m[6]
      const [first, second] = raw.split('|')
      const numRe = /(\d+(?:\.\d{1,2})?)/
      const numOf = (s: string) => {
        const mm = numRe.exec(s || '')
        return mm ? Math.round(Number(mm[1]) * 100) / 100 : 0
      }
      const clean = (s: string) => (s || '').replace(numRe, '').replace(/元|额度|每月/g, '').replace(/^[：:\s]+/, '').trim()
      let amount = numOf(first)
      let remark = clean(second)
      if (amount <= 0) {
        amount = numOf(second)
        remark = clean(first) || remark
      }
      if (amount > 0 && amount <= 3000) {
        const card: RelativeCard = { id: uid(), friendId, friendName, monthlyLimit: amount, used: 0, direction: 'received', status: 'pending', createdAt: Date.now() }
        updateWallet((x) => ({ ...x, relativeCards: [...x.relativeCards, card] }))
        out.push(mk({ text: remark || `${friendName}赠送的亲属卡`, relativeCard: { cardId: card.id, status: '待领取' } }))
      } else {
        out.push(mk({ text: m[0] }))
      }
    } else {
      const [amountRaw, note] = m[5].split('|')
      const amount = Math.round(Number(amountRaw) * 100) / 100
      const nt = (note || '转账').trim()
      if (amount > 0) out.push(mk({ text: `[转账:${amount}|${nt}]`, transfer: { amount, note: nt, status: '待收款' } }))
      else out.push(mk({ text: m[0] }))
    }
    last = m.index + m[0].length
  }
  const tail = cleanSeg(part.slice(last), true)
  if (tail) out.push(mk({ text: tail }))
  return out
}

export default function Chat({
  friend,
  onBack,
  onEditFriend,
  onOpenSettings,
  onOpenChatSettings,
  onOpenStickers,
  onOpenLocation,
  onOpenRedPacket,
  onOpenTransfer,
  onOpenRelativeGift,
  onOpenRedPacketDetail,
  onOpenTransferDetail,
  onOpenRelativeCardDetail,
  pendingLocation,
  onConsumeLocation,
  jumpTo,
}: {
  friend: Friend
  onBack: () => void
  onEditFriend: () => void
  onOpenSettings: () => void
  onOpenChatSettings: () => void
  onOpenStickers: () => void
  onOpenLocation: () => void
  onOpenRedPacket: () => void
  onOpenTransfer: () => void
  onOpenRelativeGift: () => void
  onOpenRedPacketDetail: (friendId: string, msgId: string) => void
  onOpenTransferDetail: (friendId: string, msgId: string) => void
  onOpenRelativeCardDetail: (cardId: string) => void
  pendingLocation: { name: string; address?: string } | null
  onConsumeLocation: () => void
  jumpTo?: string
}) {
  const [messages, setMessages] = useState<Message[]>(() => loadMessages().filter((m) => m.friendId === friend.id).sort((a, b) => a.time - b.time))
  const [draft, setDraftRaw] = useState<string>(() => loadDraftCache(friend.id))
  const setDraft = (v: string | ((p: string) => string)) => {
    setDraftRaw((prev) => {
      const next = typeof v === 'function' ? (v as (p: string) => string)(prev) : v
      saveDraftCache(friend.id, next)
      return next
    })
  }
  const [typing, setTyping] = useState(false)
  const [streaming, setStreaming] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<Message | null>(null)
  const [menuPos, setMenuPos] = useState<MenuPos>({ x: 0, y: 0, arrowX: 0, arrowBottom: false })
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [replyQuote, setReplyQuote] = useState<Message | null>(null)
  const [editMsg, setEditMsg] = useState<Message | null>(null)
  const [hint, setHint] = useState('')
  const [errModal, setErrModal] = useState<ErrModal | null>(null)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [stickerOpen, setStickerOpen] = useState(false)
  const [plusOpen, setPlusOpen] = useState(false)
  const [myStickers, setMyStickers] = useState<Sticker[]>(() => loadStickers())
  const [uploadQueue, setUploadQueue] = useState<string[]>([])
  const [meaningDraft, setMeaningDraft] = useState('')
  const [textImageOpen, setTextImageOpen] = useState(false)
  const [textImageDraft, setTextImageDraft] = useState('')
  const [queuedCount, setQueuedCount] = useState(0)
  const [rpOpen, setRpOpen] = useState<{ msg: Message; phase: 'cover' | 'opened' } | null>(null)
  const [tfConfirm, setTfConfirm] = useState<Message | null>(null)
  const [rcOpen, setRcOpen] = useState<{ msg: Message; phase: 'cover' | 'claimed' } | null>(null)

  const patchMsg = (id: string, patch: Partial<Message>) => {
    patchFriendMsg(friend.id, id, patch)
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  const rcCardOf = (m: Message) => {
    const cid = m.relativeCard?.cardId
    if (!cid) return undefined
    return loadWallet().relativeCards.find((c) => c.id === cid)
  }

  const rcDesc = (m: Message) => {
    const c = rcCardOf(m)
    if (!c) return m.text || '亲属卡'
    const who = m.from === 'me' ? friend.name : c.friendName || friend.name
    return c.direction === 'received' ? `来自${who} · 每月额度 ¥${formatMoney(c.monthlyLimit)}` : `赠送给${who} · 每月额度 ¥${formatMoney(c.monthlyLimit)}`
  }

  const openRedPacket = (m: Message) => {
    if (!m.redpacket) return
    if (m.from === 'friend' && m.redpacket.status === '待领取') setRpOpen({ msg: m, phase: 'cover' })
    else onOpenRedPacketDetail(friend.id, m.id)
  }

  const claimRedPacket = () => {
    const src = rpOpen?.msg
    if (!src?.redpacket) return
    const rp = src.redpacket
    const next: Message = { ...src, redpacket: { ...rp, status: '已领取', openedBy: '我', openedAt: Date.now() } }
    if (src.from === 'friend' && rp.status === '待领取') {
      updateWallet((x) => ({ ...x, balance: Math.round((x.balance + rp.amount) * 100) / 100 }))
      addBill({ kind: '红包', title: `${friend.name}的红包`, amount: rp.amount, status: '已存入零钱', friendName: friend.name, note: rp.blessing })
      patchMsg(src.id, { redpacket: next.redpacket })
      const recv: Message = { id: uid(), friendId: friend.id, from: 'me', text: '', time: Date.now(), receipt: { kind: 'redpacket', amount: rp.amount, srcMsgId: src.id } }
      appendMessage(recv)
      setMessages((prev) => [...prev, recv])
      showHint(`已领取 ¥${formatMoney(rp.amount)}`)
    }
    setRpOpen({ msg: next, phase: 'opened' })
    onOpenRedPacketDetail(friend.id, src.id)
  }

  const refundRedPacket = () => {
    const src = rpOpen?.msg
    if (!src?.redpacket) return
    if (src.from === 'friend' && src.redpacket.status === '待领取') {
      patchMsg(src.id, { redpacket: { ...src.redpacket, status: '已退还' } })
      const recv: Message = { id: uid(), friendId: friend.id, from: 'me', text: `已退还${friend.name}的红包`, time: Date.now() }
      appendMessage(recv)
      setMessages((prev) => [...prev, recv])
      showHint('已退还')
    }
    setRpOpen(null)
  }

  const openTransfer = (m: Message) => {
    if (!m.transfer) return
    if (m.from === 'friend' && m.transfer.status === '待收款') setTfConfirm(m)
    else onOpenTransferDetail(friend.id, m.id)
  }

  const confirmTransfer = () => {
    const src = tfConfirm
    if (!src?.transfer) return
    const t = src.transfer
    updateWallet((x) => ({ ...x, balance: Math.round((x.balance + t.amount) * 100) / 100 }))
    addBill({ kind: '转账', title: `${friend.name}的转账`, amount: t.amount, status: '已存入零钱', friendName: friend.name, note: t.note })
    patchMsg(src.id, { transfer: { ...t, status: '已收款', confirmedAt: Date.now() } })
    const recv: Message = { id: uid(), friendId: friend.id, from: 'me', text: '', time: Date.now(), receipt: { kind: 'transfer', amount: t.amount, srcMsgId: src.id } }
    appendMessage(recv)
    setMessages((prev) => [...prev, recv])
    setTfConfirm(null)
    showHint(`已收钱 ¥${formatMoney(t.amount)}`)
    onOpenTransferDetail(friend.id, src.id)
  }

  const refundTransfer = () => {
    const src = tfConfirm
    if (!src?.transfer) return
    if (src.from === 'friend' && src.transfer.status === '待收款') {
      patchMsg(src.id, { transfer: { ...src.transfer, status: '已退还' } })
      const recv: Message = { id: uid(), friendId: friend.id, from: 'me', text: `已将转账退还给${friend.name}`, time: Date.now() }
      appendMessage(recv)
      setMessages((prev) => [...prev, recv])
      showHint('已退还')
    }
    setTfConfirm(null)
  }

  const openRcCard = (m: Message) => {
    if (!m.relativeCard) return
    if (m.from === 'friend' && m.relativeCard.status === '待领取') setRcOpen({ msg: m, phase: 'cover' })
    else onOpenRelativeCardDetail(m.relativeCard.cardId)
  }

  const claimRelativeCard = () => {
    const src = rcOpen?.msg
    if (!src?.relativeCard) return
    const card = rcCardOf(src)
    if (src.from === 'friend' && src.relativeCard.status === '待领取' && card && card.status === 'pending') {
      updateWallet((x) => ({
        ...x,
        relativeCards: x.relativeCards.map((c) => (c.id === card.id ? { ...c, status: 'claimed', claimedAt: Date.now() } : c)),
      }))
      patchMsg(src.id, { relativeCard: { cardId: card.id, status: '已领取' } })
      const recv: Message = { id: uid(), friendId: friend.id, from: 'me', text: '', time: Date.now(), receipt: { kind: 'rc', amount: card.monthlyLimit, srcMsgId: src.id, cardId: card.id } }
      appendMessage(recv)
      setMessages((prev) => [...prev, recv])
      setRcOpen({ msg: { ...src, relativeCard: { cardId: card.id, status: '已领取' } }, phase: 'claimed' })
      showHint(`已领用，每月额度 ¥${formatMoney(card.monthlyLimit)}`)
    }
  }

  const refundRelativeCard = () => {
    const src = rcOpen?.msg
    if (!src?.relativeCard) return
    const card = rcCardOf(src)
    if (src.from === 'friend' && src.relativeCard.status === '待领取' && card && card.status === 'pending') {
      updateWallet((x) => ({
        ...x,
        relativeCards: x.relativeCards.map((c) => (c.id === card.id ? { ...c, status: 'rejected', rejectedAt: Date.now() } : c)),
      }))
      patchMsg(src.id, { relativeCard: { cardId: card.id, status: '已退还' } })
      const recv: Message = { id: uid(), friendId: friend.id, from: 'me', text: `已退还${card.friendName || friend.name}赠送的亲属卡`, time: Date.now() }
      appendMessage(recv)
      setMessages((prev) => [...prev, recv])
      showHint('已退还')
    }
    setRcOpen(null)
  }
  const listRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number>(0)
  const pressRef = useRef<number>(0)
  const busyRef = useRef(false)
  const transBusyRef = useRef(false)
  const recogRef = useRef<any>(null)
  const msgsRef = useRef(messages)
  const hintTimer = useRef<number>(0)

  useEffect(() => {
    msgsRef.current = messages
  }, [messages])

  useEffect(() => {
    if (!jumpTo) return
    const t = window.setTimeout(() => {
      const el = document.getElementById('msg-' + jumpTo)
      if (el) {
        el.scrollIntoView({ block: 'center' })
        el.classList.add('chat-msg-jump')
        window.setTimeout(() => el.classList.remove('chat-msg-jump'), 2000)
      }
    }, 150)
    return () => window.clearTimeout(t)
  }, [jumpTo])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streaming, typing, stickerOpen])

  useEffect(
    () => () => {
      window.clearTimeout(pressRef.current)
      try {
        recogRef.current?.stop()
      } catch {
        /* ignore */
      }
    },
    []
  )

  const stopVoice = () => {
    try {
      recogRef.current?.stop()
    } catch {
      /* ignore */
    }
  }

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      showHint('当前浏览器不支持语音识别，请用 Chrome 或 Edge')
      return
    }
    const voice = loadApiSetting().voice
    if (!voice.sttEnabled) {
      showHint('语音输入未开启，请在 设置-语音配置 中打开')
      return
    }
    if (listening) {
      stopVoice()
      return
    }
    try {
      const r = new SR()
      r.lang = voice.sttLang || 'zh-CN'
      r.interimResults = true
      r.maxAlternatives = 1
      r.onresult = (e: any) => {
        let fin = ''
        let itm = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript
          if (e.results[i].isFinal) fin += t
          else itm += t
        }
        if (fin) setDraft((p) => (p + fin).slice(0, 500))
        setInterim(itm)
      }
      r.onerror = (e: any) => {
        const msg =
          e.error === 'not-allowed' || e.error === 'service-not-allowed'
            ? '麦克风权限被拒绝，请在浏览器地址栏允许麦克风'
            : e.error === 'no-speech'
              ? '没有听到说话'
              : '识别出错，请再试一次'
        showHint(msg)
      }
      r.onend = () => {
        setListening(false)
        setInterim('')
        recogRef.current = null
      }
      r.start()
      recogRef.current = r
      setListening(true)
    } catch {
      showHint('无法启动语音识别')
    }
  }

  const commit = (next: Message[]) => {
    setMessages(next)
    saveMessages(loadMessages().filter((m) => m.friendId !== friend.id).concat(next))
  }

  const showHint = (t: string) => {
    setHint(t)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(''), 1600)
  }

  const chatBgStyle = (() => {
    const bg = loadChatBgs()[friend.id]
    if (!bg) return undefined
    return bg.type === 'image'
      ? { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: bg.value }
  })()

  const [transMap, setTransMap] = useState<Record<string, string>>({})
  const transPendingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!friend.autoTranslate || transBusyRef.current) return
    const src = friend.translateSrc || '中文简体'
    const dst = friend.translateLang || '英语'
    if (src === dst) return
    const targets = msgsRef.current
      .filter((m) => {
        if (m.from !== 'friend' || !m.text.trim()) return false
        if (transMap[m.id] || transPendingRef.current.has(m.id)) return false
        return true
      })
      .slice(-30)
    if (targets.length === 0) return
    transBusyRef.current = true
    const ids = new Set(targets.map((t) => t.id))
    targets.forEach((t) => transPendingRef.current.add(t.id))
    const translateBatch = async () => {
      try {
        const cfg = loadApiSetting()
        if (!cfg.baseUrl.trim() || !cfg.model.trim()) return
        const numbered = targets.map((m, i) => `${i + 1}. ${m.text.replace(/\n/g, ' ')}`).join('\n')
        const res = await fetch(chatUrl(cfg.baseUrl), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cfg.apiKey.trim() ? { Authorization: `Bearer ${cfg.apiKey.trim()}` } : {}),
          },
          body: JSON.stringify({
            model: cfg.model.trim(),
            messages: [
              {
                role: 'system',
                content: `你是翻译助手。把用户给的编号聊天消息逐条做 ${src} ⇄ ${dst} 双向翻译：消息为${src}或接近${src}时译成${dst}，为${dst}或接近${dst}时译成${src}，其他语言也译成${src}。输出与输入相同的编号行（如 "1. xxx"），一行一条，只输出译文。`
              },
              { role: 'user', content: numbered },
            ],
            temperature: 0.2,
            stream: false,
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        const text: string = data?.choices?.[0]?.message?.content ?? ''
        const map: Record<string, string> = {}
        for (const line of text.split('\n')) {
          const m = /^\s*(\d+)[.、)]\s*(.+)$/.exec(line)
          if (m) {
            const idx = Number(m[1]) - 1
            if (idx >= 0 && idx < targets.length) map[targets[idx].id] = m[2].trim()
          }
        }
        if (Object.keys(map).length > 0) setTransMap((prev) => ({ ...prev, ...map }))
      } catch {
        /* silent: retry on next message */
      } finally {
        for (const id of ids) transPendingRef.current.delete(id)
        transBusyRef.current = false
      }
    }
    translateBatch()
  }, [friend.autoTranslate, friend.translateLang, messages, transMap])

  const doCopy = (text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => copyFallback(text))
    } else {
      copyFallback(text)
    }
    showHint('已复制')
  }

  const showError = (err: unknown) => {
    setTyping(false)
    setStreaming(null)
    busyRef.current = false
    const e = err instanceof AiError ? err : new AiError('other', err instanceof Error ? err.message : String(err))
    if (e.code === 'other' && e.detail) {
      setErrModal({ title: '消息发送失败', desc: `出错了：${e.detail}` })
      return
    }
    const t = ERR_TEXT[e.code] ?? { desc: '出错了，请稍后再试' }
    setErrModal({ title: '消息发送失败', desc: t.desc, showSettings: t.showSettings })
  }

  const respond = () => {
    if (replyBusy[friend.id]) return
    replyBusy[friend.id] = true
    busyRef.current = true
    timerRef.current = window.setTimeout(async () => {
      setTyping(true)
      const history = msgsRef.current.map((m) => ({
        role: m.from === 'me' ? ('user' as const) : ('assistant' as const),
        content: m.quote ? `（引用 TA 的消息："${m.quote}"）${m.text}` : m.text,
      }))
      let started = false
      const onDelta = (chunk: string) => {
        if (!started) {
          started = true
          setTyping(false)
        }
        setStreaming((prev) => ((prev ?? '') + chunk).replace(/\|\|\|/g, '\n'))
      }
      try {
        const { text, truncated } = await aiStream(history, friend, loadProfile(), onDelta, friendMemoryContext(friend.id))
        setTyping(false)
        setStreaming(null)
        const parts = splitBurst(text, friend.burstCount ?? 10)
        const units = parts.map((p) => splitReplyMsgs(p, loadStickers(), friend.id, friend.name))
        for (let i = 0; i < units.length; i++) {
          for (let j = 0; j < units[i].length; j++) {
            const unit = units[i][j]
            if (!unit || !unit.text) continue
            if (j > 0) {
              await sleep(180 + Math.random() * 160)
            } else if (i > 0) {
              setTyping(true)
              await sleep(300 + Math.random() * 400)
              setTyping(false)
            }
            commit([...loadMessages().filter((x) => x.friendId === friend.id), unit])
          }
        }
        busyRef.current = false
        replyBusy[friend.id] = false
        if (truncated) setErrModal({ title: '回复被截断', desc: ERR_TEXT.toolong.desc })
        maybeAutoSummarize(friend.id).catch(() => {})
      } catch (err) {
        replyBusy[friend.id] = false
        showError(err)
      }
    }, 900 + Math.random() * 600)
  }

  const afterSend = () => {
    if (friend.queuedSend) {
      setQueuedCount((n) => n + 1)
    } else {
      respond()
    }
  }

  const send = () => {
    const text = draft.trim()
    if (!text) {
      if (!editMsg && friend.queuedSend && queuedCount > 0 && !busyRef.current) {
        setQueuedCount(0)
        respond()
      }
      return
    }
    if (busyRef.current) return
    if (editMsg) {
      commit(msgsRef.current.map((m) => (m.id === editMsg.id ? { ...m, text } : m)))
      setEditMsg(null)
      setDraft('')
      showHint('已修改')
      return
    }
    setDraft('')
    const msg: Message = {
      id: uid(),
      friendId: friend.id,
      from: 'me',
      text,
      time: Date.now(),
      quote: replyQuote?.text,
    }
    setReplyQuote(null)
    commit([...msgsRef.current, msg])
    afterSend()
  }

  const sendSticker = (payload: { meaning: string; url?: string; emoji?: string }) => {
    if (busyRef.current || editMsg) return
    commit([...msgsRef.current, { id: uid(), friendId: friend.id, from: 'me', text: payload.meaning, time: Date.now(), sticker: payload }])
    afterSend()
  }

  const sendImageMsg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    if (busyRef.current || editMsg) {
      showHint('等对方说完再发图片哦')
      return
    }
    try {
      const url = await fileToPhoto(file)
      commit([...msgsRef.current, { id: uid(), friendId: friend.id, from: 'me', text: '[图片]', time: Date.now(), sticker: { meaning: '发了一张图片', url } }])
      afterSend()
    } catch {
      showHint('图片读取失败，请换一张试试')
    }
  }

  const sendLocation = (loc: { name: string; address?: string }) => {
    if (editMsg) {
      showHint('编辑消息时不能发位置')
      return
    }
    commit([...msgsRef.current, { id: uid(), friendId: friend.id, from: 'me', text: `[位置:${loc.name}]`, time: Date.now(), location: loc }])
    if (!busyRef.current) afterSend()
  }

  useEffect(() => {
    if (!pendingLocation) return
    sendLocation(pendingLocation)
    onConsumeLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLocation])

  useEffect(() => {
    setDraftRaw(loadDraftCache(friend.id))
  }, [friend.id])

  useEffect(() => {
    setMessages(loadMessages().filter((m) => m.friendId === friend.id).sort((a, b) => a.time - b.time))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.lastTime, friend.lastMessage])

  const sendTextImage = () => {
    const content = textImageDraft.trim()
    if (!content) {
      showHint('先输入要生成图片的文字')
      return
    }
    if (busyRef.current || editMsg) {
      showHint('等对方说完再发哦')
      return
    }
    const url = makeTextImage(content)
    setTextImageOpen(false)
    setTextImageDraft('')
    commit([...msgsRef.current, { id: uid(), friendId: friend.id, from: 'me', text: content, time: Date.now(), sticker: { meaning: '文字图片', url } }])
    afterSend()
  }

  const saveStickerFromQueue = (meaning: string) => {
    const url = uploadQueue[0]
    if (!url) return
    const item: Sticker = { id: uid(), meaning: meaning.trim() || '表情包', url, createdAt: Date.now() }
    const next = [...myStickers, item]
    saveStickers(next)
    setMyStickers(next)
    setUploadQueue((q) => q.slice(1))
    setMeaningDraft('')
    showHint('已保存到我的表情包')
  }

  const discardStickerFromQueue = () => {
    setUploadQueue((q) => q.slice(1))
    setMeaningDraft('')
  }

  const pickStickerFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/')).slice(0, 12)
    e.target.value = ''
    if (files.length === 0) return
    const urls: string[] = []
    for (const f of files) {
      try {
        urls.push(await fileToAvatar(f))
      } catch {
        /* skip unreadable file */
      }
    }
    if (urls.length === 0) {
      showHint('图片读取失败，请换一张试试')
      return
    }
    setStickerOpen(true)
    setUploadQueue((q) => [...q, ...urls])
    setMeaningDraft('')
  }

  const startEdit = (m: Message) => {
    setReplyQuote(null)
    setMenuFor(null)
    setEditMsg(m)
    setDraft(m.text)
  }

  const cancelEdit = () => {
    setEditMsg(null)
    setDraft('')
  }

  const startQuote = (m: Message) => {
    setMenuFor(null)
    setEditMsg(null)
    setDraft('')
    setReplyQuote(m)
  }

  const regenerate = (m: Message) => {
    setMenuFor(null)
    if (busyRef.current) return
    const all = msgsRef.current
    const idx = all.findIndex((x) => x.id === m.id)
    if (idx < 0) return
    let start = idx
    while (start > 0 && all[start - 1].from === 'friend') start--
    let end = idx
    while (end + 1 < all.length && all[end + 1].from === 'friend') end++
    commit(all.filter((_, i) => i < start || i > end))
    respond()
  }

  const deleteOne = (m: Message) => {
    setMenuFor(null)
    commit(msgsRef.current.filter((x) => x.id !== m.id))
    showHint('已删除')
  }

  const enterSelect = (m: Message) => {
    setMenuFor(null)
    setReplyQuote(null)
    setEditMsg(null)
    setDraft('')
    setSelectMode(true)
    setSelectedIds(new Set([m.id]))
  }

  const exitSelect = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(msgsRef.current.map((m) => m.id)))
  }

  const deleteSelected = () => {
    if (selectedIds.size === 0) return
    const n = selectedIds.size
    commit(msgsRef.current.filter((m) => !selectedIds.has(m.id)))
    showHint(`已删除 ${n} 条消息`)
    exitSelect()
  }

  const copySelected = () => {
    const text = msgsRef.current
      .filter((m) => selectedIds.has(m.id))
      .map((m) => `${m.from === 'me' ? '我' : friend.name}：${m.text}`)
      .join('\n')
    if (!text) return
    doCopy(text)
  }

  function menuWidthFor(m: Message): number {
    const labels = m.from === 'me' ? ['复制', '编辑', '删除', '多选'] : ['复制', '引用', '编辑', '重新生成', '删除', '多选']
    return 12 + labels.reduce((w, t) => w + msgWidth(t) + 1, 0)
  }

  const openMsgMenu = (m: Message, rect: DOMRect) => {
    const items = menuWidthFor(m)
    const menuH = 42
    const up = rect.top > menuH + 34
    const x =
      m.from === 'me'
        ? Math.min(window.innerWidth - items - 8, Math.max(8, rect.right - items / 2 - 34))
        : Math.max(8, Math.min(rect.left + rect.width / 2 - items / 2 + 34, window.innerWidth - items - 8))
    setMenuPos({
      x,
      y: up ? rect.top - menuH - 14 : rect.bottom + 14,
      arrowX: Math.min(Math.max(rect.left + rect.width / 2 - x - 6, 14), items - 26),
      arrowBottom: up,
    })
    setMenuFor(m)
  }

  const onTouchStart = (m: Message) => (e: React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    window.clearTimeout(pressRef.current)
    pressRef.current = window.setTimeout(() => openMsgMenu(m, rect), 480)
  }
  const onTouchClear = () => window.clearTimeout(pressRef.current)
  const onContextMenu = (m: Message) => (e: React.MouseEvent) => {
    e.preventDefault()
    openMsgMenu(m, (e.currentTarget as HTMLElement).getBoundingClientRect())
  }

  const meProfile = loadProfile()
  const quoteBar = editMsg ?? replyQuote

  return (
    <div className="page chat-page">
      <div className="chat-nav">
        <button className="chat-back" onClick={onBack} aria-label="返回">
          <BackIcon />
        </button>
        <div className="chat-nav-center" onClick={onEditFriend} role="button" tabIndex={0}>
          <Avatar name={friend.name} src={friend.avatar} size={36} />
          <div className="chat-nav-name-row">
            {typing ? (
              <span className="chat-nav-name chat-nav-typing">
                正在输入中
                <span className="chat-typing-dots">
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            ) : (
              <span className="chat-nav-name">{friend.remark?.trim() || friend.name}</span>
            )}
            {friend.muted && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="chat-nav-muted" aria-label="已开启免打扰">
                <path
                  d="M12 4.5a4.7 4.7 0 0 0-4.7 4.7c0 4.3-1.4 6.1-1.4 6.1h12.2s-1.4-1.8-1.4-6.1A4.7 4.7 0 0 0 12 4.5Z"
                  stroke="#a2a2a8"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path d="M10.4 18.7a1.9 1.9 0 0 0 3.2 0" stroke="#a2a2a8" strokeWidth="1.8" strokeLinecap="round" />
                <path d="m5 4.7 14 14.6" stroke="#c6c6cb" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            )}
            <svg width="8" height="13" viewBox="0 0 9 15" fill="none">
              <path d="m1.5 1.5 5.5 6-5.5 6" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <button className="chat-facetime" onClick={onOpenChatSettings} aria-label="聊天设置">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="5" cy="12" r="1.7" fill="#0a84ff" />
            <circle cx="12" cy="12" r="1.7" fill="#0a84ff" />
            <circle cx="19" cy="12" r="1.7" fill="#0a84ff" />
          </svg>
        </button>
      </div>

      {selectMode && (
        <div className="chat-select-bar">
          <button className="chat-select-cancel" onClick={exitSelect}>
            取消
          </button>
          <span className="chat-select-count">已选择 {selectedIds.size} 条</span>
          <button className="chat-select-all" onClick={selectAll}>
            全选
          </button>
        </div>
      )}

      <div className="chat-list" ref={listRef} style={chatBgStyle}>
        {messages.map((m, i) => {
          const showTime = i === 0 || m.time - messages[i - 1].time > 5 * 60 * 1000
          const tight = i > 0 && messages[i - 1].from === m.from && !showTime
          const checked = selectedIds.has(m.id)
          const avatarStyle = friend.avatarStyle ?? 'group'
          const needAvSpace = m.from === 'friend' && avatarStyle !== 'none' && !selectMode
          const avShown = needAvSpace && (avatarStyle === 'show' || !tight)
          const meAvShown = m.from === 'me' && avatarStyle !== 'none' && !selectMode && (avatarStyle === 'show' || !tight)
          const mineRead = messages.slice(i + 1).some((x) => x.from === 'friend')
          const readLabel = m.from === 'friend' || mineRead ? '已读' : '未读'
          const withSec = (friend.timeFormat ?? 'hm') === 'hms'
          return (
            <div key={m.id} id={'msg-' + m.id} className="chat-msg-anchor">
              {showTime && (
                <div className="chat-time">
                  <div>iMessage</div>
                  <div>{formatTimeFull(m.time)}</div>
                </div>
              )}
              <div className={`chat-row ${m.from === 'me' ? 'me' : 'them'} ${tight ? 'tight' : ''} ${selectMode ? 'selectable' : ''}`}>
                {selectMode && (
                  <span className={`chat-check ${checked ? 'on' : ''}`} onClick={() => toggleSelect(m.id)} role="button" tabIndex={0}>
                    {checked && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6.2 4.8 9 10 3.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                )}
                {m.from === 'friend' && needAvSpace ? (
                  avShown ? (
                    <span className="chat-avatar-col">
                      <span className="chat-avatar-btn" onClick={onEditFriend} role="button" tabIndex={0}>
                        <Avatar name={friend.name} src={friend.avatar} size={34} />
                      </span>
                      {friend.timeStyle === 'avatar' && <span className="chat-meta">{fmtClock(m.time, withSec)}</span>}
                      {friend.readStyle === 'avatar' && <span className="chat-meta">{readLabel}</span>}
                    </span>
                  ) : (
                    <span className="chat-avatar-spacer" />
                  )
                ) : null}
                <div className="chat-bubble-col">
                  {m.receipt ? (
                    <div
                      className="receipt-bare"
                      onTouchStart={onTouchStart(m)}
                      onTouchEnd={onTouchClear}
                      onTouchMove={onTouchClear}
                      onContextMenu={onContextMenu(m)}
                      onClick={() => {
                        if (selectMode) toggleSelect(m.id)
                        else if (m.receipt!.kind === 'redpacket') onOpenRedPacketDetail(friend.id, m.receipt!.srcMsgId)
                        else if (m.receipt!.kind === 'transfer') onOpenTransferDetail(friend.id, m.receipt!.srcMsgId)
                        else if (m.receipt!.kind === 'rc' && m.receipt!.cardId) onOpenRelativeCardDetail(m.receipt!.cardId)
                      }}
                    >
                      <span className={`receipt-card ${m.receipt.kind === 'redpacket' ? 'rp' : m.receipt.kind === 'transfer' ? 'tf' : 'rc'}`}>
                        <span className="receipt-icon">
                          {m.receipt.kind === 'redpacket' ? (
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                              <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="#fff" strokeWidth="1.8" />
                              <path d="M3.5 9.5h17" stroke="#fff" strokeWidth="1.8" />
                              <path d="m6 9.5 6 4.6 6-4.6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : m.receipt.kind === 'transfer' ? (
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                              <path d="m6 12.5 4 4 8-9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                              <path d="M12 20.6 4.9 14a4.8 4.8 0 0 1 .2-6.8 4.6 4.6 0 0 1 6.6.4l.3.4.3-.4a4.6 4.6 0 0 1 6.6-.4 4.8 4.8 0 0 1 .2 6.8L12 20.6Z" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className="receipt-texts">
                          <span className="receipt-label">{m.receipt.kind === 'redpacket' ? '红包已领取' : m.receipt.kind === 'transfer' ? '转账已收款' : '亲属卡已领取'}</span>
                          <span className="receipt-amount">{m.receipt.kind === 'rc' ? `每月额度 ¥${formatMoney(m.receipt.amount)}` : `¥${formatMoney(m.receipt.amount)}`}</span>
                        </span>
                        <span className="receipt-detail">详情</span>
                      </span>
                    </div>
                  ) : m.relativeCard && !m.quote ? (
                    <div
                      className="rela-msg"
                      onTouchStart={onTouchStart(m)}
                      onTouchEnd={onTouchClear}
                      onTouchMove={onTouchClear}
                      onContextMenu={onContextMenu(m)}
                      onClick={() => {
                        if (selectMode) toggleSelect(m.id)
                        else openRcCard(m)
                      }}
                    >
                      <div className="rela-card">
                        <span className="rela-card-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 20.6 4.9 14a4.8 4.8 0 0 1 .2-6.8 4.6 4.6 0 0 1 6.6.4l.3.4.3-.4a4.6 4.6 0 0 1 6.6-.4 4.8 4.8 0 0 1 .2 6.8L12 20.6Z" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span className="rela-card-texts">
                          <span className="rela-card-title">亲属卡</span>
                          <span className="rela-card-sub">{rcDesc(m)}</span>
                        </span>
                      </div>
                    </div>
                  ) : m.sticker && !m.sticker.emoji && !m.quote ? (
                    <div
                      className="sticker-bare"
                      onTouchStart={onTouchStart(m)}
                      onTouchEnd={onTouchClear}
                      onTouchMove={onTouchClear}
                      onContextMenu={onContextMenu(m)}
                      onClick={() => {
                        if (selectMode) toggleSelect(m.id)
                      }}
                    >
                      <img className="sticker-msg-img" src={m.sticker.url} alt={m.sticker.meaning} draggable={false} />
                    </div>
                  ) : m.location && !m.quote ? (
                    <div
                      className="loc-bare"
                      onTouchStart={onTouchStart(m)}
                      onTouchEnd={onTouchClear}
                      onTouchMove={onTouchClear}
                      onContextMenu={onContextMenu(m)}
                      onClick={() => {
                        if (selectMode) toggleSelect(m.id)
                      }}
                    >
                      <span className="loc-card">
                        <span className="loc-map">
                          <svg viewBox="0 0 200 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                            <rect width="200" height="90" fill="#dcecd8" />
                            <path d="M0 32 H200" stroke="#f7fbf5" strokeWidth="11" />
                            <path d="M64 0 V90" stroke="#f7fbf5" strokeWidth="9" />
                            <path d="M136 0 V90" stroke="#f7fbf5" strokeWidth="6" />
                            <path d="M0 68 H200" stroke="#f7fbf5" strokeWidth="5" />
                            <circle cx="30" cy="16" r="9" fill="#cde4c7" />
                            <circle cx="170" cy="76" r="12" fill="#cde4c7" />
                            <path d="M100 26c-8 0-14 6-14 13.5C86 49.5 100 62 100 62s14-12.5 14-22.5C114 32 108 26 100 26Z" fill="#e5533d" />
                            <circle cx="100" cy="39" r="5" fill="#fff" />
                          </svg>
                        </span>
                        <span className="loc-info">
                          <span className="loc-name">{m.location.name}</span>
                          <span className="loc-addr">{m.location.address || '位置'}</span>
                        </span>
                      </span>
                    </div>
                  ) : m.redpacket && !m.quote ? (
                    <div
                      className="rp-msg"
                      onTouchStart={onTouchStart(m)}
                      onTouchEnd={onTouchClear}
                      onTouchMove={onTouchClear}
                      onContextMenu={onContextMenu(m)}
                      onClick={() => {
                        if (selectMode) toggleSelect(m.id)
                        else openRedPacket(m)
                      }}
                    >
                      <div className="rp-card">
                        <span className="rp-card-icon">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" stroke="#fff" strokeWidth="1.7" />
                            <path d="M4.8 6.5c4.6 3.4 9.8 3.4 14.4 0" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                            <text x="12" y="16.5" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="700">
                              ¥
                            </text>
                          </svg>
                        </span>
                        <span className="rp-card-texts">
                          <span className="rp-card-blessing">{m.redpacket.blessing}</span>
                          <span className="rp-card-kind">{m.redpacket.status === '已领取' ? '已领取' : m.redpacket.status === '已退还' ? '已退还' : m.from === 'me' ? '等待领取' : '领取红包'}</span>
                        </span>
                      </div>
                    </div>
                  ) : m.transfer && !m.quote ? (
                    <div
                      className="tf-msg"
                      onTouchStart={onTouchStart(m)}
                      onTouchEnd={onTouchClear}
                      onTouchMove={onTouchClear}
                      onContextMenu={onContextMenu(m)}
                      onClick={() => {
                        if (selectMode) toggleSelect(m.id)
                        else openTransfer(m)
                      }}
                    >
                      <div className="tf-card">
                        <span className="tf-card-icon">¥</span>
                        <span className="tf-card-texts">
                          <span className="tf-card-amount">¥{formatMoney(m.transfer.amount)}</span>
                          {m.transfer.note && m.transfer.note !== '转账' ? (
                            <span className="tf-card-note">{m.transfer.note}</span>
                          ) : m.from === 'me' ? (
                            <span className="tf-card-note">你发起了一笔转账</span>
                          ) : (
                            <span className="tf-card-note">转账</span>
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`bubble ${m.from === 'me' ? 'bubble-me' : 'bubble-friend'} ${m.sticker ? 'bubble-sticker' : ''}`}
                      onTouchStart={onTouchStart(m)}
                      onTouchEnd={onTouchClear}
                      onTouchMove={onTouchClear}
                      onContextMenu={onContextMenu(m)}
                      onClick={() => {
                        if (selectMode) toggleSelect(m.id)
                      }}
                    >
                      {m.quote && <div className="bubble-quote">{m.quote}</div>}
                      {m.sticker ? (
                        m.sticker.emoji ? (
                          <span className="sticker-emoji">{m.sticker.emoji}</span>
                        ) : (
                          <img className="sticker-msg-img" src={m.sticker.url} alt={m.sticker.meaning} draggable={false} />
                        )
                      ) : (
                        parseChatContent(m.text, myStickers).map((f, i) =>
                          f.t === 'text' ? (
                            <span key={i}>{f.v}</span>
                          ) : f.t === 'txtimg' ? (
                            <span key={i} className="txtimg-inline">
                              {f.v}
                            </span>
                          ) : f.t === 'loc' ? (
                            <span key={i} className="loc-card loc-card-inline">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M12 21c4.2-4.2 6.5-7.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 13.6 7.8 16.8 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                <circle cx="12" cy="10.5" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                              </svg>
                              {f.name}
                            </span>
                          ) : f.t === 'img' ? (
                            <img key={i} className="sticker-inline big" src={f.url} alt="" draggable={false} />
                          ) : f.t === 'rp' ? (
                            <span key={i} className="pay-inline">
                              [微信红包] {f.blessing} ¥{formatMoney(f.amount)}
                            </span>
                          ) : (
                            <span key={i} className="pay-inline">
                              [转账] {f.note} ¥{formatMoney(f.amount)}
                            </span>
                          )
                        )
                      )}
                      <svg
                        className={`bubble-tail ${m.from === 'me' ? 'tail-me' : 'tail-them'}`}
                        viewBox="0 0 10 19"
                        width="10"
                        height="19"
                        aria-hidden="true"
                      >
                        <path d="M0 0 C0.6 8 3.6 14.6 10 19 C4.4 18.6 0 15.6 0 10 Z" />
                      </svg>
                    </div>
                  )}
                  {avatarStyle !== 'none' && friend.timeStyle === 'bubble' && (
                    <span className="chat-meta under">{fmtClock(m.time, withSec)}</span>
                  )}
                  {avatarStyle !== 'none' && friend.readStyle === 'bubble' && (
                    <span className={`chat-meta under ${m.from === 'me' && !mineRead ? 'unread' : ''}`}>{readLabel}</span>
                  )}
                </div>
                {m.from === 'me' && avatarStyle !== 'none' && !selectMode ? (
                  meAvShown ? (
                    <span className="chat-avatar-col">
                      <span className="chat-avatar-btn">
                        <Avatar name={meProfile.name} src={meProfile.avatar} size={34} />
                      </span>
                      {friend.timeStyle === 'avatar' && <span className="chat-meta">{fmtClock(m.time, withSec)}</span>}
                      {friend.readStyle === 'avatar' && <span className="chat-meta">{readLabel}</span>}
                    </span>
                  ) : (
                    <span className="chat-avatar-spacer" />
                  )
                ) : null}
              </div>
              {m.from === 'friend' && transMap[m.id] && (
                <div className="chat-row them tight">
                  {needAvSpace && <span className="chat-avatar-spacer" />}
                  <div className="chat-trans">{transMap[m.id]}</div>
                </div>
              )}
            </div>
          )
        })}
        {typing && streaming === null && (
          <div className="chat-row them">
            {friend.avatarStyle !== 'none' && (
              <span className="chat-avatar-btn">
                <Avatar name={friend.name} src={friend.avatar} size={34} />
              </span>
            )}
            <div className="bubble bubble-friend">
              <span className="chat-typing-dots typing-in-bubble">
                <i />
                <i />
                <i />
              </span>
              <svg className="bubble-tail tail-them" viewBox="0 0 10 19" width="10" height="19" aria-hidden="true">
                <path d="M0 0 C0.6 8 3.6 14.6 10 19 C4.4 18.6 0 15.6 0 10 Z" />
              </svg>
            </div>
          </div>
        )}
        {streaming !== null && (
          <div className="chat-row them">
            {friend.avatarStyle !== 'none' && (
              <span className="chat-avatar-btn">
                <Avatar name={friend.name} src={friend.avatar} size={34} />
              </span>
            )}
            <div className="bubble bubble-friend streaming">
              {parseChatContent(streaming, myStickers).map((f, i) =>
                f.t === 'text' ? (
                  <span key={i}>{f.v}</span>
                ) : f.t === 'txtimg' ? (
                  <span key={i} className="txtimg-inline">
                    {f.v}
                  </span>
                ) : f.t === 'loc' ? (
                  <span key={i} className="loc-card loc-card-inline">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 21c4.2-4.2 6.5-7.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 13.6 7.8 16.8 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      <circle cx="12" cy="10.5" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                    {f.name}
                  </span>
                ) : f.t === 'img' ? (
                  <img key={i} className="sticker-inline big" src={f.url} alt="" draggable={false} />
                ) : f.t === 'rp' ? (
                  <span key={i} className="pay-inline">
                    [微信红包] {f.blessing} ¥{formatMoney(f.amount)}
                  </span>
                ) : (
                  <span key={i} className="pay-inline">
                    [转账] {f.note} ¥{formatMoney(f.amount)}
                  </span>
                )
              )}
              <svg className="bubble-tail tail-them" viewBox="0 0 10 19" width="10" height="19" aria-hidden="true">
                <path d="M0 0 C0.6 8 3.6 14.6 10 19 C4.4 18.6 0 15.6 0 10 Z" />
              </svg>
            </div>
          </div>
        )}
        {messages.length === 0 && <div className="empty-hint chat-empty">和 {friend.name} 打个招呼吧</div>}
      </div>

      {hint && <div className="chat-toast">{hint}</div>}

      {!selectMode && quoteBar && (
        <div className="chat-quote-bar">
          <span className="chat-quote-label">{editMsg ? '编辑消息' : `引用 ${friend.name}`}</span>
          <span className="chat-quote-preview">{quoteBar.text}</span>
          <button className="chat-quote-close" onClick={editMsg ? cancelEdit : () => setReplyQuote(null)} aria-label="取消">
            <svg width="9" height="9" viewBox="0 0 10 10">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {selectMode ? (
        <div className="chat-select-actions">
          <button className="chat-select-btn" disabled={selectedIds.size === 0} onClick={copySelected}>
            复制
          </button>
          <button className="chat-select-btn danger" disabled={selectedIds.size === 0} onClick={deleteSelected}>
            删除
          </button>
        </div>
      ) : (
        <>
          {listening && (
            <div className="chat-voice-live">
              <span className="chat-voice-wave" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="chat-voice-text">{interim || '正在聆听，请说话…'}</span>
              <button className="chat-voice-stop" onClick={stopVoice}>
                停止
              </button>
            </div>
          )}
          <div className="chat-input-bar">
            <button
              className={`chat-plus ${plusOpen ? 'on' : ''}`}
              onClick={() => {
                setPlusOpen((p) => !p)
                setStickerOpen(false)
              }}
              aria-label="更多"
            >
              <PlusBadgeIcon />
            </button>
            <div className="chat-input-wrap">
              <input
                className="chat-input"
                type="text"
                placeholder={listening ? '正在聆听…' : editMsg ? '修改这条消息' : 'iMessage信息'}
                value={draft}
                maxLength={500}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send()
                }}
              />
              {!draft.trim() && !editMsg && !(friend.queuedSend && queuedCount > 0) && (
                <button
                  className={`chat-mic ${listening ? 'listening' : ''}`}
                  onClick={startVoice}
                  aria-label={listening ? '停止语音输入' : '语音输入'}
                >
                  <MicIcon />
                </button>
              )}
              <button
                className={`chat-sticker-btn ${stickerOpen ? 'on' : ''}`}
                onClick={() => {
                  setStickerOpen((s) => !s)
                  setPlusOpen(false)
                }}
                aria-label="表情"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
                  <circle cx="8.8" cy="10" r="1.15" fill="currentColor" />
                  <circle cx="15.2" cy="10" r="1.15" fill="currentColor" />
                  <path d="M8 14.2c1 1.4 2.4 2.1 4 2.1s3-.7 4-2.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
              {(draft.trim() || editMsg || (friend.queuedSend && queuedCount > 0)) && (
                <button
                  className="chat-send ready"
                  onClick={send}
                  aria-label={editMsg ? '保存' : queuedCount > 0 ? '让 TA 回复' : '发送'}
                >
                  <SendIcon size={15} />
                </button>
              )}
            </div>
          </div>
          {stickerOpen && (
            <div className="sticker-panel">
              <div className="sticker-grid">
                {myStickers.length > 0 ? (
                  <>
                    {myStickers.map((s) => (
                      <button key={s.id} className="sticker-cell sticker-cell-mine" onClick={() => sendSticker({ url: s.url, meaning: s.meaning })} title={s.meaning}>
                        <img src={s.url} alt={s.meaning} draggable={false} loading="lazy" />
                      </button>
                    ))}
                    <button className="sticker-cell sticker-add" onClick={() => document.getElementById('chat-sticker-file')?.click()} aria-label="上传表情包">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="sticker-mine-empty">
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" stroke="#c7c7cc" strokeWidth="1.5" />
                          <circle cx="9" cy="10" r="1.2" fill="#c7c7cc" />
                          <circle cx="15" cy="10" r="1.2" fill="#c7c7cc" />
                          <path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" stroke="#c7c7cc" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <div className="sticker-mine-empty-title">还没有表情包</div>
                        <div className="sticker-mine-empty-sub">添加几张，聊天时点一下就能发</div>
                        <div className="sticker-mine-empty-btns">
                          <button className="sticker-mine-btn primary" onClick={() => document.getElementById('chat-sticker-file')?.click()}>
                            上传图片
                          </button>
                          <button className="sticker-mine-btn ghost" onClick={onOpenStickers}>
                            批量导入
                          </button>
                        </div>
                      </div>
                    )}
              </div>
              <input id="chat-sticker-file" type="file" accept="image/*" multiple hidden onChange={pickStickerFiles} />
            </div>
          )}
          {plusOpen && (
            <div className="sticker-panel plus-panel">
              <div className="plus-grid">
                <button className="plus-item" onClick={() => document.getElementById('chat-camera-file')?.click()}>
                  <span className="plus-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="6.5" width="18" height="13" rx="2.5" stroke="#7a7a80" strokeWidth="1.6" />
                      <circle cx="12" cy="13" r="3.4" stroke="#7a7a80" strokeWidth="1.6" />
                      <path d="M8.5 6.5 10 4h4l1.5 2.5" stroke="#7a7a80" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="plus-label">相机</span>
                </button>
                <button className="plus-item" onClick={() => document.getElementById('chat-image-file')?.click()}>
                  <span className="plus-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="#7a7a80" strokeWidth="1.6" />
                      <circle cx="9" cy="9.5" r="1.6" fill="#7a7a80" />
                      <path d="M4.5 17.5 10 12l3.5 3.5 2.5-2.5 3.5 3.5" stroke="#7a7a80" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="plus-label">图片</span>
                </button>
                <button
                  className="plus-item"
                  onClick={() => {
                    setPlusOpen(false)
                    setTextImageOpen(true)
                  }}
                >
                  <span className="plus-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="#7a7a80" strokeWidth="1.6" />
                      <path d="M8 9h8M12 9v7" stroke="#7a7a80" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="plus-label">文字图片</span>
                </button>
                <button
                  className="plus-item"
                  onClick={() => {
                    setPlusOpen(false)
                    onOpenTransfer()
                  }}
                >
                  <span className="plus-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="#7a7a80" strokeWidth="1.6" />
                      <path d="M7.5 12h6m0 0-2.2-2.2M13.5 12l-2.2 2.2M16 9.2v5.6" stroke="#7a7a80" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="plus-label">转账</span>
                </button>
                <button
                  className="plus-item"
                  onClick={() => {
                    setPlusOpen(false)
                    onOpenRelativeGift()
                  }}
                >
                  <span className="plus-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="#7a7a80" strokeWidth="1.6" />
                      <path d="M12 16.4c-2.3-1.6-3.8-3-3.8-4.6a2.2 2.2 0 0 1 3.8-1.4 2.2 2.2 0 0 1 3.8 1.4c0 1.6-1.5 3-3.8 4.6Z" stroke="#7a7a80" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="plus-label">亲属卡</span>
                </button>
                <button
                  className="plus-item"
                  onClick={() => {
                    setPlusOpen(false)
                    onOpenRedPacket()
                  }}
                >
                  <span className="plus-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" stroke="#7a7a80" strokeWidth="1.6" />
                      <path d="M4.8 6.5c4.6 3.4 9.8 3.4 14.4 0M12 10v3.2m-2.2-2 2.2 2 2.2-2" stroke="#7a7a80" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="plus-label">红包</span>
                </button>
                <button
                  className="plus-item"
                  onClick={() => {
                    setPlusOpen(false)
                    onOpenLocation()
                  }}
                >
                  <span className="plus-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <path d="M12 21c4.2-4.2 6.5-7.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 13.6 7.8 16.8 12 21Z" stroke="#7a7a80" strokeWidth="1.6" strokeLinejoin="round" />
                      <circle cx="12" cy="10.5" r="2.4" stroke="#7a7a80" strokeWidth="1.6" />
                    </svg>
                  </span>
                  <span className="plus-label">位置</span>
                </button>
              </div>
              <input id="chat-image-file" type="file" accept="image/*" hidden onChange={sendImageMsg} />
              <input id="chat-camera-file" type="file" accept="image/*" capture="environment" hidden onChange={sendImageMsg} />
            </div>
          )}
        </>
      )}

      {rpOpen && (
        <div className="rp-overlay" onClick={() => setRpOpen(null)}>
          {rpOpen.phase === 'opened' ? (
            <div className="rp-opened" onClick={(e) => e.stopPropagation()}>
              <div className="rp-opened-name">{rpOpen.msg.from === 'friend' ? `${friend.name}的红包` : '我发出的红包'}</div>
              <div className="rp-opened-amount">¥{formatMoney(rpOpen.msg.redpacket?.amount ?? 0)}</div>
              <div className="rp-opened-blessing">{rpOpen.msg.redpacket?.blessing}</div>
              <button className="rp-opened-btn" onClick={() => setRpOpen(null)}>
                知道了
              </button>
            </div>
          ) : (
            <div className="rp-cover" onClick={(e) => e.stopPropagation()}>
              <span className="rp-cover-brand">{friend.name}的红包</span>
              <button className="rp-cover-open" onClick={claimRedPacket}>
                开
              </button>
              {rpOpen.msg.from === 'friend' && rpOpen.msg.redpacket?.status === '待领取' && (
                <button className="rp-cover-refund" onClick={refundRedPacket}>
                  退还红包
                </button>
              )}
              <span className="rp-cover-close" onClick={() => setRpOpen(null)}>
                ×
              </span>
            </div>
          )}
        </div>
      )}

      {rcOpen && (
        <div className="rp-overlay" onClick={() => setRcOpen(null)}>
          {rcOpen.phase === 'claimed' ? (
            <div className="rc-claimed" onClick={(e) => e.stopPropagation()}>
              <span className="rc-claim-heart rc-claimed-heart">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff">
                  <path d="M12 20.6 4.9 14a4.8 4.8 0 0 1 .2-6.8 4.6 4.6 0 0 1 6.6.4l.3.4.3-.4a4.6 4.6 0 0 1 6.6-.4 4.8 4.8 0 0 1 .2 6.8L12 20.6Z" />
                </svg>
              </span>
              <div className="rc-claimed-title">领用成功</div>
              <div className="rc-claimed-name">{friend.name} 赠送的亲属卡</div>
              <div className="rc-claimed-limit">每月额度 ¥{formatMoney(rcOpen.msg.relativeCard ? rcCardOf(rcOpen.msg)?.monthlyLimit ?? 0 : 0)}</div>
              <div className="rc-claimed-tip">对方每月为你代付消费，可在「钱包-亲属卡」中查看和使用</div>
              <div className="rc-claim-btns">
                <button
                  className="rc-btn-primary"
                  onClick={() => {
                    if (rcOpen.msg.relativeCard) onOpenRelativeCardDetail(rcOpen.msg.relativeCard.cardId)
                  }}
                >
                  查看我的亲属卡
                </button>
                <button className="rc-btn-ghost" onClick={() => setRcOpen(null)}>
                  完成
                </button>
              </div>
            </div>
          ) : (
            <div className="rc-claim" onClick={(e) => e.stopPropagation()}>
              <span className="rc-claim-heart">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="#fff">
                  <path d="M12 20.6 4.9 14a4.8 4.8 0 0 1 .2-6.8 4.6 4.6 0 0 1 6.6.4l.3.4.3-.4a4.6 4.6 0 0 1 6.6-.4 4.8 4.8 0 0 1 .2 6.8L12 20.6Z" />
                </svg>
              </span>
              <div className="rc-claim-name">{friend.name} 赠送的亲属卡</div>
              <div className="rc-claim-limit">每月额度 ¥{formatMoney(rcCardOf(rcOpen.msg)?.monthlyLimit ?? 0)}</div>
              <div className="rc-claim-desc">领用后，对方每月为你代付消费，单月不超过此额度</div>
              <div className="rc-claim-btns">
                <button className="rc-btn-primary" onClick={claimRelativeCard}>
                  领用
                </button>
                <button className="rc-btn-ghost" onClick={refundRelativeCard}>
                  退还
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tfConfirm && (
        <div className="rp-overlay tf-claim-overlay" onClick={() => setTfConfirm(null)}>
          <div className="tf-claim" onClick={(e) => e.stopPropagation()}>
            <div className="tf-claim-head">
              <span className="tf-claim-avatar">
                <Avatar name={friend.name} src={friend.avatar} size={52} />
              </span>
              <span className="tf-claim-from">{friend.name} 向你转账</span>
              <span className="tf-claim-amount">
                <small>¥</small>
                {formatMoney(tfConfirm.transfer?.amount ?? 0)}
              </span>
              {tfConfirm.transfer?.note && tfConfirm.transfer.note !== '转账' && <span className="tf-claim-note">“{tfConfirm.transfer.note}”</span>}
              <span className="tf-claim-tip">收款后将存入零钱，不收取手续费</span>
            </div>
            <div className="tf-claim-actions">
              <button className="tf-claim-ok" onClick={confirmTransfer}>
                收款
              </button>
              <button className="tf-claim-refund" onClick={refundTransfer}>
                退还
              </button>
            </div>
          </div>
        </div>
      )}

      {menuFor && (
        <>
          <div className="msg-menu-mask" onClick={() => setMenuFor(null)} />
          <div className={`msg-menu horizontal ${menuPos.arrowBottom ? 'arrow-bottom' : 'arrow-top'}`} style={{ left: menuPos.x, top: menuPos.y }}>
            <span className="msg-menu-arrow" style={{ left: menuPos.arrowX }} />
            <button
              className="msg-menu-item"
              onClick={() => {
                doCopy(menuFor.text)
                setMenuFor(null)
              }}
            >
              复制
            </button>
            {menuFor.from === 'friend' && (
              <button
                className="msg-menu-item"
                onClick={() => {
                  startQuote(menuFor)
                  setMenuFor(null)
                }}
              >
                引用
              </button>
            )}
            <button
              className="msg-menu-item"
              onClick={() => {
                startEdit(menuFor)
                setMenuFor(null)
              }}
            >
              编辑
            </button>
            {menuFor.from === 'friend' && (
              <button
                className="msg-menu-item"
                onClick={() => regenerate(menuFor)}
              >
                重新生成
              </button>
            )}
            <button
              className="msg-menu-item danger"
              onClick={() => deleteOne(menuFor)}
            >
              删除
            </button>
            <button
              className="msg-menu-item"
              onClick={() => enterSelect(menuFor)}
            >
              多选
            </button>
          </div>
        </>
      )}

      <Modal
        open={uploadQueue.length > 0}
        title="这个表情包表达什么意思？"
        buttons={[
          { label: '不保存', onClick: discardStickerFromQueue },
          { label: '保存', primary: true, onClick: () => saveStickerFromQueue(meaningDraft) },
        ]}
      >
        <div className="sticker-upload-preview">
          <img src={uploadQueue[0]} alt="表情包预览" />
        </div>
        <input
          className="remark-input"
          type="text"
          placeholder="如：开心到飞起（AI 会按意思发表）"
          maxLength={12}
          value={meaningDraft}
          onChange={(e) => setMeaningDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveStickerFromQueue(meaningDraft)
          }}
          autoFocus
        />
      </Modal>

      <Modal
        open={textImageOpen}
        title="文字图片"
        buttons={[
          { label: '取消', onClick: () => setTextImageOpen(false) },
          { label: '发送', primary: true, onClick: sendTextImage },
        ]}
      >
        <div className="modal-tip">输入文字，生成一张文字图片发送（对方和 AI 都能看到内容）</div>
        <textarea
          className="sticker-url-input text-image-input"
          rows={3}
          placeholder="写点想说的…"
          maxLength={120}
          value={textImageDraft}
          onChange={(e) => setTextImageDraft(e.target.value)}
          autoFocus
        />
      </Modal>

      <Modal
        open={errModal !== null}
        title={errModal?.title ?? ''}
        buttons={[
          ...(errModal?.showSettings ? [{ label: '去设置', onClick: () => { setErrModal(null); onOpenSettings() } }] : []),
          { label: '知道了', onClick: () => setErrModal(null), primary: true },
        ]}
      >
        <div className="modal-error-text">{errModal?.desc}</div>
      </Modal>
    </div>
  )
}

function copyFallback(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
  } catch {
    /* ignore */
  }
  document.body.removeChild(ta)
}
