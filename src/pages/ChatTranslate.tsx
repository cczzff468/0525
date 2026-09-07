import { useState } from 'react'
import { NavBar, formatTime } from '../components/common'
import { BackIcon } from '../components/icons'
import { loadMessages, loadApiSetting } from '../store'
import { chatUrl } from '../utils/ai'

export default function ChatTranslate({
  friendId,
  friendName,
  onBack,
}: {
  friendId: string
  friendName: string
  onBack: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Record<string, string>>({})

  const msgs = loadMessages()
    .filter((m) => m.friendId === friendId)
    .sort((a, b) => a.time - b.time)
    .slice(-30)

  const translate = async () => {
    if (busy) return
    if (msgs.length === 0) {
      setError('还没有聊天内容可以翻译')
      return
    }
    setBusy(true)
    setError('')
    try {
      const cfg = loadApiSetting()
      if (!cfg.baseUrl.trim() || !cfg.model.trim()) throw new Error('未配置聊天 API，请先到 设置-API设置 填写')
      const numbered = msgs
        .map((m, i) => `${i + 1}. ${m.text.replace(/\n/g, ' ')}`)
        .join('\n')
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
              content:
                '你是翻译助手。用户会给一组编号的聊天消息，把每条翻译：中文翻译成英文，其他语言翻译成简体中文。要求：逐条翻译，输出与输入相同的编号行（如 "1. xxx"），一行一条，只输出译文，不要解释。'
            },
            { role: 'user', content: numbered },
          ],
          temperature: 0.2,
          stream: false,
        }),
      })
      if (!res.ok) throw new Error(`翻译失败（HTTP ${res.status}）`)
      const data = await res.json()
      const text: string = data?.choices?.[0]?.message?.content ?? ''
      const map: Record<string, string> = {}
      for (const line of text.split('\n')) {
        const m = /^\s*(\d+)[.、)]\s*(.+)$/.exec(line)
        if (m) {
          const idx = Number(m[1]) - 1
          if (idx >= 0 && idx < msgs.length) map[msgs[idx].id] = m[2].trim()
        }
      }
      if (Object.keys(map).length === 0) throw new Error('AI 没有返回有效的翻译结果')
      setResult(map)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '翻译失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const doneCount = Object.keys(result).length

  return (
    <div className="page">
      <NavBar
        title="翻译"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body chat-translate-page">
        <div className="chat-translate-info">
          {msgs.length > 0 ? `翻译与 ${friendName} 最近 ${msgs.length} 条聊天消息，中文译英文，外语译中文。` : `与 ${friendName} 还没有聊天内容。`}
        </div>

        {msgs.length > 0 && !doneCount && (
          <button className="chat-translate-btn" disabled={busy} onClick={translate}>
            {busy ? '翻译中…' : '开始翻译'}
          </button>
        )}

        {error && <div className="chat-translate-error">{error}</div>}

        {doneCount > 0 && (
          <div className="list-group chat-translate-list">
            {msgs.map((m) => (
              <div key={m.id} className="chat-translate-item">
                <div className="chat-translate-meta">
                  <span className="chat-translate-who">{m.from === 'me' ? '我' : friendName}</span>
                  <span className="chat-translate-time">{formatTime(m.time)}</span>
                </div>
                <div className="chat-translate-src">{m.text}</div>
                {result[m.id] && <div className="chat-translate-dst">{result[m.id]}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
