---
trigger: always_on
description: Regras de organização e segurança dos contratos Blip neste workspace (prd/dev, histórico, segredos, collections).
---

# Governança dos Projetos Blip

## 1. Contrato ativo
- Cada pasta na raiz que não começa com `_` nem `.` é um **contrato** (cliente/projeto), ex.: `Acme/`, `Contoso/`.
- Antes de ler ou gravar qualquer coisa de projeto, descubra o contrato ativo pela conversa (nome do cliente, do bot, arquivo citado). Se houver dúvida entre dois, **pergunte** — nunca grave no contrato errado.
- Contrato sem pasta ainda? Use a skill `blip-novo-projeto`.

## 2. prd/ e dev/
| Pasta | O que é | Quem altera |
|---|---|---|
| `prd/` | Espelho exato do que está publicado em produção (JSON exportado do Studio). | Só a skill `blip-promover`, depois que o usuário confirmar que publicou. |
| `dev/` | Apenas os bots/flows que estão sendo alterados agora. | Skills `blip-spec-driven` e `blip-troubleshooter`, sempre via `blip-safe-save.mjs`. |

- Para alterar um bot que só existe em `prd/`, primeiro **copie** o JSON para `dev/fluxos/` com o sufixo/nome do bot de dev, depois altere a cópia.
- Nunca edite `prd/` para "testar". Nunca apague arquivos de `prd/`.
- O mesmo vale para `whatsapp-flows/` (JSON das telas de WhatsApp Flows).

## 3. Registro obrigatório (histórico)
Ao final de **qualquer** alteração em `dev/`, `spec/` ou `collections/`, acrescente uma entrada em `<CONTRATO>/spec/historico/AAAA-MM-DD.md` (data de hoje, fuso America/Sao_Paulo). Se o arquivo do dia não existir, crie a partir de `_templates/historico-dia.md`. Cada entrada tem:
- hora e título curto;
- **o que mudou** e **por quê** (pedido do usuário, bug, decisão);
- arquivos afetados;
- como testar / o que ficou pendente.

Nunca reescreva entradas antigas — só acrescente. Mudança estrutural (novo subbot, troca de topologia, padrão novo) também vira ADR numerada em `spec/DECISOES.md` (Contexto, Decisão, Consequência).

## 4. Segredos
- Chaves Blip, tokens, JWT, senhas e API keys ficam **somente** em `<CONTRATO>/collections/ambientes/*.postman_environment.json` (pasta fora do git).
- `RECURSOS.md`, specs, collections, relatórios e o chat citam o **nome da variável** (`{{Authorization}}`, `{{acme_jwt}}`), nunca o valor.
- Se encontrar um segredo em arquivo versionável (collection, markdown, JSON de exemplo), avise o usuário e proponha mover para `ambientes/`.
- Dados pessoais de teste (CPF, telefone, nome real) não vão para arquivos dentro de `_templates/`, `docs/` ou `.agents/`.

## 5. Chamadas às APIs (collections)
- Leitura (`"method": "get"` nos commands do Blip, `GET` em APIs do cliente) pode ser executada direto.
- **Precisa de confirmação explícita do usuário antes de executar:** `set`, `merge`, `delete`, envio de mensagem (`/messages`), publicar/depreciar WhatsApp Flow, criar/alterar template, mudar status de ticket, resetar contexto de usuário, e qualquer `POST/PUT/PATCH/DELETE` em API do cliente.
- Em `prd`, a confirmação é sempre obrigatória, mesmo que o usuário já tenha confirmado algo parecido antes na conversa.
- Ao pedir confirmação, diga: ambiente, request, o que muda e se dá para desfazer.

## 6. Convenções de arquivo
- Datas em nome de arquivo: `AAAA-MM-DD`.
- Fluxos: nome do bot no Blip em minúsculas, sem espaços (`captacaodev.json`, `roteadorprd.json`).
- Features: `spec/features/<kebab-case>/` com `spec.md`, `design.md`, `tasks.md`.
- Checklists de teste em markdown (`- [ ]` / `- [x]`). PDF é sempre **gerado** a partir do markdown (skill `blip-testes`), nunca editado à mão.
- Scripts de investigação pontual (ex.: inspecionar um bloco) não ficam em `.agents/`; se forem úteis no projeto, vão para `<CONTRATO>/_scratch/`.
