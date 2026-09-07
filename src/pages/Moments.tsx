import { useEffect, useRef, useState } from 'react'
import { ActionSheet, formatTime } from '../components/common'
import { coverSvg, letterAvatar, loadCover, loadFriends, loadMoments, loadProfile, saveCover, saveMoments, uid } from '../store'
import type { MomentsPost } from '../types'
import { fileToPhoto } from '../utils/image'

function authorInfo(authorId: string) {
  if (authorId === 'me') {
    const p = loadProfile()
    return { name: p.name, avatar: p.avatar }
  }
  const f = loadFriends().find((x) => x.id === authorId)
  return f ? { name: f.name, avatar: f.avatar } : { name: '用户', avatar: '' }
}

export default function Moments({ onBack }: { onBack: () => void }) {
  const [posts, setPosts] = useState<MomentsPost[]>(() => loadMoments().sort((a, b) => b.time - a.time))
  const [cover, setCover] = useState<string>(() => loadCover())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [composing, setComposing] = useState<{ images: string[] } | null>(null)
  const [openMenuId, setOpenMenuId] = useState('')
  const [commentFor, setCommentFor] = useState('')
  const [commentReplyTo, setCommentReplyTo] = useState('')
  const [commentText, setCommentText] = useState('')
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const reload = () => setPosts(loadMoments().sort((a, b) => b.time - a.time))

  useEffect(() => {
    if (!openMenuId) return
    const close = () => setOpenMenuId('')
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openMenuId])

  const handlePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    const imgs: string[] = []
    for (const f of files.slice(0, 9)) {
      try {
        imgs.push(await fileToPhoto(f))
      } catch {
        /* skip bad file */
      }
    }
    setComposing({ images: imgs })
  }

  const handleCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = await fileToPhoto(file)
      saveCover(data)
      setCover(data)
    } catch {
      /* skip */
    }
  }

  const publish = (text: string, images: string[]) => {
    const post: MomentsPost = {
      id: uid(),
      authorId: 'me',
      text: text.trim(),
      images,
      time: Date.now(),
      likes: [],
      comments: [],
    }
    saveMoments([post, ...loadMoments()])
    setComposing(null)
    reload()
  }

  const toggleLike = (postId: string) => {
    const me = loadProfile().name
    const all = loadMoments()
    const post = all.find((p) => p.id === postId)
    if (!post) return
    post.likes = post.likes.includes(me) ? post.likes.filter((n) => n !== me) : [...post.likes, me]
    saveMoments(all)
    reload()
  }

  const submitComment = (postId: string) => {
    const text = commentText.trim()
    if (!text) return
    const all = loadMoments()
    const post = all.find((p) => p.id === postId)
    if (!post) return
    post.comments.push({ id: uid(), name: loadProfile().name, text, replyTo: commentReplyTo || undefined })
    saveMoments(all)
    setCommentText('')
    setCommentFor('')
    setCommentReplyTo('')
    reload()
  }

  const profile = loadProfile()
  const meAvatar = profile.avatar || letterAvatar(profile.name)

  if (composing) {
    return <ComposeMoment images={composing.images} onCancel={() => setComposing(null)} onPublish={publish} />
  }

  return (
    <div className="page moments-page">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handlePhotos} />
      <input ref={albumRef} type="file" accept="image/*" multiple hidden onChange={handlePhotos} />
      <input ref={coverRef} type="file" accept="image/*" hidden onChange={handleCover} />

      <div className="moments-nav">
        <button className="moments-back" onClick={onBack} aria-label="返回">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 4.5 7.5 12l7.5 7.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="moments-camera" onClick={() => setSheetOpen(true)} aria-label="拍照分享">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2c.5 0 1-.25 1.3-.66l.6-.84c.28-.4.74-.5 1.2-.5h2.4c.46 0 .92.1 1.2.5l.6.84c.3.41.8.66 1.3.66h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
              stroke="#fff"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12.3" r="3.2" stroke="#fff" strokeWidth="1.7" />
          </svg>
        </button>
      </div>

      <div className="moments-scroll">
        <div className="moments-cover-wrap" onClick={() => coverRef.current?.click()}>
          <img className="moments-cover-img" src={cover || coverSvg()} alt="封面" />
          <span className="moments-cover-edit">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2c.5 0 1-.25 1.3-.66l.6-.84c.28-.4.74-.5 1.2-.5h2.4c.46 0 .92.1 1.2.5l.6.84c.3.41.8.66 1.3.66h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12.3" r="3" stroke="#fff" strokeWidth="1.8" />
            </svg>
            更换封面
          </span>
          <div className="moments-me">
            <span className="moments-me-name">{profile.name}</span>
            <img className="moments-me-avatar" src={meAvatar} alt={profile.name} />
          </div>
        </div>

        <div className="moments-list">
          {posts.map((post) => {
            const author = authorInfo(post.authorId)
            const liked = post.likes.includes(profile.name)
            return (
              <div className="moment" key={post.id}>
                <img className="moment-avatar" src={author.avatar || letterAvatar(author.name)} alt={author.name} />
                <div className="moment-body">
                  <div className="moment-name">{author.name}</div>
                  {post.text && <div className="moment-text">{post.text}</div>}
                  {post.images.length > 0 && (
                    <div className={`moment-grid grid-${post.images.length === 1 ? '1' : post.images.length === 2 || post.images.length === 4 ? '2' : '3'}`}>
                      {post.images.map((src, i) => (
                        <img key={i} src={src} alt="" />
                      ))}
                    </div>
                  )}
                  <div className="moment-meta">
                    <span className="moment-time">{formatTime(post.time)}</span>
                    <div className="moment-actions">
                      {openMenuId === post.id && (
                        <div className="moment-menu" onClick={(e) => e.stopPropagation()}>
                          <button className="moment-menu-btn" onClick={() => { setOpenMenuId(''); toggleLike(post.id) }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill={liked ? '#fff' : 'none'}>
                              <path
                                d="M12 20.5s-7.8-4.9-9.3-9.4C1.6 8 3.3 5.3 6.2 5.3c1.9 0 3.3 1 4.2 2.4l1.6 2.4 1.6-2.4c.9-1.4 2.3-2.4 4.2-2.4 2.9 0 4.6 2.7 3.5 5.8-1.5 4.5-9.3 9.4-9.3 9.4Z"
                                stroke="#fff"
                                strokeWidth="1.6"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span>{liked ? '取消' : '赞'}</span>
                          </button>
                          <span className="moment-menu-sep" />
                          <button
                            className="moment-menu-btn"
                            onClick={() => {
                              setOpenMenuId('')
                              setCommentReplyTo('')
                              setCommentFor(post.id)
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M12 4.5c4.8 0 8.5 3.1 8.5 7 0 3.9-3.7 7-8.5 7-.8 0-1.6-.1-2.4-.3-.9.7-2.2 1.4-4 1.6.4-.8.6-1.7.6-2.5-1.8-1.3-2.7-3.1-2.7-5.8 0-3.9 3.7-7 8.5-7Z"
                                stroke="#fff"
                                strokeWidth="1.6"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span>评论</span>
                          </button>
                        </div>
                      )}
                      <button
                        className="moment-more"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === post.id ? '' : post.id)
                        }}
                        aria-label="操作"
                      >
                        <svg width="15" height="4" viewBox="0 0 15 4" fill="#576b95">
                          <circle cx="3.5" cy="2" r="1.7" />
                          <circle cx="11.5" cy="2" r="1.7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {(post.likes.length > 0 || post.comments.length > 0) && (
                    <div className="moment-social">
                      {post.likes.length > 0 && (
                        <div className={`moment-likes ${post.comments.length > 0 ? 'with-sep' : ''}`}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="#576b95">
                            <path d="M12 20.5s-7.8-4.9-9.3-9.4C1.6 8 3.3 5.3 6.2 5.3c1.9 0 3.3 1 4.2 2.4l1.6 2.4 1.6-2.4c.9-1.4 2.3-2.4 4.2-2.4 2.9 0 4.6 2.7 3.5 5.8-1.5 4.5-9.3 9.4-9.3 9.4Z" />
                          </svg>
                          <span className="moment-like-names">{post.likes.join('，')}</span>
                        </div>
                      )}
                      {post.comments.map((c) => (
                        <div
                          className="moment-comment"
                          key={c.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (c.name === profile.name) return
                            setCommentFor(post.id)
                            setCommentReplyTo(c.name)
                          }}
                        >
                          <span className="moment-comment-name">{c.name}</span>
                          {c.replyTo && (
                            <>
                              {' '}
                              回复 <span className="moment-comment-name">{c.replyTo}</span>
                            </>
                          )}
                          ：{c.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {commentFor === post.id && (
                    <div className="moment-comment-input" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        type="text"
                        placeholder={commentReplyTo ? `回复 ${commentReplyTo}` : '评论'}
                        value={commentText}
                        maxLength={200}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitComment(post.id)
                        }}
                      />
                      <button className="moment-comment-send" disabled={!commentText.trim()} onClick={() => submitComment(post.id)}>
                        发送
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div className="moments-end">已经到底啦</div>
        </div>
      </div>

      <ActionSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="sheet-group">
          <button
            className="sheet-item"
            onClick={() => {
              setSheetOpen(false)
              cameraRef.current?.click()
            }}
          >
            拍照
          </button>
          <button
            className="sheet-item"
            onClick={() => {
              setSheetOpen(false)
              albumRef.current?.click()
            }}
          >
            从手机相册选择
          </button>
          <button
            className="sheet-item"
            onClick={() => {
              setSheetOpen(false)
              setComposing({ images: [] })
            }}
          >
            文字动态
          </button>
        </div>
        <div className="sheet-group">
          <button className="sheet-item sheet-cancel" onClick={() => setSheetOpen(false)}>
            取消
          </button>
        </div>
      </ActionSheet>
    </div>
  )
}

function ComposeMoment({
  images,
  onCancel,
  onPublish,
}: {
  images: string[]
  onCancel: () => void
  onPublish: (text: string, images: string[]) => void
}) {
  const [text, setText] = useState('')
  const [pics, setPics] = useState<string[]>(images)
  const albumRef = useRef<HTMLInputElement>(null)

  const addPics = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const remain = 9 - pics.length
    const added: string[] = []
    for (const f of files.slice(0, remain)) {
      try {
        added.push(await fileToPhoto(f))
      } catch {
        /* skip */
      }
    }
    setPics((prev) => [...prev, ...added])
  }

  return (
    <div className="page">
      <div className="navbar">
        <div className="navbar-row">
          <div className="navbar-side navbar-left">
            <button className="nav-btn nav-btn-done" style={{ color: '#8e8e93' }} onClick={onCancel}>
              取消
            </button>
          </div>
          <div className="navbar-title">发表文字</div>
          <div className="navbar-side navbar-right">
            <button className="nav-btn nav-btn-done" disabled={!text.trim() && pics.length === 0} onClick={() => onPublish(text, pics)}>
              发表
            </button>
          </div>
        </div>
      </div>
      <div className="page-body compose-moment">
        <textarea
          className="compose-textarea"
          placeholder="这一刻的想法..."
          rows={5}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="compose-grid">
          {pics.map((src, i) => (
            <div className="compose-cell" key={i}>
              <img src={src} alt="" />
              <button className="compose-remove" onClick={() => setPics((prev) => prev.filter((_, j) => j !== i))} aria-label="删除">
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M1 1l8 8M9 1L1 9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
          {pics.length < 9 && (
            <button className="compose-add" onClick={() => albumRef.current?.click()}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#c7c7cc" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <input ref={albumRef} type="file" accept="image/*" multiple hidden onChange={addPics} />
        <div className="compose-hint">谁可以看：公开</div>
      </div>
    </div>
  )
}
