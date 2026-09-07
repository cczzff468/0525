import { useState } from 'react'
import { NavBar } from '../components/common'
import { BackIcon } from '../components/icons'
import { loadApiSetting, saveApiSetting, uid } from '../store'
import { testChatConnection } from '../utils/apiTest'
import type { ApiSetting, VisionPreset } from '../types'

const VISION_SERVICES: VisionPreset[] = [
  { id: 'svc-openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
  { id: 'svc-anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-3-sonnet' },
  { id: 'svc-zhipu', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4v' },
  { id: 'svc-qwen', name: '阿里通义', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-vl-plus' },
]

const SERVICE_SUMMARY: Record<string, string> = {
  'svc-openai': 'gpt-4o / gpt-4-turbo / gpt-4o-mini',
  'svc-anthropic': 'claude-3 系列',
  'svc-zhipu': 'glm-4v 多模态',
  'svc-qwen': 'qwen-vl 系列',
}

export default function VisionApiPage({ onBack }: { onBack: () => void }) {
  const [cfg, setCfg] = useState<ApiSetting>(loadApiSetting)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [hint, setHint] = useState('')
  const [testing, setTesting] = useState(false)

  const update = (patch: Partial<ApiSetting>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch }
      saveApiSetting(next)
      return next
    })
  }

  const updateVision = (patch: Partial<ApiSetting['vision']>) => {
    update({ vision: { ...cfg.vision, ...patch } })
  }

  const updateManual = (patch: Partial<ApiSetting['vision']>) => {
    update({ vision: { ...cfg.vision, ...patch, activePresetId: '' } })
  }

  const applyService = (svc: VisionPreset) => {
    update({
      vision: {
        ...cfg.vision,
        baseUrl: svc.baseUrl,
        model: svc.model,
        activePresetId: svc.id,
      },
    })
    showHint(`已应用服务商「${svc.name}」`)
  }

  const applyPreset = (p: VisionPreset) => {
    update({
      vision: {
        ...cfg.vision,
        baseUrl: p.baseUrl,
        model: p.model,
        apiKey: p.apiKey ?? cfg.vision.apiKey,
        activePresetId: p.id,
      },
    })
    showHint(`已应用预设「${p.name}」`)
  }

  const saveAsPreset = () => {
    const name = newName.trim()
    if (!name) return
    const preset: VisionPreset = {
      id: uid(),
      name,
      baseUrl: cfg.vision.baseUrl,
      model: cfg.vision.model,
      apiKey: cfg.vision.apiKey,
    }
    updateVision({ presets: [...cfg.vision.presets, preset], activePresetId: preset.id })
    setNewName('')
    setCreating(false)
    showHint('预设已保存并应用')
  }

  const removePreset = (id: string) => {
    updateVision({ presets: cfg.vision.presets.filter((p) => p.id !== id), activePresetId: cfg.vision.activePresetId === id ? '' : cfg.vision.activePresetId })
    showHint('预设已删除')
  }

  const showHint = (t: string) => {
    setHint(t)
    window.setTimeout(() => setHint(''), 1600)
  }

  const activeId = cfg.vision.activePresetId ?? ''

  return (
    <div className="page">
      <NavBar
        title="识图模型"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body api-page">
        <div className="api-intro">专门处理图片理解，用户发图片给 AI 时调用。与聊天 API 相互独立，地址、Key、模型都可以不同。所有配置自动保存。</div>

        <div className="list-group">
          <div className="form-row">
            <span className="form-label">启用识图功能</span>
            <button
              className={`ios-switch ${cfg.vision.enabled ? 'on' : ''}`}
              onClick={() => updateVision({ enabled: !cfg.vision.enabled })}
              role="switch"
              aria-checked={cfg.vision.enabled}
              aria-label="启用识图功能"
            >
              <span className="ios-switch-knob" />
            </button>
          </div>
          <div className="form-row">
            <span className="form-label form-hint">关闭后发图片只存图，不让 AI 识别</span>
          </div>
        </div>

        <div className="section-label">服务商</div>
        <div className="list-group api-presets">
          {VISION_SERVICES.map((svc) => {
            const isActive = activeId === svc.id
            return (
              <div
                key={svc.id}
                className={`api-preset-item ${isActive ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => applyService(svc)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') applyService(svc)
                }}
              >
                <span className="api-preset-dot" />
                <div className="api-preset-main">
                  <span className="api-preset-name">
                    {svc.name}
                    {isActive && <span className="persona-badge">使用中</span>}
                  </span>
                  <span className="api-preset-summary">{SERVICE_SUMMARY[svc.id]}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="section-label">我的预设</div>
        <div className="list-group api-presets">
          {cfg.vision.presets.map((p) => {
            const isActive = activeId === p.id
            return (
              <div
                key={p.id}
                className={`api-preset-item ${isActive ? 'active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => applyPreset(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') applyPreset(p)
                }}
              >
                <span className="api-preset-dot" />
                <div className="api-preset-main">
                  <span className="api-preset-name">
                    {p.name}
                    {isActive && <span className="persona-badge">使用中</span>}
                  </span>
                  <span className="api-preset-summary">{p.model}</span>
                </div>
                <button
                  className="api-preset-del"
                  aria-label={`删除预设 ${p.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    removePreset(p.id)
                  }}
                >
                  删除
                </button>
              </div>
            )
          })}
          {creating ? (
            <div className="api-new-preset">
              <input
                className="api-input"
                type="text"
                placeholder="预设名字，如：Claude 识图"
                maxLength={16}
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveAsPreset()
                }}
              />
              <button className="api-new-preset-save" onClick={saveAsPreset} disabled={!newName.trim()}>
                保存
              </button>
              <button
                className="api-new-preset-cancel"
                onClick={() => {
                  setCreating(false)
                  setNewName('')
                }}
              >
                取消
              </button>
            </div>
          ) : (
            <button className="row api-save-preset" onClick={() => setCreating(true)}>
              <span className="row-title">+ 把当前配置保存为新预设（起个名字，数量不限）</span>
            </button>
          )}
        </div>

        <div className="list-group">
          <div className="form-row form-row-col">
            <label className="form-label" htmlFor="vision-url">识图 API 地址</label>
            <input
              id="vision-url"
              className="api-input"
              type="url"
              placeholder="https://api.openai.com/v1/chat/completions"
              value={cfg.vision.baseUrl}
              onChange={(e) => updateManual({ baseUrl: e.target.value })}
            />
          </div>
          <div className="form-row form-row-col">
            <label className="form-label" htmlFor="vision-key">识图 API Key</label>
            <input
              id="vision-key"
              className="api-input"
              type="password"
              placeholder="独立于聊天 Key，选填"
              value={cfg.vision.apiKey}
              onChange={(e) => updateManual({ apiKey: e.target.value })}
            />
          </div>
          <div className="form-row form-row-col">
            <label className="form-label" htmlFor="vision-model">识图模型</label>
            <input
              id="vision-model"
              className="api-input"
              type="text"
              list="vision-model-list"
              placeholder="gpt-4o"
              value={cfg.vision.model}
              onChange={(e) => updateManual({ model: e.target.value })}
            />
            <datalist id="vision-model-list">
              <option value="gpt-4o" />
              <option value="gpt-4-turbo" />
              <option value="gpt-4o-mini" />
              <option value="claude-3-opus" />
              <option value="claude-3-sonnet" />
              <option value="claude-3-haiku" />
              <option value="glm-4v" />
              <option value="qwen-vl-plus" />
            </datalist>
          </div>
        </div>

        <button
          className="primary-btn"
          disabled={testing}
          onClick={async () => {
            setTesting(true)
            const r = await testChatConnection({ baseUrl: cfg.vision.baseUrl, apiKey: cfg.vision.apiKey, model: cfg.vision.model, vision: true })
            setTesting(false)
            showHint(r.ok ? `连接成功：${r.detail}` : `连接失败：${r.detail}`)
          }}
        >
          {testing ? '测试中…' : '测试连接'}
        </button>

        {hint && <div className="chat-toast">{hint}</div>}
      </div>
    </div>
  )
}
