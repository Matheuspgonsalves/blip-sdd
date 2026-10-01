# Collections de referência

Material de consulta para a IA montar as collections **de cada projeto** (que ficam em `<CONTRATO>/collections/`). Não são executadas diretamente com chaves de cliente, exceto a `blip-geral` como fallback da skill `blip-consultar`.

| Arquivo | Conteúdo |
|---|---|
| `blip-geral.postman_collection.json` | Commands da Blip por extensão: Analytics, IA, Broadcast, Bucket, Builder (contextos), Chat History, Contatos, Desk (tickets, filas, atendentes, métricas), Resources, Schedule, WhatsApp etc. Usa `{{Authorization}}` e `{{blip_url}}` (URL base do contrato; padrão `https://http.msging.net`). |
| `wa-flows-template.postman_collection.json` | Ciclo de um WhatsApp Flow via Blip: criar, listar, detalhar, enviar JSON (draft), chave pública, publicar, depreciar, excluir draft, template com flow. Variáveis: `{{Authorization}}`, `{{URL_PARA_ENVIAR_COMANDOS}}`, `{{FLOW_ID}}`. |

Ao copiar requests daqui para um projeto, a skill `blip-collection` converte para a convenção do kit (`{{blip_url}}/commands`, `{{Authorization}}`, `{{flow_id}}`).
