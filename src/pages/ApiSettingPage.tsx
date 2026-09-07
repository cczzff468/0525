import { useEffect, useRef, useState } from 'react'
import { NavBar } from '../components/common'
import { BackIcon } from '../components/icons'
import { loadApiSetting, saveApiSetting, uid } from '../store'
import type { ApiPreset, ApiSetting } from '../types'
import { chatUrl, modelsUrl, readServerError } from '../utils/ai'

const BUILT_IN_PRESETS: ApiPreset[] = [
  { id: 'builtin-openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  {
    id: 'builtin-azure',
    name: 'Azure',
    baseUrl: 'https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2024-02-01',
    model: 'gpt-4o',
  },
  { id: 'builtin-ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1/chat/completions', model: 'llama3' },
]

export default function ApiSettingPage({ onBack }: { onBack: () => void }) {
  const [cfg, setCfg] = useState<ApiSetting>(loadApiSetting)
  const [showKey, setShowKey] = useState(false)
  const [modelQuery, setModelQuery] = useState('')
  const [modelOpen, setModelOpen] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [activePresetId, setActivePresetId] = useState('')
  const modelBoxRef = useRef<HTMLDivElement>(null)

  const update = (patch: Partial<ApiSetting>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch }
      saveApiSetting(next)
      return next
    })
  }

  const updateManual = (patch: Partial<ApiSetting>) => {
    update(patch)
    setActivePresetId('')
  }

  useEffect(() => {
    if (!modelOpen) return
    const close = (e: MouseEvent) => {
      if (modelBoxRef.current && !modelBoxRef.current.contains(e.target as Node)) setModelOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [modelOpen])

  const fetchModels = async () => {
    setFetching(true)
    setFetchMsg('')
    try {
      const res = await fetch(modelsUrl(cfg.baseUrl), {
        headers: cfg.apiKey.trim() ? { Authorization: `Bearer ${cfg.apiKey.trim()}` } : undefined,
      })
      if (!res.ok) {
        const server = await readServerError(res)
        setFetchMsg(server ? `拉取失败（HTTP ${res.status}）：${server}` : `拉取失败（HTTP ${res.status}）`)
        return
      }
      const data = await res.json()
      const raw = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : []
      const list = raw.map((m: { id?: string; name?: string }) => m.id ?? m.name).filter((x: unknown): x is string => typeof x === 'string')
      if (list.length === 0) {
        setFetchMsg('接口返回的模型列表为空')
        return
      }
      update({ models: list })
      setFetchMsg(`已拉取 ${list.length} 个模型`)
    } catch {
      setFetchMsg('无法连接到 API 地址，请检查网络或地址')
    } finally {
      setFetching(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(chatUrl(cfg.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.apiKey.trim() ? { Authorization: `Bearer ${cfg.apiKey.trim()}` } : {}),
        },
        body: JSON.stringify({
          model: cfg.model.trim(),
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
          temperature: 0,
        }),
      })
      if (res.ok) {
        setTestResult({ ok: true, msg: '连接成功，配置可用' })
      } else if (res.status === 401 || res.status === 403) {
        const server = await readServerError(res)
        setTestResult({ ok: false, msg: `API Key 无效或没有权限${server ? `：${server}` : ''}` })
      } else if (res.status === 404) {
        const server = await readServerError(res)
        const modelMiss = /model/i.test(server)
        setTestResult({
          ok: false,
          msg: modelMiss
            ? `模型「${cfg.model}」不存在：${server || '请检查模型名拼写，或点击“拉取模型”从列表中选择'}`
            : `地址不存在：${server || '服务端没有这个接口'}。地址填到 /v1 即可，发送时自动补全 /chat/completions`,
        })
      } else {
        const server = await readServerError(res)
        setTestResult({ ok: false, msg: `请求失败（HTTP ${res.status}）${server ? `：${server}` : ''}` })
      }
    } catch {
      setTestResult({ ok: false, msg: '无法连接（网络不通或浏览器跨域限制）' })
    } finally {
      setTesting(false)
    }
  }

  const applyPreset = (p: ApiPreset) => {
    update({ baseUrl: p.baseUrl, model: p.model, ...(p.apiKey !== undefined ? { apiKey: p.apiKey } : {}) })
    setActivePresetId(p.id)
    setTestResult({ ok: true, msg: `已应用预设「${p.name}」` })
    setFetchMsg('')
  }

  const saveAsPreset = () => {
    const name = newPresetName.trim()
    if (!name) return
    const preset: ApiPreset = { id: uid(), name, baseUrl: cfg.baseUrl, model: cfg.model, apiKey: cfg.apiKey }
    update({ presets: [...cfg.presets, preset] })
    setActivePresetId(preset.id)
    setTestResult({ ok: true, msg: `已保存并应用预设「${name}」` })
    setNewPresetName('')
    setCreating(false)
  }

  const removePreset = (id: string) => {
    update({ presets: cfg.presets.filter((p) => p.id !== id) })
    if (activePresetId === id) setActivePresetId('')
  }

  const presetSummary = (p: ApiPreset): string => {
    let host = p.baseUrl
    try {
      host = new URL(p.baseUrl).host
    } catch {
      /* keep raw */
    }
    return `${p.model} · ${host}`
  }

  const allPresets: ApiPreset[] = [...BUILT_IN_PRESETS, ...cfg.presets]

  const filteredModels = cfg.models.filter((m) => m.toLowerCase().includes(modelQuery.trim().toLowerCase()))

  return (
    <div className="page">
      <NavBar
        title="API设置"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body api-page">
        <div className="api-intro">填一个地址和 Key，AI 好友就能用真实大模型回复你。所有配置自动保存，永久生效。</div>

        <div className="list-group api-presets">
          <div className="api-presets-label">预设方案（内置 {BUILT_IN_PRESETS.length} 个 + 自定义 {cfg.presets.length} 个）</div>
          {allPresets.map((p) => {
            const isActive = activePresetId === p.id
            const isBuiltIn = p.id.startsWith('builtin-')
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
                  <span className="api-preset-summary">{presetSummary(p)}</span>
                </div>
                {!isBuiltIn && (
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
                )}
              </div>
            )
          })}
          {creating ? (
            <div className="api-new-preset">
              <input
                className="api-input"
                type="text"
                placeholder="预设名字，如：公司中转站"
                maxLength={16}
                autoFocus
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveAsPreset()
                }}
              />
              <button className="api-new-preset-save" onClick={saveAsPreset} disabled={!newPresetName.trim()}>
                保存
              </button>
              <button
                className="api-new-preset-cancel"
                onClick={() => {
                  setCreating(false)
                  setNewPresetName('')
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
            <label className="form-label" htmlFor="api-url">API地址</label>
            <input
              id="api-url"
              className="api-input"
              type="url"
              placeholder="https://api.openai.com/v1 或完整地址"
              value={cfg.baseUrl}
              onChange={(e) => updateManual({ baseUrl: e.target.value })}
            />
          </div>
          <div className="form-row form-row-col">
            <label className="form-label" htmlFor="api-key">API Key</label>
            <div className="api-key-wrap">
              <input
                id="api-key"
                className="api-input"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-...（Ollama 等本地服务可留空）"
                autoComplete="off"
                value={cfg.apiKey}
                onChange={(e) => updateManual({ apiKey: e.target.value })}
              />
              <button className="api-key-toggle" onClick={() => setShowKey((s) => !s)}>
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
          </div>
          <div className="form-row form-row-col">
            <div className="api-model-head">
              <label className="form-label" htmlFor="api-model">模型</label>
              <button className="api-fetch-btn" onClick={fetchModels} disabled={fetching}>
                {fetching ? '拉取中…' : '拉取模型'}
              </button>
            </div>
            <div className="api-model-box" ref={modelBoxRef}>
              <input
                id="api-model"
                className="api-input"
                type="text"
                placeholder="手动输入或从列表选择"
                value={cfg.model}
                onChange={(e) => updateManual({ model: e.target.value })}
                onFocus={() => setModelOpen(true)}
              />
              {modelOpen && cfg.models.length > 0 && (
                <div className="api-model-dropdown">
                  {cfg.models.length > 8 && (
                    <input
                      className="api-model-search"
                      type="text"
                      placeholder="搜索模型，如 32k、turbo"
                      value={modelQuery}
                      onChange={(e) => setModelQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <div className="api-model-list">
                    {filteredModels.map((m) => (
                      <button
                        key={m}
                        className={`api-model-item ${m === cfg.model ? 'current' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          update({ model: m })
                          setModelOpen(false)
                          setModelQuery('')
                        }}
                      >
                        {m}
                      </button>
                    ))}
                    {filteredModels.length === 0 && <div className="api-model-empty">没有匹配的模型</div>}
                  </div>
                </div>
              )}
            </div>
            {fetchMsg && <div className={`api-hint ${fetchMsg.startsWith('已拉取') ? 'ok' : 'err'}`}>{fetchMsg}</div>}
          </div>
          <div className="form-row form-row-col">
            <div className="api-model-head">
              <label className="form-label" htmlFor="api-temp">温度</label>
              <span className="api-slider-value">{cfg.temperature.toFixed(1)}</span>
            </div>
            <input
              id="api-temp"
              className="api-slider"
              style={{ '--fill': `${(cfg.temperature / 2) * 100}%` } as React.CSSProperties}
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={cfg.temperature}
              onChange={(e) => update({ temperature: Number(e.target.value) })}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="api-tokens">最大 Token</label>
            <input
              id="api-tokens"
              className="form-input form-input-age"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={cfg.maxTokens}
              onChange={(e) => update({ maxTokens: Math.min(128000, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)) })}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="api-timeout">超时时间(秒)</label>
            <input
              id="api-timeout"
              className="form-input form-input-age"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              value={cfg.timeout}
              onChange={(e) => update({ timeout: Math.min(300, Math.max(5, Number(e.target.value.replace(/\D/g, '')) || 5)) })}
            />
          </div>
        </div>

        <div className="section-label">AI 聊天规则</div>
        <div className="list-group">
          <div className="form-row form-row-col">
            <label className="form-label" htmlFor="g-prompt">全局提示词（可选，对所有 AI 好友生效）</label>
            <textarea
              id="g-prompt"
              className="form-textarea"
              placeholder={'所有好友聊天都要遵守的规则，如：\n· 回复像真人发微信，不要长篇大论\n· 可以用"哈哈""嗯嗯"这类口语\n· 不要每次都反问对方\n· 聊天里可以适当发表情包文字描述'}
              maxLength={800}
              rows={5}
              value={cfg.globalPrompt ?? ''}
              onChange={(e) => update({ globalPrompt: e.target.value })}
            />
            <span className="form-preview">自动保存。好友资料里还可以给单个好友设置专属规则，两者会同时生效，全局规则优先</span>
          </div>
        </div>

        <button className="primary-btn" onClick={testConnection} disabled={testing}>
          {testing ? '测试中…' : '测试连接'}
        </button>

        {testResult && (
          <div className={`api-test-result ${testResult.ok ? 'ok' : 'err'}`}>
            <span className="api-test-dot" />
            {testResult.msg}
          </div>
        )}

        <div className="api-footnote">配置更改实时自动保存到 IndexedDB，无需手动提交。</div>
      </div>
    </div>
  )
}
