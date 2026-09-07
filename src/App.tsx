import { useEffect, useState } from 'react'
import Messages from './pages/Messages'
import Contacts from './pages/Contacts'
import Discover from './pages/Discover'
import Me from './pages/Me'
import AddFriend from './pages/AddFriend'
import AddPersona from './pages/AddPersona'
import Chat from './pages/Chat'
import FriendDetail from './pages/FriendDetail'
import Moments from './pages/Moments'
import MyProfile from './pages/MyProfile'
import Settings from './pages/Settings'
import ApiSettingPage from './pages/ApiSettingPage'
import VisionApiPage from './pages/VisionApiPage'
import VoiceApiPage from './pages/VoiceApiPage'
import { ChatIcon, ContactsIcon, DiscoverIcon, MeIcon } from './components/icons'
import { loadFriends, loadMessages, loadUiState, saveFriends, saveMessages, saveUiState } from './store'
import type { Friend, Message } from './types'

type Tab = 'messages' | 'contacts' | 'discover' | 'me'
type View =
  | { name: 'tabs' }
  | { name: 'addFriend'; friendId?: string }
  | { name: 'chat'; friendId: string }
  | { name: 'friendDetail'; friendId: string }
  | { name: 'moments' }
  | { name: 'myProfile' }
  | { name: 'addPersona'; personaId?: string }
  | { name: 'settings' }
  | { name: 'apiSetting' }
  | { name: 'visionApi' }
  | { name: 'voiceApi' }

const TABS: { key: Tab; label: string; icon: (active: boolean) => JSX.Element }[] = [
  { key: 'messages', label: '信息', icon: (a) => <ChatIcon active={a} /> },
  { key: 'contacts', label: '联系人', icon: (a) => <ContactsIcon active={a} /> },
  { key: 'discover', label: '发现', icon: (a) => <DiscoverIcon active={a} /> },
  { key: 'me', label: '我', icon: (a) => <MeIcon active={a} /> },
]

function initialState(): { tab: Tab; view: View } {
  const saved = loadUiState<{ tab?: Tab; view?: View }>({})
  const tab: Tab = TABS.some((t) => t.key === saved.tab) ? (saved.tab as Tab) : 'messages'
  const savedView = saved.view as View | undefined
  let view: View = { name: 'tabs' }
  if (savedView && typeof savedView.name === 'string') {
    if (savedView.name === 'chat') {
      view = loadFriends().some((f) => f.id === savedView.friendId) ? savedView : { name: 'tabs' }
    } else if (['moments', 'myProfile', 'settings', 'apiSetting', 'visionApi', 'voiceApi'].includes(savedView.name)) {
      view = savedView
    }
  }
  return { tab, view }
}

export default function App() {
  const [init] = useState(initialState)
  const [friends, setFriends] = useState<Friend[]>(() => loadFriends())
  const [messages, setMessages] = useState<Message[]>(() => loadMessages())
  const [tab, setTab] = useState<Tab>(init.tab)
  const [view, setView] = useState<View>(init.view)

  useEffect(() => {
    saveUiState({ tab, view })
  }, [tab, view])

  const refreshData = () => {
    setFriends(loadFriends())
    setMessages(loadMessages())
  }

  const openChat = (friendId: string) => {
    if (!friendId) return
    setView({ name: 'chat', friendId })
  }

  const backToTabs = () => {
    refreshData()
    setView({ name: 'tabs' })
  }

  const onFriendCreated = (friendId: string) => {
    refreshData()
    if (view.name === 'addFriend' && view.friendId) {
      setView({ name: 'chat', friendId: view.friendId })
    } else {
      setView({ name: 'chat', friendId })
    }
  }

  let content: JSX.Element
  if (view.name === 'addFriend') {
    content = <AddFriend onBack={backToTabs} onCreated={onFriendCreated} friendId={view.friendId} />
  } else if (view.name === 'chat') {
    const friend = friends.find((f) => f.id === view.friendId)
    content = friend ? (
      <Chat
        key={friend.id}
        friend={friend}
        onBack={backToTabs}
        onEditFriend={() => setView({ name: 'addFriend', friendId: view.friendId })}
        onOpenSettings={() => setView({ name: 'apiSetting' })}
      />
    ) : (
      <div className="page">
        <div className="empty-hint">好友不存在</div>
      </div>
    )
  } else if (view.name === 'friendDetail') {
    const friend = friends.find((f) => f.id === view.friendId)
    content = friend ? (
      <FriendDetail
        friend={friend}
        onBack={backToTabs}
        onOpenChat={() => openChat(view.friendId)}
        onEdit={() => setView({ name: 'addFriend', friendId: view.friendId })}
        onDelete={() => {
          saveFriends(loadFriends().filter((f) => f.id !== view.friendId))
          saveMessages(loadMessages().filter((m) => m.friendId !== view.friendId))
          refreshData()
          setView({ name: 'tabs' })
        }}
      />
    ) : (
      <div className="page">
        <div className="empty-hint">好友不存在</div>
      </div>
    )
  } else if (view.name === 'moments') {
    content = <Moments onBack={backToTabs} />
  } else if (view.name === 'myProfile') {
    content = <MyProfile onBack={backToTabs} onEditPersona={(personaId) => setView({ name: 'addPersona', personaId })} onOpenMoments={() => setView({ name: 'moments' })} />
  } else if (view.name === 'addPersona') {
    content = <AddPersona onBack={() => setView({ name: 'myProfile' })} personaId={view.personaId} />
  } else if (view.name === 'settings') {
    content = (
      <Settings
        onBack={backToTabs}
        onOpenApi={() => setView({ name: 'apiSetting' })}
        onOpenVision={() => setView({ name: 'visionApi' })}
        onOpenVoice={() => setView({ name: 'voiceApi' })}
      />
    )
  } else if (view.name === 'apiSetting') {
    content = <ApiSettingPage onBack={() => setView({ name: 'settings' })} />
  } else if (view.name === 'visionApi') {
    content = <VisionApiPage onBack={() => setView({ name: 'settings' })} />
  } else if (view.name === 'voiceApi') {
    content = <VoiceApiPage onBack={() => setView({ name: 'settings' })} />
  } else {
    content = (
      <div className="tab-shell">
        <div className="tab-content" key={tab}>
          {tab === 'messages' && (
            <Messages friends={friends} messages={messages} onOpenChat={openChat} onAddFriend={() => setView({ name: 'addFriend' })} onOpenMoments={() => setView({ name: 'moments' })} onRefresh={refreshData} />
          )}
          {tab === 'contacts' && (
            <Contacts
              friends={friends}
              onOpenChat={openChat}
              onOpenFriend={(friendId) => setView({ name: 'friendDetail', friendId })}
              onAddFriend={() => setView({ name: 'addFriend' })}
              onOpenMoments={() => setView({ name: 'moments' })}
            />
          )}
          {tab === 'discover' && <Discover onOpenMoments={() => setView({ name: 'moments' })} />}
          {tab === 'me' && <Me onOpenProfile={() => setView({ name: 'myProfile' })} onOpenSettings={() => setView({ name: 'settings' })} onOpenMoments={() => setView({ name: 'moments' })} />}
        </div>
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.key} className={`tab-item ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.icon(tab === t.key)}
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    )
  }

  return <div className="phone">{content}</div>
}
