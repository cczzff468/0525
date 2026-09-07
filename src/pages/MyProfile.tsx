import { useState } from 'react'
import { NavBar, Chevron } from '../components/common'
import { BackIcon } from '../components/icons'
import { letterAvatar, loadPersonas, loadActivePersonaId, saveActivePersonaId, loadProfile } from '../store'

export default function MyProfile({
  onBack,
  onEditPersona,
  onOpenMoments,
  onOpenMemory,
}: {
  onBack: () => void
  onEditPersona: (personaId?: string) => void
  onOpenMoments: () => void
  onOpenMemory: () => void
}) {
  const [tick, setTick] = useState(0)
  const personas = loadPersonas()
  const activeId = loadActivePersonaId()
  const p = loadProfile()
  const avatar = p.avatar || letterAvatar(p.name)

  const activate = (id: string) => {
    if (id === activeId) return
    saveActivePersonaId(id)
    setTick((t) => t + 1)
  }

  return (
    <div className="page" key={tick}>
      <NavBar
        title="个人信息"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <button className="profile-hero" onClick={() => onEditPersona(activeId)}>
          <img className="profile-hero-avatar" src={avatar} alt={p.name} />
          <div className="profile-hero-main">
            <div className="profile-hero-name">{p.name}</div>
            <div className="profile-hero-wechat">微信号：{p.wechatId || 'ios_demo'}</div>
            {p.region && <div className="profile-hero-wechat">地区：{p.region}</div>}
          </div>
          <span className="profile-hero-tag">当前人设</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="profile-qr">
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="#c7c7cc" strokeWidth="1.7" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="#c7c7cc" strokeWidth="1.7" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="#c7c7cc" strokeWidth="1.7" />
            <rect x="14" y="14" width="2.6" height="2.6" fill="#c7c7cc" />
            <rect x="18" y="18" width="2.6" height="2.6" fill="#c7c7cc" />
          </svg>
        </button>

        <div className="section-label">人设管理 · {personas.length} 套</div>
        <div className="list-group">
          {personas.length === 0 && (
            <div className="personas-empty">还没有人设，点击下方“添加人设”创建第一个身份吧。</div>
          )}
          {personas.map((per) => {
            const perAvatar = per.avatar || letterAvatar(per.name)
            const isActive = per.id === activeId
            return (
              <div
                key={per.id}
                className={`row persona-row ${isActive ? 'persona-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => activate(per.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') activate(per.id)
                }}
              >
                <img className="avatar avatar-s" src={perAvatar} alt={per.name} />
                <div className="row-main">
                  <span className="row-title">
                    {per.name}
                    {isActive && <span className="persona-badge">使用中</span>}
                  </span>
                  <span className="row-preview">{per.bio || `${per.gender}${per.age > 0 ? ` · ${per.age} 岁` : ''}`}</span>
                </div>
                <button
                  className="persona-edit-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditPersona(per.id)
                  }}
                >
                  编辑
                </button>
              </div>
            )
          })}
          <button className="row persona-add-row" onClick={() => onEditPersona()}>
            <div className="row-icon" style={{ background: '#07c160' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 6v12M6 12h12" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <span className="row-title">添加人设</span>
            <Chevron />
          </button>
        </div>
        <div className="list-group">
          <div className="row row-static">
            <span className="row-title form-label">性别</span>
            <span className="row-value">{p.gender}</span>
          </div>
          <div className="row row-static">
            <span className="row-title form-label">年龄</span>
            <span className="row-value">{p.age > 0 ? p.age : '未设置'}</span>
          </div>
          <div className="row row-static">
            <span className="row-title form-label">地区</span>
            <span className="row-value">{p.region || '未设置'}</span>
          </div>
          <button className="row" onClick={onOpenMoments}>
            <span className="row-title form-label">朋友圈</span>
            <span className="row-value" />
            <Chevron />
          </button>
          <button className="row" onClick={onOpenMemory}>
            <span className="row-title form-label">记忆匣子</span>
            <span className="row-value" />
            <Chevron />
          </button>
          <div className="row row-static">
            <span className="row-title form-label">更多信息</span>
            <Chevron />
          </div>
        </div>

        <div className="personas-hint">点击任意人设立即切换：名字、头像、微信号、地区与聊天身份全部随之变化。</div>
      </div>
    </div>
  )
}
