---
name: blip-spec-driven
description: >-
  Metodologia Spec-Driven Development (SDD) para chatbots no Take Blip (Builder / Studio). Conduz o ciclo completo: inventário de contexto (prd/, templates da empresa, Figma, recursos), especificação com User Stories e Critérios de Aceite Dado/Quando/Então, design da máquina de estados, tarefas atômicas, execução do JSON em dev/ com safe-save e auditoria mecânica. Também faz engenharia reversa de um projeto existente para gerar a ESPECIFICACAO.md. Use sempre que o usuário quiser iniciar, alterar, refatorar, projetar, especificar ou auditar um fluxo/bot no Blip, ou entender o que um router existente faz.
---

# blip-spec-driven — SDD para Take Blip

No Blip o artefato final é uma **máquina de estados em JSON** (blocos, condições de saída, transbordos, Scripts V2, redirecionamento entre subbots). Esta skill garante que esse JSON nasça de uma especificação rastreável, e não de improviso.

Antes de começar: identifique o **contrato ativo** (`.agents/rules/governanca-projeto.md`) e siga a **constituição** (`.agents/rules/constituicao-blip.md`). Para qualquer detalhe de sintaxe do JSON, use a skill `blip-builder-json`.

```
INVENTÁRIO → ESPECIFICAR → PROJETAR → TAREFAS → APROVAÇÃO → EXECUTAR → AUDITAR + TESTES
 (Fase 0)     (Fase 1)     (Fase 2)   (Fase 3)  (Fase 4)    (Fase 5)    (Fase 6)
```

Existem dois modos de entrada:
- **Modo Alteração** (padrão): o usuário quer criar ou mudar algo → Fases 0 a 6 para a feature.
- **Modo Engenharia Reversa**: o projeto já existe e não tem spec → seção própria no fim desta skill. Rode-o antes do Modo Alteração sempre que `spec/ESPECIFICACAO.md` estiver vazio ou desatualizado.

---

## Fase 0 — Inventário de contexto
**Nunca invente requisitos nem crie blocos no vazio.** Antes de especificar, leia:

1. **`<CONTRATO>/spec/CONTEXTO.md` e `ESPECIFICACAO.md`** — objetivo do cliente, topologia (roteador/subbots), o que já existe.
2. **`<CONTRATO>/prd/fluxos/`** — fluxos publicados: endpoints HTTP reais (URL, método, headers, body), scripts utilitários (regex, parsing), nomes de serviços de redirect, trackings.
3. **`_templates/blocos-padrao/`** — blocos padrão homologados da empresa (atendimento humano, captação, exceções, finalização, Username Meta, WhatsApp Flow). Preserve nomenclatura, tags, trackings e estrutura visual.
4. **`<CONTRATO>/spec/figma/`** — caminho feliz, rotas de exceção, regras globais (cascata de validação, inatividade, smalltalks, regex), textos e emojis oficiais.
5. **`<CONTRATO>/prd/RECURSOS.md` e `dev/RECURSOS.md`** — URLs base, nomes de recursos e configurações (os valores secretos ficam em `collections/ambientes/`; não os repita no chat).
6. **`<CONTRATO>/spec/DECISOES.md`** — ADRs já tomadas, para não contradizê-las.

Se o inventário for grande (router com muitos bots), registre o resumo em `spec/features/<feature>/INVENTARIO_CONTEXTO.md`.

---

## Fase 1 — Especificar (`spec.md`)
Arquivo: `<CONTRATO>/spec/features/<feature>/spec.md` (modelo em `_templates/feature/spec.md`).

- **Histórias de Usuário (`US-xxx`)**: quem precisa, o quê e por quê.
- **Critérios de Aceite (`AC-xxx`)** em Dado/Quando/Então:
  - **Dado** que o usuário está no bloco `X` (com as variáveis `Y`),
  - **Quando** envia a mensagem/ação `Z`,
  - **Então** o fluxo vai para `W`, atualiza `V` e exibe `C`.
- **Suposições (`ASM-xxx`)** — lacunas preenchidas com hipótese técnica (`aberta | confirmada | invalidada`).
- **Perguntas em aberto (`Q-xxx`)** — dúvidas de negócio para o dono do produto (`aberta | respondida`).

---

## Fase 2 — Projetar (`design.md`)
Arquivo: `<CONTRATO>/spec/features/<feature>/design.md` (modelo em `_templates/feature/design.md`).

1. **Arquitetura geral**: orquestrador vs. subbots, fronteiras de negócio, pastas visuais no Studio.
2. **Máquina de estados em Mermaid**, seguindo SRP (`[Input]`, `[Validation]`, `[Router]`, `[HTTP]`, `[Redirect]`, `[GO TO]`).
3. **Contrato de dados**: variáveis de contexto (tipo, quem escreve, quem lê), `contact.*`, `config.*` (listadas para cadastro manual), recursos.
4. **Matriz de hand-offs**: condição exata do redirect e nome exato do serviço de destino.
5. **Integrações HTTP**: endpoint, método, headers, body, variáveis salvas no 200 e tratamento de falha.

---

## Fase 3 — Tarefas atômicas (`tasks.md`)
Arquivo: `<CONTRATO>/spec/features/<feature>/tasks.md` (modelo em `_templates/feature/tasks.md`).

Nenhuma feature é implementada num bloco monolítico. Cada tarefa:
```markdown
### [ ] T-001 — Nome descritivo
- **Refs:** AC-001, AC-002
- **Blocos afetados:** `[Input] Telefone`, `[Validation] Telefone`
- **Ações:** entrada com regex `^\d{10,11}$`, Script V2 de validação salvando `isPhoneValid`.
- **Critério de conclusão:** bloco gerado, safe-save OK, auditoria OK.
```
Organize em ondas: (1) estrutura base, variáveis e entradas; (2) scripts e integrações; (3) roteadores e transbordos; (4) auditoria e testes.

---

## Fase 4 — Plano de execução e aprovação
- Apresente o plano (artifact `implementation_plan.md` no Antigravity, pedindo feedback) com as `Q-xxx` em aberto.
- Não faça alteração massiva no JSON antes do "ok" do usuário.

---

## Fase 5 — Execução (JSON em `dev/`)
- O alvo é sempre `<CONTRATO>/dev/fluxos/<bot>.json`. Se o bot só existe em `prd/`, copie primeiro para `dev/fluxos/` (nunca edite `prd/`).
- Gere ou edite o JSON seguindo a skill `blip-builder-json` e a constituição.
- **Grave sempre via Safe-Save** (P-012):
  ```bash
  node .agents/skills/blip-spec-driven/scripts/blip-safe-save.mjs <CONTRATO>/dev/fluxos/<bot>.json <arquivo-novo.json>
  # deleção de bloco só com autorização nominal do usuário:
  node .agents/skills/blip-spec-driven/scripts/blip-safe-save.mjs <alvo.json> <novo.json> --allow-delete id1,id2
  ```
  O script relê o arquivo do disco, faz backup em `<CONTRATO>/dev/_backups/`, bloqueia deleção não autorizada, roda a auditoria e faz rollback se ela reprovar. Para um bot novo (arquivo ainda inexistente), ele cria o arquivo e audita.
- O `<arquivo-novo.json>` é um rascunho temporário: gere-o fora de `dev/fluxos/` (ex.: `<CONTRATO>/_scratch/`) e deixe o safe-save levá-lo ao destino.
- Marque a tarefa como `[x]` em `tasks.md` só depois do safe-save aprovado.

---

## Fase 6 — Auditoria mecânica e testes
1. **Auditoria**: `node .agents/skills/blip-spec-driven/scripts/blip-audit.mjs <fluxo.json>` deve sair com código 0. Avisos (órfãos, sobreposição) são reportados ao usuário.
2. **Testes**: acione a skill `blip-testes` para gerar/atualizar:
   - o checklist da fase (`spec/testes/checklists/<feature>-fase-XX.md`), cobrindo **BlipChat** (sem telefone nativo) e **WhatsApp** (BSUID/Meta);
   - o roteiro de regressão cumulativo (`spec/testes/checklists/<feature>-regressao.md`), somando os cenários das fases anteriores.

---

## Governança da documentação (anti-drift)
1. **Nunca sobrescreva destrutivamente** spec/design/tasks: ajuste com marcação de versão (`(v1.2: dividida em T-004a/T-004b)`); tarefa descartada recebe `[-]` e o motivo.
2. **Histórico obrigatório**: toda alteração de JSON ou documentação gera entrada em `spec/historico/AAAA-MM-DD.md` (formato em `governanca-projeto.md` §3).
3. **Decisão estrutural** (novo subbot, troca de topologia, novo padrão visual) vira ADR em `spec/DECISOES.md`.
4. Se uma regra nova deveria valer para todos os projetos, proponha ao usuário incluí-la em `.agents/rules/constituicao-blip.md`.

---

## Modo Engenharia Reversa (projeto existente)
Use quando o usuário colocar fluxos em `prd/` e pedir "especifica esse router", "o que esse bot faz?", ou quando `ESPECIFICACAO.md` estiver vazia.

1. **Mapear a topologia**: roteador, serviços/subbots, como um chega no outro (redirects, `config`, recursos de redirect).
2. **Por bot** (se forem muitos, um subagente por JSON, em paralelo, devolvendo o resumo no formato abaixo):
   - objetivo do bot em 1–2 frases;
   - jornada principal (caminho feliz) como lista de blocos-chave;
   - entradas coletadas e validações;
   - integrações HTTP (endpoint, método, o que salva);
   - transbordos (filas do Desk, condições) e trackings relevantes;
   - variáveis de contexto/contato/config usadas;
   - riscos encontrados (órfãos, saídas quebradas, violações da constituição) — rode `blip-audit.mjs` em cada JSON. Em `prd/` isso é diagnóstico, não bloqueio.
3. **Escrever `spec/ESPECIFICACAO.md`** (modelo em `CONTRATO/spec/ESPECIFICACAO.md`): visão geral, topologia (Mermaid), uma seção por bot, integrações, configurações e recursos (nomes, sem valores secretos), pontos de atenção.
4. Se `CONTEXTO.md` estiver vazio, rascunhe-o com o que der para inferir e marque as lacunas como perguntas para o usuário.
5. Registre no histórico do dia.

A especificação descreve **o que existe** (as-is). Mudanças futuras vão para `spec/features/`, e o `blip-promover` atualiza a `ESPECIFICACAO.md` quando a mudança chega em produção.
