# RPMTruck Logistics

Plataforma web para gestão operacional de transportadoras, criada para centralizar frota, motoristas, custos, manutenção, usuários e indicadores de negócio em uma experiência moderna e responsiva.

> Projeto full-stack em desenvolvimento ativo, construído como produto SaaS multiempresa e como demonstração prática de arquitetura, segurança, modelagem de dados e UI/UX aplicada ao setor logístico.

## Visão do produto

A RPMTruck nasceu para reduzir a fragmentação de informações comuns na operação de transportadoras. Em vez de distribuir dados entre planilhas e ferramentas isoladas, a plataforma propõe uma visão única da empresa e de sua frota.

O sistema possui dois ambientes principais:

- **Administração RPM:** gestão de empresas, solicitações de acesso, planos, módulos, usuários e redefinições de senha.
- **Operação da empresa:** acompanhamento da frota, motoristas, custos, manutenção, localizações, relatórios, notificações e equipe.

Cada empresa opera em seu próprio contexto, enquanto o administrador global controla o ciclo de entrada e os recursos liberados para cada cliente.

## Destaques

- Landing page interativa com animações e caminhão 3D.
- Autenticação com sessão JWT armazenada em cookie `HttpOnly`.
- Controle de acesso baseado em papéis e separação por empresa.
- Painel administrativo para operação do produto SaaS.
- Dashboard empresarial com módulos de logística.
- Gestão de veículos, motoristas, usuários, custos e notificações.
- Tela de manutenção com conceito visual de **Raio-X do caminhão**.
- Indicadores públicos agregados, sem exposição de registros sensíveis.
- Validação de entradas e proteção de rotas no servidor.
- Modelagem relacional e migrações versionadas com Prisma.
- Interface responsiva, temas e componentes reutilizáveis.

## Stack tecnológica

| Camada | Tecnologias |
| --- | --- |
| Aplicação | Next.js 16, React 19, TypeScript |
| Interface | Tailwind CSS, Lucide React, Framer Motion, GSAP |
| 3D | Three.js, React Three Fiber, Drei |
| Formulários e validação | React Hook Form, Zod |
| Dados e gráficos | Recharts, Zustand |
| Backend | Next.js Route Handlers |
| Banco de dados | PostgreSQL, Supabase, Prisma ORM |
| Autenticação | JWT com `jose`, cookies `HttpOnly`, bcrypt |

## Arquitetura

```text
src/
├── app/
│   ├── api/                 # APIs de autenticação, administração e operação
│   ├── auth/                # Login, solicitação de acesso e recuperação
│   ├── dashboard/admin/     # Painel do administrador RPM
│   └── dashboard/empresa/   # Ambiente operacional da transportadora
├── components/
│   ├── dashboard/           # Componentes dos painéis
│   ├── landing/             # Seções públicas e experiência 3D
│   └── ui/                  # Primitivos visuais reutilizáveis
├── contexts/                # Contextos compartilhados da interface
├── hooks/                   # Hooks da aplicação
├── lib/                     # Autenticação, banco e serviços internos
└── utils/                   # Funções auxiliares

prisma/
├── schema.prisma            # Modelo relacional da plataforma
└── migrations/              # Histórico versionado do banco

public/
├── images/                  # Ilustrações e componentes visuais do caminhão
├── logos/                   # Identidade visual
└── models/                  # Ativos 3D
```

## Domínio e controle de acesso

A plataforma foi modelada para um cenário multiempresa. Os principais papéis são:

- `ADMIN_RPM`: administra a plataforma e todas as empresas.
- `GESTOR_EMPRESA`: gerencia a operação e os usuários da própria empresa.
- `OPERADOR`: atua nos módulos operacionais permitidos.
- `VISUALIZADOR`: possui acesso prioritariamente consultivo.

Os planos disponíveis no domínio são `PREVIEW`, `ESSENCIAL`, `AVANCADO` e `ENTERPRISE`. A definição de plano e módulos pertence ao administrador RPM, não ao cliente no navegador.

As entidades centrais incluem empresas, usuários, veículos, motoristas, localizações, histórico veicular, custos, notificações, faturas, solicitações de acesso e redefinições de senha.

## Segurança

Algumas decisões incorporadas ao projeto:

- credenciais privadas restritas ao ambiente do servidor;
- cookies de sessão inacessíveis ao JavaScript do navegador;
- autorização separada de autenticação;
- sessão revalidada no banco e revogável por usuário;
- identidade e empresa derivadas da sessão confiável nas APIs protegidas;
- validação de dados nas fronteiras do backend;
- senhas armazenadas somente como hashes;
- redefinição de senha com token de uso único, hash e expiração;
- respostas públicas agregadas e com exposição mínima;
- limitação persistente e atômica de requisições sensíveis no PostgreSQL;
- auditoria por triggers com autor confiável, estado anterior/novo e logs imutáveis;
- RLS habilitada e acesso direto negado aos papéis `anon` e `authenticated`;
- CSP, HSTS em produção e cabeçalhos defensivos aplicados globalmente;
- `.env` e artefatos locais excluídos do versionamento.

O projeto usa sessão própria validada nas APIs, e não `auth.uid()` do Supabase. Por
isso, as tabelas não são expostas diretamente pelo SDK do navegador: o Prisma se
conecta no servidor e as APIs aplicam papel, empresa e plano. Novas tabelas e APIs
devem manter essa fronteira ou receber uma política RLS explicitamente revisada.

A integração privilegiada com o Storage usa `SUPABASE_SECRET_KEY` no servidor. Essa
variável recebe a chave moderna `sb_secret_...` e nunca deve possuir o prefixo
`NEXT_PUBLIC_`. O código não aceita mais a variável legada `SUPABASE_SERVICE_ROLE_KEY`.
Com a Data API desativada, a migração
`20260820070000_data_api_desativada` mantém um schema vazio no PostgREST para evitar
o erro recorrente `3F000`; antes de reativar a Data API, essa configuração precisa
ser revertida e os schemas expostos devem ser revisados.

## Estado atual

O projeto está em desenvolvimento incremental. Autenticação, sessão, estrutura administrativa, APIs centrais, modelagem Prisma e partes da comunicação com o banco já fazem parte da aplicação. Alguns módulos empresariais ainda utilizam dados demonstrativos enquanto suas operações persistentes são conectadas e validadas.

Essa abordagem permite evoluir a interface e o domínio sem apresentar protótipos como funcionalidades de produção. Os próximos ciclos priorizam:

- concluir a persistência dos módulos empresariais;
- ampliar testes de autorização e isolamento entre empresas;
- consolidar relatórios e indicadores operacionais;
- evoluir o Raio-X de manutenção e o histórico dos componentes;
- adicionar observabilidade, testes automatizados e pipeline de CI.

## Executando localmente

### Pré-requisitos

- Node.js 20.9 ou superior
- npm
- banco PostgreSQL ou projeto Supabase

### Instalação

```bash
git clone https://github.com/GabrielAssencao/RPMTRUCK-Logistics.git
cd RPMTRUCK-Logistics
npm install
```

Crie o arquivo de ambiente a partir do exemplo:

```powershell
Copy-Item .env.example .env
```

Preencha as credenciais locais sem versionar o arquivo `.env`. O `JWT_SECRET` deve
conter pelo menos 32 caracteres aleatórios; a aplicação não utiliza chave de
desenvolvimento como fallback. Defina também um `RATE_LIMIT_HASH_SECRET` independente,
com pelo menos 32 caracteres, para pseudonimizar IPs e e-mails gravados pelo limitador.
Se ele ainda não existir, o servidor usa temporariamente `JWT_SECRET`. Em seguida:

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### Bucket privado de relatórios no Supabase Free

A migração `20260819000000_padroniza_planos_e_arquivos_privados` cria o bucket
`relatorios-privados` como privado, com limite de 10 MB por arquivo. Para habilitar
upload e download, copie a chave `service_role` de **Supabase > Project Settings > API**
para `SUPABASE_SECRET_KEY` no ambiente do servidor. Prefira a chave moderna
`sb_secret_...` e nunca use essa chave em uma variável `NEXT_PUBLIC_*`.

O aplicativo aplica um teto interno padrão de 700 MiB para preservar margem dentro
do 1 GB do plano Free para fotos e outros objetos. O valor pode ser reduzido por
`RELATORIOS_STORAGE_SOFT_LIMIT_BYTES`. O teto considera os relatórios registrados
pelo aplicativo; outros buckets também consomem a franquia e devem ser acompanhados
no painel do Supabase.

O bucket não aceita leitura pública. A aplicação grava os arquivos pelo servidor,
registra SHA-256, período e tamanho no PostgreSQL e libera downloads por URLs
assinadas válidas por 60 segundos. Esses arquivos são um arquivo operacional; para
recuperação de desastre, mantenha futuramente uma cópia externa ao projeto Supabase.

A migração `20260820020000_arquivamento_operacional_permanente` adiciona o ciclo
seguro dos arquivos gerados no servidor: gerar, baixar, confirmar a guarda e, somente
depois do prazo do plano, remover os detalhes vinculados exatamente àquele arquivo.
O código do container, empresa, terminal de origem, terminal de destino, data da
operação, referência do relatório e checksum permanecem na tabela de movimentações
permanentes. O arquivo temporário só é removido do Storage após a limpeza transacional
dos detalhes; uma falha no Storage pode ser tentada novamente sem apagar o histórico.

### Fotos privadas de motoristas

A migração `20260820010000_bucket_privado_fotos_motoristas` cria o bucket privado
`motoristas-fotos`, limitado a WebP de 200 KiB. A API aceita JPG, PNG ou WebP de até
5 MiB, valida o conteúdo real, remove metadados, recorta em 3:4 e grava somente a
versão final de 480 × 640 pixels. Cada motorista possui um único arquivo, substituído
quando a foto é atualizada e removido junto com o cadastro. A leitura usa URL assinada
por uma hora; o navegador não recebe a chave `service_role`.

A aplicação estará disponível em [http://localhost:3000](http://localhost:3000).

## Comandos úteis

```bash
npm run dev       # servidor de desenvolvimento
npm run build     # build otimizado de produção
npm run start     # executa o build de produção
npm run lint      # análise estática do projeto
npx prisma studio # interface local para inspecionar os dados
```

## Compromisso de engenharia

Este projeto procura ir além de uma interface visual: as decisões consideram isolamento multiempresa, autorização no servidor, integridade do banco, tratamento de falhas, responsividade, acessibilidade e evolução sustentável do código.

## Autor

Desenvolvido por **Gabriel Assencao** como um produto de gestão logística e projeto de portfólio full-stack.

O repositório permanece privado durante a fase de desenvolvimento. Uma demonstração pública e documentação visual poderão ser adicionadas quando os fluxos principais estiverem estabilizados.
## Segurança operacional

As credenciais privilegiadas do Supabase devem existir somente no servidor. Use
`SUPABASE_SECRET_KEY=sb_secret_...`; nunca crie uma variável `NEXT_PUBLIC_` para essa chave.

Depois de atualizar o projeto:

1. Execute as migrations Prisma para ativar os índices, a redação da auditoria, RLS fechado,
   sessões e eventos de segurança.
2. Gere duas chaves independentes de 32 bytes em Base64 para
   `DATA_ENCRYPTION_MASTER_KEY` e `DATA_BLIND_INDEX_KEY` e armazene-as no cofre da hospedagem.
3. Faça backup do banco e simule a migração com `npm run security:encrypt-data`.
4. Aplique a criptografia existente com `npm run security:encrypt-data -- --apply`.
5. Configure Cloudflare Turnstile e somente então altere `TURNSTILE_REQUIRED=true`.

Se a chave mestra de dados for perdida, CPF, CNPJ, CNH, RG e telefones criptografados não
poderão ser recuperados. Mantenha uma cópia offline protegida e teste a recuperação.

### Rotação das chaves de dados

Nunca substitua diretamente uma chave que já protege registros `enc:v1`. Para migrar para
`enc:v2`, interrompa as escritas, faça um backup restaurável e preserve as chaves antigas em
um cofre offline. Gere duas chaves novas e configure temporariamente:

```env
DATA_ENCRYPTION_ACTIVE_VERSION="v2"
DATA_ENCRYPTION_MASTER_KEY="NOVA_CHAVE_MESTRA"
DATA_BLIND_INDEX_KEY="NOVA_CHAVE_DE_INDICE"
DATA_ENCRYPTION_PREVIOUS_VERSION="v1"
DATA_ENCRYPTION_PREVIOUS_MASTER_KEY="CHAVE_MESTRA_V1"
DATA_BLIND_INDEX_PREVIOUS_KEY="CHAVE_DE_INDICE_V1"
```

Com a aplicação parada, execute primeiro a simulação, que descriptografa e valida os registros
sem alterá-los:

```bash
npm run security:rotate-data
```

Depois do backup e da simulação bem-sucedida, aplique a transação atômica:

```bash
npm run security:rotate-data -- --apply --confirm=ROTATE_TO_V2
```

Execute novamente a simulação e confirme que todos os campos estão em `v2`. Teste a leitura e
a edição de empresas e motoristas. Só então remova da hospedagem as três variáveis `PREVIOUS_*`;
as chaves v1 devem continuar guardadas offline pelo período definido para recuperação de backup.
