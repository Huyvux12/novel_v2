const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../js/utils.js');

test('escapeHtml handles markup and attributes', () => {
  assert.equal(U.escapeHtml('<img src="x" onerror=\'alert(1)\'>'), '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;');
  assert.equal(U.escapeHtml(null), '');
});

test('reject novel traversal and invalid chapter filenames', () => {
  for (const id of ['../secret', 'foo/bar', '%2e%2e', '', 'Hello World']) assert.equal(U.validNovelId(id), false);
  assert.equal(U.validNovelId('thien-su-nha-ben'), true);
  for (const name of ['../secret.md', 'chap1.html', '/abc.md', 'chap1.md?x=1']) assert.equal(U.validChapterFile(name), false);
  assert.equal(U.validChapterFile('chap1.md'), true);
});

test('normalizeNovel rejects malformed metadata', () => {
  const base = {id:'a', title:'Novel', author:'Writer', genres:[], chapters:[{number:1,title:'First',file:'chap1.md'}]};
  assert.equal(U.normalizeNovel(base).chapters.length,1);
  assert.throws(() => U.normalizeNovel({...base,id:'../../foo'}));
  assert.throws(() => U.normalizeNovel({...base,chapters:[{number:1,title:'Bad',file:'../escape.md'}]}));
});

test('counts and image URLs', () => {
  assert.equal(U.readableCount('1.2M'),1200000);
  assert.equal(U.readableCount('45K'),45000);
  assert.equal(U.readableCount('junk'),0);
  assert.equal(U.safeImageUrl('javascript:alert(1)'), '');
  assert.equal(U.safeImageUrl('https://example.com/a.png'), 'https://example.com/a.png');
});
