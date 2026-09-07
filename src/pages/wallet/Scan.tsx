import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { NavBar } from '../../components/common'
import { BackIcon } from '../../components/icons'

export default function Scan({ onBack }: { onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const [result, setResult] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        await video.play()
        const tick = () => {
          const v = videoRef.current
          const c = canvasRef.current
          if (v && c && v.videoWidth > 0) {
            const w = 320
            const h = Math.round((v.videoHeight / v.videoWidth) * w)
            c.width = w
            c.height = h
            const ctx = c.getContext('2d', { willReadFrequently: true })!
            ctx.drawImage(v, 0, 0, w, h)
            const img = ctx.getImageData(0, 0, w, h)
            const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
            if (code?.data) {
              setResult(code.data)
              stop()
              return
            }
          }
          rafRef.current = window.requestAnimationFrame(tick)
        }
        rafRef.current = window.requestAnimationFrame(tick)
      } catch (e) {
        const name = e instanceof DOMException ? e.name : ''
        setErr(name === 'NotAllowedError' ? '摄像头权限被拒绝，请在浏览器地址栏允许使用摄像头' : '无法打开摄像头，请检查设备')
      }
    }
    start()
    const stop = () => {
      window.cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  return (
    <div className="page scan-page">
      <NavBar
        title=""
        left={
          <button className="nav-btn light" onClick={onBack} aria-label="返回">
            <BackIcon />
          </button>
        }
      />
      <div className="scan-body">
        <video ref={videoRef} className="scan-video" muted playsInline />
        <canvas ref={canvasRef} className="scan-hidden-canvas" />
        {!result && !err && (
          <div className="scan-frame">
            <span className="scan-corner tl" />
            <span className="scan-corner tr" />
            <span className="scan-corner bl" />
            <span className="scan-corner br" />
            <span className="scan-line" />
          </div>
        )}
        {!result && !err && <div className="scan-tip">对准二维码，即可自动识别</div>}
        {err && <div className="scan-err">{err}</div>}
        {result && (
          <div className="scan-result">
            <div className="scan-result-title">识别结果</div>
            <div className="scan-result-text">{result}</div>
            <div className="rp-sheet-btns">
              <button
                className="btn-gray-big"
                onClick={() => {
                  navigator.clipboard?.writeText(result).catch(() => {})
                  onBack()
                }}
              >
                复制并返回
              </button>
              <button
                className="btn-green-big"
                onClick={() => {
                  setResult('')
                  setErr('')
                }}
              >
                继续扫码
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
