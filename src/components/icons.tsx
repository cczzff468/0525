interface IconProps {
  size?: number
  active?: boolean
}

export function ChatIcon({ size = 26, active }: IconProps) {
  const color = active ? '#007aff' : '#8e8e93'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3c5.1 0 9 3.4 9 7.7 0 4.3-3.9 7.7-9 7.7-.9 0-1.8-.1-2.6-.3-.9.8-2.4 1.8-4.5 2.1-.3 0-.5-.3-.4-.6.4-.8.7-1.8.7-2.7C3.6 15.4 3 13.4 3 10.7 3 6.4 6.9 3 12 3Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ContactsIcon({ size = 26, active }: IconProps) {
  const color = active ? '#007aff' : '#8e8e93'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8.5" r="3.5" stroke={color} strokeWidth="1.7" />
      <path d="M4.5 20c.8-3.4 3.9-5.5 7.5-5.5s6.7 2.1 7.5 5.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function DiscoverIcon({ size = 26, active }: IconProps) {
  const color = active ? '#007aff' : '#8e8e93'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.7" />
      <path d="m15.5 8.5-2.2 5-4.8 2 2.2-5 4.8-2Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export function MeIcon({ size = 26, active }: IconProps) {
  const color = active ? '#007aff' : '#8e8e93'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.7" />
      <circle cx="12" cy="10" r="2.6" stroke={color} strokeWidth="1.6" />
      <path d="M6.8 18.2c1-2.2 2.9-3.4 5.2-3.4s4.2 1.2 5.2 3.4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function PlusIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="#007aff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function BackIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M15 4.5 7.5 12l7.5 7.5" stroke="#007aff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SendIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 19V5m0 0-6.5 6.5M12 5l6.5 6.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function VideoIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2.8" y="6.8" width="12.6" height="10.4" rx="3" stroke="#0a84ff" strokeWidth="1.8" />
      <path
        d="m15.4 12.6 4.3-2.7c.5-.3 1.2.06 1.2.65v5.1c0 .59-.66.94-1.16.62l-4.34-2.77"
        stroke="#0a84ff"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SearchIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke="#8e8e93" strokeWidth="2" />
      <path d="m16 16 4.5 4.5" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function MicIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="9.2" y="3" width="5.6" height="11" rx="2.8" stroke="#8e8e93" strokeWidth="1.7" />
      <path d="M5.8 11.5a6.2 6.2 0 0 0 12.4 0M12 17.7V21" stroke="#8e8e93" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function PlusBadgeIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 4.5v15M4.5 12h15" stroke="#b9b9be" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
