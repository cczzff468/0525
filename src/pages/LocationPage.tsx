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
        title="位置"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="loc-banner">
          <svg viewBox="0 0 340 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect width="340" height="130" fill="#e6efe2" />
            <rect x="-10" y="-10" width="90" height="70" rx="8" fill="#d3e6cc" />
            <rect x="100" y="14" width="70" height="46" rx="8" fill="#dbe9d4" />
            <rect x="196" y="-8" width="80" height="60" rx="8" fill="#d3e6cc" />
            <rect x="16" y="84" width="66" height="60" rx="8" fill="#dbe9d4" />
            <rect x="196" y="76" width="90" height="64" rx="8" fill="#d8e8ef" />
            <rect x="296" y="8" width="60" height="34" rx="8" fill="#cfe3f2" />
            <rect x="306" y="96" width="52" height="44" rx="8" fill="#dbe9d4" />
            <path d="M-4 70 H344" stroke="#ffffff" strokeWidth="13" />
            <path d="M84 -4 V134" stroke="#ffffff" strokeWidth="10" />
            <path d="M188 -4 V134" stroke="#ffffff" strokeWidth="7" />
            <path d="M280 -4 V134" stroke="#ffffff" strokeWidth="10" />
            <path d="M-4 118 H344" stroke="#ffffff" strokeWidth="6" />
            <path d="M-4 -8 L344 100" stroke="#fdf3d8" strokeWidth="7" opacity="0.9" />
            <circle cx="52" cy="24" r="7" fill="#b9d9ad" />
            <circle cx="152" cy="100" r="8" fill="#b9d9ad" />
            <circle cx="238" cy="20" r="6" fill="#b9d9ad" />
            <circle cx="58" cy="116" r="5" fill="#4a90e2" />
            <path d="M58 116 Q120 96 168 64" stroke="#4a90e2" strokeWidth="2.5" strokeDasharray="1 7" fill="none" strokeLinecap="round" />
            <path d="M176 42c-7 0-12.5 5.4-12.5 12.2C163.5 63.6 176 76 176 76s12.5-12.4 12.5-21.8C188.5 47.4 183 42 176 42Z" fill="#e5533d" />
            <circle cx="176" cy="54" r="4.4" fill="#fff" />
          </svg>
          <span className="loc-banner-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 21c4.2-4.2 6.5-7.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 13.6 7.8 16.8 12 21Z" stroke="#0a84ff" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="12" cy="10.5" r="2.4" stroke="#0a84ff" strokeWidth="2" />
            </svg>
            {MY_PLACE.address}
          </span>
        </div>
        <button className="loc-row loc-row-mine" onClick={() => send(MY_PLACE)}>
          <span className="loc-row-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 21c4.2-4.2 6.5-7.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 13.6 7.8 16.8 12 21Z" stroke="#ffffff" strokeWidth="1.7" strokeLinejoin="round" />
              <circle cx="12" cy="10.5" r="2.4" stroke="#ffffff" strokeWidth="1.7" />
            </svg>
          </span>
          <span className="loc-row-main">
            <span className="loc-row-name">发送我的位置</span>
            <span className="loc-row-addr">{MY_PLACE.address}</span>
          </span>
          <span className="loc-row-send">发送</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="m9 5 7 7-7 7" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
          <button className="loc-add-btn" onClick={addCustom}>
            添加
          </button>
        </div>

        {list.length > 0 ? (
          <div className="loc-list">
            {list.map((l) => (
              <button key={l.id} className="loc-row" onClick={() => send(l)}>
                <span className="loc-row-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
