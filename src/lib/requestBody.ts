// Check actual stream bytes before multipart parsing; Content-Length is only a hint.
export class RequestBodyError extends Error {
  constructor(public readonly status = 413) {
    super(status === 413 ? 'O envio excede o tamanho permitido.' : 'Formato do envio inválido.')
  }
}

export function limiteCorpoRequisicao(pathname: string) {
  if (pathname === '/api/relatorios/arquivos') return 11 * 1024 * 1024
  if (/^\/api\/motoristas\/[^/]+\/foto$/.test(pathname) || /^\/api\/contas-pagar(?:\/[^/]+)?$/.test(pathname)) return 6 * 1024 * 1024
  return 2 * 1024 * 1024
}

export async function lerCorpoLimitado(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RequestBodyError()
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new RequestBodyError()
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return result
}

export async function lerFormularioLimitado(request: Request) {
  const bytes = await lerCorpoLimitado(request, limiteCorpoRequisicao(new URL(request.url).pathname))
  try {
    return await new Response(new Uint8Array(bytes), {
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
    }).formData()
  } catch { throw new RequestBodyError(400) }
}
