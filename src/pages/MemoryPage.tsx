import { useMemo, useState } from 'react'
import { NavBar, Avatar, Modal } from '../components/common'
import { BackIcon } from '../components/icons'
import { loadFriends, loadMemoryData, saveMemoryData, loadMessages } from '../store'
import { manualFragment, manualLongTerm } from '../utils/memory'
import type { Friend, MemoryFragment, LongTermMemory } from '../types'

type Tab = 'fragments' | 'longTerm' | 'settings'

const FRAGMENT_OPTIONS = [10, 20, 30, 40, 50]
const LONGTERM_OPTIONS = [3, 5, 7, 10]

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
      <div className="page-body api-page">
        <div className="section-label">选择要查看记忆的联系人</div>
        <div className="list-group">
          {friends.map((f) => {
            const fc = data.fragments.filter((x) => x.friendId === f.id).length
            const lc = data.longTerm.filter((x) => x.friendId === f.id).length
            return (
              <button key={f.id} className="row" onClick={() => onPick(f.id)}>
                <Avatar name={f.name} src={f.avatar} size={40} />
                <div className="row-main">
                  <span className="row-title">{f.name}</span>
                  <span className="row-preview">
                    {fc > 0 || lc > 0 ? `${fc} 个碎片 · ${lc} 份长期记忆` : '还没有记忆，聊过天后来这里看看'}
                  </span>
                </div>
                {fc > 0 || lc > 0 ? (
                  <div style={{ fontSize: 11, color: '#0a84ff', fontWeight: 600 }}>
                    {fc + lc}
                  </div>
                ) : null}
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

export default function MemoryPage({
  friendId,
  onBack,
  onPickFriend,
  onClearFriend,
}: {
  friendId?: string
  onBack: () => void
  onPickFriend: (id: string) => void
  onClearFriend: () => void
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
  const frags = data.fragments
    .filter((f) => f.friendId === friendIdSafe)
    .sort((a, b) => b.createdAt - a.createdAt)
  const lts = data.longTerm
    .filter((l) => l.friendId === friendIdSafe)
    .sort((a, b) => b.createdAt - a.createdAt)
  const pendingCount = (() => {
    const msgs = loadMessages().filter((m) => m.friendId === friendIdSafe)
    const lastId = data.lastMsgId[friendIdSafe]
    const idx = lastId ? msgs.findIndex((m) => m.id === lastId) : -1
    return idx >= 0 ? msgs.length - idx - 1 : msgs.length
  })()

  const showHint = (t: string) => {
    setHint(t)
    window.setTimeout(() => setHint(''), 2200)
  }

  const refresh = () => setTick((t) => t + 1)

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

  const FragCard = ({ item, kind }: { item: MemoryFragment | LongTermMemory; kind: 'frag' | 'long' }) => (
    <div className="memory-card">
      <div className="memory-card-head">
        <span className="memory-card-time">{fmtTime(item.createdAt)}</span>
        <span className={`memory-badge ${item.source}`}>
          {item.source === 'auto' ? (kind === 'frag' ? '自动总结' : '自动归纳') : kind === 'frag' ? '手动总结' : '手动归纳'}
        </span>
      </div>
      <div className="memory-card-body">
        {item.content.split('\n').map((line, i) => (
          <p key={i} className="memory-line">{line}</p>
        ))}
      </div>
      {kind === 'frag' && 'msgCount' in item && <div className="memory-card-foot">基于 {item.msgCount} 条消息</div>}
    </div>
  )

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
        <div className="memory-friend-head">
          <Avatar name={friend.name} src={friend.avatar} size={44} />
          <div>
            <div className="memory-friend-name">和 {friend.name} 的记忆</div>
            <div className="memory-friend-sub">
              {frags.length} 个碎片 · {lts.length} 份长期记忆 · 未总结 {pendingCount} 条消息
            </div>
          </div>
        </div>

        {/* 统计概览 */}
        <div className="memory-stats">
          <div className="memory-stat-card">
            <div className="memory-stat-num">{frags.length}</div>
            <div className="memory-stat-label">记忆碎片</div>
          </div>
          <div className="memory-stat-card">
            <div className="memory-stat-num">{lts.length}</div>
            <div className="memory-stat-label">长期记忆</div>
          </div>
          <div className="memory-stat-card">
            <div className="memory-stat-num">{pendingCount}</div>
            <div className="memory-stat-label">待总结</div>
          </div>
        </div>

        <div className="memory-tabs">
          {(
            [
              { key: 'fragments', label: '记忆碎片' },
              { key: 'longTerm', label: '长期记忆' },
              { key: 'settings', label: '设置' },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button key={t.key} className={`memory-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'fragments' && (
          <>
            <div className="memory-list">
              {frags.map((f) => (
                <FragCard key={f.id} item={f} kind="frag" />
              ))}
              {frags.length === 0 && (
                <div className="empty-hint">
                  还没有记忆碎片。和 {friend.name} 聊满 {data.settings.fragmentEvery} 条消息会自动总结，
                  或点下方按钮立即总结。
                </div>
              )}
            </div>
            <button className="primary-btn" disabled={busy !== null} onClick={() => runManual('frag')}>
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
                <FragCard key={l.id} item={l} kind="long" />
              ))}
              {lts.length === 0 && (
                <div className="empty-hint">
                  还没有长期记忆。积累 {data.settings.longTermEvery} 个新碎片后会自动归纳一次核心记忆，
                  也可以现在就基于已有碎片手动归纳。
                </div>
              )}
            </div>
            <button className="primary-btn" disabled={busy !== null} onClick={() => runManual('long')}>
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

            <div className="section-label">手动总结</div>
            <div className="form-row">
              <span className="form-preview">
                不需要等轮数，在「记忆碎片」和「长期记忆」页随时点「立即总结」按钮，AI 会立刻整理当前对话的关键信息存入记忆库。总结出的记忆会自动注入
                {friend.name} 的聊天中，让 TA 记得住你们聊过什么。
              </span>
            </div>
            <div className="form-row">
              <span className="form-preview">未来朋友圈互动、红包转账等新事件也会纳入自动总结范围。</span>
            </div>
          </div>
        )}

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
    </div>
  )
}
