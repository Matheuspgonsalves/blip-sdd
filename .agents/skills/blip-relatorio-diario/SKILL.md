---
name: blip-relatorio-diario
description: >-
  Gera o relatório diário de entregas no padrão do ClickUp, em primeira pessoa, a partir do histórico do dia (spec/historico/AAAA-MM-DD.md), das tasks, dos checklists de teste e dos relatórios de testes do contrato. Use sempre que o usuário pedir o "relatório do dia", "relatório diário", "resumo do dia", "relatório pro ClickUp" ou "o que eu fiz hoje".
---

# Relatório Diário — padrão ClickUp

Transforma o registro técnico do dia em um texto que gestor e cliente entendem, pronto para colar no ClickUp.

## Princípios
1. **Primeira pessoa do singular**: "eu decidi", "eu entreguei", "meus próximos passos".
2. **Para quem não tem o contexto dos arquivos**: foco no comportamento do bot, nas decisões, no benefício e no status dos testes. Sem JSON, sem payload, sem nome de variável de script.
3. **Conciso**: tópicos curtos, sem enrolação.
4. **Só o que aconteceu**: tudo sai das fontes abaixo. Se a fonte não diz, não invente; pergunte.

## Fontes (contrato ativo, data de hoje no fuso America/Sao_Paulo)
1. `<CONTRATO>/spec/historico/AAAA-MM-DD.md` — fonte principal.
2. `<CONTRATO>/spec/features/*/tasks.md` — tarefas concluídas `[x]` e pendentes `[ ]`.
3. `<CONTRATO>/spec/testes/checklists/*.md` — cenários marcados hoje.
4. `<CONTRATO>/spec/testes/relatorios/` — relatórios (e PDFs) gerados hoje.

Se o usuário trabalhou em mais de um contrato no dia, pergunte se quer um relatório por contrato ou um consolidado (seções por cliente).
Se não houver histórico do dia, diga isso e peça ao usuário um resumo falado do que foi feito.

## Estrutura fixa (5 seções)

```markdown
📋 **Resumo: dia DD/MM**

**📌 Minha decisão de desenvolvimento hoje:**
* [1–2 parágrafos sobre a priorização do dia. Se algo foi pausado de propósito, explique o motivo e a ordem planejada.]

---

**🚀 O que eu entreguei hoje:**

* **[Bot ou funcionalidade]:**
  * **[Entrega 1]:** [o que mudou e como o bot se comporta agora]
  * **[Entrega 2]:** [benefício de negócio / UX]
  * **Auditoria aprovada:** [quando houve safe-save + blip-audit sem erros]

---

**📎 Documentos anexados (PDFs):**
* `Relatorio_Testes_[Feature]_[DDMMAAAA].pdf`
* `Checklist_[Feature]_[DDMMAAAA].pdf`

---

**🧪 Testes que realizei e homologuei hoje:**
* ✅ **[Teste 1]:** [resultado]
* ⏳ **[Teste pendente]:** [o que falta]

---

**⏳ Meus próximos passos:**
1. **[Próximo foco]:** [o que vem em seguida]
2. **[Etapa seguinte]:** […]
3. **[Retomada do que foi pausado]:** […]
```

Omita a seção de PDFs se nenhum foi gerado no dia (não liste arquivos que não existem).

## Procedimento
1. Coletar as fontes acima.
2. Se faltar PDF que o usuário vai anexar, oferecer gerar com a skill `blip-testes` (não gerar sem perguntar).
3. Redigir nas 5 seções.
4. Salvar em `<CONTRATO>/spec/relatorios-diarios/AAAA-MM-DD.md` (se já existir, atualizar o mesmo arquivo).
5. Mostrar o texto completo no chat, pronto para copiar, e perguntar se quer ajustes.
