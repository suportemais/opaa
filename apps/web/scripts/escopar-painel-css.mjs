// Gera src/styles/painel.css a partir do painel.css do protótipo, com todo seletor sob .painel
// (mesmo padrão do site.css). Uso: node scripts/escopar-painel-css.mjs <painel.css do protótipo>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const origem = process.argv[2];
if (!origem) {
  console.error('uso: node scripts/escopar-painel-css.mjs <caminho/painel.css>');
  process.exit(1);
}
const destino = fileURLToPath(new URL('../src/styles/painel.css', import.meta.url));
const S = '.painel';

function escopa(sel) {
  sel = sel.trim();
  // :root / html / body viram o próprio wrapper
  if (/^(:root|html|body)\b/.test(sel)) return sel.replace(/^(:root|html|body)/, S);
  // reset global vira reset dentro do wrapper
  if (sel.startsWith('*')) return `${S} ${sel}`;
  return `${S} ${sel}`;
}

const kf = new Set();
const root = postcss.parse(readFileSync(origem, 'utf8'));
root.walkAtRules('keyframes', (r) => {
  kf.add(r.params);
  r.params = `pn-${r.params}`;
});
root.walkRules((rule) => {
  if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
  rule.selectors = rule.selectors.map(escopa);
});
root.walkDecls(/^animation(-name)?$/, (d) => {
  d.value = d.value.replace(/[\w-]+/g, (w) => (kf.has(w) ? `pn-${w}` : w));
});

const cab = `/* Gerado por scripts/escopar-painel-css.mjs a partir do painel.css do protótipo.
   Todo seletor fica sob .painel para não vazar para o site nem para o /admin.
   Keyframes prefixados com pn-. Edite aqui à vontade; o script é só o ponto de partida. */\n\n`;
writeFileSync(destino, cab + root.toString());
console.log(`ok: ${destino} (${kf.size} keyframes prefixados)`);
