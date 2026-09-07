import { useEffect, useRef, useState } from 'react'
import type { Friend, Message, Profile } from '../types'
import { ActionSheet, Avatar, formatTime, formatTimeFull } from '../components/common'
import { BackIcon, SendIcon, VideoIcon, PlusBadgeIcon, MicIcon } from '../components/icons'
import { loadMessages, loadProfile, saveMessages, uid } from '../store'
import { aiStream } from '../utils/ai'

const REPLIES = ['嗯嗯，我在呢。', '好呀，就这么定了。', '哈哈，你这么说我也觉得。', '真的吗？太好了！', '行，回头细聊。', '嗯，有道理。', '哈哈哈，懂的都懂。', '好嘞，安排上。']

const BIO_HOOKS: [RegExp, string][] = [
  [/猫/, '对了，你家猫最近乖吗？'],
  [/狗/, '改天带你家狗子出来玩呀。'],
  [/咖啡/, '回头约一杯咖啡，我请！'],
  [/旅行|旅游|自驾|露营/, '下次旅行记得带上我呀。'],
  [/程序员|代码|编程|开发/, '你们搞技术的都这么拼吗，佩服。'],
  [/音乐|吉他|唱歌|钢琴/, '哪天唱一首给我听听呗。'],
  [/游戏|王者|吃鸡|原神/, '晚上来一局？我大概率是躺赢位。'],
  [/画画|插画|设计|摄影/, '你做的东西也太有才了吧。'],
  [/健身|跑步|运动|篮球|足球/, '运动达人带带我，我最近正想动起来。'],
  [/美食|做饭|烘焙|火锅/, '说的我馋了，改天尝尝你的手艺？'],
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function makeReply(text: string, friend: Friend, me: Profile): string {
  const callMe = me.name && me.name !== '我' && Math.random() < 0.3 ? `${me.name}，` : ''
  const wrap = (s: string) => callMe + s
  if (/你好|您好|hi|hello|嗨|在吗/i.test(text)) return wrap(pick([`嗨！我是${friend.name}，很高兴认识你～`, '在的在的，请说～']))
  if (/拜拜|再见|晚安/.test(text)) return wrap(pick(['拜拜，下次再聊～', '晚安，好梦～']))
  if (/谢谢|感谢/.test(text)) return wrap(pick(['不客气！', '小事一桩～']))
  if (/哈哈|笑死|好玩|搞笑/.test(text)) return wrap('哈哈哈哈，是吧！')
  if (text.includes('？') || text.includes('?')) return wrap(pick(['让我想想……', '好问题，你觉得呢？', '嗯……我觉得可以，回头细聊！']))
  if (Math.random() < 0.3) {
    for (const [re, reply] of BIO_HOOKS) {
      if (re.test(me.bio)) return wrap(reply)
    }
  }
  return wrap(pick(REPLIES))
}

function copyText(text: string, onFail: () => void) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(onFail)
    return
  }
  onFail()
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

export default function Chat({
  friend,
  onBack,
  onEditFriend,
}: {
  friend: Friend
  onBack: () => void
  onEditFriend: () => void
}) {
  const [messages, setMessages] = useState<Message[]>(() =>
    loadMessages().filter((m) => m.friendId === friend.id).sort((a, b) => a.time - b.time)
  )
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [streaming, setStreaming] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<Message | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [replyQuote, setReplyQuote] = useState<Message | null>(null)
  const [editMsg, setEditMsg] = useState<Message | null>(null)
  const [hint, setHint] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number>(0)
  const intervalRef = useRef<number>(0)
  const pressRef = useRef<number>(0)
  const busyRef = useRef(false)
  const msgsRef = useRef(messages)
  const hintTimer = useRef<number>(0)

  useEffect(() => {
    msgsRef.current = messages
  }, [messages])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streaming, typing])

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current)
      window.clearInterval(intervalRef.current)
      window.clearTimeout(pressRef.current)
    },
    []
  )

  const commit = (next: Message[]) => {
    setMessages(next)
    saveMessages(loadMessages().filter((m) => m.friendId !== friend.id).concat(next))
  }

  const showHint = (t: string) => {
    setHint(t)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(''), 1600)
  }

  const doCopy = (text: string) => {
    copyText(text, () => copyFallback(text))
    showHint('已复制')
  }

  const typewriter = (text: string) => {
    setTyping(false)
    let i = 0
    intervalRef.current = window.setInterval(() => {
      i += 1 + Math.floor(Math.random() * 2)
      setStreaming(text.slice(0, i))
      if (i >= text.length) {
        window.clearInterval(intervalRef.current)
        setStreaming(null)
        commit([...msgsRef.current, { id: uid(), friendId: friend.id, from: 'friend', text, time: Date.now() }])
        busyRef.current = false
      }
    }, 40)
  }

  const respond = (base: Message[]) => {
    busyRef.current = true
    timerRef.current = window.setTimeout(async () => {
      setTyping(true)
      const history = base.map((m) => ({
        role: m.from === 'me' ? ('user' as const) : ('assistant' as const),
        content: m.quote ? `（引用 TA 的消息："${m.quote}"）${m.text}` : m.text,
      }))
      let started = false
      const onDelta = (chunk: string) => {
        if (!started) {
          started = true
          setTyping(false)
        }
        setStreaming((prev) => (prev ?? '') + chunk)
      }
      const ai = await aiStream(history, friend, loadProfile(), onDelta)
      if (ai) {
        setTyping(false)
        setStreaming(null)
        commit([...msgsRef.current, { id: uid(), friendId: friend.id, from: 'friend', text: ai, time: Date.now() }])
        busyRef.current = false
      } else {
        typewriter(makeReply(base[base.length - 1]?.text ?? '', friend, loadProfile()))
      }
    }, 900 + Math.random() * 600)
  }

  const send = () => {
    const text = draft.trim()
    if (!text || busyRef.current) return
    if (editMsg) {
      commit(msgsRef.current.map((m) => (m.id === editMsg.id ? { ...m, text, edited: true } : m)))
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
    respond(msgsRef.current)
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
    commit(msgsRef.current.filter((x) => x.id !== m.id))
    respond(msgsRef.current)
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
    commit(msgsRef.current.filter((m) => !selectedIds.has(m.id)))
    showHint(`已删除 ${selectedIds.size} 条消息`)
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

  const onTouchStart = (m: Message) => () => {
    window.clearTimeout(pressRef.current)
    pressRef.current = window.setTimeout(() => setMenuFor(m), 480)
  }
  const onTouchClear = () => window.clearTimeout(pressRef.current)
  const onContextMenu = (m: Message) => (e: React.MouseEvent) => {
    e.preventDefault()
    setMenuFor(m)
  }

  const lastMine = [...messages].reverse().find((m) => m.from === 'me')
  const quoteBar = editMsg ?? replyQuote

  return (
    <div className="page chat-page">
      <div className="chat-nav">
        <button className="chat-back" onClick={onBack} aria-label="返回">
          <BackIcon />
        </button>
        <div className="chat-nav-center" onClick={onEditFriend} role="button" tabIndex={0}>
          <Avatar name={friend.name} src={friend.avatar} size={38} />
          <div className="chat-nav-name-row">
            <span className="chat-nav-name">{friend.name}</span>
            <svg width="8" height="13" viewBox="0 0 9 15" fill="none">
              <path d="m1.5 1.5 5.5 6-5.5 6" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <button className="chat-facetime" aria-label="视频通话">
          <VideoIcon />
        </button>
      </div>

      {typing && (
        <div className="chat-typing">
          <span className="chat-typing-text">对方正在输入</span>
          <span className="chat-typing-dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}

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

      <div className="chat-list" ref={listRef}>
        {messages.map((m, i) => {
          const showTime = i === 0 || m.time - messages[i - 1].time > 5 * 60 * 1000
          const tight = i > 0 && messages[i - 1].from === m.from && !showTime
          const checked = selectedIds.has(m.id)
          return (
            <div key={m.id}>
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
                {m.from === 'friend' && !selectMode && (
                  <span className="chat-avatar-btn" onClick={onEditFriend} role="button" tabIndex={0}>
                    <Avatar name={friend.name} src={friend.avatar} size={34} />
                  </span>
                )}
                <div
                  className={`bubble ${m.from === 'me' ? 'bubble-me' : 'bubble-friend'}`}
                  onTouchStart={onTouchStart(m)}
                  onTouchEnd={onTouchClear}
                  onTouchMove={onTouchClear}
                  onContextMenu={onContextMenu(m)}
                  onClick={() => {
                    if (selectMode) toggleSelect(m.id)
                  }}
                >
                  {m.quote && <div className="bubble-quote">{m.quote}</div>}
                  {m.text}
                  {m.edited && <span className="bubble-edited">已编辑</span>}
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
              </div>
            </div>
          )
        })}
        {streaming !== null && (
          <div className="chat-row them">
            <span className="chat-avatar-btn">
              <Avatar name={friend.name} src={friend.avatar} size={34} />
            </span>
            <div className="bubble bubble-friend streaming">
              {streaming}
              <svg className="bubble-tail tail-them" viewBox="0 0 10 19" width="10" height="19" aria-hidden="true">
                <path d="M0 0 C0.6 8 3.6 14.6 10 19 C4.4 18.6 0 15.6 0 10 Z" />
              </svg>
            </div>
          </div>
        )}
        {!selectMode && lastMine && <div className="chat-read">{formatTime(lastMine.time)}已读</div>}
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
        <div className="chat-input-bar">
          <button className="chat-plus" aria-label="更多">
            <PlusBadgeIcon />
          </button>
          <div className="chat-input-wrap">
            <input
              className="chat-input"
              type="text"
              placeholder={editMsg ? '修改这条消息' : 'iMessage信息'}
              value={draft}
              maxLength={500}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send()
              }}
            />
            {(draft.trim() || editMsg) && (
              <button className="chat-send ready" onClick={send} aria-label={editMsg ? '保存' : '发送'}>
                <SendIcon size={15} />
              </button>
            )}
            {!draft.trim() && !editMsg && (
              <span className="chat-mic">
                <MicIcon />
              </span>
            )}
          </div>
        </div>
      )}

      <ActionSheet visible={menuFor !== null} onClose={() => setMenuFor(null)}>
        {menuFor && (
          <div className="sheet-group">
            <button
              className="sheet-item"
              onClick={() => {
                doCopy(menuFor.text)
                setMenuFor(null)
              }}
            >
              复制
            </button>
            {menuFor.from === 'friend' && (
              <button
                className="sheet-item"
                onClick={() => {
                  startQuote(menuFor)
                }}
              >
                引用
              </button>
            )}
            <button className="sheet-item" onClick={() => startEdit(menuFor)}>
              编辑
            </button>
            {menuFor.from === 'friend' && (
              <button className="sheet-item" onClick={() => regenerate(menuFor)}>
                重新生成
              </button>
            )}
            {menuFor.from === 'me' && (
              <button className="sheet-item sheet-danger" onClick={() => deleteOne(menuFor)}>
                删除
              </button>
            )}
            <button className="sheet-item" onClick={() => enterSelect(menuFor)}>
              多选
            </button>
          </div>
        )}
        <div className="sheet-group">
          <button className="sheet-item sheet-cancel" onClick={() => setMenuFor(null)}>
            取消
          </button>
        </div>
      </ActionSheet>
    </div>
  )
}
