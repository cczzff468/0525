import { loadApiSetting } from '../store'
import type { Friend, Profile } from '../types'

export type AiErrorCode =
  | 'noapi'
  | 'offline'
  | 'connect'
  | 'timeout'
  | '401'
  | '403'
  | '404'
  | '429'
  | 'model'
  | 'toolong'
  | 'other'

export class AiError extends Error {
  code: AiErrorCode
  detail: string
  constructor(code: AiErrorCode, detail = '') {
    super(code)
    this.code = code
    this.detail = detail
  }
}

export function chatUrl(url: string): string {
  const raw = url.trim()
  if (/\/chat\/completions(\?|$)/.test(raw)) return raw
  const clean = raw.replace(/\/+$/, '')
  if (/\/v\d+$/.test(clean)) return `${clean}/chat/completions`
  return `${clean}/v1/chat/completions`
}

export function modelsUrl(url: string): string {
  const base = url.trim().split('?')[0].replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
  return `${base}/models`
}

function systemPrompt(friend: Friend, me: Profile): string {
  const lines = [
    `你是${friend.name}，${friend.gender}，${friend.age}岁。`,
    friend.occupation ? `你的职业是${friend.occupation}。` : '',
    friend.region ? `你所在地区：${friend.region}。` : '',
    friend.bio ? `你的人设与背景：${friend.bio}。` : '',
    `你正在和${me.name}（${me.gender}，${me.age > 0 ? `${me.age}岁` : '年龄未知'}）用手机聊天。`,
    me.bio ? `对方的人设与背景：${me.bio}。聊天时可以把对方当作这个人来对待，可以自然地提起对方的爱好。` : '',
    '用简体中文回复，口语化，像真人发消息，每次1-2句话，符合你的人设语气，不要出现"作为AI"之类的表述。',
  ]
  return lines.filter(Boolean).join('\n')
}

export async function readServerError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    const msg = data?.error?.message ?? data?.message ?? data?.detail
    if (typeof msg === 'string' && msg.trim()) return msg.trim().slice(0, 140)
  } catch {
    /* body is not json */
  }
  return ''
}

function errorFromStatus(status: number, serverMsg: string): AiError {
  const lower = serverMsg.toLowerCase()
  if (status === 401) return new AiError('401', serverMsg)
  if (status === 403) return new AiError('403', serverMsg)
  if (status === 404) {
    if (lower.includes('model')) return new AiError('model', serverMsg)
    return new AiError('404', serverMsg)
  }
  if (status === 429) return new AiError('429', serverMsg)
  if (lower.includes('model') && (lower.includes('not found') || lower.includes('does not exist') || lower.includes('不存在'))) {
    return new AiError('model', serverMsg)
  }
  return new AiError('other', serverMsg ? `${status} ${serverMsg}` : `${status}`)
}

export async function aiStream(
  history: { role: 'user' | 'assistant'; content: string }[],
  friend: Friend,
  me: Profile,
  onDelta: (chunk: string) => void
): Promise<{ text: string; truncated: boolean }> {
  const cfg = loadApiSetting()
  if (!cfg.baseUrl.trim() || !cfg.model.trim()) throw new AiError('noapi')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AiError('offline')

  const payload = {
    model: cfg.model.trim(),
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
    messages: [
      { role: 'system', content: systemPrompt(friend, me) },
      ...history.slice(-20),
    ],
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(cfg.apiKey.trim() ? { Authorization: `Bearer ${cfg.apiKey.trim()}` } : {}),
  }
  const timeoutMs = Math.max(5, cfg.timeout) * 1000
  const controller = new AbortController()
  const abortTimer = window.setTimeout(() => controller.abort(), timeoutMs)

  let full = ''
  try {
    const res = await fetch(chatUrl(cfg.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, stream: true }),
      signal: controller.signal,
    })
    if (!res.ok) throw errorFromStatus(res.status, await readServerError(res))
    if (!res.body) throw new AiError('other', '服务端未返回数据流')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let finished = false
    let done = false
    while (!done) {
      const { value, done: rdDone } = await reader.read()
      if (rdDone) break
      buf += decoder.decode(value, { stream: true })
      const events = buf.split('\n\n')
      buf = events.pop() ?? ''
      for (const ev of events) {
        for (const line of ev.split('\n')) {
          const t = line.trim()
          if (!t.startsWith('data:')) continue
          const data = t.slice(5).trim()
          if (data === '[DONE]') {
            done = true
            break
          }
          try {
            const parsed = JSON.parse(data)
            const choice = parsed?.choices?.[0]
            const delta = choice?.delta?.content
            if (typeof delta === 'string' && delta) {
              full += delta
              onDelta(delta)
            }
            if (choice?.finish_reason === 'length') finished = true
          } catch {
            /* partial json, ignore */
          }
        }
      }
    }
    if (!full.trim()) throw new AiError('other', '模型没有返回内容')
    return { text: full.trim().slice(0, 4000), truncated: finished }
  } catch (err) {
    if (err instanceof AiError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') throw new AiError('timeout')
    if (err instanceof TypeError) throw new AiError('connect')
    throw new AiError('other', err instanceof Error ? err.message : String(err))
  } finally {
    window.clearTimeout(abortTimer)
  }
}
