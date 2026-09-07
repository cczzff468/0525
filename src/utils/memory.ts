import { loadApiSetting, loadMemoryData, saveMemoryData, loadFriends, loadProfile, loadMessages } from '../store'
import { chatUrl } from './ai'
import type { Friend, Message } from '../types'

const running: Record<string, boolean> = {}

export function pendingMessages(friendId: string): Message[] {
  const msgs = loadMessages().filter((m) => m.friendId === friendId)
  const data = loadMemoryData()
  const lastId = data.lastMsgId[friendId]
  if (!lastId) return msgs
  const idx = msgs.findIndex((m) => m.id === lastId)
  return idx >= 0 ? msgs.slice(idx + 1) : msgs
}

function pickFriend(friendId: string): Friend | undefined {
  return loadFriends().find((f) => f.id === friendId)
}

async function callLlm(system: string, user: string): Promise<string> {
  const cfg = loadApiSetting()
  if (!cfg.baseUrl.trim() || !cfg.model.trim()) throw new Error('未配置聊天 API，请先到 设置-API设置 填写')
  let res: Response
  try {
    res = await fetch(chatUrl(cfg.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey.trim() ? { Authorization: `Bearer ${cfg.apiKey.trim()}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model.trim(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        max_tokens: 600,
        stream: false,
      }),
    })
  } catch {
    throw new Error('网络请求失败：可能是地址不可达、断网，或该 API 不允许浏览器跨域（CORS）调用')
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    if (res.status === 404) throw new Error('总结失败（HTTP 404）：接口地址不存在，请检查设置-API设置 里的 API 地址是否完整')
    throw new Error(`总结失败（HTTP ${res.status}）${detail.slice(0, 80)}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new Error('总结失败：AI 返回为空')
  return text.trim()
}

function recordError(friendId: string, err: unknown) {
  try {
    const cur = loadMemoryData()
    cur.lastError = {
      ...cur.lastError,
      [friendId]: { message: err instanceof Error ? err.message : String(err), time: Date.now() },
    }
    saveMemoryData(cur)
  } catch {
    /* ignore */
  }
}

function clearError(friendId: string) {
  try {
    const cur = loadMemoryData()
    if (cur.lastError?.[friendId]) {
      const next = { ...cur.lastError }
      delete next[friendId]
      cur.lastError = next
      saveMemoryData(cur)
    }
  } catch {
    /* ignore */
  }
}

export async function summarizeMessages(friend: Friend, msgs: Message[]): Promise<string> {
  const me = loadProfile()
  const dialogue = msgs
    .map((m) => `${m.from === 'me' ? me.name : friend.name}：${m.text}`)
    .join('\n')
  const system = `你是对话记录整理助手。请把用户与"${friend.name}"的聊天记录提炼成记忆碎片，供 AI 聊天时回忆使用。要求：
1. 只保留有记忆价值的信息：彼此透露的个人情况、喜好、计划、约定、重要观点、关系进展等
2. 忽略寒暄、客套和无信息量的内容
3. 用第三人称、条目式输出（每条一行，以·开头），最多 6 条
4. 每条尽量包含时间、事件、人物等具体信息，总字数不超过 150 字`
  return callLlm(system, dialogue.slice(-6000))
}

export async function consolidateLongTerm(friend: Friend, fragments: string[], previous?: string): Promise<string> {
  const material = fragments.join('\n')
  const system = `你负责维护"${friend.name}"与用户之间的长期记忆。根据记忆碎片归纳出一份核心记忆，供 AI 聊天时了解两人关系的来龙去脉。要求：
1. 用第三人称段落式书写，200 字以内
2. 覆盖：两人关系现状、重要共同经历、对方的稳定特点与喜好、未完成的约定或话题
3. 若提供了旧版核心记忆，在其基础上融合更新，保留仍然有效的信息，修正过时信息`
  const user = previous ? `旧版核心记忆：\n${previous}\n\n新的记忆碎片：\n${material}` : `记忆碎片：\n${material}`
  return callLlm(system, user)
}

export function friendMemoryContext(friendId: string): { longTerm?: string; fragments: string[] } {
  const data = loadMemoryData()
  const lt = data.longTerm
    .filter((l) => l.friendId === friendId)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
  const frags = data.fragments
    .filter((f) => f.friendId === friendId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5)
    .map((f) => f.content)
  return { longTerm: lt?.content, fragments: frags }
}

export async function maybeAutoSummarize(friendId: string): Promise<void> {
  if (running[friendId]) return
  const friend = pickFriend(friendId)
  if (!friend) return
  const data = loadMemoryData()
  const pending = pendingMessages(friendId)
  if (pending.length < data.settings.fragmentEvery) return
  running[friendId] = true
  try {
    const snapshot = pending.slice()
    const summary = await summarizeMessages(friend, snapshot)
    const cur = loadMemoryData()
    const frag = {
      id: `mf-${Date.now()}`,
      friendId,
      content: summary,
      msgCount: snapshot.length,
      createdAt: Date.now(),
      source: 'auto' as const,
    }
    const friendFrags = cur.fragments.filter((f) => f.friendId === friendId)
    cur.fragments = [...cur.fragments, frag]
    cur.lastMsgId = { ...cur.lastMsgId, [friendId]: snapshot[snapshot.length - 1].id }
    saveMemoryData(cur)

    const lastLt = cur.longTerm.filter((l) => l.friendId === friendId).sort((a, b) => b.createdAt - a.createdAt)[0]
    const covered = new Set(lastLt?.baseFragmentIds ?? [])
    const newFrags = friendFrags.concat(frag).filter((f) => !covered.has(f.id))
    if (newFrags.length >= cur.settings.longTermEvery) {
      const ltContent = await consolidateLongTerm(
        friend,
        newFrags.map((f) => f.content),
        lastLt?.content
      )
      const cur2 = loadMemoryData()
      cur2.longTerm = [
        ...cur2.longTerm,
        {
          id: `lt-${Date.now()}`,
          friendId,
          content: ltContent,
          createdAt: Date.now(),
          source: 'auto' as const,
          baseFragmentIds: newFrags.map((f) => f.id),
        },
      ]
      saveMemoryData(cur2)
    }
    clearError(friendId)
  } catch (err) {
    recordError(friendId, err)
  } finally {
    running[friendId] = false
  }
}

export async function manualFragment(friendId: string): Promise<void> {
  const friend = pickFriend(friendId)
  if (!friend) throw new Error('联系人不存在')
  let msgs = pendingMessages(friendId)
  if (msgs.length === 0) {
    msgs = loadMessages().filter((m) => m.friendId === friendId).slice(-10)
  }
  if (msgs.length === 0) throw new Error('还没有聊天内容可以总结')
  const summary = await summarizeMessages(friend, msgs)
  const cur = loadMemoryData()
  cur.fragments = [
    ...cur.fragments,
    { id: `mf-${Date.now()}`, friendId, content: summary, msgCount: msgs.length, createdAt: Date.now(), source: 'manual' },
  ]
  cur.lastMsgId = { ...cur.lastMsgId, [friendId]: msgs[msgs.length - 1].id }
  saveMemoryData(cur)
}

export async function manualLongTerm(friendId: string): Promise<void> {
  const friend = pickFriend(friendId)
  if (!friend) throw new Error('联系人不存在')
  const cur = loadMemoryData()
  const lastLt = cur.longTerm.filter((l) => l.friendId === friendId).sort((a, b) => b.createdAt - a.createdAt)[0]
  const covered = new Set(lastLt?.baseFragmentIds ?? [])
  const all = cur.fragments.filter((f) => f.friendId === friendId)
  const newFrags = all.filter((f) => !covered.has(f.id))
  const use = newFrags.length > 0 ? newFrags : all
  if (use.length === 0) throw new Error('先积累一些记忆碎片，再归纳长期记忆')
  const content = await consolidateLongTerm(
    friend,
    use.map((f) => f.content),
    lastLt?.content
  )
  const cur2 = loadMemoryData()
  cur2.longTerm = [
    ...cur2.longTerm,
    {
      id: `lt-${Date.now()}`,
      friendId,
      content,
      createdAt: Date.now(),
      source: 'manual',
      baseFragmentIds: use.map((f) => f.id),
    },
  ]
  saveMemoryData(cur2)
}
