---
name: blip-mapear-router
description: >-
  Mapeia um router (roteador) Blip de um contrato, só lendo da API: descobre os bots e serviços do router, baixa o JSON publicado de cada bot direto para prd/fluxos/ (sem o usuário exportar manualmente), levanta a topologia de redirecionamentos e documenta na ESPECIFICACAO.md o mapa bot × serviço × arquivo × frame do Figma. Use quando o usuário pedir para consultar/listar os bots de um router, baixar ou atualizar os fluxos de produção pela API, montar o mapa do que existe, associar bots ao Figma, ou começar um projeto existente a partir do router.
---

# blip-mapear-router

Monta o retrato de um router que já está em produção: **quais bots existem, como se conectam, o que cada um faz e qual frame do Figma cada um implementa**. É o primeiro passo em todo projeto existente.

> **Somente leitura.** Esta skill (e qualquer skill deste workspace) nunca envia, publica, altera ou apaga nada na Blip. O script usa apenas commands `get`. Publicar, alterar recurso, mudar configuração: o usuário faz manualmente no portal.

Script: `node .agents/skills/blip-mapear-router/scripts/blip-router.mjs <subcomando> …` (rode a partir da raiz do workspace).

---

## Passo 1 — Preparar o ambiente
Arquivo: `<CONTRATO>/collections/ambientes/prd.postman_environment.json` (copiado do `exemplo`). O usuário preenche; você nunca pede chave no chat.

| Variável | Valor |
|---|---|
| `blip_url` | `https://<contrato>.http.msging.net` |
| `Authorization` | `Key …` do **roteador** |
| `key_roteador` (opcional) | mesma key do roteador; o script não tenta baixar fluxo dela |
| `key_<identificador>` | `Key …` de **cada bot** do router. `<identificador>` é o nome do bot no Blip, e vira o nome do arquivo (`key_ecovitacaptacaodev` → `prd/fluxos/ecovitacaptacaodev.json`). |

Cada key só lê o próprio bot: sem a key de um bot, não dá para baixar o fluxo dele. Se faltar alguma, siga com as que existem e liste no final o que ficou faltando.

## Passo 2 — Descobrir os bots do router
```bash
node .agents/skills/blip-mapear-router/scripts/blip-router.mjs descobrir --ambiente <CONTRATO>/collections/ambientes/prd.postman_environment.json
```
Mostra, para cada key do ambiente, o nome do bot (`/account`) e se ele tem fluxo do Builder, além de uma tentativa **experimental** de ler as configurações do roteador.

A lista oficial de **serviços do router** (nome do serviço → bot) vem da tela de serviços do roteador no portal. Se o `descobrir` não trouxer essa lista, peça ao usuário um print dessa tela (uma vez por projeto) e registre a tabela na `ESPECIFICACAO.md`.

## Passo 3 — Baixar os fluxos publicados para `prd/`
```bash
node .agents/skills/blip-mapear-router/scripts/blip-router.mjs baixar \
  --ambiente <CONTRATO>/collections/ambientes/prd.postman_environment.json \
  --contrato <CONTRATO>
# um bot só:  --chave key_ecovitacaptacaodev
```
- Lê os buckets `blip_portal:builder_published_flow`, `…_global_actions` e `…_subflows` de cada bot e monta o JSON no mesmo formato do export do Studio (`flow`, `globalActions`, `subflows`).
- Grava em `<CONTRATO>/prd/fluxos/<identificador>.json` via safe-save (versão anterior em `prd/_backups/`).
- **Versão:** o padrão é a publicada. Se o bot não tiver bucket "published", o script para e lista os buckets que existem. Só use `--versao rascunho` (`working`: o que está no editor, talvez não publicado) com o ok do usuário, e registre isso no histórico.
- **Blocos removidos:** se a versão da Blip não tiver blocos que existem no `prd/` local, o script para e lista os IDs. Mostre ao usuário; com o ok dele, rode de novo com `--aceitar-remocoes`.
- **Credenciais:** o resumo avisa quando o fluxo tem chave escrita (P-014). Liste para o usuário quais bots; ele corrige no Studio (troca por `{{resource.x}}`).

Nunca copie, reescreva ou "resuma" o JSON pelo chat: o arquivo é sempre gravado pelo script.

## Passo 4 — Topologia
```bash
node .agents/skills/blip-mapear-router/scripts/blip-router.mjs topologia --contrato <CONTRATO> --saida <CONTRATO>/_scratch/topologia.md
```
Lista, por bot, para quais **serviços** ele redireciona (ações `Redirect`) e gera um Mermaid. Cruze com a tabela de serviços do passo 2:
- todo serviço citado num redirect deve corresponder a um bot do router; serviço sem bot conhecido = **bot faltando em `prd/`** (avise);
- bot do router que ninguém redireciona = entrada pelo roteador (serviço padrão) ou bot morto; aponte.

## Passo 5 — O que cada bot faz
Para cada `prd/fluxos/*.json`, siga o **Modo Engenharia Reversa** da skill `blip-spec-driven` (objetivo, jornada principal, entradas, integrações HTTP, transbordos, variáveis, riscos com `blip-audit.mjs`). Router com muitos bots: um subagente por JSON, em paralelo.

## Passo 6 — Associar bots ao Figma
Fonte: `<CONTRATO>/spec/figma/` (PNG 2x para o fluxo; SVG sem "Outline text" para os textos).
1. Para cada frame, liste as mensagens, botões e títulos de bloco que aparecem nele.
2. Para cada bot, liste as mensagens dos conteúdos dos blocos (`$contentActions`) e os títulos.
3. Associe frame ↔ bot pela coincidência de textos (frases idênticas ou quase idênticas valem mais que palavras soltas).
4. Classifique: **Alta** (maioria das mensagens do frame está no bot), **Parcial** (parte está; diferenças relevantes), **Sem correspondência**.
5. Para Parcial, liste as diferenças (mensagem do Figma que não existe no bot, caminho do bot que não está no Figma).

Se um frame não tiver bot correspondente, pode ser algo ainda não implementado; se um bot não tiver frame, falta Figma. Aponte os dois casos.

## Passo 7 — Documentar
Na `<CONTRATO>/spec/ESPECIFICACAO.md` (modelo em `CONTRATO/spec/ESPECIFICACAO.md`), preencha:
- **Mapa do router**: tabela serviço × bot no Blip × arquivo em `prd/fluxos/` × frame do Figma × correspondência × observação;
- **Topologia** (Mermaid do passo 4, revisado);
- **uma seção por bot** (passo 5);
- **pendências**: bots sem key, serviços sem bot, frames sem bot, bots sem frame, credenciais escritas.

Também:
- `spec/DECISOES.md`: registre fatos que confundem (ex.: "bots com 'dev' no nome são de produção neste router").
- `prd/RECURSOS.md`: bots e identificadores do router (sem valores secretos).
- `spec/historico/<hoje>.md`: o que foi baixado (bots, versão publicada/rascunho), o que faltou e as pendências.

Termine mostrando ao usuário, no chat, o mapa (tabela) e as pendências.
