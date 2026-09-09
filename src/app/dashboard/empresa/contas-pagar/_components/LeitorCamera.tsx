'use client'

import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { linhaDigitavelValida } from '@/lib/financeiro/contasPagar'

export default function LeitorCamera({ onRead, onClose }: { onRead: (codigo: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [status, setStatus] = useState('Iniciando câmera traseira...')

  useEffect(() => {
    let cancelado = false
    let stream: MediaStream | undefined
    let controls: IScannerControls | undefined
    const parar = () => {
      controls?.stop()
      stream?.getTracks().forEach((track) => track.stop())
    }
    const iniciar = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('Abra o sistema por HTTPS para usar a câmera. Você também pode anexar uma foto do boleto.')
        }
        const { BrowserMultiFormatOneDReader } = await import('@zxing/browser')
        if (cancelado) return
        const qualidade = { width: { ideal: 1920 }, height: { ideal: 1080 } }
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: deviceId
              ? { deviceId: { exact: deviceId }, ...qualidade }
              : { facingMode: { exact: 'environment' }, ...qualidade },
          })
        } catch (cause) {
          if (deviceId || !(cause instanceof DOMException) || !['OverconstrainedError', 'NotFoundError'].includes(cause.name)) throw cause
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, ...qualidade },
          })
        }
        if (cancelado) { parar(); return }
        const cameraAtiva = stream.getVideoTracks()[0]
        try {
          const capacidades = cameraAtiva?.getCapabilities() as MediaTrackCapabilities & { focusMode?: string[] }
          if (capacidades?.focusMode?.includes('continuous')) {
            await cameraAtiva.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
          }
        } catch {
          // Foco automático avançado não está disponível em todos os navegadores móveis.
        }
        setStatus(`Câmera ativa${cameraAtiva?.label ? `: ${cameraAtiva.label}` : ''}. Aponte para as barras e mantenha o celular firme.`)
        const dispositivos = await navigator.mediaDevices.enumerateDevices()
        if (cancelado) { parar(); return }
        setCameras(dispositivos.filter((item) => item.kind === 'videoinput'))
        const reader = new BrowserMultiFormatOneDReader()
        controls = await reader.decodeFromStream(stream, video.current!, (resultado, _erro, controle) => {
          if (cancelado || !resultado) return
          const codigo = resultado.getText().replace(/\D/g, '')
          if (![44, 47, 48].includes(codigo.length) || !linhaDigitavelValida(codigo)) return
          cancelado = true
          controle.stop()
          parar()
          onRead(codigo)
        })
        if (cancelado) parar()
      } catch (error) {
        parar()
        if (cancelado) return
        setErro(error instanceof DOMException
          ? error.name === 'NotAllowedError'
            ? 'Permita o acesso à câmera nas configurações do navegador e tente novamente.'
            : 'Não foi possível abrir esta câmera. Feche outros aplicativos ou escolha outra câmera.'
          : error instanceof Error ? error.message : 'Não foi possível iniciar a câmera.')
      }
    }
    void iniciar()
    return () => { cancelado = true; parar() }
  }, [deviceId, tentativa, onRead])

  return <section aria-label="Leitor de código de barras" className="space-y-3 border p-3" style={{ borderColor: 'var(--border)' }}>
    <p className="text-xs">Enquadre todas as barras horizontalmente, com boa iluminação. A leitura é automática e não envia imagens.</p>
    <div className="relative overflow-hidden bg-black">
      <video ref={video} autoPlay muted playsInline className="aspect-video w-full object-contain" aria-label="Imagem da câmera" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[8%] top-1/2 h-20 -translate-y-1/2 border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
    </div>
    {!erro && <p aria-live="polite" className="text-[11px] text-foreground-muted">{status}</p>}
    {cameras.length > 1 && <label className="block text-xs">Câmera
      <select className="input-financeiro mt-1" value={deviceId} onChange={(event) => { setErro(''); setDeviceId(event.target.value) }}>
        <option value="">Traseira (automática)</option>
        {cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Câmera ${index + 1}`}</option>)}
      </select>
    </label>}
    {erro && <p role="alert" className="text-xs text-red-500">{erro}</p>}
    <div className="flex gap-2">
      {erro && <button type="button" className="min-h-11 border px-3 text-xs" onClick={() => { setErro(''); setTentativa((valor) => valor + 1) }}>Tentar novamente</button>}
      <button type="button" className="min-h-11 border px-3 text-xs" onClick={onClose}>Fechar câmera</button>
    </div>
  </section>
}
