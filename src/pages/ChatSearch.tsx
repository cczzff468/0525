import { useMemo, useState } from 'react'
import { NavBar } from '../components/common'
import { BackIcon, SearchIcon } from '../components/icons'
import { loadMessages } from '../store'
import { formatTimeFull } from '../components/common'

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const parts: React.ReactNode[] = []
  const lower = text.toLowerCase()
  const ql = q.toLowerCase()
  let i = 0
  let k = 0
  while (i < text.length) {
    const hit = lower.indexOf(ql, i)
    if (hit < 0) {
      parts.push(text.slice(i))
      break
    }
    if (hit > i) parts.push(text.slice(i, hit))
    parts.push(
      <mark key={k++} className="chat-search-mark">
        {text.slice(hit, hit + ql.length)}
      </mark>
    )
    i = hit + ql.length
  }
  return <>{parts}</>
}

export default function ChatSearch({
  friendId,
  friendName,
  onBack,
  onJump,
}: {
  friendId: string
  friendName: string
  onBack: () => void
  onJump: (messageId: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!q) return []
    return loadMessages()
      .filter((m) => m.friendId === friendId && m.text.toLowerCase().includes(q))
      .sort((a, b) => b.time - a.time)
  }, [friendId, q])

  return (
    <div className="page">
      <NavBar
        title="查找聊天记录"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
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
            placeholder={`搜索与 ${friendName} 的聊天内容`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </NavBar>
      <div className="page-body chat-search-page">
        {!q && <div className="empty-hint">输入关键词，查找这个聊天里的消息</div>}
        {q && results.length === 0 && <div className="empty-hint">没有找到包含「{query.trim()}」的消息</div>}
        {q && results.length > 0 && (
          <>
            <div className="chat-search-count">
              找到 {results.length} 条结果
            </div>
            <div className="list-group">
              {results.map((m) => (
                <button key={m.id} className="row" onClick={() => onJump(m.id)}>
                  <div className="row-main">
                    <div className="chat-search-meta">
                      <span className="chat-search-who">{m.from === 'me' ? '我' : friendName}</span>
                      <span className="chat-search-time">{formatTimeFull(m.time)}</span>
                    </div>
                    <span className="chat-search-text">
                      <Highlight text={m.text} query={query} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
