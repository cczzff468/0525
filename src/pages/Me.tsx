import { NavBar, Chevron } from '../components/common'
import { loadProfile } from '../store'

const ROWS = [
  { label: '服务', bg: '#34c759', d: 'M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z' },
  { label: '收藏', bg: '#ff9500', d: 'm12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 4Z' },
  { label: '朋友圈', bg: '#007aff', d: 'M12 4a8 8 0 1 1-8 8' },
  { label: '记忆匣子', bg: '#00b3c7', d: 'M9 3.5h6M7.5 5.5h9a1 1 0 0 1 1 1V19a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V6.5a1 1 0 0 1 1-1ZM12 10c-1.8 0-3 1-3 2.4 0 2.1 3 2.1 3 3.6m0-6c1.8 0 3 1 3 2.4 0 2.1-3 2.1-3 3.6m0-6v9' },
  { label: '卡包', bg: '#ff2d55', d: 'M4 9h16v10H4V9Zm0 4h16' },
  { label: '表情', bg: '#ffd60a', d: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM9 10h.01M15 10h.01M8.5 14.2c1 1.3 2.1 1.9 3.5 1.9s2.5-.6 3.5-1.9' },
]

export default function Me({
  onOpenProfile,
  onOpenSettings,
  onOpenMoments,
  onOpenMemory,
  onOpenStickers,
  onOpenWallet,
}: {
  onOpenProfile: () => void
  onOpenSettings: () => void
  onOpenMoments: () => void
  onOpenMemory: () => void
  onOpenStickers: () => void
  onOpenWallet: () => void
}) {
  const profile = loadProfile()
  const avatar = profile.avatar || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#c7c7cc"/><text x="60" y="64" font-size="54" fill="#fff" text-anchor="middle" dominant-baseline="central" font-family="sans-serif">我</text></svg>')
  return (
    <div className="page">
      <NavBar large title="我" />
      <div className="page-body">
        <button className="me-hero" onClick={onOpenProfile}>
          <img className="me-hero-avatar" src={avatar} alt="头像" />
          <div className="me-hero-main">
            <div className="me-hero-name">{profile.name}</div>
            <div className="me-hero-sub">微信号：{profile.wechatId || 'ios_demo'}</div>
            {profile.region && <div className="me-hero-sub">地区：{profile.region}</div>}
            {profile.bio && <div className="me-hero-bio">人设：{profile.bio}</div>}
          </div>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="me-hero-qr">
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="#c7c7cc" strokeWidth="1.7" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="#c7c7cc" strokeWidth="1.7" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="#c7c7cc" strokeWidth="1.7" />
            <rect x="14" y="14" width="2.6" height="2.6" fill="#c7c7cc" />
            <rect x="18" y="18" width="2.6" height="2.6" fill="#c7c7cc" />
          </svg>
          <Chevron />
        </button>

        <div className="list-group">
          {ROWS.map((r) => (
            <button
              key={r.label}
              className="row"
              onClick={() => {
                if (r.label === '服务') onOpenWallet()
                else if (r.label === '朋友圈') onOpenMoments()
                else if (r.label === '记忆匣子') onOpenMemory()
                else if (r.label === '表情') onOpenStickers()
              }}
            >
              <div className="row-icon row-icon-line" style={{ background: `${r.bg}1c` }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <path d={r.d} stroke={r.bg} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="row-main">
                <span className="row-title">{r.label}</span>
              </div>
              <Chevron />
            </button>
          ))}
        </div>

        <div className="list-group">
          <button className="row" onClick={onOpenSettings}>
            <div className="row-icon row-icon-line" style={{ background: '#8e8e931c' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8" stroke="#8e8e93" strokeWidth="1.9" />
                <path d="M12 8v.5M12 11v5" stroke="#8e8e93" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </div>
            <div className="row-main">
              <span className="row-title">设置</span>
            </div>
            <Chevron />
          </button>
        </div>
      </div>
    </div>
  )
}
