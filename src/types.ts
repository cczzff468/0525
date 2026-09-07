export interface Friend {
  id: string
  name: string
  gender: string
  age: number
  bio: string
  avatar: string
  wechatId: string
  region: string
  occupation: string
  pinned?: boolean
  muted?: boolean
  remark?: string
  autoTranslate?: boolean
  translateSrc?: string
  translateLang?: string
  burstCount?: number
  avatarStyle?: 'group' | 'show' | 'none'
  timeStyle?: 'off' | 'avatar' | 'bubble'
  timeFormat?: 'hm' | 'hms'
  readStyle?: 'off' | 'avatar' | 'bubble'
  stickerEnabled?: boolean
  queuedSend?: boolean
  prompt?: string
  createdAt: number
  lastMessage?: string
  lastTime?: number
}

export interface RelativeCard {
  id: string
  friendId: string
  friendName: string
  monthlyLimit: number
  used: number
  direction: 'given' | 'received'
  status?: 'pending' | 'claimed' | 'rejected'
  claimedAt?: number
  rejectedAt?: number
  createdAt: number
}

export interface BankCard {
  id: string
  bankName: string
  cardTail: string
  holder: string
  phone: string
  cardType: string
  available: number
  createdAt: number
}

export interface WalletState {
  balance: number
  changeFund: number
  fundYield: number
  lastYieldDate: string
  relativeCards: RelativeCard[]
  bankCards: BankCard[]
  /** 6 位支付密码，未设置/关闭时不存 */
  payPassword?: string
}

export type BillKind = '充值' | '提现' | '红包' | '转账' | '亲属卡' | '零钱通' | '收益' | '收付款'

export interface Bill {
  id: string
  kind: BillKind
  title: string
  amount: number
  time: number
  status: string
  friendName?: string
  note?: string
}

export interface RedPacketInfo {
  amount: number
  blessing: string
  status: '待领取' | '已领取' | '已退还'
  openedBy?: string
  openedAt?: number
}

export interface TransferInfo {
  amount: number
  note: string
  status: '待收款' | '已收款' | '已退还'
  confirmedAt?: number
}

export interface Sticker {
  id: string
  meaning: string
  url: string
  createdAt: number
}

export interface ChatBg {
  type: 'color' | 'image'
  value: string
}

export interface Message {
  id: string
  friendId: string
  from: 'me' | 'friend'
  text: string
  time: number
  quote?: string
  sticker?: { meaning: string; url?: string; emoji?: string }
  location?: { name: string; address?: string }
  redpacket?: RedPacketInfo
  transfer?: TransferInfo
  relativeCard?: { cardId: string; status: '待领取' | '已领取' | '已退还' }
  receipt?: { kind: 'redpacket' | 'transfer' | 'rc'; amount: number; srcMsgId: string; cardId?: string }
}

export interface LocationItem {
  id: string
  name: string
  address: string
}

export interface Profile {
  name: string
  avatar: string
  gender: string
  age: number
  bio: string
  wechatId: string
  region: string
}

export interface Persona {
  id: string
  name: string
  avatar: string
  gender: string
  age: number
  bio: string
  wechatId: string
  region: string
}

export interface MomentComment {
  id: string
  name: string
  text: string
  replyTo?: string
}

export interface MomentsPost {
  id: string
  authorId: string
  text: string
  images: string[]
  time: number
  likes: string[]
  comments: MomentComment[]
}

export interface ApiPreset {
  id: string
  name: string
  baseUrl: string
  model: string
  apiKey?: string
}

export interface VisionPreset {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  model: string
}

export interface VoiceConfig {
  id: string
  name: string
  enabled: boolean
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  voice: string
  speed: number
  pitch: number
  speakLang: string
}

export interface VisionSetting {
  enabled: boolean
  baseUrl: string
  apiKey: string
  model: string
  presets: VisionPreset[]
  activePresetId?: string
}

export interface VoiceSetting {
  sttEnabled: boolean
  sttLang: string
  configs: VoiceConfig[]
  selectedId: string
}

export interface MemoryFragment {
  id: string
  friendId: string
  content: string
  msgCount: number
  createdAt: number
  source: 'auto' | 'manual'
}

export interface LongTermMemory {
  id: string
  friendId: string
  content: string
  createdAt: number
  source: 'auto' | 'manual'
  baseFragmentIds: string[]
}

export interface MemorySetting {
  fragmentEvery: number
  longTermEvery: number
}

export interface MemoryError {
  message: string
  time: number
}

export interface MemoryData {
  fragments: MemoryFragment[]
  longTerm: LongTermMemory[]
  settings: MemorySetting
  lastMsgId: Record<string, string>
  lastError?: Record<string, MemoryError>
}

export interface ApiSetting {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  timeout: number
  models: string[]
  presets: ApiPreset[]
  myPreset?: ApiPreset | null
  vision: VisionSetting
  voice: VoiceSetting
  globalPrompt?: string
}
