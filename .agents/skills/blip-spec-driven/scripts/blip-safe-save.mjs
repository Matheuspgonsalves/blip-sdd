#!/usr/bin/env node
/**
 * blip-safe-save.mjs — gravação segura de fluxos Blip (Constituição P-012)
 *
 * Uso:
 *   node blip-safe-save.mjs <alvo.json> <novo.json> [--allow-delete id1,id2] [--permitir-prd] [--sem-auditoria]
 *
 * O que faz:
 *   1. Relê o alvo do disco (nunca usa cópia em memória).
 *   2. Bloqueia a gravação se algum bloco existente sumir sem estar em --allow-delete.
 *   3. Faz backup com timestamp em <dev|prd>/_backups/ (pasta irmã de fluxos/).
 *   4. Grava o novo conteúdo formatado.
 *   5. Roda blip-audit.mjs e faz rollback automático se a auditoria reprovar.
 *
 * Proteções:
 *   - Gravar dentro de uma pasta prd/ exige --permitir-prd (usado só pela skill blip-promover).
 *   - --sem-auditoria só é aceito junto com --permitir-prd (prd espelha o que foi publicado, mesmo legado).
 *   - Se o alvo ainda não existe, cria o arquivo (bot novo); em caso de auditoria reprovada, remove o arquivo criado.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_SCRIPT = path.join(SCRIPT_DIR, 'blip-audit.mjs');

function pad(n) {
  return String(n).padStart(2, '0');
}

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Sobe a árvore a partir do alvo procurando a pasta de ambiente (dev/ ou prd/). */
function findEnvironmentDir(targetPath) {
  const parts = path.resolve(targetPath).split(path.sep);
  for (let i = parts.length - 2; i >= 0; i--) {
    const name = parts[i].toLowerCase();
    if (name === 'dev' || name === 'prd') {
      return { dir: parts.slice(0, i + 1).join(path.sep) || path.sep, env: name };
    }
  }
  return { dir: path.dirname(path.resolve(targetPath)), env: null };
}

function blockTitle(flow, id) {
  const block = flow[id];
  return (block && block.$title) || id;
}

function runAudit(filePath) {
  if (!fs.existsSync(AUDIT_SCRIPT)) {
    console.warn(`⚠️  blip-audit.mjs não encontrado em ${AUDIT_SCRIPT}; auditoria pulada.`);
    return true;
  }
  const result = spawnSync(process.execPath, [AUDIT_SCRIPT, filePath], { stdio: 'inherit' });
  return result.status === 0;
}

export function safeSaveFlow(targetFilePath, newFlowData, options = {}) {
  const target = path.resolve(targetFilePath);
  const allowDelete = new Set(options.allowDelete || []);
  const { dir: envDir, env } = findEnvironmentDir(target);

  if (env === 'prd' && !options.permitirPrd) {
    throw new Error('Gravação em prd/ bloqueada. prd/ só muda pela skill blip-promover (use --permitir-prd).');
  }
  if (options.semAuditoria && !options.permitirPrd) {
    throw new Error('--sem-auditoria só é permitido junto com --permitir-prd.');
  }
  if (!newFlowData || typeof newFlowData.flow !== 'object') {
    throw new Error('O novo conteúdo não tem o atributo raiz "flow".');
  }

  const isNewFile = !fs.existsSync(target);
  let rawCurrent = null;
  let currentFlow = {};

  if (!isNewFile) {
    // 1. Leitura fresca do disco
    rawCurrent = fs.readFileSync(target, 'utf8');
    try {
      currentFlow = JSON.parse(rawCurrent).flow || {};
    } catch (err) {
      throw new Error(`O arquivo atual no disco tem JSON inválido: ${err.message}`);
    }
  }

  const newFlow = newFlowData.flow;
  const currentIds = Object.keys(currentFlow);
  const newIds = Object.keys(newFlow);

  // 2. Trava anti-perda de blocos
  const removed = [];
  for (let i = 0; i < currentIds.length; i++) {
    const id = currentIds[i];
    if (!(id in newFlow) && !allowDelete.has(id)) {
      removed.push(id);
    }
  }
  if (removed.length > 0) {
    console.error(`\n🚨 P-012: tentativa de remover ${removed.length} bloco(s) existente(s) sem autorização:`);
    for (let i = 0; i < removed.length; i++) {
      console.error(`   ❌ "${blockTitle(currentFlow, removed[i])}" (id: ${removed[i]})`);
    }
    console.error('\nNada foi gravado. Para remover de propósito, peça autorização ao usuário e use --allow-delete.\n');
    throw new Error('Deleção de blocos não autorizada.');
  }

  // 3. Backup
  if (!isNewFile) {
    const backupDir = path.join(envDir, '_backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `${path.basename(target, '.json')}_backup_${timestamp()}.json`);
    fs.writeFileSync(backupPath, rawCurrent, 'utf8');
    console.log(`\n🛡️  Backup: ${backupPath}`);
  }

  // 4. Gravação
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(newFlowData, null, 2), 'utf8');

  let added = 0;
  let modified = 0;
  for (let i = 0; i < newIds.length; i++) {
    const id = newIds[i];
    if (!(id in currentFlow)) {
      added++;
    } else if (JSON.stringify(currentFlow[id]) !== JSON.stringify(newFlow[id])) {
      modified++;
    }
  }
  const deleted = currentIds.length - (newIds.length - added);
  console.log('\n📊 Resumo:');
  console.log(`   blocos antes: ${currentIds.length} | depois: ${newIds.length}`);
  console.log(`   adicionados: ${added} | modificados: ${modified} | removidos (autorizados): ${deleted}`);

  // 5. Auditoria com rollback
  if (!options.semAuditoria) {
    const ok = runAudit(target);
    if (!ok) {
      if (isNewFile) {
        fs.rmSync(target, { force: true });
        console.error('\n⏪ Auditoria reprovada: arquivo novo removido. Corrija e grave de novo.');
      } else {
        fs.writeFileSync(target, rawCurrent, 'utf8');
        console.error('\n⏪ Auditoria reprovada: arquivo restaurado ao estado anterior.');
      }
      throw new Error('Auditoria mecânica reprovada.');
    }
  }

  console.log(`\n✅ Salvo com segurança: ${target}\n`);
  return true;
}

function parseArgs(argv) {
  const positional = [];
  const options = { allowDelete: [], permitirPrd: false, semAuditoria: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--permitir-prd') {
      options.permitirPrd = true;
    } else if (arg === '--sem-auditoria') {
      options.semAuditoria = true;
    } else if (arg.startsWith('--allow-delete')) {
      const value = arg.includes('=') ? arg.split('=')[1] : argv[++i];
      if (value) {
        const ids = value.split(',');
        for (let j = 0; j < ids.length; j++) {
          if (ids[j].trim()) options.allowDelete.push(ids[j].trim());
        }
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, options };
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
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (positional.length < 2) {
    console.log('Uso: node blip-safe-save.mjs <alvo.json> <novo.json> [--allow-delete id1,id2] [--permitir-prd] [--sem-auditoria]');
    process.exit(1);
  }
  try {
    const newContent = JSON.parse(fs.readFileSync(path.resolve(positional[1]), 'utf8'));
    safeSaveFlow(positional[0], newContent, options);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}
