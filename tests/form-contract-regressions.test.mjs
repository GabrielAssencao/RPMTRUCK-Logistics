import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('tutoriais ficam após o chat e estão disponíveis sem ampliar permissões', () => {
  const layout = read('src/app/dashboard/empresa/layout.tsx')
  const page = read('src/app/dashboard/empresa/tutoriais/page.tsx')
  const tools = layout.slice(layout.indexOf('aria-label="Abrir suporte e tickets"'))
  assert.ok(tools.indexOf('aria-label="Abrir tutoriais"') < tools.indexOf('<NotificacoesPanel'))
  assert.match(layout, /TUTORIAIS_ITEM: NavEmpresaItem = \{[^\n]*modulo: null/)
  assert.doesNotMatch(layout.match(/TUTORIAIS_ITEM: NavEmpresaItem = [^\n]*/)[0], /somenteGestor/)
  assert.match(page, /TUTORIAIS_SUPORTE.map/)
  assert.match(page, /<details[\s\S]*<summary/)
  assert.match(page, /Os recursos disponíveis dependem do seu papel/)
})

test('cada tutorial tem passos, explicação e dica com identificador único', async () => {
  const typescript = await import('typescript')
  const js = typescript.transpileModule(read('src/data/tutoriais.ts'), {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
  }).outputText
  const { TUTORIAIS_MODULOS } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  assert.equal(new Set(TUTORIAIS_MODULOS.map(item => item.id)).size, TUTORIAIS_MODULOS.length)
  for (const item of TUTORIAIS_MODULOS) {
    assert.ok(item.passos.length >= 3, item.titulo)
    assert.ok(item.objetivo && item.logica && item.dica, item.titulo)
    assert.match(item.id, /^[a-z-]+$/)
  }
  for (const id of ['frota', 'motoristas', 'containers', 'custos', 'contas-pagar', 'tarefas', 'lembretes', 'notificacoes', 'relatorios', 'operadores']) {
    assert.ok(TUTORIAIS_MODULOS.some(item => item.id === id), id)
  }
})

test('login aponta a solicitação de acesso para a rota existente', () => {
  const login = read('src/app/auth/login/page.tsx')

  assert.match(login, /href="\/auth\/solicitar-acesso"/)
  assert.doesNotMatch(login, /href="\/solicitar-acesso"/)
})

test('solicitação de acesso limita e valida telefone brasileiro no cliente e no servidor', () => {
  const page = read('src/app/auth/solicitar-acesso/page.tsx')
  const route = read('src/app/api/solicitacoes/route.ts')
  const telefone = read('src/utils/telefone.ts')
  const planos = read('src/utils/planos.ts')

  assert.match(page, /formatarTelefoneBR\(e\.target\.value\)/)
  assert.match(page, /type="tel" inputMode="tel" autoComplete="tel-national"/)
  assert.match(page, /maxLength=\{15\}/)
  assert.match(page, /somenteDigitosTelefoneBR\(form\.whatsapp\)/)
  assert.match(route, /\.transform\(somenteDigitosTelefoneBR\)/)
  assert.match(route, /telefoneBRValido\(valor\)/)
  assert.match(route, /dados\.contatoPref === 'whatsapp' && !dados\.whatsapp/)
  assert.match(telefone, /TELEFONE_BR_MAX_DIGITOS = 11/)
  assert.match(telefone, /\^\[1-9\]\{2\}/)
  assert.match(planos, /Leitura local de boletos por PDF, imagem e câmera/)
})

test('máscara de telefone preserva formatos brasileiros válidos e remove código do país colado', async () => {
  const typescript = await import('typescript')
  const javascript = typescript.transpileModule(read('src/utils/telefone.ts'), {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
  }).outputText
  const telefone = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)

  assert.equal(telefone.formatarTelefoneBR('11999999999'), '(11) 99999-9999')
  assert.equal(telefone.formatarTelefoneBR('1134567890'), '(11) 3456-7890')
  assert.equal(telefone.somenteDigitosTelefoneBR('+55 (11) 99999-9999'), '11999999999')
  assert.equal(telefone.telefoneBRValido('(11) 99999-9999'), true)
  assert.equal(telefone.telefoneBRValido('(00) 00000-0000'), false)
})

test('cadastro de veículo envia somente o contrato aceito pela API', () => {
  const page = read('src/app/dashboard/empresa/frota/page.tsx')
  const handler = page.match(/const handleSalvarVeiculo[\s\S]*?\/\/ 🗑️ EXCLUSÃO/)?.[0] ?? ''

  assert.match(handler, /const payload = \{/)
  assert.match(handler, /localizacaoId: typeof formData\.localizacao/)
  assert.match(handler, /body: JSON\.stringify\(payload\)/)
  assert.doesNotMatch(handler, /JSON\.stringify\(\{\s*\.\.\.formData/)
})

test('frota permite cadastro sem base preservando o contrato seguro da API', () => {
  const page = read('src/app/dashboard/empresa/frota/page.tsx')
  const collection = read('src/app/api/veiculos/route.ts')
  const item = read('src/app/api/veiculos/[id]/route.ts')

  assert.match(page, /Sem base \/ pátio definido[\s\S]*value: 'SEM_BASE'/)
  assert.match(page, /formData\.localizacao !== 'SEM_BASE'[\s\S]*: null/)
  assert.match(collection, /localizacaoId: z\.string\(\)\.uuid\(\)\.optional\(\)\.nullable\(\)/)
  assert.match(item, /localizacaoId: z\.string\(\)\.uuid\(\)\.nullable\(\)\.optional\(\)/)
})

test('drawer mantém os dados no erro e bloqueia submissão duplicada', () => {
  const drawer = read('src/components/dashboard/GenericDrawer.tsx')

  assert.match(drawer, /if \(submittingRef\.current\) return/)
  assert.match(drawer, /if \(sucesso === false\) return/)
  assert.match(drawer, /disabled=\{loading\}/)
  assert.match(drawer, /role="alert"/)
  assert.match(drawer, /adaptive-form-overlay/)
  assert.match(drawer, /adaptive-form-panel/)
  assert.match(drawer, /min-h-0 flex-1[\s\S]*overflow-y-auto/)
  assert.match(drawer, /role="dialog"[\s\S]*aria-modal="true"/)
  assert.doesNotMatch(drawer, /fixed top-0 right-0 h-full/)
})

test('modais operacionais respeitam a viewport sem sobrepor os campos', () => {
  const styles = read('src/app/globals.css')
  const containers = read('src/app/dashboard/empresa/containers/page.tsx')
  const custos = read('src/app/dashboard/empresa/custos/page.tsx')
  const localizacoes = read('src/app/dashboard/empresa/frota/localizacoes/page.tsx')
  const manutencao = read('src/app/dashboard/empresa/frota/manutencao/page.tsx')
  const relatorios = read('src/app/dashboard/empresa/relatorios/page.tsx')

  assert.match(styles, /\.adaptive-form-overlay[\s\S]*top: 4rem;[\s\S]*bottom: 0;[\s\S]*height: auto/)
  assert.match(styles, /\.adaptive-form-panel[\s\S]*max-height: calc\(100% - 1\.5rem\)/)
  assert.match(styles, /@media \(min-width: 1100px\) and \(min-height: 720px\)[\s\S]*justify-content: flex-end/)
  assert.match(styles, /\.adaptive-form-panel \{[\s\S]*height: 100%;[\s\S]*max-height: 100%/)
  assert.match(containers, /adaptive-form-panel[\s\S]*overflow-y-auto/)
  assert.match(containers, /grid-cols-\[minmax\(0,1fr\)_4rem_2\.5rem\]/)
  assert.doesNotMatch(containers, /sm:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(0,0\.85fr\)\]/)
  assert.match(custos, /id="form-despesa-operacional"[\s\S]*min-h-0 flex-1[\s\S]*overflow-y-auto/)
  assert.match(custos, /border-b px-4 py-3 sm:px-5/)
  assert.match(custos, /border-t px-3 py-2[\s\S]*sm:py-2\.5/)
  assert.match(custos, /form="form-despesa-operacional" value="continuar"/)
  for (const modal of [custos, localizacoes, manutencao, relatorios]) {
    assert.match(modal, /adaptive-form-overlay/)
    assert.match(modal, /adaptive-form-panel/)
  }
})

test('cadastro de usuário usa payload explícito e protege o campo de senha', () => {
  const page = read('src/app/dashboard/empresa/usuarios/page.tsx')

  assert.match(page, /name: 'senha',[\s\S]*type: 'password'/)
  assert.match(page, /nome: formData\.nome,[\s\S]*role: formData\.role/)
  assert.doesNotMatch(page, /JSON\.stringify\(\{\s*\.\.\.formData/)
})

test('delegação de alertas de motoristas é aceita pelo contrato de tarefas', () => {
  const page = read('src/app/dashboard/empresa/page.tsx')
  const route = read('src/app/api/tarefas/route.ts')

  assert.match(page, /: 'MOTORISTAS'/)
  assert.match(route, /z\.enum\(\[[^\]]*'MOTORISTAS'/)
})

test('CPF, RG/CIN e CNH usam contratos compatíveis com os documentos apresentados', () => {
  const page = read('src/app/dashboard/empresa/motoristas/novo/page.tsx')
  const route = read('src/app/api/motoristas/route.ts')
  const validation = read('src/lib/motoristaValidation.ts')
  const documentos = read('src/utils/documentos.ts')

  assert.match(page, /setCpf\(formatarCPF\(valor\)\)/)
  assert.match(page, /onBlur=\{\(\) => setCpfErro\(erroCPF\(cpf\) \?\? ''\)\}/)
  assert.match(page, /aria-invalid=\{Boolean\(cpfErro\)\}/)
  assert.match(page, /somenteNumeros\(valor\)\.length > 11/)
  assert.doesNotMatch(page, /maxLength=\{14\}[\s\S]{0,200}placeholder="000\.000\.000-00"/)
  assert.match(page, /setRg\(formatarRG\(e\.target\.value\)\)/)
  assert.match(page, /formData\.set\('cpf', somenteNumeros\(cpf, 11\)\)/)
  assert.match(page, /formData\.set\('rg', normalizarDocumentoIdentidade\(rg\)\)/)
  assert.match(page, /formData\.set\('cnh', normalizarRegistroCNH\(cnh\)\)/)
  assert.match(documentos, /somenteNumeros\(valor, 11\)/)
  assert.match(documentos, /normalizarDocumentoIdentidade/)
  assert.match(documentos, /normalizarRegistroCNH/)
  assert.match(documentos, /cpfValido/)
  assert.match(documentos, /export function erroCPF/)
  assert.match(validation, /cpf: z\.string\(\)\.trim\(\)\.regex\(\/\^\\d\{11\}\$\//)
  assert.match(validation, /rg: z\.string\(\)\.trim\(\)\.regex\(\/\^\[A-Z0-9\]\{7,14\}\$\//)
  assert.match(validation, /cnh: z\.string\(\)\.trim\(\)\.regex\(\/\^\\d\{9,11\}\$\//)
  assert.match(route, /valorDocumentoNumericoObrigatorio\(formData, 'cpf'\)/)
  assert.match(route, /campo: typeof issue\?\.path\[0\]/)
  assert.match(route, /valorDocumentoIdentidadeOpcional\(formData, 'rg'\)/)
})

test('ordenação e filtro de operadores possuem estados distintos e opções temáticas', () => {
  const page = read('src/app/dashboard/empresa/usuarios/page.tsx')

  assert.match(page, /filtroFuncao === 'TODOS' \|\| usuario\.role === filtroFuncao/)
  assert.match(page, /ordenacao === 'NOME_DESC'/)
  assert.match(page, /ordenacao === 'CADASTRO_ANTIGO'/)
  assert.match(page, /style=\{OPTION_STYLE\}/)
})

test('edição de container mantém o registro operacional e versiona o espelho arquivado', () => {
  const page = read('src/app/dashboard/empresa/containers/page.tsx')
  const route = read('src/app/api/containers/[id]/route.ts')
  const migration = read('prisma/migrations/20260828040000_fluxos_operacionais_e_senhas/migration.sql')
  const repairMigration = read('prisma/migrations/20260830010000_restaurar_movimentacoes_operacionais_orfas/migration.sql')

  assert.doesNotMatch(page, /pattern="\[A-Za-z\]\{4\}/)
  assert.match(page, /setAnoSelecionado\(dataSalva\.getFullYear\(\)\)/)
  assert.match(page, /setMesSelecionadoIndex\(dataSalva\.getMonth\(\)\)/)
  assert.match(route, /relatorioArquivoId: atual\.relatorioArquivoId \? null : undefined/)
  assert.match(route, /registro_atual: false/)
  assert.match(route, /versao: espelhoAtual\.versao \+ 1/)
  assert.doesNotMatch(route.match(/export async function PATCH[\s\S]*?export async function DELETE/)?.[0] ?? '', /bloqueada porque já foi incluída/)
  assert.match(migration, /WHERE "registro_atual" = true/)
  assert.match(repairMigration, /"relatorioArquivoId" IS NULL/)
  assert.match(repairMigration, /"detalhes_purgados_em" IS NULL/)
  assert.match(repairMigration, /"auditoria_logs"/)
  assert.match(repairMigration, /ON CONFLICT DO NOTHING/)
})

test('detalhes do alerta exibem a observação completa em diálogo acessível', () => {
  const page = read('src/app/dashboard/empresa/page.tsx')

  assert.match(page, /aria-label=\{`Ver observação completa de \$\{alerta\.foco\}`\}/)
  assert.match(page, /aria-labelledby="titulo-detalhes-alerta"/)
  assert.match(page, /\{alertaDetalhado\.descricao\}/)
})

test('central de notificações fica disponível na navegação sem regra de plano', () => {
  const layout = read('src/app/dashboard/empresa/layout.tsx')
  const central = read('src/app/dashboard/empresa/notificacoes/page.tsx')

  assert.match(layout, /path: '\/dashboard\/empresa\/notificacoes'/)
  assert.match(layout, /NOTIFICACOES_ITEM[^\n]*modulo: null/)
  assert.match(central, /Central de <span[^>]*>Notificações/)
  assert.match(central, /Marcar todas como lidas/)
  assert.match(central, /Limpar lidas/)
  assert.match(central, /notificacao\.lida \? 'Lida' : 'Não lida'/)
})

test('personalização da sidebar é visual, persistente por usuário e posterior à autorização', () => {
  const layout = read('src/app/dashboard/empresa/layout.tsx')
  const preferences = read('src/lib/empresaPreferences.ts')

  assert.match(layout, /const itensPermitidos = NAV_EMPRESA\.filter\(itemPermitido\)/)
  assert.match(layout, /const itensVisiveis = itensPermitidos\.filter/)
  assert.match(layout, /Atalhos compactos/)
  assert.match(layout, /Apenas visual: permissões e acesso permanecem iguais/)
  assert.match(preferences, /usuario\.id \|\| usuario\.email/)
  assert.match(preferences, /rotasValidas\.has\(path\)/)
  assert.match(layout, /if \(item\.modulo && !modulosAtivos\.includes\(item\.modulo\)\) return false/)
})

test('tema vermelho separa marca, criticidade e atenção nas manutenções', () => {
  const temas = read('src/data/temasELogos.ts')
  const manutencao = read('src/app/dashboard/empresa/frota/manutencao/page.tsx')

  assert.match(temas, /temaPrimarioEhVermelho/)
  assert.match(temas, /danger: '#fbbf24'/)
  assert.match(temas, /warning: '#38bdf8'/)
  assert.match(manutencao, /stroke: semanticColors\.danger/)
  assert.match(manutencao, /stroke: semanticColors\.warning/)
})

test('historico de manutencoes pode ser consultado e agrupado por mes sem alterar os totais do veiculo', () => {
  const manutencao = read('src/app/dashboard/empresa/frota/manutencao/page.tsx')

  assert.match(manutencao, /const \[periodoHistorico, setPeriodoHistorico\] = useState\(dataHoje\.slice\(0, 7\)\)/)
  assert.match(manutencao, /manutencoesFiltradas = periodoHistorico === 'TODOS'/)
  assert.match(manutencao, /custoTotalVeiculo = manutencoesDoVeiculo\.filter/)
  assert.match(manutencao, />Todo o histórico<\/option>/)
  assert.match(manutencao, /manutencoesOrdenadas = \[\.\.\.manutencoesFiltradas\]\.sort/)
  assert.match(manutencao, /manutencoesOrdenadas\.flatMap/)
  assert.match(manutencao, /iniciarGrupo = periodoHistorico === 'TODOS'/)
  assert.match(manutencao, /totalPorPeriodo\[periodo\]/)
  assert.match(manutencao, /setPeriodoHistorico\(novoRegistro\.dataAgendada\.slice\(0, 7\)\)/)
})

test('custos e containers permitem consolidar o mes ou o ano em grupos mensais', () => {
  const custos = read('src/app/dashboard/empresa/custos/page.tsx')
  const containers = read('src/app/dashboard/empresa/containers/page.tsx')

  assert.match(custos, /useState<'ANO' \| 'MES' \| 1 \| 2 \| 3 \| 4>/)
  assert.match(custos, /\(\['ANO', 'MES', 1, 2, 3, 4\] as const\)/)
  assert.match(custos, /semanaSelecionada === 'ANO' \|\| c\.mesIndex === mesSelecionadoIndex/)
  assert.match(custos, /itensTabelaCustos/)
  assert.match(containers, /useState<'ANO' \| 'TODAS' \| 1 \| 2 \| 3 \| 4>/)
  assert.match(containers, /semanaSelecionada === 'ANO' \|\| bucket\.mesIndex === mesSelecionadoIndex/)
  assert.match(containers, /itensTabelaContainers/)
  assert.match(containers, />\s*Ano todo\s*<\/button>/)
})

test('patio 3D pode ser ocultado por preferencia visual local e acessivel', () => {
  const page = read('src/app/dashboard/empresa/containers/page.tsx')

  assert.match(page, /PREFERENCIA_PATIO_3D = '@rpmtruck:containers:patio3dEnabled'/)
  assert.match(page, /localStorage\.getItem\(PREFERENCIA_PATIO_3D\)/)
  assert.match(page, /localStorage\.setItem\(PREFERENCIA_PATIO_3D, String\(habilitado\)\)/)
  assert.match(page, /role="switch"/)
  assert.match(page, /aria-checked=\{patio3DHabilitado \?\? true\}/)
  assert.match(page, /\{patio3DHabilitado && \(/)
  assert.match(page, /useReducedMotion\(\)/)
})
