---
name: blip-collection
description: >-
  Cria ou atualiza collections Postman (v2.1) do contrato ativo: commands da Blip específicos do projeto (Desk, contextos, WhatsApp Flows, templates) e APIs do cliente a partir de documentação, Swagger/OpenAPI, cURL, exemplos de request ou prints. Também revisa collections existentes para tirar segredos e padronizar variáveis. Use quando o usuário pedir para criar, montar, gerar ou ajustar uma collection, transformar um cURL/Swagger em collection, ou importar uma collection para o projeto.
---

# blip-collection

Collections são **por projeto**: cada contrato tem as suas em `<CONTRATO>/collections/`. As de `_templates/collections/` são só referência (formato dos commands Blip, fluxo de WhatsApp Flows).

## 1. Entender o pedido
- **Commands da Blip** (fila, tickets, contextos, flows, templates)? Parta das requests equivalentes em `_templates/collections/blip-geral.postman_collection.json` ou `wa-flows-template.postman_collection.json` e copie só o que o projeto precisa.
- **API do cliente**? Peça a fonte se não veio: documentação, Swagger/OpenAPI, cURL, exemplo do Postman deles, ou o bloco HTTP de um fluxo em `prd/fluxos/` (ali já estão URL, método, headers e body reais).
- Uma collection por assunto: `<contrato>-blip-commands`, `<contrato>-whatsapp-flows`, `<contrato>-api-<sistema>` (ex.: `acme-api-gateway`). Se já existir uma do mesmo assunto, **atualize** em vez de criar outra.

## 2. Convenção de variáveis (obrigatória)
Valores reais **nunca** entram na collection. Só `{{variavel}}`; os valores ficam em `collections/ambientes/<prd|dev>.postman_environment.json`.

| Variável | Uso |
|---|---|
| `{{blip_url}}` | `https://<contrato>.http.msging.net` (ou `https://http.msging.net` em contas antigas) |
| `{{Authorization}}` | valor completo `Key xxxxx` do bot/roteador usado por padrão |
| `{{key_<bot>}}` | chave de um subbot específico, quando precisar consultar outro bot (`Authorization: {{key_captacao}}`) |
| `{{<sistema>_base_url}}` | URL base de API do cliente (`{{gateway_base_url}}`) |
| `{{<sistema>_token}}` | token/JWT de API do cliente |
| IDs de trabalho | `{{flow_id}}`, `{{template_name}}`, `{{identity}}`, `{{ticket_id}}` — vazios por padrão |

- Commands Blip: `POST {{blip_url}}/commands`, header `Authorization: {{Authorization}}`, `Content-Type: application/json`, body com `"id": "{{$guid}}"`.
- Nunca deixe IDs fixos onde deveria haver variável (ex.: flow id escrito no `uri` de uma request e `{{flow_id}}` na outra).
- Corpos grandes (JSON das telas de um WhatsApp Flow) não ficam embutidos: o arquivo vive em `dev/whatsapp-flows/` e a request indica de onde copiar, na `description`.
- Toda request tem `description` dizendo o que faz e se **altera** algo (ex.: "ESCRITA — publica o flow; não dá para despublicar, só depreciar").
- Nomeie com número de ordem quando houver sequência (`1. Criar flow`, `2. Enviar JSON`, `3. Publicar`).
- Scripts de teste do Postman podem salvar IDs retornados em variáveis de collection (`pm.collectionVariables.set("flow_id", …)`).

## 3. Ambientes
- Garanta que exista `collections/ambientes/exemplo.postman_environment.json` com **todas** as chaves usadas pelas collections do projeto, com valores vazios ou `PREENCHER`. Atualize-o sempre que criar uma variável nova.
- Não crie nem edite `prd`/`dev` com valores reais por conta própria; diga ao usuário quais variáveis ele precisa preencher.

## 4. Checagem de segredos (sempre, ao criar ou importar)
Procure em toda collection que entrar no projeto:
- `"Key ` seguido de base64, `Bearer ` seguido de token, strings `eyJ…` (JWT), campos `password`, `secret`, `apikey` com valor;
- valores preenchidos no array `variable` da collection.

Encontrou? Troque pelo `{{nome}}` correspondente, mova o valor (só se o usuário pedir) para o ambiente e **avise o usuário** que esse segredo já circulou em arquivo e pode precisar ser rotacionado.

## 5. Validar e registrar
- O JSON precisa abrir no Postman: schema `https://schema.getpostman.com/json/collection/v2.1.0/collection.json`, `info._postman_id` (uuid novo) e `item` válidos.
- Teste a listagem: `node .agents/skills/blip-consultar/scripts/blip-request.mjs <collection.json> --listar`.
- Se o usuário quiser, rode uma request de leitura com `blip-consultar` para provar que funciona.
- Registre no `spec/historico/<hoje>.md` (collection criada/alterada e variáveis novas a preencher).
