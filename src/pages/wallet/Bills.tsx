import { useMemo, useState } from 'react'
import { NavBar } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { loadBills } from '../../store'
import type { Bill } from '../../types'
import { formatMoney } from '../../utils/qr'

const KIND_ICON: Record<string, { bg: string; label: string }> = {
  充值: { bg: '#07c160', label: '充' },
  提现: { bg: '#576b95', label: '提' },
  红包: { bg: '#fa5151', label: '红' },
  转账: { bg: '#10aeff', label: '转' },
  亲属卡: { bg: '#07c160', label: '亲' },
  零钱通: { bg: '#ff9d00', label: '通' },
  收益: { bg: '#ffb800', label: '益' },
  收付款: { bg: '#576b95', label: '付' },
}

export type BillFilter = 'all' | 'redpacket' | 'transfer' | 'pay' | 'fund' | 'relative' | 'change'

const FILTERS: { key: BillFilter; label: string; match: (b: Bill) => boolean }[] = [
  { key: 'all', label: '全部', match: () => true },
  { key: 'redpacket', label: '红包', match: (b) => b.kind === '红包' },
  { key: 'transfer', label: '转账', match: (b) => b.kind === '转账' },
  { key: 'pay', label: '收付款', match: (b) => b.kind === '收付款' },
  { key: 'fund', label: '零钱通', match: (b) => b.kind === '零钱通' || b.kind === '收益' },
  { key: 'relative', label: '亲属卡', match: (b) => b.kind === '亲属卡' },
  { key: 'change', label: '充值提现', match: (b) => b.kind === '充值' || b.kind === '提现' },
]

const pad = (n: number) => n.toString().padStart(2, '0')
const fmtLine = (t: number) => {
  const d = new Date(t)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Bills({
  title,
  initialFilter = 'all',
  onBack,
  onOpenDetail,
}: {
  title: string
  initialFilter?: BillFilter
  onBack: () => void
  onOpenDetail: (billId: string) => void
}) {
  const [filter, setFilter] = useState<BillFilter>(initialFilter)
  const match = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]
  const bills = useMemo(() => loadBills().filter(match.match), [filter])

  const groups = useMemo(() => {
    const map = new Map<string, Bill[]>()
    for (const b of bills) {
      const d = new Date(b.time)
      const key = `${d.getFullYear()}年${d.getMonth() + 1}月`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(b)
    }
    return [...map.entries()]
  }, [bills])

  return (
    <div className="page bills-page">
      <NavBar
        title={title}
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="bills-filter">
        {FILTERS.map((f) => (
          <button key={f.key} className={`bills-chip ${filter === f.key ? 'on' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="page-body bills-body">
        {groups.length === 0 ? (
          <div className="bills-empty">暂无账单记录</div>
        ) : (
          groups.map(([month, list]) => {
            const spend = list.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0)
            return (
              <div key={month} className="bills-group">
                <div className="bills-month">
                  <span>{month}</span>
                  <span className="bills-month-sum">支出 ¥{formatMoney(spend)}</span>
                </div>
                <div className="list-group">
                  {list.map((b) => {
                    const ic = KIND_ICON[b.kind] ?? KIND_ICON['收付款']
                    return (
                      <button key={b.id} className="row" onClick={() => onOpenDetail(b.id)}>
                        <span className="wi-icon" style={{ background: ic.bg }}>
                          {ic.label}
                        </span>
                        <div className="row-main">
                          <span className="row-title">{b.title}</span>
                          <span className="row-preview">
                            {fmtLine(b.time)}
                            {b.friendName ? ` · ${b.friendName}` : ''}
                          </span>
                        </div>
                        <span className={`bill-amount ${b.amount > 0 ? 'in' : ''}`}>{b.amount > 0 ? '+' : ''}{formatMoney(b.amount)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export function BillDetail({ billId, onBack }: { billId: string; onBack: () => void }) {
  const bill = loadBills().find((b) => b.id === billId)
  if (!bill) {
    return (
      <div className="page">
        <NavBar
          title="账单详情"
          left={
            <button className="nav-btn" onClick={onBack} aria-label="返回">
              <BackIcon />
            </button>
          }
        />
        <div className="page-body">
          <div className="bills-empty">账单不存在</div>
        </div>
      </div>
    )
  }
  const d = new Date(bill.time)
  const orderNo = bill.id.replace(/-/g, '').toUpperCase().slice(0, 22)
  return (
    <div className="page bill-detail-page">
      <NavBar
        title="账单详情"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="bill-hero">
          <span className={`bill-hero-amount ${bill.amount > 0 ? 'in' : ''}`}>
            {bill.amount > 0 ? '+' : '-'}¥{formatMoney(Math.abs(bill.amount))}
          </span>
          <span className="bill-hero-status">{bill.status}</span>
        </div>
        <div className="list-group">
          <div className="row">
            <div className="row-main">
              <span className="row-title">当前状态</span>
            </div>
            <span className="row-value">{bill.status}</span>
          </div>
          {bill.friendName && (
            <div className="row">
              <div className="row-main">
                <span className="row-title">对方</span>
              </div>
              <span className="row-value">{bill.friendName}</span>
            </div>
          )}
          <div className="row">
            <div className="row-main">
              <span className="row-title">转账时间</span>
            </div>
            <span className="row-value">
              {d.getFullYear()}-{pad(d.getMonth() + 1)}-{pad(d.getDate())} {pad(d.getHours())}:{pad(d.getMinutes())}:{pad(d.getSeconds())}
            </span>
          </div>
          <div className="row">
            <div className="row-main">
              <span className="row-title">收款方式</span>
            </div>
            <span className="row-value">零钱</span>
          </div>
          {bill.note && (
            <div className="row">
              <div className="row-main">
                <span className="row-title">备注</span>
              </div>
              <span className="row-value">{bill.note}</span>
            </div>
          )}
          <div className="row">
            <div className="row-main">
              <span className="row-title">转账单号</span>
            </div>
            <span className="row-value bill-order">{orderNo}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
