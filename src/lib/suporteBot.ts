import type { CategoriaTicketSuporte } from '@prisma/client'

type AcaoTriagemBot = 'CONTINUAR' | 'RESOLVER' | 'ESCALAR'

interface ContextoTriagemBot {
  assunto: string
  categoria: CategoriaTicketSuporte
  mensagensUsuario: string[]
  interacoesAutomaticas: number
}

export interface ResultadoTriagemBot {
  resposta: string
  acao: AcaoTriagemBot
  categoriaDetectada?: CategoriaTicketSuporte
  resumoAdmin?: string
}

interface TutorialSuporte {
  titulo: string
  termos: RegExp
  orientacao: string
  referencia: string
}

export const TUTORIAIS_SUPORTE: readonly TutorialSuporte[] = [
  {
    titulo: 'Acesso e recuperação de senha',
    termos: /senha|login|acesso|entrar|autentic|codigo temporario/,
    orientacao: 'confirme o e-mail digitado, o teclado e a conexão. Depois use “Esqueci minha senha” e tente novamente sem compartilhar senha, código temporário ou token',
    referencia: '/guia#ajuda',
  },
  {
    titulo: 'Menu ou módulo não aparece',
    termos: /menu|modulo|permiss|nao aparece|sumiu|oculto/,
    orientacao: 'peça ao gestor para revisar seu papel, os módulos contratados e suas permissões individuais. Acesse novamente depois da alteração',
    referencia: '/guia#papeis',
  },
  {
    titulo: 'Dados não atualizaram',
    termos: /nao atualiz|nao salv|dados antigos|duplic|carregando|sincron/,
    orientacao: 'aguarde a conclusão da ação, recarregue a página uma vez e confira a conexão. Evite repetir o clique enquanto a operação estiver processando',
    referencia: '/guia#ajuda',
  },
  {
    titulo: 'Relatório não foi gerado',
    termos: /relatorio|excel|pdf|export|arquivo/,
    orientacao: 'confira o período escolhido, o módulo liberado, o limite do plano e a capacidade de armazenamento antes de gerar novamente',
    referencia: '/guia#ajuda',
  },
  {
    titulo: 'Tela lenta ou conexão instável',
    termos: /lent|trav|conexa|offline|demora|indispon|timeout/,
    orientacao: 'feche abas pesadas, teste outra rede e recarregue a página uma vez. Anote página, horário, dispositivo e a ação executada caso o problema continue',
    referencia: '/guia#ajuda',
  },
]

const ROTULOS_CATEGORIA: Record<CategoriaTicketSuporte, string> = {
  SUPORTE_TECNICO: 'suporte técnico',
  REPORTAR_ERRO: 'erro do sistema',
  DUVIDA_OPERACIONAL: 'dúvida operacional',
  SOLICITACAO: 'solicitação ou melhoria',
  FINANCEIRO: 'financeiro',
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function limitar(texto: string, tamanho = 500) {
  const compacto = texto.replace(/\s+/g, ' ').trim()
  return compacto.length > tamanho ? `${compacto.slice(0, tamanho - 1)}…` : compacto
}

function detectarCategoria(textoOriginal: string): CategoriaTicketSuporte | undefined {
  const texto = normalizar(textoOriginal)
  if (/boleto|cobranca|pagamento|fatura|plano|financeir/.test(texto)) return 'FINANCEIRO'
  if (/erro|bug|falha|quebr|nao funciona|trav/.test(texto)) return 'REPORTAR_ERRO'
  if (/solicit|melhoria|recurso|adicionar funcao|nova funcao/.test(texto)) return 'SOLICITACAO'
  if (/duvida|como faco|como usar|procedimento|operacao/.test(texto)) return 'DUVIDA_OPERACIONAL'
  if (/senha|login|acesso|conexa|offline|lent|carreg/.test(texto)) return 'SUPORTE_TECNICO'
  return undefined
}

function buscarTutorial(textoOriginal: string) {
  const texto = normalizar(textoOriginal)
  return TUTORIAIS_SUPORTE.find((tutorial) => tutorial.termos.test(texto))
}

function respostaPositiva(textoOriginal: string) {
  const texto = normalizar(textoOriginal).trim()
  return /^(sim|resolveu|resolvido|funcionou|deu certo|consegui|ok|certo)\b/.test(texto)
}

function montarResumo(assunto: string, categoria: CategoriaTicketSuporte, problema: string, tentativa: string, resultado: string) {
  return [
    'RESUMO INTERNO DA TRIAGEM',
    `Assunto: ${limitar(assunto, 160)}`,
    `Categoria confirmada: ${ROTULOS_CATEGORIA[categoria]}`,
    `Problema relatado: ${limitar(problema)}`,
    `Orientação consultada: ${limitar(tentativa)}`,
    `Resultado informado: ${limitar(resultado, 240)}`,
  ].join('\n')
}

export function montarPerguntaInicialTriagem(categoria: CategoriaTicketSuporte) {
  return `Sou o Assistente RPM e vou fazer uma triagem curta antes do atendimento. Você classificou este chamado como ${ROTULOS_CATEGORIA[categoria]}. Essa categoria representa corretamente o que aconteceu? Responda “sim” ou informe a categoria mais adequada.`
}

export function montarRespostaTriagemBot({ assunto, categoria, mensagensUsuario, interacoesAutomaticas }: ContextoTriagemBot): ResultadoTriagemBot | null {
  const ultimaMensagem = mensagensUsuario.at(-1)?.trim() ?? ''

  if (interacoesAutomaticas === 1) {
    const categoriaDetectada = detectarCategoria(ultimaMensagem)
    const ajuste = categoriaDetectada && categoriaDetectada !== categoria
    return {
      acao: 'CONTINUAR',
      categoriaDetectada: ajuste ? categoriaDetectada : undefined,
      resposta: `${ajuste ? `Entendi. Vou ajustar a triagem para ${ROTULOS_CATEGORIA[categoriaDetectada]}. ` : 'Categoria confirmada. '}Agora descreva exatamente o problema, o que você tentou fazer e o que apareceu na tela. Não envie senhas, tokens, dados bancários completos ou documentos pessoais.`,
    }
  }

  if (interacoesAutomaticas === 2) {
    const tutorial = buscarTutorial(ultimaMensagem)
    if (!tutorial) {
      return {
        acao: 'ESCALAR',
        resposta: 'Não encontrei uma orientação segura nos tutoriais atuais para este caso. Concluí a triagem e encaminhei o chamado ao atendimento humano. O administrador recebeu um resumo para continuar sem repetir as mesmas perguntas.',
        resumoAdmin: montarResumo(assunto, categoria, ultimaMensagem, 'Nenhum tutorial compatível encontrado.', 'Encaminhamento automático.'),
      }
    }
    return {
      acao: 'CONTINUAR',
      resposta: `Encontrei a orientação “${tutorial.titulo}”. Tente o seguinte: ${tutorial.orientacao}. Consulte também ${tutorial.referencia}. Depois me diga se isso resolveu o problema.`,
    }
  }

  if (interacoesAutomaticas === 3) {
    if (respostaPositiva(ultimaMensagem)) {
      return {
        acao: 'RESOLVER',
        resposta: 'Ótimo, registrei que a orientação resolveu o problema e finalizei esta triagem. Se o problema voltar, abra um novo chamado citando este protocolo.',
      }
    }
    const problema = mensagensUsuario.at(-2) ?? mensagensUsuario[0] ?? assunto
    const tutorial = buscarTutorial(problema)
    return {
      acao: 'ESCALAR',
      resposta: 'Entendi que a orientação não resolveu. Encaminhei o chamado ao atendimento humano e o administrador recebeu um resumo da triagem. Você não precisa repetir as informações já enviadas.',
      resumoAdmin: montarResumo(assunto, categoria, problema, tutorial?.titulo ?? 'Nenhum tutorial compatível encontrado.', ultimaMensagem || 'Solução não confirmada.'),
    }
  }

  return null
}
