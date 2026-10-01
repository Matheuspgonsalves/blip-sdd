# AGENTS.md — Workspace Blip SDD

Este workspace organiza projetos de chatbot na plataforma **Blip (Take Blip)** com Spec-Driven Development. Você é um agente único: leia este arquivo e as regras em `.agents/rules/`, identifique a intenção do usuário e carregue a skill certa. O usuário não precisa citar a skill pelo nome.

## Mapa do workspace

```
.
├── AGENTS.md                 ← este arquivo
├── .agents/
│   ├── rules/                ← sempre ativas: constituicao-blip.md, governanca-projeto.md
│   └── skills/               ← skills blip-* (carregadas sob demanda)
├── _templates/
│   ├── feature/              ← modelos de spec.md, design.md, tasks.md
│   ├── collections/          ← collections de referência (Blip geral, WA Flows)
│   ├── blocos-padrao/        ← blocos padrão da empresa
│   └── *.md                  ← modelos de histórico, checklist, relatório de testes
├── docs/                     ← arquitetura deste kit
├── CONTRATO/                 ← MODELO de contrato (copiado pelo blip-novo-projeto; nunca grave nele)
└── <CONTRATO>/               ← um por cliente, ex.: Ecovita/ (versionado; segredos ficam fora)
    ├── prd/                  ← espelho do que está publicado
    │   ├── fluxos/  whatsapp-flows/  RECURSOS.md
    ├── dev/                  ← só o que está sendo alterado
    │   ├── fluxos/  whatsapp-flows/  RECURSOS.md  _backups/
    ├── collections/          ← collections do projeto + ambientes/ (segredos)
    └── spec/
        ├── CONTEXTO.md  ESPECIFICACAO.md  DECISOES.md
        ├── figma/  features/<feature>/
        ├── historico/AAAA-MM-DD.md  relatorios-diarios/AAAA-MM-DD.md
        └── testes/checklists/  testes/relatorios/
```

## Roteamento de intenções

| O usuário diz algo como… | Skill |
|---|---|
| "cria o projeto da X", "começa um contrato novo", "importei os fluxos de produção" | `blip-novo-projeto` |
| "especifica esse router", "o que esse bot faz?", "preciso da spec", "vamos implementar X", "muda o menu da captação", "cria o bot de exceções" | `blip-spec-driven` |
| dúvida ou edição pontual de bloco, condição de saída, ação, Script V2, variável do Builder | `blip-builder-json` |
| "tá dando erro", "o bot não pediu o CPF", "ticket não caiu na fila", "por que o usuário travou?" | `blip-troubleshooter` |
| "quantos tickets na fila X?", "quem tá online?", "qual o estado do usuário Y?", "lista os flows/templates" | `blip-consultar` |
| "cria uma collection pra API do cliente", "monta a collection de WhatsApp Flows do projeto" | `blip-collection` |
| "faz o checklist de testes", "marca o teste 3 como ok", "gera o relatório dos testes", "gera o PDF" | `blip-testes` |
| "publiquei a captação", "subi pra produção", "promove o dev" | `blip-promover` |
| "me dá o relatório diário", "relatório pro ClickUp", "resumo do dia" | `blip-relatorio-diario` |

Se a intenção combinar duas skills (ex.: corrigir um bug e depois testar), siga a ordem natural e use as duas.

## Regras de ouro (detalhe em `.agents/rules/`)
1. Descubra o **contrato ativo** antes de tocar em arquivos; na dúvida, pergunte.
2. `prd/` só muda via `blip-promover`. `dev/` só muda via `blip-safe-save.mjs`.
3. Toda mudança termina com uma entrada em `spec/historico/AAAA-MM-DD.md`.
4. Segredos só em `collections/ambientes/`. Nunca escreva valor de chave em outro arquivo nem no chat.
5. Chamadas que alteram estado (set/delete/mensagem/publish) só com confirmação do usuário.
6. Todo JSON de fluxo segue a constituição (P-001…P-013) e passa no `blip-audit.mjs`.

## Scripts utilitários
- `node .agents/skills/blip-spec-driven/scripts/blip-audit.mjs <fluxo.json>` — auditoria mecânica.
- `node .agents/skills/blip-spec-driven/scripts/blip-safe-save.mjs <alvo.json> <novo.json> [--allow-delete id1,id2]` — gravação segura.
- `node .agents/skills/blip-consultar/scripts/blip-request.mjs …` — executa uma request de collection.
- `node .agents/skills/blip-testes/scripts/gerar-pdf.mjs <arquivo.md>` — markdown → PDF.

Todos rodam com Node 18+ e não têm dependências npm.
