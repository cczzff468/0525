import { loadApiSetting } from '../store'
import type { Friend, Profile } from '../types'

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

export async function aiReply(userText: string, friend: Friend, me: Profile): Promise<string | null> {
  const cfg = loadApiSetting()
  if (!cfg.baseUrl.trim() || !cfg.model.trim()) return null
  try {
    const res = await fetch(chatUrl(cfg.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey.trim() ? { Authorization: `Bearer ${cfg.apiKey.trim()}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model.trim(),
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        messages: [
          { role: 'system', content: systemPrompt(friend, me) },
          { role: 'user', content: userText },
        ],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) return null
    return content.trim().slice(0, 300)
  } catch {
    return null
  }
}
