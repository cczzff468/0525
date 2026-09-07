import type { ApiSetting, Bill, ChatBg, Friend, LocationItem, MemoryData, MemorySetting, Message, MomentsPost, Persona, Profile, Sticker, VoiceConfig, WalletState } from './types'

const FRIENDS_KEY = 'im.friends'
const MSGS_KEY = 'im.messages'
const PROFILE_KEY = 'im.profile'
const MOMENTS_KEY = 'im.moments'
const COVER_KEY = 'im.cover'
const UI_KEY = 'im.ui'
const API_KEY_STORE = 'im.api'
const PERSONAS_KEY = 'im.personas'
const ACTIVE_PERSONA_KEY = 'im.activePersona'
const MEMORY_KEY = 'im.memory'
const CHATBG_KEY = 'im.chatbg'
const STICKERS_KEY = 'im.stickers'
const LOCATIONS_KEY = 'im.locations'
const WALLET_KEY = 'im.wallet'
const BILLS_KEY = 'im.bills'

const ALL_KEYS = [FRIENDS_KEY, MSGS_KEY, PROFILE_KEY, MOMENTS_KEY, COVER_KEY, UI_KEY, API_KEY_STORE, PERSONAS_KEY, ACTIVE_PERSONA_KEY, MEMORY_KEY, CHATBG_KEY, STICKERS_KEY, LOCATIONS_KEY, WALLET_KEY, BILLS_KEY]
const DB_NAME = 'ios-im'
const STORE_NAME = 'kv'

const memory = new Map<string, unknown>()
let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

export async function hydrate(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    await Promise.all(
      ALL_KEYS.map(
        (key) =>
          new Promise<void>((resolve) => {
            const req = store.get(key)
            req.onsuccess = () => {
              if (req.result !== undefined) memory.set(key, req.result)
              resolve()
            }
            req.onerror = () => resolve()
          })
      )
    )
  } catch {
    /* IndexedDB unavailable, fall through to localStorage */
  }
  for (const key of ALL_KEYS) {
    if (!memory.has(key)) {
      try {
        const raw = localStorage.getItem(key)
        if (raw) memory.set(key, JSON.parse(raw))
      } catch {
        /* ignore malformed legacy data */
      }
    }
  }
}

const AVATAR_COLORS = ['#5ac8fa', '#ff9500', '#ff2d55', '#af52de', '#34c759', '#007aff', '#ff6b22', '#00c7be']

export function letterAvatar(name: string): string {
  const letter = name.trim().charAt(0).toUpperCase() || '?'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="${color}"/><text x="60" y="64" font-size="54" fill="#ffffff" text-anchor="middle" dominant-baseline="central" font-family="-apple-system,'PingFang SC',sans-serif">${letter}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export function scenerySvg(kind: number): string {
  const bodies: Record<number, string> = {
    0: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3f4"/><stop offset="1" stop-color="#1e6fba"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><circle cx="310" cy="70" r="34" fill="#fff3b0" opacity="0.9"/><path d="M0 220 Q100 190 200 215 T400 210 V300 H0 Z" fill="#2a7fc9" opacity="0.85"/><path d="M0 245 Q120 220 240 240 T400 235 V300 H0 Z" fill="#1b5e9e"/><path d="M0 270 Q150 255 400 265 V300 H0 Z" fill="#123f6d"/>`,
    1: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbc2eb"/><stop offset="1" stop-color="#a6c1ee"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><path d="M0 300 L120 120 L210 300 Z" fill="#7d9cc0"/><path d="M150 300 L280 90 L400 300 Z" fill="#5f7fa8"/><circle cx="70" cy="60" r="26" fill="#fff" opacity="0.85"/>`,
    2: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f2027"/><stop offset="1" stop-color="#2c5364"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><circle cx="330" cy="60" r="24" fill="#f5f3ce"/><rect x="40" y="150" width="50" height="150" fill="#16303c"/><rect x="110" y="110" width="60" height="190" fill="#1b3a47"/><rect x="190" y="170" width="46" height="130" fill="#16303c"/><rect x="250" y="130" width="58" height="170" fill="#1b3a47"/><rect x="320" y="180" width="42" height="120" fill="#16303c"/><g fill="#ffd97d" opacity="0.9"><rect x="122" y="125" width="8" height="8"/><rect x="140" y="145" width="8" height="8"/><rect x="262" y="150" width="8" height="8"/><rect x="284" y="170" width="8" height="8"/><rect x="52" y="165" width="8" height="8"/><rect x="200" y="185" width="8" height="8"/></g>`,
    3: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d365"/><stop offset="1" stop-color="#fda085"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><circle cx="200" cy="210" r="60" fill="#fff" opacity="0.35"/><circle cx="200" cy="210" r="34" fill="#fff7e0"/><path d="M0 260 Q100 245 200 258 T400 252 V300 H0 Z" fill="#c96f4a" opacity="0.7"/>`,
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">${bodies[kind % 4]}</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export function coverSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a7bd5"/><stop offset="0.55" stop-color="#6fa8dc"/><stop offset="1" stop-color="#d9c38a"/></linearGradient></defs><rect width="800" height="450" fill="url(#sky)"/><circle cx="620" cy="150" r="46" fill="#fff4c9"/><path d="M0 320 L160 190 L300 320 Z" fill="#5b7ea6"/><path d="M220 320 L420 150 L640 320 Z" fill="#48688c"/><path d="M560 320 L720 210 L860 320 Z" fill="#3d5a7a"/><rect y="320" width="800" height="130" fill="#2f4a66"/><path d="M0 330 Q200 318 400 328 T800 326 V450 H0 Z" fill="#243c55"/></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

function read<T>(key: string, fallback: T): T {
  return memory.has(key) ? (memory.get(key) as T) : fallback
}

function write(key: string, value: unknown) {
  memory.set(key, value)
  openDB()
    .then((db) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(value, key)
    })
    .catch(() => {
      /* keep memory only if IndexedDB write fails */
    })
}

export function loadFriends(): Friend[] {
  return read<Friend[]>(FRIENDS_KEY, [])
}

export function saveFriends(friends: Friend[]) {
  write(FRIENDS_KEY, friends)
}

export function loadMessages(): Message[] {
  return read<Message[]>(MSGS_KEY, [])
}

export function saveMessages(messages: Message[]) {
  write(MSGS_KEY, messages)
}

export function appendMessage(msg: Message) {
  const all = read<Message[]>(MSGS_KEY, [])
  all.push(msg)
  write(MSGS_KEY, all)
  const friends = read<Friend[]>(FRIENDS_KEY, [])
  const f = friends.find((x) => x.id === msg.friendId)
  if (f) {
    f.lastMessage = msg.redpacket ? '[微信红包]' : msg.transfer ? '[转账]' : msg.relativeCard ? '[亲属卡]' : msg.receipt ? '[凭证]' : msg.sticker ? '[表情]' : msg.location ? '[位置]' : msg.text
    f.lastTime = msg.time
    write(FRIENDS_KEY, friends)
  }
}

export function patchFriendMsg(friendId: string, msgId: string, patch: Partial<Message>): Message | null {
  const all = read<Message[]>(MSGS_KEY, [])
  const msg = all.find((m) => m.id === msgId && m.friendId === friendId)
  if (!msg) return null
  Object.assign(msg, patch)
  write(MSGS_KEY, all)
  return msg
}

export function saveProfile(profile: Profile) {
  write(PROFILE_KEY, profile)
}

export function loadMoments(): MomentsPost[] {
  const posts = read<MomentsPost[]>(MOMENTS_KEY, [])
  let changed = false
  for (const p of posts) {
    for (const c of p.comments) {
      if (!c.replyTo) {
        const m = /^回复(.{1,20}?)：([\s\S]+)$/.exec(c.text)
        if (m) {
          c.replyTo = m[1]
          c.text = m[2]
          changed = true
        }
      }
    }
  }
  if (changed) write(MOMENTS_KEY, posts)
  return posts
}

export function saveMoments(posts: MomentsPost[]) {
  write(MOMENTS_KEY, posts)
}

export function loadCover(): string {
  return read<string>(COVER_KEY, '')
}

export function saveCover(cover: string) {
  write(COVER_KEY, cover)
}

export const DEFAULT_VOICE_CONFIGS: VoiceConfig[] = [
  {
    id: 'vc-minimax',
    name: 'Minimax 语音',
    enabled: true,
    provider: 'Minimax 国内版',
    baseUrl: 'https://api.minimax.chat/v1/t2a_v2',
    apiKey: '',
    model: 'speech-2.8-turbo',
    voice: 'male-qn-qingse',
    speed: 1,
    pitch: 0,
    speakLang: '',
  },
  {
    id: 'vc-openai',
    name: 'OpenAI TTS',
    enabled: true,
    provider: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/audio/speech',
    apiKey: '',
    model: 'tts-1',
    voice: 'nova',
    speed: 1,
    pitch: 0,
    speakLang: '',
  },
  {
    id: 'vc-edge',
    name: 'Edge 免费语音',
    enabled: false,
    provider: '本地免费 (Edge TTS)',
    baseUrl: '',
    apiKey: '',
    model: '',
    voice: 'Xiaoxiao',
    speed: 1,
    pitch: 0,
    speakLang: '',
  },
]

export function loadApiSetting(): ApiSetting {
  const s = read<Partial<ApiSetting>>(API_KEY_STORE, {})
  const v = (s.vision ?? {}) as Partial<ApiSetting['vision']>
  const voice = (s.voice ?? {}) as Partial<ApiSetting['voice']>
  return {
    baseUrl: s.baseUrl || 'https://api.openai.com/v1/chat/completions',
    apiKey: s.apiKey || '',
    model: s.model || 'gpt-4o-mini',
    temperature: typeof s.temperature === 'number' ? s.temperature : 0.7,
    maxTokens: typeof s.maxTokens === 'number' ? s.maxTokens : 2048,
    timeout: typeof s.timeout === 'number' && s.timeout > 0 ? s.timeout : 60,
    models: Array.isArray(s.models) ? s.models : [],
    presets: Array.isArray(s.presets) ? s.presets : [],
    myPreset: s.myPreset ?? null,
    vision: {
      enabled: v.enabled === true,
      baseUrl: v.baseUrl || 'https://api.openai.com/v1/chat/completions',
      apiKey: v.apiKey || '',
      model: v.model || 'gpt-4o',
      presets: Array.isArray(v.presets) ? v.presets : [],
      activePresetId: v.activePresetId ?? '',
    },
    voice: {
      sttEnabled: voice.sttEnabled === true,
      sttLang: voice.sttLang || 'zh-CN',
      configs: Array.isArray(voice.configs) && voice.configs.length > 0 ? voice.configs : DEFAULT_VOICE_CONFIGS,
      selectedId: voice.selectedId || (voice as any).defaultId || 'vc-minimax',
    },
    globalPrompt: s.globalPrompt || '',
  }
}

export function saveApiSetting(setting: ApiSetting) {
  write(API_KEY_STORE, setting)
}

export function loadMemoryData(): MemoryData {
  const d = read<Partial<MemoryData>>(MEMORY_KEY, {})
  const s = (d.settings ?? {}) as Partial<MemorySetting>
  return {
    fragments: Array.isArray(d.fragments) ? d.fragments : [],
    longTerm: Array.isArray(d.longTerm) ? d.longTerm : [],
    settings: {
      fragmentEvery: [10, 20, 30, 40, 50].includes(s.fragmentEvery as number) ? (s.fragmentEvery as number) : 20,
      longTermEvery: [3, 5, 7, 10].includes(s.longTermEvery as number) ? (s.longTermEvery as number) : 5,
    },
    lastMsgId: d.lastMsgId ?? {},
    lastError: d.lastError ?? {},
  }
}

export function saveMemoryData(d: MemoryData) {
  write(MEMORY_KEY, d)
}

export function loadPersonas(): Persona[] {
  return read<Persona[]>(PERSONAS_KEY, [])
}

export function savePersonas(list: Persona[]) {
  write(PERSONAS_KEY, list)
}

export function loadActivePersonaId(): string {
  return read<string>(ACTIVE_PERSONA_KEY, '')
}

export function saveActivePersonaId(id: string) {
  write(ACTIVE_PERSONA_KEY, id)
}

export function loadChatBgs(): Record<string, ChatBg> {
  return read<Record<string, ChatBg>>(CHATBG_KEY, {})
}

export function saveChatBg(friendId: string, bg: ChatBg | null) {
  const cur = loadChatBgs()
  if (bg) cur[friendId] = bg
  else delete cur[friendId]
  write(CHATBG_KEY, cur)
}

export function loadStickers(): Sticker[] {
  return read<Sticker[]>(STICKERS_KEY, [])
}

export function saveStickers(list: Sticker[]) {
  write(STICKERS_KEY, list)
}

export function loadLocations(): LocationItem[] {
  return read(LOCATIONS_KEY, [])
}

export function saveLocations(list: LocationItem[]) {
  write(LOCATIONS_KEY, list)
}

const DEFAULT_WALLET: WalletState = {
  balance: 666.66,
  changeFund: 1288.0,
  fundYield: 36.42,
  lastYieldDate: '',
  relativeCards: [],
  bankCards: [
    {
      id: 'card-seed-cmb',
      bankName: '招商银行',
      cardTail: '1234',
      holder: '',
      phone: '',
      cardType: '储蓄卡',
      available: 50000,
      createdAt: Date.now(),
    },
  ],
}

export function loadWallet(): WalletState {
  const raw = read<Partial<WalletState>>(WALLET_KEY, {})
  const bankCards = (Array.isArray(raw.bankCards) ? raw.bankCards : []).map((c) => ({ ...c, available: typeof c.available === 'number' ? c.available : 0 }))
  return { ...DEFAULT_WALLET, ...raw, bankCards }
}

export function saveWallet(w: WalletState) {
  write(WALLET_KEY, w)
}

export function updateWallet(fn: (w: WalletState) => WalletState): WalletState {
  const next = fn(loadWallet())
  saveWallet(next)
  return next
}

/** 设置或关闭支付密码：传 6 位密码为开启/修改，传 null 为关闭 */
export function setPayPassword(p: string | null) {
  updateWallet((w) => ({ ...w, ...(p ? { payPassword: p } : { payPassword: undefined }) }))
}

export function loadBills(): Bill[] {
  return read(BILLS_KEY, [])
}

export function saveBills(list: Bill[]) {
  write(BILLS_KEY, list)
}

export function addBill(b: Omit<Bill, 'id' | 'time'> & { time?: number }): Bill {
  const bill: Bill = { ...b, id: uid(), time: b.time ?? Date.now() }
  saveBills([bill, ...loadBills()])
  return bill
}

const FUND_RATE = 0.01986

export function settleDailyYield(): boolean {
  const w = loadWallet()
  const today = new Date().toDateString()
  if (w.lastYieldDate === today || w.changeFund < 1) return false
  const yieldAmt = Math.round(((w.changeFund * FUND_RATE) / 365) * 100) / 100
  updateWallet((x) => ({
    ...x,
    changeFund: Math.round((x.changeFund + yieldAmt) * 100) / 100,
    fundYield: Math.round((x.fundYield + yieldAmt) * 100) / 100,
    lastYieldDate: today,
  }))
  if (yieldAmt >= 0.01) {
    addBill({ kind: '收益', title: '零钱通收益', amount: yieldAmt, status: '已到账', note: '七日年化收益率 1.9860%' })
    return true
  }
  return false
}

function personaToProfile(p: Persona): Profile {
  return { name: p.name, avatar: p.avatar, gender: p.gender, age: p.age, bio: p.bio, wechatId: p.wechatId, region: p.region }
}

export function loadProfile(): Profile {
  const personas = loadPersonas()
  if (personas.length > 0) {
    const activeId = loadActivePersonaId()
    const p = personas.find((x) => x.id === activeId) ?? personas[0]
    return personaToProfile(p)
  }
  const legacy = read<Partial<Profile>>(PROFILE_KEY, {})
  return {
    name: legacy.name || '我',
    avatar: legacy.avatar || '',
    gender: legacy.gender || '保密',
    age: typeof legacy.age === 'number' && legacy.age > 0 ? legacy.age : 0,
    bio: legacy.bio || '',
    wechatId: legacy.wechatId || 'ios_demo',
    region: legacy.region || '广东 深圳',
  }
}

export function loadUiState<T>(fallback: T): T {
  return read<T>(UI_KEY, fallback)
}

export function saveUiState(state: unknown) {
  write(UI_KEY, state)
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

const SEED_FRIENDS: Friend[] = [
  {
    id: 'seed-1',
    name: '林小夏',
    gender: '女',
    age: 22,
    bio: '元气满满的插画师，喜欢猫、手冲咖啡和海边。聊天时表情丰富，说话自带感叹号。',
    avatar: '',
    wechatId: 'xiaoxia_art',
    region: '上海 静安',
    occupation: '插画师',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'seed-2',
    name: '陈默',
    gender: '男',
    age: 28,
    bio: '后端程序员，话不多但句句靠谱。擅长聊科技、数码和电影，偶尔讲冷笑话。',
    avatar: '',
    wechatId: 'chenmo_dev',
    region: '广东 深圳',
    occupation: '程序员',
    createdAt: Date.now() - 86400000 * 60,
  },
  {
    id: 'seed-3',
    name: '苏晴',
    gender: '女',
    age: 26,
    bio: '旅行博主，一年飞十几次。朋友圈都是风景照，聊天喜欢分享路上的见闻。',
    avatar: '',
    wechatId: 'suqing_trip',
    region: '云南 大理',
    occupation: '旅行博主',
    createdAt: Date.now() - 86400000 * 90,
  },
]

const SEED_MESSAGES: Message[] = [
  { id: 'm1', friendId: 'seed-1', from: 'friend', text: '早呀！今天画了一张海边的图，想给你看看～', time: Date.now() - 3600000 * 5 },
  { id: 'm2', friendId: 'seed-1', from: 'me', text: '好看！发来欣赏一下', time: Date.now() - 3600000 * 5 + 60000 },
  { id: 'm3', friendId: 'seed-1', from: 'friend', text: '发你邮箱啦，记得回我颜色感觉如何 😺', time: Date.now() - 3600000 * 4 },
  { id: 'm4', friendId: 'seed-2', from: 'me', text: '今晚一起打球吗？', time: Date.now() - 3600000 * 20 },
  { id: 'm5', friendId: 'seed-2', from: 'friend', text: '可以，七点半老地方。', time: Date.now() - 3600000 * 20 + 120000 },
  { id: 'm6', friendId: 'seed-3', from: 'friend', text: '我刚到大理，这里的天空蓝得不像话！', time: Date.now() - 86400000 },
]

const SEED_MOMENTS: MomentsPost[] = [
  {
    id: 'pm1',
    authorId: 'seed-3',
    text: '大理的风比想象中温柔，在洱海边发呆了一下午。',
    images: [scenerySvg(0), scenerySvg(1), scenerySvg(3)],
    time: Date.now() - 3600000 * 3,
    likes: ['林小夏', '陈默'],
    comments: [
      { id: 'c1', name: '林小夏', text: '滤镜都不用调吧！带我带我去！' },
      { id: 'c2', name: '苏晴', replyTo: '林小夏', text: '下一站一起呀' },
    ],
  },
  {
    id: 'pm2',
    authorId: 'seed-1',
    text: '新画的海边系列终于完工啦，蓝色果然是治愈色。',
    images: [scenerySvg(0), scenerySvg(3)],
    time: Date.now() - 3600000 * 26,
    likes: ['苏晴'],
    comments: [{ id: 'c3', name: '陈默', text: '配色舒服，给我也留一张原图。' }],
  },
  {
    id: 'pm3',
    authorId: 'seed-2',
    text: '凌晨两点的服务器日志，比咖啡还提神。',
    images: [scenerySvg(2)],
    time: Date.now() - 86400000 * 2,
    likes: [],
    comments: [],
  },
]

export function seedIfEmpty() {
  if (loadFriends().length === 0) {
    saveFriends(SEED_FRIENDS)
    saveMessages(SEED_MESSAGES)
  }
  if (loadMoments().length === 0) {
    saveMoments(SEED_MOMENTS)
  }
  if (loadPersonas().length === 0) {
    const legacy = read<Partial<Profile>>(PROFILE_KEY, {})
    if ((legacy.name && legacy.name !== '我') || legacy.bio) {
      const persona: Persona = {
        id: uid(),
        name: legacy.name || '我',
        avatar: legacy.avatar || '',
        gender: legacy.gender || '保密',
        age: typeof legacy.age === 'number' && legacy.age > 0 ? legacy.age : 0,
        bio: legacy.bio || '',
        wechatId: legacy.wechatId || 'ios_demo',
        region: legacy.region || '广东 深圳',
      }
      savePersonas([persona])
      saveActivePersonaId(persona.id)
    }
  }
  const api = read<Partial<ApiSetting>>(API_KEY_STORE, {})
  if (api.myPreset && (!Array.isArray(api.presets) || api.presets.length === 0)) {
    saveApiSetting({
      ...loadApiSetting(),
      presets: [
        {
          id: uid(),
          name: api.myPreset.name || '我的预设',
          baseUrl: api.myPreset.baseUrl,
          model: api.myPreset.model,
          apiKey: api.myPreset.apiKey,
        },
      ],
    })
  }
}
