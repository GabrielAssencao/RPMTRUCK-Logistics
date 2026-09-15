# Revisão de performance — 14/09/2026

O visual, a disposição dos elementos e os efeitos existentes foram preservados. A landing sem experiência 3D permanece dentro da meta de 3 segundos nas condições locais medidas.

## Mudanças

- Landing: `LazyMotion` com as funcionalidades de animação utilizadas pela página, reduzindo o JavaScript inicial. A imagem da carta em destaque recebe prioridade de download; as demais continuam com carregamento adiado.
- Admin: módulos carregados sob demanda, ao selecionar a aba, com feedback durante o carregamento.
- Fundo topográfico dos painéis: parâmetros comuns calculados uma vez por quadro. Um benchmark local encontrou aproximadamente 2,3 vezes mais velocidade no cálculo; testes comparam os valores com a fórmula anterior para proteger a aparência.
- Contadores de suporte: consultas de contagem substituem a transferência de tickets e mensagens para atualizar o indicador. Autenticação, autorização, isolamento da empresa e limites de requisição permanecem antes da consulta; respostas são privadas e sem cache.

## Medições

Build de produção local, Chromium, três execuções por perfil, cache do navegador desativado. PC simulado e celular usam CPU com desaceleração de 4 vezes, conexão de 5 Mbps e latência de 40 ms. Os números são medianas do tempo para exibir o maior elemento visível (LCP).

| Perfil | Antes | Depois | JavaScript antes → depois |
| --- | ---: | ---: | ---: |
| Landing desktop | 456 ms | 556 ms | 213 → 205 KiB |
| Landing PC simulado | 1.116 ms | 1.188 ms | 213 → 205 KiB |
| Landing celular | 812 ms | 828 ms | 213 → 205 KiB |
| Painel admin | 1.580 ms | 1.732 ms | 400 → 362 KiB |

Houve redução de 3,9% no JavaScript inicial da landing e 9,6% no admin. A amostra não demonstra melhoria no LCP; houve variação e aumento nessa métrica. Todas as execuções da landing otimizada ficaram abaixo de 1,3 segundo, sem deslocamentos de layout, erros de JavaScript, canvas ou downloads de modelos 3D. O bloqueio mediano da thread do admin caiu de 397 para 366 ms. O admin apresentou CLS de 0,019 durante o carregamento do módulo, abaixo do limite usual de 0,1.

Os dados do admin são 1.000 empresas sintéticas; suas APIs foram interceptadas no navegador. Isso mede renderização e transferência de código, sem acessar dados administrativos reais.

## Banco e limites

As tabelas operacionais examinadas possuem índices. No banco de desenvolvimento, a contagem de mensagens levou 1,261 ms de execução e a consulta de custos recentes 0,027 ms. Há poucos registros locais; esses tempos não comprovam desempenho com volume de produção. Não foram acrescentados índices ou alterados esquemas sem evidência de necessidade.

O 3D permanece condicionado à ativação e confirmação de download. Relatórios pesados já usam imports sob demanda e o provider de containers já se limita às rotas que o utilizam. A landing depende de um navegador moderno; tempo de hospedagem, rede, cache e hardware real precisam ser medidos após publicação. A meta de 3 segundos foi verificada nestas condições, sem garantia para todo computador ou conexão.

## Reprodução e validação

Com o servidor local na porta 5500 usando um build de produção:

```powershell
npm.cmd run build
npm.cmd run start:e2e
node --env-file=.env.local scripts/measure-performance.mjs optimized
node --env-file=.env.local scripts/profile-database.mjs
```

Os scripts exigem o ambiente de desenvolvimento isolado. Relatórios brutos estão em `performance/baseline.json`, `performance/optimized.json` e `performance/database.json`.

Build, lint e 140 testes unitários passaram. A suíte de navegador teve 41 testes aprovados e um teste de 3D omitido no perfil móvel; verifica landing, teclado, temas, login, solicitação de acesso e fronteiras de segurança. Cronograma e configurações do admin também foram abertos no navegador com APIs sintéticas, sem erros de JavaScript. Os testes de regressão novos cobrem a fórmula topográfica e autorização/isolamento nas consultas de contagem.
