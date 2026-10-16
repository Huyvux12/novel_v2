/**
 * Shared validation and escaping helpers for the static novel catalog.
 * No runtime dependencies; also exportable for Node.js tests.
 */
(function (root) {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  function validNovelId(id) {
    return typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id.length <= 100;
  }

  function validChapterFile(file) {
    return typeof file === 'string' && /^[a-zA-Z0-9_-]+\.md$/.test(file) && file.length <= 120;
  }

  function safeImageUrl(raw) {
    if (typeof raw !== 'string') return '';
    try {
      const url = new URL(raw, 'https://example.invalid/');
      return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function normalizeNovel(novel) {
    if (!novel || !validNovelId(novel.id) || typeof novel.title !== 'string'
        || typeof novel.author !== 'string' || !Array.isArray(novel.chapters)
        || !Array.isArray(novel.genres)) {
      throw new Error('Invalid novel metadata');
    }
    const chapters = novel.chapters.map((chapter) => {
      if (!chapter || !validChapterFile(chapter.file) || typeof chapter.title !== 'string'
          || !Number.isSafeInteger(chapter.number) || chapter.number < 1) {
        throw new Error('Invalid chapter metadata');
      }
      return chapter;
    });
    return { ...novel, chapters, genres: novel.genres.filter((g) => typeof g === 'string') };
  }

  function readableCount(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const str = String(value ?? '').trim().replace(/,/g, '.');
    const match = str.match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i);
    return match ? Number(match[1]) * ({ K: 1000, M: 1e6, B: 1e9 }[String(match[2] || '').toUpperCase()] || 1) : 0;
  }

  function readStorage(key, fallback = null) {
    try { return localStorage.getItem(key) ?? fallback; }
    catch (_) { return fallback; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (_) { return false; }
  }

  const api = { escapeHtml, validNovelId, validChapterFile, safeImageUrl,
    normalizeNovel, readableCount, readStorage, writeStorage };

  root.NovelUtils = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
