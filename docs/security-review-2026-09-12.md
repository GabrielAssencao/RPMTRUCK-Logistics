# Revisão de segurança — 12/09/2026

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
