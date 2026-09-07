import { useRef, useState } from 'react'
import { NavBar, Modal } from '../components/common'
import { BackIcon } from '../components/icons'
import { loadStickers, saveStickers, uid } from '../store'
import type { Sticker } from '../types'
import { fileToAvatar } from '../utils/image'

export default function StickerPage({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<Sticker[]>(() => loadStickers())
  const [uploadQueue, setUploadQueue] = useState<string[]>([])
  const [meaningDraft, setMeaningDraft] = useState('')
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlText, setUrlText] = useState('')
  const [hint, setHint] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const showHint = (t: string) => {
    setHint(t)
    window.setTimeout(() => setHint(''), 1800)
  }

  const persist = (next: Sticker[]) => {
    saveStickers(next)
    setList(next)
  }

  const pickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/')).slice(0, 30)
    e.target.value = ''
    if (files.length === 0) return
    const urls: string[] = []
    for (const f of files) {
      try {
        urls.push(await fileToAvatar(f))
      } catch {
        /* skip unreadable file */
      }
    }
    if (urls.length === 0) {
      showHint('图片读取失败，请换几张试试')
      return
    }
    setUploadQueue((q) => [...q, ...urls])
    setMeaningDraft('')
  }

  const importUrls = () => {
    const urls = urlText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//.test(s))
      .slice(0, 30)
    if (urls.length === 0) {
      showHint('没有识别到有效链接，每行一个图片地址')
      return
    }
    setUrlOpen(false)
    setUrlText('')
    setUploadQueue((q) => [...q, ...urls])
    setMeaningDraft('')
  }

  const saveCurrent = () => {
    const url = uploadQueue[0]
    if (!url) return
    const item: Sticker = { id: uid(), meaning: meaningDraft.trim() || '表情包', url, createdAt: Date.now() }
    persist([...list, item])
    setUploadQueue((q) => q.slice(1))
    setMeaningDraft('')
    showHint('已保存')
  }

  const skipCurrent = () => {
    setUploadQueue((q) => q.slice(1))
    setMeaningDraft('')
  }

  const removeOne = (id: string) => {
    persist(list.filter((s) => s.id !== id))
    showHint('已删除')
  }

  return (
    <div className="page sticker-page">
      <NavBar
        title="表情包"
        left={
          <button className="nav-btn" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="page-body">
        <div className="sticker-actions">
          <button className="sticker-action-btn" onClick={() => fileRef.current?.click()}>
            上传图片
          </button>
          <button className="sticker-action-btn" onClick={() => setUrlOpen(true)}>
            批量 URL 导入
          </button>
        </div>
        {list.length === 0 ? (
          <div className="empty-hint sticker-empty">还没有表情包，上传几张或批量导入 URL 吧</div>
        ) : (
          <div className="sticker-manage-grid">
            {list.map((s) => (
              <div key={s.id} className="sticker-manage-cell">
                <button className="sticker-manage-del" onClick={() => removeOne(s.id)} aria-label={`删除 ${s.meaning}`}>
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <path d="M1 1l8 8M9 1L1 9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
                <img src={s.url} alt={s.meaning} draggable={false} loading="lazy" />
                <span className="sticker-manage-meaning">{s.meaning}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickFiles} />

      <Modal
        open={uploadQueue.length > 0}
        title={uploadQueue.length > 1 ? `这个表情包表达什么意思？（还剩 ${uploadQueue.length} 张）` : '这个表情包表达什么意思？'}
        buttons={[
          { label: '跳过', onClick: skipCurrent },
          { label: '保存', primary: true, onClick: saveCurrent },
        ]}
      >
        <div className="sticker-upload-preview">
          <img src={uploadQueue[0]} alt="表情包预览" />
        </div>
        <input
          className="remark-input"
          type="text"
          placeholder="如：开心到飞起（AI 会按意思发表）"
          maxLength={12}
          value={meaningDraft}
          onChange={(e) => setMeaningDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveCurrent()
          }}
          autoFocus
        />
      </Modal>

      <Modal
        open={urlOpen}
        title="批量导入表情包"
        buttons={[
          { label: '取消', onClick: () => setUrlOpen(false) },
          { label: '导入', primary: true, onClick: importUrls },
        ]}
      >
        <div className="modal-tip">每行粘贴一个图片链接（http/https），最多 30 个。导入后逐张填写意思。</div>
        <textarea
          className="sticker-url-input"
          rows={6}
          placeholder={'https://example.com/1.jpg\nhttps://example.com/2.png'}
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
        />
      </Modal>

      {hint && <div className="chat-toast">{hint}</div>}
    </div>
  )
}
