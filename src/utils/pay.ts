import type { WalletState } from '../types'
import { formatMoney } from './qr'

export const round2 = (n: number) => Math.round(n * 100) / 100

export type PaySourceRow = { key: string; label: string; desc: string; amount: number }

// key: 'balance' 表示零钱余额，其余为银行卡 id
export function paySources(w: WalletState): PaySourceRow[] {
  const rows: PaySourceRow[] = [{ key: 'balance', label: '零钱余额', desc: `可用余额 ¥${formatMoney(w.balance)}`, amount: w.balance }]
  for (const c of w.bankCards) {
    rows.push({ key: c.id, label: c.bankName, desc: `尾号 ${c.cardTail} · 可用 ¥${formatMoney(c.available)}`, amount: c.available })
  }
  return rows
}

export function paySource(w: WalletState, key: string): PaySourceRow | undefined {
  return paySources(w).find((s) => s.key === key)
}

export function payLabel(w: WalletState, key: string): string {
  const s = paySource(w, key)
  if (!s) return '零钱余额'
  return s.key === 'balance' ? '零钱余额' : `${s.label}（尾号 ${w.bankCards.find((c) => c.id === key)?.cardTail ?? ''}）`
}

export function checkAmount(w: WalletState, key: string, amount: number): string | null {
  const s = paySource(w, key)
  if (!s) return '请选择支付方式'
  if (amount <= 0) return '请输入正确的金额'
  if (amount > s.amount) return s.key === 'balance' ? '零钱余额不足' : '银行卡可用余额不足'
  return null
}

export function deduct(w: WalletState, key: string, amount: number): WalletState {
  const m = round2(amount)
  if (key === 'balance') return { ...w, balance: round2(w.balance - m) }
  return { ...w, bankCards: w.bankCards.map((c) => (c.id === key ? { ...c, available: round2(c.available - m) } : c)) }
}

export function payMethodNote(w: WalletState, key: string): string {
  const s = paySource(w, key)
  if (!s || s.key === 'balance') return '零钱'
  const tail = w.bankCards.find((c) => c.id === key)?.cardTail ?? ''
  return `银行卡（尾号 ${tail}）`
}
