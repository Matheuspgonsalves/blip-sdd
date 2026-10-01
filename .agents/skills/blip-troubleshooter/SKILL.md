---
name: blip-troubleshooter
description: >-
  Especialista em diagnóstico, engenharia reversa, análise de causa raiz e depuração de falhas em chatbots do Blip (Take Blip / Studio / Builder). Use esta skill sempre que o usuário relatar comportamentos inesperados, travamentos de fluxo, problemas com variáveis não salvas, erros em condições de saída, falhas de scripts V1/V2, problemas de atendimento humano no Desk, rotas de tickets/filas, ou quando precisar de comandos Postman prontos para inspecionar estados em runtime com máxima segurança de dados e tokens.
---

# Blip Troubleshooter — Diagnóstico e Engenharia Reversa

Esta skill é focada na investigação de bugs, análise de integridade de fluxos e engenharia reversa de chatbots construídos na plataforma Take Blip (Builder / Studio).

---

## 🔒 1. Segurança e Sigilo Absoluto de Chaves/Tokens

> [!IMPORTANT]
> **DIRETRIZ DE PRIVACIDADE E SEGURANÇA DE DADOS:**
> - As chaves de autenticação do Bot (`Key {{BOT_KEY}}`) e do Router (`Key {{ROUTER_KEY}}`) são **dados estritamente confidenciais**.
> - **Nunca** solicite que o usuário exponha chaves reais no chat se não for estritamente necessário.
> - Ao gerar comandos para o Postman ou cURL, **sempre utilize placeholders** (ex.: `Authorization: Key {{ROUTER_KEY}}` ou `Authorization: Key {{BOT_KEY}}`).
> - Oriente o usuário a preencher suas chaves em seu próprio ambiente seguro local (Postman/Insomnia/Terminal).
> - Nenhuma chave, credencial ou dado sensível de cliente (PII) é utilizado para treinamento interno ou exposto externamente.

---

## 🧭 2. Metodologia de Diagnóstico em 4 Fases

```
[1. Triagem e Qualificação do Bug] ──► [2. Auditoria Estática do JSON] ──► [3. Investigação Guiada (Runtime)] ──► [4. Laudo de Causa Raiz & Fix]
```

### Fase 1: Triagem e Qualificação do Bug (Regra Anti-Adivinhação)

> [!CAUTION]
> **NÃO ADIVINHE COM CONTEXTO INSUFICIENTE:**
> Se o usuário relatar um bug com pouca ou nenhuma informação (sem prints, sem linha do tempo ou sem o fluxo envolvido), a skill **NÃO deve tentar adivinhar a causa**. Em vez disso, ela deve **pausar e solicitar o roteiro de evidências** para dar clareza ao diagnóstico.

#### Exemplos de Contexto:

* ❌ **Contexto Ruim / Insuficiente:**
  > *"Não pediu CNPJ pro usuário, tem que pedir"*
  > $\rightarrow$ **Ação da Skill:** Não tente adivinhar o motivo. Responda solicitando prints da conversa, linha do tempo dos passos do usuário, JSON dos blocos envolvidos e se houve erro de integração ou instabilidade.

* ✅ **Contexto Bom / Qualificado:**
  > *"O cliente reportou o seguinte problema:*  
  > *Entrou com a palavra-chave (fora do horário de atendimento) - OK*  
  > *Foi para a fila correta de atendimento - OK*  
  > *Bot não solicitou o CNPJ - ERRO, DEVERIA SOLICITAR*  
  > *Não houve integração com o CRM do cliente - ERRO, DEVERIA REALIZAR A INTEGRAÇÃO*  
  > *(prints e evidências anexadas)*  
  > *Dado as evidências mostradas em imagem e texto, analise o motivo do bot não ter pedido o CNPJ e não ter ocorrido a gravação no sistema, sem descartar instabilidade da Blip."*  
  > $\rightarrow$ **Ação da Skill:** Avança imediatamente para a auditoria de fluxo, backtracking de variáveis, checagem de condições de saída, chamadas de API e hipóteses de plataforma.

#### Roteiro de Perguntas quando o Contexto for Escasso:
1. **Linha do tempo da conversa:** O que aconteceu passo a passo antes da falha? (O que deu OK vs onde quebrou).
2. **Evidências visuais / Prints:** Print do histórico da conversa ou do painel de atendimento (Desk/Builder/Beholder).
3. **Identificador / Canal:** Qual canal (WhatsApp, Webchat) e, se possível, a identidade do contato para teste.
4. **JSON do Fluxo:** O JSON exportado do bot ou dos blocos onde a falha ocorreu.

---

### Fase 2: Auditoria Estática do JSON (Backtracking)
Se um JSON de fluxo foi fornecido, faça a engenharia reversa do ponto de falha para trás:

1. **Backtracking de Variáveis:**
   - Onde a variável problemática é lida?
   - Rastreie todos os caminhos anteriores que levam a esse bloco. Existe algum caminho onde a variável não é inicializada?
   - A variável foi sobrescrita em uma Ação de Entrada/Saída ou Script intermediário?
2. **Auditoria de Condições de Saída (`$conditionOutputs`):**
   - **Ordem de Precedência:** Há uma condição genérica (ex.: `input exists` ou `matches .*`) cadastrada *antes* de uma condição específica?
   - **Case-Insensitive Geral no Blip:** Lembre-se de que o Blip **não é case-sensitive em geral** nas avaliações do Builder (`"Case" === "case"`, `"SIM" === "sim"` para operadores como "Contém" e "Igual a"). Discrepâncias de maiúsculas/minúsculas no Builder não são a causa da falha *(atenção: códigos JS em Script V1/V2 continuam sendo case-sensitive por padrão da linguagem JS)*.
   - **Conflito de Tipos:** Comparação de booleano com string (ex.: valor esperado `"True"` vs `true`), ou número com texto.
   - **Destino Quebrado:** `$defaultOutput` ou `stateId` apontando para um ID inexistente ou nulo.
3. **Auditoria de Scripts (V1 e V2):**
   - Falta de *Guard Clauses* (não checa se o parâmetro recebido é `null` ou `undefined`).
   - Falta de `JSON.parse()` em strings JSON ou esquecimento de `JSON.stringify()` no retorno de objetos.
   - Uso de `new Date()` em vez de `time.parseDate()` (causando falha de fuso horário).
   - Uso de métodos/bibliotecas não suportadas no motor ClearScript V8 (ex.: `fetch` nativo sem `request.fetchAsync`, `console.log`, `localStorage`).
4. **Auditoria de Ações HTTP:**
   - URLs sem protocolo (`https://`), interpolações quebradas em headers/body, ou falta de tratamento quando o status retornado não é `200`.

---

### Fase 3: Investigação de Pontos Cegos de Runtime
Quando o JSON não for suficiente para explicar o erro, acione a **Investigação Guiada**:

1. **Identifique a Extensão Responsável:**
   - Problema com variáveis de usuário? $\rightarrow$ Extensão `Builder/Contexts`.
   - Problema com dados do cliente / extras? $\rightarrow$ Extensão `Contacts/CRM`.
   - Problema com transferência humana / fila? $\rightarrow$ Extensão `Desk`.
   - Problema com templates / janela de 24h? $\rightarrow$ Extensão `WhatsApp`.
2. **Execute a consulta (ou entregue o comando pronto):**
   - **Se o contrato ativo tiver `collections/ambientes/<ambiente>.postman_environment.json`:** use a skill `blip-consultar` para rodar você mesmo as consultas de leitura (`method: "get"`) e analise a resposta. Nunca imprima a chave no chat.
   - **Se não houver ambiente configurado:** entregue a requisição exata com placeholders para o usuário executar no Postman com a chave local.
   - Comandos que alteram estado (`set`, `delete`, `merge`, reset de contexto, envio de mensagem) seguem a regra de confirmação da governança: descreva o que vai mudar e espere o "sim" do usuário.

#### Exemplos de Comandos de Inspeção Rápida:

* **Inspecionar Bloco Atual do Usuário:**
  ```http
  POST https://msging.net/commands
  Content-Type: application/json
  Authorization: Key {{BOT_KEY}}

  {
    "id": "{{$guid}}",
    "to": "postmaster@msging.net",
    "method": "get",
    "uri": "/contexts/{{identity}}/stateid%400"
  }
  ```

* **Listar Todas as Variáveis Salvas no Contexto do Usuário:**
  ```http
  POST https://msging.net/commands
  Content-Type: application/json
  Authorization: Key {{BOT_KEY}}

  {
    "id": "{{$guid}}",
    "to": "postmaster@msging.net",
    "method": "get",
    "uri": "/contexts/{{identity}}?withContextValues=true&$take=1000"
  }
  ```

* **Consultar Contato e Campos `extras` no CRM:**
  ```http
  POST https://msging.net/commands
  Content-Type: application/json
  Authorization: Key {{ROUTER_OU_BOT_KEY}}

  {
    "id": "{{$guid}}",
    "to": "postmaster@crm.msging.net",
    "method": "get",
    "uri": "/contacts/{{identity}}"
  }
  ```

* **Verificar Atendentes Online no Desk:**
  ```http
  POST https://msging.net/commands
  Content-Type: application/json
  Authorization: Key {{BOT_KEY}}

  {
    "id": "{{$guid}}",
    "to": "postmaster@desk.msging.net",
    "method": "get",
    "uri": "/teams/agents-online"
  }
  ```

* **Consultar Detalhes de um Ticket no Desk:**
  ```http
  POST https://msging.net/commands
  Content-Type: application/json
  Authorization: Key {{BOT_KEY}}

  {
    "id": "{{$guid}}",
    "to": "postmaster@desk.msging.net",
    "method": "get",
    "uri": "/ticket/{{ticket_id}}"
  }
  ```

---

### Fase 4: Laudo de Causa Raiz e Fix

Após isolar o problema:
1. **Laudo Claro:** Explique detalhadamente:
   - **O que quebrou:** Qual componente/linha/bloco falhou.
   - **Por que quebrou:** A causa raiz exata (ex.: condição de corrida, tipo de dado incompatível, dependência de configuração ausente).
2. **Plano de Correção:**
   - Instruções passo a passo de correção.
   - Se exigir alteração no JSON do fluxo ou novo Script V2, acione as diretrizes da skill `blip-builder-json` para entregar a estrutura JSON perfeita e pronta para importação.
   - A correção é feita em `<CONTRATO>/dev/fluxos/` (copie de `prd/` se o bot ainda não estiver em `dev/`) e gravada com `blip-safe-save.mjs`, nunca direto em `prd/`.
3. **Registro:**
   - Laudo + correção vão para `spec/historico/AAAA-MM-DD.md` (causa raiz, blocos alterados, como testar).
   - Se a causa revelar uma regra nova que deveria valer sempre (ex.: um comportamento da plataforma), registre em `spec/DECISOES.md` e proponha ao usuário incluí-la na constituição.
   - Adicione os cenários que reproduzem o bug ao checklist de testes do bot (skill `blip-testes`), para virar teste de regressão.

---

## 🔗 Referências Complementares
- Para playbooks específicos de erros comuns (Desk, WhatsApp, Scripts, Builder), consulte [`references/troubleshooting-playbook.md`](./references/troubleshooting-playbook.md).
- Para a lista completa de comandos e endpoints LIME, consulte [`../blip-builder-json/references/blip-commands-api.md`](../blip-builder-json/references/blip-commands-api.md).
