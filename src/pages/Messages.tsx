import { useEffect, useRef, useState } from 'react'
import type { Friend, Message } from '../types'
import { Avatar, Modal, NavBar, formatTime, Chevron } from '../components/common'
import { PlusIcon, SearchIcon } from '../components/icons'
import { loadFriends, loadMessages, saveFriends, saveMessages } from '../store'

interface MenuPos {
  x: number
  y: number
  arrowX: number
  arrowBottom: boolean
}

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
  onRefresh,
}: {
  friends: Friend[]
  messages: Message[]
  onOpenChat: (friendId: string) => void
  onAddFriend: () => void
  onOpenMoments: () => void
  onRefresh: () => void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuFor, setMenuFor] = useState<Friend | null>(null)
  const [menuPos, setMenuPos] = useState<MenuPos>({ x: 0, y: 0, arrowX: 0, arrowBottom: false })
  const [confirm, setConfirm] = useState<{ kind: 'clear' | 'delete'; friend: Friend } | null>(null)
  const [hint, setHint] = useState('')
  const pressTimer = useRef<number>(0)
  const hintTimer = useRef<number>(0)

  useEffect(() => () => window.clearTimeout(pressTimer.current), [])

  const showHint = (t: string) => {
    setHint(t)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(''), 1600)
  }

  const openRowMenu = (f: Friend, rect: DOMRect) => {
    const menuW = 168
    const menuH = 172
    const up = rect.top > menuH + 24
    const x = Math.min(Math.max(8, window.innerWidth - menuW - 10), window.innerWidth - menuW - 8)
    setMenuPos({
      x,
      y: up ? rect.top - menuH - 10 : rect.bottom + 10,
      arrowX: menuW - 26,
      arrowBottom: up,
    })
    setMenuFor(f)
  }

  const onTouchStart = (f: Friend) => (e: React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    window.clearTimeout(pressTimer.current)
    pressTimer.current = window.setTimeout(() => openRowMenu(f, rect), 480)
  }
  const onTouchClear = () => window.clearTimeout(pressTimer.current)
  const onContextMenu = (f: Friend) => (e: React.MouseEvent) => {
    e.preventDefault()
    openRowMenu(f, (e.currentTarget as HTMLElement).getBoundingClientRect())
  }

  const togglePin = (f: Friend) => {
    setMenuFor(null)
    saveFriends(loadFriends().map((x) => (x.id === f.id ? { ...x, pinned: !x.pinned } : x)))
    onRefresh()
    showHint(f.pinned ? '已取消置顶' : '已置顶')
  }

  const toggleMute = (f: Friend) => {
    setMenuFor(null)
    saveFriends(loadFriends().map((x) => (x.id === f.id ? { ...x, muted: !x.muted } : x)))
    onRefresh()
    showHint(f.muted ? '已关闭免打扰' : '已开启免打扰')
  }

  const clearChat = (f: Friend) => {
    setConfirm(null)
    saveMessages(loadMessages().filter((m) => m.friendId !== f.id))
    onRefresh()
    showHint('聊天记录已清空')
  }

  const deleteFriend = (f: Friend) => {
    setConfirm(null)
    saveFriends(loadFriends().filter((x) => x.id !== f.id))
    saveMessages(loadMessages().filter((m) => m.friendId !== f.id))
    onRefresh()
    showHint('已删除联系人')
  }

  const lastByFriend = new Map<string, Message>()
  for (const m of messages) {
    const cur = lastByFriend.get(m.friendId)
    if (!cur || m.time > cur.time) lastByFriend.set(m.friendId, m)
  }

  const rows = friends
    .map((f) => ({ friend: f, last: lastByFriend.get(f.id) }))
    .filter(({ friend }) => friend.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort(
      (a, b) =>
        (b.friend.pinned ? 1 : 0) - (a.friend.pinned ? 1 : 0) ||
        (b.last?.time ?? b.friend.createdAt) - (a.last?.time ?? a.friend.createdAt)
    )

  return (
    <div className="page messages-page">
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
            <button
              key={friend.id}
              className={`row ${friend.pinned ? 'pinned' : ''}`}
              onClick={() => onOpenChat(friend.id)}
              onTouchStart={onTouchStart(friend)}
              onTouchEnd={onTouchClear}
              onTouchMove={onTouchClear}
              onContextMenu={onContextMenu(friend)}
            >
              <Avatar name={friend.name} src={friend.avatar} size={50} />
              <div className="row-main">
                <div className="row-top">
                  <span className="row-title-wrap">
                    <span className="row-title">{friend.remark?.trim() || friend.name}</span>
                    {friend.muted && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="row-muted-inline" aria-label="已开启免打扰">
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
                  </span>
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

      {hint && <div className="chat-toast">{hint}</div>}

      {menuFor && (
        <>
          <div className="msg-menu-mask" onClick={() => setMenuFor(null)} />
          <div className={`msg-menu vertical ${menuPos.arrowBottom ? 'arrow-bottom' : 'arrow-top'}`} style={{ left: menuPos.x, top: menuPos.y }}>
            <span className="msg-menu-arrow" style={{ left: menuPos.arrowX }} />
            <button className="msg-menu-item" onClick={() => togglePin(menuFor)}>
              {menuFor.pinned ? '取消置顶' : '置顶'}
            </button>
            <button className="msg-menu-item" onClick={() => toggleMute(menuFor)}>
              {menuFor.muted ? '关闭免打扰' : '免打扰'}
            </button>
            <button className="msg-menu-item" onClick={() => { setConfirm({ kind: 'clear', friend: menuFor }); setMenuFor(null) }}>
              清空聊天
            </button>
            <button className="msg-menu-item danger" onClick={() => { setConfirm({ kind: 'delete', friend: menuFor }); setMenuFor(null) }}>
              删除联系人
            </button>
          </div>
        </>
      )}

      <Modal
        open={confirm !== null}
        title={confirm?.kind === 'delete' ? '删除联系人' : '清空聊天记录'}
        buttons={[
          { label: '取消', onClick: () => setConfirm(null) },
          {
            label: confirm?.kind === 'delete' ? '删除' : '清空',
            primary: true,
            onClick: () => {
              if (confirm) (confirm.kind === 'delete' ? deleteFriend : clearChat)(confirm.friend)
            },
          },
        ]}
      >
        {confirm?.kind === 'delete'
          ? `将删除联系人「${confirm.friend.name}」及其全部聊天记录，无法恢复。`
          : `将删除与「${confirm?.friend.name}」的全部聊天记录，无法恢复。`}
      </Modal>

      <PlusSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onAddFriend={onAddFriend} onOpenMoments={onOpenMoments} />
    </div>
  )
}
