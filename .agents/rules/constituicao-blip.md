---
trigger: always_on
description: Princípios inegociáveis para qualquer JSON de fluxo Blip gerado ou alterado neste workspace.
---

# Constituição dos Fluxos Blip

> **Versão:** 2.0.0 (consolidada a partir dos projetos anteriores)
> **Escopo:** todo fluxo do Blip Builder / Studio criado, editado ou corrigido neste workspace, por qualquer skill.
> **Exceções por cliente:** se um contrato precisar quebrar um princípio, a exceção é registrada como ADR em `<CONTRATO>/spec/DECISOES.md`, com o motivo. Sem ADR, o princípio vale.

---

### P-001 [DEVE] — Responsabilidade Única (SRP) nos blocos
Cada bloco executa uma única função:
- `[Input]`: envia a pergunta e aguarda a entrada do usuário (sem ações complexas).
- `[Validation]`: executa o script de validação e define um booleano de resultado.
- `[Router]`: centraliza a decisão de saída com base em booleanos.
- `[HTTP]`: chama a API externa e guarda o resultado em variáveis.
- `[Redirect]`: executa o redirecionamento para outro subbot/serviço.

*Motivação:* blocos monolíticos tornam o fluxo impossível de depurar e manter.

### P-002 [DEVE] — Booleanos nas condições de saída
Toda decisão em `[Router]` ou condição de saída avalia variáveis booleanas (`isPhoneValid === true`), nunca texto livre em linguagem natural.

### P-003 [DEVE] — Fallback e limite de tentativas
Toda coleta de dado (telefone, CEP, CPF, opção de menu) tem validação de formato, mensagem de reorientação e no máximo **2 tentativas inválidas** antes do transbordo para atendimento humano ou para o subbot de Exceções.

### P-004 [DEVE] — Script V2, early return e proibição de `var`
Script novo ou alterado é sempre **Executar Script 2.0 (ClearScript V8)**:
- ponto de entrada `run`;
- só `const` e `let` (`var` é proibido);
- guard clauses / early return, sem `if/else` profundo;
- sem `console.log()` nem bibliotecas inexistentes no runtime.

### P-005 [DEVE] — Zero conexões quebradas e zero blocos órfãos
O JSON não pode ter `$conditionOutputs`/`$defaultOutput` apontando para `stateId` inexistente, blocos inalcançáveis a partir do `onboarding`, nem `$position` sobrepostas.

### P-006 [DEVE] — Rastreabilidade de critérios de aceite
Todo `AC-xxx` (Dado/Quando/Então) mapeia para pelo menos uma tarefa `T-xxx` e um cenário de teste no checklist.

### P-007 [DEVE] — Padrão `[GO TO]` para convergências
Quando vários blocos convergem para um destino comum (Atendimento Humano, Exceções, Finalização, Menu), é proibido traçar setas cruzando o canvas. Use um bloco satélite:
- **Título:** começa com `"[GO TO] "` + nome descritivo do destino (ex.: `"[GO TO] Pedido de CEP"`).
- **Tag:** `[{"background":"#CC99FF","label":"GO TO"}]`.
- **Input:** `input.bypass = true`.
- **Condições:** `$conditionOutputs = []`.
- **Saída:** `$defaultOutput.stateId = "<id_do_alvo>"`, `typeOfStateId = "state"`.

Transições lineares locais entre blocos vizinhos continuam com conexão direta.

### P-008 [DEVE] — Proibido `@` em `inputVariables`
Nunca use `objeto@campo` em `inputVariables` de `ExecuteScript`/`ExecuteScriptV2` (o Blip marca a ação como `$invalid` na importação). Passe a variável raiz e faça `JSON.parse()` dentro do script.

### P-009 [DEVE] — Registro diário
Toda mudança em `dev/` ou `spec/` é registrada em `<CONTRATO>/spec/historico/AAAA-MM-DD.md` (ver `governanca-projeto.md`). O relatório para o ClickUp é gerado a partir desse histórico pela skill `blip-relatorio-diario`.

### P-010 [DEVE] — `try/catch` em todo script
Toda a lógica de `run()` fica dentro de `try { … } catch (e) { … }`, com retorno de fallback previsível (ex.: `{ isValid: false, error: e.message }`). Exceção não tratada no ClearScript não pode derrubar a máquina de estados.

### P-011 [DEVE] — `$defaultOutput` aponta para Exceções (anti-loop)
Caminhos de negócio ficam em `$conditionOutputs`; a saída padrão de blocos convencionais aponta para a tratativa de Exceções (`fallback` / contagem de erros / transbordo). Exceções legítimas:
1. blocos `[GO TO]` (a saída padrão é o próprio salto);
2. blocos de término ou fim temporário de desenvolvimento (ex.: `"FIM temporario"`).

### P-012 [DEVE] — Safe-Save: backup e proteção contra perda de blocos
Nenhum agente sobrescreve um JSON de fluxo sem o protocolo de `blip-safe-save.mjs`:
1. releitura fresca do arquivo no disco antes de alterar;
2. backup com timestamp em `<CONTRATO>/dev/_backups/`;
3. **proibido deletar bloco existente** sem autorização nominal do usuário (`--allow-delete id1,id2`);
4. auditoria mecânica (`blip-audit.mjs`) depois de gravar, com rollback automático se reprovar.

### P-013 [DEVE] — `onboarding` sempre espera entrada (Cód. 64)
O bloco raiz (`onboarding`, `root: true`) tem ação de entrada com `"bypass": false`, salva em `inputInicial` com a tag preta `UserInput` (`{"label":"UserInput","background":"#000000"}`). Com `bypass: true` o Blip recusa a publicação com: *Cód. 64 — The root state must expect an input*.
