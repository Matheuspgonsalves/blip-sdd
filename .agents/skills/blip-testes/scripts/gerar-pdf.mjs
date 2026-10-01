#!/usr/bin/env node
/**
 * gerar-pdf.mjs — converte um markdown de checklist/relatório de testes em PDF.
 *
 * Uso:
 *   node gerar-pdf.mjs <arquivo.md> [saida.pdf] [--titulo "Texto do cabeçalho"]
 *
 * - Sem dependências npm: o markdown vira HTML aqui mesmo e o PDF é impresso por um
 *   navegador Chromium em modo headless (Edge no Windows, Chrome/Chromium nos demais).
 * - Caminho do navegador pode ser forçado com a variável BLIP_PDF_BROWSER.
 * - Se a saída não for informada, gera <arquivo>.pdf ao lado do markdown.
 * - Checklists (- [ ] / - [x]) ganham um resumo de progresso no topo.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------- markdown -> html (subconjunto usado nos checklists e relatórios) ----------

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(text) {
  const codes = [];
  let out = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = escapeHtml(out)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`);
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|')) row = row.slice(0, -1);
  return row.split('|').map((cell) => cell.trim());
}

export function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const listStack = []; // { type: 'ul'|'ol', indent: number }
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeListsTo = (indent) => {
    while (listStack.length > 0 && listStack[listStack.length - 1].indent >= indent) {
      html.push(`</li></${listStack.pop().type}>`);
    }
  };
  const closeAllLists = () => closeListsTo(-1);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // bloco de código
    if (/^\s*```/.test(line)) {
      flushParagraph();
      closeAllLists();
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    // tabela
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph();
      closeAllLists();
      const header = splitRow(line);
      html.push('<table><thead><tr>');
      for (let c = 0; c < header.length; c++) html.push(`<th>${inline(header[c])}</th>`);
      html.push('</tr></thead><tbody>');
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        const cells = splitRow(lines[i]);
        html.push('<tr>');
        for (let c = 0; c < cells.length; c++) html.push(`<td>${inline(cells[c])}</td>`);
        html.push('</tr>');
        i++;
      }
      i--;
      html.push('</tbody></table>');
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeAllLists();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flushParagraph();
      closeAllLists();
      html.push('<hr>');
      continue;
    }

    if (/^\s*>/.test(line)) {
      flushParagraph();
      closeAllLists();
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      i--;
      html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }

    const item = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (item) {
      flushParagraph();
      const indent = item[1].replace(/\t/g, '    ').length;
      const type = /\d/.test(item[2]) ? 'ol' : 'ul';
      let content = item[3];

      const top = listStack[listStack.length - 1];
      if (!top || indent > top.indent) {
        html.push(`<${type}>`);
        listStack.push({ type, indent });
      } else {
        closeListsTo(indent + 1);
        const current = listStack[listStack.length - 1];
        if (!current || current.indent < indent) {
          html.push(`<${type}>`);
          listStack.push({ type, indent });
        } else {
          html.push('</li>');
        }
      }

      const task = content.match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        const done = task[1].toLowerCase() === 'x';
        content = `<span class="box ${done ? 'done' : 'todo'}">${done ? '✔' : ''}</span>${inline(task[2])}`;
        html.push(`<li class="task">${content}`);
      } else {
        html.push(`<li>${inline(content)}`);
      }
      continue;
    }

    // continuação de item de lista ou parágrafo comum
    if (listStack.length > 0 && /^\s+\S/.test(line)) {
      html.push(` ${inline(line.trim())}`);
      continue;
    }
    closeAllLists();
    paragraph.push(line.trim());
  }

  flushParagraph();
  closeAllLists();
  return html.join('\n');
}

// ---------- página ----------

function checklistSummary(markdown) {
  const done = (markdown.match(/^\s*[-*+]\s+\[[xX]\]/gm) || []).length;
  const todo = (markdown.match(/^\s*[-*+]\s+\[ \]/gm) || []).length;
  const total = done + todo;
  if (total === 0) return '';
  const percent = Math.round((done / total) * 100);
  return `<div class="summary"><div><strong>${done}</strong> de <strong>${total}</strong> concluídos · ${todo} pendente(s)</div>` +
    `<div class="bar"><span style="width:${percent}%"></span></div><div class="pct">${percent}%</div></div>`;
}

function buildPage(markdown, title) {
  const now = new Date();
  const generatedAt = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 12mm 12mm 14mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; font-size: 9.5pt; line-height: 1.45; margin: 0; }
  header { border-bottom: 3px solid #ff5500; padding-bottom: 6px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
  header .t { font-size: 13pt; font-weight: 800; color: #002b49; }
  header .d { font-size: 8pt; color: #64748b; }
  h1 { font-size: 15pt; color: #002b49; margin: 14px 0 6px; }
  h2 { font-size: 12pt; color: #002b49; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin: 16px 0 6px; page-break-after: avoid; }
  h3 { font-size: 10.5pt; color: #0f3d63; margin: 12px 0 4px; page-break-after: avoid; }
  h4, h5, h6 { font-size: 9.5pt; margin: 10px 0 4px; }
  p { margin: 4px 0 6px; }
  ul, ol { margin: 3px 0 6px; padding-left: 20px; }
  li { margin: 2px 0; }
  li.task { list-style: none; margin-left: -18px; }
  .box { display: inline-block; width: 11px; height: 11px; border: 1.5px solid #94a3b8; border-radius: 2px; margin-right: 6px; vertical-align: -1px; font-size: 8px; line-height: 9px; text-align: center; color: #fff; }
  .box.done { background: #16a34a; border-color: #16a34a; }
  code { font-family: Consolas, "Courier New", monospace; background: #f1f5f9; padding: 0 3px; border-radius: 3px; font-size: 8.5pt; }
  pre { background: #0f172a; color: #e2e8f0; padding: 8px 10px; border-radius: 5px; overflow: hidden; white-space: pre-wrap; font-size: 8pt; }
  pre code { background: none; color: inherit; padding: 0; }
  blockquote { margin: 6px 0; padding: 6px 10px; border-left: 3px solid #ff5500; background: #fff7ed; color: #7c2d12; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 8.5pt; page-break-inside: auto; }
  th { background: #002b49; color: #fff; text-align: left; padding: 4px 6px; }
  td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; vertical-align: top; }
  tr { page-break-inside: avoid; }
  hr { border: none; border-top: 1px dashed #cbd5e1; margin: 10px 0; }
  .summary { display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; }
  .summary .bar { flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
  .summary .bar span { display: block; height: 100%; background: #16a34a; }
  .summary .pct { font-weight: 700; color: #16a34a; }
  footer { margin-top: 16px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 7.5pt; color: #94a3b8; }
</style></head>
<body>
<header><div class="t">${escapeHtml(title)}</div><div class="d">Gerado em ${escapeHtml(generatedAt)}</div></header>
${checklistSummary(markdown)}
${markdownToHtml(markdown)}
<footer>Gerado a partir do markdown versionado no projeto (blip-testes / gerar-pdf.mjs).</footer>
</body></html>`;
}

// ---------- navegador ----------

function commandExists(cmd) {
  const probe = process.platform === 'win32' ? spawnSync('where', [cmd]) : spawnSync('which', [cmd]);
  if (probe.status !== 0) return null;
  const first = probe.stdout.toString().split(/\r?\n/)[0].trim();
  return first || null;
}

function findBrowser() {
  if (process.env.BLIP_PDF_BROWSER && fs.existsSync(process.env.BLIP_PDF_BROWSER)) {
    return process.env.BLIP_PDF_BROWSER;
  }
  const candidates = [];
  if (process.platform === 'win32') {
    const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA];
    for (let i = 0; i < roots.length; i++) {
      if (!roots[i]) continue;
      candidates.push(path.join(roots[i], 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
      candidates.push(path.join(roots[i], 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    candidates.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
  }
  for (let i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) return candidates[i];
  }
  const names = ['msedge', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
  for (let i = 0; i < names.length; i++) {
    const found = commandExists(names[i]);
    if (found) return found;
  }
  return null;
}

// ---------- main ----------

export function gerarPdf(mdPath, pdfPath, title) {
  const source = path.resolve(mdPath);
  const markdown = fs.readFileSync(source, 'utf8');
  const firstHeading = markdown.match(/^#\s+(.*)$/m);
  const pageTitle = title || (firstHeading ? firstHeading[1].replace(/[*`]/g, '') : path.basename(source, '.md'));
  const output = path.resolve(pdfPath || source.replace(/\.md$/i, '') + '.pdf');

  const browser = findBrowser();
  if (!browser) {
    throw new Error('Nenhum navegador Chromium encontrado (Edge/Chrome). Defina BLIP_PDF_BROWSER com o caminho do executável.');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blip-pdf-'));
  const tempHtml = path.join(tempDir, 'documento.html');
  fs.writeFileSync(tempHtml, buildPage(markdown, pageTitle), 'utf8');

  const args = ['--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer', `--print-to-pdf=${output}`, pathToFileURL(tempHtml).href];
  const result = spawnSync(browser, args, { stdio: 'pipe', timeout: 120000 });
  fs.rmSync(tempDir, { recursive: true, force: true });

  if (!fs.existsSync(output)) {
    const stderr = result.stderr ? result.stderr.toString().slice(0, 500) : '';
    throw new Error(`O navegador não gerou o PDF. ${stderr}`);
  }
  return output;
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
  const args = process.argv.slice(2);
  const positional = [];
  let title = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--titulo') {
      title = args[++i];
    } else {
      positional.push(args[i]);
    }
  }
  if (positional.length < 1) {
    console.log('Uso: node gerar-pdf.mjs <arquivo.md> [saida.pdf] [--titulo "Cabeçalho"]');
    process.exit(1);
  }
  try {
    const out = gerarPdf(positional[0], positional[1], title);
    console.log(`✅ PDF gerado: ${out}`);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}
