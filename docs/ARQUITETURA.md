# Arquitetura do kit Blip SDD

Registro das decisões que deram forma a este kit (outubro/2026). Cada seção diz **o que** foi decidido e **por quê**.

---

## 1. Um workspace, vários contratos
**Decisão:** uma única pasta aberta no Antigravity contém o kit (`.agents/`, `_templates/`, `docs/`) e todos os contratos (uma pasta por cliente).

**Por quê:** o Antigravity carrega skills por workspace. Antes, cada projeto era aberto num workspace diferente e as skills foram copiadas e editadas separadamente (o `blip-spec-driven` chegou a ter duas versões divergentes). Com um workspace só, existe uma cópia de cada skill e de cada regra, e toda melhoria vale para todos os clientes.

## 2. prd/ e dev/ (antes "BlipIn/BlipOut" e "antigo/novo")
**Decisão:** `prd/` é o espelho exato do que está publicado; `dev/` contém **apenas** os bots que estão sendo alterados.

**Por quê:** a IA sempre parte de uma produção conhecida, e fica claro o que está em andamento. `prd/` só muda pela skill `blip-promover`, depois que o usuário confirma a publicação, para não divergir do Studio. Os nomes `prd/dev` dizem o ambiente sem precisar de explicação.

## 3. Agente único + skills, em vez de um agente por pasta
**Decisão:** um agente que lê `AGENTS.md` e `rules/` sempre, e carrega skills sob demanda pela descrição.

**Por quê:** as tarefas atravessam pastas (gerar um fluxo lê `prd/` e `spec/`, escreve em `dev/` e registra no histórico). Agentes por pasta teriam que trocar contexto entre si, e o usuário teria que lembrar qual chamar. Com skills, uma frase como "me dá o relatório diário" basta. Subagentes ficam para trabalho pesado e paralelizável (engenharia reversa de um router com muitos bots, revisão independente).

## 4. Constituição como regra, não dentro de uma skill
**Decisão:** os princípios P-001…P-013 saíram do `blip-spec-driven` e foram para `.agents/rules/constituicao-blip.md`.

**Por quê:** eles precisam valer também quando o `blip-troubleshooter` corrige um fluxo ou quando o `blip-builder-json` edita um bloco solto. Exceções por cliente são registradas como ADR no contrato.

## 5. Especificação em dois níveis
**Decisão:**
- `spec/ESPECIFICACAO.md` — o que o bot faz **hoje** (as-is), gerada por engenharia reversa e atualizada a cada promoção;
- `spec/features/<feature>/` — `spec.md`, `design.md`, `tasks.md` de cada mudança (formato SDD).

**Por quê:** quem pega um projeto no meio precisa do retrato atual; quem vai mudar algo precisa da spec da mudança. Misturar os dois faz a spec virar histórico.

## 6. Histórico por dia, relatório derivado
**Decisão:** toda alteração gera uma entrada em `spec/historico/AAAA-MM-DD.md`; o relatório do ClickUp (`relatorios-diarios/`) é gerado a partir dele. Decisões estruturais também viram ADR em `DECISOES.md`.

**Por quê:** um `HISTORICO_MUDANCAS.md` único cresce sem limite e é caro para a IA reler. Um arquivo por dia é exatamente o recorte que o relatório diário precisa.

## 7. Testes em markdown, PDF só como exportação
**Decisão:** checklists e relatórios de teste são markdown (`- [ ]` / `- [x]`); o PDF é gerado por um script genérico (`gerar-pdf.mjs`).

**Por quê:** a IA consegue marcar um teste como concluído num markdown; num PDF, não. Antes, o conteúdo dos relatórios ficava escrito dentro de scripts geradores, que eram copiados a cada dia (`generate-tests-pdf-2809.cjs`, `-2909`, `-3009`…). Agora existe um gerador só, e o conteúdo fica versionado no markdown.

## 8. Collections por projeto, segredos fora delas
**Decisão:** cada contrato tem suas collections em `collections/`, geradas pela IA conforme a necessidade. Valores de chaves e tokens ficam só em `collections/ambientes/*.postman_environment.json`, fora do git. As collections gerais (Blip, WhatsApp Flows) ficam em `_templates/collections/` como referência.

**Por quê:** cada projeto precisa de um recorte diferente da API (e das APIs do cliente), então não há uma collection padrão única. Collections exportadas do Postman costumam carregar chaves dentro do array `variable`; separar o ambiente evita que uma chave vá parar num repositório ou num print.

## 9. Escrita na plataforma só com confirmação
**Decisão:** `blip-request.mjs` executa leituras direto e recusa escrita sem `--confirmar`; as regras exigem que o agente peça o "sim" antes.

**Por quê:** a collection geral da Blip tem requests como "Delete all intents", e envios de mensagem chegam a clientes reais. Errar uma leitura custa nada; errar uma escrita em produção pode não ter volta.

## 10. Safe-save genérico
**Decisão:** `blip-safe-save.mjs` encontra sozinho a pasta de ambiente (`dev/` ou `prd/`) do arquivo alvo, faz backup em `<ambiente>/_backups/`, bloqueia deleção de blocos não autorizada, roda a auditoria e faz rollback. Gravar em `prd/` exige `--permitir-prd`.

**Por quê:** a versão anterior tinha caminhos fixos do projeto em que nasceu (pasta `.spec` daquele projeto e um arquivo-espelho específico) e só funcionava rodando da raiz daquele workspace.

---

## Origem das skills
| Skill | Origem | O que mudou |
|---|---|---|
| `blip-spec-driven` | já existia | caminhos da estrutura nova, constituição movida para rules, modo engenharia reversa, histórico por dia, scripts dentro da skill |
| `blip-builder-json` | já existia | sem alteração |
| `blip-troubleshooter` | já existia | executa consultas via `blip-consultar`, corrige em `dev/` com safe-save, registra e alimenta a regressão; exemplo sem nome de cliente |
| `blip-relatorio-diario` | `relatorio-diario-blip` | sem referência fixa a um cliente; lê `historico/` do dia; seção de PDFs só quando existem |
| `blip-novo-projeto` | nova | — |
| `blip-promover` | nova | — |
| `blip-testes` | nova (substitui os geradores de PDF por dia) | — |
| `blip-consultar` | nova | — |
| `blip-collection` | nova | — |
