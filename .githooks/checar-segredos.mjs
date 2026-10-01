#!/usr/bin/env node
/**
 * checar-segredos.mjs — procura chaves, tokens e senhas escritos em arquivos antes de irem para o git.
 *
 * Uso:
 *   node .githooks/checar-segredos.mjs --staged   (padrão; usado pelo hook pre-commit)
 *   node .githooks/checar-segredos.mjs --todos    (varre tudo que o git versionaria; rode antes do 1º commit)
 *
 * Achou algo? O commit é bloqueado e cada ocorrência aparece mascarada com arquivo e linha.
 * Correção: troque o valor por uma referência ({{resource.x}}, {{config.x}} no fluxo, ou {{variavel}}
 * na collection) e guarde o valor real em <CONTRATO>/collections/ambientes/.
 */

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const BINARY = /\.(pdf|png|jpe?g|gif|webp|svg|ico|zip|7z|rar|xlsx?|docx?|pptx?|mp[34]|wav|ogg|woff2?|ttf|excalidraw)$/i;
const PLACEHOLDER = /(PREENCHER|SEU_|SUA_|EXEMPLO|xxxx|\{\{)/i;
const MAX_BYTES = 15 * 1024 * 1024;

const RULES = [
  { name: 'chave Blip (Key …)', re: /Key\s+[A-Za-z0-9+/]{20,}={0,2}/g },
  { name: 'Bearer token', re: /Bearer\s+[A-Za-z0-9._~+/-]{20,}=*/g },
  { name: 'JWT', re: /eyJ[A-Za-z0-9_=-]{10,}\.[A-Za-z0-9_=-]{10,}(\.[A-Za-z0-9_=-]+)?/g },
  { name: 'chave privada', re: /-----BEGIN (RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g },
  {
    name: 'campo de segredo preenchido',
    re: /"(blipToken|routerKey|botKey|apiKey|api_key|accessToken|access_token|clientSecret|client_secret|password|senha|secret)"\s*:\s*"[^"\s]{8,}"/gi,
  },
  {
    name: 'variável Postman com valor de segredo',
    re: /"key"\s*:\s*"[^"]*(key|token|secret|senha|password|jwt|authorization)[^"]*"\s*,\s*"value"\s*:\s*"[^"]{12,}"/gi,
  },
];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

function gitBuffer(args) {
  return execFileSync('git', args, { maxBuffer: 256 * 1024 * 1024 });
}

function mask(text) {
  if (text.length <= 12) return '****';
  return `${text.slice(0, 6)}****`;
}

function listFiles(mode) {
  const out = mode === 'todos'
    ? git(['ls-files', '-co', '--exclude-standard', '-z'])
    : git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);
  return out.split('\0').filter(Boolean);
}

function readContent(file, mode) {
  try {
    const buf = mode === 'todos' ? fs.readFileSync(file) : gitBuffer(['show', `:${file}`]);
    if (buf.length > MAX_BYTES) return null;
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

function scan(file, content) {
  const findings = [];
  const lines = content.split(/\r?\n/);
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    for (let r = 0; r < RULES.length; r++) {
      const rule = RULES[r];
      rule.re.lastIndex = 0;
      let match = rule.re.exec(line);
      while (match !== null) {
        if (!PLACEHOLDER.test(match[0])) {
          findings.push({ file, line: l + 1, rule: rule.name, sample: mask(match[0]) });
        }
        match = rule.re.exec(line);
      }
    }
  }
  return findings;
}

function main() {
  const mode = process.argv.includes('--todos') ? 'todos' : 'staged';
  const files = listFiles(mode);
  const findings = [];
  for (let i = 0; i < files.length; i++) {
    if (BINARY.test(files[i])) continue;
    const content = readContent(files[i], mode);
    if (content === null) continue;
    const found = scan(files[i], content);
    for (let j = 0; j < found.length; j++) findings.push(found[j]);
  }

  if (findings.length === 0) {
    console.log(`🔒 checar-segredos: nenhum segredo encontrado (${files.length} arquivo(s) verificados).`);
    return;
  }

  console.error(`\n🚨 checar-segredos: ${findings.length} possível(is) segredo(s) — commit bloqueado.\n`);
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    console.error(`   ${f.file}:${f.line}  [${f.rule}]  ${f.sample}`);
  }
  console.error('\nComo resolver:');
  console.error('  • Fluxo Blip: troque a chave no header da ação HTTP por {{resource.<nome>}} ou {{config.<nome>}} no Studio, publique e exporte de novo.');
  console.error('  • Collection: troque o valor por {{variavel}} e guarde o valor em collections/ambientes/ (fora do git).');
  console.error('  • Falso positivo? Ajuste o texto (ex.: use PREENCHER) ou, em último caso, git commit --no-verify.\n');
  process.exit(1);
}

main();
