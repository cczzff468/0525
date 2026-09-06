import { NavBar, Chevron } from '../components/common'
import { BackIcon } from '../components/icons'
import { loadApiSetting } from '../store'

export default function Settings({
  onBack,
  onOpenApi,
}: {
  onBack: () => void
  onOpenApi: () => void
}) {
  const cfg = loadApiSetting()
  return (
    <div className="page">
      <NavBar
        title="设置"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="list-group">
          <button className="row" onClick={onOpenApi}>
            <div className="row-icon" style={{ background: '#34c759' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="4.5" y="7" width="15" height="11" rx="3" stroke="#fff" strokeWidth="1.8" />
                <circle cx="9.5" cy="12.5" r="1.3" fill="#fff" />
                <circle cx="14.5" cy="12.5" r="1.3" fill="#fff" />
                <path d="M12 7V4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="3.6" r="1.1" fill="#fff" />
              </svg>
            </div>
            <div className="row-main">
              <span className="row-title">API设置</span>
              <span className="row-preview">{cfg.apiKey ? `模型：${cfg.model}` : '未配置 Key，聊天将使用本地模拟回复'}</span>
            </div>
            <Chevron />
          </button>
        </div>

        <div className="list-group">
          {['账号与安全', '消息通知', '隐私', '通用'].map((label) => (
            <button key={label} className="row" onClick={() => {}}>
              <div className="row-main">
                <span className="row-title">{label}</span>
              </div>
              <Chevron />
            </button>
          ))}
        </div>

        <div className="list-group">
          {['帮助与反馈', '关于'].map((label) => (
            <button key={label} className="row" onClick={() => {}}>
              <div className="row-main">
                <span className="row-title">{label}</span>
              </div>
              <Chevron />
            </button>
          ))}
        </div>

        <div className="list-group">
          <button className="row" onClick={() => {}}>
            <div className="row-main">
              <span className="row-title settings-danger">切换账号</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
