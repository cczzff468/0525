import { useRef, useState } from 'react'
import { NavBar } from '../components/common'
import { BackIcon } from '../components/icons'
import { loadChatBgs, saveChatBg } from '../store'
import { fileToPhoto } from '../utils/image'
import type { ChatBg } from '../types'

const BUILTIN_COLORS = [
  '#ececec',
  '#f7f2e7',
  '#e8f1fb',
  '#e5f2e5',
  '#fdeee9',
  '#fdf6d8',
  '#e2f4f6',
  '#2c3a4b',
  '#1a1d24',
  '#3d5a80',
  '#4a6d5c',
  '#8c5a3c',
]

export default function ChatBackground({
  friendId,
  friendName,
  onBack,
}: {
  friendId: string
  friendName: string
  onBack: () => void
}) {
  const [tick, setTick] = useState(0)
  void tick
  const [hint, setHint] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const bg = loadChatBgs()[friendId]

  const showHint = (t: string) => {
    setHint(t)
    window.setTimeout(() => setHint(''), 1600)
  }

  const refresh = () => setTick((t) => t + 1)

  const previewStyle = bg
    ? bg.type === 'image'
      ? { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: bg.value }
    : { background: '#ededed' }

  const pickColor = (c: string) => {
    saveChatBg(friendId, { type: 'color', value: c })
    refresh()
    showHint('已设置聊天背景')
  }

  const reset = () => {
    saveChatBg(friendId, null)
    refresh()
    showHint('已恢复默认背景')
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showHint('请选择图片文件')
      return
    }
    try {
      const dataUrl = await fileToPhoto(file)
      const bgData: ChatBg = { type: 'image', value: dataUrl }
      saveChatBg(friendId, bgData)
      refresh()
      showHint('背景已上传并保存')
    } catch {
      showHint('图片处理失败，换一张试试')
    }
  }

  return (
    <div className="page">
      <NavBar
        title="聊天背景"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body chatbg-page">
        <div className="section-label">背景预览</div>
        <div className="chatbg-preview" style={previewStyle}>
          <div className="chatbg-preview-row">
            <span className="chatbg-bubble them">你好呀，最近怎么样？</span>
          </div>
          <div className="chatbg-preview-row me">
            <span className="chatbg-bubble me">挺好的，刚看完{friendName}推荐的那本书</span>
          </div>
        </div>

        <div className="list-group chatbg-upload">
          <button className="row" onClick={() => fileRef.current?.click()}>
            <div className="row-main">
              <span className="row-title">从手机上传</span>
              <span className="row-preview">选择相册或文件中的图片，上传后永久保存</span>
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />
          <button className="row" onClick={reset}>
            <div className="row-main">
              <span className="row-title">恢复默认背景</span>
            </div>
          </button>
        </div>

        <div className="section-label">纯色壁纸</div>
        <div className="chatbg-grid">
          {BUILTIN_COLORS.map((c) => (
            <button
              key={c}
              className={`chatbg-color ${bg?.type === 'color' && bg.value === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => pickColor(c)}
              aria-label={`背景色 ${c}`}
            >
              {bg?.type === 'color' && bg.value === c && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="m5 12.5 4.5 4.5L19 7.5" stroke={isLight(c) ? '#2c3a4b' : '#ffffff'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {hint && <div className="chat-toast">{hint}</div>}
      </div>
    </div>
  )
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return r * 0.299 + g * 0.587 + b * 0.114 > 150
}
