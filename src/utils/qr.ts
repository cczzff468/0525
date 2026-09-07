function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function finderPattern(matrix: boolean[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r
      const cc = col + c
      if (rr < 0 || cc < 0 || rr >= matrix.length || cc >= matrix.length) continue
      const inRing = r === 0 || r === 6 || c === 0 || c === 6
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4
      matrix[rr][cc] = inRing || inCore
    }
  }
}

export function qrDataUrl(seed: string, size = 560): string {
  const n = 29
  const quiet = 4
  const scale = Math.floor(size / (n + quiet * 2))
  const realSize = scale * (n + quiet * 2)
  const matrix: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false))
  const rand = mulberry32(hashSeed(seed))
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const inFinder = (r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8)
      if (inFinder) continue
      if (r === 6 || c === 6) {
        matrix[r][c] = (r + c) % 2 === 0
        continue
      }
      matrix[r][c] = rand() < 0.46
    }
  }
  finderPattern(matrix, 0, 0)
  finderPattern(matrix, 0, n - 7)
  finderPattern(matrix, n - 7, 0)
  const canvas = document.createElement('canvas')
  canvas.width = realSize
  canvas.height = realSize
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, realSize, realSize)
  ctx.fillStyle = '#000000'
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale)
    }
  }
  return canvas.toDataURL('image/png')
}

export function barcodeDataUrl(seed: string, width = 560, height = 130): string {
  const rand = mulberry32(hashSeed(seed))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#000000'
  const pad = 14
  let x = pad
  while (x < width - pad) {
    const w = rand() < 0.55 ? 2 : rand() < 0.75 ? 4 : 6
    ctx.fillRect(x, 0, w, height - 34)
    x += w + (rand() < 0.5 ? 2 : 3)
  }
  ctx.fillStyle = '#000000'
  ctx.font = '600 20px ui-monospace, "SF Mono", Menlo, monospace'
  ctx.textAlign = 'center'
  const digits = String(Math.abs(hashSeed(seed)) % 10000000000).padStart(10, '0').slice(0, 10)
  ctx.fillText(digits, width / 2, height - 6)
  return canvas.toDataURL('image/png')
}

export function formatMoney(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
