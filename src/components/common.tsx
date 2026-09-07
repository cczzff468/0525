import { useEffect, useState, type ReactNode } from 'react'
import { letterAvatar } from '../store'

export function Avatar({ name, src, size = 48 }: { name: string; src?: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  const url = !failed && src ? src : letterAvatar(name)
  return (
    <img
      className="avatar"
      src={url}
      alt={name}
      style={{ width: size, height: size, borderRadius: '50%' }}
      draggable={false}
      onError={() => {
        if (src) setFailed(true)
      }}
    />
  )
}

export function NavBar({
  title,
  left,
  right,
  large,
  children,
}: {
  title: string
  left?: ReactNode
  right?: ReactNode
  large?: boolean
  children?: ReactNode
}) {
  return (
    <div className={`navbar ${large ? 'navbar-large' : ''}`}>
      <div className="navbar-row">
        <div className="navbar-side navbar-left">{left}</div>
        {!large && <div className="navbar-title">{title}</div>}
        <div className="navbar-side navbar-right">{right}</div>
      </div>
      {large && <div className="navbar-large-title">{title}</div>}
      {children}
    </div>
  )
}

export function ActionSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean
  onClose: () => void
  children: ReactNode
}) {
  const [render, setRender] = useState(visible)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (visible) {
      setRender(true)
      const t = setTimeout(() => setShown(true), 20)
      return () => clearTimeout(t)
    }
    setShown(false)
    const t = setTimeout(() => setRender(false), 260)
    return () => clearTimeout(t)
  }, [visible])

  if (!render) return null

  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className={`sheet-body ${shown ? 'shown' : ''}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function Chevron() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
      <path d="m1.5 1.5 5 5.5-5 5.5" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Modal({
  open,
  title,
  children,
  buttons,
}: {
  open: boolean
  title: string
  children?: ReactNode
  buttons: { label: string; onClick: () => void; primary?: boolean }[]
}) {
  if (!open) return null
  return (
    <div className="modal-mask" onClick={buttons[buttons.length - 1]?.onClick}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {children && <div className="modal-body">{children}</div>}
        <div className="modal-buttons">
          {buttons.map((b) => (
            <button key={b.label} className={`modal-btn ${b.primary ? 'primary' : ''}`} onClick={b.onClick}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const yesterday = new Date(now.getTime() - 86400000)
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatTimeFull(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return `今天 ${hm}`
  const yesterday = new Date(now.getTime() - 86400000)
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hm}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}
