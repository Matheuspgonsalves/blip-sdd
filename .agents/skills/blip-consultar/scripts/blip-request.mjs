#!/usr/bin/env node
/**
 * blip-request.mjs — lista e executa requests de uma collection Postman (v2.1) com um ambiente.
 *
 * Listar / buscar:
 *   node blip-request.mjs <collection.json> --listar [--buscar "ticket"]
 *
 * Executar:
 *   node blip-request.mjs <collection.json> "<nome da request>" --ambiente <ambiente.json>
 *        [--var chave=valor ...] [--confirmar] [--saida resposta.json]
 *
 * Regras de segurança:
 *   - Requests de ESCRITA (command Blip com method set/merge/delete, envio em /messages ou /notifications,
 *     e qualquer POST/PUT/PATCH/DELETE fora dos commands do Blip) só rodam com --confirmar.
 *   - Headers nunca são impressos; valores de variáveis com nome de segredo são mascarados no resumo.
 *   - Variáveis {{...}} não resolvidas abortam a execução e são listadas.
 *
 * Resolução de variáveis (ordem de prioridade): --var > ambiente > variáveis da collection.
 * Dinâmicas suportadas: {{$guid}}, {{$timestamp}}, {{$isoTimestamp}}, {{$randomInt}}.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SECRET_NAME = /(key|token|secret|senha|password|authorization|auth|jwt|bearer)/i;

// ---------- leitura de collection e ambiente ----------

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

/** Achata a árvore da collection em [{ path, name, request, auth }], herdando auth de pastas. */
function flattenItems(items, parentPath, inheritedAuth, out) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemPath = parentPath ? `${parentPath} / ${item.name}` : item.name;
    const auth = item.auth || inheritedAuth;
    if (Array.isArray(item.item)) {
      flattenItems(item.item, itemPath, auth, out);
    } else if (item.request) {
      out.push({ path: itemPath, name: item.name, request: item.request, auth: item.request.auth || auth });
    }
  }
  return out;
}

function loadVariables(collection, environment, cliVars) {
  const vars = {};
  const collectionVars = collection.variable || [];
  for (let i = 0; i < collectionVars.length; i++) {
    vars[collectionVars[i].key] = collectionVars[i].value;
  }
  const envValues = (environment && environment.values) || [];
  for (let i = 0; i < envValues.length; i++) {
    if (envValues[i].enabled !== false) vars[envValues[i].key] = envValues[i].value;
  }
  const keys = Object.keys(cliVars);
  for (let i = 0; i < keys.length; i++) vars[keys[i]] = cliVars[keys[i]];
  return vars;
}

function resolve(text, vars, missing) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, name) => {
    if (name === '$guid') return randomUUID();
    if (name === '$timestamp') return String(Math.floor(Date.now() / 1000));
    if (name === '$isoTimestamp') return new Date().toISOString();
    if (name === '$randomInt') return String(Math.floor(Math.random() * 1001));
    if (Object.prototype.hasOwnProperty.call(vars, name) && vars[name] !== '' && vars[name] !== undefined) {
      return String(vars[name]);
    }
    missing.add(name);
    return match;
  });
}

// ---------- classificação leitura/escrita ----------

function rawUrl(request) {
  if (typeof request.url === 'string') return request.url;
  return (request.url && request.url.raw) || '';
}

function blipCommandMethod(request) {
  const raw = request.body && request.body.mode === 'raw' ? request.body.raw : null;
  if (!raw) return null;
  const match = raw.match(/"method"\s*:\s*"([a-zA-Z]+)"/);
  return match ? match[1].toLowerCase() : null;
}

function blipUri(request) {
  const raw = request.body && request.body.mode === 'raw' ? request.body.raw : null;
  if (!raw) return '';
  const match = raw.match(/"uri"\s*:\s*"([^"]*)"/);
  return match ? match[1] : '';
}

export function classify(request) {
  const url = rawUrl(request).toLowerCase();
  const httpMethod = (request.method || 'GET').toUpperCase();
  if (url.includes('/messages') || url.includes('/notifications')) return 'escrita';
  const commandMethod = blipCommandMethod(request);
  const isCommand = url.includes('/commands') || (commandMethod !== null && blipUri(request) !== '');
  if (isCommand) {
    return commandMethod === 'get' ? 'leitura' : 'escrita';
  }
  return httpMethod === 'GET' || httpMethod === 'HEAD' ? 'leitura' : 'escrita';
}

// ---------- montagem da request ----------

function buildAuthHeader(auth, vars, missing) {
  if (!auth || !auth.type || auth.type === 'noauth') return null;
  const params = {};
  const list = auth[auth.type] || [];
  for (let i = 0; i < list.length; i++) params[list[i].key] = resolve(list[i].value, vars, missing);
  if (auth.type === 'bearer') return ['Authorization', `Bearer ${params.token}`];
  if (auth.type === 'basic') {
    return ['Authorization', `Basic ${Buffer.from(`${params.username}:${params.password}`).toString('base64')}`];
  }
  if (auth.type === 'apikey' && (params.in || 'header') === 'header') return [params.key, params.value];
  return null;
}

function buildRequest(entry, vars) {
  const missing = new Set();
  const request = entry.request;
  const url = resolve(rawUrl(request), vars, missing);
  const headers = {};
  const headerList = request.header || [];
  for (let i = 0; i < headerList.length; i++) {
    if (headerList[i].disabled) continue;
    headers[headerList[i].key] = resolve(headerList[i].value, vars, missing);
  }
  const authHeader = buildAuthHeader(entry.auth, vars, missing);
  if (authHeader && !headers[authHeader[0]]) headers[authHeader[0]] = authHeader[1];

  let body;
  const b = request.body;
  if (b && b.mode === 'raw' && b.raw) {
    body = resolve(b.raw, vars, missing);
    const hasContentType = Object.keys(headers).some((h) => h.toLowerCase() === 'content-type');
    if (!hasContentType && /^\s*[[{]/.test(body)) headers['Content-Type'] = 'application/json';
  } else if (b && b.mode === 'urlencoded') {
    const form = new URLSearchParams();
    const fields = b.urlencoded || [];
    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].disabled) form.append(fields[i].key, resolve(fields[i].value, vars, missing));
    }
    body = form.toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (b && b.mode === 'formdata') {
    const fields = b.formdata || [];
    const form = new FormData();
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].disabled) continue;
      if (fields[i].type === 'file') {
        throw new Error(`A request usa upload de arquivo (campo "${fields[i].key}"); rode essa no Postman.`);
      }
      form.append(fields[i].key, resolve(fields[i].value, vars, missing));
    }
    body = form;
  }

  return { method: (request.method || 'GET').toUpperCase(), url, headers, body, missing };
}

// ---------- saída ----------

function maskedSummary(built, vars) {
  let bodyPreview = typeof built.body === 'string' ? built.body : '';
  const keys = Object.keys(vars);
  for (let i = 0; i < keys.length; i++) {
    const value = vars[keys[i]];
    if (SECRET_NAME.test(keys[i]) && typeof value === 'string' && value.length >= 8) {
      bodyPreview = bodyPreview.split(value).join('***');
    }
  }
  return `${built.method} ${built.url}${bodyPreview ? `\n${bodyPreview.slice(0, 1500)}` : ''}`;
}

function findEntries(entries, query) {
  const q = query.toLowerCase();
  const exact = [];
  const partial = [];
  for (let i = 0; i < entries.length; i++) {
    const name = entries[i].name.toLowerCase();
    const full = entries[i].path.toLowerCase();
    if (name === q || full === q) exact.push(entries[i]);
    else if (name.includes(q) || full.includes(q)) partial.push(entries[i]);
  }
  return exact.length > 0 ? exact : partial;
}

function listEntries(entries, search) {
  const filtered = search ? findEntries(entries, search) : entries;
  for (let i = 0; i < filtered.length; i++) {
    const e = filtered[i];
    const kind = classify(e.request) === 'leitura' ? 'L' : 'E';
    const cmd = blipCommandMethod(e.request);
    const uri = blipUri(e.request);
    const target = cmd && uri ? `${cmd} ${uri}` : `${e.request.method || 'GET'} ${rawUrl(e.request)}`;
    console.log(`[${kind}] ${e.path}  →  ${target}`);
  }
  console.log(`\n${filtered.length} request(s). [L] leitura roda direto · [E] escrita exige --confirmar`);
}

// ---------- main ----------

function parseArgs(argv) {
  const out = { positional: [], vars: {}, listar: false, buscar: null, ambiente: null, confirmar: false, saida: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--listar') out.listar = true;
    else if (a === '--buscar') out.buscar = argv[++i];
    else if (a === '--ambiente') out.ambiente = argv[++i];
    else if (a === '--confirmar') out.confirmar = true;
    else if (a === '--saida') out.saida = argv[++i];
    else if (a === '--var') {
      const pair = argv[++i] || '';
      const idx = pair.indexOf('=');
      if (idx > 0) out.vars[pair.slice(0, idx)] = pair.slice(idx + 1);
    } else out.positional.push(a);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.positional.length < 1) {
    console.log('Uso:\n  node blip-request.mjs <collection.json> --listar [--buscar termo]\n  node blip-request.mjs <collection.json> "<nome da request>" --ambiente <ambiente.json> [--var k=v] [--confirmar] [--saida arquivo.json]');
    process.exit(1);
  }

  const collection = readJson(args.positional[0]);
  const entries = flattenItems(collection.item || [], '', collection.auth || null, []);

  if (args.listar || args.positional.length < 2) {
    listEntries(entries, args.buscar);
    return;
  }

  const matches = findEntries(entries, args.positional[1]);
  if (matches.length === 0) {
    console.error(`❌ Nenhuma request com "${args.positional[1]}". Use --listar --buscar para procurar.`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error('❌ Mais de uma request corresponde. Use o caminho completo ("Pasta / Nome"):');
    for (let i = 0; i < matches.length; i++) console.error(`   - ${matches[i].path}`);
    process.exit(1);
  }

  const entry = matches[0];
  const environment = args.ambiente ? readJson(args.ambiente) : null;
  const vars = loadVariables(collection, environment, args.vars);
  const built = buildRequest(entry, vars);

  if (built.missing.size > 0) {
    console.error(`❌ Variáveis sem valor: ${Array.from(built.missing).join(', ')}`);
    console.error('   Preencha no ambiente ou passe com --var nome=valor.');
    process.exit(1);
  }

  const kind = classify(entry.request);
  console.log(`▶ ${entry.path}  [${kind}]`);
  console.log(maskedSummary(built, vars));

  if (kind === 'escrita' && !args.confirmar) {
    console.error('\n⛔ Request de ESCRITA não executada. Confirme com o usuário e rode de novo com --confirmar.');
    process.exit(2);
  }

  const response = await fetch(built.url, { method: built.method, headers: built.headers, body: built.method === 'GET' ? undefined : built.body });
  const text = await response.text();
  let pretty = text;
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // resposta não é JSON; mantém o texto
  }

  console.log(`\n◀ HTTP ${response.status}`);
  if (args.saida) {
    fs.writeFileSync(path.resolve(args.saida), pretty, 'utf8');
    console.log(`Resposta salva em ${path.resolve(args.saida)} (${pretty.length} caracteres).`);
  } else if (pretty.length > 20000) {
    console.log(`${pretty.slice(0, 20000)}\n… (resposta truncada; use --saida para gravar inteira)`);
  } else {
    console.log(pretty);
  }
  if (!response.ok) process.exit(3);
}

function isInvokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
  } catch {
    return false;
  }
}
const invokedDirectly = isInvokedDirectly();
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
}
