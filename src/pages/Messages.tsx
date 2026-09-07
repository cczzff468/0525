import { useEffect, useState } from 'react'
import type { Friend, Message } from '../types'
import { Avatar, NavBar, formatTime, Chevron } from '../components/common'
import { PlusIcon, SearchIcon } from '../components/icons'

export function PlusSheet({
  visible,
  onClose,
  onAddFriend,
  onOpenMoments,
}: {
  visible: boolean
  onClose: () => void
  onAddFriend: () => void
  onOpenMoments: () => void
}) {
  const [render, setRender] = useState(visible)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (visible) {
      setRender(true)
      const t = setTimeout(() => setShown(true), 20)
      return () => clearTimeout(t)
    }
    setShown(false)
    const t = setTimeout(() => setRender(false), 200)
    return () => clearTimeout(t)
  }, [visible])

  if (!render) return null
  return (
    <>
      <div className={`plus-pop-mask ${shown ? 'shown' : ''}`} onClick={onClose} />
      <div className={`plus-pop ${shown ? 'shown' : ''}`}>
        <div className="plus-pop-arrow" />
        <button
          className="plus-pop-item"
          onClick={() => {
            onClose()
            onAddFriend()
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="10" cy="8" r="3.2" stroke="#fff" strokeWidth="1.8" />
            <path d="M3.8 19c.7-2.9 3.2-4.6 6.2-4.6 1 0 2 .2 2.8.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M17.5 13.5v6M14.5 16.5h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>添加好友</span>
        </button>
        <button
          className="plus-pop-item"
          onClick={() => {
            onClose()
            onOpenMoments()
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="1.8" />
            <path
              d="M6.2 6.8 7 5.6c.3-.5.8-.8 1.4-.8h7.2c.6 0 1.1.3 1.4.8l.8 1.2H20a1.6 1.6 0 0 1 1.6 1.6v8.8A1.6 1.6 0 0 1 20 18.8H4a1.6 1.6 0 0 1-1.6-1.6V8.4A1.6 1.6 0 0 1 4 6.8h2.2Z"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          <span>发朋友圈</span>
        </button>
      </div>
    </>
  )
}

export default function Messages({
  friends,
  messages,
  onOpenChat,
  onAddFriend,
  onOpenMoments,
}: {
  friends: Friend[]
  messages: Message[]
  onOpenChat: (friendId: string) => void
  onAddFriend: () => void
  onOpenMoments: () => void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [query, setQuery] = useState('')

  const lastByFriend = new Map<string, Message>()
  for (const m of messages) {
    const cur = lastByFriend.get(m.friendId)
    if (!cur || m.time > cur.time) lastByFriend.set(m.friendId, m)
  }

  const rows = friends
    .map((f) => ({ friend: f, last: lastByFriend.get(f.id) }))
    .filter(({ friend }) => friend.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (b.last?.time ?? b.friend.createdAt) - (a.last?.time ?? a.friend.createdAt))

  return (
    <div className="page">
      <NavBar
        large
        title="信息"
        right={
          <button className="nav-btn" onClick={() => setSheetOpen(true)} aria-label="新建">
            <PlusIcon />
          </button>
        }
      >
        <div className="search-box">
          <span className="search-icon">
            <SearchIcon />
          </span>
          <input
            className="search-input"
            type="text"
            placeholder="搜索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </NavBar>
      <div className="page-body">
        {rows.length === 0 && (
          <div className="empty-hint">{query ? '没有找到相关会话' : '还没有会话，点右上角 + 添加好友吧'}</div>
        )}
        <div className="list-group">
          {rows.map(({ friend, last }) => (
            <button key={friend.id} className="row" onClick={() => onOpenChat(friend.id)}>
              <Avatar name={friend.name} src={friend.avatar} size={50} />
              <div className="row-main">
                <div className="row-top">
                  <span className="row-title">{friend.name}</span>
                  {last && <span className="row-time">{formatTime(last.time)}</span>}
                </div>
                <div className="row-sub">
                  <span className="row-preview">{last ? (last.from === 'me' ? '我：' : '') + last.text : '开始聊天吧'}</span>
                  <Chevron />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <PlusSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onAddFriend={onAddFriend} onOpenMoments={onOpenMoments} />
    </div>
  )
}
