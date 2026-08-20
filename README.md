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
| Aplicação | Next.js 14, React 18, TypeScript |
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
- identidade e empresa derivadas da sessão confiável nas APIs protegidas;
- validação de dados nas fronteiras do backend;
- senhas armazenadas somente como hashes;
- respostas públicas agregadas e com exposição mínima;
- limitação de requisições em operações sensíveis;
- `.env` e artefatos locais excluídos do versionamento.

> As políticas de segurança e isolamento devem continuar sendo validadas antes de qualquer implantação em produção, incluindo as políticas RLS do Supabase e as permissões de cada nova API.

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

- Node.js 20 ou superior
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

Preencha as credenciais locais sem versionar o arquivo `.env`. Em seguida:

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### Bucket privado de relatórios no Supabase Free

A migração `20260819000000_padroniza_planos_e_arquivos_privados` cria o bucket
`relatorios-privados` como privado, com limite de 10 MB por arquivo. Para habilitar
upload e download, copie a chave `service_role` de **Supabase > Project Settings > API**
para `SUPABASE_SERVICE_ROLE_KEY` no ambiente do servidor. Nunca use essa chave em uma
variável `NEXT_PUBLIC_*`.

O aplicativo aplica um teto interno padrão de 900 MiB para preservar margem dentro
do 1 GB do plano Free. O valor pode ser reduzido por
`RELATORIOS_STORAGE_SOFT_LIMIT_BYTES`. O teto considera os relatórios registrados
pelo aplicativo; outros buckets também consomem a franquia e devem ser acompanhados
no painel do Supabase.

O bucket não aceita leitura pública. A aplicação grava os arquivos pelo servidor,
registra SHA-256, período e tamanho no PostgreSQL e libera downloads por URLs
assinadas válidas por 60 segundos. Esses arquivos são um arquivo operacional; para
recuperação de desastre, mantenha futuramente uma cópia externa ao projeto Supabase.

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
