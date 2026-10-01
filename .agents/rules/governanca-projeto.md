---
trigger: always_on
description: Regras de organização e segurança dos contratos Blip neste workspace (prd/dev, histórico, segredos, collections).
---

# Governança dos Projetos Blip

## 1. Contrato ativo
- Cada pasta na raiz que não começa com `_` nem `.` é um **contrato** (cliente/projeto), ex.: `Ecovita/`, `Acme/`.
- **Exceção:** `CONTRATO/` é o modelo de onde os contratos são copiados. Nunca grave nela durante o trabalho de um cliente; ela só muda quando o usuário pedir para alterar o modelo.
- Antes de ler ou gravar qualquer coisa de projeto, descubra o contrato ativo pela conversa (nome do cliente, do bot, arquivo citado). Se houver dúvida entre dois, **pergunte** — nunca grave no contrato errado.
- Contrato sem pasta ainda? Use a skill `blip-novo-projeto`.

## 2. prd/ e dev/
| Pasta | O que é | Quem altera |
|---|---|---|
| `prd/` | Espelho exato do que está publicado em produção (JSON publicado, baixado da Blip ou exportado do Studio). | Só as skills `blip-mapear-router` (baixa a versão publicada) e `blip-promover` (depois que o usuário confirmar que publicou). |
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

## 5. Chamadas às APIs
### Blip: somente leitura, sempre
- O agente **só consulta** a Blip: commands `get` de leitura (contextos, contatos, tickets, filas, buckets, recursos, templates, flows).
- O agente **nunca** envia, publica, altera ou apaga nada na Blip pela API, **nem com pedido ou confirmação do usuário**: nada de `set`, `merge`, `delete`, envio em `/messages` ou `/notifications`, publicar/depreciar WhatsApp Flow, criar template, mudar ticket, resetar contexto, alterar recurso ou publicar fluxo do Builder.
- Quando algo precisa mudar na Blip, descreva ao usuário exatamente o quê e onde (bot, tela do portal, valor). Ele faz manualmente.
- Os scripts do kit reforçam isso: `blip-request.mjs` recusa qualquer escrita na Blip e `blip-router.mjs` só tem leitura.

### APIs do cliente
- Leitura (`GET`) pode ser executada direto.
- `POST/PUT/PATCH/DELETE` só com confirmação explícita do usuário a cada vez (alguns serviços usam `POST` para consulta). Ao pedir, diga: ambiente, request, o que muda e se dá para desfazer. Em `prd`, a confirmação é obrigatória mesmo que algo parecido já tenha sido confirmado antes.

## 6. Convenções de arquivo
- Datas em nome de arquivo: `AAAA-MM-DD`.
- Fluxos: nome do bot no Blip em minúsculas, sem espaços (`captacaodev.json`, `roteadorprd.json`).
- Features: `spec/features/<kebab-case>/` com `spec.md`, `design.md`, `tasks.md`.
- Checklists de teste em markdown (`- [ ]` / `- [x]`). PDF é sempre **gerado** a partir do markdown (skill `blip-testes`), nunca editado à mão.
- Scripts de investigação pontual (ex.: inspecionar um bloco) não ficam em `.agents/`; se forem úteis no projeto, vão para `<CONTRATO>/_scratch/`.
