import { useState } from 'react'
import type { Friend } from '../types'
import { Avatar, NavBar, Chevron } from '../components/common'
import { PlusIcon } from '../components/icons'
import { PlusSheet } from './Messages'

export default function Contacts({
  friends,
  onOpenChat,
  onOpenFriend,
  onAddFriend,
  onOpenMoments,
}: {
  friends: Friend[]
  onOpenChat: (friendId: string) => void
  onOpenFriend: (friendId: string) => void
  onAddFriend: () => void
  onOpenMoments: () => void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const sorted = [...friends].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))

  return (
    <div className="page">
      <NavBar
        large
        title="联系人"
        right={
          <button className="nav-btn" onClick={() => setSheetOpen(true)} aria-label="添加">
            <PlusIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="list-group">
          <button className="row" onClick={onAddFriend}>
            <div className="row-icon" style={{ background: '#007aff' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="10" cy="8.4" r="3" stroke="#fff" strokeWidth="1.8" />
                <path d="M4.4 19c.7-2.8 3-4.4 5.6-4.4s4.9 1.6 5.6 4.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M18.4 9v6M15.4 12h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div className="row-main">
              <span className="row-title">新的朋友</span>
            </div>
            <Chevron />
          </button>
          <button className="row" onClick={() => onOpenChat(friends[0]?.id ?? '')} disabled={friends.length === 0}>
            <div className="row-icon" style={{ background: '#34c759' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3.8c4.7 0 8.2 3 8.2 7 0 3.9-3.5 7-8.2 7-.8 0-1.6-.1-2.3-.3-.9.7-2.1 1.3-3.8 1.5.4-.8.6-1.6.6-2.4-1.7-1.3-2.7-3-2.7-5.8 0-4 3.5-7 8.2-7Z"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="row-main">
              <span className="row-title">最近聊天</span>
            </div>
            <Chevron />
          </button>
        </div>

        <div className="section-label">
          联系人 · {sorted.length}
        </div>
        {sorted.length === 0 && <div className="empty-hint">暂无联系人，点右上角 + 添加好友</div>}
        <div className="list-group">
          {sorted.map((f) => (
            <button key={f.id} className="row" onClick={() => onOpenFriend(f.id)}>
              <Avatar name={f.name} src={f.avatar} size={44} />
              <div className="row-main">
                <span className="row-title">{f.name}</span>
              </div>
              <Chevron />
            </button>
          ))}
        </div>
      </div>
      <PlusSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onAddFriend={onAddFriend} onOpenMoments={onOpenMoments} />
    </div>
  )
}
