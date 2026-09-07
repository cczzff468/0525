import { useEffect, useRef, useState } from 'react'
import type { Friend, Message, Sticker } from '../types'
import { Avatar, Modal, formatTimeFull } from '../components/common'
import { BackIcon, SendIcon, PlusBadgeIcon, MicIcon } from '../components/icons'
import { loadMessages, loadProfile, saveMessages, loadApiSetting, loadChatBgs, loadStickers, saveStickers, uid } from '../store'
import { AiError, aiStream, chatUrl } from '../utils/ai'
import { friendMemoryContext, maybeAutoSummarize } from '../utils/memory'
import { fileToAvatar, fileToPhoto } from '../utils/image'

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
    .filter(Boolean)
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

const STICKER_RE = /\[表情[:：]([^\[\]]{1,12})\]/g

type StickerFrag = { t: 'text'; v: string } | { t: 'img'; url: string }

function parseStickerText(text: string, custom: Sticker[]): StickerFrag[] {
  const frags: StickerFrag[] = []
  let last = 0
  STICKER_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = STICKER_RE.exec(text))) {
    if (m.index > last) frags.push({ t: 'text', v: text.slice(last, m.index) })
    const name = m[1].trim()
    const c = custom.find((s) => s.meaning === name) ?? custom.find((s) => s.meaning.includes(name) || name.includes(s.meaning))
    if (c) frags.push({ t: 'img', url: c.url })
    last = m.index + m[0].length
  }
  if (last < text.length) frags.push({ t: 'text', v: text.slice(last) })
  return frags
}

export default function Chat({
  friend,
  onBack,
  onEditFriend,
  onOpenSettings,
  onOpenChatSettings,
  onOpenStickers,
  jumpTo,
}: {
  friend: Friend
  onBack: () => void
  onEditFriend: () => void
  onOpenSettings: () => void
  onOpenChatSettings: () => void
  onOpenStickers: () => void
  jumpTo?: string
}) {
  const [messages, setMessages] = useState<Message[]>(() =>
    loadMessages().filter((m) => m.friendId === friend.id).sort((a, b) => a.time - b.time)
  )
  const [draft, setDraft] = useState('')
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
      window.clearTimeout(timerRef.current)
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
        if (parts.length > 1) {
          for (let i = 0; i < parts.length; i++) {
            if (i > 0) {
              setTyping(true)
              await sleep(300 + Math.random() * 400)
              setTyping(false)
            }
            commit([...msgsRef.current, { id: uid(), friendId: friend.id, from: 'friend', text: parts[i], time: Date.now() }])
          }
        } else {
          commit([...msgsRef.current, { id: uid(), friendId: friend.id, from: 'friend', text, time: Date.now() }])
        }
        busyRef.current = false
        if (truncated) setErrModal({ title: '回复被截断', desc: ERR_TEXT.toolong.desc })
        maybeAutoSummarize(friend.id).catch(() => {})
      } catch (err) {
        showError(err)
      }
    }, 900 + Math.random() * 600)
  }

  const send = () => {
    const text = draft.trim()
    if (!text || busyRef.current) return
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
    respond()
  }

  const sendSticker = (payload: { meaning: string; url?: string; emoji?: string }) => {
    if (busyRef.current || editMsg) return
    commit([...msgsRef.current, { id: uid(), friendId: friend.id, from: 'me', text: payload.meaning, time: Date.now(), sticker: payload }])
    respond()
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
      respond()
    } catch {
      showHint('图片读取失败，请换一张试试')
    }
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
    const labels = m.from === 'me' ? ['复制', '编辑', '删除', '多选'] : ['复制', '引用', '编辑', '重新生成', '多选']
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
                  {m.sticker && !m.sticker.emoji && !m.quote ? (
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
                        parseStickerText(m.text, myStickers).map((f, i) =>
                          f.t === 'text' ? (
                            <span key={i}>{f.v}</span>
                          ) : (
                            <img key={i} className="sticker-inline big" src={f.url} alt="" draggable={false} />
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
            <span className="chat-avatar-btn">
              <Avatar name={friend.name} src={friend.avatar} size={34} />
            </span>
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
            <span className="chat-avatar-btn">
              <Avatar name={friend.name} src={friend.avatar} size={34} />
            </span>
            <div className="bubble bubble-friend streaming">
              {parseStickerText(streaming, myStickers).map((f, i) =>
                f.t === 'text' ? (
                  <span key={i}>{f.v}</span>
                ) : (
                  <img key={i} className="sticker-inline big" src={f.url} alt="" draggable={false} />
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
              {!draft.trim() && !editMsg && (
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
              {(draft.trim() || editMsg) && (
                <button className="chat-send ready" onClick={send} aria-label={editMsg ? '保存' : '发送'}>
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
                <button className="plus-item" onClick={() => showHint('文字图片即将上线')}>
                  <span className="plus-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="#7a7a80" strokeWidth="1.6" />
                      <path d="M8 9h8M12 9v7" stroke="#7a7a80" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="plus-label">文字图片</span>
                </button>
                <button className="plus-item" onClick={() => showHint('转账功能即将上线')}>
                  <span className="plus-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="#7a7a80" strokeWidth="1.6" />
                      <path d="M7.5 12h6m0 0-2.2-2.2M13.5 12l-2.2 2.2M16 9.2v5.6" stroke="#7a7a80" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="plus-label">转账</span>
                </button>
                <button className="plus-item" onClick={() => showHint('红包功能即将上线')}>
                  <span className="plus-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" stroke="#7a7a80" strokeWidth="1.6" />
                      <path d="M4.8 6.5c4.6 3.4 9.8 3.4 14.4 0M12 10v3.2m-2.2-2 2.2 2 2.2-2" stroke="#7a7a80" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="plus-label">红包</span>
                </button>
                <button className="plus-item" onClick={() => showHint('位置功能即将上线')}>
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
            {menuFor.from === 'me' && (
              <button
                className="msg-menu-item danger"
                onClick={() => deleteOne(menuFor)}
              >
                删除
              </button>
            )}
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
