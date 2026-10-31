import assert from 'node:assert/strict';
import test from 'node:test';
import { Script } from 'node:vm';
import { buildStaticBoard } from '../lib/static-board.mjs';

test('standalone Board bundles trusted code and safely embeds hostile JSON', async () => {
  const snapshot = { title: '</script><script>alert(1)</script>', text: '\u2028' };
  const html = await buildStaticBoard(snapshot);
  assert.ok(!html.includes('src="/app.mjs'));
  assert.ok(!html.includes('href="/styles.css'));
  const data = html.match(/<script id="board-snapshot" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.deepEqual(JSON.parse(data), snapshot);
  assert.ok(!data.includes('<'));
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new Script(code);
  assert.ok(code.includes("document.getElementById('board-snapshot')"));
});
