/**
 * DocLN Clone - Reader Page JavaScript
 * Handles: Markdown parsing, reading settings, chapter navigation
 */

// ========================================
// STATE MANAGEMENT
// ========================================
const U = window.NovelUtils;
let chapterRequest = 0;
const readerState = {
    novel: null,
    chapters: [],
    currentChapterIndex: 0,
    settings: {
        fontSize: 18,
        fontFamily: 'font-sans',
        theme: 'light' // light, sepia, dark
    }
};

// ========================================
// DOM ELEMENTS
// ========================================
const readerElements = {
    readerPage: document.getElementById('readerPage'),
    toolbarNovel: document.getElementById('toolbarNovel'),
    toolbarChapter: document.getElementById('toolbarChapter'),
    chapterTitle: document.getElementById('chapterTitle'),
    chapterBody: document.getElementById('chapterBody'),
    backBtn: document.getElementById('backBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsPanel: document.getElementById('settingsPanel'),
    fontSizeSlider: document.getElementById('fontSizeSlider'),
    fontSizeValue: document.getElementById('fontSizeValue'),
    fontSelect: document.getElementById('fontSelect'),
    tocBtn: document.getElementById('tocBtn'),
    tocNavBtn: document.getElementById('tocNavBtn'),
    tocModal: document.getElementById('tocModal'),
    tocList: document.getElementById('tocList'),
    tocClose: document.getElementById('tocClose')
};

// Initialize Markdown parser
const md = typeof window.markdownit === 'function' ? window.markdownit({ html: false, linkify: true }) : null;

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', initReader);

async function initReader() {
    // Load saved settings
    loadSettings();

    // Setup event listeners
    setupReaderEvents();

    // Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const novelId = params.get('novel');
    const rawChapter = params.get('chapter');
    const chapterNum = rawChapter && /^\d+$/.test(rawChapter) ? Number(rawChapter) : 1;

    if (!U.validNovelId(novelId)) {
        showReaderError('Không tìm thấy truyện. Vui lòng quay lại trang chủ.');
        return;
    }

    // Load novel info and chapter
    await loadNovelAndChapter(novelId, chapterNum);
}

function setupReaderEvents() {
    // Back button
    readerElements.backBtn.addEventListener('click', goBackToDetail);

    // Navigation
    readerElements.prevBtn.addEventListener('click', goToPrevChapter);
    readerElements.nextBtn.addEventListener('click', goToNextChapter);

    // Settings toggle
    readerElements.settingsBtn.addEventListener('click', toggleSettings);

    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => setTheme(btn.dataset.theme));
    });

    // Font size slider
    readerElements.fontSizeSlider.addEventListener('input', handleFontSizeChange);

    // Font family select
    readerElements.fontSelect.addEventListener('change', handleFontChange);

    // TOC
    readerElements.tocBtn.addEventListener('click', openToc);
    readerElements.tocNavBtn.addEventListener('click', openToc);
    readerElements.tocClose.addEventListener('click', closeToc);
    readerElements.tocModal.addEventListener('click', (e) => {
        if (e.target === readerElements.tocModal) closeToc();
    });

    // Close settings when clicking outside
    document.addEventListener('click', (e) => {
        if (!readerElements.settingsPanel.classList.contains('hidden') &&
            !readerElements.settingsPanel.contains(e.target) &&
            !readerElements.settingsBtn.contains(e.target)) {
            readerElements.settingsPanel.classList.add('hidden');
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboard);
}

// ========================================
// DATA LOADING
// ========================================
async function loadNovelAndChapter(novelId, chapterNum) {
    try {
        // Load novel info
        const infoResponse = await fetch(`novels/${novelId}/info.json`);
        if (!infoResponse.ok) throw new Error('Failed to load novel info');

        readerState.novel = U.normalizeNovel(await infoResponse.json());
        if (readerState.novel.id !== novelId) throw new Error('Novel identifier mismatch');
        readerState.chapters = readerState.novel.chapters;
        readerState.currentChapterIndex = readerState.chapters.findIndex(ch => ch.number === chapterNum);

        // Validate chapter index
        if (readerState.currentChapterIndex < 0 ||
            readerState.currentChapterIndex >= readerState.chapters.length) {
            readerState.currentChapterIndex = 0;
        }

        // Update toolbar
        readerElements.toolbarNovel.textContent = readerState.novel.title;

        // Load current chapter
        await loadChapter();

        // Update TOC
        renderToc();

    } catch (error) {
        console.error('Error loading novel:', error);
        showReaderError('Không thể tải truyện. Vui lòng thử lại.');
    }
}

async function loadChapter() {
    const chapter = readerState.chapters[readerState.currentChapterIndex];

    if (!chapter) {
        showReaderError('Không tìm thấy chương.');
        return;
    }

    // Show loading
    readerElements.chapterBody.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const response = await fetch(`novels/${readerState.novel.id}/${chapter.file}`);
        if (!response.ok) throw new Error('Failed to load chapter');

        const markdown = await response.text();
        const html = md.render(markdown);

        // Update UI
        readerElements.toolbarChapter.textContent = chapter.title;
        readerElements.chapterTitle.textContent = chapter.title;
        readerElements.chapterBody.innerHTML = html;

        // Update navigation buttons
        updateNavButtons();

        // Update URL
        updateUrl();

        // Scroll to top
        window.scrollTo(0, 0);

    } catch (error) {
        console.error('Error loading chapter:', error);
        readerElements.chapterBody.innerHTML = `
      <div class="empty-state">
        <p>Không thể tải nội dung chương. Vui lòng thử lại.</p>
      </div>
    `;
    }
}

// ========================================
// NAVIGATION
// ========================================
function goBackToDetail() {
    if (readerState.novel) {
        window.location.href = `index.html?novel=${encodeURIComponent(readerState.novel.id)}`;
    } else {
        window.location.href = 'index.html';
    }
}

function goToPrevChapter() {
    if (readerState.currentChapterIndex > 0) {
        readerState.currentChapterIndex--;
        loadChapter();
    }
}

function goToNextChapter() {
    if (readerState.currentChapterIndex < readerState.chapters.length - 1) {
        readerState.currentChapterIndex++;
        loadChapter();
    }
}

function goToChapter(index) {
    readerState.currentChapterIndex = index;
    loadChapter();
    closeToc();
}

function updateNavButtons() {
    readerElements.prevBtn.disabled = readerState.currentChapterIndex === 0;
    readerElements.nextBtn.disabled = readerState.currentChapterIndex === readerState.chapters.length - 1;
}

function updateUrl() {
    const url = new URL(window.location);
    url.searchParams.set('chapter', readerState.chapters[readerState.currentChapterIndex].number);
    history.replaceState({}, '', url);
}

function handleKeyboard(e) {
    // Arrow left - previous chapter
    if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.altKey) {
        goToPrevChapter();
    }
    // Arrow right - next chapter
    if (e.key === 'ArrowRight' && !e.ctrlKey && !e.altKey) {
        goToNextChapter();
    }
    // Escape - close modals
    if (e.key === 'Escape') {
        readerElements.settingsPanel.classList.add('hidden');
        closeToc();
    }
}

// ========================================
// SETTINGS
// ========================================
function toggleSettings() {
    readerElements.settingsPanel.classList.toggle('hidden');
}

function setTheme(theme) {
    if (!['light','sepia','dark'].includes(theme)) return;
    readerState.settings.theme = theme;

    // Update page class
    readerElements.readerPage.className = `reader-page reader-${theme}`;

    // Update active button
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    saveSettings();
}

function handleFontSizeChange(e) {
    const size = parseInt(e.target.value);
    readerState.settings.fontSize = size;

    readerElements.fontSizeValue.textContent = size;
    readerElements.chapterBody.style.fontSize = `${size}px`;

    saveSettings();
}

function handleFontChange(e) {
    const font = e.target.value;
    readerState.settings.fontFamily = font;

    // Remove old font class
    readerElements.chapterBody.classList.remove('font-sans', 'font-serif', 'font-mono');
    // Add new font class
    readerElements.chapterBody.classList.add(font);

    saveSettings();
}

function loadSettings() {
    const saved = U.readStorage('readerSettings');

    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data && typeof data === 'object') {
              readerState.settings = {
                fontSize: Number.isInteger(data.fontSize) ? Math.max(14, Math.min(28, data.fontSize)) : 18,
                fontFamily: ['font-sans', 'font-serif', 'font-mono'].includes(data.fontFamily) ? data.fontFamily : 'font-sans',
                theme: ['light', 'sepia', 'dark'].includes(data.theme) ? data.theme : 'light'
              };
            }
        } catch (e) {
            console.error('Error parsing saved settings:', e);
        }
    }

    applySettings();
}

function applySettings() {
    const { fontSize, fontFamily, theme } = readerState.settings;

    // Apply theme
    readerElements.readerPage.className = `reader-page reader-${theme}`;
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // Apply font size
    readerElements.fontSizeSlider.value = fontSize;
    readerElements.fontSizeValue.textContent = fontSize;
    readerElements.chapterBody.style.fontSize = `${fontSize}px`;

    // Apply font family
    readerElements.fontSelect.value = fontFamily;
    readerElements.chapterBody.classList.remove('font-sans', 'font-serif', 'font-mono');
    readerElements.chapterBody.classList.add(fontFamily);
}

function saveSettings() {
    U.writeStorage('readerSettings', JSON.stringify(readerState.settings));
}

// ========================================
// TABLE OF CONTENTS
// ========================================
function renderToc() {
    readerElements.tocList.innerHTML = readerState.chapters.map((ch, idx) => `
    <a href="#" class="toc-item ${idx === readerState.currentChapterIndex ? 'active' : ''}" data-index="${idx}">
      ${U.escapeHtml(ch.title)}
    </a>
  `).join('');

    // Add click handlers
    readerElements.tocList.querySelectorAll('.toc-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            goToChapter(parseInt(item.dataset.index));
        });
    });
}

function openToc() {
    // Update active state
    readerElements.tocList.querySelectorAll('.toc-item').forEach((item, idx) => {
        item.classList.toggle('active', idx === readerState.currentChapterIndex);
    });

    readerElements.tocModal.classList.remove('hidden');
}

function closeToc() {
    readerElements.tocModal.classList.add('hidden');
}

// ========================================
// ERROR HANDLING
// ========================================
function showReaderError(message) {
    readerElements.chapterTitle.textContent = 'Lỗi';
    readerElements.chapterBody.innerHTML = `
    <div class="empty-state">
      <p>${U.escapeHtml(message)}</p>
      <a href="index.html" class="btn btn-primary" style="margin-top: 1rem; display: inline-block;">
        Về trang chủ
      </a>
    </div>
  `;
}
