# Blip Commands & Extensions API Reference

Guia de referência para comandos LIME e chamadas às Extensões da plataforma Take Blip via `https://msging.net/commands`, `https://msging.net/messages` e `https://msging.net/notifications` (ou através de Ações do Builder "Processar Comando" / "Requisitar HTTP" e Script V2).

---

## 1. Estrutura Padrão de Comandos (`/commands`)

**Endpoint Base:** `POST https://msging.net/commands`  
**Headers obrigatórios:**
- `Content-Type: application/json`
- `Authorization: Key {{API_KEY}}` (ou `{{config.authorizationKey}}` no Builder)

```json
{
  "id": "{{$guid}}",
  "to": "postmaster@<extension>.msging.net",
  "method": "get" | "set" | "delete" | "merge",
  "uri": "/recurso",
  "type": "application/vnd.lime.<document-type>+json",
  "resource": { ... }
}
```

---

## 2. Extensões Principais da Take Blip

### 2.1 Builder & Contexto do Usuário (`postmaster@msging.net` ou `postmaster@builder.msging.net`)

Gerenciamento de máquina de estados, fluxo e variáveis de contexto de usuários:

| Operação | Método | URI | Descrição / Payload |
|---|---|---|---|
| **Consultar Estado do Usuário** | `get` | `/contexts/{{identity}}/stateid%400` | Retorna o ID do bloco atual onde o usuário está no fluxo. |
| **Mudar Estado do Usuário (Go To)** | `set` | `/contexts/{{identity}}/stateid%400` | `type: "text/plain"`, `resource: "{{state_id}}"` |
| **Resetar Estado do Usuário** | `delete` | `/contexts/{{identity}}/stateid%400` | Reseta o usuário de volta ao início (onboarding). |
| **Definir Variável de Contexto** | `set` | `/contexts/{{identity}}/{{variable_name}}` | `type: "text/plain"` (ou json), `resource: "{{valor}}"` |
| **Consultar Variável de Contexto** | `get` | `/contexts/{{identity}}/{{variable_name}}` | Retorna o valor gravado. |
| **Listar Todas Variáveis do Usuário** | `get` | `/contexts/{{identity}}?withContextValues=true&$take=1000` | Retorna todas as variáveis salvas para o contato. |
| **Deletar Variável de Contexto** | `delete` | `/contexts/{{identity}}/{{variable_name}}` | Remove a variável do contexto. |
| **Publicar Fluxo do Bot** | `set` | `/buckets/blip_portal:builder_working_flow` | `type: "application/json"`, `resource: { ...flowJson }` |
| **Consultar Ações Globais** | `get` | `/buckets/blip_portal:builder_working_global_actions` | Retorna as ações globais cadastradas. |

---

### 2.2 Desk / Atendimento Humano (`postmaster@desk.msging.net`)

Gestão de tickets, atendentes, filas, regras e monitoramento de atendimento:

| Operação | Método | URI | Payload / Observações |
|---|---|---|---|
| **Criar Ticket de Atendimento** | `set` | `/tickets` | `type: "application/vnd.iris.ticket+json"`, `resource: { "customerIdentity": "{{customer_identity}}" }` |
| **Criar Ticket com Contexto** | `set` | `/tickets/{{customer_identity}}` | `type: "text/plain"`, `resource: "Mensagem inicial / contexto"` |
| **Consultar Ticket Específico** | `get` | `/ticket/{{ticket_id}}` | Retorna detalhes do ticket (status, atendente, fila, tags). |
| **Consultar Mensagens do Ticket** | `get` | `/tickets/{{ticket_id}}/messages` | Retorna histórico de mensagens trocadas no ticket. |
| **Fechar Ticket como Atendente** | `set` | `/tickets/change-status` | `resource: { "id": "{{ticket_id}}", "status": "ClosedAttendant", "tags": ["TAG1"] }` |
| **Fechar Ticket como Cliente** | `set` | `/tickets/change-status` | `resource: { "id": "{{ticket_id}}", "status": "ClosedClient" }` |
| **Finalizar Ticket Permanentemente**| `set` | `/tickets/{{ticket_id}}/close` | Fecha em definitivo evitando novas atualizações. |
| **Adicionar Tags ao Ticket** | `set` | `/tickets/{{ticket_id}}/change-tags` | `resource: { "id": "{{ticket_id}}", "tags": ["tag1", "tag2"] }` |
| **Transferir Ticket de Fila/Equipe**| `set` | `/tickets/{{ticket_id}}/transfer` | `resource: { "team": "{{team_name}}" }` |
| **Listar Atendentes / Equipes** | `get` | `/attendants` ou `/teams` | Retorna lista de operadores cadastrados e equipes. |
| **Consultar Atendentes Online** | `get` | `/teams/agents-online` | Útil para verificar disponibilidade humana antes de transferir. |
| **Regras de Atendimento** | `get`/`set`/`delete` | `/rules` / `/rules/{{rule_id}}` | `resource: { "title": "Regra SP", "property": "Contact.Extras.City", "relation": "Equals", "team": "SP", "values": ["São Paulo"] }` |
| **Filas de Atendimento** | `set`/`delete` | `/attendance-queues` | Cria ou remove filas de prioridade. |
| **Métricas de Monitoramento** | `get` | `/monitoring/open-tickets`, `/monitoring/waiting-tickets`, `/monitoring/attendants`, `/monitoring/ticket-metrics` | Dados em tempo real para dashboards e monitoramento. |

---

### 2.3 Contatos / CRM (`postmaster@crm.msging.net`)

Gestão da base de contatos (roster) e extras:

| Operação | Método | URI | Payload / Observações |
|---|---|---|---|
| **Salvar / Atualizar Contato** | `set` | `/contacts` | `type: "application/vnd.lime.contact+json"`, `resource: { "identity": "{{identity}}", "name": "Nome", "gender": "male", "email": "...", "phoneNumber": "...", "extras": { "cpf": "123", "plano": "VIP" } }` |
| **Consultar Contato** | `get` | `/contacts/{{contact_identity}}` | Retorna nome, e-mail, telefone e o dicionário `extras`. |
| **Listar Contatos com Paginação**| `get` | `/contacts?$skip=0&$take=20&$filter=(substringof('João',name))` | Suporte a filtros OData. |
| **Adicionar Comentário ao Contato**| `set` | `/contacts/{{contact_identity}}/comments` | `type: "application/vnd.iris.crm.comment+json"`, `resource: { "content": "..." }` |
| **Consultar Comentários** | `get` | `/contacts/{{contact_identity}}/comments` | Lista anotações sobre o contato. |

---

### 2.4 Analytics & Rastreamento (`postmaster@analytics.msging.net`)

| Operação | Método | URI | Payload / Observações |
|---|---|---|---|
| **Registrar Evento (Track)** | `set` | `/event-track` | `type: "application/vnd.iris.eventTrack+json"`, `resource: { "category": "vendas", "action": "checkout_sucesso", "contact": { "identity": "{{identity}}" } }` |
| **Consultar Categorias de Eventos**| `get` | `/event-track?$take=100` | Retorna categorias registradas. |
| **Consultar Contadores de Eventos**| `get` | `/event-track/{{category_name}}?startDate=2026-01-01&endDate=2026-01-31` | Retorna métricas agrupadas por dia. |
| **Relatórios e Gráficos** | `set`/`get`/`delete` | `/reports` e `/reports/{{report_id}}/charts` | Gestão de dashboards do portal. |
| **Métricas de Mensagens e Usuários**| `get` | `/metrics/active-messages/{{interval}}`, `/metrics/active-identity/{{interval}}`, `/metrics/engaged-identity/{{interval}}` | Métricas de engajamento do bot. |

---

### 2.5 Bucket (`postmaster@msging.net`)

Armazenamento isolado de documentos arbitrários e persistência customizada:

| Operação | Método | URI | Payload / Observações |
|---|---|---|---|
| **Armazenar Documento JSON** | `set` | `/buckets/{{document_key}}?expiration=30000` | `type: "application/json"`, `resource: { "chave": "valor" }`. Expiração em ms é opcional. |
| **Consultar Documento** | `get` | `/buckets/{{document_key}}` | Retorna o JSON salvo. |
| **Deletar Documento** | `delete` | `/buckets/{{document_key}}` | Remove o documento. |
| **Listar Todos Documentos** | `get` | `/buckets` | Lista chaves salvas. |

---

### 2.6 Inteligência Artificial (`postmaster@ai.msging.net`)

Treinamento, intenções, entidades e análise de sentenças:

| Operação | Método | URI | Payload / Observações |
|---|---|---|---|
| **Analisar Sentença (Último Modelo)** | `set` | `/analysis` | `type: "application/vnd.iris.ai.analysis-request+json"`, `resource: { "text": "Quero pedir pizza" }` |
| **Criar Intenção** | `set` | `/intentions` | `type: "application/vnd.iris.ai.intention+json"`, `resource: { "name": "pedir_pizza" }` |
| **Associar Perguntas a Intenção** | `set` | `/intentions/{{intent_id}}/questions` | `resource: { "itemType": "application/vnd.iris.ai.question+json", "items": [{ "text": "quero pizza" }] }` |
| **Associar Respostas a Intenção** | `set` | `/intentions/{{intent_id}}/answers` | `resource: { "itemType": "application/vnd.iris.ai.answer+json", "items": [{ "type": "text/plain", "value": "Qual sabor?" }] }` |
| **Criar Entidade e Sinônimos** | `set` | `/entities` | `resource: { "name": "Sabor", "values": [{ "name": "Calabresa", "synonymous": ["calabreza"] }] }` |
| **Treinar Modelo** | `set` | `/models` | `type: "application/vnd.iris.ai.model-training+json"`, `resource: {}` |
| **Publicar Modelo** | `set` | `/models` | `type: "application/vnd.iris.ai.model-publishing+json"`, `resource: { "id": "{{model_id}}" }` |
| **Enviar Feedback de Análise** | `set` | `/analysis/{{analysis_id}}/feedback` | `resource: { "feedback": "approved" }` ou `rejected` com nova intenção. |

---

### 2.7 WhatsApp Business API (`postmaster@wa.gw.msging.net`)

| Operação | Método | URI | Payload / Observações |
|---|---|---|---|
| **Consultar Identificador do WhatsApp**| `get` | `lime://wa.gw.msging.net/accounts/+5531999999999` | Converte o número MSISDN em identidade LIME (`5531999999999@wa.gw.msging.net`). |
| **Consultar Templates (WABA)** | `get` | `/message-templates` | Retorna lista de message templates aprovados. |
| **Criar Template com Imagem / Botões** | `set` | `/message-templates` | Cadastra template com cabeçalho de imagem, corpo e botões Quick Reply. |
| **Upload de Anexo para Template** | `set` | `/message-templates-attachment` | `type: "application/vnd.lime.media-link+json"`, `resource: { "type": "image/jpeg", "uri": "https://..." }` |
| **Saúde do Número** | `get` | `/phone-number-details` | Consulta status e qualidade do número no WhatsApp. |
| **Grupos do WhatsApp** | `set`/`get` | `/groups` e `/groups/{{group_id}}/invite-link` | Criação de grupos e obtenção de link de convite. |

#### Envio de Notificação Ativa WhatsApp (Template Dinâmico / PIX):
**Endpoint:** `POST https://msging.net/messages`
```json
{
  "id": "{{$guid}}",
  "to": "{{contactIdentity}}@wa.gw.msging.net",
  "type": "application/json",
  "content": {
    "type": "template",
    "template": {
      "name": "nome_do_template_aprovado",
      "language": {
        "policy": "deterministic",
        "code": "pt_BR"
      },
      "components": [
        {
          "type": "button",
          "sub_type": "order_details",
          "index": 0,
          "parameters": [
            {
              "type": "action",
              "action": {
                "order_details": {
                  "reference_id": "{{order_id}}",
                  "type": "digital-goods",
                  "payment_type": "br",
                  "payment_settings": [
                    {
                      "type": "pix_dynamic_code",
                      "pix_dynamic_code": {
                        "code": "{{pix_code}}",
                        "merchant_name": "{{nome_empresa}}",
                        "key": "{{chave_pix}}",
                        "key_type": "CNPJ"
                      }
                    }
                  ],
                  "currency": "BRL",
                  "total_amount": { "value": "10000", "offset": 100 },
                  "order": {
                    "status": "pending",
                    "items": [{ "name": "Item 1", "amount": { "value": "10000", "offset": 100 }, "quantity": 1 }],
                    "subtotal": { "value": "10000", "offset": 100 }
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
}
```

---

### 2.8 Broadcast & Listas de Distribuição (`postmaster@broadcast.msging.net`)

| Operação | Método | URI | Payload / Observações |
|---|---|---|---|
| **Criar Lista de Distribuição** | `set` | `/lists` | `resource: { "identity": "minha_lista@broadcast.msging.net" }` |
| **Adicionar Membro à Lista** | `set` | `/lists/{{lista}}@broadcast.msging.net/recipients` | `type: "application/vnd.lime.identity"`, `resource: "{{user_identity}}"` |
| **Remover Membro da Lista** | `delete` | `/lists/{{lista}}@broadcast.msging.net/recipients/{{user_identity}}` | Remove da lista. |
| **Listar Membros** | `get` | `/lists/{{lista}}@broadcast.msging.net/recipients?$skip=0&$take=20` | Retorna membros cadastrados. |
| **Enviar Mensagem para Lista** | - | `POST https://msging.net/messages` | `to: "minha_lista@broadcast.msging.net"`, `content: "Olá ${contact.name}!"` |

---

### 2.9 Agendamento / Scheduler (`postmaster@scheduler.msging.net`)

| Operação | Método | URI | Payload / Observações |
|---|---|---|---|
| **Agendar Mensagem** | `set` | `/schedules` | `type: "application/vnd.iris.schedule+json"`, `resource: { "when": "2026-12-31T23:59:00.000Z", "name": "Lembrete", "message": { "id": "{{$guid}}", "to": "{{identity}}", "type": "text/plain", "content": "Seu lembrete!" } }` |
| **Consultar Mensagem Agendada** | `get` | `/schedules/{{schedule_id}}` | Retorna status: `scheduled`, `executed` ou `canceled`. |

---

### 2.10 Tunneling / Roteamento Multi-Bot (`postmaster@tunnel.msging.net`)

Permite que um bot roteador/principal encaminhe mensagens de forma transparente para sub-bots (FAQ, Atendimento Humano, etc.):
- **Envio:** `to: "operador@tunnel.msging.net/{{encoded_user_identity}}"`
- **Consulta no diretório via tunnel:** `get` em `lime://tunnel.msging.net/accounts/{{tunnel_id}}`

---

### 2.11 Pagamentos (Stripe: `postmaster@stripe.msging.net`)

| Operação | Método | URI | Payload / Observações |
|---|---|---|---|
| **Criar Sessão de Checkout** | `set` | `/payment/{{contactIdentity}}/session` | `resource: { "paymentMethodTypes": ["card", "boleto"], "lineItems": [{ "amount": 5000, "currency": "brl", "name": "Produto", "quantity": 1 }], "successUrl": "...", "cancelUrl": "..." }` |
| **Criar Payment Intent** | `set` | `/payment/{{contactIdentity}}/payment-intent` | `resource: { "customer": "{{stripeCustomerId}}", "amount": 1000, "currency": "BRL", "confirm": "true", "paymentMethod": "{{paymentMethodId}}" }` |
| **Confirmar Payment Intent** | `set` | `/payment/{{contactIdentity}}/confirm-payment-intent` | `resource: { "paymentIntentId": "...", "options": { "paymentMethod": "..." } }` |
| **Listar Métodos de Pagamento**| `get` | `/payment-methods?customer={{stripeCustomerId}}` | Retorna cartões cadastrados do cliente. |
| **Histórico de Sessões / Eventos**| `get` | `/payment/{{contactIdentity}}/session-history`, `/payment-intents/{{intentId}}/events` | Consulta de transações e webhooks. |

---

### 2.12 Perfil do Chatbot & Menus (`postmaster@msging.net`)

| Operação | Método | URI | Payload / Observações |
|---|---|---|---|
| **Definir Mensagem de Boas-Vindas** | `set` | `/profile/greeting` | `type: "text/plain"`, `resource: "Olá! Seja bem-vindo."` |
| **Botão Iniciar / Get Started** | `set` | `/profile/get-started` | `type: "text/plain"`, `resource: "Começar"` |
| **Menu Persistente** | `set` | `/profile/persistent-menu` | `type: "application/vnd.lime.document-select+json"`, `resource: { "options": [{ "label": { "type": "text/plain", "value": "Opção 1" } }] }` |

---

## 3. Como usar nas Ações do Blip Builder / Studio

### Opção A: Ação nativa "Processar Comando"
No Builder, ao usar a ação **Processar Comando**:
- Método: `GET`, `SET`, `DELETE` ou `MERGE`
- Destinatário (`to`): preencha com o endereço da extensão (ex.: `postmaster@desk.msging.net`)
- URI: preencha com o endpoint (ex.: `/tickets`)
- Variável de resposta: salve em `ticketResult`

### Opção B: Script V2 (JavaScript no ClearScript)
Com `request.fetchAsync`:
```javascript
async function run() {
  const payload = {
    id: `cmd_${Date.now()}`,
    to: "postmaster@crm.msging.net",
    method: "get",
    uri: `/contacts/${encodeURIComponent(`{{contact.identity}}`)}`
  };

  const response = await request.fetchAsync("https://msging.net/commands", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key {{config.blipApiKey}}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.jsonAsync();
  if (data.status === "success") {
    return JSON.stringify(data.resource);
  }
  return null;
}
```
