import { useEffect, useRef, useState } from 'react'
import type { Friend, Message, Profile } from '../types'
import { Avatar, formatTime, formatTimeFull } from '../components/common'
import { BackIcon, SendIcon, VideoIcon, PlusBadgeIcon, MicIcon } from '../components/icons'
import { loadMessages, loadProfile, saveMessages, uid } from '../store'
import { aiReply } from '../utils/ai'

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
  const listRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number>(0)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const append = (msg: Message) => {
    setMessages((prev) => [...prev, msg])
    const all = loadMessages()
    all.push(msg)
    saveMessages(all)
  }

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    append({ id: uid(), friendId: friend.id, from: 'me', text, time: Date.now() })
    timerRef.current = window.setTimeout(async () => {
      const ai = await aiReply(text, friend, loadProfile())
      append({
        id: uid(),
        friendId: friend.id,
        from: 'friend',
        text: ai ?? makeReply(text, friend, loadProfile()),
        time: Date.now(),
      })
    }, 900 + Math.random() * 600)
  }

  const lastMine = [...messages].reverse().find((m) => m.from === 'me')

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

      <div className="chat-list" ref={listRef}>
        {messages.map((m, i) => {
          const showTime = i === 0 || m.time - messages[i - 1].time > 5 * 60 * 1000
          const tight = i > 0 && messages[i - 1].from === m.from && !showTime
          return (
            <div key={m.id}>
              {showTime && (
                <div className="chat-time">
                  <div>iMessage</div>
                  <div>{formatTimeFull(m.time)}</div>
                </div>
              )}
              <div className={`chat-row ${m.from === 'me' ? 'me' : 'them'} ${tight ? 'tight' : ''}`}>
                {m.from === 'friend' && (
                  <span className="chat-avatar-btn" onClick={onEditFriend} role="button" tabIndex={0}>
                    <Avatar name={friend.name} src={friend.avatar} size={34} />
                  </span>
                )}
                <div className={`bubble ${m.from === 'me' ? 'bubble-me' : 'bubble-friend'}`}>
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
        {lastMine && <div className="chat-read">{formatTime(lastMine.time)}已读</div>}
        {messages.length === 0 && <div className="empty-hint chat-empty">和 {friend.name} 打个招呼吧</div>}
      </div>

      <div className="chat-input-bar">
        <button className="chat-plus" aria-label="更多">
          <PlusBadgeIcon />
        </button>
        <div className="chat-input-wrap">
          <input
            className="chat-input"
            type="text"
            placeholder="iMessage信息"
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
          />
          {draft.trim() ? (
            <button className="chat-send ready" onClick={send} aria-label="发送">
              <SendIcon size={15} />
            </button>
          ) : (
            <span className="chat-mic">
              <MicIcon />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
