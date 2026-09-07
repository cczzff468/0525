import { NavBar, Chevron } from '../components/common'

interface Item {
  label: string
  bg: string
  shape: 'star' | 'play' | 'live' | 'scan' | 'search' | 'pin' | 'game' | 'mini'
}

const GROUPS: Item[][] = [
  [{ label: '朋友圈', bg: '#34c759', shape: 'star' }],
  [
    { label: '视频号', bg: '#fa5151', shape: 'play' },
    { label: '直播', bg: '#ff9500', shape: 'live' },
  ],
  [
    { label: '扫一扫', bg: '#5ac8fa', shape: 'scan' },
    { label: '搜一搜', bg: '#007aff', shape: 'search' },
    { label: '附近', bg: '#00c7be', shape: 'pin' },
  ],
  [
    { label: '游戏', bg: '#5856d6', shape: 'game' },
    { label: '小程序', bg: '#8e8e93', shape: 'mini' },
  ],
]

function Shape({ shape, color }: { shape: Item['shape']; color: string }) {
  const s = { stroke: color, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  switch (shape) {
    case 'star':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="10" r="2.6" {...s} />
          <circle cx="15.5" cy="13.5" r="2" {...s} />
          <path d="M12 20c-4.5 0-8-3-8-7 0-1 .3-2 .8-2.9" {...s} />
          <circle cx="17.5" cy="8" r="1.4" {...s} />
        </svg>
      )
    case 'play':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M8.5 6.5v11l9-5.5-9-5.5Z" {...s} />
        </svg>
      )
    case 'live':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="2.4" {...s} />
          <path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 16.5a6.4 6.4 0 0 0 0-9" {...s} />
        </svg>
      )
    case 'scan':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16" {...s} />
        </svg>
      )
    case 'search':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="5.5" {...s} />
          <path d="m15.5 15.5 4 4" {...s} />
        </svg>
      )
    case 'pin':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 21s-6.5-6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21Z" {...s} />
          <circle cx="12" cy="10.5" r="2" {...s} />
        </svg>
      )
    case 'game':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="8" width="17" height="9" rx="3" {...s} />
          <path d="M8 11v3M6.5 12.5h3" {...s} />
          <circle cx="15.5" cy="11.5" r="1" fill={color} stroke="none" />
          <circle cx="17.5" cy="13.5" r="1" fill={color} stroke="none" />
        </svg>
      )
    case 'mini':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="4.5" y="4.5" width="15" height="15" rx="3.5" {...s} />
          <rect x="9" y="9" width="6" height="6" rx="1.5" {...s} />
        </svg>
      )
  }
}

export default function Discover({ onOpenMoments }: { onOpenMoments: () => void }) {
  return (
    <div className="page">
      <NavBar large title="发现" />
      <div className="page-body">
        {GROUPS.map((group, gi) => (
          <div className="list-group" key={gi}>
            {group.map((item) => (
              <button
                key={item.label}
                className="row"
                onClick={() => {
                  if (item.label === '朋友圈') onOpenMoments()
                }}
              >
                <div className="row-icon row-icon-line" style={{ background: `${item.bg}1c` }}>
                  <Shape shape={item.shape} color={item.bg} />
                </div>
                <div className="row-main">
                  <span className="row-title">{item.label}</span>
                </div>
                <Chevron />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
