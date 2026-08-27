# RPMTruck Logistics

Plataforma full-stack de gestão logística para transportadoras, com isolamento
multiempresa, administração de planos, frota, motoristas, custos, manutenção,
containers, tarefas, notificações e relatórios privados.

O projeto combina uma aplicação operacional em Next.js com PostgreSQL/Supabase,
Prisma e uma camada própria de autenticação e autorização. É um produto em
evolução e um projeto público de portfólio; antes de operar dados reais em
produção, valide infraestrutura, backups, observabilidade, domínio e políticas
organizacionais aplicáveis.

## Principais recursos

- landing page responsiva com experiência 3D opcional carregada sob demanda;
- Política de Privacidade, Aviso de Cookies e Guia de Uso públicos;
- sessão JWT em cookie `HttpOnly`, persistida e revogável no banco;
- papéis administrativos e empresariais com autorização no servidor;
- isolamento por empresa derivado da sessão, sem confiar em IDs do cliente;
- gestão de empresas, usuários, planos, cotas e solicitações de assinatura;
- frota, motoristas, localizações, manutenção, custos e containers;
- tarefas, notificações direcionadas e indicadores operacionais;
- geração e guarda de relatórios em bucket privado;
- fotos de motoristas normalizadas e armazenadas de forma privada;
- criptografia versionada de campos sensíveis e índices cegos;
- auditoria transacional, eventos de segurança, RLS e rate limit persistente;
- temas, interface responsiva e componentes reutilizáveis.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Aplicação | Next.js 16.3, React 19.2, TypeScript 5.6 |
| Interface | Tailwind CSS, Framer Motion, GSAP, Lucide React |
| 3D | Three.js, React Three Fiber, Drei, Draco |
| Backend | Next.js Route Handlers e Proxy |
| Dados | PostgreSQL, Supabase e Prisma 6 |
| Validação | Zod e React Hook Form |
| Autenticação | `jose`, JWT, cookies `HttpOnly` e bcrypt |
| Arquivos | Supabase Storage privado, Sharp e ExcelJS |

## Arquitetura

```text
Navegador
   │
   ├── páginas e componentes React
   │
   └── requisições /api
          │
          ▼
     Proxy do Next.js
     origem, tamanho, sessão leve e CSP com nonce
          │
          ▼
     Route Handlers
     autenticação → autorização → validação → rate limit
          │
          ├── Prisma → PostgreSQL/Supabase
          │              ├── integridade e transações
          │              ├── auditoria
          │              ├── rate limit atômico
          │              └── RLS/revogação de acesso direto
          │
          └── Supabase Admin → buckets privados
                              ├── relatórios
                              └── fotos de motoristas
```

Estrutura principal:

```text
src/
├── app/
│   ├── api/                 # fronteiras HTTP e regras de acesso
│   ├── auth/                # login, solicitação e recuperação
│   └── dashboard/           # ambientes admin e empresa
├── components/              # UI, dashboard, landing e segurança
├── contexts/                # estado compartilhado da interface
├── hooks/                   # integrações reutilizáveis da UI
├── lib/                     # autenticação, banco, segurança e serviços
├── proxy.ts                 # proteção inicial e CSP por requisição
└── utils/                   # exportação e utilidades de domínio

prisma/
├── schema.prisma            # modelo relacional
└── migrations/              # histórico imutável de mudanças

assets/source/               # fontes preservadas, fora da publicação web
public/                      # ativos efetivamente servidos ao navegador
scripts/                     # criptografia e rotação de dados
tests/                       # regressões de segurança
```

## Papéis e autorização

| Papel | Escopo |
| --- | --- |
| `ADMIN_RPM` | administração global da plataforma |
| `GESTOR_EMPRESA` | gestão da própria empresa, equipe e módulos |
| `OPERADOR` | operações permitidas para a própria empresa |
| `VISUALIZADOR` | acesso prioritariamente consultivo |

Autenticação não é tratada como autorização. APIs sensíveis revalidam a sessão
no banco, o papel, a empresa, os módulos e a propriedade do recurso. Valores
como `empresaId`, papel, plano, preço e permissões enviados pelo navegador não
são fonte de autoridade.

## Planos

Capacidades técnicas ficam versionadas em `src/utils/planos.ts`; preços e
visibilidade comercial ficam no catálogo `planos_comerciais`, editável pelo
administrador.

| Plano | Usuários base | Veículos base | Histórico | Recursos adicionais |
| --- | ---: | ---: | ---: | --- |
| `ESSENCIAL` | 4 | 10 | 1 ano | frota, gestão e notificações |
| `AVANCADO` | 10 | 25 | 2 anos | tarefas e delegação |
| `ENTERPRISE` | 25 | 80 | 3 anos | relatórios personalizados |
| `PREVIEW` | sandbox | sandbox | 3 anos | todos os módulos; acesso restrito |

Solicitações de mudança de plano, cotas ou negociação são calculadas no
servidor, guardam a versão do catálogo e impedem pedidos pendentes concorrentes
do mesmo tipo.

## Segurança

As principais decisões de segurança são:

- cookie de sessão `HttpOnly`, `SameSite=Lax` e `Secure` em produção;
- sessões persistidas, expiradas e revogáveis, com versão por usuário;
- bcrypt com custo uniforme também para e-mails inexistentes no login;
- respostas indistinguíveis na solicitação de recuperação de senha;
- tokens de redefinição com hash, expiração e uso único;
- Cloudflare Turnstile opcional, com hostname e ação verificados no servidor;
- rate limit atômico no PostgreSQL para login, reset, relatórios,
  notificações, uploads e operações administrativas;
- aprovação de acesso com transição atômica contra replay concorrente;
- validação Zod e limites de corpo nas fronteiras HTTP;
- proteção CSRF por origem e `Sec-Fetch-Site` nas mutações;
- CSP com nonce por requisição, bloqueio de scripts inline e permissões mínimas;
- HSTS em produção e headers contra clickjacking, MIME sniffing e vazamento de
  referência;
- AES-256-GCM com chave derivada por empresa/campo e índices cegos HMAC;
- auditoria transacional com identidade confiável e eventos pseudonimizados;
- buckets privados, URLs assinadas curtas e validação real de uploads;
- RLS habilitada, privilégios revogados de `anon` e `authenticated` e Data API
  desativada para as tabelas internas.

O frontend nunca é uma barreira de segurança. Não use a chave
`SUPABASE_SECRET_KEY`, credenciais do banco ou chaves de criptografia em
variáveis `NEXT_PUBLIC_*`.

Para reportar uma vulnerabilidade, consulte [SECURITY.md](SECURITY.md).

## Pré-requisitos

- Node.js 20.9 ou superior;
- npm 10 ou superior;
- PostgreSQL compatível com Prisma 6 ou um projeto Supabase;
- projeto Supabase com Storage, caso relatórios e fotos sejam usados.

## Instalação local

```bash
git clone https://github.com/GabrielAssencao/RPMTRUCK-Logistics.git
cd RPMTRUCK-Logistics
npm ci
```

Crie o arquivo local de ambiente:

```powershell
Copy-Item .env.example .env
```

Preencha `.env`, gere o client e aplique as migrations:

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

## Variáveis de ambiente

| Variável | Escopo | Obrigatória | Finalidade |
| --- | --- | --- | --- |
| `DATABASE_URL` | servidor | sim | conexão pooled usada pela aplicação |
| `DIRECT_URL` | servidor | sim | conexão direta usada por migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | público | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público | sim | chave pública do Supabase |
| `SUPABASE_SECRET_KEY` | servidor | Storage | acesso privilegiado aos buckets privados |
| `RELATORIOS_STORAGE_SOFT_LIMIT_BYTES` | servidor | não | teto preventivo; padrão de 700 MiB |
| `NEXT_PUBLIC_SITE_URL` | público | produção | origem canônica da aplicação |
| `PRIVACY_CONTACT_EMAIL` | servidor | produção | canal público exibido na Política de Privacidade |
| `APP_ALLOWED_ORIGINS` | servidor | não | origens extras, separadas por vírgula |
| `JWT_SECRET` | servidor | sim | assinatura de sessão; mínimo de 32 caracteres |
| `RATE_LIMIT_HASH_SECRET` | servidor | recomendado | pseudonimização separada para o limitador |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | público | Turnstile | chave pública do widget |
| `TURNSTILE_SECRET_KEY` | servidor | Turnstile | validação do desafio |
| `TURNSTILE_ALLOWED_HOSTNAMES` | servidor | Turnstile | hosts aceitos, separados por vírgula |
| `TURNSTILE_REQUIRED` | servidor | não | exige desafio quando igual a `true` |
| `DATA_ENCRYPTION_ACTIVE_VERSION` | servidor | criptografia | versão ativa: `v1` ou `v2` |
| `DATA_ENCRYPTION_MASTER_KEY` | servidor | recomendado | chave Base64 de 32 bytes para AES-GCM |
| `DATA_BLIND_INDEX_KEY` | servidor | recomendado | chave Base64 de 32 bytes para índices HMAC |
| `DATA_ENCRYPTION_PREVIOUS_VERSION` | servidor | rotação | versão anterior temporária |
| `DATA_ENCRYPTION_PREVIOUS_MASTER_KEY` | servidor | rotação | chave mestra anterior |
| `DATA_BLIND_INDEX_PREVIOUS_KEY` | servidor | rotação | chave de índice anterior |

Gere segredos independentes. Exemplos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Nunca copie valores de CI ou placeholders para produção. Perder a chave mestra
de dados torna os campos criptografados irrecuperáveis; mantenha backup seguro e
teste a restauração.

## Supabase e banco de dados

1. Crie o projeto e copie as connection strings do pooler e da conexão direta.
2. Use a porta do Transaction Pooler em `DATABASE_URL` e a conexão direta em
   `DIRECT_URL`.
3. Configure a URL, chave pública e `SUPABASE_SECRET_KEY` no servidor.
4. Execute `npx prisma migrate deploy` a partir de um ambiente confiável.
5. Confirme no painel que os buckets `relatorios-privados` e
   `motoristas-fotos` são privados.
6. Mantenha a Data API desativada ou revise integralmente grants e RLS antes de
   reativá-la.

O sistema usa sessão própria e não depende de `auth.uid()` para autorização. O
Prisma acessa o banco no servidor; as tabelas internas não devem ser expostas ao
navegador pelo SDK do Supabase.

### Storage privado

`relatorios-privados` aceita PDF, XLS, XLSX ou CSV de até 10 MB. Arquivos gerados
recebem checksum SHA-256, período, tamanho e ciclo de retenção. Downloads usam
URL assinada por 60 segundos.

`motoristas-fotos` guarda apenas WebP final de 480 × 640 pixels e até 200 KiB.
A API recebe JPG, PNG ou WebP de até 5 MiB, valida o conteúdo, remove metadados e
substitui a foto anterior.

Storage não substitui backup. Mantenha cópia externa dos arquivos necessários à
recuperação de desastre.

## Migrations

Migrations são incrementais e devem ser aplicadas na ordem versionada. Elas
cobrem:

- modelagem inicial e relações de frota;
- atualização de campos de veículos e motoristas;
- padronização de planos e buckets privados;
- dados persistentes de tarefas e notificações;
- fotos privadas, arquivamento operacional e histórico permanente;
- permissões do dashboard, faturamento e quilometragem;
- sessões, reset seguro, rate limit e auditoria;
- bloqueio da Data API para tabelas internas;
- índices de desempenho, criptografia, redação de logs e eventos;
- catálogo comercial e solicitações de assinatura.

Em desenvolvimento, crie migrations com `npx prisma migrate dev`. Em produção,
use somente:

```bash
npx prisma migrate deploy
```

Não execute `prisma db push` em produção e não edite migrations já aplicadas.
Faça backup restaurável antes de mudanças de banco.

## Criptografia e rotação

Para proteger registros legados, configure as chaves `v1`, faça backup e rode
primeiro a simulação:

```bash
npm run security:encrypt-data
npm run security:encrypt-data -- --apply
```

Para migrar de `v1` para `v2`, preserve as duas chaves antigas nas variáveis
`PREVIOUS_*`, configure as novas chaves ativas e interrompa escritas durante o
processo:

```bash
npm run security:rotate-data
npm run security:rotate-data -- --apply
```

Remova as chaves anteriores do ambiente somente depois de verificar que não
restam valores `enc:v1` e de confirmar um backup recuperável.

## Qualidade e testes

```bash
npm run typecheck          # TypeScript sem emissão
npm run lint               # ESLint
npm run test:security      # regressões da auditoria
npm run prisma:validate    # schema e datasource Prisma
npm run build              # build de produção
npm run security:audit-git # segredos na árvore e no histórico Git
npm audit --audit-level=high
```

O workflow em `.github/workflows/ci.yml` executa essas verificações em pushes e
pull requests. Dependabot acompanha npm e GitHub Actions.

## Deploy na Vercel

O arquivo `vercel.json` usa `npm run vercel-build`, que gera o Prisma Client e
executa o build. Migrations não são executadas automaticamente no build para
evitar que previews alterem um banco compartilhado.

1. Importe o repositório na Vercel como projeto Next.js.
2. Cadastre todas as variáveis de servidor somente em ambientes apropriados.
3. Use valores separados para Preview e Production; nunca conecte previews ao
   banco de produção sem intenção explícita.
4. Defina `NEXT_PUBLIC_SITE_URL` com a URL HTTPS final e configure
   `APP_ALLOWED_ORIGINS` se houver domínios adicionais.
5. Defina `PRIVACY_CONTACT_EMAIL`, complete a identificação jurídica do
   fornecedor nos documentos/contratos e submeta os textos de privacidade à
   revisão jurídica da operação concreta.
6. Cadastre o domínio final no Turnstile antes de definir
   `TURNSTILE_REQUIRED=true`.
7. Aplique `npx prisma migrate deploy` por um job confiável ou terminal seguro.
8. Faça o deploy e valide login, logout, reset, isolamento entre empresas,
   relatórios, fotos, headers e CSP.
9. Meça a landing com Lighthouse/PageSpeed em mobile e desktop e monitore os
   Core Web Vitals reais depois da publicação.
10. Monitore logs, consumo do banco/Storage e eventos de rate limit.

Após trocar domínio, segredo JWT ou chaves, planeje o impacto: mudar
`JWT_SECRET` invalida sessões; trocar chaves de dados sem rotação impede leitura.

## Checklist para repositório público

- `.env` está ignorado e apenas `.env.example` é versionado;
- LICENSE, avisos de terceiros, política de segurança e contribuição existem;
- o modelo 3D preserva atribuição CC BY 4.0;
- arquivos-fonte grandes ficam fora de `public/` e do deploy;
- CI, Dependabot e testes de segredos estão configurados;
- nenhum dump, token, chave privada ou credencial deve aparecer no histórico;
- habilite **Private vulnerability reporting** nas configurações do GitHub;
- proteja `main` exigindo CI e revisão antes de merge.

## Roadmap

- ampliar testes unitários e de integração de autorização multiempresa;
- automatizar migrations em pipeline separado e controlado;
- adicionar observabilidade, alertas e estratégia formal de backup;
- concluir persistência e refinamento dos módulos ainda em evolução;
- aprofundar acessibilidade e testes de interface responsiva;
- evoluir cobrança, comunicação por e-mail e operação dos planos.

## Licença e atribuições

O código do projeto está sob a [licença MIT](LICENSE). Modelos 3D e decoders têm
licenças próprias descritas em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Desenvolvido por **Gabriel Assencao**.
