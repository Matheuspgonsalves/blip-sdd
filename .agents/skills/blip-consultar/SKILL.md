---
name: blip-consultar
description: >-
  Executa requests das collections do contrato ativo (commands da Blip e APIs do cliente) para responder perguntas sobre o ambiente: tickets e filas do Desk, atendentes online, estado e variáveis de contexto de um usuário, contato/extras, templates, WhatsApp Flows, recursos e configurações. Use quando o usuário perguntar algo que só a plataforma ou a API do cliente sabe responder agora ("quantos tickets na fila X", "quem tá online", "em que bloco o usuário parou", "lista os flows", "pega o contexto desse contato").
---

# blip-consultar

## 1. Escolher contrato, ambiente e collection
- **Contrato ativo**: pela conversa (governança §1).
- **Ambiente**: `prd` por padrão para consultas; `dev` se o usuário falar de teste/homologação ou do bot de dev. Arquivo: `<CONTRATO>/collections/ambientes/<prd|dev>.postman_environment.json`. Se não existir, peça para o usuário criar a partir do `exemplo.postman_environment.json` (não peça a chave no chat).
- **Collection**: procure primeiro em `<CONTRATO>/collections/`. Se a request não existir lá, use `_templates/collections/blip-geral.postman_collection.json` (commands gerais da Blip). Se nenhuma tiver o que precisa, use a skill `blip-collection` para criar a request na collection do projeto e depois execute.

## 2. Achar a request
```bash
node .agents/skills/blip-consultar/scripts/blip-request.mjs <collection.json> --listar --buscar "<termo>"
```
A listagem marca `[L]` leitura, `[X]` escrita na Blip (proibida) e `[E]` escrita em API do cliente. Termos úteis na collection geral da Blip: `waiting tickets`, `online agents`, `teams metrics`, `user state`, `context variables`, `get a contact`, `message templates`, `last messages`, `ticket`.

## 3. Executar
```bash
node .agents/skills/blip-consultar/scripts/blip-request.mjs <collection.json> "<Pasta / Nome da request>" \
  --ambiente <CONTRATO>/collections/ambientes/prd.postman_environment.json \
  --var identity=5541999999999@wa.gw.msging.net --saida <CONTRATO>/_scratch/resposta.json
```
- Variáveis que a request pede e não estão no ambiente (`identity`, `ticket_id`, `queue`…) vão por `--var`. Se você não tem o valor, pergunte.
- Respostas grandes: use `--saida` e leia/filtre o arquivo, em vez de despejar tudo no chat.
- **Blip é somente leitura.** Requests `[X]` (set, delete, envio de mensagem, publicar/depreciar flow, etc.) nunca são executadas: o script recusa mesmo com `--confirmar`. Se o usuário pedir uma alteração na Blip, explique o que mudar e onde; ele faz no portal.
- **API do cliente** (`[E]`): o script recusa sem `--confirmar`. Antes de usar a flag, mostre ao usuário ambiente, request, o que muda e se dá para desfazer, e espere o "sim" (governança §5).

## 4. Responder
- Responda a pergunta, não o JSON: números, nomes, status, o que chama atenção (ex.: "12 tickets esperando na fila Hotline, o mais antigo há 47 min; 0 atendentes online nessa equipe").
- Nunca repita chaves, tokens ou o header `Authorization`.
- Dados pessoais de clientes finais: mostre só o necessário para a pergunta.
- Se a consulta faz parte da investigação de um bug, entregue o achado para a skill `blip-troubleshooter`.
- Consulta pura não precisa de entrada no histórico. Escrita executada em API do cliente precisa (o que foi alterado, quando, por quê).

## Endereços úteis (commands Blip)
| Assunto | `to` | `uri` |
|---|---|---|
| Estado do usuário no bot | `postmaster@msging.net` | `/contexts/{{identity}}/stateid%400` |
| Variáveis de contexto | `postmaster@msging.net` | `/contexts/{{identity}}?withContextValues=true&$take=1000` |
| Contato / extras | `postmaster@crm.msging.net` | `/contacts/{{identity}}` |
| Atendentes online | `postmaster@desk.msging.net` | `/teams/agents-online` |
| Métricas de tickets em espera | `postmaster@desk.msging.net` | `/monitoring/waiting-tickets` |
| Tickets abertos (monitoramento) | `postmaster@desk.msging.net` | `/monitoring/tickets` |
| Ticket | `postmaster@desk.msging.net` | `/ticket/{{ticket_id}}` |
| Templates WhatsApp | `postmaster@wa.gw.msging.net` | `/message-templates` |
| WhatsApp Flows | `postmaster@wa.gw.msging.net` | `/whatsapp-flows` |

Lista completa: `.agents/skills/blip-builder-json/references/blip-commands-api.md`.
