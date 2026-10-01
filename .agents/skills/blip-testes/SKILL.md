---
name: blip-testes
description: >-
  Cria e mantém os checklists de teste dos fluxos Blip (por feature/fase e regressão cumulativa), marca cenários como concluídos ou com falha, monta o relatório de testes a partir das evidências que o usuário enviar (prints, conversas do WhatsApp/BlipChat) e gera PDFs a partir dos markdowns. Use quando o usuário pedir checklist de testes, roteiro de testes, marcar teste como feito/ok/falhou, ver o que falta testar, gerar relatório de testes ou PDF de testes/checklist.
---

# blip-testes

O markdown é a fonte da verdade; o PDF é só exportação. Nunca edite PDF e nunca mantenha um script de PDF com conteúdo fixo dentro dele.

## Onde ficam os arquivos
```
<CONTRATO>/spec/testes/
├── checklists/
│   ├── <feature>-fase-01.md        ← cenários de uma fase/entrega
│   └── <feature>-regressao.md      ← soma cumulativa de todas as fases
└── relatorios/
    ├── AAAA-MM-DD-<feature>.md     ← resultado de uma rodada de testes
    └── AAAA-MM-DD-<feature>.pdf    ← exportado
```

## 1. Criar um checklist
Use `_templates/checklist-testes.md`. Para cada cenário:
- **ID** (`TC-001`), **Refs** (`AC-xxx` da spec), **canal** (BlipChat e/ou WhatsApp);
- pré-condição, passo a passo com as mensagens exatas do usuário, resultado esperado (bloco, mensagem, variáveis gravadas);
- linha de status em formato de tarefa: `- [ ] TC-001 — <nome curto>`.

Cubra sempre: caminho feliz, entradas inválidas (1ª e 2ª tentativa, P-003), transbordo, inatividade, comandos globais e as diferenças de canal (BlipChat não tem telefone nativo; WhatsApp tem BSUID/Meta). Gere os cenários a partir dos `AC-xxx` da `spec.md`: todo AC precisa de pelo menos um cenário (P-006).

Ao criar um checklist de fase, acrescente os cenários dele ao `<feature>-regressao.md` (sem duplicar IDs).

## 2. Marcar resultados
Quando o usuário disser "o teste 3 passou", "TC-005 falhou", "marca tudo da fase 2 como ok":
- `- [x] TC-003 — … ✅ (AAAA-MM-DD)` para aprovado;
- `- [ ] TC-005 — … ❌ falhou (AAAA-MM-DD): <o que aconteceu>` para falha (continua desmarcado);
- atualize o mesmo cenário no checklist da fase **e** no de regressão.
- Falha com comportamento inesperado → ofereça investigar com a skill `blip-troubleshooter`.
- Registre a rodada no `spec/historico/<hoje>.md`.

Para "o que falta testar?", liste os cenários `- [ ]` agrupados por feature, com o total.

## 3. Relatório de testes
Quando o usuário mandar evidências (prints, texto da conversa, export do BlipChat/WhatsApp):
1. Associe cada evidência a um cenário `TC-xxx` (pergunte se não der para saber qual é).
2. Escreva `relatorios/AAAA-MM-DD-<feature>.md` a partir de `_templates/relatorio-testes.md`: escopo, ambiente (dev/prd, bot, canal), tabela de resultados, falhas com descrição e próximo passo.
3. **Dados pessoais**: em vez de telefone, CPF ou nome real, use a versão mascarada (`+55 41 9****-1234`, `***.456.***-**`).
4. Atualize os checklists conforme o item 2.

## 4. Gerar PDF
```bash
node .agents/skills/blip-testes/scripts/gerar-pdf.mjs <arquivo.md> [saida.pdf] [--titulo "Relatório de Testes — Captação"]
```
- Sem saída informada, gera o `.pdf` ao lado do `.md`.
- Usa Edge/Chrome em modo headless (ou o caminho em `BLIP_PDF_BROWSER`).
- Checklists ganham uma barra de progresso automática no topo.
- Nome sugerido para anexar no ClickUp: `Relatorio_Testes_<Feature>_<DDMMAAAA>.pdf` e `Checklist_<Feature>_<DDMMAAAA>.pdf`.
