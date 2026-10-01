---
name: blip-builder-json
description: Guia completo para criar, editar, revisar, depurar ou explicar o JSON de um fluxo de bot construído no Blip Builder (plataforma BLiP/Take) — blocos, conteúdos, entrada do usuário, condições de saída, ações locais e globais, Script V2 em JavaScript, as quatro famílias de variáveis (contexto, contato/usuário, configuração, sistema), e boas práticas de arquitetura de fluxo (Princípio da Responsabilidade Única, convenção de nomes, organização visual, DRY). Use esta skill sempre que o usuário colar ou pedir para gerar um JSON de fluxo de bot da BLiP, mencionar "Blip Builder", "Builder da BLiP" ou "Studio", blocos/estados de conversa, "$defaultOutput", "$conditionOutputs", ações globais, "onboarding"/"fallback", ou pedir para montar um bloco, uma condição de saída, uma ação, revisar a organização/arquitetura de um fluxo, ou escrever/corrigir um script para o Builder — mesmo que o usuário não use esses termos exatos.
---

# Blip Builder — JSON do bot BLiP

Esta skill encapsula as regras e convenções da plataforma Blip Builder para que qualquer JSON de fluxo criado, editado ou revisado fique estruturalmente correto, siga os padrões vigentes do bot e nunca quebre o comportamento do fluxo em produção.

> Nota de nomenclatura: a plataforma está em transição — o recurso hoje chamado **Builder** passará a se chamar **Studio**. A estrutura do JSON, as regras e as boas práticas descritas aqui não mudam com a renomeação; trate os dois nomes como sinônimos caso o usuário use um ou outro.

## Regras invioláveis — verifique antes de entregar qualquer JSON

Estas regras têm prioridade sobre qualquer outra convenção sugerida neste documento. Releia esta lista sempre que estiver prestes a entregar um JSON modificado ou criado do zero:

1. **Nunca remova o atributo raiz `"flow"`.**
2. **Nunca remova o atributo raiz `"globalActions"`.**
3. **Nunca remova os blocos `onboarding` e `fallback`.**
4. **Nunca defina `$position` (`top`/`left`) com os mesmos valores em blocos diferentes** — isso sobrepõe blocos visualmente no editor.
5. **Variáveis de configuração precisam ser listadas na sua resposta ao usuário.** Não existe lugar no JSON do bot para cadastrar uma variável de configuração — quem for aplicar o JSON precisa criá-la manualmente na tela de configurações do Builder. Sempre que você usar `{{config.algumaCoisa}}`, diga explicitamente ao usuário: "crie a variável de configuração `algumaCoisa` com o valor X".
6. **Prefira sempre variáveis booleanas** para decisões em condições de saída, em vez de comparar strings livres.
7. **Novos scripts sempre em Script V2**, nunca em v1 (veja [Scripts v1 vs v2](#scripts-v1-vs-v2)).
8. **Scripts (novos ou ajustados) sempre usam early return / guard clauses.**
9. **Preserve os padrões já vigentes no JSON do bot recebido** — nomenclatura de blocos, estilo de variáveis, convenções de ações. Não reescreva por preferência estética; a consistência com o resto do bot importa mais do que o "jeito ideal".
10. **Blocos que redirecionam para atendimento humano sempre precisam ter uma saída de volta para o bloco onboarding/início**, para o caso do atendimento ser finalizado.

## Estrutura geral do JSON

```json
{
  "flow": {
    // lista de blocos (estados) do fluxo
  },
  "globalActions": {
    // ações executadas em conjunto com toda entrada de usuário no fluxo
  }
}
```

Um bot é uma máquina de estados: cada bloco representa um estado em que o cliente pode estar durante a conversa. `flow` contém todos os blocos; `globalActions` contém ações que rodam independentemente de qual bloco o usuário está.

## Boas práticas de arquitetura e organização do fluxo

Diferente das regras invioláveis acima, ignorar estes princípios não quebra a execução do bot — mas é o que separa um fluxo fácil de manter de um fluxo que ninguém mais quer mexer. Aplique-os sempre que estiver desenhando blocos novos, refatorando um trecho existente, ou revisando um fluxo a pedido do usuário. Seu espaço de trabalho no Builder/Studio é um reflexo da organização do bot: quanto mais estruturado, mais fácil a manutenção para você e para qualquer outra pessoa do time.

### Princípio da Responsabilidade Única (SRP)

Cada bloco deve executar **apenas uma função**. Se um bloco pede um dado ao usuário, valida esse dado, grava a variável e ainda registra um evento de tracking, ele está acumulando responsabilidades demais e deve ser dividido.

**Errado (bloco monolítico):** um único bloco envia a pergunta "Qual seu nome?", valida a resposta, registra o rastreamento do evento e grava a variável — tudo nas ações de um único bloco.

**Certo (responsabilidades separadas):** cada etapa vira um bloco específico, por exemplo:
1. `Name request` — envia a pergunta e aguarda a Entrada do usuário.
2. `Name validation` — valida a entrada (via condição de saída ou script) e direciona ao bloco correto.
3. `Save name` — grava a variável já validada.
4. `Unexpected input` — trata o caso de entrada inválida.

Dividir dessa forma torna cada bloco pequeno, mais fácil de depurar isoladamente e compreensível só pelo nome, sem precisar abri-lo para descobrir o que faz.

Duas diretrizes práticas para aplicar SRP:
- **Foco em um único contexto de negócio**: um bloco pode ter mais de uma ação, desde que todas pertençam ao mesmo contexto (ex.: as ações que compõem "montar e enviar uma requisição HTTP" podem conviver no mesmo bloco).
- **Ponto de entrada único para jornadas macro**: uma etapa decisiva do fluxo (ex.: "usuário autenticado", "início do atendimento humano") deve ter um único ponto de entrada, para manter os requisitos daquela etapa consistentes e fáceis de auditar.

### Convenção de Nomes

Nomeie blocos, variáveis, ações e eventos de tracking de forma que qualquer pessoa do time entenda o que cada elemento faz **sem precisar abri-lo**. Um bloco chamado `[POST] Promoções` já avisa, à primeira vista, que ali existe uma chamada POST para uma API — quem for dar manutenção não perde tempo investigando.

- O nome do bloco deve ser autoexplicativo e refletir o fluxo conversacional idealizado no projeto — alinhe essa nomenclatura com quem projetou a UX/UI, já que o Builder/Studio deve fazer referência direta a esse desenho.
- Prefira manter nomes de blocos, variáveis, ações e eventos de tracking **em inglês** — tende a gerar mais homogeneidade entre bots e facilita buscar por um padrão (ex.: `[POST]`, `[GET]`, `[Router]`) em fluxos grandes.
- Use um prefixo consistente para sinalizar o tipo de bloco à primeira vista, por exemplo: `[POST] `, `[GET] `, `[Router] `, `[Validation] `.

### Organização Visual do Fluxo

Um fluxo bem alinhado no editor é mais rápido de ler e de dar manutenção:
- Direcione as setas de ligação com clareza — evite conexões cruzadas ou distantes sem necessidade.
- Agrupe blocos por funcionalidade (ex.: todos os blocos de uma mesma jornada próximos entre si).
- Use blocos roteadores (`[Router]`) para centralizar decisões de encaminhamento — isso organiza visualmente o fluxo e facilita manutenções futuras, já que a lógica de "para onde o usuário vai" fica concentrada em um único lugar em vez de espalhada por vários blocos.

### Princípio DRY (Don't Repeat Yourself)

Blocos não devem repetir a mesma funcionalidade nem duplicar a mesma lógica de ação. Se uma validação (ex.: validar CPF, validar e-mail) é usada em mais de um ponto do fluxo, centralize essa lógica em um único bloco — ou em um único Script V2 reaproveitável — e direcione todos os pontos que precisam dela para lá, em vez de copiar a mesma condição de saída ou o mesmo script em vários blocos.

Centralizar reduz o custo de manutenção: uma correção feita em um único lugar corrige o comportamento em todo o fluxo, em vez de exigir lembrar de replicá-la em cada bloco duplicado.

## Blocos

Cada bloco tem três funções possíveis: enviar conteúdo, receber entrada do usuário / definir condições de saída, e executar ações de entrada/saída.

- O **título** de um bloco tem limite de **50 caracteres**.
- **Títulos duplicados só são um problema em blocos que não são do tipo `GO TO`.**

### Conteúdo

Todo conteúdo cadastrado em um bloco é enviado ao cliente assim que ele alcança aquele estado. Além dos conteúdos estáticos tradicionais (texto, digitando, imagem, áudio, menu, carrossel, quick reply), existem dois tipos especiais:

**Conteúdo HTTP** — usado quando o conteúdo a enviar depende de uma condição (ex.: montar um carrossel de produtos disponíveis em estoque). O Builder chama um endpoint definido por você, que deve retornar um JSON no formato do tipo de conteúdo escolhido, seguindo a especificação de https://docs.blip.ai/#content-types. Atualmente só é possível construir **Menus, Quick Replies e Carrossel** via Conteúdo HTTP — não assuma suporte a outros tipos.

**Entrada do usuário** — pausa a máquina de estados até que o cliente envie alguma informação; é o único ponto por onde mensagens do cliente chegam ao bot.
- Um bloco pode ter **0 ou 1** Entrada do usuário (nunca mais de uma).
- Se um bloco não tiver Entrada do usuário, o processamento avança automaticamente até encontrar o próximo bloco que tenha uma.

### Condições de saída

Definem para qual bloco o usuário é levado ao sair do bloco atual, com base em variáveis, entrada de dados, ou intenções/entidades reconhecidas pela IA do bot.

- São **processadas sequencialmente**, uma após a outra, até a primeira condição verdadeira. **Cadastre sempre da regra mais específica para a mais genérica** — uma regra genérica antes de uma específica torna a específica inalcançável.
- Todo bloco tem um `$defaultOutput` (fallback) pré-configurado. Pode ser redirecionado para outro bloco, mas **nunca removido**.
- Variáveis com prefixo `@` podem ser usadas em condições de saída.
- Um bloco com `$defaultOutput` **e** um `conditionOutput` apontando para o mesmo bloco-alvo não é necessariamente redundante — o `conditionOutput` também desenha a seta de conexão visual entre os blocos no editor.
- Tanto `$defaultOutput` quanto qualquer `conditionOutput` podem apontar dinamicamente para um bloco usando uma variável:

```json
"$defaultOutput": {
  "stateId": "{{previousBlockId}}",
  "typeOfStateId": "variable"
}
```

Detalhes de fonte de dados, operadores e valor esperado: veja [Condições de saída — referência de regras](#condições-de-saída--referência-de-regras) abaixo.

### Ações

Uma ação executa uma tarefa antes do envio dos conteúdos do bloco (**ação de entrada**) ou depois do envio e antes da transição de estado (**ação de saída**). É o principal ponto de flexibilidade do Builder — permite usar extensões da plataforma (https://docs.blip.ai/#extensions) ou chamar qualquer API pública.

- Ações são **processadas sequencialmente** até todas serem executadas.
- Uma ação inválida (ex.: requisição HTTP malformada) pode **bloquear a execução do fluxo** do usuário — tenha cuidado especial ao gerar payloads de ações de requisição HTTP.

Detalhes de tipos de ação, escopo local/global e Script V2: veja [Ações — referência completa](#ações--referência-completa) abaixo.

### Bloco de atendimento

Representa o ponto onde o usuário deixa de ser atendido pelo bot e passa a ser atendido por um humano. **Apenas a seção de Condições de saída é editável** nesse bloco — é ali que se configura para onde o cliente vai quando o atendimento humano é finalizado (lembre-se da regra inviolável nº 10: sempre uma saída de volta ao onboarding/início).

## Variáveis

Uma variável do Builder é formada exclusivamente por caracteres alfanuméricos (sem caracteres especiais). Na plataforma Blip, as comparações e avaliações no fluxo **não são case sensitive** (`"Case" === "case"` / `"SIM" === "sim"`). Existem quatro famílias:

| Família | Sintaxe | Onde pode ser **definida** |
|---|---|---|
| Contexto | `{{nomeVariavel}}` | Entrada do usuário, Conteúdo HTTP, ação de Requisição HTTP, ação de Script, ação Definir variável |
| Contato/usuário | `{{contact.nomeVariavel}}` | Não é definida pelo fluxo — vem da conta (Contact) do canal do usuário |
| Configuração | `{{config.nomeVariavel}}` | Tela de variáveis globais de configuração (nunca no JSON — ver regra inviolável nº 5) |
| Sistema | `{{namespace.campo}}` (ex.: `state.name`, `calendar.date`) | Somente leitura — geradas automaticamente pela plataforma |

Qualquer variável, de qualquer família, pode ser **lida** em qualquer ponto do fluxo com `{{...}}` — a restrição é apenas sobre onde ela pode ser **escrita**.

Exemplo de saudação: `"Olá {{contact.name}}, boas vindas!"`.

Campos disponíveis de `contact.*`: `name`, `address`, `city`, `email`, `source`, `phoneNumber`, `photoUri`, `cellPhoneNumber`, `gender`, `timezone`, `culture`, `extras` (JSON livre chave/valor), `identity`, `group`. Disponibilidade real depende do canal do usuário.

Para a lista completa de variáveis de sistema (`agent.*`, `aiAgent.*`, `application.*`, `bucket.*`, `calendar.*`, `input.*`, `random.*`, `resource.*`, `secret.*`, `state.*`, `tunnel.*`), **consulte `references/system-variables.md`** — não invente nomes de variáveis de sistema; confirme ali antes de usar uma que não tenha certeza.

## Condições de saída — referência de regras

Uma condição é composta de uma ou mais regras + o bloco de destino. Cada regra combina até quatro estruturas: **fonte de dados**, **operador**, nome de uma variável (quando a fonte é "Variável") e um **valor esperado**.

**Fontes de dados possíveis:** entrada do usuário, valor de uma variável, intenção reconhecida, entidade reconhecida (a partir da última entrada do usuário).

**Operadores disponíveis:**

| Operador | Verifica se... |
|---|---|
| Existe | a fonte de dados tem algum valor, qualquer que seja |
| Igual a | a fonte de dados é igual ao valor esperado (**case-insensitive** no Blip: `"SIM" === "sim"`) |
| Diferente de | a fonte de dados é diferente do valor esperado |
| Contém | a fonte de dados contém o valor esperado (**case-insensitive** no Blip: `"Case" === "case"`) |
| Começa com | a fonte de dados começa com o valor esperado |
| Termina com | a fonte de dados termina com o valor esperado |
| Maior que / Menor que | comparação numérica |
| Maior ou igual a / Menor ou igual a | comparação numérica inclusive |
| Parecido com | similaridade via distância de Levenshtein |
| Corresponde a regex | a fonte de dados casa com o padrão regex no valor esperado |

**Valor esperado:** texto, número, ou um padrão regex, dependendo do operador.

> [!NOTE]
> **Case-Insensitive Geral no Blip:**
> A plataforma Take Blip **não é case-sensitive em geral** nas suas avaliações de fluxo e condições de saída (ex.: `"SIM" === "sim"` e `"Case" === "case"` tanto para "Igual a" quanto para "Contém"). *(Nota: apenas dentro de código JavaScript em Scripts V1/V2 o motor JS puro ClearScript segue a sensibilidade padrão da linguagem JS a menos que normalizado).*

**Exemplo:** um bloco de pergunta sim/não usa duas condições de saída — Condição 1: fonte = Entrada do usuário, operador = Igual a, valor = "sim", destino = bloco Sim; Condição 2: mesma fonte/operador, valor = "não", destino = bloco Não. Lembre-se: cadastre a mais específica primeiro.

## Ações — referência completa

**Tipos de ação disponíveis:** Redirecionar para serviço, Executar script, Executar script 2.0, Processar comando, Requisitar HTTP, Definir variável, Gerenciar lista de distribuição, Registrar eventos, Definir contato.

Para a referência completa de comandos LIME, endpoints de extensões (`Desk`, `Analytics`, `AI`, `Broadcast`, `Bucket`, `Contexts`, `WhatsApp`, `Pagamentos/Stripe`, etc.), **consulte `references/blip-commands-api.md`**.

**Escopo local vs. global:** uma ação local roda apenas no bloco onde foi cadastrada. Uma ação global roda em conjunto com toda entrada de usuário do fluxo, independente do bloco:
- Ações globais de **entrada** rodam assim que a máquina de estados retoma a execução, logo após receber uma entrada do usuário.
- Ações globais de **saída** rodam imediatamente antes da máquina de estados parar para aguardar a próxima entrada do usuário.
- Use ações globais para tarefas repetidas a cada iteração — ex.: registro de evento em todo bloco que recebe entrada, usando `{{state.name}}` para identificar de qual bloco veio o evento.

**Ações condicionais:** ao criar uma ação (local ou global), é possível definir se é de entrada ou saída e quais condições precisam ser satisfeitas para que ela execute.

### Scripts v1 vs v2

- Scripts v1 (sem versão definida no JSON) são o padrão da maioria dos bots existentes — **não é um problema mantê-los** se não há necessidade de alterá-los.
- **Todo script novo deve ser Script V2** ("Executar Script 2.0"). Script V2 roda no motor ClearScript V8, com ECMAScript mais recente e mais compatibilidade.

### Escrevendo Script V2

Ao gerar ou editar um Script V2, siga a checklist completa em **`references/script-v2-library.md`** (regras de sintaxe, Object Calisthenics, interpolação de variáveis, limitações de fuso horário). Resumo essencial:

- JavaScript puro, interpretado pelo ClearScript dentro do BLiP.
- Uma **única** função `run` como ponto de entrada; seus parâmetros chegam sempre como `string` (parseie com `JSON.parse()` quando não forem primitivos) e o retorno não-primitivo deve ser serializado com `JSON.stringify()`.
- **Proibido**: bibliotecas externas/npm, `console.log()`.
- **Obrigatório**: early return / guard clauses, Object Calisthenics.
- Interpole variáveis do Builder sempre com template string: `` const email = `{{email}}`; ``.
- Use `time.parseDate(...)` em vez de `new Date(...)` — o motor não herda o fuso horário do bot automaticamente (veja explicação completa na referência).

**API disponível dentro do script** (objetos globais já injetados pelo BLiP — não os declare nem importe):

```javascript
// HTTP
const response = await request.fetchAsync(url, { method, headers, body });
const json = await response.jsonAsync(); // response também tem .status, .headers, .body, .success

// Variáveis de contexto
await context.setVariableAsync(name, value, expirationMs); // expirationMs opcional
const value = await context.getVariableAsync(name);
await context.deleteVariableAsync(name);

// Data/hora
const date = time.parseDate(dateString, { format, culture, timeZone }); // options opcional
const str = time.dateToString(date, { timeZone, format });
await time.sleep(milliseconds);

// Conversão de tempo, usada sobretudo com context.setVariableAsync
TimeSpan.fromMinutes(n);
TimeSpan.fromMilliseconds(n);
```

Para assinaturas completas, comportamento de erro (`InvalidMethodError`, `NegativeExpirationError`, `InvalidDateError`) e exemplos adicionais, **abra `references/script-v2-library.md`** antes de escrever lógica que dependa de casos de borda.

## Comentários em código

Ao escrever ou ajustar scripts, siga este padrão de comentários:

- Comentários **curtos**, em linha única com `//` — **nunca** blocos JSDoc (`/** */`).
- Comente **por quê**, não **o quê**: regras de negócio não óbvias, decisões algorítmicas, TODOs.
- **Não** comente o que já é óbvio a partir de nomes de variáveis/funções bem escolhidos.
- Comentários de múltiplas linhas usam múltiplas linhas `//`, nunca um bloco `/** */`.

```javascript
// Aplica 15% de desconto para usuários premium com pedidos > US$ 100
const desconto = isPremiumUser && orderTotal > 100 ? 0.15 : 0;

// TODO: substituir pelo serviço de autenticação adequado
const isAuthenticated = localStorage.getItem('token') !== null;

// ❌ Evite comentários óbvios como "obtém todos os campos" ou "define ordem padrão"
// quando o nome da variável já diz isso.
```

## Atributos do JSON

### Atributos raiz de um bloco

**Podem ser alterados livremente:** `$contentActions`, `$conditionOutputs`, `$enteringCustomActions`, `$leavingCustomActions`, `$defaultOutput`, `$tags`.

**Nunca alterar / ignorar:** `$inputSuggestions`, `$localCustomActions`, `isAiGenerated`, `root`, `$invalidContentActions`, `$invalidOutputs`, `$invalidCustomActions`, `$invalid`.

**`id`:** ao **criar** um bloco novo, defina um `id` normalmente. Ao **editar** um bloco existente, **nunca** altere o `id`.

### Atributos não-raiz (em qualquer profundidade do JSON)

Sempre ignore e nunca altere, onde quer que apareçam: `id`, `$id`, `editable`, `deletable`, `editing`, `$invalid`, `$connId`, `$$hashKey`.

## Fluxo de trabalho recomendado

1. **Leia o JSON recebido por inteiro antes de editar.** Identifique convenções já em uso (nomes de variáveis, estilo de blocos, se o bot usa Script v1 ou v2) e siga-as (regra inviolável nº 9).
2. **Confirme a família de cada variável** que for usar — contexto, contato, configuração ou sistema — e, se for de sistema, confira o nome exato em `references/system-variables.md`.
3. **Ao criar ou dividir blocos, aplique SRP e DRY** (veja [Boas práticas de arquitetura e organização do fluxo](#boas-práticas-de-arquitetura-e-organização-do-fluxo)): um bloco, uma responsabilidade; lógica repetida (ex.: validações) centralizada em um único ponto, não duplicada.
4. **Ao alterar condições de saída**, verifique a ordem (mais específica → mais genérica) e nunca remova o `$defaultOutput`.
5. **Ao escrever ações de Requisição HTTP ou Script**, valide mentalmente o payload — uma ação inválida trava o fluxo do usuário em produção.
6. **Ao gerar Script V2**, use `references/script-v2-library.md` para confirmar assinaturas antes de inventar um método que a API não tem.
7. **Se a tarefa for investigação de bugs complexos, diagnóstico de falhas ou engenharia reversa**, consulte e aplique a skill complementar `blip-troubleshooter`.
8. **Antes de entregar**, rode a checklist de [Regras invioláveis](#regras-invioláveis--verifique-antes-de-entregar-qualquer-json), confira se a nomenclatura de blocos/variáveis novas segue a [Convenção de Nomes](#convenção-de-nomes) e liste para o usuário qualquer variável de configuração nova que precise ser criada manualmente.
