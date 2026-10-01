#!/usr/bin/env node
/**
 * blip-audit.mjs - Validador mecânico de integridade de JSON para Take Blip
 * Parte da skill blip-spec-driven
 */

import fs from 'fs';
import path from 'path';

function auditFlow(filePath) {
  console.log(`\n🔍 Auditando integridade mecânica de: ${filePath}\n`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ERRO: Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  let data;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ ERRO: JSON malformado ou inválido: ${err.message}`);
    process.exit(1);
  }

  const errors = [];
  const warnings = [];

  // 1. Checagem de atributos raiz
  if (!data.flow || typeof data.flow !== 'object') {
    errors.push('Atributo raiz "flow" ausente ou inválido.');
  }
  if (!data.globalActions) {
    warnings.push('Atributo raiz "globalActions" ausente.');
  }

  if (errors.length > 0) {
    printReport(errors, warnings);
    process.exit(1);
  }

  const flow = data.flow;
  const blockIds = Object.keys(flow);
  console.log(`📦 Total de blocos identificados: ${blockIds.length}`);

  // 2. Blocos obrigatórios
  if (!flow['onboarding']) {
    errors.push('Bloco obrigatório "onboarding" não encontrado.');
  } else {
    // Checagem inegociável: Root state MUST expect an input (bypass: false) — Cód. 64 Blip
    const onb = flow['onboarding'];
    const inputAction = (onb.$contentActions || []).find(ca => ca.input);
    if (!inputAction) {
      errors.push('Bloco raiz "onboarding" corrompido: ausente ação de entrada do usuário ($contentActions com input). Blip Cód. 64: "The root state must expect an input".');
    } else if (inputAction.input.bypass === true) {
      errors.push('Bloco raiz "onboarding" inválido: "bypass" configurado como true ("Não aguardar resposta"). A Take Blip exige "bypass: false" no root state. Blip Cód. 64: "The root state must expect an input".');
    }
  }
  if (!flow['fallback']) {
    errors.push('Bloco obrigatório "fallback" não encontrado.');
  }

  // 3. Conexões e saídas válidas
  const positions = new Map();
  const referencedStates = new Set(['onboarding', 'fallback']);

  for (const id of blockIds) {
    const block = flow[id];
    const title = block.$title || id;

    // Verificar sobreposição de posições ($position)
    if (block.$position) {
      const posKey = `${block.$position.top},${block.$position.left}`;
      if (positions.has(posKey)) {
        warnings.push(`Sobreposição visual detectada: bloco "${title}" (${id}) divide posição com "${positions.get(posKey)}".`);
      } else {
        positions.set(posKey, title);
      }
    }

    // Checar $defaultOutput
    if (block.$defaultOutput) {
      const target = block.$defaultOutput.stateId;
      if (block.$defaultOutput.typeOfStateId !== 'variable') {
        if (!flow[target]) {
          errors.push(`Conexão quebrada em "${title}": $defaultOutput aponta para stateId inexistente "${target}".`);
        } else {
          referencedStates.add(target);
        }
      }

      // Regra P-011: Saída Padrão ($defaultOutput) deve apontar para fallback (Exceções)
      // exceto em blocos GO TO e blocos de término de fluxo / redirect de subbot
      const isGotoBlock = (Array.isArray(block.$tags) && block.$tags.some(t => t.label === 'GO TO')) ||
                          (typeof block.$title === 'string' && block.$title.startsWith('[GO TO]'));
      
      const isTerminalOrRedirect = id === 'fallback' ||
                                   (block.$title && /FIM|temporario|SAC|Placeholder|Redirect/i.test(block.$title)) ||
                                   (block.$enteringCustomActions && block.$enteringCustomActions.some(a => a.type === 'Redirect')) ||
                                   (block.$leavingCustomActions && block.$leavingCustomActions.some(a => a.type === 'Redirect'));

      const isExceptionBot = path.basename(filePath).toLowerCase().includes('excec');
      const isContentOnly = !block.$contentActions || !block.$contentActions.some(ca => ca.input && ca.input.bypass === false);
      const isDeskBlock = id.startsWith('desk:') || (block.$title && /OBSERVAÇÕES/i.test(block.$title));

      if (!isGotoBlock && !isTerminalOrRedirect && !isDeskBlock) {
        if (target !== 'fallback') {
          // Blocos sem espera de entrada do usuário (bypass ou informativos) e exceções avançam linearmente
          if (!isContentOnly && !(isExceptionBot && /inatividade|persistente/i.test(title))) {
            errors.push(`Regra Anti-Loop violada em "${title}" (${id}): $defaultOutput aponta para "${target}". Todo bloco convencional com entrada de usuário deve ter Saída Padrão direcionada para "fallback" (Exceções).`);
          }
        }
      }
    } else {
      errors.push(`Bloco "${title}" (${id}) não possui $defaultOutput.`);
    }

    // Checar $conditionOutputs
    if (Array.isArray(block.$conditionOutputs)) {
      block.$conditionOutputs.forEach((cond, idx) => {
        const target = cond.stateId;
        if (cond.typeOfStateId !== 'variable') {
          if (!flow[target]) {
            errors.push(`Conexão quebrada em "${title}": condição [${idx}] aponta para stateId inexistente "${target}".`);
          } else {
            referencedStates.add(target);
          }
        }
      });
    }

    // Checar Ações de Script (PROIBIÇÃO DE '@', PROIBIÇÃO DE 'var', OBRIGATORIEDADE DE TRY/CATCH)
    const allActions = [
      ...(block.$enteringCustomActions || []),
      ...(block.$leavingCustomActions || [])
    ];

    allActions.forEach(act => {
      // P-014: nenhuma chave/token literal em headers de requisição HTTP
      if (act.type === 'ProcessHttp' && act.settings && act.settings.headers) {
        const headers = act.settings.headers;
        const headerNames = Object.keys(headers);
        for (let h = 0; h < headerNames.length; h++) {
          const value = String(headers[headerNames[h]] || '');
          if (/(Key|Bearer)\s+[A-Za-z0-9+/._-]{20,}/.test(value) || /eyJ[A-Za-z0-9_=-]{10,}\./.test(value)) {
            errors.push(`P-014: ação HTTP "${act.$title || act.type}" no bloco "${title}" (${id}) tem credencial escrita no header "${headerNames[h]}". Use {{resource.<nome>}} ou {{config.<nome>}}.`);
          }
        }
      }

      if (act.type === 'ExecuteScript' || act.type === 'ExecuteScriptV2') {
        const actTitle = act.$title || act.type;
        const inputVars = act.settings && act.settings.inputVariables;
        if (Array.isArray(inputVars)) {
          inputVars.forEach(v => {
            if (typeof v === 'string' && v.includes('@')) {
              errors.push(`Ação de script "${actTitle}" no bloco "${title}" (${id}) contém '@' na variável de entrada "${v}". A Blip invalida o bloco na hora! Passe a variável pai raiz (ex: "${v.split('@')[0]}") e acesse o campo via JSON.parse() dentro do JavaScript.`);
            }
          });
        }

        const source = act.settings && act.settings.source;
        if (source && typeof source === 'string') {
          // Checar se usa var
          if (/\bvar\s+/.test(source)) {
            errors.push(`Ação de script "${actTitle}" no bloco "${title}" (${id}) utiliza 'var'. Variáveis com escopo 'var' são proibidas: utilize sempre 'const' ou 'let'.`);
          }
          // Checar se possui try/catch
          if (!source.includes('try') || !source.includes('catch')) {
            errors.push(`Ação de script "${actTitle}" no bloco "${title}" (${id}) não possui bloco try/catch. Todo script deve conter try/catch defensivo.`);
          }
        }
      }
    });

    // Checar Blocos GO TO (desacoplamento visual de setas)
    const isGoto = (Array.isArray(block.$tags) && block.$tags.some(t => t.label === 'GO TO')) ||
                   (typeof block.$title === 'string' && block.$title.startsWith('[GO TO]'));

    if (isGoto) {
      if (Array.isArray(block.$conditionOutputs) && block.$conditionOutputs.length > 0) {
        errors.push(`Bloco GO TO "${title}" (${id}) possui $conditionOutputs preenchido. Blocos GO TO devem ter "$conditionOutputs": [] para evitar poluição visual de setas.`);
      }

      const inputAction = block.$contentActions && block.$contentActions.find(a => a.input)?.input;
      if (!inputAction || inputAction.bypass !== true) {
        errors.push(`Bloco GO TO "${title}" (${id}) deve ter "input.bypass": true para que a máquina de estados avance imediatamente.`);
      }

      if (!block.$defaultOutput || !block.$defaultOutput.stateId) {
        errors.push(`Bloco GO TO "${title}" (${id}) não possui $defaultOutput válido.`);
      } else {
        const targetId = block.$defaultOutput.stateId;
        const targetBlock = flow[targetId];
        if (!targetBlock) {
          errors.push(`Bloco GO TO "${title}" (${id}) aponta para bloco inexistente "${targetId}".`);
        }
      }
    }
  }


  // 4. Detecção de blocos órfãos (alcançabilidade a partir de onboarding)
  const reachable = new Set(['onboarding']);
  const queue = ['onboarding'];

  while (queue.length > 0) {
    const currId = queue.shift();
    const currBlock = flow[currId];
    if (!currBlock) continue;

    const targets = [];
    if (currBlock.$defaultOutput && currBlock.$defaultOutput.typeOfStateId !== 'variable') {
      targets.push(currBlock.$defaultOutput.stateId);
    }
    if (Array.isArray(currBlock.$conditionOutputs)) {
      currBlock.$conditionOutputs.forEach(c => {
        if (c.typeOfStateId !== 'variable') targets.push(c.stateId);
      });
    }

    for (const t of targets) {
      if (flow[t] && !reachable.has(t)) {
        reachable.add(t);
        queue.push(t);
      }
    }
  }

  // Fallback e blocos especiais podem não ser alcançados diretamente pelo grafo comum
  reachable.add('fallback');

  for (const id of blockIds) {
    if (!reachable.has(id)) {
      const title = flow[id].$title || id;
      warnings.push(`Bloco órfão (inalcançável a partir do onboarding): "${title}" (${id}).`);
    }
  }

  printReport(errors, warnings);

  if (errors.length > 0) {
    process.exit(1);
  } else {
    console.log('✅ AUDITORIA MECÂNICA APROVADA: Fluxo 100% íntegro para importação no Blip Studio!\n');
    process.exit(0);
  }
}

function printReport(errors, warnings) {
  if (warnings.length > 0) {
    console.log(`⚠️  AVISOS (${warnings.length}):`);
    warnings.forEach(w => console.log(`   - ${w}`));
    console.log('');
  }
  if (errors.length > 0) {
    console.log(`❌ ERROS CRÍTICOS (${errors.length}):`);
    errors.forEach(e => console.log(`   - ${e}`));
    console.log('');
  }
}

const targetFile = process.argv[2];
if (!targetFile) {
  console.log('Uso: node .agents/skills/blip-spec-driven/scripts/blip-audit.mjs <caminho-do-fluxo.json>');
  process.exit(1);
}

auditFlow(path.resolve(targetFile));
