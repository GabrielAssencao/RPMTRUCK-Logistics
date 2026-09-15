# Excel e importação inicial

Relatórios operacionais, backup de encerramento da conta e exportação de contas a pagar usam XLSX real, com formatos numéricos, datas, cabeçalhos, filtros e configuração de impressão. Contas a pagar passa de CSV para XLSX, mantendo a autorização e a disponibilidade do plano Enterprise.

Linhas são dimensionadas pelo conteúdo, inclusive quebras de linha e identificações mescladas. Campos muito extensos do backup recebem colunas `__parte_2`, `__parte_3` etc.; leia e concatene as partes em ordem. Relatórios com textos excepcionalmente longos incluem a aba **Textos completos**, com origem, célula e partes em sequência. Nenhum conteúdo é descartado para caber visualmente na célula. Estes tratamentos respeitam os [limites publicados pela Microsoft](https://support.microsoft.com/en-us/excel/excel-specifications-and-limits), incluindo a altura máxima de linha.

## Onde usar

- Gestor da empresa: atalho **Importar dados que já tenho** no painel ou **Configurações → Importar meus dados**.
- Superadmin: **Empresas / Clientes → Gerenciar → Importação inicial**. Empresas com lote pendente mostram um aviso na lista e na aba de gerenciamento.
- Download do modelo, preenchimento, envio, correção e aprovação ocorrem pelo sistema. As instruções e o guia de campos estão dentro da planilha.

O modelo cobre localizações, veículos, motoristas, custos, manutenções e containers. Usuários de acesso, senhas, documentos anexos, fotos e boletos não são importados. Abas sem dados podem ficar vazias. As referências usam placas, CPFs e nomes de localização, restritos à empresa; cadastros existentes não são sobrescritos.

## Regras

- Uma importação **aprovada** por empresa, sem prazo de expiração automática. Também fica disponível para empresas existentes que nunca utilizaram o benefício.
- Reprovação libera novo envio e informa o motivo; envio pendente não pode ser substituído silenciosamente.
- Até 1.000 registros no total e arquivo de 2 MB. Estrutura descompactada, dimensões e número de células são limitados antes de carregar o workbook.
- Datas aceitam DD/MM/AAAA, AAAA-MM-DD ou células de data do Excel. Documentos devem ser preenchidos como texto para preservar zeros iniciais.
- Validação no servidor de dados, documentos, duplicidades, vínculos, módulos, vagas de frota e período histórico do plano. Na aprovação, tudo é verificado novamente contra o banco atual.
- Containers preservam o histórico permanente e criam a despesa de comissão conforme a regra existente. A quilometragem inicial recebe seu registro de leitura. Não duplique comissões na aba Custos.
- A aprovação inclui o lote em uma transação serializável. Conflitos abortam o lote inteiro; atualizar e tentar novamente não duplica uma aprovação já concluída.

## Proteção e implantação

A nova tabela não possui acesso direto para `anon` ou `authenticated` no Supabase. APIs exigem gestor da própria empresa ou superadmin, possuem limitação de requisições e respostas privadas sem cache. Uploads são lidos com limite de bytes; macros, links externos, fórmulas e células compostas não são admitidos nos dados.

O lote pendente usa a criptografia existente, vinculada à empresa. O upload exige configuração válida de `DATA_ENCRYPTION_MASTER_KEY` e `DATA_BLIND_INDEX_KEY`. Após aprovação ou reprovação, o conteúdo temporário é apagado e permanecem status, contagens e comprovante da revisão. A auditoria exclui o conteúdo e os documentos. Auditoria de versões e rotação de chaves incluem lotes pendentes.

Backups de encerramento incluem dados enviados ainda pendentes, além dos registros operacionais já existentes. A exclusão da conta remove a fila de importação na mesma transação do expurgo.

A migration `20260914000000_importacao_inicial` foi aplicada somente ao banco de desenvolvimento isolado. Para publicar, aplicar migrations e gerar o Prisma Client antes de disponibilizar o código. Nenhuma alteração em produção foi executada nesta tarefa.

## Verificação

Testes automáticos geram e reabrem XLSX, verificam tipos, formatos, datas, zeros iniciais, textos longos e rejeição de conteúdo inválido. Arquivos sintéticos também foram abertos no Microsoft Excel instalado nesta máquina. Isso valida o formato atual; arquivos antigos e versões de Excel não disponíveis aqui não foram testados.

```powershell
npm.cmd run test:unit
node --env-file=.env.local scripts/test-initial-import-local.mjs
node --env-file=.env.local node_modules/@playwright/test/cli.js test --workers=2
```

O teste de integração exige ambiente de desenvolvimento isolado e desfaz todos os dados sintéticos, inclusive auditoria, ao final. Os testes autenticados de navegador usam APIs interceptadas com dados de demonstração. Para gerar os arquivos sintéticos de verificação:

```powershell
$env:RPM_EXCEL_FIXTURES='1'
node --test tests/excel-regressions.test.mjs
```
