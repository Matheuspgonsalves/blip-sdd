# Variáveis de sistema — referência completa

Lista completa de variáveis nativas disponíveis para interpolação em qualquer ponto de um fluxo do Blip Builder, usando o padrão `{{namespace.campo}}`. Consulte este arquivo sempre que precisar confirmar o nome exato de uma variável de sistema, de contato ou de configuração antes de usá-la em um bloco, condição de saída ou script.

Os valores e a disponibilidade dos dados de `contact.*` dependem do canal (aplicativo de mensagens) do usuário — nem todo canal preenche todos os campos.

## Índice

- [agent.*](#agent) — dados do atendente (apenas em respostas prontas no Desk)
- [aiAgent.*](#aiagent) — dados de execução de agentes de IA
- [aiAnswers.*](#aianswers) — resposta da API de IA
- [application.*](#application) — dados da aplicação do bot
- [bucket.*](#bucket) — documentos armazenados no bucket do bot
- [calendar.*](#calendar) — data/hora corrente, de ontem e de amanhã (GMT-0)
- [config.*](#config) — variáveis globais de configuração
- [contact.*](#contact) — dados do contato/usuário
- [context.*](#context) — variáveis de contexto definidas no fluxo
- [input.*](#input) — dados da última entrada do usuário (mensagem, intenção, entidades)
- [random.*](#random) — geradores de valores aleatórios
- [resource.*](#resource) — recursos do bot
- [secret.*](#secret) — variáveis sensíveis (apenas em ações HTTP)
- [state.*](#state) — bloco atual e anterior no fluxo
- [tunnel.*](#tunnel) — dados de mensagens de túnel (roteador)

---

## agent.*

Visível apenas em respostas prontas no Desk.

- `agent.email`: o e-mail do atendente.
- `agent.firstName`: o primeiro nome do atendente.
- `agent.fullName`: o nome completo do atendente.
- `agent.identity`: a identidade do agente no formato `name@domain`.
- `agent.phoneNumber`: o número de telefone do agente.

## aiAgent.*

- `aiAgent.agentResponse`: lista de respostas geradas pela IA.
- `aiAgent.errorCode`: código do erro que causou o redirecionamento.
- `aiAgent.message`: o envelope de mensagem enviado pela IA.
- `aiAgent.name`: nome da action cadastrada.
- `aiAgent.parameters`: parâmetros enviados pela IA cadastrados na Action.
- `aiAgent.redirect`: indica o tipo de redirecionamento.
- `aiAgent.skill_id`: identificador da habilidade (skill) associada à mensagem executada.
- `aiAgent.skillName`: nome da habilidade associada à mensagem.
- `aiAgent.task_id`: identificador da tarefa associada à mensagem executada.
- `aiAgent.taskName`: nome da tarefa associada à mensagem.
- `aiAgent.toolCall_id`: identificador da tool call solicitada para ser executada pela IA.
- `aiAgent.userMessage`: mensagem original do usuário.
- `aiAgent.userMessage_id`: identificador único da mensagem do usuário.

## aiAnswers.*

- `aiAnswers.response`: resposta à chamada da API de IA.
- `aiAnswers.statusCode`: código de status HTTP do retorno da chamada à API.

## application.*

- `application.domain`: o domínio no qual a aplicação do bot está executando (normalmente `msging.net`).
- `application.identifier`: o identificador único da aplicação do bot.
- `application.identity`: a identidade da aplicação do bot (igual a `identifier@domain`).
- `application.instance`: a instância do nodo da aplicação do bot.
- `application.node`: o nodo da aplicação do bot (igual a `identifier@domain/instance`).

## bucket.*

- `bucket.?`: documento armazenado no bucket do bot, onde `?` deve ser substituído pelo ID do documento salvo no bucket.

## calendar.*

Todos os valores em GMT-0.

- `calendar.date`: data atual (formato `yyyy-MM-dd`).
- `calendar.datetime`: data e hora atual (formato `yyyy-MM-ddTHH:mm:ssZ`).
- `calendar.day` / `calendar.month` / `calendar.year`: dia/mês/ano correntes.
- `calendar.dayOfWeek`: dia da semana corrente (em inglês).
- `calendar.hour` / `calendar.minute` / `calendar.second`: hora/minuto/segundo correntes.
- `calendar.time`: hora atual (formato `HH:mm`).
- `calendar.unixTime` / `calendar.unixTimeMilliseconds`: data atual em unix timestamp.
- `calendar.tomorrow.*`: mesmos campos acima (`date`, `datetime`, `day`, `dayOfWeek`, `hour`, `minute`, `month`, `second`, `time`, `unixTime`, `unixTimeMilliseconds`, `year`) para a data de amanhã.
- `calendar.yesterday.*`: mesmos campos acima para a data de ontem.

## config.*

- `config.?`: variável global definida na tela de configuração do fluxo, onde `?` deve ser substituído pelo nome da variável de configuração criada. Veja a regra inviolável sobre listar variáveis de configuração na resposta — elas não existem em nenhum lugar do JSON do bot, então precisam ser criadas manualmente pelo usuário na plataforma.

## contact.*

- `contact.address`: o endereço do contato.
- `contact.cellPhoneNumber`: o telefone celular do contato.
- `contact.city`: a cidade do contato.
- `contact.culture`: a informação da cultura do usuário (formato IETF).
- `contact.email`: o e-mail do contato.
- `contact.extras.?`: um JSON genérico para armazenar pares de strings (chave e valor).
- `contact.gender`: o sexo do contato.
- `contact.group`: o nome do grupo ao qual o usuário pertence.
- `contact.identity`: a identidade do contato no formato `name@domain`.
- `contact.name`: o nome do contato.
- `contact.phoneNumber`: o telefone do contato.
- `contact.photoUri`: a URI da foto pública do contato.
- `contact.serialized`: o contato completo no formato JSON.
- `contact.source`: o nome do canal do contato.
- `contact.taxDocument`: o documento do contato.
- `contact.timezone`: o timezone do contato relativo ao GMT.

## context.*

- `context.?`: variável de contexto do bot, onde `?` deve ser substituído pelo nome da variável de contexto criada.

## input.*

- `input.content`: conteúdo da mensagem enviada pelo usuário.
- `input.contentAssistant.id` / `.name` / `.result`: identificador, nome e resposta atrelados à combinação de conteúdo reconhecida.
- `input.entity.?.id` / `.name` / `.value`: identificador, nome e valor da entidade reconhecida (`?` = nome da entidade).
- `input.intent.id` / `.name` / `.score` / `.answer`: identificador, nome, confiabilidade e uma das respostas atreladas à intenção reconhecida.
- `input.length`: quantidade de conteúdos existentes na mensagem enviada pelo usuário (apenas para Collections).
- `input.message`: o envelope de mensagem recebido pelo bot.
- `input.message.from` / `.fromidentity`: nodo/identidade do originador da mensagem.
- `input.message.pp` / `.ppidentity`: nodo/identidade do originador em caso de mensagens delegadas.
- `input.message.to` / `.toidentity`: nodo/identidade do destinatário (normalmente a aplicação do bot).
- `input.message.id`: o id da mensagem recebida.
- `input.type`: tipo da mensagem enviada pelo usuário.

## random.*

- `random.guid`: identificador alfanumérico único.
- `random.integer`: número inteiro aleatório.
- `random.string`: conjunto de caracteres (string) aleatório.

## resource.*

- `resource.?`: recurso do bot, onde `?` é a chave do recurso.

## secret.*

- `secret.?`: variável sensível. Atualmente disponível apenas em ações de Requisição HTTP.

## state.*

- `state.id` / `state.name`: id/nome do bloco corrente no fluxo.
- `state.previous.id` / `state.previous.name`: id/nome do bloco anterior no fluxo.
- Útil em ações globais — por exemplo, registro de eventos usando `{{state.name}}` para identificar de qual bloco veio cada entrada de usuário.

## tunnel.*

Disponível apenas para mensagens de túnel (encaminhadas por um roteador).

- `tunnel.destination`: o destinatário do túnel — normalmente a identidade da aplicação do bot.
- `tunnel.identity`: a identidade do túnel.
- `tunnel.originator`: o nodo do originador do túnel (identificador original do cliente, em um roteador).
- `tunnel.owner`: a identidade do proprietário do túnel (identidade da aplicação do roteador, em um roteador).
