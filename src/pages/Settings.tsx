import { NavBar, Chevron } from '../components/common'
import { BackIcon } from '../components/icons'
import { loadApiSetting } from '../store'

export default function Settings({
  onBack,
  onOpenApi,
  onOpenVision,
  onOpenVoice,
}: {
  onBack: () => void
  onOpenApi: () => void
  onOpenVision: () => void
  onOpenVoice: () => void
}) {
  const cfg = loadApiSetting()
  const selectedVoice = cfg.voice.configs.find((c) => c.id === cfg.voice.selectedId) ?? cfg.voice.configs.find((c) => c.enabled)
  const voiceSubtitle = [
    cfg.voice.sttEnabled ? '语音输入已开启' : '',
    selectedVoice && selectedVoice.enabled ? `播报：${selectedVoice.name}` : '',
  ]
    .filter(Boolean)
    .join('，') || '语音输入与播报均未开启'
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
              <span className="row-preview">{cfg.apiKey ? `模型：${cfg.model}` : '没有配置'}</span>
            </div>
            <Chevron />
          </button>
          <button className="row" onClick={onOpenVision}>
            <div className="row-icon" style={{ background: '#5856d6' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3.5" y="6" width="17" height="12" rx="3" stroke="#fff" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="1.8" />
                <circle cx="17.4" cy="9" r="1" fill="#fff" />
              </svg>
            </div>
            <div className="row-main">
              <span className="row-title">识图模型</span>
              <span className="row-preview">{cfg.vision.enabled ? `已启用 · ${cfg.vision.model}` : '未启用，发图片不让 AI 识别'}</span>
            </div>
            <Chevron />
          </button>
          <button className="row" onClick={onOpenVoice}>
            <div className="row-icon" style={{ background: '#ff9500' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="3.5" width="6" height="11" rx="3" stroke="#fff" strokeWidth="1.8" />
                <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div className="row-main">
              <span className="row-title">语音配置</span>
              <span className="row-preview">{voiceSubtitle}</span>
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
