'use client'

import { useEffect, useState } from 'react'
import { AuthenticatorRecommendations } from '@/components/security/AuthenticatorRecommendations'

export interface AdminMfaChallenge { configurar: boolean; segredo?: string; otpauth?: string }
export interface AdminMfaUser { id: string; nome: string; email: string; role: string; empresa: null; empresaInfo: null; acessoSomentePlano?: boolean }

type QrCodeState =
  | { status: 'loading' }
  | { status: 'ready'; path: string; size: number }
  | { status: 'error' }

export function AdminMfaQrCode({ otpauth }: { otpauth: string }) {
  const [qrCode, setQrCode] = useState<QrCodeState>({ status: 'loading' })

  useEffect(() => {
    let active = true

    void import('@zxing/library')
      .then(({ BarcodeFormat, QRCodeWriter }) => {
        const matrix = new QRCodeWriter().encode(otpauth, BarcodeFormat.QR_CODE, 0, 0, new Map())
        const width = matrix.getWidth()
        const height = matrix.getHeight()
        let path = ''

        for (let y = 0; y < height; y += 1) {
          let x = 0
          while (x < width) {
            if (!matrix.get(x, y)) {
              x += 1
              continue
            }

            const start = x
            while (x < width && matrix.get(x, y)) x += 1
            path += `M${start} ${y}h${x - start}v1H${start}z`
          }
        }

        if (active) setQrCode({ status: 'ready', path, size: width })
      })
      .catch(() => {
        if (active) setQrCode({ status: 'error' })
      })

    return () => { active = false }
  }, [otpauth])

  if (qrCode.status === 'loading') {
    return <div className="flex min-h-56 items-center justify-center border text-sm" role="status">Gerando QR Code...</div>
  }

  if (qrCode.status === 'error') {
    return <p className="border p-3 text-sm text-red-500" role="alert">Não foi possível gerar o QR Code. Use a chave de configuração abaixo.</p>
  }

  return <div className="flex justify-center">
    <svg
      aria-label="QR Code para configurar o segundo fator do administrador"
      className="h-56 w-56 max-w-full border bg-white p-2"
      role="img"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${qrCode.size} ${qrCode.size}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={qrCode.size} height={qrCode.size} fill="#fff" />
      <path d={qrCode.path} fill="#000" />
    </svg>
  </div>
}

export default function AdminMfaForm({ challenge, onSuccess, onBack, onChallenge }: {
  challenge: AdminMfaChallenge; onSuccess: (user: AdminMfaUser) => void; onBack: () => void; onChallenge: (challenge: AdminMfaChallenge) => void
}) {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ usuario: AdminMfaUser; codigosRecuperacao: string[] } | null>(null)
  const [saved, setSaved] = useState(false)
  const fieldStyle = { borderColor: 'var(--border)', background: 'var(--background-secondary)', color: 'var(--foreground)' }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo }) })
      const data = await response.json()
      if (!response.ok) { setError(data.erro || 'Não foi possível verificar o código.'); return }
      setCodigo('')
      if (data.mfaObrigatorio) { onChallenge(data); return }
      if (data.codigosRecuperacao?.length) setResult(data)
      else onSuccess(data.usuario)
    } catch { setError('Falha de conexão. Tente novamente.') }
    finally { setBusy(false) }
  }

  return <section className="space-y-5" aria-labelledby="mfa-title">
    <p className="text-xs font-mono tracking-widest" style={{ color: 'var(--primary)' }}>VERIFICAÇÃO EM DUAS ETAPAS</p>
    <h1 id="mfa-title" className="text-2xl font-bold">{result ? 'Guarde seus códigos' : challenge.configurar ? 'Ative o segundo fator' : 'Confirme seu acesso'}</h1>
    {result ? <>
      <p className="text-sm">Salve estes códigos em um local seguro. Cada um permite um acesso caso você perca o autenticador e só pode ser usado uma vez.</p>
      <div className="border p-3 font-mono text-xs break-all space-y-1" style={fieldStyle}>{result.codigosRecuperacao.map(code => <p key={code}>{code}</p>)}</div>
      <button type="button" className="border px-4 py-2 text-sm" style={fieldStyle} onClick={() => {
        const url = URL.createObjectURL(new Blob([`RPM Truck — códigos de recuperação\n\n${result.codigosRecuperacao.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }))
        const link = document.createElement('a'); link.href = url; link.download = 'rpmtruck-recuperacao-mfa.txt'; link.click(); URL.revokeObjectURL(url)
      }}>Baixar códigos</button>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />Guardei os códigos em um local seguro.</label>
      <button type="button" disabled={!saved} onClick={() => onSuccess(result.usuario)} className="w-full border p-3 font-bold disabled:opacity-40" style={fieldStyle}>ACESSAR PAINEL</button>
    </> : <>
      {challenge.configurar && <div className="space-y-3 text-sm">
        <AuthenticatorRecommendations />
        <p>No aplicativo escolhido, toque em <strong>+</strong>, selecione a opção para ler um QR Code e aponte a câmera para o código abaixo.</p>
        {challenge.otpauth && <AdminMfaQrCode key={challenge.otpauth} otpauth={challenge.otpauth} />}
        <p className="text-xs">Se estiver configurando no mesmo celular, use “Abrir no aplicativo autenticador” ou cadastre pela chave manual.</p>
        {challenge.otpauth && <a className="inline-block underline" href={challenge.otpauth}>Abrir no aplicativo autenticador</a>}
        <label className="block text-xs" htmlFor="mfa-secret">Chave de configuração</label>
        <input id="mfa-secret" value={challenge.segredo || ''} readOnly className="w-full border p-3 font-mono text-xs" style={fieldStyle} onFocus={e => e.target.select()} />
        <p>Depois, digite abaixo o código de 6 dígitos exibido pelo aplicativo.</p>
        <p className="text-xs"><strong>Não compartilhe o QR Code nem a chave.</strong> Eles dão acesso ao segundo fator e não serão exibidos novamente após a confirmação.</p>
      </div>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm" htmlFor="mfa-code">{challenge.configurar ? 'Código de 6 dígitos do aplicativo' : 'Código do aplicativo ou de recuperação'}</label>
        <input id="mfa-code" autoComplete="one-time-code" autoFocus inputMode={challenge.configurar ? 'numeric' : 'text'} pattern={challenge.configurar ? '[0-9]*' : undefined} maxLength={40} value={codigo} onChange={e => setCodigo(e.target.value)} className="w-full border p-3 font-mono" style={fieldStyle} aria-describedby={error ? 'mfa-error' : undefined} />
        {error && <p id="mfa-error" role="alert" className="text-sm text-red-500">{error}</p>}
        <button disabled={busy || codigo.trim().length < 6} className="w-full border p-3 font-bold disabled:opacity-40" style={fieldStyle}>{busy ? 'VERIFICANDO...' : 'CONFIRMAR CÓDIGO'}</button>
      </form>
      <button type="button" onClick={onBack} disabled={busy} className="text-sm underline">Voltar ao login</button>
    </>}
  </section>
}
