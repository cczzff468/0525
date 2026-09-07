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
  createdAt: number
}

export interface Message {
  id: string
  friendId: string
  from: 'me' | 'friend'
  text: string
  time: number
  edited?: boolean
  quote?: string
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

export interface ApiSetting {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  models: string[]
  presets: ApiPreset[]
  myPreset?: ApiPreset | null
}
