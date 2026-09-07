import { NavBar } from '../../components/common'
import { BackIcon } from '../../components/icons'
import { formatMoney } from '../../utils/qr'

export type PaySuccessBack = { name: 'chat'; friendId: string } | { name: 'wallet' } | { name: 'relativeCard' }

export interface PaySuccessData {
  title: string
  amount?: number
  amountNote?: string
  rows: { label: string; value: string }[]
  back: PaySuccessBack
}

export default function PaySuccess({ data, onDone }: { data: PaySuccessData; onDone: () => void }) {
  return (
    <div className="page ps-page">
      <NavBar
        title="支付详情"
        left={
          <button className="nav-btn" onClick={onDone} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body ps-body">
        <span className="ps-check">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            <path d="m6.5 12.5 3.6 3.6 7.4-7.7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="ps-title">{data.title}</div>
        {typeof data.amount === 'number' && (
          <div className="ps-amount">
            <span className="ps-amount-cny">¥</span>
            <span className="ps-amount-num">{formatMoney(data.amount)}</span>
            {data.amountNote && <span className="ps-amount-note">{data.amountNote}</span>}
          </div>
        )}
        <div className="list-group ps-rows">
          {data.rows.map((r) => (
            <div key={r.label} className="row">
              <div className="row-main">
                <span className="row-title">{r.label}</span>
              </div>
              <span className="ps-row-value">{r.value}</span>
            </div>
          ))}
        </div>
        <button className="ps-done" onClick={onDone}>
          完成
        </button>
      </div>
    </div>
  )
}
