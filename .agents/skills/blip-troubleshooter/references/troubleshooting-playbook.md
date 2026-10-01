# Blip Troubleshooting Playbook — Catálogo de Falhas Comuns

Guia de diagnóstico rápido para os problemas mais recorrentes em fluxos do Blip Builder / Studio.

---

## 1. Usuário Travado no Fluxo (Loop ou Parada Abrupta)

### Sintoma:
O usuário envia mensagem e o bot não responde ou fica repetindo o mesmo bloco infinitamente.

### Checklist de Investigação:
1. **Verifique se o bloco possui Entrada do Usuário ativa:**
   - Se o bloco não tiver Entrada do Usuário e não tiver condições de saída configuradas para um próximo bloco com entrada, o bot pode cair em um `$defaultOutput` cíclico.
2. **Auditoria de `$conditionOutputs`:**
   - Verifique se a condição de saída exige uma variável que está vazia.
   - Verifique se a primeira condição da lista é genérica demais (ex.: `source: input, comparison: exists`) capturando tudo antes das regras específicas.
3. **Ação Travando (Requisição HTTP ou Script com erro não tratado):**
   - Uma requisição HTTP com timeout longo ou script com exceção não tratada impede a máquina de estados de avançar.
   - **Comando de Diagnóstico:** Obtenha o estado atual do usuário:
     ```http
     POST https://msging.net/commands
     Authorization: Key {{BOT_KEY}}
     
     {
       "id": "{{$guid}}",
       "to": "postmaster@msging.net",
       "method": "get",
       "uri": "/contexts/{{identity}}/stateid%400"
     }
     ```

---

## 2. Variável Vazia, Inexistente ou `null`

### Sintoma:
O bot envia uma mensagem com `{{minhaVariavel}}` em texto literal ou scripts falham por `TypeError: Cannot read properties of undefined`.

### Checklist de Investigação:
1. **Tipo de Variável:**
   - Se for `{{config.minhaChave}}`: Foi cadastrada na tela de **Configurações do Builder**? (Variáveis de configuração não são salvas no JSON).
   - Se for `{{contact.extras.campo}}`: O contato possui esse campo cadastrado no CRM?
2. **Ordem de Execução das Ações:**
   - Ações de **Entrada** rodam *antes* do envio do conteúdo do bloco.
   - Ações de **Saída** rodam *depois* do envio do conteúdo e da entrada do usuário.
   - Se você precisa exibir `{{valor}}` no conteúdo do bloco, a ação que define `valor` precisa ser uma **Ação de Entrada** ou vir de um bloco anterior.
3. **Comando de Diagnóstico:** Inspecione todas as variáveis gravadas no contexto do usuário:
   ```http
   POST https://msging.net/commands
   Authorization: Key {{BOT_KEY}}
   
   {
     "id": "{{$guid}}",
     "to": "postmaster@msging.net",
     "method": "get",
     "uri": "/contexts/{{identity}}?withContextValues=true&$take=1000"
   }
   ```

---

## 3. Falhas no Atendimento Humano (Desk)

### Sintoma:
O usuário pede atendente, mas o ticket não é criado, a mensagem não chega no Desk ou o usuário fica preso após o atendente finalizar.

### Checklist de Investigação:
1. **Regra de Retorno Pós-Atendimento:**
   - O bloco de atendimento humano **precisa obrigatoriamente** de uma condição de saída ou `$defaultOutput` apontando de volta para o bloco de início/onboarding (ou bloco de pós-atendimento).
2. **Atendentes Online / Filas:**
   - Se a fila configurada estiver sem atendentes logados ou com status offline, o ticket pode ficar represado ou o bot falhar na transferência.
   - **Comando de Diagnóstico:**
     ```http
     POST https://msging.net/commands
     Authorization: Key {{BOT_KEY}}
     
     {
       "id": "{{$guid}}",
       "to": "postmaster@desk.msging.net",
       "method": "get",
       "uri": "/teams/agents-online"
     }
     ```
3. **Ticket Preso em Aberto:**
   - Se o cliente já possuir um ticket aberto anteriormente que não foi encerrado, uma nova tentativa de abertura pode gerar conflito.
   - **Comando de Diagnóstico (Consultar Tickets do Cliente):**
     ```http
     POST https://msging.net/commands
     Authorization: Key {{BOT_KEY}}
     
     {
       "id": "{{$guid}}",
       "to": "postmaster@desk.msging.net",
       "method": "get",
       "uri": "/tickets/{{identity}}"
     }
     ```

---

## 4. Falhas em Scripts JavaScript (V1 / V2)

### Sintoma:
O script não retorna o valor esperado, o fluxo vai para o fallback ou a variável de saída não é criada.

### Checklist de Investigação:
1. **Tipos de Entrada:**
   - Todas as variáveis passadas como parâmetro para a função `run(...)` chegam como **string**.
   - Se a entrada for um JSON (ex.: retorno de API), execute `JSON.parse(param)` dentro de um bloco `try/catch`.
2. **Tipo de Retorno:**
   - Se a função retornar um objeto ou array, execute `JSON.stringify(resultado)`.
3. **Guard Clauses:**
   - Sempre valide se os parâmetros existem antes de acessar propriedades:
     ```javascript
     function run(inputJson) {
       if (!inputJson) return null;
       try {
         const data = JSON.parse(inputJson);
         return data?.item?.id || null;
       } catch (err) {
         return null;
       }
     }
     ```

---

## 5. Falhas no Canal WhatsApp (WABA)

### Sintoma:
O bot tenta enviar mensagem ativa ou template e o usuário não recebe nada.

### Checklist de Investigação:
1. **Janela de 24 Horas:**
   - Mensagens de sessão livres só funcionam dentro de 24h a partir da última mensagem do usuário. Fora disso, **apenas Message Templates (WABA)** aprovados pela Meta podem ser enviados.
2. **Identificador Correto:**
   - O telefone deve ser consultado via endpoint de identidade:
     ```http
     POST https://msging.net/commands
     Authorization: Key {{BOT_KEY}}
     
     {
       "id": "{{$guid}}",
       "to": "postmaster@wa.gw.msging.net",
       "method": "get",
       "uri": "lime://wa.gw.msging.net/accounts/+5531999999999"
     }
     ```
3. **Template Aprovado:**
   - O nome e o idioma do template no payload devem ser idênticos aos cadastrados na Meta (ex.: `code: "pt_BR"`).
