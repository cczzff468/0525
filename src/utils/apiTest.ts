export interface TestResult {
  ok: boolean
  detail: string
}

const TIMEOUT = 10000

function classify(status: number): string {
  if (status === 401 || status === 403) return 'Key 无效或无权限'
  if (status === 404) return '地址不存在，请检查 URL'
  if (status === 400) return '请求被拒绝，请检查模型名和参数'
  if (status === 429) return '额度不足或请求过于频繁'
  if (status >= 500) return '服务端错误，稍后再试'
  return `服务返回 ${status}`
}

async function postJson(url: string, body: unknown, apiKey: string): Promise<Response> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } finally {
    window.clearTimeout(timer)
  }
}

export async function testChatConnection(o: {
  baseUrl: string
  apiKey: string
  model: string
  vision?: boolean
}): Promise<TestResult> {
  if (!o.baseUrl.trim()) return { ok: false, detail: '未填写 API 地址' }
  if (!o.apiKey.trim()) return { ok: false, detail: '未填写 API Key' }
  const content = o.vision
    ? [
        { type: 'text', text: '描述这张图' },
        {
          type: 'image_url',
          image_url: { url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
        },
      ]
    : 'ping'
  try {
    const res = await postJson(
      o.baseUrl.trim(),
      { model: o.model.trim(), messages: [{ role: 'user', content }], max_tokens: 5, stream: false },
      o.apiKey
    )
    if (!res.ok) return { ok: false, detail: classify(res.status) }
    return { ok: true, detail: `已连通，模型 ${o.model.trim() || '（空）'} 可用` }
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return { ok: false, detail: '连接超时（10 秒）' }
    return { ok: false, detail: '网络连接失败' }
  }
}

export async function testTtsConnection(o: {
  baseUrl: string
  apiKey: string
  model: string
  voice: string
  speed?: number
  language?: string
}): Promise<TestResult> {
  if (!o.baseUrl.trim()) return { ok: false, detail: '未填写 API 地址' }
  if (!o.apiKey.trim()) return { ok: false, detail: '未填写 API Key' }
  const body: Record<string, unknown> = { model: o.model.trim(), input: '你好', voice: o.voice, speed: o.speed ?? 1 }
  if (o.language) body.language = o.language
  try {
    const res = await postJson(o.baseUrl.trim(), body, o.apiKey)
    if (!res.ok) return { ok: false, detail: classify(res.status) }
    const type = (res.headers.get('content-type') ?? '').split(';')[0]
    return { ok: true, detail: type ? `已连通，返回 ${type}` : '已连通（HTTP 200）' }
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return { ok: false, detail: '连接超时（10 秒）' }
    return { ok: false, detail: '网络连接失败' }
  }
}
