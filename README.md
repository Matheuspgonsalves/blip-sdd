# Blip SDD — kit de agentes para projetos no Take Blip

Kit para trabalhar com chatbots da plataforma **Blip (Take Blip)** usando IA no **Antigravity**, no modelo **Spec-Driven Development (SDD)**. Antes de mexer num fluxo, a IA entende o que existe, escreve a especificação do que vai mudar, planeja em tarefas pequenas, gera o JSON com proteções contra perda de trabalho, testa e registra tudo.

O kit tem três partes:
- **um agente único**, que lê as regras e escolhe sozinho a skill certa a partir da sua frase (você não precisa chamar agente nenhum pelo nome);
- **uma estrutura de pastas padrão por cliente**, para que todo projeto tenha o mesmo formato: produção, desenvolvimento, collections, especificação, histórico e testes;
- **scripts de segurança**, que auditam o JSON, fazem backup antes de gravar e impedem que chaves e tokens parem no git.

![Estrutura do projeto e arquitetura de agentes](docs/estrutura-projeto-blip.png)

---

## Sumário
1. [Kit × workspace](#1-kit--workspace)
2. [Mapa completo](#2-mapa-completo)
3. [Arquivos da raiz](#3-arquivos-da-raiz)
4. [`.agents/` — o cérebro do agente](#4-agents--o-cérebro-do-agente)
5. [`.githooks/` — proteção contra segredos no git](#5-githooks--proteção-contra-segredos-no-git)
6. [`CONTRATO/` — o modelo de pasta de cada cliente](#6-contrato--o-modelo-de-pasta-de-cada-cliente)
7. [`_templates/` — modelos e material de referência](#7-_templates--modelos-e-material-de-referência)
8. [`docs/` — documentação do kit](#8-docs--documentação-do-kit)
9. [Como começar](#9-como-começar)
10. [Ciclo de vida de uma alteração](#10-ciclo-de-vida-de-uma-alteração)
11. [Scripts](#11-scripts)
12. [Segurança](#12-segurança)
13. [Como evoluir o kit](#13-como-evoluir-o-kit)

---

## 1. Kit × workspace

| | O que é | Onde fica |
|---|---|---|
| **Kit** | Este repositório: agentes, regras, scripts, modelos e documentação. Não tem dado de cliente. | GitHub (`blip-sdd`) |
| **Workspace** | A pasta onde você trabalha de verdade: o kit na raiz **e** uma pasta por cliente (ex.: `Ecovita/`), cada uma copiada de `CONTRATO/`. | Sua máquina (ex.: `Wiv\Contratos\`), versionada num repositório **privado** |

```
Contratos/                ← workspace (abra ESTA pasta no Antigravity)
├── AGENTS.md  README.md  .gitignore
├── .agents/  .githooks/  _templates/  docs/     ← kit
├── CONTRATO/             ← modelo (vem do kit)
├── Ecovita/              ← cliente real, cópia de CONTRATO/
└── Acme/                 ← outro cliente
```

O Antigravity carrega as skills da pasta que está aberta. Por isso o kit precisa estar na **raiz do workspace**, com os clientes ao lado dele. Mantenha **uma cópia só** do kit por workspace: cópias soltas em outras pastas acabam divergindo.

---

## 2. Mapa completo

```
blip-sdd/
├── AGENTS.md                         mapa do workspace + roteamento de intenções
├── README.md                         este arquivo
├── .gitignore                        o que nunca vai para o git (segredos, backups, rascunhos)
│
├── .agents/
│   ├── rules/
│   │   ├── constituicao-blip.md      P-001…P-014: regras inegociáveis do JSON
│   │   └── governanca-projeto.md     prd/dev, histórico, segredos, Blip somente leitura
│   └── skills/
│       ├── blip-spec-driven/         SDD completo + engenharia reversa
│       │   └── scripts/              blip-audit.mjs, blip-safe-save.mjs
│       ├── blip-builder-json/        referência técnica do JSON do Builder
│       │   └── references/           commands da API, biblioteca Script V2, variáveis de sistema
│       ├── blip-troubleshooter/      diagnóstico de bugs
│       │   └── references/           playbook de erros comuns
│       ├── blip-relatorio-diario/    relatório do dia para o ClickUp
│       ├── blip-novo-projeto/        cria a pasta de um cliente
│       ├── blip-mapear-router/       baixa os fluxos publicados e mapeia router × Figma
│       │   └── scripts/              blip-router.mjs
│       ├── blip-promover/            atualiza prd/ depois de publicar
│       ├── blip-testes/              checklists, relatórios e PDF
│       │   └── scripts/              gerar-pdf.mjs
│       ├── blip-consultar/           executa requests das collections
│       │   └── scripts/              blip-request.mjs
│       └── blip-collection/          cria collections de API para o projeto
│
├── .githooks/
│   ├── pre-commit                    roda a checagem antes de cada commit
│   └── checar-segredos.mjs           procura chaves, tokens e senhas nos arquivos
│
├── CONTRATO/                         modelo de pasta de cliente
│   ├── prd/        fluxos/  whatsapp-flows/  RECURSOS.md
│   ├── dev/        fluxos/  whatsapp-flows/  RECURSOS.md
│   ├── collections/ambientes/exemplo.postman_environment.json
│   └── spec/       CONTEXTO.md  ESPECIFICACAO.md  DECISOES.md
│                   figma/  features/  historico/  relatorios-diarios/
│                   testes/checklists/  testes/relatorios/
│
├── _templates/
│   ├── feature/                      spec.md, design.md, tasks.md
│   ├── collections/                  collections de referência (Blip geral, WhatsApp Flows)
│   ├── blocos-padrao/                blocos homologados da empresa
│   ├── historico-dia.md              modelo do registro diário
│   ├── checklist-testes.md           modelo de checklist
│   └── relatorio-testes.md           modelo de relatório de testes
│
└── docs/
    ├── ARQUITETURA.md                decisões do kit e o porquê de cada uma
    ├── estrutura-projeto-blip.excalidraw   diagrama editável
    └── estrutura-projeto-blip.png          o mesmo diagrama em imagem
```

---

## 3. Arquivos da raiz

### `AGENTS.md`
**Propósito:** é a primeira coisa que o agente lê em toda conversa. Diz como o workspace está organizado e qual skill usar para cada tipo de pedido (tabela de roteamento: "me dá o relatório diário" → `blip-relatorio-diario`). Também lista as regras de ouro e os comandos dos scripts.

**Quando editar:** quando criar uma skill nova ou mudar a estrutura de pastas.

### `README.md`
**Propósito:** documentação para pessoas (este arquivo). O agente não depende dele.

### `.gitignore`
**Propósito:** impedir que certos arquivos entrem no git, mesmo com `git add .`:
- `**/collections/ambientes/*`: arquivos de ambiente com chaves e tokens (só o `exemplo` entra);
- `**/_backups/`: backups automáticos do safe-save (o histórico do git já cumpre esse papel);
- `**/_scratch/`: rascunhos e respostas de consultas;
- lixo de sistema (`Thumbs.db`, `.DS_Store`, `node_modules/`).

O `.gitignore` **não** bloqueia segredo escrito dentro de um arquivo permitido (ex.: uma chave no JSON de um fluxo). Isso é trabalho do `.githooks/`.

---

## 4. `.agents/` — o cérebro do agente

`.agents/` é a pasta padrão do Antigravity para personalizar o agente do workspace. Ela tem duas subpastas com papéis diferentes:

| | `rules/` | `skills/` |
|---|---|---|
| Quando é carregada | **sempre**, em toda conversa | **sob demanda**, quando o pedido combina com a descrição da skill |
| O que contém | regras que valem para qualquer tarefa | o procedimento de um tipo de tarefa |
| Analogia | o regulamento da empresa | o manual de cada função |

### 4.1 `.agents/rules/`

#### `constituicao-blip.md`
**Propósito:** reúne as regras **técnicas** que todo JSON de fluxo tem que cumprir, não importa qual skill o gerou. São os princípios P-001 a P-014:

| | Regra |
|---|---|
| P-001 | Um bloco, uma responsabilidade (`[Input]`, `[Validation]`, `[Router]`, `[HTTP]`, `[Redirect]`) |
| P-002 | Decisões só com variáveis booleanas |
| P-003 | Validação e no máximo 2 tentativas antes do transbordo |
| P-004 | Script V2, early return, sem `var` |
| P-005 | Nenhuma conexão quebrada nem bloco órfão |
| P-006 | Todo critério de aceite tem tarefa e teste |
| P-007 | Padrão `[GO TO]` para convergências, sem setas cruzando o canvas |
| P-008 | Proibido `@` em `inputVariables` de script |
| P-009 | Toda mudança registrada no histórico do dia |
| P-010 | `try/catch` em todo script |
| P-011 | Saída padrão aponta para Exceções (anti-loop) |
| P-012 | Gravação só via safe-save (backup, sem apagar bloco, auditoria) |
| P-013 | `onboarding` sempre espera entrada (evita o erro Cód. 64) |
| P-014 | Nenhuma credencial escrita no fluxo |

**Quando editar:** quando descobrir uma regra nova que deve valer para todos os clientes. Exceção de um cliente específico não entra aqui: vira ADR em `<cliente>/spec/DECISOES.md`.

#### `governanca-projeto.md`
**Propósito:** reúne as regras de **organização e segurança** do workspace:
1. como descobrir em qual cliente (contrato) você está trabalhando, e que `CONTRATO/` é só o modelo;
2. quem pode alterar `prd/` (só o `blip-mapear-router` e o `blip-promover`) e `dev/` (só via safe-save);
3. o registro obrigatório em `spec/historico/AAAA-MM-DD.md` depois de qualquer mudança;
4. onde ficam os segredos e o que fazer se encontrar um fora do lugar;
5. que a Blip é **somente leitura** para o agente (ele nunca envia, publica ou altera nada lá) e quais chamadas a APIs do cliente precisam da sua confirmação;
6. as convenções de nomes de arquivo.

### 4.2 `.agents/skills/`

Cada skill é uma pasta com um `SKILL.md`. O topo do arquivo (entre `---`) tem `name` e `description`, e é pela **description** que o agente decide usar a skill. O corpo do arquivo é o passo a passo. Algumas skills têm subpastas:
- `scripts/`: programas Node que a skill executa;
- `references/`: material de consulta que a skill lê quando precisa de detalhe.

#### `blip-spec-driven/` — a skill principal
**Propósito:** conduzir qualquer criação ou alteração de fluxo no modelo SDD.

**Quando entra:** "vamos implementar X", "muda o menu da captação", "cria o bot de exceções", "especifica esse router", "o que esse bot faz?".

**Como trabalha:**
- **Modo alteração** (7 fases):
  1. inventário do que existe (`prd/`, Figma, blocos padrão, recursos);
  2. `spec.md` com histórias e critérios Dado/Quando/Então;
  3. `design.md` com a máquina de estados em Mermaid;
  4. `tasks.md` com tarefas atômicas;
  5. plano para sua aprovação;
  6. JSON em `dev/` via safe-save;
  7. auditoria e testes.
- **Modo engenharia reversa:** lê os JSONs de `prd/` e escreve a `ESPECIFICACAO.md` (o que o bot faz hoje). Use ao pegar um projeto que já existe.

**`scripts/blip-audit.mjs`:** faz a auditoria mecânica de um JSON de fluxo.
- **Reprova** se encontrar:
  - `onboarding` ou `fallback` ausentes, ou `onboarding` sem entrada (Cód. 64);
  - conexão para bloco inexistente;
  - saída padrão que não vai para Exceções;
  - `[GO TO]` mal configurado;
  - script com `var`, sem `try/catch` ou com `@` nas variáveis;
  - credencial escrita em header HTTP.
- **Avisa, sem reprovar,** sobre blocos órfãos e blocos sobrepostos no canvas.

**`scripts/blip-safe-save.mjs`:** é a única forma de gravar um fluxo. Ele:
- relê o arquivo do disco;
- recusa a gravação se algum bloco existente sumir sem autorização (`--allow-delete`);
- faz backup em `<ambiente>/_backups/`;
- grava, roda a auditoria e **desfaz a gravação** se ela reprovar;
- bloqueia gravação em `prd/` sem `--permitir-prd`.

#### `blip-builder-json/` — referência técnica
**Propósito:** guardar o conhecimento detalhado do formato JSON do Blip Builder: estrutura de blocos, conteúdos, entradas, condições de saída, ações, as quatro famílias de variáveis, Script V2 e boas práticas de organização.

**Quando entra:** em dúvidas ou edições pontuais de bloco, ação ou script, e sempre que outra skill precisa gerar JSON.

**`references/`:**
- `blip-commands-api.md`: endereços e formatos dos commands da Blip (contextos, Desk, contatos, WhatsApp…);
- `script-v2-library.md`: funções disponíveis no Script V2, com exemplos;
- `system-variables.md`: variáveis de sistema do Builder.

#### `blip-troubleshooter/` — diagnóstico de bugs
**Propósito:** investigar comportamento errado de um bot sem chutar a causa.

**Quando entra:** "o bot não pediu o CPF", "o ticket não caiu na fila", "o usuário travou".

**Como trabalha:**
1. **Triagem:** se faltar evidência (prints, linha do tempo, JSON), pede antes de opinar.
2. **Auditoria do JSON:** percorre o fluxo de trás para frente a partir do ponto da falha.
3. **Investigação em runtime:** consulta estado do usuário, contexto e ticket via `blip-consultar`.
4. **Laudo:** causa raiz, correção em `dev/` e o cenário do bug incluído na regressão.

**`references/troubleshooting-playbook.md`:** erros comuns de Desk, WhatsApp, scripts e Builder, com causa e correção.

#### `blip-relatorio-diario/` — relatório do dia
**Propósito:** transformar o histórico técnico do dia num texto em primeira pessoa, pronto para colar no ClickUp. O texto tem 5 seções fixas: decisão do dia, entregas, PDFs anexos, testes e próximos passos.

**Quando entra:** "me dá o relatório diário", "resumo do dia".

**O que usa:**
- **Lê:** `spec/historico/<hoje>.md`, `tasks.md`, checklists e relatórios de teste.
- **Grava:** `spec/relatorios-diarios/<hoje>.md`.

#### `blip-novo-projeto/` — novo cliente
**Propósito:** criar a pasta de um cliente copiando `CONTRATO/` e organizar o material recebido: JSON de produção em `prd/fluxos/`, Figma em `spec/figma/`, chaves em `collections/ambientes/` e assim por diante.

**Quando entra:** "cria o projeto da Acme", "vou trazer os fluxos de produção do router X".

**Também:** roda a checagem de segredos no material importado e, se o projeto já existir, oferece a engenharia reversa.

#### `blip-mapear-router/` — mapa do router a partir da Blip
**Propósito:** montar o retrato de um router que já está em produção sem você exportar nada à mão. Só lê da Blip.

**Quando entra:** "lista os bots do router", "baixa os fluxos de produção", "atualiza o prd pela API", "mapeia o router", "qual bot é qual Figma?".

**Como trabalha:**
1. confere o ambiente: a key do roteador em `Authorization` e uma `key_<identificador>` por bot;
2. descobre os bots (nome de cada key e se tem fluxo do Builder) e pede o print da tela de serviços do roteador quando a API não traz essa lista;
3. baixa o JSON **publicado** de cada bot para `prd/fluxos/<identificador>.json`, no formato do export do Studio, com backup da versão anterior;
4. levanta a topologia (quem redireciona para qual serviço) e aponta bots que faltam;
5. descreve cada bot (modo engenharia reversa do `blip-spec-driven`);
6. associa cada bot a um frame do Figma pela coincidência de textos (Alta / Parcial / Sem correspondência);
7. escreve o mapa e as pendências na `ESPECIFICACAO.md`.

**`scripts/blip-router.mjs`** (só commands `get`):
- `descobrir`: identifica o bot de cada key e se ele tem fluxo do Builder;
- `buckets`: lista os documentos guardados de um bot;
- `baixar`: baixa fluxo + ações globais + subflows publicados e grava em `prd/fluxos/` via safe-save; para se a versão publicada não existir ou se blocos sumiram (você decide);
- `topologia`: lê os JSONs de `prd/fluxos/` e gera tabela + Mermaid dos redirecionamentos entre serviços.

#### `blip-promover/` — depois de publicar
**Propósito:** manter `prd/` igual ao que está publicado. A skill:
- traz o JSON publicado para `prd/`, com backup da versão anterior;
- confere se não foi valor de dev para produção (URLs, redirects, chaves);
- atualiza `ESPECIFICACAO.md`, `RECURSOS.md` e o histórico.

**Quando entra:** "publiquei a captação", "subi pra produção".

#### `blip-testes/` — testes
**Propósito:** criar e manter checklists de teste (por fase e de regressão), marcar resultados, montar o relatório a partir das suas evidências e gerar PDF.

**Quando entra:** "faz o checklist da fase 2", "o TC-003 passou", "o que falta testar?", "gera o relatório dos testes", "gera o PDF".

**`scripts/gerar-pdf.mjs`:** converte qualquer markdown em PDF usando o Edge ou o Chrome em modo headless, e checklists ganham barra de progresso. Substitui os geradores de PDF que tinham o conteúdo escrito dentro do script.

#### `blip-consultar/` — perguntas à plataforma
**Propósito:** responder perguntas que só a Blip (ou a API do cliente) sabe naquele momento, executando requests das collections do projeto.

**Quando entra:** "quantos tickets na fila Hotline?", "quem tá online?", "em que bloco o usuário parou?", "lista os templates".

**`scripts/blip-request.mjs`:**
- lista as requests de uma collection, marcando `[L]` leitura, `[X]` escrita na Blip e `[E]` escrita em API do cliente;
- executa uma request com o ambiente do projeto;
- recusa **qualquer** escrita na Blip (inclusive commands que publicam ou depreciam flows), mesmo com `--confirmar`;
- em API do cliente, só executa escrita com `--confirmar`;
- nunca imprime chave.

#### `blip-collection/` — collections de API
**Propósito:** criar ou ajustar as collections Postman do projeto (commands da Blip e APIs do cliente). A fonte pode ser documentação, Swagger, cURL ou um bloco HTTP de um fluxo. Valores secretos sempre viram `{{variáveis}}`.

**Quando entra:** "cria a collection da API de viabilidade", "transforma esse cURL em collection".

---

## 5. `.githooks/` — proteção contra segredos no git

Hooks são scripts que o git roda sozinho em certos momentos. Esta pasta guarda o hook que roda **antes do commit**.

| Arquivo | Propósito |
|---|---|
| `pre-commit` | O git executa este arquivo antes de cada commit. Ele chama o `checar-segredos.mjs` só nos arquivos que você está commitando. |
| `checar-segredos.mjs` | Procura chave Blip (`Key …`), token `Bearer`, JWT, chave privada e campos de senha ou token preenchidos. Se achar, **bloqueia o commit** e mostra arquivo, linha e o trecho mascarado. Com `--todos`, varre o workspace inteiro (rode antes do primeiro commit e ao importar um cliente antigo). |

**Ativação (uma vez por clone):** `git config core.hooksPath .githooks`. Sem esse comando, o git não usa a pasta.

---

## 6. `CONTRATO/` — o modelo de pasta de cada cliente

**Propósito:** é o **molde**. Todo cliente novo é uma cópia desta pasta, no mesmo nível dela (ex.: `Ecovita/`), feita pela skill `blip-novo-projeto`. O `CONTRATO/` não é um cliente, e o agente nunca grava nele durante o trabalho de um projeto. Só mexa nele quando quiser mudar o padrão para os próximos clientes.

Os arquivos `.gitkeep` existem só para o git guardar as pastas vazias.

### `prd/` — produção
**Propósito:** espelho **exato** do que está publicado no Blip hoje. É o ponto de partida de qualquer análise ou alteração.

| Item | Conteúdo |
|---|---|
| `fluxos/` | JSON publicado de cada bot de produção, baixado pelo `blip-mapear-router` ou exportado do Studio (ex.: `ecovitacaptacaodev.json`). |
| `whatsapp-flows/` | JSON das telas dos WhatsApp Flows publicados. |
| `RECURSOS.md` | Tabela com bots, recursos do Builder, configurações, APIs e filas do Desk de produção. Tem **nomes e URLs**; um valor secreto aparece só pelo nome da variável. |
| `_backups/` *(criada automaticamente)* | Versões anteriores, guardadas pelo `blip-promover`. |

**Quem altera:** só as skills `blip-mapear-router` (baixa a versão publicada) e `blip-promover` (depois que você confirma que publicou).

### `dev/` — desenvolvimento
**Propósito:** guardar só os bots que estão sendo alterados **agora**. Se um bot não está em `dev/`, ninguém está mexendo nele.

| Item | Conteúdo |
|---|---|
| `fluxos/` | JSON dos bots em desenvolvimento. |
| `whatsapp-flows/` | Telas de WhatsApp Flows em desenvolvimento. |
| `RECURSOS.md` | Mesmo formato do de produção, com os valores de dev (URLs de homologação, bots de dev). |
| `_backups/` *(criada automaticamente)* | Cópia de cada versão antes de o safe-save gravar. |

**Quem altera:** `blip-spec-driven` e `blip-troubleshooter`, sempre via `blip-safe-save.mjs`.

### `collections/` — APIs do projeto
**Propósito:** guardar as collections Postman deste cliente (commands da Blip que o projeto usa e APIs do cliente), criadas pela skill `blip-collection`. As collections só contêm `{{variáveis}}`.

`ambientes/exemplo.postman_environment.json` lista todas as variáveis, com valores vazios ou `PREENCHER`: `blip_url`, `Authorization` (key do **roteador**) e uma `key_<identificador>` para **cada bot** do router (cada key só lê o próprio bot). Copie para `prd.postman_environment.json` e `dev.postman_environment.json` e preencha com as chaves reais. **Só o exemplo vai para o git.**

### `spec/` — tudo que explica o projeto

| Item | Propósito |
|---|---|
| `CONTEXTO.md` | Lado de **negócio**: cliente, objetivo, pessoas, canais, horário, regras de negócio e perguntas em aberto. |
| `ESPECIFICACAO.md` | Lado **técnico** do que existe **hoje**: mapa do router (serviço × bot × arquivo × frame do Figma), topologia, o que cada bot faz, integrações, pontos de atenção e pendências. É gerada pelo `blip-mapear-router` e atualizada a cada publicação. |
| `DECISOES.md` | ADRs: cada decisão estrutural numerada, com contexto, decisão e consequência. Nenhuma é apagada; uma decisão nova substitui a antiga. |
| `figma/` | Frames exportados do Figma (PNG para a IA ler; SVG, se quiser). |
| `features/<feature>/` | Uma pasta por mudança, com `spec.md` (o que muda e os critérios de aceite), `design.md` (como vai ser construído) e `tasks.md` (tarefas atômicas com status). |
| `historico/` | Um arquivo por dia trabalhado (`AAAA-MM-DD.md`), com cada alteração: o quê, por quê, arquivos e como testar. É a fonte do relatório diário. |
| `relatorios-diarios/` | O texto do ClickUp gerado a partir do histórico, um por dia. |
| `testes/checklists/` | Checklists em markdown (`- [ ]` / `- [x]`), um por fase, mais o de regressão cumulativo. |
| `testes/relatorios/` | Relatórios de cada rodada de testes e os PDFs gerados a partir deles. |

### Pasta criada sob demanda
`_scratch/` guarda rascunhos temporários: o JSON intermediário antes do safe-save e respostas grandes de consultas. Não vai para o git.

---

## 7. `_templates/` — modelos e material de referência

**Propósito:** guardar arquivos que as skills **copiam** ou **consultam**. Nada aqui é de um cliente específico.

| Item | Propósito | Quem usa |
|---|---|---|
| `feature/spec.md` | Modelo da especificação de uma mudança: histórias de usuário, critérios Dado/Quando/Então, suposições, perguntas em aberto e fora de escopo. | `blip-spec-driven` (fase 1) |
| `feature/design.md` | Modelo do design: arquitetura, máquina de estados em Mermaid, contrato de dados, hand-offs e integrações HTTP. | `blip-spec-driven` (fase 2) |
| `feature/tasks.md` | Modelo da lista de tarefas atômicas, organizadas em ondas. | `blip-spec-driven` (fase 3) |
| `collections/` | Collections de **referência**: `blip-geral` (commands da Blip por extensão: Desk, contextos, contatos, WhatsApp, IA…) e `wa-flows-template` (ciclo de um WhatsApp Flow). Servem de base para as collections de cada cliente e de reserva para consultas gerais. A pasta tem um `README.md` próprio. | `blip-collection`, `blip-consultar` |
| `blocos-padrao/` | Blocos homologados da empresa (atendimento humano, captação, exceções, finalização, username Meta, WhatsApp Flow, scripts prontos). A IA reaproveita nomes, tags, trackings e layout em vez de inventar. Neste repositório público há só o `README.md`; os JSONs ficam no seu workspace. | `blip-spec-driven` (fase 0) |
| `historico-dia.md` | Modelo do arquivo diário de histórico. | todas as skills que alteram algo |
| `checklist-testes.md` | Modelo de checklist, com resumo de status e cenários detalhados. | `blip-testes` |
| `relatorio-testes.md` | Modelo de relatório de uma rodada de testes: escopo, resultados, falhas e conclusão. | `blip-testes` |

---

## 8. `docs/` — documentação do kit

| Arquivo | Propósito |
|---|---|
| `ARQUITETURA.md` | Cada decisão de desenho do kit e o motivo dela (por que prd/dev, por que um agente com skills, por que testes em markdown, por que o hook de segredos…). Leia antes de mudar a estrutura. |
| `estrutura-projeto-blip.excalidraw` | Diagrama editável da estrutura e dos agentes. Abre no excalidraw.com ou no plugin Excalidraw do Obsidian. |
| `estrutura-projeto-blip.png` | O mesmo diagrama em imagem, usado neste README. |

---

## 9. Como começar

1. Copie (ou clone) o kit para a **raiz** da sua pasta de contratos. Essa pasta vira o workspace.
2. Versione o workspace num repositório **privado** e ative o hook: `git config core.hooksPath .githooks`.
3. Rode `node .githooks/checar-segredos.mjs --todos` antes do primeiro commit.
4. Coloque os blocos padrão da empresa em `_templates/blocos-padrao/`.
5. Abra o workspace no Antigravity e converse normalmente:

| Você diz | O que acontece |
|---|---|
| "cria o projeto da Acme" | `blip-novo-projeto` copia `CONTRATO/` para `Acme/` |
| "lista os bots do router de produção, baixa os fluxos e mapeia com o Figma" | `blip-mapear-router` baixa cada bot para `prd/fluxos/` e escreve o mapa na `ESPECIFICACAO.md` |
| "coloquei os fluxos de produção, especifica esse router" | `blip-spec-driven` faz engenharia reversa e escreve `ESPECIFICACAO.md` |
| "muda o menu da captação pra ter a opção X" | `blip-spec-driven`: spec → design → tasks → JSON em `dev/` com safe-save |
| "o bot não pediu o CNPJ, olha esse print" | `blip-troubleshooter` investiga, corrige em `dev/` e registra |
| "quantos tickets tem na fila Hotline?" | `blip-consultar` roda a request com o ambiente do projeto |
| "cria a collection da API de viabilidade do cliente" | `blip-collection` gera a collection só com `{{variáveis}}` |
| "faz o checklist da fase 2" / "marca o TC-003 como ok" / "gera o PDF" | `blip-testes` |
| "publiquei a captação" | `blip-promover` atualiza `prd/`, a especificação e o histórico |
| "me dá o relatório diário" | `blip-relatorio-diario` monta o texto do ClickUp a partir do histórico |

---

## 10. Ciclo de vida de uma alteração

1. **Importar** os JSONs de produção para `prd/` (`blip-mapear-router` baixa pela API; ou export manual organizado pelo `blip-novo-projeto`).
2. **Inventário + especificação** da mudança em `spec/features/<feature>/spec.md` (`blip-spec-driven`).
3. **Design e tarefas** (`design.md`, `tasks.md`), com a sua aprovação.
4. **Gerar o fluxo em `dev/`**, com safe-save e auditoria.
5. **Testar** no BlipChat e no WhatsApp seguindo o checklist (`blip-testes`).
6. **Relatório de testes** a partir das evidências.
7. **Publicar** no Blip (você).
8. **Promover**: `dev/` vira `prd/` (`blip-promover`).

Cada etapa grava em `spec/historico/AAAA-MM-DD.md`. O `blip-consultar` e o `blip-troubleshooter` entram em qualquer etapa.

---

## 11. Scripts

Todos rodam com Node 18+ e não têm dependências npm. Rode a partir da raiz do workspace.

| Script | Para quê |
|---|---|
| `node .agents/skills/blip-spec-driven/scripts/blip-audit.mjs <fluxo.json>` | Auditoria mecânica do JSON |
| `node .agents/skills/blip-spec-driven/scripts/blip-safe-save.mjs <alvo> <novo> [--allow-delete ids]` | Gravação com backup, trava de deleção, auditoria e rollback |
| `node .agents/skills/blip-consultar/scripts/blip-request.mjs <collection> --listar [--buscar termo]` | Lista as requests de uma collection |
| `node .agents/skills/blip-consultar/scripts/blip-request.mjs <collection> "<request>" --ambiente <env> [--var k=v] [--confirmar]` | Executa uma request (escrita na Blip sempre recusada; `--confirmar` só vale para API do cliente) |
| `node .agents/skills/blip-mapear-router/scripts/blip-router.mjs descobrir --ambiente <env>` | Identifica o bot de cada key do ambiente |
| `node .agents/skills/blip-mapear-router/scripts/blip-router.mjs baixar --ambiente <env> --contrato <pasta> [--chave key_<bot>]` | Baixa os fluxos publicados para `prd/fluxos/` |
| `node .agents/skills/blip-mapear-router/scripts/blip-router.mjs topologia --contrato <pasta>` | Tabela + Mermaid dos redirecionamentos |
| `node .agents/skills/blip-testes/scripts/gerar-pdf.mjs <arquivo.md> [saida.pdf]` | Markdown → PDF |
| `node .githooks/checar-segredos.mjs --todos` | Varre o workspace atrás de segredos |

---

## 12. Segurança

Este repositório guarda só o kit. O workspace (kit + clientes) vai para um repositório **privado**, e três camadas evitam que segredo vá junto:

1. **`.gitignore`**: `collections/ambientes/`, `_backups/` e `_scratch/` nunca entram.
2. **Hook `pre-commit`**: bloqueia o commit se houver chave, token ou senha escrita em qualquer arquivo, inclusive dentro do JSON exportado do Studio.
3. **Constituição P-014 + `blip-audit.mjs`**: fluxo com credencial escrita em header HTTP reprova; a chave vai para `{{resource.x}}` ou `{{config.x}}` no Studio.

Além disso, **a Blip é somente leitura para o agente**: ele consulta, mas nunca envia, publica, altera ou apaga nada lá, nem se você pedir. Os scripts reforçam isso (`blip-request.mjs` recusa escrita na Blip; `blip-router.mjs` só tem leitura). Publicar e alterar é sempre manual. Em APIs do cliente, escrita só roda com a sua confirmação.

---

## 13. Como evoluir o kit

| Quero… | Mexa em |
|---|---|
| mudar como uma tarefa é feita | o `SKILL.md` da skill |
| criar um tipo novo de tarefa | uma pasta nova em `.agents/skills/` + uma linha na tabela de roteamento do `AGENTS.md` |
| uma regra técnica nova para todos os fluxos | `.agents/rules/constituicao-blip.md` (e, se der para checar automaticamente, o `blip-audit.mjs`) |
| uma regra de organização nova | `.agents/rules/governanca-projeto.md` |
| mudar a estrutura de pasta dos próximos clientes | `CONTRATO/` (e a skill `blip-novo-projeto`) |
| mudar o formato de spec, testes ou histórico | o modelo em `_templates/` |

Registre o motivo da mudança em `docs/ARQUITETURA.md`.
