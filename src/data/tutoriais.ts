export interface TutorialModulo {
  id: string
  titulo: string
  objetivo: string
  passos: readonly string[]
  logica: string
  dica: string
}

export const TUTORIAIS_MODULOS: readonly TutorialModulo[] = [
  {
    id: 'painel', titulo: 'Painel operacional', objetivo: 'Entenda o que exige atenção antes de começar o turno.',
    passos: ['Abra o painel e confira alertas, veículos em oficina e pendências.', 'Revise o período dos indicadores antes de comparar valores.', 'Abra o módulo de origem para conferir detalhes e atualizar o registro.'],
    logica: 'Os indicadores refletem os cadastros e movimentações. Corrija a origem do dado, não apenas o alerta.',
    dica: 'Comece pelas pendências urgentes e depois organize o cronograma do dia.',
  },
  {
    id: 'frota', titulo: 'Frota e bases', objetivo: 'Cadastre veículos mesmo quando a empresa não controla pátios.',
    passos: ['Abra Frota e selecione o cadastro de um novo veículo.', 'Informe modelo, placa brasileira, tipo, ano e quilometragem atual.', 'Selecione a base ou a opção sem base/pátio quando não houver esse controle.', 'Escolha o estado operacional, confira os dados e confirme o cadastro.'],
    logica: 'A placa identifica o veículo. A base é opcional; a capacidade do plano limita novos cadastros, inclusive no Preview.',
    dica: 'Mantenha quilometragem e estado atualizados para tornar custos e manutenção confiáveis.',
  },
  {
    id: 'motoristas', titulo: 'Motoristas', objetivo: 'Organize condutores, documentos e vínculos com a frota.',
    passos: ['O gestor abre Motoristas e inicia um cadastro.', 'Preencha os dados solicitados e confira documentos e vencimentos.', 'Associe um veículo quando aplicável e revise o status do condutor.', 'Salve e acompanhe os alertas de vencimento.'],
    logica: 'O cadastro e os dados pessoais são restritos ao gestor. Vínculos corretos ajudam a identificar responsáveis pela operação.',
    dica: 'Evite documentos e informações pessoais em descrições livres ou mensagens de suporte.',
  },
  {
    id: 'manutencao', titulo: 'Manutenção', objetivo: 'Registre serviços e acompanhe a disponibilidade dos veículos.',
    passos: ['Na frota, abra a área de manutenção do veículo correto.', 'Informe serviço, data, quilometragem e valores solicitados.', 'Registre peças e observações relevantes, se necessário.', 'Atualize o andamento e conclua apenas quando o serviço tiver sido executado.'],
    logica: 'O histórico pertence ao veículo. Datas, custos e quilometragem permitem acompanhar a manutenção sem perder rastreabilidade.',
    dica: 'Confira se a despesa já foi integrada aos custos antes de lançá-la novamente.',
  },
  {
    id: 'containers', titulo: 'Containers', objetivo: 'Registre e acompanhe cada movimentação da carga.',
    passos: ['Abra Containers e escolha Novo container.', 'Informe data, código, tipo, transportador e terminais de início e fim.', 'Preencha o frete; se houver comissão, mantenha a geração automática e informe o percentual combinado.', 'Adicione os itens da carga, se desejar, e confira os percentuais de ocupação.', 'Confirme e atualize o status conforme a operação avançar.'],
    logica: 'A comissão é calculada sobre o frete e validada no servidor. Desative a geração automática se a empresa não usa comissão ou fará o lançamento manual.',
    dica: 'Não duplique uma comissão já gerada automaticamente no módulo de custos.',
  },
  {
    id: 'custos', titulo: 'Custos e despesas', objetivo: 'Registre despesas sem perder o vínculo com a operação.',
    passos: ['Selecione o veículo e confira o período exibido.', 'Abra o lançamento de despesa e escolha a categoria.', 'Informe data, descrição, valor, forma de pagamento e status.', 'Confira os vínculos e salve; use Salvar e lançar outro para uma sequência de registros.'],
    logica: 'Categoria, data, status e veículo alimentam os indicadores. Custos integrados de outras operações não precisam de um segundo lançamento.',
    dica: 'Use descrições objetivas, como estabelecimento e finalidade da despesa.',
  },
  {
    id: 'contas-pagar', titulo: 'Contas a pagar', objetivo: 'Organize vencimentos e registre pagamentos com conferência.',
    passos: ['Abra Contas a pagar e selecione Nova conta.', 'Informe os dados da cobrança e o vencimento; confira valores e beneficiário.', 'Quando disponível, leia o PDF ou o código de barras; no celular, também é possível usar câmera ou foto.', 'Revise os dados extraídos antes de salvar.', 'Realize o pagamento no ambiente seguro do banco e depois registre a baixa no sistema, com comprovante se desejar.'],
    logica: 'A leitura auxilia o preenchimento, mas não substitui a conferência. O sistema organiza a cobrança e não executa o pagamento bancário.',
    dica: 'Confirme se a conta já existe antes de importar o mesmo boleto novamente.',
  },
  {
    id: 'tarefas', titulo: 'Quadro de tarefas', objetivo: 'Acompanhe trabalho delegado pelo gestor.',
    passos: ['No Cronograma, selecione Quadro de tarefas.', 'O gestor cria uma tarefa e escolhe título, responsável, prioridade e prazo.', 'Marque “somente o dia” quando não houver horário específico.', 'Use o aviso automático pela prioridade ou escolha uma data e hora para a notificação.', 'Salve; o responsável acompanha e atualiza o status conforme executar o trabalho.'],
    logica: 'Tarefas são trabalho delegado: a criação depende do plano e da permissão do gestor. O início de um novo registro não pode estar no passado.',
    dica: 'Prefira títulos que descrevam uma ação e um resultado esperado. O aviso automático usa o prazo e, quando ele não existe, usa o início.',
  },
  {
    id: 'lembretes', titulo: 'Lembretes pessoais e calendário', objetivo: 'Organize suas próprias anotações sem delegá-las à equipe.',
    passos: ['No Cronograma, selecione Quadro de lembretes e crie um post-it.', 'Informe título, anotação e data; marque “somente o dia” quando não houver horário específico.', 'Escolha a urgência e revise a regra automática de aviso apresentada.', 'Para outra programação, escolha a notificação personalizada e defina o dia e horário desejados.', 'Salve e consulte o calendário para visualizar tarefas e lembretes do mês.'],
    logica: 'Lembretes pertencem apenas ao usuário que os criou. Urgência e horário do aviso são conceitos diferentes; a opção personalizada permite separá-los.',
    dica: 'Use filtros e páginas do quadro para encontrar notas em uma coleção grande.',
  },
  {
    id: 'notificacoes', titulo: 'Notificações', objetivo: 'Identifique rapidamente o assunto e a próxima ação.',
    passos: ['Abra o sino no topo ou a central de notificações.', 'Leia título, descrição e data para identificar tarefa, lembrete ou evento.', 'Abra o registro relacionado quando houver um atalho.', 'Marque como lida após conferir; limpe as lidas quando não precisar mais do aviso.'],
    logica: 'Marcar como lida não conclui a tarefa nem resolve o chamado. Remover o aviso também não exclui seu registro de origem.',
    dica: 'Use o filtro de não lidas para revisar o que ainda precisa de atenção.',
  },
  {
    id: 'relatorios', titulo: 'Relatórios e arquivos', objetivo: 'Consulte e preserve os dados consolidados da operação.',
    passos: ['O gestor abre Relatórios ou Arquivo Operacional, conforme o recurso disponível.', 'Selecione o período e os filtros permitidos pelo plano.', 'Gere o arquivo e aguarde a conclusão antes de repetir a ação.', 'Baixe e confira o conteúdo antes de confirmar qualquer arquivamento ou limpeza.'],
    logica: 'O plano define o histórico e os recursos disponíveis. A cópia externa validada é importante antes de qualquer limpeza de dados.',
    dica: 'URLs de download expiram; solicite um novo link pela interface quando necessário.',
  },
  {
    id: 'operadores', titulo: 'Operadores e personalização', objetivo: 'Distribua acessos e identidade visual sem compartilhar contas.',
    passos: ['O gestor abre Operadores e registra uma conta individual.', 'Escolha o papel e apenas os módulos necessários à pessoa.', 'Em Ações, abra Personalização e defina rótulo da equipe, cor, modo e fundo.', 'Escolha se a pessoa poderá personalizar seu próprio tema e salve.', 'Revogue o acesso quando a pessoa deixar a equipe.'],
    logica: 'Personalização é visual e não amplia permissões. As contas ocupam vagas do plano; o gestor também conta como usuário.',
    dica: 'Use rótulos como Equipe financeira para dar significado às cores escolhidas.',
  },
  {
    id: 'configuracoes', titulo: 'Configurações e segurança', objetivo: 'Mantenha perfil, sessão e preferências organizados.',
    passos: ['O gestor revisa o perfil da empresa e as opções da assinatura em Configurações.', 'Use Personalização para ajustar a identidade visual permitida.', 'Na área de segurança, confira sessões e encerre acessos em outros dispositivos quando necessário.', 'Siga o fluxo apresentado para redefinição de senha; nunca compartilhe senhas ou códigos temporários.'],
    logica: 'O gestor controla a empresa; mudanças de plano e capacidade passam pela autorização administrativa. Algumas opções não estão disponíveis aos operadores.',
    dica: 'Em dispositivo compartilhado, selecione Sair ao terminar.',
  },
]
