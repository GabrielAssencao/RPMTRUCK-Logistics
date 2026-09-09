'use client'

import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { identificarCodigoBoleto } from '@/lib/financeiro/contasPagar'
import { lerCodigoBarrasImagemLocalmente } from '../_utils/leituraBoletoPdf'

export type ModoLeitorCamera = 'AO_VIVO' | 'FOTO'

interface LeitorCameraProps {
  modo: ModoLeitorCamera
  onRead: (codigo: string) => void
  onClose: () => void
}

function camerasTraseiras(dispositivos: MediaDeviceInfo[]) {
  const cameras = dispositivos.filter((item) => item.kind === 'videoinput')
  return cameras.filter((item) => /back|rear|traseir|environment/i.test(item.label))
}

export default function LeitorCamera({ modo, onRead, onClose }: LeitorCameraProps) {
  const video = useRef<HTMLVideoElement>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [capturando, setCapturando] = useState(false)
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
          throw new Error('Abra o sistema por HTTPS para usar a câmera.')
        }
        const qualidade = { width: { ideal: 2560 }, height: { ideal: 1440 } }
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: deviceId
              ? { deviceId: { exact: deviceId }, ...qualidade }
              : { facingMode: { exact: 'environment' }, ...qualidade },
          })
        } catch (cause) {
          if (deviceId || !(cause instanceof DOMException) || !['OverconstrainedError', 'NotFoundError'].includes(cause.name)) throw cause
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, ...qualidade } })
        }
        if (cancelado) { parar(); return }

        const cameraAtiva = stream.getVideoTracks()[0]
        const configuracaoCamera = cameraAtiva?.getSettings()
        const cameraFrontal = configuracaoCamera?.facingMode === 'user'
          || /front|frontal|selfie|user/i.test(cameraAtiva?.label ?? '')
        if (cameraFrontal) {
          throw new Error('A câmera traseira não foi encontrada neste navegador. Verifique a permissão de câmera e tente novamente.')
        }
        try {
          const capacidades = cameraAtiva?.getCapabilities() as MediaTrackCapabilities & { focusMode?: string[] }
          if (capacidades?.focusMode?.includes('continuous')) {
            await cameraAtiva.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
          }
        } catch {
          // Foco contínuo não está disponível em todos os navegadores móveis.
        }
        setCameras(camerasTraseiras(await navigator.mediaDevices.enumerateDevices()))
        setStatus(modo === 'FOTO'
          ? 'Câmera traseira ativa. Enquadre as barras e toque em Capturar.'
          : 'Câmera traseira ativa. A leitura será preenchida automaticamente.')

        if (modo === 'AO_VIVO') {
          const { BarcodeFormat, BrowserMultiFormatReader } = await import('@zxing/browser')
          const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 100, delayBetweenScanSuccess: 200 })
          reader.possibleFormats = [BarcodeFormat.ITF, BarcodeFormat.CODE_128]
          controls = await reader.decodeFromStream(stream, video.current!, (resultado, _erro, controle) => {
            if (cancelado || !resultado) return
            const identificacao = identificarCodigoBoleto(resultado.getText())
            if (!identificacao.valido) return
            cancelado = true
            controle.stop()
            parar()
            onRead(identificacao.codigo)
          })
        } else if (video.current) {
          video.current.srcObject = stream
          await video.current.play()
        }
        if (cancelado) parar()
      } catch (error) {
        parar()
        if (cancelado) return
        setErro(error instanceof DOMException
          ? error.name === 'NotAllowedError'
            ? 'Permita o acesso à câmera nas configurações do navegador e tente novamente.'
            : 'Não foi possível abrir a câmera traseira. Feche outros aplicativos e tente novamente.'
          : error instanceof Error ? error.message : 'Não foi possível iniciar a câmera.')
      }
    }
    void iniciar()
    return () => { cancelado = true; parar() }
  }, [deviceId, modo, onRead, tentativa])

  const capturarFoto = async () => {
    const elemento = video.current
    if (!elemento?.videoWidth || !elemento.videoHeight || capturando) return
    setCapturando(true)
    setErro('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = elemento.videoWidth
      canvas.height = elemento.videoHeight
      canvas.getContext('2d', { willReadFrequently: true })?.drawImage(elemento, 0, 0)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
      canvas.width = 1
      canvas.height = 1
      if (!blob) throw new Error('Não foi possível capturar a imagem.')
      const dados = await lerCodigoBarrasImagemLocalmente(new File([blob], 'captura-boleto.jpg', { type: blob.type }))
      if (!dados.linhaDigitavel) {
        setErro('Código não reconhecido. Afaste um pouco o celular, mantenha-o em pé e enquadre todas as barras.')
        return
      }
      onRead(dados.linhaDigitavel)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível processar a captura.')
    } finally {
      setCapturando(false)
    }
  }

  return <section aria-label="Leitor de código de barras" className="space-y-3 border p-3" style={{ borderColor: 'var(--border)' }}>
    <p className="text-xs">Mantenha o celular em pé e posicione todas as barras dentro da moldura. A imagem é processada somente no aparelho.</p>
    <div className="relative mx-auto aspect-[3/4] w-full max-w-lg overflow-hidden bg-black sm:aspect-video">
      <video ref={video} autoPlay muted playsInline className="h-full w-full object-contain" aria-label="Imagem da câmera traseira" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[4%] top-1/2 h-24 -translate-y-1/2 border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
    </div>
    {!erro && <p aria-live="polite" className="text-[11px] text-foreground-muted">{status}</p>}
    {cameras.length > 1 && <label className="block text-xs">Câmera traseira
      <select className="input-financeiro mt-1" value={deviceId} onChange={(event) => { setErro(''); setDeviceId(event.target.value) }}>
        <option value="">Automática</option>
        {cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Câmera traseira ${index + 1}`}</option>)}
      </select>
    </label>}
    {erro && <p role="alert" className="text-xs text-red-500">{erro}</p>}
    <div className="flex flex-wrap gap-2">
      {modo === 'FOTO' && <button type="button" disabled={capturando || Boolean(erro)} className="min-h-11 border px-3 text-xs font-bold disabled:opacity-50" onClick={() => void capturarFoto()}>{capturando ? 'Processando...' : 'Capturar foto'}</button>}
      {erro && <button type="button" className="min-h-11 border px-3 text-xs" onClick={() => { setErro(''); setTentativa((valor) => valor + 1) }}>Tentar novamente</button>}
      <button type="button" className="min-h-11 border px-3 text-xs" onClick={onClose}>Fechar câmera</button>
    </div>
  </section>
}
