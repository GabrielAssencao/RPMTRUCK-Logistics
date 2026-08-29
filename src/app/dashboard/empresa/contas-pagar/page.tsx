'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Building2, Check, Copy, Download, ExternalLink, FileText, Plus, ReceiptText, Upload, X } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { CONTA_PAGAR_MAX_FILE_BYTES, formatarLinhaDigitavel } from '@/lib/financeiro/contasPagar'
import { CATEGORIAS_CONTA_PAGAR, descricaoContaPagarEhSugestao, obterCategoriaContaPagar } from '@/lib/financeiro/categoriasContaPagar'
import { lerBoletoPdfLocalmente, lerCodigoBarrasImagemLocalmente } from './_utils/leituraBoletoPdf'

interface Conta {
  id: string; descricao: string; fornecedor: string | null; vencimento: string; valor: number
  status: 'PENDENTE' | 'PAGO' | 'CANCELADO'; linhaDigitavel: string; linhaDigitavelFormatada: string
  origemLeitura: string; possuiBoleto: boolean; boletoNome: string | null; possuiComprovante: boolean
  comprovanteNome: string | null; pagoEm: string | null; diasParaVencer: number; nivel: 'VERDE' | 'AMARELO' | 'VERMELHO'
}
interface Capacidades { leituraAutomatica: boolean; alertasVisuais: boolean; copiarEAbrirPortal: boolean; exportacaoLote: boolean }
interface Integracoes { custos: boolean; frota: boolean }
interface Portal { nome: string; url: string }
interface VeiculoResumo { id: string; modelo: string; placa: string }

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
type OrigemLeituraFormulario = 'MANUAL' | 'PDF_TEXTO' | 'CODIGO_BARRAS'
const criarEstadoInicial = () => ({ descricao: '', fornecedor: '', vencimento: new Date().toISOString().slice(0, 10), valor: '', linhaDigitavel: '', origemLeitura: 'MANUAL' as OrigemLeituraFormulario, revisado: false, categoria: '', veiculoId: '' })
type EstadoFormulario = ReturnType<typeof criarEstadoInicial>

export default function ContasPagarPage() {
  const { primary } = useTheme()
  const [contas, setContas] = useState<Conta[]>([])
  const [capacidades, setCapacidades] = useState<Capacidades | null>(null)
  const [integracoes, setIntegracoes] = useState<Integracoes>({ custos: false, frota: false })
  const [portal, setPortal] = useState<Portal | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [filtro, setFiltro] = useState<'PENDENTE' | 'PAGO' | 'TODOS'>('PENDENTE')
  const [abrirCadastro, setAbrirCadastro] = useState(false)
  const [form, setForm] = useState<EstadoFormulario>(criarEstadoInicial)
  const [boleto, setBoleto] = useState<File | null>(null)
  const [preenchimentoAutomatico, setPreenchimentoAutomatico] = useState(true)
  const [veiculos, setVeiculos] = useState<VeiculoResumo[]>([])
  const [lendoArquivo, setLendoArquivo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [baixando, setBaixando] = useState<Conta | null>(null)
  const [comprovante, setComprovante] = useState<File | null>(null)
  const [configurandoPortal, setConfigurandoPortal] = useState(false)
  const [portalForm, setPortalForm] = useState({ nome: '', url: '' })
  const submitRef = useRef(false)
  const leituraArquivoRef = useRef(0)

  const carregar = useCallback(async () => {
    try {
      setCarregando(true)
      const response = await fetch('/api/contas-pagar', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar as contas.')
      setContas(data.contas)
      setCapacidades(data.capacidades)
      setIntegracoes(data.integracoes ?? { custos: false, frota: false })
      setPortal(data.portalFinanceiro)
      setPortalForm({ nome: data.portalFinanceiro?.nome ?? '', url: data.portalFinanceiro?.url ?? '' })
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível carregar as contas.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      const preferencia = localStorage.getItem('@rpmtruck:autoFillBoletoEnabled')
      setPreenchimentoAutomatico(preferencia !== 'false')
      void carregar()
    })
    void fetch('/api/veiculos', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() : [])
      .then((data) => setVeiculos(Array.isArray(data) ? data.map((item) => ({ id: item.id, modelo: item.modelo, placa: item.placa })) : []))
      .catch(() => undefined)
  }, [carregar])

  const alternarPreenchimentoAutomatico = (ativado: boolean) => {
    setPreenchimentoAutomatico(ativado)
    localStorage.setItem('@rpmtruck:autoFillBoletoEnabled', String(ativado))
    if (!ativado) setForm((atual) => ({ ...atual, origemLeitura: 'MANUAL', revisado: false }))
  }

  const atualizarCampoAuditado = <K extends keyof EstadoFormulario>(campo: K, valor: EstadoFormulario[K]) => {
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
      revisado: atual.origemLeitura === 'MANUAL' ? atual.revisado : false,
    }))
  }

  const pendentes = contas.filter((conta) => conta.status === 'PENDENTE')
  const exibidas = contas.filter((conta) => filtro === 'TODOS' || conta.status === filtro)
  const resumo = useMemo(() => ({
    total: pendentes.reduce((soma, conta) => soma + conta.valor, 0),
    urgentes: pendentes.filter((conta) => conta.nivel === 'VERMELHO').length,
    proximas: pendentes.filter((conta) => conta.nivel === 'AMARELO').length,
  }), [pendentes])
  const categoriaSelecionada = obterCategoriaContaPagar(form.categoria)

  const limparCadastro = () => {
    leituraArquivoRef.current += 1
    setForm(criarEstadoInicial())
    setBoleto(null)
    setLendoArquivo(false)
  }

  const abrirFormularioCadastro = () => {
    limparCadastro()
    setFeedback('')
    setAbrirCadastro(true)
  }

  const fecharFormularioCadastro = () => {
    if (enviando) return
    limparCadastro()
    setFeedback('')
    setAbrirCadastro(false)
  }

  const selecionarBoleto = async (arquivo: File | null) => {
    const leituraId = ++leituraArquivoRef.current
    setFeedback('')
    if (!arquivo) {
      setBoleto(null)
      return
    }
    if (arquivo.size > CONTA_PAGAR_MAX_FILE_BYTES) {
      setBoleto(null)
      setFeedback('O boleto deve ter no máximo 5 MB.')
      return
    }
    setBoleto(arquivo)
    const arquivoCompativel = arquivo.type === 'application/pdf' || arquivo.type.startsWith('image/')
    if (!arquivoCompativel || !capacidades?.leituraAutomatica || !preenchimentoAutomatico) return
    setLendoArquivo(true)
    try {
      const dados = arquivo.type === 'application/pdf'
        ? await lerBoletoPdfLocalmente(arquivo)
        : await lerCodigoBarrasImagemLocalmente(arquivo)
      if (leituraArquivoRef.current !== leituraId) return
      const encontrouDados = Boolean(dados.linhaDigitavel || dados.vencimento || dados.valor || dados.fornecedor)
      setForm((atual) => ({
        ...atual,
        descricao: atual.descricao || (dados.fornecedor ? `Boleto - ${dados.fornecedor}`.slice(0, 160) : ''),
        linhaDigitavel: dados.linhaDigitavel || atual.linhaDigitavel,
        vencimento: dados.vencimento || atual.vencimento,
        valor: dados.valor || atual.valor,
        fornecedor: dados.fornecedor || atual.fornecedor,
        origemLeitura: encontrouDados ? dados.origemLeitura : 'MANUAL',
        revisado: false,
      }))
      if (dados.codigoBarrasLido) {
        setFeedback('Código de barras lido na imagem. Confira código, vencimento e valor antes de salvar.')
      } else if (dados.textoEncontrado) {
        setFeedback('Camada de texto lida. Compare todos os campos preenchidos com o boleto antes de salvar.')
      } else if (!dados.leitorVisualDisponivel) {
        setFeedback('Este navegador não oferece leitura visual de código de barras. Preencha os dados manualmente ou use a linha digitável.')
      } else {
        setFeedback('Nenhum código válido foi reconhecido na imagem. Preencha os dados manualmente; o arquivo continuará anexado.')
      }
    } catch {
      if (leituraArquivoRef.current !== leituraId) return
      setFeedback('Não foi possível analisar o arquivo. Preencha os dados manualmente; o documento continuará anexado.')
    } finally {
      if (leituraArquivoRef.current === leituraId) setLendoArquivo(false)
    }
  }

  const cadastrar = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitRef.current) return
    if (form.origemLeitura !== 'MANUAL' && !form.revisado) return setFeedback('Confirme que você comparou os dados extraídos com o boleto.')
    if (categoriaSelecionada?.requerVeiculo && !form.veiculoId) return setFeedback(`Selecione o veículo relacionado a ${categoriaSelecionada.rotulo.toLowerCase()}.`)
    submitRef.current = true
    setEnviando(true)
    setFeedback('')
    try {
      const body = new FormData()
      Object.entries(form).forEach(([chave, valor]) => body.set(chave, String(valor)))
      if (boleto) body.set('boleto', boleto)
      const response = await fetch('/api/contas-pagar', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível cadastrar a conta.')
      limparCadastro(); setAbrirCadastro(false); setFeedback('Conta cadastrada com segurança.')
      await carregar()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível cadastrar a conta.')
    } finally {
      submitRef.current = false; setEnviando(false)
    }
  }

  const confirmarBaixa = async () => {
    if (!baixando || !comprovante || submitRef.current) return
    if (comprovante.size > CONTA_PAGAR_MAX_FILE_BYTES) return setFeedback('O comprovante deve ter no máximo 5 MB.')
    submitRef.current = true; setEnviando(true); setFeedback('')
    try {
      const body = new FormData(); body.set('acao', 'PAGAR'); body.set('comprovante', comprovante)
      const response = await fetch(`/api/contas-pagar/${baixando.id}`, { method: 'PATCH', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível confirmar a baixa.')
      setBaixando(null); setComprovante(null); setFeedback('Pagamento baixado e comprovante protegido no bucket privado.'); await carregar()
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível confirmar a baixa.') }
    finally { submitRef.current = false; setEnviando(false) }
  }

  const abrirArquivo = async (contaId: string, tipo: 'boleto' | 'comprovante') => {
    const response = await fetch(`/api/contas-pagar/${contaId}/arquivo?tipo=${tipo}`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) return setFeedback(data.erro || 'Não foi possível abrir o arquivo.')
    window.open(data.url, '_blank', 'noopener,noreferrer')
  }

  const copiarLinha = async (conta: Conta) => {
    if (!conta.linhaDigitavel) return setFeedback('Esta conta não possui linha digitável cadastrada.')
    await navigator.clipboard.writeText(conta.linhaDigitavel)
    setFeedback('Linha digitável copiada. Confira beneficiário e valor no banco antes de autorizar.')
  }

  const salvarPortal = async () => {
    setEnviando(true); setFeedback('')
    try {
      const response = await fetch('/api/empresa/portal-financeiro', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: portalForm.nome || null, url: portalForm.url || null }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível salvar o portal.')
      setPortal(data.portalFinanceiro); setConfigurandoPortal(false); setFeedback('Portal financeiro atualizado.')
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar o portal.') }
    finally { setEnviando(false) }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 overflow-hidden">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: primary }}>Inteligência financeira operacional</p><h1 className="font-rajdhani text-2xl font-black uppercase sm:text-3xl">Contas a <span style={{ color: primary }}>pagar</span></h1><p className="mt-1 max-w-2xl text-xs text-foreground-muted sm:text-sm">Organize vencimentos e comprovantes. A autorização do pagamento sempre acontece no ambiente seguro do seu banco.</p></div>
        <div className="flex flex-col gap-2 min-[420px]:flex-row"><button type="button" onClick={() => setConfigurandoPortal(true)} className="min-h-11 border px-4 text-[10px] font-black uppercase" style={{ borderColor: 'var(--border)' }}><Building2 size={14} className="mr-2 inline" />Portal financeiro</button><button type="button" onClick={abrirFormularioCadastro} className="min-h-11 px-4 text-[10px] font-black uppercase text-black" style={{ backgroundColor: primary }}><Plus size={14} className="mr-2 inline" />Nova conta</button></div>
      </header>

      {feedback && <p role="status" className="border p-3 text-xs" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>{feedback}</p>}

      <section className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:grid-cols-4">
        <Resumo label="Total pendente" valor={moeda.format(resumo.total)} cor={primary} />
        <Resumo label="Urgentes / vencidas" valor={String(resumo.urgentes)} cor="#ef4444" />
        <Resumo label="Próximos 4 dias" valor={String(resumo.proximas)} cor="#f59e0b" />
        <Resumo label="Portal cadastrado" valor={portal?.nome ?? 'Não configurado'} cor={portal ? '#22c55e' : 'var(--foreground-muted)'} />
      </section>

      <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex overflow-x-auto">{(['PENDENTE', 'PAGO', 'TODOS'] as const).map((item) => <button key={item} type="button" onClick={() => setFiltro(item)} className="min-h-10 whitespace-nowrap border px-4 text-[10px] font-black uppercase" style={{ color: filtro === item ? '#000' : 'var(--foreground-muted)', backgroundColor: filtro === item ? primary : 'transparent', borderColor: filtro === item ? primary : 'var(--border)' }}>{item}</button>)}</div>
        {capacidades?.exportacaoLote && <Link href="/api/contas-pagar/exportar" download className="flex min-h-10 items-center justify-center border px-4 text-[10px] font-black uppercase" style={{ borderColor: 'var(--border)' }}><Download size={14} className="mr-2" />Exportar CSV</Link>}
      </div>

      {carregando ? <p className="py-16 text-center text-xs uppercase tracking-widest text-foreground-muted">Carregando contas...</p> : exibidas.length === 0 ? <div className="border border-dashed py-16 text-center" style={{ borderColor: 'var(--border)' }}><ReceiptText className="mx-auto mb-3 text-foreground-muted" /><p className="text-sm font-bold">Nenhuma conta nesta categoria.</p><p className="mt-1 text-xs text-foreground-muted">Cadastre o primeiro vencimento para iniciar a organização.</p></div> : (
        <div className="grid gap-3 xl:grid-cols-2">{exibidas.map((conta) => <ContaCard key={conta.id} conta={conta} capacidades={capacidades!} portal={portal} primary={primary} onCopiar={() => void copiarLinha(conta)} onArquivo={(tipo) => void abrirArquivo(conta.id, tipo)} onBaixar={() => setBaixando(conta)} />)}</div>
      )}

      {abrirCadastro && (
        <Modal titulo="Cadastrar conta a pagar" onClose={fecharFormularioCadastro}>
          <form onSubmit={cadastrar} className="space-y-4">
            {capacidades?.leituraAutomatica && (
              <label className="flex items-center justify-between gap-4 border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
                <span><strong className="block text-xs uppercase">Preenchimento automático</strong><span className="mt-1 block text-[11px] text-foreground-muted">Ler texto e, quando suportado, o código de barras neste dispositivo.</span></span>
                <input type="checkbox" role="switch" checked={preenchimentoAutomatico} onChange={(event) => alternarPreenchimentoAutomatico(event.target.checked)} className="h-5 w-5 accent-current" style={{ color: primary }} />
              </label>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
               <Campo label="Descrição *"><input required list="descricoes-conta-pagar" maxLength={160} placeholder={categoriaSelecionada?.descricoes[0] ?? 'Ex.: aluguel, salário ou serviço contratado'} value={form.descricao} onChange={(e) => atualizarCampoAuditado('descricao', e.target.value)} className="input-financeiro" /><datalist id="descricoes-conta-pagar">{categoriaSelecionada?.descricoes.map((descricao) => <option key={descricao} value={descricao} />)}</datalist></Campo>
              <Campo label="Beneficiário / fornecedor"><input maxLength={160} value={form.fornecedor} onChange={(e) => atualizarCampoAuditado('fornecedor', e.target.value)} className="input-financeiro" /></Campo>
              <Campo label="Vencimento *"><input type="date" required value={form.vencimento} onChange={(e) => atualizarCampoAuditado('vencimento', e.target.value)} className="input-financeiro" /></Campo>
              <Campo label="Valor *"><input type="number" inputMode="decimal" step="0.01" min="0.01" max="999999999.99" required value={form.valor} onChange={(e) => atualizarCampoAuditado('valor', e.target.value)} className="input-financeiro" /></Campo>
              <Campo label="Categoria opcional">
                <select value={form.categoria} onChange={(event) => {
                  const categoria = obterCategoriaContaPagar(event.target.value)
                  setForm((atual) => ({
                    ...atual,
                    categoria: event.target.value,
                    descricao: !atual.descricao || descricaoContaPagarEhSugestao(atual.descricao) ? categoria?.descricoes[0] || '' : atual.descricao,
                    veiculoId: categoria ? atual.veiculoId : '',
                    revisado: atual.origemLeitura === 'MANUAL' ? atual.revisado : false,
                  }))
                }} className="input-financeiro">
                  <option value="">Somente em Contas a Pagar</option>
                  {CATEGORIAS_CONTA_PAGAR.map((categoria) => <option key={categoria.valor} value={categoria.valor}>{categoria.rotulo}</option>)}
                </select>
              </Campo>
              {categoriaSelecionada && <Campo label={`Veículo ${categoriaSelecionada.requerVeiculo ? '*' : '(opcional)'}`}><select required={categoriaSelecionada.requerVeiculo} value={form.veiculoId} onChange={(event) => setForm({ ...form, veiculoId: event.target.value })} className="input-financeiro"><option value="">{categoriaSelecionada.requerVeiculo ? 'Selecione' : 'Despesa geral da empresa'}</option>{veiculos.map((veiculo) => <option key={veiculo.id} value={veiculo.id}>{veiculo.modelo} · {veiculo.placa}</option>)}</select></Campo>}
            </div>

            <Campo label="Código de barras / linha digitável (44, 47 ou 48 dígitos)"><input inputMode="numeric" maxLength={64} value={formatarLinhaDigitavel(form.linhaDigitavel)} onChange={(e) => atualizarCampoAuditado('linhaDigitavel', e.target.value)} className="input-financeiro font-mono" /></Campo>
            <Campo label="Boleto (PDF/JPG/PNG/WebP, até 5 MB)"><label className="flex min-h-12 cursor-pointer items-center justify-center border border-dashed px-3 text-center text-xs" style={{ borderColor: 'var(--border)' }}><Upload size={15} className="mr-2" />{lendoArquivo ? 'Analisando arquivo localmente...' : boleto?.name ?? 'Selecionar arquivo'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void selecionarBoleto(e.target.files?.[0] ?? null)} /></label></Campo>

            {capacidades?.leituraAutomatica ? <p className="text-[11px] text-foreground-muted">A leitura ocorre localmente: primeiro pela camada de texto e, se necessário, pelo código de barras visível nas três primeiras páginas. PDFs sem dados reconhecíveis continuam com preenchimento manual.</p> : <p className="border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-500">No Essencial, o boleto pode ser anexado, mas a leitura automática fica disponível a partir do Avançado.</p>}
            {categoriaSelecionada && <p className="border border-blue-500/30 bg-blue-500/5 p-3 text-[11px] text-blue-400">Integração: {categoriaSelecionada.integracao}. O lançamento será criado como despesa pendente e acompanhará a baixa do boleto.{categoriaSelecionada.valor === 'MANUTENCAO' ? ' Uma manutenção pendente também será criada para o veículo.' : ''}</p>}
            {categoriaSelecionada && !integracoes.custos && <p role="alert" className="border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-500">O módulo Controle & Gestão precisa estar ativo para alimentar Custos & Despesas.</p>}
            {categoriaSelecionada?.valor === 'MANUTENCAO' && !integracoes.frota && <p role="alert" className="border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-500">O módulo Frota precisa estar ativo para criar a manutenção.</p>}
            {form.origemLeitura !== 'MANUAL' && <label className="flex items-start gap-2 border border-amber-500/30 p-3 text-xs"><input type="checkbox" checked={form.revisado} onChange={(e) => setForm({ ...form, revisado: e.target.checked })} className="mt-0.5" /><span><strong className="block">Verifique e ateste que os dados preenchidos estão corretos antes de concluir.</strong> Comparei beneficiário, vencimento, valor e código com o documento original.</span></label>}
            <button disabled={enviando || lendoArquivo || (form.origemLeitura !== 'MANUAL' && !form.revisado) || Boolean(categoriaSelecionada && !integracoes.custos) || Boolean(categoriaSelecionada?.valor === 'MANUTENCAO' && !integracoes.frota)} className="min-h-12 w-full text-xs font-black uppercase text-black disabled:opacity-50" style={{ backgroundColor: primary }}>{enviando ? 'Salvando...' : 'Salvar conta'}</button>
          </form>
        </Modal>
      )}

      {baixando && <Modal titulo="Confirmar pagamento" onClose={() => !enviando && setBaixando(null)}><div className="space-y-4"><p className="text-sm"><strong>{baixando.descricao}</strong><br /><span className="text-foreground-muted">{moeda.format(baixando.valor)} · vencimento {new Date(`${baixando.vencimento}T12:00:00`).toLocaleDateString('pt-BR')}</span></p><p className="border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-500">Esta ação não movimenta dinheiro. Confirme somente depois de autorizar a operação no banco.</p><Campo label="Comprovante obrigatório (até 5 MB)"><input type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} className="input-financeiro file:mr-3 file:border-0 file:bg-transparent file:text-xs file:font-bold" /></Campo><button type="button" disabled={!comprovante || enviando} onClick={() => void confirmarBaixa()} className="min-h-12 w-full text-xs font-black uppercase text-black disabled:opacity-50" style={{ backgroundColor: primary }}><Check size={15} className="mr-2 inline" />{enviando ? 'Confirmando...' : 'Confirmar baixa'}</button></div></Modal>}

      {configurandoPortal && <Modal titulo="Portal financeiro" onClose={() => !enviando && setConfigurandoPortal(false)}><div className="space-y-4"><p className="text-xs text-foreground-muted">Cadastre somente o endereço HTTPS oficial do internet banking ou ERP. O RPMTRUCK nunca recebe sua senha bancária.</p><Campo label="Nome"><input maxLength={80} value={portalForm.nome} onChange={(e) => setPortalForm({ ...portalForm, nome: e.target.value })} placeholder="Ex.: Banco do Brasil PJ" className="input-financeiro" /></Campo><Campo label="Endereço HTTPS"><input type="url" maxLength={500} value={portalForm.url} onChange={(e) => setPortalForm({ ...portalForm, url: e.target.value })} placeholder="https://..." className="input-financeiro" /></Campo><button type="button" disabled={enviando} onClick={() => void salvarPortal()} className="min-h-12 w-full text-xs font-black uppercase text-black disabled:opacity-50" style={{ backgroundColor: primary }}>Salvar portal</button></div></Modal>}
    </div>
  )
}

function Resumo({ label, valor, cor }: { label: string; valor: string; cor: string }) { return <div className="min-w-0 border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><p className="text-[9px] font-black uppercase tracking-widest text-foreground-muted">{label}</p><p className="mt-2 truncate font-rajdhani text-xl font-black" style={{ color: cor }}>{valor}</p></div> }
function Campo({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider">{label}</span>{children}</label> }
function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4"><div role="dialog" aria-modal="true" aria-label={titulo} className="max-h-[92dvh] w-full overflow-y-auto border p-4 sm:max-w-2xl sm:p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}><div className="mb-5 flex items-center justify-between gap-4"><h2 className="font-rajdhani text-xl font-black uppercase">{titulo}</h2><button type="button" onClick={onClose} aria-label="Fechar" className="min-h-10 min-w-10 border" style={{ borderColor: 'var(--border)' }}><X size={17} className="mx-auto" /></button></div>{children}</div></div> }
function ContaCard({ conta, capacidades, portal, primary, onCopiar, onArquivo, onBaixar }: { conta: Conta; capacidades: Capacidades; portal: Portal | null; primary: string; onCopiar: () => void; onArquivo: (tipo: 'boleto' | 'comprovante') => void; onBaixar: () => void }) {
  const cores = capacidades.alertasVisuais ? { VERDE: '#22c55e', AMARELO: '#f59e0b', VERMELHO: '#ef4444' } : { VERDE: primary, AMARELO: primary, VERMELHO: primary }
  const prazo = conta.status !== 'PENDENTE' ? conta.status : conta.diasParaVencer < 0 ? `Vencida há ${Math.abs(conta.diasParaVencer)} dia(s)` : conta.diasParaVencer === 0 ? 'Vence hoje' : `Vence em ${conta.diasParaVencer} dia(s)`
  return <article className="border-l-4 border-y border-r p-4 sm:p-5" style={{ borderColor: 'var(--border)', borderLeftColor: cores[conta.nivel], backgroundColor: 'var(--background-secondary)' }}><div className="flex flex-col gap-3 min-[430px]:flex-row min-[430px]:items-start min-[430px]:justify-between"><div className="min-w-0"><p className="truncate font-black uppercase">{conta.descricao}</p><p className="mt-1 truncate text-xs text-foreground-muted">{conta.fornecedor || 'Fornecedor não informado'}</p></div><div className="shrink-0 min-[430px]:text-right"><p className="font-rajdhani text-xl font-black">{moeda.format(conta.valor)}</p><p className="text-[10px] font-black uppercase" style={{ color: conta.status === 'PENDENTE' ? cores[conta.nivel] : conta.status === 'PAGO' ? '#22c55e' : 'var(--foreground-muted)' }}>{prazo}</p></div></div>{conta.linhaDigitavelFormatada && <p className="mt-4 break-all border p-2 font-mono text-[10px] text-foreground-muted" style={{ borderColor: 'var(--border)' }}>{conta.linhaDigitavelFormatada}</p>}<div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{conta.possuiBoleto && <button type="button" onClick={() => onArquivo('boleto')} className="min-h-10 border px-3 text-[10px] font-bold uppercase" style={{ borderColor: 'var(--border)' }}><FileText size={13} className="mr-1 inline" />Boleto</button>}{conta.possuiComprovante && <button type="button" onClick={() => onArquivo('comprovante')} className="min-h-10 border px-3 text-[10px] font-bold uppercase" style={{ borderColor: 'var(--border)' }}><ReceiptText size={13} className="mr-1 inline" />Comprovante</button>}{conta.status === 'PENDENTE' && capacidades.copiarEAbrirPortal && conta.linhaDigitavel && <button type="button" onClick={onCopiar} className="min-h-10 border px-3 text-[10px] font-bold uppercase" style={{ borderColor: primary, color: primary }}><Copy size={13} className="mr-1 inline" />Copiar código</button>}{conta.status === 'PENDENTE' && capacidades.copiarEAbrirPortal && portal && <a href={portal.url} target="_blank" rel="noopener noreferrer" onClick={onCopiar} className="flex min-h-10 items-center justify-center border px-3 text-[10px] font-bold uppercase" style={{ borderColor: primary, color: primary }}><ExternalLink size={13} className="mr-1" />Abrir banco</a>}{conta.status === 'PENDENTE' && <button type="button" onClick={onBaixar} className="col-span-2 min-h-10 px-3 text-[10px] font-black uppercase text-black sm:ml-auto" style={{ backgroundColor: primary }}><Check size={13} className="mr-1 inline" />Dar baixa</button>}</div>{conta.status === 'PENDENTE' && !capacidades.copiarEAbrirPortal && <p className="mt-3 text-[10px] text-foreground-muted"><AlertTriangle size={12} className="mr-1 inline" />Cópia do código e abertura do portal disponíveis a partir do Avançado.</p>}</article>
}
