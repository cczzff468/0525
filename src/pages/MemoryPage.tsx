import { useMemo, useState } from 'react'
import { NavBar, Avatar, Modal } from '../components/common'
import { BackIcon } from '../components/icons'
import { loadApiSetting, loadFriends, loadMemoryData, saveMemoryData, loadMessages } from '../store'
import { manualFragment, manualLongTerm } from '../utils/memory'
import type { Friend, MemoryFragment, LongTermMemory } from '../types'

type Tab = 'fragments' | 'longTerm' | 'settings'

const FRAGMENT_OPTIONS = [10, 20, 30, 40, 50]
const LONGTERM_OPTIONS = [3, 5, 7, 10]

function FragmentsIcon({ active }: { active: boolean }) {
  const c = active ? '#0a84ff' : '#8e8e93'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h4" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function LongTermIcon({ active }: { active: boolean }) {
  const c = active ? '#00b3c7' : '#8e8e93'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.2 3.5 5 6.8 5c2 0 3.6 1.1 4.4 2.7l.8 1.6.8-1.6C13.6 6.1 15.2 5 17.2 5c3.3 0 5.3 3.2 4.1 6.3-1.8 4.6-9.3 9.2-9.3 9.2Z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function SettingsIcon({ active }: { active: boolean }) {
  const c = active ? '#0a84ff' : '#8e8e93'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3.2" stroke={c} strokeWidth="1.8" />
      <path d="M12 2.8 13.2 5a7.2 7.2 0 0 1 2.5 1l2.4-.8 1.7 3-1.7 1.9a7 7 0 0 1 0 2.8l1.7 1.9-1.7 3-2.4-.8a7.2 7.2 0 0 1-2.5 1L12 21.2 10.8 19a7.2 7.2 0 0 1-2.5-1l-2.4.8-1.7-3 1.7-1.9a7 7 0 0 1 0-2.8L4.2 9.2l1.7-3 2.4.8a7.2 7.2 0 0 1 2.5-1L12 2.8Z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`
}

function FriendPicker({ onBack, onPick }: { onBack: () => void; onPick: (id: string) => void }) {
  const friends = loadFriends()
  const data = loadMemoryData()
  return (
    <div className="page">
      <NavBar
        title="记忆匣子"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body memory-page">
        <div className="memory-picker-intro">
          <div className="memory-pick-hero">
            <div className="memory-pick-hero-title">记忆匣子</div>
            <div className="memory-pick-hero-sub">AI 在这里记住你们聊过的每一件小事</div>
          </div>
        </div>
        <div className="section-label">选择要查看记忆的联系人</div>
        <div className="list-group memory-friend-list">
          {friends.map((f) => {
            const fc = data.fragments.filter((x) => x.friendId === f.id).length
            const lc = data.longTerm.filter((x) => x.friendId === f.id).length
            return (
              <button key={f.id} className="row" onClick={() => onPick(f.id)}>
                <Avatar name={f.name} src={f.avatar} size={42} />
                <div className="row-main">
                  <span className="row-title">{f.name}</span>
                  <span className="row-preview">
                    {fc > 0 || lc > 0 ? `${fc} 个碎片 · ${lc} 份长期记忆` : '还没有记忆，聊过天后来这里看看'}
                  </span>
                </div>
                {fc > 0 || lc > 0 ? (
                  <span className="memory-count-badge">{fc + lc}</span>
                ) : (
                  <span className="memory-count-badge empty">0</span>
                )}
              </button>
            )
          })}
          {friends.length === 0 && (
            <div className="form-row">
              <span className="form-preview">还没有联系人，先去添加好友开始聊天吧</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FragmentCard({ item }: { item: MemoryFragment }) {
  const lines = item.content
    .split('\n')
    .map((l) => l.replace(/^[·•▪◦*\-–—]\s*/, '').trim())
    .filter(Boolean)
  return (
    <div className="memory-card frag">
      <div className="memory-card-head">
        <span className="memory-card-time">{fmtTime(item.createdAt)}</span>
        <span className={`memory-badge ${item.source}`}>{item.source === 'auto' ? '自动总结' : '手动总结'}</span>
      </div>
      <ul className="memory-dot-list">
        {lines.map((line, i) => (
          <li key={i} className="memory-dot-item">{line}</li>
        ))}
      </ul>
      <div className="memory-card-foot">基于 {item.msgCount} 条消息</div>
    </div>
  )
}

function LongTermCard({ item }: { item: LongTermMemory }) {
  return (
    <div className="memory-card long">
      <div className="memory-card-head">
        <span className="memory-core-tag">核心记忆</span>
        <span className={`memory-badge ${item.source}`}>{item.source === 'auto' ? '自动归纳' : '手动归纳'}</span>
      </div>
      <p className="memory-para">{item.content}</p>
      <div className="memory-card-foot">{fmtTime(item.createdAt)}</div>
    </div>
  )
}

export default function MemoryPage({
  friendId,
  onBack,
  onPickFriend,
  onClearFriend,
  onOpenApi,
}: {
  friendId?: string
  onBack: () => void
  onPickFriend: (id: string) => void
  onClearFriend: () => void
  onOpenApi?: () => void
}) {
  const friendIdSafe = friendId
  const [tab, setTab] = useState<Tab>('fragments')
  const [busy, setBusy] = useState<'frag' | 'long' | null>(null)
  const [hint, setHint] = useState('')
  const [clearTarget, setClearTarget] = useState<'frag' | 'long' | null>(null)
  const [tick, setTick] = useState(0)

  const friend: Friend | undefined = useMemo(() => loadFriends().find((f) => f.id === friendIdSafe), [friendIdSafe, tick])

  if (!friendIdSafe || !friend) {
    return <FriendPicker onBack={onBack} onPick={onPickFriend} />
  }

  const data = loadMemoryData()
  const apiCfg = loadApiSetting()
  const apiReady = Boolean(apiCfg.baseUrl.trim() && apiCfg.model.trim())
  const apiHost = (() => {
    try {
      return new URL(apiCfg.baseUrl).host
    } catch {
      return apiCfg.baseUrl.trim() || '未设置'
    }
  })()

  const frags = data.fragments
    .filter((f) => f.friendId === friendIdSafe)
    .sort((a, b) => b.createdAt - a.createdAt)
  const lts = data.longTerm
    .filter((l) => l.friendId === friendIdSafe)
    .sort((a, b) => b.createdAt - a.createdAt)
  const lastError = data.lastError?.[friendIdSafe]
  const pendingCount = (() => {
    const msgs = loadMessages().filter((m) => m.friendId === friendIdSafe)
    const lastId = data.lastMsgId[friendIdSafe]
    const idx = lastId ? msgs.findIndex((m) => m.id === lastId) : -1
    return idx >= 0 ? msgs.length - idx - 1 : msgs.length
  })()

  const showHint = (t: string) => {
    setHint(t)
    window.setTimeout(() => setHint(''), 2600)
  }

  const refresh = () => setTick((t) => t + 1)

  const dismissError = () => {
    const cur = loadMemoryData()
    if (cur.lastError?.[friendIdSafe]) {
      const next = { ...cur.lastError }
      delete next[friendIdSafe]
      cur.lastError = next
      saveMemoryData(cur)
      refresh()
    }
  }

  const runManual = async (kind: 'frag' | 'long') => {
    if (busy) return
    setBusy(kind)
    try {
      if (kind === 'frag') {
        await manualFragment(friendIdSafe)
        showHint('已总结当前对话并存入记忆碎片')
      } else {
        await manualLongTerm(friendIdSafe)
        showHint('已归纳出新的长期记忆')
      }
      refresh()
    } catch (e: unknown) {
      showHint(e instanceof Error ? e.message : '操作失败，请重试')
    } finally {
      setBusy(null)
    }
  }

  const clearMemory = () => {
    if (!clearTarget) return
    const cur = loadMemoryData()
    if (clearTarget === 'frag') {
      cur.fragments = cur.fragments.filter((f) => f.friendId !== friendIdSafe)
      cur.lastMsgId = { ...cur.lastMsgId, [friendIdSafe]: '' }
    } else {
      cur.longTerm = cur.longTerm.filter((l) => l.friendId !== friendIdSafe)
    }
    saveMemoryData(cur)
    setClearTarget(null)
    refresh()
    showHint('已清空')
  }

  const setEvery = (patch: Partial<typeof data.settings>) => {
    const cur = loadMemoryData()
    saveMemoryData({ ...cur, settings: { ...cur.settings, ...patch } })
    refresh()
  }

  const TABS: { key: Tab; label: string; icon: (active: boolean) => JSX.Element; badge?: number }[] = [
    { key: 'fragments', label: '碎片', icon: (a) => <FragmentsIcon active={a} />, badge: frags.length },
    { key: 'longTerm', label: '长期', icon: (a) => <LongTermIcon active={a} />, badge: lts.length },
    { key: 'settings', label: '设置', icon: (a) => <SettingsIcon active={a} /> },
  ]

  return (
    <div className="page">
      <NavBar
        title="记忆匣子"
        left={
          <button className="nav-btn" onClick={onClearFriend} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body memory-page">
        <div className="memory-hero">
          <Avatar name={friend.name} src={friend.avatar} size={46} />
          <div className="memory-hero-text">
            <div className="memory-hero-name">和 {friend.name} 的记忆</div>
            <div className="memory-hero-sub">未总结 {pendingCount} 条消息</div>
          </div>
          <div className="memory-hero-chips">
            <span className="memory-chip">碎片 {frags.length}</span>
            <span className="memory-chip long">长期 {lts.length}</span>
          </div>
        </div>

        {lastError && (
          <div className="memory-error-bar">
            <div className="memory-error-main">
              <span className="memory-error-title">上次自动总结失败</span>
              <span className="memory-error-detail">{lastError.message}</span>
              <span className="memory-error-time">{fmtTime(lastError.time)}</span>
            </div>
            <button className="memory-error-close" onClick={dismissError} aria-label="忽略">
              ×
            </button>
          </div>
        )}

        {tab === 'fragments' && (
          <>
            <div className="memory-list">
              {frags.map((f) => (
                <FragmentCard key={f.id} item={f} />
              ))}
              {frags.length === 0 && (
                <div className="memory-empty">
                  <div className="memory-empty-icon frag-icon" />
                  <div className="memory-empty-title">还没有记忆碎片</div>
                  <div className="memory-empty-sub">
                    和 {friend.name} 聊满 {data.settings.fragmentEvery} 条消息会自动总结，也可以点下方按钮立即总结
                  </div>
                </div>
              )}
            </div>
            <button className="memory-action-btn frag-btn" disabled={busy !== null} onClick={() => runManual('frag')}>
              {busy === 'frag' ? '总结中…' : '立即总结当前对话'}
            </button>
            {frags.length > 0 && (
              <button className="memory-clear-btn" onClick={() => setClearTarget('frag')}>
                清空记忆碎片
              </button>
            )}
          </>
        )}

        {tab === 'longTerm' && (
          <>
            <div className="memory-list">
              {lts.map((l) => (
                <LongTermCard key={l.id} item={l} />
              ))}
              {lts.length === 0 && (
                <div className="memory-empty">
                  <div className="memory-empty-icon long-icon" />
                  <div className="memory-empty-title">还没有长期记忆</div>
                  <div className="memory-empty-sub">
                    积累 {data.settings.longTermEvery} 个新碎片后会自动归纳一次核心记忆，也可以现在手动归纳
                  </div>
                </div>
              )}
            </div>
            <button className="memory-action-btn long-btn" disabled={busy !== null} onClick={() => runManual('long')}>
              {busy === 'long' ? '归纳中…' : '立即归纳长期记忆'}
            </button>
            {lts.length > 0 && (
              <button className="memory-clear-btn" onClick={() => setClearTarget('long')}>
                清空长期记忆
              </button>
            )}
          </>
        )}

        {tab === 'settings' && (
          <div className="memory-settings">
            <div className="section-label">API 模型连接</div>
            <div className="memory-api-card">
              <div className="memory-api-status">
                <span className={`memory-api-dot ${apiReady ? 'ok' : 'bad'}`} />
                <span className="memory-api-state">{apiReady ? '已连接' : '未配置'}</span>
              </div>
              <div className="memory-api-model">{apiReady ? apiCfg.model.trim() : '尚未选择模型'}</div>
              <div className="memory-api-host">{apiReady ? apiHost : '到 设置-API设置 填写接口地址和模型'}</div>
              {onOpenApi && (
                <button className="memory-api-btn" onClick={onOpenApi}>
                  {apiReady ? '更换 API 模型' : '去设置 API'}
                </button>
              )}
            </div>
            <div className="form-row">
              <span className="form-preview">记忆总结和聊天回复都使用这里连接的 API 模型。</span>
            </div>

            <div className="section-label">对话总结频率</div>
            <div className="seg-group memory-seg">
              {FRAGMENT_OPTIONS.map((n) => (
                <button
                  key={n}
                  className={`seg-item ${data.settings.fragmentEvery === n ? 'active' : ''}`}
                  onClick={() => setEvery({ fragmentEvery: n })}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="form-row">
              <span className="form-preview">每 {data.settings.fragmentEvery} 条消息自动总结一次记忆碎片（一问一答算 2 条）</span>
            </div>

            <div className="section-label">长期记忆总结频率</div>
            <div className="seg-group memory-seg">
              {LONGTERM_OPTIONS.map((n) => (
                <button
                  key={n}
                  className={`seg-item ${data.settings.longTermEvery === n ? 'active' : ''}`}
                  onClick={() => setEvery({ longTermEvery: n })}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="form-row">
              <span className="form-preview">
                每积累 {data.settings.longTermEvery} 个新碎片，自动归纳一次核心长期记忆
              </span>
            </div>

            <div className="section-label">记忆如何用于聊天</div>
            <div className="form-row">
              <span className="form-preview">
                每次聊天时，AI 会自动带上最近的消息上下文、最新 5 条记忆碎片和 1 份核心长期记忆，所以 TA
                记得你们聊过的事。随时点「立即总结」可把当前对话立刻写入记忆。
              </span>
            </div>
          </div>
        )}

        <div className="memory-tabbar-space" />
      </div>

      <nav className="memory-tabbar">
        {TABS.map((t) => (
          <button key={t.key} className={`memory-tab-item ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.icon(tab === t.key)}
            <span className="memory-tab-label">{t.label}</span>
            {typeof t.badge === 'number' && t.badge > 0 && <span className="memory-tab-badge">{t.badge}</span>}
          </button>
        ))}
      </nav>

      <Modal
        open={clearTarget !== null}
        title={clearTarget === 'frag' ? '清空记忆碎片？' : '清空长期记忆？'}
        buttons={[
          { label: '取消', onClick: () => setClearTarget(null) },
          { label: '清空', primary: true, onClick: clearMemory },
        ]}
      >
        <div className="modal-tip">清空后 {friend.name} 会忘记这部分记忆，且无法恢复。</div>
      </Modal>

      {hint && <div className="chat-toast">{hint}</div>}
    </div>
  )
}
