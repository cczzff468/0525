import { useRef, useState } from 'react'
import { NavBar } from '../components/common'
import { BackIcon } from '../components/icons'
import { letterAvatar, saveFriends, uid, loadFriends } from '../store'
import type { Friend } from '../types'
import { fileToAvatar } from '../utils/image'

export default function AddFriend({
  onBack,
  onCreated,
  friendId,
}: {
  onBack: () => void
  onCreated: (friendId: string) => void
  friendId?: string
}) {
  const editing = friendId ? loadFriends().find((f) => f.id === friendId) : undefined
  const isEdit = Boolean(editing)
  const [avatar, setAvatar] = useState(editing?.avatar ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [gender, setGender] = useState(editing?.gender ?? '保密')
  const [age, setAge] = useState(editing ? String(editing.age) : '')
  const [wechatId, setWechatId] = useState(editing?.wechatId ?? '')
  const [region, setRegion] = useState(editing?.region ?? '')
  const [occupation, setOccupation] = useState(editing?.occupation ?? '')
  const [bio, setBio] = useState(editing?.bio ?? '')
  const [prompt, setPrompt] = useState(editing?.prompt ?? '')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const genWechatId = (): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let suffix = ''
    for (let i = 0; i < 8; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
    return `wx_${suffix}`
  }

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setAvatar(await fileToAvatar(file))
    } catch {
      setError('图片读取失败，请换一张试试')
    }
  }

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('请填写名字')
      return
    }
    const ageNum = age.trim() === '' ? NaN : Number(age)
    if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
      setError('请填写 1-120 之间的年龄')
      return
    }
    setError('')
    if (editing) {
      const updated: Friend = {
        ...editing,
        name: trimmed,
        gender,
        age: ageNum,
        bio: bio.trim(),
        prompt: prompt.trim(),
        avatar,
        wechatId: wechatId.trim() || editing.wechatId,
        region: region.trim(),
        occupation: occupation.trim(),
      }
      saveFriends(loadFriends().map((f) => (f.id === editing.id ? updated : f)))
      onCreated(editing.id)
      return
    }
    const friend: Friend = {
      id: uid(),
      name: trimmed,
      gender,
      age: ageNum,
      bio: bio.trim(),
      prompt: prompt.trim(),
      avatar,
      wechatId: wechatId.trim() || genWechatId(),
      region: region.trim(),
      occupation: occupation.trim(),
      createdAt: Date.now(),
    }
    saveFriends([...loadFriends(), friend])
    onCreated(friend.id)
  }

  const previewSrc = avatar || letterAvatar(name || '新')

  return (
    <div className="page">
      <NavBar
        title={isEdit ? '编辑好友' : '添加好友'}
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
        right={
          <button className="nav-btn nav-btn-done" onClick={submit}>
            完成
          </button>
        }
      />
      <div className="page-body add-friend">
        <div className="avatar-picker" onClick={() => fileRef.current?.click()}>
          <img className="avatar-picker-img" src={previewSrc} alt="头像" />
          <div className="avatar-picker-hint">点击上传头像</div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          hidden
          onChange={pickFile}
        />

        <div className="list-group">
          <div className="form-row">
            <label className="form-label">头像</label>
            <button className="form-avatar-btn" onClick={() => fileRef.current?.click()}>
              <img className="form-avatar-img" src={previewSrc} alt="头像预览" />
              <span className="form-avatar-text">从相册选择</span>
            </button>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="f-name">名字</label>
            <input
              id="f-name"
              className="form-input"
              type="text"
              placeholder="必填"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-row form-row-col">
            <span className="form-label">性别</span>
            <div className="segment">
              {['男', '女', '保密'].map((g) => (
                <button
                  key={g}
                  className={`segment-item ${gender === g ? 'active' : ''}`}
                  onClick={() => setGender(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="f-age">年龄</label>
            <input
              id="f-age"
              className="form-input form-input-age"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="1-120"
              maxLength={3}
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="f-wechat">微信号</label>
            <input
              id="f-wechat"
              className="form-input"
              type="text"
              placeholder="选填，留空自动生成"
              maxLength={30}
              value={wechatId}
              onChange={(e) => setWechatId(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="f-region">地区</label>
            <input
              id="f-region"
              className="form-input"
              type="text"
              placeholder="如：广东 深圳"
              maxLength={30}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="f-job">职业</label>
            <input
              id="f-job"
              className="form-input"
              type="text"
              placeholder="如：插画师、程序员"
              maxLength={30}
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
            />
          </div>
        </div>

        <div className="list-group">
          <div className="form-row form-row-col">
            <label className="form-label" htmlFor="f-bio">人设与背景</label>
            <textarea
              id="f-bio"
              className="form-textarea"
              placeholder="介绍一下 TA 的性格、爱好、说话风格……"
              maxLength={300}
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <div className="form-row form-row-col">
            <label className="form-label" htmlFor="f-prompt">聊天提示词规则（可选）</label>
            <textarea
              id="f-prompt"
              className="form-textarea"
              placeholder={'给 TA 定制的聊天规则，如：\n· 说话简短，多用语气词\n· 偶尔发一句方言\n· 记住我们上次聊的话题\n· 不主动问我要照片'}
              maxLength={500}
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <span className="form-preview">只对这位好友生效，和 TA 聊天时作为硬性规则发给 AI</span>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <button className="primary-btn" onClick={submit}>
          {isEdit ? '保存修改' : '保存并开始聊天'}
        </button>
      </div>
    </div>
  )
}
