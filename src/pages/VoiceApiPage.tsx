import { useEffect, useRef, useState } from 'react'
import { NavBar, Modal } from '../components/common'
import { loadApiSetting, saveApiSetting, uid } from '../store'
import { testTtsConnection } from '../utils/apiTest'
import type { ApiSetting, VoiceConfig } from '../types'

const PROVIDER_LIST = ['OpenAI', 'Minimax 国内版', 'Minimax 国际版', '本地免费 (Edge TTS)']

const PROVIDER_MODELS: Record<string, string[]> = {
  OpenAI: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'],
  'Minimax 国内版': ['speech-2.8-turbo', 'speech-2.8', 'speech-01-turbo', 'speech-01-hd'],
  'Minimax 国际版': ['speech-2.8-turbo', 'speech-2.8'],
  '本地免费 (Edge TTS)': [],
}

interface VoiceOption {
  label: string
  id: string
}

const PROVIDER_VOICES: Record<string, VoiceOption[]> = {
  OpenAI: [
    { label: 'nova', id: 'nova' },
    { label: 'alloy', id: 'alloy' },
    { label: 'echo', id: 'echo' },
    { label: 'fable', id: 'fable' },
    { label: 'onyx', id: 'onyx' },
    { label: 'shimmer', id: 'shimmer' },
  ],
  'Minimax 国内版': [
    { label: '青涩青年音 (male-qn-qingse)', id: 'male-qn-qingse' },
    { label: '精炼男声 (male-qn-jingying)', id: 'male-qn-jingying' },
    { label: '磁性男声 (male-qn-badao)', id: 'male-qn-badao' },
    { label: '清爽少女 (female-shaonv)', id: 'female-shaonv' },
    { label: '萌萌女声 (female-xiaomeng)', id: 'female-xiaomeng' },
    { label: '清纯女声 (female-qingxin)', id: 'female-qingxin' },
  ],
  'Minimax 国际版': [
    { label: 'English_Boy', id: 'English_Boy' },
    { label: 'English_Girl', id: 'English_Girl' },
    { label: 'CalmWoman', id: 'CalmWoman' },
    { label: 'Granny_Wen', id: 'Granny_Wen' },
  ],
  '本地免费 (Edge TTS)': [
    { label: '晓晓 Xiaoxiao (女)', id: 'Xiaoxiao' },
    { label: '晓伊 Xiaoyi (女)', id: 'Xiaoyi' },
    { label: '云希 Yunxi (男)', id: 'Yunxi' },
    { label: '云扬 Yunyang (男)', id: 'Yunyang' },
  ],
}

const PROVIDER_URLS: Record<string, string> = {
  OpenAI: 'https://api.openai.com/v1/audio/speech',
  'Minimax 国内版': 'https://api.minimax.chat/v1/t2a_v2',
  'Minimax 国际版': 'https://api.minimaxi.chat/v1/t2a_v2',
  '本地免费 (Edge TTS)': '',
}

const SPEAK_LANGS = [
  { value: '', label: '不指定（保持默认）' },
  { value: 'zh-CN', label: '中文（普通话）' },
  { value: 'en-US', label: '英文' },
  { value: 'ja-JP', label: '日文' },
  { value: 'ko-KR', label: '韩文' },
]

const isLocalProvider = (p: string) => p.includes('本地') || p.includes('Edge')

const getSynthVoices = (): Promise<SpeechSynthesisVoice[]> => {
  const synth = window.speechSynthesis
  const first = synth.getVoices()
  if (first.length > 0) return Promise.resolve(first)
  return new Promise((resolve) => {
    const onChange = () => {
      const list = synth.getVoices()
      if (list.length > 0) {
        synth.removeEventListener('voiceschanged', onChange)
        resolve(list)
      }
    }
    synth.addEventListener('voiceschanged', onChange)
    window.setTimeout(() => {
      synth.removeEventListener('voiceschanged', onChange)
      resolve(synth.getVoices())
    }, 800)
  })
}

const pickSynthVoice = (voices: SpeechSynthesisVoice[], voiceId: string, lang: string) => {
  const key = voiceId.toLowerCase().trim()
  if (key) {
    const exact = voices.find((v) => v.name.toLowerCase() === key)
    if (exact) return exact
    const byName = voices.find((v) => v.name.toLowerCase().includes(key))
    if (byName) return byName
  }
  const want = (lang || 'zh').toLowerCase()
  return voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(want))
}

const blankConfig = (): VoiceConfig => ({
  id: uid(),
  name: '',
  enabled: true,
  provider: 'Minimax 国内版',
  baseUrl: PROVIDER_URLS['Minimax 国内版'],
  apiKey: '',
  model: 'speech-2.8-turbo',
  voice: 'male-qn-qingse',
  speed: 1,
  pitch: 0,
  speakLang: '',
})

export default function VoiceApiPage({ onBack }: { onBack: () => void }) {
  const [cfg, setCfg] = useState<ApiSetting>(loadApiSetting)
  const [editing, setEditing] = useState<VoiceConfig | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [customProvider, setCustomProvider] = useState(false)
  const [customModel, setCustomModel] = useState(false)
  const [customVoice, setCustomVoice] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [delTarget, setDelTarget] = useState<VoiceConfig | null>(null)
  const [hint, setHint] = useState('')
  const [sttTesting, setSttTesting] = useState(false)
  const [testingId, setTestingId] = useState('')
  const [editTesting, setEditTesting] = useState(false)
  const [localVoices, setLocalVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (window.speechSynthesis) {
      getSynthVoices().then(setLocalVoices)
    }
  }, [])

  const voicesFor = (provider: string): VoiceOption[] => {
    if (isLocalProvider(provider) && localVoices.length > 0) {
      return localVoices.map((v) => ({ label: `${v.name} (${v.lang})`, id: v.name }))
    }
    return PROVIDER_VOICES[provider] ?? []
  }
  const hintTimer = useRef<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const update = (patch: Partial<ApiSetting>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch }
      saveApiSetting(next)
      return next
    })
  }

  const updateVoice = (patch: Partial<ApiSetting['voice']>) => {
    update({ voice: { ...cfg.voice, ...patch } })
  }

  const showHint = (t: string) => {
    setHint(t)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(''), 1800)
  }

  const configs = cfg.voice.configs
  const selectedId = cfg.voice.selectedId

  const selectConfig = (c: VoiceConfig) => {
    updateVoice({
      selectedId: c.id,
      configs: c.enabled ? configs : configs.map((x) => (x.id === c.id ? { ...x, enabled: true } : x)),
    })
    showHint(`播报改用「${c.name}」`)
  }

  const toggleEnabled = (e: React.MouseEvent, c: VoiceConfig) => {
    e.stopPropagation()
    updateVoice({ configs: configs.map((x) => (x.id === c.id ? { ...x, enabled: !x.enabled } : x)) })
  }

  const removeConfig = () => {
    if (!delTarget) return
    const rest = configs.filter((c) => c.id !== delTarget.id)
    updateVoice({
      configs: rest,
      selectedId: selectedId === delTarget.id ? (rest[0]?.id ?? '') : selectedId,
    })
    setDelTarget(null)
    showHint(`已删除「${delTarget.name}」`)
  }

  const startAdd = () => {
    const c = blankConfig()
    setEditing(c)
    setIsNew(true)
    setCustomProvider(false)
    setCustomModel(false)
    setCustomVoice(false)
    setShowKey(false)
  }

  const startEdit = (c: VoiceConfig) => {
    setEditing({ ...c })
    setIsNew(false)
    setCustomProvider(!PROVIDER_LIST.includes(c.provider))
    setCustomModel(!isLocalProvider(c.provider) && !(PROVIDER_MODELS[c.provider] ?? []).includes(c.model))
    setCustomVoice(!voicesFor(c.provider).some((v) => v.id === c.voice))
    setShowKey(false)
  }

  const patchEditing = (patch: Partial<VoiceConfig>) => {
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const onProviderChange = (p: string) => {
    if (p === '__custom') {
      setCustomProvider(true)
      return
    }
    setCustomProvider(false)
    const models = PROVIDER_MODELS[p] ?? []
    const voices = voicesFor(p)
    patchEditing({
      provider: p,
      baseUrl: isLocalProvider(p) ? '' : PROVIDER_URLS[p] ?? '',
      model: models[0] ?? '',
      voice: voices[0]?.id ?? '',
    })
    setCustomModel(false)
    setCustomVoice(false)
  }

  const stopAudio = () => {
    audioRef.current?.pause()
    audioRef.current = null
    window.speechSynthesis?.cancel()
  }

  const playSample = async (c: VoiceConfig) => {
    const text = '你好，欢迎使用语音播报'
    if (isLocalProvider(c.provider) || !c.baseUrl) {
      try {
        stopAudio()
        const synth = window.speechSynthesis
        const u = new SpeechSynthesisUtterance(text)
        u.lang = c.speakLang || 'zh-CN'
        u.rate = Math.max(0.5, Math.min(2, c.speed))
        u.pitch = Math.max(0, Math.min(2, 1 + c.pitch / 12))
        const voices = await getSynthVoices()
        const hit = pickSynthVoice(voices, c.voice, c.speakLang)
        if (hit) u.voice = hit
        synth.speak(u)
        showHint(hit ? `正在用「${hit.name}」试听` : '正在用本机默认音色试听')
      } catch {
        showHint('本机语音合成不可用')
      }
      return
    }
    if (!c.apiKey) {
      showHint('请先填 API Key')
      return
    }
    stopAudio()
    showHint('正在生成试听音频…')
    const body: Record<string, unknown> = { model: c.model, input: text, voice: c.voice, speed: c.speed }
    if (c.speakLang) body.language = c.speakLang
    fetch(c.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.apiKey}` },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const blob = await res.blob()
        const audio = new Audio(URL.createObjectURL(blob))
        audioRef.current = audio
        audio.onended = () => {
          audioRef.current = null
          URL.revokeObjectURL(audio.src)
        }
        return audio.play()
      })
      .then(() => showHint(''))
      .catch(() => showHint('试听失败，检查地址、Key、模型和音色'))
  }

  useEffect(() => stopAudio, [])

  const testStt = async () => {
    if (sttTesting) return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      showHint('当前浏览器不支持语音识别，请用 Chrome 或 Edge')
      return
    }
    if (window.self !== window.top) {
      showHint('页面正嵌在框架里运行，请在浏览器中用新标签页直接打开本页再测试')
      return
    }
    setSttTesting(true)
    showHint('正在检查麦克风权限…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      setSttTesting(false)
      showHint('麦克风不可用：请在浏览器设置里允许本页使用麦克风')
      return
    }
    let got = false
    let done = false
    const finish = (msg: string) => {
      if (done) return
      done = true
      setSttTesting(false)
      showHint(msg)
    }
    const r = new SR()
    r.lang = cfg.voice.sttLang || 'zh-CN'
    r.interimResults = true
    r.onresult = () => {
      got = true
    }
    r.onerror = (e: any) => {
      if (e.error === 'no-speech') return
      const reason =
        e.error === 'aborted'
          ? '手机系统语音服务启动失败。手机浏览器的识别依赖系统语音服务（国内安卓设备常缺失或被限制），建议用电脑版 Chrome/Edge 测试；弹窗提示的悬浮窗冲突也可按提示关闭相关应用后重试'
          : e.error === 'audio-capture'
            ? '麦克风被其他应用占用，请关闭后重试'
            : e.error === 'network'
              ? '识别服务网络异常：浏览器语音识别需能访问其语音服务器，当前网络可能无法连通'
              : e.error === 'not-allowed' || e.error === 'service-not-allowed'
                ? '识别服务被拒绝：请在浏览器设置里允许麦克风'
                : `测试失败：${e.error ?? '未知错误'}`
      finish(reason)
    }
    r.onend = () => finish(got ? '测试通过：已识别到语音内容' : '识别服务正常，未检测到说话，测试通过')
    const timer = window.setTimeout(() => {
      try {
        r.stop()
      } catch {
        /* ignore */
      }
    }, 6000)
    r.addEventListener('end', () => window.clearTimeout(timer), { once: true })
    try {
      r.start()
      showHint('麦克风正常，正在测试识别，请说一句话（6 秒内）…')
    } catch {
      window.clearTimeout(timer)
      finish('无法启动识别，请稍后重试')
    }
  }

  const localTtsCheck = (): string | null => {
    const synth = window.speechSynthesis
    if (!synth) return '测试失败：本机语音合成不可用'
    const n = synth.getVoices().length
    return n > 0 ? `连接成功：本机语音可用，共 ${n} 个音色` : '本机语音引擎已就绪，音色列表加载中'
  }

  const runTtsTest = async (c: VoiceConfig): Promise<string> => {
    if (isLocalProvider(c.provider) || !c.baseUrl) return localTtsCheck() ?? ''
    if (!c.apiKey) return '请先填 API Key'
    const r = await testTtsConnection({
      baseUrl: c.baseUrl,
      apiKey: c.apiKey,
      model: c.model,
      voice: c.voice,
      speed: c.speed,
      language: c.speakLang || undefined,
    })
    return r.ok ? `连接成功：${r.detail}` : `连接失败：${r.detail}`
  }

  const testTts = async (c: VoiceConfig) => {
    if (testingId) return
    if (!(isLocalProvider(c.provider) || !c.baseUrl) && !c.apiKey) {
      showHint('请先在编辑里填 API Key')
      return
    }
    setTestingId(c.id)
    const msg = await runTtsTest(c)
    setTestingId('')
    showHint(msg)
  }

  const testEditing = async () => {
    if (!editing || editTesting) return
    if (!(isLocalProvider(editing.provider) || !editing.baseUrl) && !editing.apiKey) {
      showHint('请先填 API Key')
      return
    }
    setEditTesting(true)
    const msg = await runTtsTest(editing)
    setEditTesting(false)
    showHint(msg)
  }

  if (editing) {
    const local = isLocalProvider(editing.provider)
    return (
      <div className="page">
        <NavBar
          title={isNew ? '添加语音配置' : '编辑语音配置'}
          left={
            <button className="nav-btn" onClick={() => setEditing(null)} aria-label="关闭">
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path d="M5 5l10 10M15 5L5 15" stroke="#0a84ff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          }
        />
        <div className="page-body api-page voice-form">
          <div className="voice-field">
            <label className="voice-field-label" htmlFor="vf-name">配置名称</label>
            <input
              id="vf-name"
              className="voice-field-input"
              type="text"
              placeholder="如：Minimax 语音"
              maxLength={20}
              value={editing.name}
              onChange={(e) => patchEditing({ name: e.target.value })}
            />
          </div>

          {customProvider ? (
            <div className="voice-field">
              <label className="voice-field-label" htmlFor="vf-provider">
                服务商
                <button className="voice-field-link" onClick={() => setCustomProvider(false)}>选预设</button>
              </label>
              <input
                id="vf-provider"
                className="voice-field-input"
                type="text"
                placeholder="输入服务商名称"
                maxLength={20}
                value={editing.provider}
                onChange={(e) => patchEditing({ provider: e.target.value })}
              />
            </div>
          ) : (
            <div className="voice-field">
              <label className="voice-field-label" htmlFor="vf-provider">服务商</label>
              <div className="voice-select-wrap">
                <select
                  id="vf-provider"
                  className="voice-field-input voice-select"
                  value={editing.provider}
                  onChange={(e) => onProviderChange(e.target.value)}
                >
                  {PROVIDER_LIST.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="__custom">自定义…</option>
                </select>
              </div>
            </div>
          )}

          {local ? (
            <div className="voice-field">
              <span className="voice-field-tip">本地免费语音无需地址、Key 和模型，直接用系统自带引擎</span>
            </div>
          ) : (
            <>
              <div className="voice-field">
                <label className="voice-field-label" htmlFor="vf-url">API地址</label>
                <input
                  id="vf-url"
                  className="voice-field-input"
                  type="url"
                  placeholder="https://api.openai.com/v1/audio/speech"
                  value={editing.baseUrl}
                  onChange={(e) => patchEditing({ baseUrl: e.target.value })}
                />
              </div>
              <div className="voice-field">
                <label className="voice-field-label" htmlFor="vf-key">API Key</label>
                <div className="voice-key-row">
                  <input
                    id="vf-key"
                    className="voice-field-input"
                    type={showKey ? 'text' : 'password'}
                    placeholder="服务商提供的密钥"
                    value={editing.apiKey}
                    onChange={(e) => patchEditing({ apiKey: e.target.value })}
                  />
                  <button
                    className={`key-toggle ${showKey ? 'show' : ''}`}
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? '隐藏密钥' : '显示密钥'}
                  >
                    <span className="dot" />
                  </button>
                </div>
              </div>
              {customModel ? (
                <div className="voice-field">
                  <label className="voice-field-label" htmlFor="vf-model">
                    语音模型 (TTS Model)
                    <button className="voice-field-link" onClick={() => setCustomModel(false)}>选预设</button>
                  </label>
                  <input
                    id="vf-model"
                    className="voice-field-input"
                    type="text"
                    placeholder="直接输入模型 ID"
                    value={editing.model}
                    onChange={(e) => patchEditing({ model: e.target.value })}
                  />
                </div>
              ) : (
                <div className="voice-field">
                  <label className="voice-field-label" htmlFor="vf-model">语音模型 (TTS Model)</label>
                  <div className="voice-select-wrap">
                    <select
                      id="vf-model"
                      className="voice-field-input voice-select"
                      value={editing.model}
                      onChange={(e) => {
                        if (e.target.value === '__custom') setCustomModel(true)
                        else patchEditing({ model: e.target.value })
                      }}
                    >
                      {(PROVIDER_MODELS[editing.provider] ?? []).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      <option value="__custom">自定义…</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          {customVoice ? (
            <div className="voice-field">
              <label className="voice-field-label" htmlFor="vf-voice">
                音色 / 自定义 Voice ID
                <button className="voice-field-link" onClick={() => setCustomVoice(false)}>选预设</button>
              </label>
              <input
                id="vf-voice"
                className="voice-field-input"
                type="text"
                placeholder="如 male-qn-qingse"
                value={editing.voice}
                onChange={(e) => patchEditing({ voice: e.target.value })}
              />
            </div>
          ) : (
            <div className="voice-field">
              <label className="voice-field-label" htmlFor="vf-voice">默认音色 或 自定义 Voice ID</label>
              <div className="voice-select-wrap">
                <select
                  id="vf-voice"
                  className="voice-field-input voice-select"
                  value={editing.voice}
                  onChange={(e) => {
                    if (e.target.value === '__custom') setCustomVoice(true)
                    else patchEditing({ voice: e.target.value })
                  }}
                >
                  {(voicesFor(editing.provider) ?? []).map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                  <option value="__custom">自定义 Voice ID…</option>
                </select>
              </div>
            </div>
          )}

          <div className="voice-field-row2">
            <div className="voice-field">
              <span className="voice-field-label">语速：{editing.speed.toFixed(1)}x</span>
              <div className="voice-slider-line">
                <span className="voice-slider-edge">0.5x</span>
                <input
                  className="api-slider voice-slider"
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={editing.speed}
                  aria-label="语速"
                  onChange={(e) => patchEditing({ speed: Number(e.target.value) })}
                />
                <span className="voice-slider-edge">2.0x</span>
              </div>
            </div>
            <div className="voice-field">
              <span className="voice-field-label">音调：{editing.pitch}</span>
              <div className="voice-slider-line">
                <span className="voice-slider-edge">-12</span>
                <input
                  className="api-slider voice-slider"
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={editing.pitch}
                  aria-label="音调"
                  onChange={(e) => patchEditing({ pitch: Number(e.target.value) })}
                />
                <span className="voice-slider-edge">12</span>
              </div>
            </div>
          </div>

          <div className="voice-field">
            <label className="voice-field-label" htmlFor="vf-lang">朗读语言</label>
            <div className="voice-select-wrap">
              <select
                id="vf-lang"
                className="voice-field-input voice-select"
                value={editing.speakLang}
                onChange={(e) => patchEditing({ speakLang: e.target.value })}
              >
                {SPEAK_LANGS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="voice-preview-row">
            <button className="mini-btn" onClick={() => playSample(editing)}>试听</button>
            <button className="mini-btn" disabled={editTesting} onClick={testEditing}>
              {editTesting ? '测试中…' : '测试连接'}
            </button>
            <span className="voice-preview-text">“你好，欢迎使用语音播报”</span>
          </div>

          <div className="voice-form-actions">
            <button className="voice-btn ghost" onClick={() => setEditing(null)}>取消</button>
            <button
              className="voice-btn primary"
              onClick={() => {
                const name = editing.name.trim()
                if (!name) {
                  showHint('请先给这个语音起个名字')
                  return
                }
                const saved = { ...editing, name }
                updateVoice({ configs: isNew ? [...configs, saved] : configs.map((c) => (c.id === saved.id ? saved : c)) })
                setEditing(null)
                showHint(isNew ? '语音已添加' : '语音已保存')
              }}
            >
              保存
            </button>
          </div>

          {hint && <div className="chat-toast">{hint}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <NavBar
        title="语音配置"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M15 5l-7 7 7 7" stroke="#0a84ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
        }
      />
      <div className="page-body api-page">
        <div className="section-label">语音输入</div>
        <div className="list-group">
          <div className="form-row">
            <span className="form-label">语音输入（说话转文字）</span>
            <button
              className={`ios-switch ${cfg.voice.sttEnabled ? 'on' : ''}`}
              onClick={() => updateVoice({ sttEnabled: !cfg.voice.sttEnabled })}
              role="switch"
              aria-checked={cfg.voice.sttEnabled}
              aria-label="启用语音输入"
            >
              <span className="ios-switch-knob" />
            </button>
          </div>
          <div className="form-row">
            <span className="form-label">识别语言</span>
            <div className="seg-group">
              {[
                { key: 'zh-CN', label: '中文（普通话）' },
                { key: 'en-US', label: '英文' },
              ].map((it) => (
                <button
                  key={it.key}
                  className={`seg-item ${(cfg.voice.sttLang || 'zh-CN') === it.key ? 'active' : ''}`}
                  onClick={() => updateVoice({ sttLang: it.key })}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <span className="form-preview">用浏览器内置识别，免费无需配置，识别结果实时显示</span>
          </div>
          <div className="form-row">
            <button
              className={`mini-btn ${sttTesting ? 'testing' : ''}`}
              disabled={sttTesting}
              onClick={testStt}
            >
              {sttTesting ? '测试中…' : '测试连接'}
            </button>
          </div>
        </div>

        <div className="section-label">语音播报 · 点卡片选用</div>
        <button className="row voice-add-btn" onClick={startAdd}>
          <span className="row-title">+ 添加语音</span>
        </button>

        <div className="voice-card-list">
          {configs.map((c) => {
            const inUse = selectedId === c.id
            const voiceLabel = voicesFor(c.provider).find((v) => v.id === c.voice)?.label ?? c.voice
            return (
              <div
                key={c.id}
                className={`voice-card ${inUse ? 'selected' : ''} ${c.enabled ? '' : 'disabled'}`}
                role="button"
                tabIndex={0}
                onClick={() => selectConfig(c)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') selectConfig(c)
                }}
              >
                {inUse && (
                  <span className="voice-use-badge">
                    <span className="dot" />
                    使用中
                  </span>
                )}
                <div className="voice-card-head">
                  <span className="voice-card-name">{c.name}</span>
                  <button
                    className={`voice-enabled ${c.enabled ? 'on' : ''}`}
                    onClick={(e) => toggleEnabled(e, c)}
                    aria-label={c.enabled ? `停用 ${c.name}` : `启用 ${c.name}`}
                  >
                    <span className="dot" />
                    启用
                  </button>
                </div>
                <div className="voice-card-row">服务商：{c.provider}</div>
                {c.model && <div className="voice-card-row">模型：{c.model}</div>}
                <div className="voice-card-row">
                  <span>音色：{voiceLabel}</span>
                  <button
                    className="mini-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      playSample(c)
                    }}
                  >
                    试听
                  </button>
                </div>
                <div className="voice-card-row">
                  语速：{c.speed.toFixed(1)}x　音调：{c.pitch}
                  {c.speakLang ? `　语言：${SPEAK_LANGS.find((l) => l.value === c.speakLang)?.label ?? c.speakLang}` : ''}
                </div>
                <div className="voice-card-actions">
                  <button
                    className="mini-btn"
                    disabled={!!testingId}
                    onClick={(e) => {
                      e.stopPropagation()
                      testTts(c)
                    }}
                  >
                    {testingId === c.id ? '测试中…' : '测试连接'}
                  </button>
                  <button
                    className="mini-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      startEdit(c)
                    }}
                  >
                    编辑
                  </button>
                  <button
                    className="mini-btn danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDelTarget(c)
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            )
          })}
          {configs.length === 0 && (
            <div className="form-row">
              <span className="form-preview">还没有语音配置，点上方「+ 添加语音」创建</span>
            </div>
          )}
        </div>

        <Modal
          open={!!delTarget}
          title={`删除「${delTarget?.name ?? ''}」？`}
          buttons={[
            { label: '取消', onClick: () => setDelTarget(null) },
            { label: '删除', primary: true, onClick: removeConfig },
          ]}
        >
          <div className="modal-tip">删除后不可恢复。</div>
        </Modal>

        {hint && <div className="chat-toast">{hint}</div>}
      </div>
    </div>
  )
}
