import { useState } from 'react'
import { NavBar, Chevron, ActionSheet } from '../components/common'
import { BackIcon } from '../components/icons'
import { letterAvatar } from '../store'
import type { Friend } from '../types'

export default function FriendDetail({
  friend,
  onBack,
  onOpenChat,
  onEdit,
  onDelete,
}: {
  friend: Friend
  onBack: () => void
  onOpenChat: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const avatar = friend.avatar || letterAvatar(friend.name)
  return (
    <div className="page">
      <NavBar
        title="详细资料"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="list-group">
          <div className="row friend-detail-head">
            <img className="friend-detail-avatar" src={avatar} alt={friend.name} />
            <div className="row-main">
              <div className="friend-detail-name">{friend.name}</div>
              <div className="friend-detail-sub">微信号：{friend.wechatId || '未设置'}</div>
            </div>
          </div>
        </div>

        <div className="list-group">
          <div className="row row-static">
            <span className="row-title form-label">性别</span>
            <span className="row-value">{friend.gender || '保密'}</span>
          </div>
          <div className="row row-static">
            <span className="row-title form-label">年龄</span>
            <span className="row-value">{friend.age > 0 ? friend.age : '未设置'}</span>
          </div>
          <div className="row row-static">
            <span className="row-title form-label">地区</span>
            <span className="row-value">{friend.region || '未设置'}</span>
          </div>
        </div>

        <div className="list-group">
          <button className="row" onClick={onOpenChat}>
            <span className="row-title friend-detail-chat">发消息</span>
            <Chevron />
          </button>
          <button className="row" onClick={onEdit}>
            <span className="row-title friend-detail-chat">编辑资料</span>
            <Chevron />
          </button>
        </div>

        <div className="list-group">
          <button className="row" onClick={() => setConfirmOpen(true)}>
            <span className="row-title friend-detail-danger">删除联系人</span>
          </button>
        </div>

        <ActionSheet visible={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <div className="sheet-group sheet-confirm">
            <div className="sheet-confirm-text">将“{friend.name}”删除，同时删除与 TA 的全部聊天记录，无法恢复。</div>
            <button className="sheet-item sheet-danger" onClick={onDelete}>
              删除联系人
            </button>
          </div>
          <div className="sheet-group">
            <button className="sheet-item sheet-cancel" onClick={() => setConfirmOpen(false)}>
              取消
            </button>
          </div>
        </ActionSheet>
      </div>
    </div>
  )
}
