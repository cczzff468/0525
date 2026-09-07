import { useState } from 'react'
import { NavBar, Chevron } from '../components/common'
import { BackIcon } from '../components/icons'
import { loadFriends, saveFriends } from '../store'
import type { Friend } from '../types'

const GROUPS: { label: string; langs: string[] }[] = [
  { label: '常用语言', langs: ['中文简体', '英语', '日语', '韩语', '法语', '俄语', '西班牙语', '阿拉伯语', '德语'] },
  { label: '更多语言', langs: ['葡萄牙语', '意大利语', '泰语', '越南语', '印尼语', '荷兰语', '波兰语', '保加利亚语'] },
]

export default function TranslateLang({
  friend,
  onBack,
}: {
  friend: Friend
  onBack: () => void
}) {
  const cur = loadFriends().find((f) => f.id === friend.id) ?? friend
  const [mode, setMode] = useState<'src' | 'dst'>('dst')
  const src = cur.translateSrc || '中文简体'
  const dst = cur.translateLang || '英语'
  const current = mode === 'src' ? src : dst
  const other = mode === 'src' ? dst : src

  const patch = (patchData: Partial<Friend>) => {
    saveFriends(loadFriends().map((f) => (f.id === friend.id ? { ...f, ...patchData } : f)))
  }

  const pick = (lang: string) => {
    if (lang === other) return
    if (mode === 'src') patch({ translateSrc: lang })
    else patch({ translateLang: lang })
    onBack()
  }

  return (
    <div className="page">
      <NavBar
        title="翻译语言"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body translate-lang-page">
        <div className="tl-swap-row">
          <button className={`tl-swap-side ${mode === 'src' ? 'editing' : ''}`} onClick={() => setMode('src')}>
            {src}
          </button>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M4 8h13m0 0-3-3m3 3-3 3M20 16H7m0 0 3-3m-3 3 3 3" stroke="#2c2c2e" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <button className={`tl-swap-side dst ${mode === 'dst' ? 'editing' : ''}`} onClick={() => setMode('dst')}>
            {dst}
          </button>
        </div>
        <div className="tl-hint">点击上方一侧，再在下方列表中选择该侧语言</div>

        {GROUPS.map((g) => (
          <div key={g.label}>
            <div className="tl-group-label">{g.label}</div>
            <div className="tl-list">
              {g.langs.map((lang) => {
                const isCurrent = lang === current
                const isBlocked = lang === other
                return (
                  <button key={lang} className="tl-row" onClick={() => pick(lang)}>
                    <span className={`tl-name ${isCurrent || isBlocked ? 'current' : ''}`}>{lang}</span>
                    <span className="tl-right">
                      {isCurrent && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="m5 12.5 4.5 4.5L19 7.5" stroke="#0a84ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      <Chevron />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
