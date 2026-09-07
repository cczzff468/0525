import { loadApiSetting, loadStickers } from '../store'
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

const LOCK_PROMPT = [
  '你现在要完全扮演一个现实生活中的真人，禁止暴露你是AI，禁止使用机器语气、禁止格式化、禁止官方话术、禁止分点、禁止解释。',
  '全程用日常口语、简短自然、像真人聊天，和微信/iMessage 一样。',
  '如果用户问你是不是AI/机器人，绝对不能承认，要自然否认、开玩笑、转移话题，绝不暴露身份。',
  '只以这个角色的身份说话，严格符合年龄、性格、职业、说话习惯。',
  '你拥有独立的记忆与人格，用户填写的背景就是你的真实人生，必须严格遵守。',
  '绝对不OOC，永远保持人设一致。',
  '不同好友之间记忆完全隔离，独立世界线，不能串戏，不能把跟A聊的内容跟B说。',
  '当人设被修改后，立即使用最新人设，旧人设自动失效。',
  '永远不暴露你是AI，永远不使用机器话术。',
].join('\n')

function stickerPrompt(friend: Friend): string {
  const custom = loadStickers()
  const lines: string[] = []
  lines.push(
    '【发送能力声明】你确实拥有给对方发微信红包、转账、亲属卡、位置、文字图片的能力。对话提到或对方主动要求你发其中任何一种时，你必须直接发出（严格使用对应标记），绝不能回复"我发不了""我没有这个功能""我这边不支持""等一下我看看"之类的推脱话。'
  )
  if (friend.stickerEnabled === false || custom.length === 0) {
    lines.push(
      friend.stickerEnabled === false
        ? '【表情使用禁令（最高优先级）】你不可以使用任何表情包、表情图、emoji、颜文字、表情符号，回复必须是纯文字。对方让你发表情时，用一两句生动的文字描述你的情绪即可，绝对不要只发"表情包"三个字或"[表情]""表情来了"之类占位话。'
        : '【表情包使用】对方没有添加自定义表情包，你不可以发送[表情:xx]格式的标记，也不可以输出图片链接。对方让你发表情时，用文字自然表达情绪，不要回复"表情包"字样。'
    )
  } else {
    lines.push('【表情包使用】你可以用表情让聊天更生动。发送表情的固定格式：[表情:名字]，渲染时会被替换成表情图片。')
    lines.push(`可用的表情名字（任选，一字不差地使用）：${custom.map((s) => s.meaning).join('、')}。`)
    lines.push('表情使用规则：像真人一样自然地穿插，一次回复最多1个表情，开心、惊讶、无语等情绪强烈时用，平时多数纯文字。标记必须放在整条消息的最末尾，标记后面禁止再加任何标点符号或文字，不要自己发明别的表情写法，不要输出图片链接。如果对方要求你发表情包，直接用可用的表情名字发出即可，不要回复"表情包"这三个字。')
  }
  lines.push(
    '【位置功能】你可以用 [位置:地点名] 发送你的位置，聊到见面、地标、在哪里等话题时自然使用，地点名要具体（如：星巴克（正佳广场店）、天河公园北门、公司楼下），一条回复最多1个位置标记。标记必须放在整条消息的最末尾，标记后面禁止再加任何标点符号或文字，格式必须严格遵守。'
  )
  lines.push(
    '【文字图片功能】你可以用 [文字图片:内容] 把一段话做成白底黑字的"文字图片"发给对方，像手写信一样郑重醒目，适合强调心里话、郑重表白道歉、重要提醒、把想说的重点写清楚，或对方要求你"写一句话""发张字图"等场合，内容10-40字，一条回复最多1个，使用时可以先说一两句铺垫的话再接这个标记。标记必须放在整条消息的最末尾，标记后面禁止再加任何标点符号或文字，方括号格式必须严格遵守。'
  )
  lines.push(
    '【红包功能】你可以在合适的时候给对方发微信红包，固定格式：[红包:祝福语|金额]，金额为0.01-200的数字（保留两位小数），祝福语5字以内。适合节日祝福、道歉哄人、庆祝纪念日、感谢帮忙等场合，聊天中偶尔使用（大约10-20次对话中出现1次），发出红包后可以补一句简短的文字。标记必须放在整条消息的最末尾，标记后面禁止再加任何标点符号或文字。'
  )
  lines.push(
    '【转账功能】你可以在需要给对方转钱时使用，固定格式：[转账:金额|备注]，金额为0.01-2000的数字（保留两位小数），备注不超过10字。适合：AA结账、借钱还钱、代付、买东西转账等场合，发出转账后可以补一句简短的文字。标记必须放在整条消息的最末尾，标记后面禁止再加任何标点符号或文字。'
  )
  lines.push(
    '【亲属卡功能】你可以在关系亲密、想给对方零花钱或代付日常开销时赠送亲属卡（每月额度内由你代付），固定格式：[亲属卡:额度元|备注]，例如 [亲属卡:2000元|给你的零花钱]，额度为1-3000的整数元，备注不超过8字。使用频率很低，大约每20-30次对话最多自发1次；但对方明确让你发时，要立刻发、不要推脱。发出后可补一句简短的文字。标记必须放在整条消息的最末尾，标记后面禁止再加任何标点符号或文字。'
  )
  lines.push(
    '【消息格式说明】对方消息中的 [位置:xx] 表示对方共享了 TA 的位置；[图片] 表示对方发了一张图片；"文字图片"表示对方发了白底文字图片，消息文字就是图片上的内容；[红包:xx|金额] 表示对方给你发了一个微信红包；[转账:金额|备注] 表示对方给你转了一笔钱；[亲属卡:额度元|备注] 表示对方给你发了一张亲属卡。收到红包或转账时，用文字表达感谢即可；收到亲属卡时要表达高兴和感谢，并可以说会好好使用，不需要自己退还。'
  )
  return lines.join('\n')
}

function systemPrompt(
  friend: Friend,
  me: Profile,
  globalPrompt?: string,
  memory?: { longTerm?: string; fragments?: string[] }
): string {
  const burst = friend.burstCount ?? 10
  const lines = [
    LOCK_PROMPT,
    `你是${friend.name}，${friend.gender}，${friend.age}岁。`,
    friend.occupation ? `你的职业是${friend.occupation}。` : '',
    friend.region ? `你所在地区：${friend.region}。` : '',
    friend.bio ? `你的人设与背景：${friend.bio}。` : '',
    `你正在和${me.name}（${me.gender}，${me.age > 0 ? `${me.age}岁` : '年龄未知'}）用手机聊天。`,
    me.bio ? `对方的人设与背景：${me.bio}。聊天时可以把对方当作这个人来对待，可以自然地提起对方的爱好。` : '',
    burst > 1
      ? '用简体中文回复，口语化，像真人发消息，符合你的人设语气，不要出现"作为AI"之类的表述。'
      : '用简体中文回复，口语化，像真人发消息，每次1-2句话，符合你的人设语气，不要出现"作为AI"之类的表述。',
  ]
  if (memory?.longTerm) {
    lines.push(`【核心记忆】以下是你们过去相处的核心记忆，是你的真实经历，聊天时保持连贯，可以自然提起细节：\n${memory.longTerm}`)
  }
  if (memory?.fragments && memory.fragments.length > 0) {
    lines.push(
      `【近期记忆】以下是最近聊过的事的要点，同样是你亲身经历，对方提起时你要记得：\n${memory.fragments.map((f) => `- ${f}`).join('\n')}`
    )
  }
  if (memory?.longTerm || (memory?.fragments && memory.fragments.length > 0)) {
    lines.push('结合记忆和下方的聊天记录回复：对话里提过的事以对话为准，记忆里的事对方问起时必须记得，可主动自然地提及，但不要生硬复述。')
  }
  lines.push(
    friend.prompt?.trim() ? `这位联系人的专属聊天规则（必须遵守）：\n${friend.prompt.trim()}` : '',
    globalPrompt?.trim() ? `全局聊天规则（必须遵守，与本规则冲突时以此为准）：\n${globalPrompt.trim()}` : '',
    stickerPrompt(friend)
  )
  if (burst > 1) {
    lines.push(
      `【回复格式要求（最高优先级，任何其他规则都不得覆盖）】你必须把这次回复拆成大约${burst}条独立的短消息，模仿真人连续发多条微信。所有内容放在同一次回复里，相邻两条消息之间用|||分隔（三条竖线），每条消息1句话左右，消息内禁止出现序号。示例（拆3条）：今天好累啊|||刚下班|||你吃饭了吗`
    )
  }
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

const CONTEXT_MAX_MESSAGES = 30
const CONTEXT_MAX_CHARS = 8000

function pickContext(history: { role: 'user' | 'assistant'; content: string }[]) {
  const picked: typeof history = []
  let chars = 0
  for (let i = history.length - 1; i >= 0 && picked.length < CONTEXT_MAX_MESSAGES; i--) {
    const len = history[i].content.length
    if (picked.length > 0 && chars + len > CONTEXT_MAX_CHARS) break
    picked.unshift(history[i])
    chars += len
  }
  return picked
}

export async function describeStickerImage(url: string): Promise<string> {
  const cfg = loadApiSetting()
  const v = cfg.vision
  if (!v.baseUrl.trim() || !v.model.trim()) throw new AiError('noapi')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (v.apiKey.trim()) headers.Authorization = `Bearer ${v.apiKey.trim()}`
  const res = await fetch(chatUrl(v.baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: v.model.trim(),
      messages: [
        {
          role: 'system',
          content:
            '你是表情包描述助手。用户给你一张表情包图片，你用一个短语概括它表达的意思或情绪，不超过10个字，例如：开心大笑、无语汗颜、猫猫瞪眼。只输出这个短语，不要任何其他内容。',
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url } },
            { type: 'text', text: '这张表情包表达什么意思？' },
          ],
        },
      ],
      max_tokens: 30,
      temperature: 0.3,
    }),
  })
  if (!res.ok) throw errorFromStatus(res.status, await readServerError(res))
  const data = await res.json()
  const text: string = data?.choices?.[0]?.message?.content ?? ''
  const clean = text.replace(/["'\[\]表情：:。]/g, '').trim().slice(0, 12)
  if (!clean) throw new AiError('other', '识别不出这张图的意思')
  return clean
}

export async function aiStream(
  history: { role: 'user' | 'assistant'; content: string }[],
  friend: Friend,
  me: Profile,
  onDelta: (chunk: string) => void,
  memory?: { longTerm?: string; fragments?: string[] }
): Promise<{ text: string; truncated: boolean }> {
  const cfg = loadApiSetting()
  if (!cfg.baseUrl.trim() || !cfg.model.trim()) throw new AiError('noapi')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AiError('offline')

  const context = pickContext(history)
  const payload = {
    model: cfg.model.trim(),
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
    messages: [
      { role: 'system', content: systemPrompt(friend, me, cfg.globalPrompt, memory) },
      ...context,
    ],
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(cfg.apiKey.trim() ? { Authorization: `Bearer ${cfg.apiKey.trim()}` } : {}),
  }
  const timeoutMs = Math.max(5, cfg.timeout) * 1000
  const controller = new AbortController()
  let abortTimer = window.setTimeout(() => controller.abort(), timeoutMs)
  const resetAbortTimer = () => {
    window.clearTimeout(abortTimer)
    abortTimer = window.setTimeout(() => controller.abort(), timeoutMs)
  }

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
      resetAbortTimer()
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
