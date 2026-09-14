# Ciclo financeiro — validação local

Estas alterações são somente de desenvolvimento; não representam um novo deploy de produção.

- Preview: vagas de teste não se tornam extras pagos ao selecionar um plano comercial. O admin precisa contratar adicionais explicitamente; reduzir limites não apaga usuários ou veículos.
- Aprovação de novo plano pago ou ingresso do Preview: três dias (72 horas) para a primeira mensalidade e implantação. Ambas recebem vencimento persistido.
- Antes de pagar qualquer mensalidade: `Aguardando primeiro pagamento`. Depois do prazo, `Primeiro pagamento vencido — não ingressou`, com operações bloqueadas.
- Após uma mensalidade de valor positivo paga: cobranças vencidas significam `Inadimplente`. Uma implantação ainda pendente também impede acesso depois do vencimento.
- Mensalidades seguintes: a empresa escolhe dia 28 (padrão) ou 5; pode usar o dia inteiro em Brasília. A próxima competência é o mês seguinte ao início da cobrança. Não há cálculo proporcional neste estágio: revisar o primeiro ciclo perto da virada do mês antes de integrar pagamentos.
- Nova competência é emitida uma vez, com chave de idempotência e notificação contextual ao gestor. Cron diário, consulta administrativa e verificação de acesso mantêm a cobrança atualizada. Faturas pagas não são reprecificadas e meses sem fatura não ganham cobranças retroativas automaticamente.
- Bloqueio é decidido no servidor em cada requisição, incluindo sessões já abertas. Pagar remove somente o bloqueio financeiro; uma suspensão manual permanece. Nenhum dado é apagado.
- Faturas legadas sem data continuam sem vencimentos inventados. Clientes com mensalidades pagas são identificados pelo histórico na migração. O ciclo automático exige início de cobrança explícito; clientes legados ainda precisam ter esse marco definido por um procedimento aprovado, não retroativo.
- Alterar o dia de vencimento não muda faturas emitidas. Cobrança do plano é diferente das contas a pagar operacionais da transportadora.

## Preparação para gateway

O painel operacional do gestor mostra um contador das cobranças pendentes com prazo conhecido. `/dashboard/plano` reutiliza a gestão de assinatura, mostra pendências e permite negociar com o suporte. Gestores com bloqueio financeiro podem entrar somente para regularizar; a única exceção de API é `/api/empresa/assinatura`, e mudanças de plano/capacidade continuam negadas enquanto houver bloqueio. Operadores, contas revogadas e suspensões manuais não recebem essa exceção. O contador é informativo e não controla a autorização. Pagamento online e cadastro de meios de pagamento seguem indisponíveis até integrar um gateway.

O próximo estágio deve adicionar checkout acessível mesmo sob bloqueio operacional, webhooks assinados, identificação de eventos já processados, conciliação e tratamento de estorno/cancelamento. A chave da cobrança não substitui deduplicação dos eventos do provedor. Não há cobrança bancária automática ou gateway conectado nesta versão.

Antes da integração, definir proporcionalidade no primeiro ciclo e a política para períodos sem emissão; valores enviados pelo navegador nunca devem determinar o pagamento. Para dinheiro no provedor, usar centavos inteiros e confirmar valores contra a fatura persistida.
