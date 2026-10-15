# Revisão de segurança — 20/09/2026

## Escopo e limites

Revisão do checkout local, incluindo alterações ainda não commitadas. Inspeção de autenticação, autorização por empresa/papel, recuperação de senha, uploads, cobrança/recorrência e webhook; testes automatizados e consulta de metadados do Supabase de desenvolvimento. O banco de desenvolvimento é remoto e foi validado como distinto de produção antes das consultas e da migração. Produção não foi alterada nem submetida a testes.

Esta é uma revisão técnica direcionada, não um pentest exaustivo nem uma certificação. Testes comportamentais usam dependências simuladas; os testes HTTP usam o servidor local. Não foram simulados DDoS, roubo real de credenciais, pagamentos reais ou ataques contra terceiros.

## Falhas corrigidas

### 1. Proteção ausente em cinco tabelas financeiras — alta prioridade

As migrações de `recorrencias_pagamento`, `despesas_plataforma`, `promocoes_comerciais`, `configuracoes_pix_promocoes` e `configuracoes_pix_planos` criavam tabelas sem habilitar RLS/revogar os acessos de papéis públicos. A auditoria do banco de desenvolvimento apontou as cinco tabelas como inconsistentes. Um cliente tentando acessar diretamente a Data API poderia contornar a autorização das rotas se a API e os privilégios permitissem; a exposição HTTP externa não foi demonstrada nesta revisão.

Correção: migração incremental `20260920090000_financial_tables_security`, habilitando RLS e revogando privilégios de PUBLIC, anon e authenticated. Acesso permanece pelo backend confiável, conforme a arquitetura existente. Não foram excluídos registros. A única migração pendente foi conferida antes da aplicação em desenvolvimento.

Após aplicação: 38 tabelas verificadas, zero inconsistências pelo auditor. Os quatro buckets verificados, incluindo `cobrancas-pix-privadas`, estão privados. A mesma migração precisa acompanhar o próximo deploy; não há conclusão sobre o estado atual de produção.

### 2. Limites de corpo aplicados tarde demais — prioridade média

Login, solicitação de acesso e recuperação de senha usavam `request.json()`; o proxy verificava apenas o Content-Length. Um envio sem esse cabeçalho poderia ser carregado integralmente antes da validação dos campos. O webhook verificava o tamanho real somente após `request.text()` (neste caso o atacante também precisaria conhecer o token do webhook).

Correção: reaproveitamento da leitura limitada de stream. JSON público limitado a 16 KiB e webhook a 128 KiB, cancelando o stream ao exceder o limite. JSON malformado retorna 400 e excesso retorna 413. Token de webhook inválido é recusado antes da leitura do corpo. A proteção continua após o rate limit nas rotas públicas.

Testes novos exercitam streams sem tamanho confiável, cancelamento, JSON malformado, payload válido e autenticação falsa. Os testes financeiros existentes passaram a usar um Request real, preservando os cenários de pagamento.

## Cenários de ataque avaliados

| Tentativa | Evidência obtida |
| --- | --- |
| Alterar papel, empresa ou identidade no cookie | Testes comportamentais recusam dados divergentes do banco, assinatura inválida e algoritmo não permitido. |
| Reutilizar sessão revogada ou usuário desativado | Testes comportamentais negam acesso. |
| Operador chamar ações de gestor/superadmin | Autorização server-side e testes negam acesso. |
| Gestor promover usuário a administrador ou editar outra empresa | Testes negam o payload ou o recurso; IDs são limitados pela empresa da sessão. |
| Forjar pagamento ou informar valor diferente | Token do webhook verificado; testes recusam valor e vínculo recorrente divergentes. |
| Enviar requisição de outra origem | Testes HTTP locais verificam bloqueio por origem. |
| Abusar de arquivos compactados ou falsificar uma imagem | Testes existentes de XLSX e imagem passaram; isso não equivale a antivírus. |
| Consumir memória com corpo excessivo | Novos testes comprovam rejeição durante leitura nas rotas corrigidas. |

## Pontos restantes e recomendações

- Não foi encontrado MFA/TOTP no fluxo de autenticação revisado. Priorizar segundo fator para o superadmin: senha roubada continua sendo um risco mesmo com rate limit.
- A validação de comprovante em `cobrancaPixStorage.ts` confere tamanho, MIME e assinatura inicial PDF; não faz análise antimalware do documento. Armazenamento privado não garante que um arquivo baixado seja inofensivo. Avaliar análise de conteúdo/quarentena conforme o uso crescer.
- Outras rotas autenticadas ainda usam `request.json()`. Possuem barreiras de sessão/rate limit, mas cabe estender a leitura limitada por tipo de operação para resistência contra usuários autenticados mal-intencionados.
- Revisar concorrência entre adesão recorrente e emissão avulsa antes de ampliar recorrência: os caminhos consultam o estado do outro fluxo antes de suas próprias gravações, sem uma trava comum. Não foi executada prova de cobrança duplicada nesta revisão.
- A exclusão de empresa deve considerar a assinatura externa ativa. O fluxo atual de exclusão não chama cancelamento no Asaas; além disso, a nova relação de recorrência com fatura usa ON DELETE RESTRICT. Trata-se de risco de ciclo de vida financeiro a resolver/testar antes de excluir empresas com recorrência.
- Não foram auditados os painéis/configurações de produção do Supabase, Vercel, Asaas ou Cloudflare. As conclusões do banco são exclusivamente do ambiente de desenvolvimento.

## Validação

- 220 testes unitários/regressão aprovados.
- 4 testes HTTP locais aprovados: APIs sem sessão, origem externa, rotina interna sem autorização e webhook com token falsificado.
- Typecheck e lint aprovados.
- `npm audit --omit=dev`: zero vulnerabilidades conhecidas reportadas pelo registro na consulta.
- Auditoria de formatos conhecidos de segredos na árvore e no histórico Git: nenhum encontrado. Não comprova ausência de todo tipo possível de segredo.
- Migração aplicada somente em desenvolvimento e auditoria RLS/buckets repetida com sucesso.

O resultado reduz riscos confirmados; não significa que o sistema esteja livre de vulnerabilidades.
