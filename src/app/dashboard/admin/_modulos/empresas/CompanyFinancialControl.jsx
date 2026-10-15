// src/app/admin/modules/companies/CompanyFinancialControl.jsx
'use client'
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Layers, Users, Truck, 
  CreditCard, Plus, Minus, ShieldAlert, Download, Trash2, Loader2
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { motion } from 'framer-motion';
import { ActionConfirmDialog } from '@/components/dashboard/ActionConfirmDialog';
import CompanyUsersManager from './CompanyUsersManager'; 
import CompanyVehiclesManager from './CompanyVehiclesManager';
import InitialDataImport from '@/components/dashboard/InitialDataImport';
import { MODULOS, MODULOS_CONFIG, obterModulosPadrao, PLANOS, PLANOS_CONFIG, adicionaisPadraoNaTrocaDePlano } from '@/utils/planos';

// ─── CONSTANTES DE PRECIFICAÇÃO E LIMITES ────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────

export default function CompanyFinancialControl({ empresa, onUpdate, onDeleted }) {
  const { primary } = useTheme();
  const [tabAtiva, setTabAtiva] = useState('geral');

  const [plano, setPlano] = useState(empresa.plano || 'ESSENCIAL');
  const [statusEmpresa, setStatusEmpresa] = useState(empresa.status || 'ATIVO');
  const [motivoStatus, setMotivoStatus] = useState(empresa.status_motivo || '');
  const [uExtra, setUExtra] = useState(empresa.usuarios_adicionais || 0);
  const [vExtra, setVExtra] = useState(empresa.veiculos_adicionais || 0);
  const [diaVencimento, setDiaVencimento] = useState(empresa.diaVencimento ?? 28);
  const [totalUsuarios, setTotalUsuarios] = useState(empresa._count?.usuarios ?? 0);
  const [financeiro, setFinanceiro] = useState(empresa.financeiro);
  const [modulosAtivos, setModulosAtivos] = useState(empresa.modulos || []);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [catalogoComercial, setCatalogoComercial] = useState([]);
  const [promocoes, setPromocoes] = useState([]);
  const [promocaoId, setPromocaoId] = useState(empresa.promocaoId || '');
  const [faturaParaLiquidar, setFaturaParaLiquidar] = useState(null);
  const [decisaoEstorno, setDecisaoEstorno] = useState(null);
  const [backupExclusaoToken, setBackupExclusaoToken] = useState('');
  const [backupExclusaoConfirmado, setBackupExclusaoConfirmado] = useState(false);
  const [retencoesAvaliadas, setRetencoesAvaliadas] = useState(false);
  const [senhaAdmin, setSenhaAdmin] = useState('');
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState('');
  const [motivoExclusao, setMotivoExclusao] = useState('');
  const [processandoExclusao, setProcessandoExclusao] = useState('');
  const [confirmacaoExclusaoAberta, setConfirmacaoExclusaoAberta] = useState(false);

  const config = PLANOS_CONFIG[plano];
  const comercial = catalogoComercial.find(item => item.id === plano);
  const promocaoSelecionada = promocoes.find(item => item.id === promocaoId);
  const precoUsuarioAdicional = comercial?.precoUsuarioAdicional ?? 25;
  const precoVeiculoAdicional = comercial?.precoVeiculoAdicional ?? 30;
  const taxaImplantacaoCatalogo = comercial?.taxaImplantacao ?? 0;
  const taxaImplantacaoAplicada = promocaoSelecionada?.plano === plano ? Number(promocaoSelecionada.taxaImplantacao) : taxaImplantacaoCatalogo;
  const mesmaCondicaoContratada = plano === empresa.plano && promocaoId === (empresa.promocaoId || '');
  const precoBaseAplicado = mesmaCondicaoContratada && empresa.mensalidade != null
    ? Number(empresa.mensalidade) - empresa.usuarios_adicionais * precoUsuarioAdicional - empresa.veiculos_adicionais * precoVeiculoAdicional
    : promocaoSelecionada?.plano === plano
      ? Number(promocaoSelecionada.precoBaseInicial)
      : Number(comercial?.precoBase ?? 0);
  const precoFoiAlterado = plano !== empresa.plano
    || uExtra !== empresa.usuarios_adicionais
    || vExtra !== empresa.veiculos_adicionais
    || promocaoId !== (empresa.promocaoId || '');
  const mensalidadeCalculada = !precoFoiAlterado && empresa.mensalidade != null
    ? Number(empresa.mensalidade)
    : (comercial
      ? precoBaseAplicado + uExtra * precoUsuarioAdicional + vExtra * precoVeiculoAdicional
      : Number(empresa.mensalidade ?? 0));

  const [faturas, setFaturas] = useState([]);

  useEffect(() => {
    fetch(`/api/empresas/${empresa.id}/faturas`, { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.erro); setFaturas(data.map(fatura => ({ ...fatura, status: fatura.status.toLowerCase() }))); }).catch(error => setFeedback(error.message || 'Falha ao carregar faturas.'));
    fetch('/api/admin/planos', { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.erro); setCatalogoComercial(Array.isArray(data.planos) ? data.planos : []); }).catch(error => setFeedback(error.message || 'Falha ao carregar catálogo comercial.'));
    fetch('/api/admin/promocoes', { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.erro); setPromocoes(Array.isArray(data.promocoes) ? data.promocoes : []); }).catch(error => setFeedback(error.message || 'Falha ao carregar promoções.'));
  }, [empresa.id]);

  // 1. Sincroniza módulos quando o plano muda
  const selecionarPlano = (novoPlano) => {
    const adicionais = adicionaisPadraoNaTrocaDePlano(plano, novoPlano, uExtra, vExtra);
    setUExtra(adicionais.usuariosAdicionais);
    setVExtra(adicionais.veiculosAdicionais);
    if (plano === 'PREVIEW' && novoPlano !== 'PREVIEW') setFeedback('As vagas gratuitas do Preview não são extras pagos. Confira a franquia e contrate adicionais somente se desejar. Nenhum usuário ou veículo será removido.');
    setPlano(novoPlano);
    if (promocaoSelecionada?.plano !== novoPlano) setPromocaoId('');
    setModulosAtivos(obterModulosPadrao(novoPlano));
  };

  // 2. Recálculo automático de faturas que ainda estão pendentes
  const toggleModulo = (mod) => {
    setModulosAtivos(prev => {
      if (prev.includes(mod)) {
        const restantes = prev.filter(m => m !== mod);
        return mod === 'FROTA' || mod === 'GESTAO'
          ? restantes.filter(m => m !== 'INTELIGENCIA')
          : restantes;
      }
      return mod === 'INTELIGENCIA'
        ? Array.from(new Set([...prev, 'FROTA', 'GESTAO', 'INTELIGENCIA']))
        : [...prev, mod];
    });
  };

  const salvarAlteracoes = async () => {
    if (salvando) return;
    if (!Number.isInteger(uExtra) || uExtra < 0 || uExtra > 10000 || !Number.isInteger(vExtra) || vExtra < 0 || vExtra > 100000) {
      setFeedback('Informe capacidades inteiras dentro dos limites indicados.');
      return;
    }
    setSalvando(true);
    setFeedback('');
    try {
      const response = await fetch(`/api/empresas/${empresa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plano,
          diaVencimento,
          status: statusEmpresa,
          status_motivo: statusEmpresa === 'ATIVO' ? null : motivoStatus,
          modulos: modulosAtivos,
          usuarios_adicionais: uExtra,
          veiculos_adicionais: vExtra,
          promocaoId: promocaoId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || 'Não foi possível salvar as alterações.');
      setFaturas((data.faturas || []).map(fatura => ({ ...fatura, status: fatura.status.toLowerCase() })));
      setFinanceiro(data.empresa.financeiro);
      await onUpdate?.({ ...data.empresa, mensalidade: data.mensalidade });
      setFeedback(`Configuração e cobrança sincronizadas. Mensalidade atual: R$ ${Number(data.mensalidade).toFixed(2)}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  };

  const liquidarFatura = async (fatura) => {
    setSalvando(true);
    setFeedback('');
    try {
      const response = await fetch(`/api/faturas/${fatura.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'PAGO' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || 'Não foi possível dar baixa na fatura.');
      setFaturas(prev => prev.map(item => item.id === fatura.id ? { ...item, ...data, status: 'pago' } : item));
      setFeedback('Pagamento confirmado e registrado no histórico.');
      setFinanceiro(data.financeiro);
      await onUpdate?.();
      setFaturaParaLiquidar(null);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível dar baixa na fatura.');
    } finally {
      setSalvando(false);
    }
  };

  const decidirEstorno = async () => {
    if (!decisaoEstorno || salvando) return;
    setSalvando(true);
    setFeedback('');
    try {
      const body = { acaoEstorno: decisaoEstorno.acao };
      if (decisaoEstorno.acao === 'RECOBRAR') body.vencimento = new Date(`${decisaoEstorno.vencimento}T23:59:59-03:00`).toISOString();
      const response = await fetch(`/api/faturas/${decisaoEstorno.fatura.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || 'Não foi possível tratar o estorno.');
      setFaturas(prev => prev.map(item => item.id === data.id ? { ...item, ...data, status: data.status.toLowerCase() } : item));
      setFinanceiro(data.financeiro);
      setFeedback(decisaoEstorno.acao === 'RECOBRAR'
        ? 'Fatura preparada para uma nova cobrança. O pagamento anterior não será reutilizado.'
        : 'Obrigação encerrada. O estorno permanecerá no histórico e não bloqueará o acesso.');
      setDecisaoEstorno(null);
      await onUpdate?.();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível tratar o estorno.');
    } finally {
      setSalvando(false);
    }
  };

  const fraseExclusao = `EXCLUIR ${empresa.nome}`;
  const exclusaoPronta = Boolean(
    backupExclusaoToken &&
    backupExclusaoConfirmado &&
    retencoesAvaliadas &&
    motivoExclusao.trim().length >= 5 &&
    confirmacaoExclusao === fraseExclusao &&
    senhaAdmin
  );

  const baixarBackupExclusao = async () => {
    if (processandoExclusao) return;
    setProcessandoExclusao('backup');
    setFeedback('');
    setBackupExclusaoToken('');
    setBackupExclusaoConfirmado(false);
    try {
      const response = await fetch(`/api/admin/empresas/${empresa.id}/exclusao-conta/exportar`, {
        method: 'POST',
        cache: 'no-store',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.erro || 'Não foi possível gerar a cópia dos dados.');
      }

      const token = response.headers.get('X-RPMTruck-Backup-Token');
      if (!token) throw new Error('A cópia foi gerada sem o comprovante de segurança. Gere novamente.');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const filename = contentDisposition.match(/filename="([^"]+)"/i)?.[1] || `copia-dados-${empresa.nome}.xlsx`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setBackupExclusaoToken(token);
      setFeedback('Cópia dos dados gerada. Localize e abra o arquivo antes de confirmar o encerramento.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível gerar a cópia dos dados.');
    } finally {
      setProcessandoExclusao('');
    }
  };

  const excluirEmpresa = async () => {
    if (!exclusaoPronta || processandoExclusao) return;
    setProcessandoExclusao('exclusao');
    setFeedback('');
    try {
      const response = await fetch(`/api/admin/empresas/${empresa.id}/exclusao-conta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senha: senhaAdmin,
          confirmacao: confirmacaoExclusao,
          backupToken: backupExclusaoToken,
          backupConfirmado: backupExclusaoConfirmado,
          retencoesAvaliadas,
          motivo: motivoExclusao.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 202) {
        throw new Error(data.erro || 'Não foi possível encerrar a conta.');
      }

      setConfirmacaoExclusaoAberta(false);
      await onDeleted?.(data);
    } catch (error) {
      setConfirmacaoExclusaoAberta(false);
      setFeedback(error instanceof Error ? error.message : 'Não foi possível encerrar a conta.');
    } finally {
      setProcessandoExclusao('');
    }
  };

  const Abas = [
    { id: 'geral', label: 'VISÃO GERAL', icon: <LayoutDashboard size={14}/> },
    { id: 'plano', label: 'MÓDULOS & PLANO', icon: <Layers size={14}/> },
    { id: 'usuarios', label: 'USUÁRIOS DA EMPRESA', icon: <Users size={14}/> },
    { id: 'veiculos', label: 'VEÍCULOS', icon: <Truck size={14}/> },
    { id: 'importacao', label: empresa.importacao_inicial?.status === 'PENDENTE' ? 'IMPORTAÇÃO PENDENTE' : 'IMPORTAÇÃO INICIAL', icon: <Plus size={14}/> },
    { id: 'pagamentos', label: 'PAGAMENTOS', icon: <CreditCard size={14}/> },
    { id: 'encerramento', label: 'ENCERRAMENTO', icon: <ShieldAlert size={14}/> },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER DA EMPRESA */}
      <div className="flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-start" style={{borderColor: 'var(--border)'}}>
        <div className="flex min-w-0 gap-3 sm:gap-4">
          <div className="hidden w-12 h-12 bg-primary/10 border sm:flex items-center justify-center text-primary" style={{borderColor: primary}}>
            <Truck size={24} />
          </div>
          <div>
            <h2 className="break-words text-2xl font-black font-rajdhani uppercase leading-none sm:text-3xl">{empresa.nome}</h2>
            <p className="mt-1 break-all text-[10px] opacity-50 font-mono sm:text-xs">GESTÃO E FINANÇAS • {empresa.email}</p>
          </div>
        </div>
        <div className="w-full space-y-2 sm:min-w-[220px] sm:w-auto">
          <select
            value={statusEmpresa}
            onChange={(event) => setStatusEmpresa(event.target.value)}
            aria-label="Status de acesso da empresa"
            className="w-full bg-transparent border border-border text-[10px] p-2 font-black uppercase tracking-widest cursor-pointer outline-none hover:border-primary transition-colors"
            style={{ color: 'var(--foreground)', backgroundColor: 'var(--background)' }}
          >
            <option value="ATIVO">ATIVO</option>
            <option value="INADIMPLENTE">INADIMPLENTE</option>
            <option value="INATIVO">INATIVO</option>
          </select>
          {statusEmpresa !== 'ATIVO' && (
            <input
              value={motivoStatus}
              onChange={(event) => setMotivoStatus(event.target.value)}
              maxLength={500}
              placeholder="Motivo da suspensão"
              aria-label="Motivo da suspensão"
              className="w-full bg-transparent border border-border p-2 text-xs outline-none focus:border-primary"
            />
          )}
        </div>
      </div>

      {/* NAVEGAÇÃO ENTRE ABAS */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="USUÁRIOS / LIMITE" val={`${totalUsuarios} / ${config.usuariosBase + uExtra}`} sub="Inclui gestor e contas não excluídas" />
        <StatCard label="VAGAS DISPONÍVEIS" val={Math.max(0, config.usuariosBase + uExtra - totalUsuarios)} sub={totalUsuarios > config.usuariosBase + uExtra ? 'Uso acima da franquia; novos cadastros bloqueados' : 'Capacidade com o plano selecionado'} />
        <StatCard label="SITUAÇÃO FINANCEIRA" val={financeiro?.descricao ?? 'Carregando'} sub={financeiro?.bloqueado ? 'Acesso bloqueado' : financeiro?.situacao === 'AGUARDANDO_PAGAMENTO_INICIAL' && empresa.pagamentoInicialVenceEm ? `Prazo inicial: ${new Date(empresa.pagamentoInicialVenceEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : 'Cobrança independente da suspensão manual'} />
      </div>
      <div className="flex gap-1 border-b overflow-x-auto custom-scrollbar" style={{borderColor: 'var(--border)'}}>
        {Abas.map(aba => (
          <button key={aba.id} onClick={() => setTabAtiva(aba.id)} className="px-4 py-3 text-[10px] font-black tracking-widest flex items-center gap-2 transition-all relative whitespace-nowrap" style={{ color: tabAtiva === aba.id ? primary : 'var(--foreground-muted)' }}>
            {aba.icon} {aba.label}
            {tabAtiva === aba.id && <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" style={{backgroundColor: primary}} />}
          </button>
        ))}
      </div>

      {/* CONTEÚDO DINÂMICO DAS ABAS */}
      <div className="py-4">
        {tabAtiva === 'importacao' && <InitialDataImport admin empresaId={empresa.id} onApproved={() => void onUpdate?.()} />}
        {tabAtiva === 'geral' && (
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard label="VEÍCULOS" val={`${empresa._count?.veiculos_frota ?? 0} / ${config.veiculosBase + vExtra}`} sub="Frota atual" />
              <StatCard label="MOTORISTAS" val={empresa._count?.motoristas ?? 0} sub="Cadastrados" />
              <StatCard label="MENSALIDADE" val={plano === 'PREVIEW' ? 'GRÁTIS' : `R$ ${mensalidadeCalculada.toFixed(2)}`} sub="Valor recorrente" className={plano === 'PREVIEW' ? 'text-blue-500' : ''} />
              <StatCard label="TOTAL PAGO" val={`R$ ${empresa.total_pago_historico || '0,00'}`} sub="Acumulado" />
           </div>
        )}

        {tabAtiva === 'plano' && (
          <div className="border p-4 space-y-6 sm:p-8 sm:space-y-8" style={{borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)'}}>
             <section>
                <label className="text-[10px] font-black opacity-50 block mb-4 tracking-[0.3em]">PLANO BASE</label>
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
                   {PLANOS.map(p => (
                      <button key={p} onClick={() => selecionarPlano(p)} className={`p-4 border text-left transition-all ${plano === p ? 'bg-primary text-black' : 'opacity-40 hover:opacity-100'}`} style={{borderColor: plano === p ? primary : 'var(--border)'}}>
                        <p className="text-[10px] font-bold">PLANO</p>
                        <h4 className="font-black text-lg">{p}</h4>
                      </button>
                   ))}
                </div>
                {plano !== 'PREVIEW' && (
                  <div className="mt-5 border p-4" style={{ borderColor: 'var(--border)' }}>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted">Condição promocional
                      <select value={promocaoId} onChange={event => setPromocaoId(event.target.value)} className="mt-2 w-full border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary">
                        <option value="">Sem promoção</option>
                        {promocoes.filter(item => item.ativa && item.plano === plano && (item.escopo !== 'NOVAS_EMPRESAS' || item.id === empresa.promocaoId)).map(item => (
                          <option key={item.id} value={item.id}>{item.nome}</option>
                        ))}
                      </select>
                    </label>
                    {promocaoSelecionada && (
                      <p className="mt-3 text-xs text-foreground-muted">
                        {Number(promocaoSelecionada.precoBaseInicial).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por {promocaoSelecionada.mesesPrecoInicial} mês(es), depois {Number(promocaoSelecionada.precoBaseRenovacao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês. Implantação: {Number(promocaoSelecionada.taxaImplantacao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.
                      </p>
                    )}
                  </div>
                )}
                {plano === 'PREVIEW' && (
                  <div className="mt-4 space-y-3 border p-4" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs font-bold">Capacidade do Preview</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs">Total de usuários (inclui o gestor)
                        <input type="number" min="1" max="10001" step="1" value={Number.isNaN(uExtra) ? '' : uExtra + 1} onChange={event => setUExtra(event.target.value === '' ? NaN : Number(event.target.value) - 1)} className="mt-2 w-full border bg-background p-3 text-foreground" />
                      </label>
                      <label className="text-xs">Total de veículos
                        <input type="number" min="0" max="100000" step="1" value={Number.isNaN(vExtra) ? '' : vExtra} onChange={event => setVExtra(event.target.value === '' ? NaN : Number(event.target.value))} className="mt-2 w-full border bg-background p-3 text-foreground" />
                      </label>
                    </div>
                    <p className="text-xs text-foreground-muted">Salve as alterações para aplicar os limites. Reduzir a capacidade não apaga registros existentes, mas impede novos cadastros até haver vagas. Zero veículos bloqueia novos cadastros de frota.</p>
                  </div>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="border p-3" style={{borderColor: 'var(--border)'}}><p className="text-[9px] font-black uppercase tracking-widest opacity-50">Mensalidade calculada</p><p className="mt-1 font-rajdhani text-xl font-black">R$ {mensalidadeCalculada.toFixed(2)}</p></div>
                  <div className="border p-3" style={{borderColor: 'var(--border)'}}><p className="text-[9px] font-black uppercase tracking-widest opacity-50">Implantação contratada</p><p className="mt-1 font-rajdhani text-xl font-black">R$ {Number(taxaImplantacaoAplicada).toFixed(2)}</p></div>
                </div>
                <p className="mt-3 text-[10px] text-foreground-muted">Ao salvar, a mensalidade pendente da competência atual será sincronizada. A implantação só é criada no onboarding e nunca altera uma cobrança já paga.</p>
                <p className="mt-3 text-xs text-foreground-muted">Composição: base {precoBaseAplicado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} + {uExtra} usuários × R$ {precoUsuarioAdicional} + {vExtra} veículos × R$ {precoVeiculoAdicional}. Implantação cobrada separadamente.</p>
                <label className="mt-4 block text-xs font-bold">Vencimento escolhido pela empresa
                  <select value={diaVencimento} onChange={event => setDiaVencimento(Number(event.target.value))} className="mt-2 w-full border border-border bg-background p-3 text-foreground">
                    {Array.from({ length: 28 }, (_, index) => index + 1).map(dia => <option key={dia} value={dia}>Todo dia {dia}{dia === 28 ? ' (padrão)' : ''}</option>)}
                  </select>
                </label>
                <p className="mt-2 text-xs text-foreground-muted">Três dias para o primeiro pagamento. A alteração do dia vale para novas cobranças; não muda vencimentos de faturas já emitidas.</p>
             </section>
             <section>
                <label className="text-[10px] font-black opacity-50 block mb-4 tracking-[0.3em]">MÓDULOS ATIVOS</label>
                <div className="space-y-2 max-w-md">
                   {MODULOS.map(mod => (
                      <label key={mod} className={`flex cursor-pointer items-start justify-between gap-4 border p-3 transition-all ${modulosAtivos.includes(mod) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                         <span><strong className={`block text-sm ${modulosAtivos.includes(mod) ? 'text-primary' : ''}`}>{MODULOS_CONFIG[mod].nome}</strong><small className="mt-1 block text-[10px] leading-relaxed text-foreground-muted">{MODULOS_CONFIG[mod].descricao}</small></span>
                         <input type="checkbox" checked={modulosAtivos.includes(mod)} onChange={() => toggleModulo(mod)} className="mt-1 accent-primary" />
                      </label>
                   ))}
                </div>
             </section>
          </div>
        )}

        {tabAtiva === 'usuarios' && (
          <div className="space-y-6">
             {plano !== 'PREVIEW' && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CounterCard label="LICENÇAS EXTRAS" desc={`Custo: R$ ${Number(precoUsuarioAdicional).toFixed(2)}/cada`} val={uExtra} setVal={setUExtra} />
                <CounterCard label="VEÍCULOS EXTRAS" desc={`Custo: R$ ${Number(precoVeiculoAdicional).toFixed(2)}/cada`} val={vExtra} setVal={setVExtra} />
             </div>}
             {plano === 'PREVIEW' && <p className="text-xs text-foreground-muted">Ajuste os totais de usuários e veículos na aba Módulos &amp; Plano.</p>}
             <CompanyUsersManager empresa={empresa} limiteTotal={config.usuariosBase + uExtra} primary={primary} onUsageChange={setTotalUsuarios} />
          </div>
        )}

        {tabAtiva === 'veiculos' && (
          <CompanyVehiclesManager empresa={empresa} limiteTotal={config.veiculosBase + vExtra} primary={primary} />
        )}

        {tabAtiva === 'pagamentos' && (
           <div className="space-y-6">
             <p className="text-xs text-foreground-muted">Os valores pendentes da competência atual são sincronizados automaticamente ao salvar o plano. Cobranças pagas e competências anteriores não são reprecificadas.</p>
             <div className="space-y-3 sm:hidden">
               {faturas.length === 0 && <p className="border p-8 text-center text-xs opacity-50" style={{borderColor: 'var(--border)'}}>Nenhuma fatura registrada.</p>}
               {faturas.map(f => (
                 <article key={f.id} className="border p-4" style={{borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)'}}>
                   <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold">{f.mes} / {f.ano}</p><p className="mt-1 text-[10px] font-black uppercase opacity-60">{f.tipo === 'IMPLEMENTACAO' ? 'TAXA DE CONFIGURAÇÃO' : f.tipo}</p></div><span className={`border px-2 py-1 text-[9px] font-black uppercase ${classeStatusFatura(f.status)}`}>{rotuloStatusFatura(f.status)}</span></div>
                   <p className="my-4 font-rajdhani text-2xl font-black">R$ {Number(f.valor).toFixed(2)}</p>
                   <p className="mb-3 text-xs text-foreground-muted">{f.vencimento ? `Pagar até ${new Date(new Date(f.vencimento).getTime() - 1).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}` : 'Vencimento não definido (legado)'}</p>
                   {f.status === 'pendente' ? <button type="button" disabled={salvando} onClick={() => { setFeedback(''); setFaturaParaLiquidar(f) }} className="min-h-11 w-full border text-[10px] font-black uppercase hover:border-green-500 hover:text-green-500 disabled:opacity-50" style={{borderColor: 'var(--border)'}}>Confirmar pagamento</button>
                     : f.status === 'estornada' ? <AcoesEstorno fatura={f} disabled={salvando} onDecidir={setDecisaoEstorno} />
                       : <p className={`text-[10px] font-bold ${f.status === 'pago' ? 'text-green-500' : 'text-foreground-muted'}`}>{f.status === 'pago' ? '✓ RECEBIMENTO CONFERIDO' : 'OBRIGAÇÃO ENCERRADA'}</p>}
                 </article>
               ))}
             </div>
             <div className="hidden overflow-x-auto border sm:block" style={{borderColor: 'var(--border)'}}>
                <table className="min-w-[780px] w-full text-left border-collapse">
                   <thead className="bg-background-secondary border-b" style={{borderColor: 'var(--border)'}}>
                      <tr>{['REFERÊNCIA', 'TIPO', 'VALOR (R$)', 'STATUS', 'COMPROVANTE', 'AÇÃO'].map(h => <th key={h} className="px-5 py-3 text-[10px] font-black tracking-widest opacity-60">{h}</th>)}</tr>
                   </thead>
                   <tbody>
                      {faturas.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-xs opacity-50">Nenhuma fatura registrada para esta empresa.</td></tr>}
                      {faturas.map((f) => (
                         <tr key={f.id} className="border-b last:border-0 hover:bg-black/5 text-sm" style={{borderColor: 'var(--border)'}}>
                            <td className="px-5 py-4 font-mono font-bold">{f.mes} / {f.ano}<p className="mt-1 text-[10px] font-normal text-foreground-muted">{f.vencimento ? `Pagar até ${new Date(new Date(f.vencimento).getTime() - 1).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}` : 'Vencimento não definido (legado)'}</p></td>
                            <td className="px-5 py-4 text-[10px] font-black uppercase opacity-70">
                               {f.tipo === 'IMPLEMENTACAO' ? 'TAXA DE CONFIGURAÇÃO' : f.tipo}
                            </td>
                            
                            {/* VALOR EDITÁVEL SE TIVER PENDENTE */}
                            <td className="px-5 py-4 font-mono text-xs font-black">
                               R$ {Number(f.valor).toFixed(2)}
                            </td>

                            <td className="px-5 py-4">
                               <span className={`text-[9px] px-2 py-1 border font-black uppercase ${classeStatusFatura(f.status)}`}>
                                  {rotuloStatusFatura(f.status)}
                               </span>
                            </td>

                            {/* COLUNA DE COMPROVANTE ATUALIZADA */}
                            <td className="px-5 py-4">
                               {f.comprovantePath || f.comprovanteUrl ? (
                                  <a 
                                    href={f.comprovantePath ? `/api/admin/faturas/${f.id}/comprovante` : f.comprovanteUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] font-black tracking-wider text-primary border-b border-primary/30 hover:border-primary transition-colors uppercase"
                                  >
                                    📄 Ver PDF
                                  </a>
                               ) : (
                                  <span className="text-[10px] font-black opacity-40 uppercase">Sem comprovante</span>
                               )}
                            </td>

                            <td className="px-5 py-4">
                               {f.status === 'pendente' ? (
                                 <button 
                                   onClick={() => { setFeedback(''); setFaturaParaLiquidar(f) }}
                                   disabled={salvando}
                                   className="px-3 py-1.5 text-[10px] font-black border hover:border-green-500 hover:text-green-500 transition-all"
                                   style={{ borderColor: 'var(--border)' }}
                                 >
                                   DAR BAIXA
                                 </button>
                               ) : f.status === 'estornada' ? (
                                 <AcoesEstorno fatura={f} disabled={salvando} onDecidir={setDecisaoEstorno} compact />
                               ) : (
                                 <span className={`flex items-center gap-1 text-[10px] font-bold ${f.status === 'pago' ? 'text-green-500/60' : 'text-foreground-muted'}`}>{f.status === 'pago' ? '✓ CONFERIDO' : 'ENCERRADA'}</span>
                               )}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           </div>
        )}

        {tabAtiva === 'encerramento' && (
          <section className="border border-red-500/50 bg-red-500/[0.03]">
            <div className="border-b border-red-500/30 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center border border-red-500/60 text-red-500">
                  <ShieldAlert size={21} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-red-500">Zona de risco</p>
                  <h3 className="mt-1 font-rajdhani text-xl font-black uppercase sm:text-2xl">Encerrar e excluir a conta</h3>
                  <p className="mt-2 max-w-3xl text-xs leading-relaxed text-foreground-muted">
                    Esta operação remove os dados operacionais da empresa e anonimiza os registros mínimos preservados para segurança, auditoria e obrigações legais. Ela não pode ser desfeita.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
              <div className="space-y-4 border p-4 sm:p-5" style={{borderColor: 'var(--border)'}}>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">Etapa 1</p>
                  <h4 className="mt-1 font-rajdhani text-lg font-black uppercase">Gerar cópia dos dados</h4>
                  <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                    O arquivo Excel não inclui senhas nem credenciais. Ele contém dados pessoais e deve ser conferido e entregue por canal protegido.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(processandoExclusao)}
                  onClick={() => void baixarBackupExclusao()}
                  className="flex min-h-11 w-full items-center justify-center gap-2 border px-4 text-[10px] font-black uppercase transition-colors hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-50"
                  style={{borderColor: 'var(--border)'}}
                >
                  {processandoExclusao === 'backup' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
                  {processandoExclusao === 'backup' ? 'Gerando arquivo...' : backupExclusaoToken ? 'Gerar nova cópia' : 'Gerar e baixar cópia'}
                </button>
                <label className={`flex items-start gap-3 border p-3 text-xs ${backupExclusaoToken ? '' : 'cursor-not-allowed opacity-40'}`} style={{borderColor: 'var(--border)'}}>
                  <input type="checkbox" className="mt-0.5 accent-primary" disabled={!backupExclusaoToken} checked={backupExclusaoConfirmado} onChange={event => setBackupExclusaoConfirmado(event.target.checked)} />
                  <span>Localizei e abri o arquivo gerado para esta empresa.</span>
                </label>
              </div>

              <div className="space-y-4 border p-4 sm:p-5" style={{borderColor: 'var(--border)'}}>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">Etapa 2</p>
                  <h4 className="mt-1 font-rajdhani text-lg font-black uppercase">Confirmar encerramento</h4>
                </div>
                <label className="flex items-start gap-3 border p-3 text-xs" style={{borderColor: 'var(--border)'}}>
                  <input type="checkbox" className="mt-0.5 accent-red-500" checked={retencoesAvaliadas} onChange={event => setRetencoesAvaliadas(event.target.checked)} />
                  <span>Avaliei pendências contratuais, fiscais, trabalhistas e as retenções legais aplicáveis.</span>
                </label>
                <label className="block text-[10px] font-black uppercase tracking-wider">
                  Motivo do encerramento
                  <textarea value={motivoExclusao} onChange={event => setMotivoExclusao(event.target.value)} minLength={5} maxLength={500} rows={3} placeholder="Ex.: ambiente de teste encerrado" className="mt-2 w-full resize-y border bg-background p-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-red-500" style={{borderColor: 'var(--border)'}} />
                </label>
                <label className="block text-[10px] font-black uppercase tracking-wider">
                  Digite exatamente: <span className="select-all text-red-500">{fraseExclusao}</span>
                  <input value={confirmacaoExclusao} onChange={event => setConfirmacaoExclusao(event.target.value)} autoComplete="off" className="mt-2 w-full border bg-background p-3 font-mono text-sm normal-case tracking-normal text-foreground outline-none focus:border-red-500" style={{borderColor: 'var(--border)'}} />
                </label>
                <label className="block text-[10px] font-black uppercase tracking-wider">
                  Sua senha de administrador
                  <input type="password" value={senhaAdmin} onChange={event => setSenhaAdmin(event.target.value)} autoComplete="current-password" className="mt-2 w-full border bg-background p-3 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-red-500" style={{borderColor: 'var(--border)'}} />
                </label>
                <button type="button" disabled={!exclusaoPronta || Boolean(processandoExclusao)} onClick={() => setConfirmacaoExclusaoAberta(true)} className="flex min-h-11 w-full items-center justify-center gap-2 bg-red-600 px-4 text-[10px] font-black uppercase text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-35">
                  <Trash2 size={15} aria-hidden="true" />
                  Revisar exclusão definitiva
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* BOTÃO FIXO SALVAR */}
      {tabAtiva !== 'encerramento' && <div className="flex justify-end pt-6 border-t mt-4" style={{borderColor: 'var(--border)'}}>
         <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
           {feedback && <p className="text-xs" role="status">{feedback}</p>}
           <button
             onClick={salvarAlteracoes}
             disabled={salvando}
             className="min-h-12 bg-primary text-black px-8 py-3 font-black text-xs hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
             style={{backgroundColor: primary}}
           >
             {salvando ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
           </button>
         </div>
      </div>}

      <ActionConfirmDialog
        open={Boolean(faturaParaLiquidar)}
        tone="warning"
        eyebrow="Confirmação financeira"
        title="Registrar recebimento"
        description={faturaParaLiquidar ? `Confirme o recebimento de R$ ${Number(faturaParaLiquidar.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. A baixa ficará vinculada ao seu usuário no histórico.` : ''}
        confirmLabel="Confirmar recebimento"
        loadingLabel="Registrando..."
        loading={salvando}
        onClose={() => setFaturaParaLiquidar(null)}
        onConfirm={() => { if (faturaParaLiquidar) void liquidarFatura(faturaParaLiquidar) }}
      />
      <ActionConfirmDialog
        open={Boolean(decisaoEstorno)}
        tone={decisaoEstorno?.acao === 'ENCERRAR' ? 'danger' : 'warning'}
        eyebrow="Decisão sobre estorno"
        title={decisaoEstorno?.acao === 'ENCERRAR' ? 'Encerrar obrigação' : 'Preparar nova cobrança'}
        description={decisaoEstorno?.acao === 'ENCERRAR'
          ? 'A fatura ficará encerrada no histórico, sem valor pendente e sem bloquear o acesso da empresa.'
          : `O pagamento estornado não será reutilizado. A fatura voltará a ficar pendente com vencimento em ${decisaoEstorno?.vencimento ? new Date(`${decisaoEstorno.vencimento}T12:00:00`).toLocaleDateString('pt-BR') : 'data não informada'}, e o cliente poderá gerar uma cobrança nova.`}
        confirmLabel={decisaoEstorno?.acao === 'ENCERRAR' ? 'Encerrar obrigação' : 'Preparar recobrança'}
        loadingLabel="Registrando decisão..."
        loading={salvando}
        onClose={() => { if (!salvando) setDecisaoEstorno(null) }}
        onConfirm={() => void decidirEstorno()}
      />
      <ActionConfirmDialog
        open={confirmacaoExclusaoAberta}
        tone="danger"
        eyebrow="Exclusão definitiva"
        title={`Excluir ${empresa.nome}`}
        description="A conta, os acessos e os dados operacionais serão removidos. Registros mínimos sujeitos a retenção serão anonimizados e o protocolo ficará na auditoria. Esta ação não pode ser desfeita."
        confirmLabel="Excluir conta definitivamente"
        loadingLabel="Excluindo conta..."
        loading={processandoExclusao === 'exclusao'}
        onClose={() => setConfirmacaoExclusaoAberta(false)}
        onConfirm={() => void excluirEmpresa()}
      />
    </div>
  );
}

function StatCard({ label, val, sub, className = '' }) {
  return (
    <div className="p-5 border bg-background-secondary" style={{borderColor: 'var(--border)'}}>
      <p className="text-[9px] font-black opacity-50 tracking-widest mb-2">{label}</p>
      <h3 className={`text-2xl font-black font-rajdhani ${className}`}>{val}</h3>
      <p className="text-[10px] opacity-40 mt-1">{sub}</p>
    </div>
  );
}

function classeStatusFatura(status) {
  if (status === 'pago') return 'border-green-500/20 bg-green-500/5 text-green-500'
  if (status === 'estornada') return 'border-amber-500/30 bg-amber-500/5 text-amber-500'
  if (status === 'cancelada') return 'border-slate-500/30 text-foreground-muted'
  return 'border-red-500/20 bg-red-500/5 text-red-500'
}

function rotuloStatusFatura(status) {
  if (status === 'estornada') return 'Estornada · decisão pendente'
  if (status === 'cancelada') return 'Obrigação encerrada'
  return status
}

function AcoesEstorno({ fatura, disabled, onDecidir, compact = false }) {
  const [vencimento, setVencimento] = useState('')
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  return (
    <div className={`flex gap-2 ${compact ? 'min-w-56 flex-col' : 'flex-col'}`}>
      <p className="text-[10px] leading-relaxed text-foreground-muted">O valor foi devolvido. Escolha se haverá uma nova cobrança.</p>
      <label className="text-[9px] font-bold uppercase text-foreground-muted">Novo vencimento
        <input type="date" min={hoje} value={vencimento} onChange={event => setVencimento(event.target.value)} className="mt-1 min-h-10 w-full border bg-background px-2 text-xs text-foreground" style={{ borderColor: 'var(--border)' }} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={disabled || !vencimento} onClick={() => onDecidir({ fatura, acao: 'RECOBRAR', vencimento })} className="min-h-10 border border-amber-500/40 px-2 text-[9px] font-black uppercase text-amber-500 disabled:opacity-40">Nova cobrança</button>
        <button type="button" disabled={disabled} onClick={() => onDecidir({ fatura, acao: 'ENCERRAR' })} className="min-h-10 border px-2 text-[9px] font-black uppercase text-foreground-muted disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>Encerrar</button>
      </div>
    </div>
  )
}

function CounterCard({ label, desc, val, setVal }) {
  return (
    <div className="p-6 border bg-background-secondary" style={{borderColor: 'var(--border)'}}>
      <h4 className="text-[10px] font-black mb-1">{label}</h4>
      <p className="text-[10px] opacity-40 mb-4">{desc}</p>
      <div className="flex items-center gap-4">
        <button onClick={() => setVal(Math.max(0, val - 1))} className="p-2 border" style={{borderColor: 'var(--border)'}}><Minus size={14}/></button>
        <span className="text-2xl font-black font-mono w-10 text-center">{val}</span>
        <button onClick={() => setVal(val + 1)} className="p-2 border" style={{borderColor: 'var(--border)'}}><Plus size={14}/></button>
      </div>
    </div>
  );
}
