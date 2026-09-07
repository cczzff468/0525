import { useRef, useState } from 'react'
import { NavBar } from '../components/common'
import { BackIcon } from '../components/icons'
import { letterAvatar, loadPersonas, loadActivePersonaId, savePersonas, saveActivePersonaId, uid } from '../store'
import type { Persona } from '../types'
import { fileToAvatar } from '../utils/image'

export default function AddPersona({ onBack, personaId }: { onBack: () => void; personaId?: string }) {
  const editing = personaId ? loadPersonas().find((p) => p.id === personaId) : undefined
  const isEdit = Boolean(editing)
  const [avatar, setAvatar] = useState(editing?.avatar ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [gender, setGender] = useState(editing?.gender ?? '保密')
  const [age, setAge] = useState(editing && editing.age > 0 ? String(editing.age) : '')
  const [wechatId, setWechatId] = useState(editing?.wechatId ?? '')
  const [region, setRegion] = useState(editing?.region ?? '')
  const [bio, setBio] = useState(editing?.bio ?? '')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
    const ageNum = age.trim() === '' ? 0 : Number(age)
    if (age.trim() !== '' && (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120)) {
      setError('请填写 1-120 之间的年龄')
      return
    }
    setError('')
    const persona: Persona = {
      id: editing?.id ?? uid(),
      name: trimmed,
      avatar,
      gender,
      age: ageNum,
      bio: bio.trim(),
      wechatId: wechatId.trim() || 'ios_demo',
      region: region.trim(),
    }
    const list = loadPersonas()
    if (editing) {
      savePersonas(list.map((p) => (p.id === editing.id ? persona : p)))
    } else {
      savePersonas([...list, persona])
      saveActivePersonaId(persona.id)
    }
    onBack()
  }

  const previewSrc = avatar || letterAvatar(name || '我')
  const activeId = loadActivePersonaId()

  return (
    <div className="page">
      <NavBar
        title={isEdit ? '编辑人设' : '添加人设'}
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
        right={
          <button className="nav-btn nav-btn-done" onClick={submit}>
            保存
          </button>
        }
      />
      <div className="page-body add-friend">
        <div className="persona-intro">
          {isEdit
            ? activeId === personaId
              ? '这是你当前使用中的人设，修改保存后立即生效。'
              : '修改保存后，在个人信息页点击该人设即可切换使用。'
            : '这是你在与 AI 好友聊天时的身份，保存后自动切换为使用中。可创建多套人设随时切换。'}
        </div>

        <div className="avatar-picker" onClick={() => fileRef.current?.click()}>
          <img className="avatar-picker-img" src={previewSrc} alt="头像" />
          <div className="avatar-picker-hint">点击上传头像</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={pickFile} />

        <div className="list-group">
          <div className="form-row">
            <label className="form-label">头像</label>
            <button className="form-avatar-btn" onClick={() => fileRef.current?.click()}>
              <img className="form-avatar-img" src={previewSrc} alt="头像预览" />
              <span className="form-avatar-text">从相册选择</span>
            </button>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="p-name">名字</label>
            <input
              id="p-name"
              className="form-input"
              type="text"
              placeholder="必填"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="p-wechat">微信号</label>
            <input
              id="p-wechat"
              className="form-input"
              type="text"
              placeholder="选填，默认 ios_demo"
              maxLength={30}
              value={wechatId}
              onChange={(e) => setWechatId(e.target.value)}
            />
          </div>
          <div className="form-row form-row-col">
            <span className="form-label">性别</span>
            <div className="segment">
              {['男', '女', '保密'].map((g) => (
                <button key={g} className={`segment-item ${gender === g ? 'active' : ''}`} onClick={() => setGender(g)}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="p-age">年龄</label>
            <input
              id="p-age"
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
            <label className="form-label" htmlFor="p-region">地区</label>
            <input
              id="p-region"
              className="form-input"
              type="text"
              placeholder="如：广东 深圳"
              maxLength={30}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
        </div>

        <div className="list-group">
          <div className="form-row form-row-col">
            <label className="form-label" htmlFor="p-bio">人设与背景</label>
            <textarea
              id="p-bio"
              className="form-textarea"
              placeholder="介绍一下你的性格、爱好、说话风格……AI 好友会参考这些内容和你聊天"
              maxLength={300}
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <button className="primary-btn" onClick={submit}>
          {isEdit ? '保存修改' : '保存人设'}
        </button>
      </div>
    </div>
  )
}
