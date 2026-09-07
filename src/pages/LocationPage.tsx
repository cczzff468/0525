import { useState } from 'react'
import { NavBar } from '../components/common'
import { BackIcon } from '../components/icons'
import { loadLocations, saveLocations, uid } from '../store'
import type { LocationItem } from '../types'

const MY_PLACE: LocationItem = { id: '__mine__', name: '我的位置', address: '广东省广州市天河区' }

export default function LocationPage({
  onBack,
  onSend,
}: {
  onBack: () => void
  onSend: (loc: { name: string; address?: string }) => void
}) {
  const [list, setList] = useState<LocationItem[]>(() => loadLocations())
  const [draft, setDraft] = useState('')
  const [hint, setHint] = useState('')

  const send = (loc: { name: string; address?: string }) => {
    onSend(loc)
  }

  const addCustom = () => {
    const name = draft.trim()
    if (!name) {
      setHint('先输入地点名称')
      window.setTimeout(() => setHint(''), 1500)
      return
    }
    const item: LocationItem = { id: uid(), name, address: '' }
    const next = [...list, item]
    saveLocations(next)
    setList(next)
    setDraft('')
  }

  const removeOne = (id: string) => {
    const next = list.filter((l) => l.id !== id)
    saveLocations(next)
    setList(next)
  }

  return (
    <div className="page location-page">
      <NavBar
        title="发送位置"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="loc-banner">
          <svg viewBox="0 0 340 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect width="340" height="150" fill="#eaf1e6" />
            <path d="M-4 118 C80 100 150 132 344 108 L344 154 L-4 154 Z" fill="#bfdcf2" />
            <rect x="-10" y="-10" width="86" height="66" rx="8" fill="#d8e7d0" />
            <rect x="98" y="10" width="66" height="42" rx="7" fill="#dfeacf" />
            <rect x="192" y="-12" width="86" height="58" rx="8" fill="#d8e7d0" />
            <rect x="14" y="82" width="62" height="46" rx="7" fill="#dfeacf" />
            <rect x="196" y="70" width="76" height="40" rx="7" fill="#e4e9ea" />
            <rect x="298" y="6" width="56" height="32" rx="7" fill="#dfeacf" />
            <rect x="300" y="92" width="52" height="30" rx="7" fill="#d8e7d0" />
            <text x="120" y="88" fontSize="9" fill="#a9b6a3" fontFamily="sans-serif">
              天河公园
            </text>
            <text x="212" y="66" fontSize="8" fill="#9aa4b2" fontFamily="sans-serif">
              正佳广场
            </text>
            <path d="M-4 68 H344" stroke="#ffffff" strokeWidth="12" />
            <path d="M84 -4 V154" stroke="#ffffff" strokeWidth="9" />
            <path d="M186 -4 V154" stroke="#ffffff" strokeWidth="6" />
            <path d="M282 -4 V154" stroke="#ffffff" strokeWidth="9" />
            <text x="24" y="64" fontSize="8" fill="#b3b3b8" fontFamily="sans-serif">
              天河路
            </text>
            <path d="M-4 130 H344" stroke="#fdf3d8" strokeWidth="5" opacity="0.9" />
            <circle cx="50" cy="26" r="7" fill="#b9d9ad" />
            <circle cx="150" cy="112" r="8" fill="#b9d9ad" />
            <circle cx="240" cy="24" r="6" fill="#b9d9ad" />
            <path d="M52 122 Q120 100 172 66" stroke="#0a84ff" strokeWidth="2.6" strokeDasharray="1 7" fill="none" strokeLinecap="round" className="loc-route" />
            <path d="M172 40c-7.5 0-13.5 5.8-13.5 13C158.5 63 172 77 172 77s13.5-14 13.5-24c0-7.2-6-13-13.5-13Z" fill="#e5533d" filter="drop-shadow(0 2px 3px rgba(180,40,20,0.4))" />
            <circle cx="172" cy="53" r="4.6" fill="#fff" />
          </svg>
          <span className="loc-banner-chip">
            <span className="loc-banner-dot" />
            GPS 已定位
          </span>
        </div>

        <button className="loc-hero" onClick={() => send(MY_PLACE)}>
          <span className="loc-hero-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 21c4.2-4.2 6.5-7.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 13.6 7.8 16.8 12 21Z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
              <circle cx="12" cy="10.5" r="2.4" stroke="#fff" strokeWidth="1.7" />
            </svg>
          </span>
          <span className="loc-hero-main">
            <span className="loc-hero-name">发送我的位置</span>
            <span className="loc-hero-addr">{MY_PLACE.address}</span>
          </span>
          <span className="loc-hero-send">
            发送
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M4 12h14m0 0-5-5m5 5-5 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        <div className="loc-section-title">自定义位置</div>
        <div className="loc-add-bar">
          <input
            className="loc-add-input"
            type="text"
            placeholder="输入地点名称，如：星巴克（正佳广场店）"
            maxLength={20}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addCustom()
            }}
          />
          <button className="loc-add-btn" aria-label="添加" onClick={addCustom}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {list.length > 0 ? (
          <div className="loc-list">
            {list.map((l) => (
              <button key={l.id} className="loc-row" onClick={() => send(l)}>
                <span className="loc-row-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path d="M12 21c4.2-4.2 6.5-7.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 13.6 7.8 16.8 12 21Z" stroke="#0a84ff" strokeWidth="1.7" strokeLinejoin="round" />
                    <circle cx="12" cy="10.5" r="2.4" stroke="#0a84ff" strokeWidth="1.7" />
                  </svg>
                </span>
                <span className="loc-row-main">
                  <span className="loc-row-name">{l.name}</span>
                  {l.address && <span className="loc-row-addr">{l.address}</span>}
                </span>
                <span
                  className="loc-row-del"
                  role="button"
                  tabIndex={0}
                  aria-label={`删除 ${l.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeOne(l.id)
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <path d="M1 1l8 8M9 1L1 9" stroke="#8e8e93" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="loc-empty">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M12 21c4.2-4.2 6.5-7.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 13.6 7.8 16.8 12 21Z" stroke="#c7c7cc" strokeWidth="1.4" strokeLinejoin="round" />
              <circle cx="12" cy="10.5" r="2.4" stroke="#c7c7cc" strokeWidth="1.4" />
            </svg>
            <span>还没有自定义位置</span>
            <span className="loc-empty-sub">添加一个，下次直接点一下就能发送</span>
          </div>
        )}
      </div>
      {hint && <div className="chat-toast">{hint}</div>}
    </div>
  )
}
