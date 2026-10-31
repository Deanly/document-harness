import { readFile } from 'node:fs/promises';

// Bundle trusted distribution code only; all repository data remains JSON data.
export async function buildStaticBoard(snapshot) {
  const assets = new URL('../public/', import.meta.url);
  const [shell, css, model, app] = await Promise.all(
    ['index.html', 'styles.css', 'view-model.mjs', 'app.mjs'].map(name => readFile(new URL(name, assets), 'utf8'))
  );
  const escapeScript = value => value.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const code = model.replace(/^export /gm, '') + '\n' + app.replace(/^import\s*\{[\s\S]*?\}\s*from\s*[^;]+;\s*/, '');
  const data = `<script id="board-snapshot" type="application/json">${escapeScript(JSON.stringify(snapshot))}</script>`;
  return shell
    .replace(/<link rel="stylesheet"[^>]+>/, () => `<style>${css}</style>`)
    .replace(/<script type="module" src="[^"]+"><\/script>/, () => `${data}<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`);
}
