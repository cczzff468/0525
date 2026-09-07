import { useEffect, useRef, useState } from 'react'
import type { Friend, Message } from '../types'
import { Avatar, Modal, formatTime, formatTimeFull } from '../components/common'
import { BackIcon, SendIcon, VideoIcon, PlusBadgeIcon, MicIcon } from '../components/icons'
import { loadMessages, loadProfile, saveMessages, loadApiSetting, uid } from '../store'
import { AiError, aiStream } from '../utils/ai'
import { friendMemoryContext, maybeAutoSummarize } from '../utils/memory'

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

function msgWidth(text: string): number {
  return text.length * 15 + 26
}

export default function Chat({
  friend,
  onBack,
  onEditFriend,
  onOpenSettings,
}: {
  friend: Friend
  onBack: () => void
  onEditFriend: () => void
  onOpenSettings: () => void
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
  const listRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number>(0)
  const pressRef = useRef<number>(0)
  const busyRef = useRef(false)
  const recogRef = useRef<any>(null)
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
      try {
        const { text, truncated } = await aiStream(history, friend, loadProfile(), onDelta, friendMemoryContext(friend.id))
        setTyping(false)
        setStreaming(null)
        commit([...msgsRef.current, { id: uid(), friendId: friend.id, from: 'friend', text, time: Date.now() }])
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
              <span className="chat-nav-name">{friend.name}</span>
            )}
            <svg width="8" height="13" viewBox="0 0 9 15" fill="none">
              <path d="m1.5 1.5 5.5 6-5.5 6" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <button className="chat-facetime" aria-label="视频通话">
          <VideoIcon />
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
            <button className="chat-plus" aria-label="更多">
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
              {(draft.trim() || editMsg) && (
                <button className="chat-send ready" onClick={send} aria-label={editMsg ? '保存' : '发送'}>
                  <SendIcon size={15} />
                </button>
              )}
              {!draft.trim() && !editMsg && (
                <button
                  className={`chat-mic ${listening ? 'listening' : ''}`}
                  onClick={startVoice}
                  aria-label={listening ? '停止语音输入' : '语音输入'}
                >
                  <MicIcon />
                </button>
              )}
            </div>
          </div>
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
