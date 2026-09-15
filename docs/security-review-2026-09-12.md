# Revisão de segurança — 12/09/2026

## Revisão adicional: usuário mal-intencionado e limpeza — 14/09/2026

Corrigido o consumo do corpo de uploads: fotos, relatórios, boletos e
comprovantes agora verificam os bytes efetivamente recebidos antes de executar
o parser multipart. A importação inicial reutiliza o mesmo leitor limitado.
Isso impede contornar o limite omitindo ou falsificando `Content-Length`.
O excesso retorna 413 nos formulários; a importação mantém seu contrato de
erro 400. Autenticação e autorização continuam acontecendo antes da leitura.

Os limites do formulário incluem margem para os campos multipart: 6 MB para
foto/documento financeiro e 11 MB para relatório. Os limites individuais
continuam sendo 5 MB e 10 MB, respectivamente. O buffer do proxy Next.js foi
explicitamente limitado a 12 MB, compatível com o formulário de relatório;
essa configuração, isoladamente, não substitui o limite aplicado pela rota.

| Hipótese de ataque | Proteção verificada |
| --- | --- |
| Visitante altera a assinatura, expiração ou algoritmo do cookie | Verificação criptográfica rejeita o token antes de acessar dados |
| Operador altera o papel ou a empresa no token | Identidade, papel, empresa e versão são confrontados com o banco |
| Usuário reutiliza cookie após revogação ou desativação | Sessão e estado atual do usuário são revalidados |
| Gestor tenta acessar outra empresa trocando IDs ou parâmetros | Consultas ficam limitadas à empresa autenticada; recurso externo retorna 404 |
| Colega tenta excluir lembrete pessoal de outro usuário | Escopo inclui empresa e proprietário, inclusive dentro da mesma empresa |
| Operador tenta acessar funções do superadmin ou gestor | Autorização no servidor recusa o papel |
| Visualizador chama uma API de gravação diretamente | Regra de escrita recusa perfis de somente leitura |
| Gestor concede ADMIN_RPM ou módulos não contratados | Schema estrito e validação do plano recusam a inclusão |
| Cliente altera plano/cotas/campos de autoridade | Valores vêm do banco; campos não previstos são rejeitados nos schemas revisados |
| Usuário força uso excessivo da API | Rate limit persistente; falha do limitador fecha o acesso |
| Arquivo usa extensão/MIME de imagem para ocultar script | Decoder valida conteúdo; formato disfarçado é recusado |
| Excel contém macros, entidades XML, links externos ou bomba comprimida | Preflight limita descompressão real e recusa estruturas não permitidas |
| Página externa tenta enviar mutação usando cookie da vítima | Proxy rejeita origem externa e `Sec-Fetch-Site: cross-site` |

Validação: tipos, lint e 167 testes automatizados passaram, incluindo 15 novos
testes comportamentais de autorização/uploads. A suíte de navegador reportou
52 casos aprovados e cinco ignorados por configuração/dispositivo.

`scripts/test-tenant-isolation-local.mjs` executou as APIs e autenticação com
consultas Prisma reais em duas empresas sintéticas, testando escopo empresarial,
propriedade de lembretes, elevação de papel, visualizador, remoção imediata de
módulos e revogação. Todas as fixtures ficam dentro de uma transação desfeita
ao final, com verificação posterior de ausência das empresas sintéticas. O
limitador e a regra financeira são simulados nesse teste; o fechamento do
limitador é coberto pelos testes comportamentais separados.

Metadados locais: 30 tabelas operacionais com RLS e sem grants diretos a
`anon`, `authenticated` ou `PUBLIC`; três buckets utilizados privados.
Auditoria de dependências npm: zero avisos conhecidos na execução. A auditoria
Git não encontrou formatos conhecidos de segredos; não garante detectar todo
formato possível de credencial.

Limpeza confirmada pelo grafo de imports e busca de consumidores: removido
`src/lib/supabase.ts`, cliente browser legado, e as dependências sem uso
`@supabase/ssr`, `@hookform/resolvers` e `react-hook-form` (cinco pacotes removidos
da instalação). Recursos 3D, favicons dinâmicos, SVGs originais, migrations,
testes e scripts de backup/recuperação foram preservados. A limpeza reduz
dependências e resíduos; arquivos já excluídos do bundle não representam ganho
mensurável de carregamento por si só.

Limites da revisão: nenhuma operação em produção, varredura de terceiros ou
tentativa de força bruta contra usuários reais. Os testes não certificam
ausência de vulnerabilidades, nem avaliam carga concorrente em hospedagem.
O estado de RLS/buckets de produção precisa ser conferido antes da publicação.

## Revalidação das alterações — 14/09/2026

Revisados lembretes pessoais, conclusão e retenção, cronograma do admin e do
Essencial, rebranding, ativação opcional do 3D, login, solicitação de acesso e
menu da conta na sidebar. Não foram encontrados novos problemas de segurança
nas alterações inspecionadas. A revisão não certifica ausência de vulnerabilidades
e a verificação do banco ocorreu somente no desenvolvimento isolado.

- Lembretes filtram usuário e empresa da sessão, inclusive administradores sem
  empresa. Retenção exige conclusão, prazo vencido e preferência do proprietário;
  a execução global exige segredo comparado com `timingSafeEqual`.
- Delegação de tarefas permanece bloqueada no servidor para o Essencial. Nome
  exibido no card vem do perfil autenticado; armazenamento local e preferência
  de 3D não concedem permissões.
- APIs recusaram sessões ausentes/adulteradas e mutações de outra origem.
  A rotina de retenção recusou autorização inválida, sem executar limpeza.
- Banco: 29 tabelas com RLS e sem privilégios diretos aos papéis públicos;
  buckets de motoristas, relatórios e contas a pagar privados.
- Auditoria Git não encontrou formatos conhecidos de segredos. `npm audit`
  reportou zero vulnerabilidades conhecidas nas dependências instaladas.
- Corrigido login que mostrava falha após autenticação bem-sucedida quando o
  navegador bloqueava o armazenamento local. O cookie continua sendo a sessão.
- Removidos formulário de recuperação antigo e inalcançável, mapeamento de
  logos PNG sem consumidores, cinco PNGs legados, favicon duplicado e resíduos
  de diagnóstico. Preservados SVGs originais, modelos 3D e scripts de geração.
- Validação: TypeScript, lint, 137 testes unitários e 41 testes de navegador
  aprovados; um caso de ativação 3D não se aplica ao mobile e foi ignorado.
  Prisma válido. Compilação otimizada local validada com acesso às fontes.

Não foram executadas mutações em produção ou rotinas de exclusão de dados
operacionais. Os testes de interface utilizam dados simulados.

## Escopo e limites

Revisão de código das APIs, autenticação, autorização multiempresa, cadastros,
uploads, SQL, configuração pública, dependências e histórico Git. Verificação
de metadados do banco e buckets **somente no desenvolvimento isolado**.
Não houve ataque de força bruta a contas reais, teste destrutivo, alteração de
produção, deploy ou certificação de ausência de vulnerabilidades. Os testes
automatizados incluem contratos estáticos e comportamento com dependências
simuladas; não substituem testes concorrentes e de autorização em staging.

## Achados corrigidos

- **Alta — acesso direto ao banco:** faltava RLS explícita no histórico de
  migrações de suporte, mensagens, alertas, leituras, lembretes e contas a pagar.
  Uma nova migração habilita RLS e revoga privilégios de PUBLIC, anon e
  authenticated. O servidor continua usando Prisma e autorização por JWT
  próprio. Após aplicação local, as 29 tabelas operacionais passaram na
  verificação de RLS/permissões; os três buckets utilizados estão privados.
  Isso não confirma o estado do banco de produção.
- **Alta — dependência de desenvolvimento:** js-yaml 4.3.1, transitiva do ESLint,
  atualizada para 4.3.2, sem alterar outras dependências.
  [Advisory GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh).
  A instalação final reportou zero vulnerabilidades conhecidas no npm audit.
- **Média — cobertura de rate limit:** requireAuth agora aplica um teto
  persistente por usuário de 300 leituras/minuto e 60 mutações/minuto, antes
  da consulta de sessão. Gestores, operadores e admins compartilham a mesma
  proteção básica; limites específicos mais estritos permanecem. Catálogo
  público passa a ter 60 consultas/minuto por IP; retenção autorizada,
  uma execução a cada cinco minutos. A falha do limitador bloqueia a operação.
- **Média — cabeçalho de IP:** na Vercel, cf-connecting-ip fornecido pelo
  cliente não é mais usado. São usados os cabeçalhos sanitizados da plataforma,
  conforme a [documentação de headers da Vercel](https://vercel.com/docs/headers/request-headers).
  Em outras hospedagens, cabeçalhos de proxy precisam de confiança explícita;
  por padrão, produção utiliza o bucket compartilhado unknown. As novas
  variáveis estão documentadas no .env.example.
- **Média — abuso de capacidade:** Preview não reserva mais 999 vagas por
  recurso. O padrão é um usuário (gestor) e zero veículos, mais adicionais
  autorizados pelo admin. Em Empresas → Módulos & Plano, Preview apresenta
  campos de **total** de usuários e veículos. Os campos existentes armazenam
  total de usuários menos um e total de veículos. Apenas o admin pode alterá-los;
  planos pagos continuam com suas franquias atuais. Ao reduzir abaixo do uso
  atual, nenhum registro é apagado; novas criações são impedidas. Empresas
  Preview existentes sem adicionais precisam ter sua capacidade definida.
- **Média — corrida no cadastro da frota:** a contagem de vagas estava fora da
  transação. Empresa e admin usam agora o mesmo serviço serializável, que
  verifica cota, vínculo da base e cria veículo/leitura inicial juntos. Conflitos
  abortam a criação e retornam erro recuperável. Usuários já utilizavam serviço
  serializável e passam a respeitar as novas franquias Preview automaticamente.
- **Baixa — amplificação de logs:** tentativas negadas não geram uma escrita
  de evento a cada requisição; há deduplicação por janela/identificador por
  instância, com memória limitada. O bloqueio em si continua no PostgreSQL.
- JSON malformado retorna 400 nas rotas de plano e criação de veículos alteradas.

## Proteções encontradas

Login já limita IP (20/15 minutos) e conta (5/15 minutos), com bcrypt e hash
substituto para contas inexistentes. Recuperação tem limites por IP/conta,
resposta pública genérica e claims atômicos. Sessões são assinadas com algoritmo
restrito, cookie HttpOnly, revogação/versionamento e revalidação no banco.
As APIs inspecionadas derivam o tenant da sessão e filtram recursos por empresa.
Há validação Zod, CSRF por origem, CSP com nonce e URLs assinadas curtas.
Uploads financeiros verificam assinatura do conteúdo; fotos usam decodificação,
limites de pixels e reprocessamento. Segredos administrativos ficam em módulos
server-only; chaves públicas do Supabase não são credenciais administrativas.

Não foram encontrados usos de SQL raw inseguro, eval, new Function ou
dangerouslySetInnerHTML no código pesquisado. Consultas raw existentes utilizam
templates parametrizados. A auditoria Git não encontrou formatos conhecidos
de segredo em arquivos versionados ou no histórico; isso não prova ausência de
segredos em formatos desconhecidos, logs de infraestrutura ou outros serviços.

## Pendências antes da publicação

1. Aplicar a migração nova em staging/produção por procedimento controlado e
   conferir permissões reais. Nenhuma migração de produção foi executada aqui.
2. Confirmar chaves reais, hosts permitidos e TURNSTILE_REQUIRED=true no deploy.
   Sem chave e com flag false, o desafio pode ser pulado; rate limits continuam
   ativos. Não foi alterada a configuração privada para evitar bloquear login.
3. Configurar WAF/limites de borda contra ataques distribuídos, tráfego sem
   sessão e corpos grandes. O limite local do proxy verifica Content-Length,
   não mede corpos chunked antes da materialização. Rate limit de aplicação
   não é proteção completa contra DDoS.
4. Logout permanece uma exceção intencional ao teto requireAuth para permitir
   revogar a sessão e remover o cookie mesmo quando outros endpoints estão
   limitados. Proteger tráfego abusivo nessa rota na borda; JWT válido ainda
   pode ser repetido para provocar tentativas de revogação/log.
5. Em produção fora da Vercel, só ativar TRUST_FORWARDED_PROXY ou
   TRUST_CLOUDFLARE_PROXY atrás de proxy que sobrescreva os headers, sem acesso
   direto ao servidor. Caso contrário, manter false.
6. Validar em staging o fluxo completo com dois tenants e requisições
   concorrentes na última vaga. Não foi feito um pentest completo nem teste
   de carga contra contas ou dados reais. Considerar MFA para o admin master.

## Verificação repetível

- `npm run test:local`: tipos, lint e suítes locais.
- `npm run build`: build otimizado.
- `npm run security:audit-git`: formatos conhecidos de segredo no Git.
- `node --env-file=.env.local scripts/audit-local-security.mjs`: metadados
  RLS/permissões e privacidade dos buckets, somente leitura e com guarda de
  isolamento local. Não imprime dados pessoais ou credenciais.
