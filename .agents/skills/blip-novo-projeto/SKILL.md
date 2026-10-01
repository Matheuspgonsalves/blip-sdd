---
name: blip-novo-projeto
description: >-
  Cria a pasta de um contrato/cliente Blip novo a partir da pasta modelo CONTRATO/ (prd/, dev/, collections/, spec/) e organiza os arquivos que o usuário trouxer (JSONs exportados do Studio, Figma, recursos, collections). Use quando o usuário pedir para criar, iniciar ou montar o projeto de um cliente, começar um contrato novo, ou disser que vai trazer/importar os fluxos de produção de um router.
---

# blip-novo-projeto

## 1. Coletar o mínimo
Pergunte só o que não der para inferir da mensagem:
- **Nome da pasta do contrato** (ex.: `Acme`, `Contoso`). Use o nome do cliente sem espaços nem acentos; se o cliente tem mais de um projeto independente, `Cliente-Projeto` (ex.: `Acme-Vendas`).
- **Situação**: projeto **novo** (do zero) ou **existente** (já tem bots em produção)?

Se a pasta já existir, não sobrescreva nada: avise e pergunte se é para completar o que falta.

## 2. Criar a estrutura
Copie a pasta modelo `CONTRATO/` (raiz do workspace) inteira para `<NomeDoCliente>/`, no mesmo nível. Resultado:
```
<CONTRATO>/
├── prd/fluxos/  prd/whatsapp-flows/  prd/RECURSOS.md
├── dev/fluxos/  dev/whatsapp-flows/  dev/RECURSOS.md
├── collections/ambientes/exemplo.postman_environment.json
└── spec/
    ├── CONTEXTO.md  ESPECIFICACAO.md  DECISOES.md
    ├── figma/  features/  historico/  relatorios-diarios/
    └── testes/checklists/  testes/relatorios/
```
Substitua `{{CONTRATO}}` e `{{DATA}}` nos arquivos copiados.

## 3. Organizar o material recebido
Se o usuário anexou ou apontou arquivos:
| Material | Destino |
|---|---|
| JSON exportado de bot publicado | `prd/fluxos/<nomedobot>.json` (nome do bot no Blip, minúsculo) |
| JSON de bot em desenvolvimento | `dev/fluxos/` |
| JSON de telas de WhatsApp Flow | `prd/whatsapp-flows/` ou `dev/whatsapp-flows/` |
| Frames do Figma (PNG/SVG/PDF) | `spec/figma/` |
| Collection Postman | `collections/` (antes, rode a checagem de segredos da skill `blip-collection`) |
| Planilha/lista de recursos, URLs, chaves | nomes e URLs em `RECURSOS.md`; **valores secretos** em `collections/ambientes/<prd|dev>.postman_environment.json` |
| Contexto do cliente (e-mail, doc, áudio transcrito) | resumir em `spec/CONTEXTO.md` |

Nunca copie o valor de uma chave para `RECURSOS.md`.

Depois de organizar, rode `node .githooks/checar-segredos.mjs --todos` e mostre ao usuário o que foi encontrado (fluxos exportados e collections antigas costumam ter chaves escritas). Nada disso pode ser commitado até ser trocado por referência.

## 4. Primeiro registro
- Crie `spec/historico/<hoje>.md` com a entrada "Projeto criado" e a lista do que foi organizado.
- Se o projeto é **existente** e há JSONs em `prd/fluxos/`, ofereça rodar o **Modo Engenharia Reversa** da skill `blip-spec-driven` para gerar a `ESPECIFICACAO.md`.
- Se é **novo**, ofereça começar o `CONTEXTO.md` em conversa (objetivo, público, canais, topologia esperada).

## 5. Lembrete de ambiente
Diga ao usuário, em uma linha, que as chaves vão em `collections/ambientes/prd.postman_environment.json` e `dev.postman_environment.json` (copiando o `exemplo`), e que essa pasta é ignorada pelo git (o resto do contrato é versionado no repositório privado).
