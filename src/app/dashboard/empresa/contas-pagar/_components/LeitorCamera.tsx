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
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
            width: { ideal: 1920 }, height: { ideal: 1080 },
          },
        })
        if (cancelado) { parar(); return }
        const dispositivos = await navigator.mediaDevices.enumerateDevices()
        if (cancelado) { parar(); return }
        setCameras(dispositivos.filter((item) => item.kind === 'videoinput'))
        let anterior = ''
        const reader = new BrowserMultiFormatOneDReader()
        controls = await reader.decodeFromStream(stream, video.current!, (resultado, _erro, controle) => {
          if (cancelado || !resultado) return
          const codigo = resultado.getText()
          if (!/^\d{44}$|^\d{47}$|^8\d{47}$/.test(codigo) || !linhaDigitavelValida(codigo)) return
          // Duas leituras iguais reduzem preenchimentos acidentais durante o movimento.
          if (codigo !== anterior) { anterior = codigo; return }
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
    const ocultar = () => { if (document.hidden) onClose() }
    document.addEventListener('visibilitychange', ocultar)
    return () => { cancelado = true; parar(); document.removeEventListener('visibilitychange', ocultar) }
  }, [deviceId, tentativa, onRead, onClose])

  return <section aria-label="Leitor de código de barras" className="space-y-3 border p-3" style={{ borderColor: 'var(--border)' }}>
    <p className="text-xs">Enquadre todas as barras horizontalmente, com boa iluminação. A leitura é automática e não envia imagens.</p>
    <video ref={video} autoPlay muted playsInline className="aspect-video w-full bg-black object-contain" aria-label="Imagem da câmera" />
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
