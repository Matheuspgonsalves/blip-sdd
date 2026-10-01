#!/usr/bin/env node
/**
 * blip-router.mjs — lê da Blip (SÓ LEITURA) os fluxos dos bots de um contrato e mapeia o router.
 *
 * Este script só envia commands com "method": "get". Não existe opção para escrever,
 * publicar ou enviar nada à Blip — isso é feito manualmente pelo usuário no portal.
 *
 * Subcomandos (rode a partir da raiz do workspace):
 *
 *   descobrir --ambiente <env.json>
 *       Para cada chave do ambiente (Authorization e key_*), identifica o bot dono da chave
 *       (get /account) e se ele tem fluxo do Builder (get /buckets). Também tenta, de forma
 *       experimental, ler as configurações do roteador (get /configurations).
 *
 *   buckets --ambiente <env.json> --chave <variavel>
 *       Lista os documentos (buckets) do bot dono da chave.
 *
 *   baixar --ambiente <env.json> --contrato <pasta> [--chave key_<bot> ...] [--versao publicada|rascunho]
 *          [--aceitar-remocoes]
 *       Baixa fluxo + ações globais (+ subflows, se houver) de cada bot e grava em
 *       <contrato>/prd/fluxos/<identificador>.json no mesmo formato do export do Studio,
 *       via safe-save (backup da versão anterior em prd/_backups/).
 *       Sem --chave, baixa todos os bots com variável key_<identificador> no ambiente.
 *       --versao publicada (padrão) usa os buckets "published"; se não existirem, para e avisa.
 *
 *   topologia --contrato <pasta> [--saida arquivo.md]
 *       Lê os JSONs de <contrato>/prd/fluxos/ e lista, por bot, para quais serviços do router
 *       ele redireciona (ações Redirect), gerando tabela + diagrama Mermaid.
 *
 * Convenção do ambiente (collections/ambientes/prd.postman_environment.json):
 *   blip_url             https://<contrato>.http.msging.net
 *   Authorization        Key … do ROTEADOR
 *   key_<identificador>  Key … de cada bot, onde <identificador> é o nome do bot no Blip
 *                        (ex.: key_ecovitacaptacaodev). Vira o nome do arquivo baixado.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { safeSaveFlow } from '../../blip-spec-driven/scripts/blip-safe-save.mjs';

const BUILDER_PREFIX = 'blip_portal:builder_';
const EXPORT_KEYS = { flow: 'flow', global_actions: 'globalActions', subflows: 'subflows' };
const CREDENTIAL = /(Key\s+[A-Za-z0-9+/]{20,}={0,2}|Bearer\s+[A-Za-z0-9._-]{20,}|eyJ[A-Za-z0-9_=-]{10,}\.[A-Za-z0-9_=-]{10,})/g;

// ---------- utilidades ----------

function parseArgs(argv) {
  const out = { _: [], chaves: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--chave') out.chaves.push(argv[++i]);
    else if (a === '--aceitar-remocoes') out.aceitarRemocoes = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}

function loadEnvironment(file) {
  if (!file) throw new Error('Informe --ambiente <arquivo .postman_environment.json>.');
  const env = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const vars = {};
  const values = env.values || [];
  for (let i = 0; i < values.length; i++) {
    if (values[i].enabled !== false && values[i].value) vars[values[i].key] = String(values[i].value);
  }
  if (!vars.blip_url || /PREENCHER/i.test(vars.blip_url)) {
    throw new Error('O ambiente não tem "blip_url" preenchida (ex.: https://<contrato>.http.msging.net).');
  }
  return vars;
}

function keyHeader(value) {
  return /^(Key|Bearer)\s/i.test(value) ? value : `Key ${value}`;
}

function botKeys(vars) {
  const names = Object.keys(vars);
  const out = [];
  for (let i = 0; i < names.length; i++) {
    if (names[i].startsWith('key_') && !/PREENCHER/i.test(vars[names[i]])) out.push(names[i]);
  }
  return out;
}

/** Envia um command de LEITURA. Não há caminho no script para outro method. */
async function getCommand(vars, keyVar, uri) {
  const key = vars[keyVar];
  if (!key || /PREENCHER/i.test(key)) throw new Error(`A variável "${keyVar}" não está preenchida no ambiente.`);
  const body = { id: randomUUID(), to: 'postmaster@msging.net', method: 'get', uri };
  const res = await fetch(`${vars.blip_url.replace(/\/+$/, '')}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: keyHeader(key) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // resposta não é JSON
  }
  if (!res.ok) return { ok: false, http: res.status, reason: text.slice(0, 200) };
  if (!json || json.status !== 'success') {
    const reason = json && json.reason ? `${json.reason.code}: ${json.reason.description}` : text.slice(0, 200);
    return { ok: false, http: res.status, reason };
  }
  return { ok: true, resource: json.resource };
}

function asObject(resource) {
  if (typeof resource === 'string') {
    try {
      return JSON.parse(resource);
    } catch {
      return resource;
    }
  }
  return resource;
}

async function listBuckets(vars, keyVar) {
  const keys = [];
  let skip = 0;
  for (let page = 0; page < 50; page++) {
    const r = await getCommand(vars, keyVar, `/buckets?$skip=${skip}&$take=100`);
    if (!r.ok) {
      if (page === 0) throw new Error(`Não consegui listar os buckets com "${keyVar}" (${r.reason}).`);
      break;
    }
    const items = (r.resource && r.resource.items) || [];
    for (let i = 0; i < items.length; i++) keys.push(items[i]);
    if (items.length < 100) break;
    skip += 100;
  }
  return keys;
}

function identifierFromKey(keyVar) {
  return keyVar.replace(/^key_/, '');
}

// ---------- subcomandos ----------

async function descobrir(args) {
  const vars = loadEnvironment(args.ambiente);
  const keyVars = ['Authorization'].concat(botKeys(vars));
  console.log('Chave → bot → tem fluxo do Builder?\n');
  for (let i = 0; i < keyVars.length; i++) {
    const kv = keyVars[i];
    if (!vars[kv]) continue;
    const account = await getCommand(vars, kv, '/account');
    const name = account.ok && account.resource ? (account.resource.fullName || account.resource.identity || '?') : `erro (${account.reason})`;
    let builder = '?';
    try {
      const buckets = await listBuckets(vars, kv);
      const flows = buckets.filter((b) => /^blip_portal:builder_(published|working)_flow$/.test(b));
      builder = flows.length > 0 ? `sim (${flows.map((f) => f.replace(BUILDER_PREFIX, '')).join(', ')})` : 'não (pode ser um roteador)';
    } catch (err) {
      builder = `erro (${err.message})`;
    }
    console.log(`- ${kv}: ${name} — ${builder}`);
  }

  console.log('\n[experimental] Configurações do roteador (get /configurations com Authorization):');
  const conf = await getCommand(vars, 'Authorization', '/configurations');
  if (conf.ok) {
    const resource = asObject(conf.resource);
    const preview = JSON.stringify(resource, null, 2).replace(CREDENTIAL, '***');
    console.log(preview.length > 4000 ? `${preview.slice(0, 4000)}\n… (truncado)` : preview);
  } else {
    console.log(`   não disponível (${conf.reason}). Use o print da tela de serviços do roteador no portal.`);
  }
}

async function buckets(args) {
  const vars = loadEnvironment(args.ambiente);
  const keyVar = args.chaves[0] || 'Authorization';
  const keys = await listBuckets(vars, keyVar);
  for (let i = 0; i < keys.length; i++) console.log(keys[i]);
  console.log(`\n${keys.length} bucket(s) para ${keyVar}.`);
}

async function baixar(args) {
  const vars = loadEnvironment(args.ambiente);
  if (!args.contrato) throw new Error('Informe --contrato <pasta do contrato>.');
  const versao = args.versao || 'publicada';
  if (versao !== 'publicada' && versao !== 'rascunho') throw new Error('--versao deve ser "publicada" ou "rascunho".');
  const stage = versao === 'publicada' ? 'published' : 'working';

  const keyVars = args.chaves.length > 0 ? args.chaves : botKeys(vars);
  if (keyVars.length === 0) throw new Error('Nenhuma variável key_<bot> preenchida no ambiente.');

  const destDir = path.resolve(args.contrato, 'prd', 'fluxos');
  const scratch = path.resolve(args.contrato, '_scratch');
  fs.mkdirSync(scratch, { recursive: true });
  const summary = [];

  for (let i = 0; i < keyVars.length; i++) {
    const kv = keyVars[i];
    const id = identifierFromKey(kv);
    console.log(`\n=== ${id} (${kv}) ===`);
    try {
      const available = await listBuckets(vars, kv);
      const wanted = Object.keys(EXPORT_KEYS);
      const exported = {};
      for (let j = 0; j < wanted.length; j++) {
        const bucket = `${BUILDER_PREFIX}${stage}_${wanted[j]}`;
        if (!available.includes(bucket)) continue;
        const r = await getCommand(vars, kv, `/buckets/${bucket}`);
        if (!r.ok) throw new Error(`falha ao ler ${bucket} (${r.reason})`);
        exported[EXPORT_KEYS[wanted[j]]] = asObject(r.resource);
      }

      if (!exported.flow || typeof exported.flow !== 'object') {
        const others = available.filter((b) => b.startsWith(BUILDER_PREFIX));
        throw new Error(`não há "${BUILDER_PREFIX}${stage}_flow" para este bot. Buckets do Builder encontrados: ${others.join(', ') || 'nenhum'}.` +
          (stage === 'published' ? ' Se o bot nunca foi publicado por esse caminho, confirme com o usuário antes de usar --versao rascunho.' : ''));
      }
      if (!exported.globalActions) exported.globalActions = {};

      // Buckets do Builder desta versão que o script não sabe mapear (ex.: outro nome para subflows)
      const mapped = wanted.map((w) => `${BUILDER_PREFIX}${stage}_${w}`);
      const unmapped = available.filter((b) => b.startsWith(`${BUILDER_PREFIX}${stage}_`) && !mapped.includes(b));

      const target = path.join(destDir, `${id}.json`);
      const tmp = path.join(scratch, `${id}.baixado.json`);
      fs.writeFileSync(tmp, JSON.stringify(exported, null, 2), 'utf8');

      let allowDelete = [];
      if (fs.existsSync(target)) {
        const current = JSON.parse(fs.readFileSync(target, 'utf8')).flow || {};
        const removed = Object.keys(current).filter((b) => !(b in exported.flow));
        if (removed.length > 0 && !args.aceitarRemocoes) {
          throw new Error(`a versão da Blip não tem ${removed.length} bloco(s) que existem no prd/ local: ${removed.slice(0, 10).join(', ')}${removed.length > 10 ? '…' : ''}. ` +
            'Mostre ao usuário e, com o ok dele, rode de novo com --aceitar-remocoes.');
        }
        allowDelete = removed;
      }

      safeSaveFlow(target, exported, { permitirPrd: true, semAuditoria: true, allowDelete });

      const creds = (JSON.stringify(exported).match(CREDENTIAL) || []).length;
      summary.push({ id, ok: true, blocks: Object.keys(exported.flow).length, subflows: Boolean(exported.subflows), creds, unmapped });
    } catch (err) {
      console.error(`❌ ${id}: ${err.message}`);
      summary.push({ id, ok: false, error: err.message });
    }
  }

  console.log('\n=== Resumo ===');
  for (let i = 0; i < summary.length; i++) {
    const s = summary[i];
    if (s.ok) {
      console.log(`✅ ${s.id}: ${s.blocks} blocos${s.subflows ? ', com subflows' : ''} → prd/fluxos/${s.id}.json` +
        (s.creds > 0 ? `  ⚠️ ${s.creds} credencial(is) escrita(s) no fluxo (P-014)` : '') +
        (s.unmapped.length > 0 ? `\n   ⚠️ buckets do Builder não incluídos no arquivo: ${s.unmapped.join(', ')} — compare com um export do Studio antes de confiar 100%` : ''));
    } else {
      console.log(`❌ ${s.id}: ${s.error}`);
    }
  }
  if (summary.some((s) => !s.ok)) process.exitCode = 1;
}

function topologia(args) {
  if (!args.contrato) throw new Error('Informe --contrato <pasta do contrato>.');
  const dir = path.resolve(args.contrato, 'prd', 'fluxos');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const lines = ['| Bot (arquivo) | Redireciona para o serviço | Blocos que redirecionam |', '|---|---|---|'];
  const edges = [];

  for (let i = 0; i < files.length; i++) {
    const bot = files[i].replace(/\.json$/, '');
    const data = JSON.parse(fs.readFileSync(path.join(dir, files[i]), 'utf8'));
    const flow = data.flow || {};
    const targets = {};
    const ids = Object.keys(flow);
    for (let j = 0; j < ids.length; j++) {
      const block = flow[ids[j]];
      const actions = (block.$enteringCustomActions || []).concat(block.$leavingCustomActions || []);
      for (let k = 0; k < actions.length; k++) {
        if (actions[k].type !== 'Redirect' || !actions[k].settings) continue;
        const address = actions[k].settings.address || '?';
        if (!targets[address]) targets[address] = [];
        targets[address].push(block.$title || ids[j]);
      }
    }
    const services = Object.keys(targets).sort();
    if (services.length === 0) lines.push(`| \`${bot}\` | — | — |`);
    for (let s = 0; s < services.length; s++) {
      const blocks = Array.from(new Set(targets[services[s]]));
      lines.push(`| \`${bot}\` | \`${services[s]}\` | ${blocks.slice(0, 4).join('; ')}${blocks.length > 4 ? ` (+${blocks.length - 4})` : ''} |`);
      edges.push([bot, services[s]]);
    }
  }

  const mermaid = ['```mermaid', 'flowchart LR'];
  for (let i = 0; i < edges.length; i++) {
    const from = edges[i][0].replace(/[^A-Za-z0-9_]/g, '_');
    const to = `svc_${edges[i][1].replace(/[^A-Za-z0-9_]/g, '_')}`;
    mermaid.push(`  ${from}["${edges[i][0]}"] --> ${to}(["serviço: ${edges[i][1]}"])`);
  }
  mermaid.push('```');

  const output = `## Redirecionamentos encontrados em prd/fluxos/\n\n${lines.join('\n')}\n\n${mermaid.join('\n')}\n\n` +
    '> Os nomes à direita são **serviços do router**. Para saber qual bot atende cada serviço, use a tela de serviços do roteador no portal (ou `descobrir`).\n';
  if (args.saida) {
    fs.writeFileSync(path.resolve(args.saida), output, 'utf8');
    console.log(`Topologia salva em ${path.resolve(args.saida)}`);
  } else {
    console.log(output);
  }
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (cmd === 'descobrir') return descobrir(args);
  if (cmd === 'buckets') return buckets(args);
  if (cmd === 'baixar') return baixar(args);
  if (cmd === 'topologia') return topologia(args);
  console.log('Uso: node blip-router.mjs <descobrir|buckets|baixar|topologia> [opções]  (detalhes no topo do arquivo)');
  process.exitCode = 1;
}

function isInvokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  main().catch((err) => {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
}
