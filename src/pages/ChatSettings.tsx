import { useState } from 'react'
import { NavBar, Avatar, Modal, Chevron } from '../components/common'
import { BackIcon } from '../components/icons'
import { loadFriends, saveFriends, loadMessages, saveMessages } from '../store'
import type { Friend } from '../types'

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className={`ios-switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="ios-switch-knob" />
    </span>
  )
}

export default function ChatSettings({
  friend,
  onBack,
  onOpenProfile,
  onOpenSearch,
  onOpenBg,
  onOpenTranslateLang,
}: {
  friend: Friend
  onBack: () => void
  onOpenProfile: () => void
  onOpenSearch: () => void
  onOpenBg: () => void
  onOpenTranslateLang: () => void
}) {
  const [remarkOpen, setRemarkOpen] = useState(false)
  const [remarkDraft, setRemarkDraft] = useState('')
  const [clearOpen, setClearOpen] = useState(false)
  const [burstOpen, setBurstOpen] = useState(false)
  const [pickKey, setPickKey] = useState<null | 'avatar' | 'time' | 'fmt' | 'read'>(null)
  const [hint, setHint] = useState('')
  const [tick, setTick] = useState(0)
  void tick

  const BURST_OPTIONS = [1, 5, 10, 15, 20, 25, 30]

  type PickKey = 'avatarStyle' | 'timeStyle' | 'timeFormat' | 'readStyle'
  const PICKS: Record<'avatar' | 'time' | 'fmt' | 'read', { title: string; key: PickKey; def: string; options: { v: string; label: string }[] }> = {
    avatar: {
      title: '头像样式',
      key: 'avatarStyle',
      def: 'group',
      options: [
        { v: 'group', label: '合并连续消息' },
        { v: 'show', label: '显示头像' },
        { v: 'none', label: '不显示头像' },
      ],
    },
    time: {
      title: '时间显示',
      key: 'timeStyle',
      def: 'off',
      options: [
        { v: 'off', label: '关闭' },
        { v: 'avatar', label: '头像下方' },
        { v: 'bubble', label: '气泡下方' },
      ],
    },
    fmt: {
      title: '时间格式',
      key: 'timeFormat',
      def: 'hm',
      options: [
        { v: 'hm', label: '时:分' },
        { v: 'hms', label: '时:分:秒' },
      ],
    },
    read: {
      title: '已读未读',
      key: 'readStyle',
      def: 'off',
      options: [
        { v: 'off', label: '关闭' },
        { v: 'avatar', label: '头像下方' },
        { v: 'bubble', label: '气泡末尾' },
      ],
    },
  }
  const pick = pickKey ? PICKS[pickKey] : null

  const cur = loadFriends().find((f) => f.id === friend.id) ?? friend
  const pickCurrent = pick ? ((cur[pick.key] as string | undefined) ?? pick.def) : ''
  const displayName = cur.remark?.trim() || cur.name

  const showHint = (t: string) => {
    setHint(t)
    window.setTimeout(() => setHint(''), 1600)
  }

  const patchFriend = (patch: Partial<Friend>) => {
    saveFriends(loadFriends().map((f) => (f.id === friend.id ? { ...f, ...patch } : f)))
    setTick((t) => t + 1)
  }

  const openRemark = () => {
    setRemarkDraft(cur.remark ?? '')
    setRemarkOpen(true)
  }

  const saveRemark = () => {
    patchFriend({ remark: remarkDraft.trim() })
    setRemarkOpen(false)
    showHint('已保存备注')
  }

  const clearHistory = () => {
    saveMessages(loadMessages().filter((m) => m.friendId !== friend.id))
    setClearOpen(false)
    showHint('聊天记录已清空')
  }

  return (
    <div className="page">
      <NavBar
        title="聊天信息"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body chat-settings-page">
        <div className="list-group">
          <button className="row" onClick={onOpenProfile}>
            <Avatar name={cur.name} src={cur.avatar} size={54} />
            <div className="row-main">
              <span className="row-title">{displayName}</span>
              <span className="row-preview">微信号：{cur.wechatId || '-'}</span>
            </div>
            <Chevron />
          </button>
        </div>

        <div className="list-group">
          <button className="row" onClick={openRemark}>
            <div className="row-main">
              <span className="row-title">备注</span>
            </div>
            <span className={`row-value ${cur.remark?.trim() ? '' : 'placeholder'}`}>{cur.remark?.trim() || '未设置'}</span>
            <Chevron />
          </button>
        </div>

        <div className="list-group">
          <div className="row">
            <div className="row-main">
              <span className="row-title">置顶聊天</span>
            </div>
            <Switch on={Boolean(cur.pinned)} onChange={(v) => patchFriend({ pinned: v })} />
          </div>
          <div className="row">
            <div className="row-main">
              <span className="row-title">免打扰</span>
            </div>
            <Switch on={Boolean(cur.muted)} onChange={(v) => patchFriend({ muted: v })} />
          </div>
        </div>

        <div className="list-group">
          <div className="row">
            <div className="row-main">
              <span className="row-title">自动翻译</span>
              <span className="row-preview">AI 的消息自动翻译：中文译成所选语言，外语译成中文</span>
            </div>
            <Switch on={Boolean(cur.autoTranslate)} onChange={(v) => patchFriend({ autoTranslate: v })} />
          </div>
          {cur.autoTranslate && (
            <button className="row" onClick={onOpenTranslateLang}>
              <div className="row-main">
                <span className="row-title">翻译语言</span>
              </div>
              <span className="row-value">{cur.translateSrc || '中文简体'} ⇄ {cur.translateLang || '英语'}</span>
              <Chevron />
            </button>
          )}
        </div>

        <div className="list-group">
          <button className="row" onClick={() => setPickKey('avatar')}>
            <div className="row-main">
              <span className="row-title">头像样式</span>
            </div>
            <span className="row-value">{PICKS.avatar.options.find((o) => o.v === ((cur.avatarStyle as string | undefined) ?? 'group'))?.label}</span>
            <Chevron />
          </button>
          <button className="row" onClick={() => setPickKey('time')}>
            <div className="row-main">
              <span className="row-title">时间显示</span>
            </div>
            <span className="row-value">{PICKS.time.options.find((o) => o.v === ((cur.timeStyle as string | undefined) ?? 'off'))?.label}</span>
            <Chevron />
          </button>
          <button className="row" onClick={() => setPickKey('fmt')}>
            <div className="row-main">
              <span className="row-title">时间格式</span>
            </div>
            <span className="row-value">{PICKS.fmt.options.find((o) => o.v === ((cur.timeFormat as string | undefined) ?? 'hm'))?.label}</span>
            <Chevron />
          </button>
          <button className="row" onClick={() => setPickKey('read')}>
            <div className="row-main">
              <span className="row-title">已读未读</span>
            </div>
            <span className="row-value">{PICKS.read.options.find((o) => o.v === ((cur.readStyle as string | undefined) ?? 'off'))?.label}</span>
            <Chevron />
          </button>
        </div>

        <div className="list-group">
          <div className="row">
            <div className="row-main">
              <span className="row-title">表情包</span>
              <span className="row-preview">开启后 AI 可以按意思发表情包，关闭后连 emoji 也不发</span>
            </div>
            <Switch on={cur.stickerEnabled !== false} onChange={(v) => patchFriend({ stickerEnabled: v })} />
          </div>
          <div className="row">
            <div className="row-main">
              <span className="row-title">分句发送</span>
              <span className="row-preview">开启后你连发多条消息 TA 都不回复，清空输入框点发送键，TA 才统一回复（表情包、位置、照片同样适用）</span>
            </div>
            <Switch on={Boolean(cur.queuedSend)} onChange={(v) => patchFriend({ queuedSend: v })} />
          </div>
        </div>

        <div className="list-group">
          <button className="row" onClick={() => setBurstOpen(true)}>
            <div className="row-main">
              <span className="row-title">多条信息发送</span>
              <span className="row-preview">AI 回复时连续发送多条消息</span>
            </div>
            <span className="row-value">{(cur.burstCount ?? 10) > 1 ? `${cur.burstCount ?? 10} 条` : '关闭'}</span>
            <Chevron />
          </button>
        </div>

        <div className="list-group">
          <button className="row" onClick={onOpenSearch}>
            <div className="row-main">
              <span className="row-title">查找聊天记录</span>
            </div>
            <Chevron />
          </button>
          <button className="row" onClick={onOpenBg}>
            <div className="row-main">
              <span className="row-title">聊天背景</span>
            </div>
            <Chevron />
          </button>
        </div>

        <div className="list-group">
          <button className="row" onClick={() => setClearOpen(true)}>
            <div className="row-main">
              <span className="row-title danger-text">清空聊天记录</span>
            </div>
          </button>
        </div>

        <Modal
          open={remarkOpen}
          title="设置备注"
          buttons={[
            { label: '取消', onClick: () => setRemarkOpen(false) },
            { label: '保存', primary: true, onClick: saveRemark },
          ]}
        >
          <input
            className="remark-input"
            type="text"
            placeholder="输入备注名"
            maxLength={20}
            value={remarkDraft}
            onChange={(e) => setRemarkDraft(e.target.value)}
            autoFocus
          />
        </Modal>

        <Modal
          open={burstOpen}
          title="多条信息发送"
          buttons={[{ label: '取消', onClick: () => setBurstOpen(false) }]}
        >
          <div className="modal-tip">开启后 AI 每次回复会拆成多条消息连续发送。</div>
          <div className="burst-options">
            {BURST_OPTIONS.map((n) => (
              <button
                key={n}
                className={`burst-option ${(cur.burstCount ?? 10) === n ? 'selected' : ''}`}
                onClick={() => {
                  patchFriend({ burstCount: n })
                  setBurstOpen(false)
                  showHint(n > 1 ? `已设置：每次 ${n} 条` : '已关闭多条发送')
                }}
              >
                {n > 1 ? `${n} 条` : '关闭'}
                {(cur.burstCount ?? 10) === n && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="m5 12.5 4.5 4.5L19 7.5" stroke="#0a84ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </Modal>

        <Modal
          open={!!pick}
          title={pick?.title ?? ''}
          buttons={[{ label: '取消', onClick: () => setPickKey(null) }]}
        >
          <div className="burst-options">
            {(pick?.options ?? []).map((o) => (
              <button
                key={o.v}
                className={`burst-option ${pickCurrent === o.v ? 'selected' : ''}`}
                onClick={() => {
                  if (pick) patchFriend({ [pick.key]: o.v } as Partial<Friend>)
                  setPickKey(null)
                }}
              >
                {o.label}
                {pickCurrent === o.v && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="m5 12.5 4.5 4.5L19 7.5" stroke="#0a84ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </Modal>

        <Modal
          open={clearOpen}
          title="清空聊天记录"
          buttons={[
            { label: '取消', onClick: () => setClearOpen(false) },
            { label: '清空', primary: true, onClick: clearHistory },
          ]}
        >
          <div className="modal-tip">将删除与「{displayName}」的全部聊天记录，无法恢复。</div>
        </Modal>

        {hint && <div className="chat-toast">{hint}</div>}
      </div>
    </div>
  )
}
