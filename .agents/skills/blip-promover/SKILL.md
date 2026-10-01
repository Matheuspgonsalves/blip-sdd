---
name: blip-promover
description: >-
  Atualiza o espelho de produção (prd/) depois que o usuário publicou no Blip Studio o que estava em dev/: traz o JSON publicado para prd/, faz backup da versão anterior, atualiza a ESPECIFICACAO.md, RECURSOS.md e o histórico. Use quando o usuário disser que publicou, subiu para produção, promoveu, ou pedir para atualizar o prd com o que está no dev.
---

# blip-promover

`prd/` é o espelho do que está **de fato** publicado. Esta skill é a única que escreve lá.

## 1. Confirmar o que foi publicado
Pergunte (se a mensagem não disser):
- quais bots/flows foram publicados;
- se o usuário **exportou o JSON do Studio de produção** depois de publicar (preferível) ou se publicou exatamente o arquivo de `dev/`.

O ideal é sempre usar o JSON exportado do bot de produção, porque o Studio pode ter recebido ajustes manuais. Se o usuário não tiver o exportado, use o arquivo de `dev/` e registre isso no histórico ("promovido a partir de dev/, sem export de produção").

## 2. Atenção à diferença dev × prd
Bots de dev e de prd são bots diferentes no Blip. Antes de copiar, compare o JSON de dev com o de prd anterior e liste ao usuário o que é **específico de ambiente** e precisa estar com o valor de produção:
- recursos/configs com URLs de dev (`dev`, `hml`, `sandbox`, `staging` no valor);
- identificadores de redirect (`...dev@msging.net`);
- chaves e IDs de flow/template diferentes por ambiente.

Se encontrar valor de dev indo para prd, **pare e pergunte**.

Procure também credencial escrita no JSON (header `Authorization: Key …` em ação HTTP, token em script): rode `node .githooks/checar-segredos.mjs --todos` depois de gravar. Se aparecer, o commit vai ser bloqueado; oriente o usuário a trocar a chave por `{{resource.<nome>}}` no Studio, publicar e exportar de novo (P-014).

## 3. Gravar em prd/
Use o safe-save com permissão de prd (a auditoria é opcional aqui, porque prd espelha o que existe, inclusive legado):
```bash
node .agents/skills/blip-spec-driven/scripts/blip-safe-save.mjs <CONTRATO>/prd/fluxos/<botprd>.json <json-publicado.json> --permitir-prd --sem-auditoria
```
- O backup da versão anterior fica em `<CONTRATO>/prd/_backups/`.
- Se a versão publicada removeu blocos de propósito, liste os IDs ao usuário e use `--allow-delete` com a autorização dele.
- WhatsApp Flows: copie o JSON de `dev/whatsapp-flows/` para `prd/whatsapp-flows/` (guardando a anterior em `prd/_backups/`).

## 4. Limpar dev/
Pergunte se o arquivo de `dev/fluxos/` pode ser **arquivado** (movido para `dev/_backups/`), já que agora está igual a prd. Não mova sem confirmação; o usuário pode continuar mexendo no mesmo bot.

## 5. Atualizar a documentação
- `spec/ESPECIFICACAO.md`: incorpore o que mudou (é o retrato do que está em produção).
- `prd/RECURSOS.md`: novos recursos/configs criados em produção (só nomes e URLs).
- `spec/features/<feature>/tasks.md`: marque a feature como publicada, com a data.
- `spec/historico/<hoje>.md`: entrada "Promovido para produção" com bots, origem (export ou dev/) e pendências.
