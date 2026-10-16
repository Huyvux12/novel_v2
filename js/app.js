/**
 * DocLN Clone - Main Application JavaScript
 * Handles: Novel listing, search, theme toggle, navigation
 */

// ========================================
// STATE MANAGEMENT
// ========================================
const U = window.NovelUtils;
let detailRequest = 0;
const state = {
  novels: [],
  filteredNovels: [],
  currentView: 'home', // 'home' | 'detail'
  selectedNovel: null,
  isDarkMode: false
};

// ========================================
// DOM ELEMENTS
// ========================================
const elements = {
  mainContent: document.getElementById('mainContent'),
  homeContent: document.getElementById('homeContent'),
  detailContent: document.getElementById('detailContent'),
  loadingState: document.getElementById('loadingState'),
  searchForm: document.getElementById('searchForm'),
  searchInput: document.getElementById('searchInput'),
  themeToggle: document.getElementById('themeToggle'),
  moonIcon: document.getElementById('moonIcon'),
  sunIcon: document.getElementById('sunIcon'),
  modalOverlay: document.getElementById('modalOverlay'),
  chapterModal: document.getElementById('chapterModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  modalClose: document.getElementById('modalClose')
};

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Load saved theme
  loadTheme();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load novels data
  await loadNovels();
  
  // Check URL for novel detail
  checkUrlParams();
}

function setupEventListeners() {
  // Theme toggle
  elements.themeToggle.addEventListener('click', toggleTheme);
  
  // Search
  elements.searchForm.addEventListener('submit', handleSearch);
  elements.searchInput.addEventListener('input', debounce(handleSearchInput, 300));
  
  // Modal close
  elements.modalClose.addEventListener('click', closeModal);
  elements.modalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.modalOverlay) closeModal();
  });
  
  // Handle browser back/forward
  window.addEventListener('popstate', handlePopState);
}

// ========================================
// DATA LOADING
// ========================================
async function loadNovels() {
  try {
    const response = await fetch('novels/index.json');
    if (!response.ok) throw new Error('Failed to load novels');
    
    const data = await response.json();
    if (!Array.isArray(data.novels)) throw new Error('Invalid catalog');
    state.novels = data.novels.map(U.normalizeNovel);
    state.filteredNovels = [...state.novels];
    
    renderHomePage();
  } catch (error) {
    console.error('Error loading novels:', error);
    showError('Không thể tải danh sách truyện. Vui lòng thử lại.');
  }
}

async function loadNovelDetail(novelId) {
  try {
    const response = await fetch(`novels/${novelId}/info.json`);
    if (!response.ok) throw new Error('Failed to load novel detail');
    
    const novel = await response.json();
    state.selectedNovel = novel;
    
    renderDetailPage(novel);
    
    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('novel', novelId);
    if (pushHistory && new URL(location.href).searchParams.get('novel') !== novelId) history.pushState({ novelId }, '', url);
  } catch (error) {
    console.error('Error loading novel:', error);
    showError('Không thể tải thông tin truyện. Vui lòng thử lại.');
  }
}

// ========================================
// RENDERING - HOME PAGE
// ========================================
function renderHomePage() {
  elements.loadingState.classList.add('hidden');
  elements.detailContent.classList.add('hidden');
  elements.homeContent.classList.remove('hidden');
  
  const novels = state.filteredNovels;
  const E = U.escapeHtml;
  
  elements.homeContent.innerHTML = `
    <!-- Featured Section -->
    <section class="fade-in">
      <div class="section-header pink">
        <h2 class="section-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ec4899" stroke="#ec4899" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          Truyện Đề Cử
        </h2>
        <a href="#" class="section-link">Xem tất cả</a>
      </div>
      <div class="novel-grid">
        ${novels.length ? novels.map(novel => renderNovelCard(novel)).join('') : '<p class="empty-state">Không tìm thấy truyện phù hợp.</p>'}
      </div>
    </section>
    
    <!-- Main Layout -->
    <div class="main-layout">
      <!-- Latest Updates -->
      <section>
        <div class="section-header green">
          <h2 class="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            Mới Cập Nhật
          </h2>
        </div>
        <div class="update-list">
          ${novels.map(novel => renderUpdateItem(novel)).join('')}
        </div>
      </section>
      
      <!-- Ranking -->
      <section>
        <div class="section-header red">
          <h2 class="section-title">
            <span style="color: #ef4444; font-size: 1.5rem;">#</span>
            Bảng Xếp Hạng
          </h2>
        </div>
        <div class="ranking-card">
          <div class="ranking-tabs">
            <button class="ranking-tab active">Theo ngày</button>
            <button class="ranking-tab">Theo tháng</button>
            <button class="ranking-tab">Mọi lúc</button>
          </div>
          <ul class="ranking-list">
            ${[...novels].sort((a,b) => U.readableCount(b.views) - U.readableCount(a.views)).slice(0, 5).map((novel, index) => renderRankingItem(novel, index)).join('')}
          </ul>
        </div>
      </section>
    </div>
  `;
  
  // Add click handlers to novel cards
  addNovelClickHandlers();
  
  state.currentView = 'home';
}

function renderNovelCard(novel) {
  const statusText = novel.status === 'Đang tiến hành' || novel.status === 'Đang ra' ? 'ON' : 'END';
  
  return `
    <article class="novel-card" data-novel-id="${E(novel.id)}">
      <div class="novel-cover">
        <img src="${E(U.safeImageUrl(novel.cover))}" alt="${E(novel.title)}" loading="lazy">
        <span class="novel-status">${statusText}</span>
      </div>
      <div class="novel-info">
        <h3 class="novel-title">${E(novel.title)}</h3>
        <div class="novel-genres">
          ${novel.genres.slice(0, 2).map(g => `<span class="genre-tag">${E(g)}</span>`).join('')}
        </div>
        <div class="novel-meta">
          <span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            ${E(novel.views || 'N/A')}
          </span>
          <span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${E(novel.lastUpdate || 'N/A')}
          </span>
        </div>
      </div>
    </article>
  `;
}

function renderUpdateItem(novel) {
  const chapters = novel.chapters || [];
  
  return `
    <article class="update-item" data-novel-id="${E(novel.id)}">
      <div class="update-cover">
        <img src="${E(U.safeImageUrl(novel.cover))}" alt="${E(novel.title)}">
      </div>
      <div class="update-content">
        <h3 class="update-title">${E(novel.title)}</h3>
        <p class="update-author">
          <span>${E(novel.genres[0] || '')}</span>
          • ${E(novel.author)}
        </p>
        <div class="chapter-list">
          ${chapters.slice(0, 2).map(ch => `
            <div class="chapter-item">
              <span class="chapter-title">${E(ch.title)}</span>
              <span class="chapter-time">${E(ch.date || '')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </article>
  `;
}

function renderRankingItem(novel, index) {
  const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
  
  return `
    <li class="ranking-item" data-novel-id="${E(novel.id)}">
      <span class="ranking-number ${rankClass}">${index + 1}</span>
      <div class="ranking-info">
        <h4 class="ranking-title">${E(novel.title)}</h4>
        <span class="ranking-views">${E(novel.views || 'N/A')} views</span>
      </div>
    </li>
  `;
}

// ========================================
// RENDERING - DETAIL PAGE
// ========================================
function renderDetailPage(novel) {
  elements.loadingState.classList.add('hidden');
  elements.homeContent.classList.add('hidden');
  elements.detailContent.classList.remove('hidden');
  
  const statusClass = novel.status === 'Đang tiến hành' || novel.status === 'Đang ra' ? 'status' : '';
  
  elements.detailContent.innerHTML = `
    <div class="fade-in">
      <button class="back-btn" id="backToHomeBtn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        Quay lại trang chủ
      </button>
      
      <div class="novel-detail">
        <div class="novel-detail-inner">
          <div class="detail-cover">
            <img src="${E(U.safeImageUrl(novel.cover))}" alt="${E(novel.title)}">
          </div>
          <div class="detail-content">
            <h1 class="detail-title">${E(novel.title)}</h1>
            <div class="detail-genres">
              ${novel.genres.map(g => `<span class="detail-genre">${E(g)}</span>`).join('')}
            </div>
            
            <div class="detail-stats">
              <div class="stat-item">
                <label>Tác giả</label>
                <p>${E(novel.author)}</p>
              </div>
              <div class="stat-item">
                <label>Tình trạng</label>
                <p class="${statusClass}">${E(novel.status)}</p>
              </div>
              <div class="stat-item">
                <label>Lượt xem</label>
                <p>${E(novel.views || 'N/A')}</p>
              </div>
              <div class="stat-item">
                <label>Theo dõi</label>
                <p class="follows">${E(novel.follows || 'N/A')}</p>
              </div>
            </div>
            
            <div class="synopsis">
              <h3>Tóm tắt</h3>
              <p>${E(novel.description)}</p>
            </div>
            
            <div class="detail-actions">
              <a href="reader.html?novel=${E(novel.id)}&chapter=${novel.chapters[0]?.number || 1}" class="btn btn-lg btn-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                Đọc từ đầu
              </a>
              <button class="btn btn-lg btn-follow" id="followButton" type="button" aria-pressed="false">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                Theo dõi
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="chapter-list-card">
        <h3 class="chapter-list-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          Danh sách chương
        </h3>
        <div class="chapter-grid">
          ${novel.chapters.map((ch, idx) => `
            <a href="reader.html?novel=${E(novel.id)}&chapter=${ch.number}" class="chapter-link">
              <span class="chapter-name">${E(ch.title)}</span>
              <span class="chapter-date">${E(ch.date || '')}</span>
            </a>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  // Add back button handler
  document.getElementById('backToHomeBtn').addEventListener('click', goHome);
  const follow = document.getElementById('followButton');
  let saved = [];
  try { saved = JSON.parse(U.readStorage('followedNovels','[]')); if (!Array.isArray(saved)) saved=[]; } catch (_) { saved=[]; }
  function syncFollow(){ const active=saved.includes(novel.id); follow.setAttribute('aria-pressed',String(active)); follow.lastChild.textContent=active?' Đang theo dõi':' Theo dõi'; }
  follow.addEventListener('click',()=>{saved=saved.includes(novel.id)?saved.filter(id=>id!==novel.id):[...saved,novel.id]; U.writeStorage('followedNovels',JSON.stringify(saved));syncFollow();});
  syncFollow();
  
  state.currentView = 'detail';
  window.scrollTo(0, 0);
}

// ========================================
// EVENT HANDLERS
// ========================================
function addNovelClickHandlers() {
  document.querySelectorAll('[data-novel-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const novelId = el.dataset.novelId;
      loadNovelDetail(novelId);
    });
  });
}

function handleSearch(e) {
  e.preventDefault();
  const term = elements.searchInput.value.trim().toLocaleLowerCase('vi');
  filterNovels(term);
}

function handleSearchInput(e) {
  const term = e.target.value.trim().toLocaleLowerCase('vi');
  filterNovels(term);
}

function filterNovels(term) {
  if (!term) {
    state.filteredNovels = [...state.novels];
  } else {
    state.filteredNovels = state.novels.filter(novel => 
      novel.title.toLocaleLowerCase('vi').includes(term) ||
      novel.author.toLocaleLowerCase('vi').includes(term) ||
      novel.genres.some(g => g.toLocaleLowerCase('vi').includes(term))
    );
  }
  
  if (state.currentView === 'home') {
    renderHomePage();
  }
}

function toggleTheme() {
  state.isDarkMode = !state.isDarkMode;
  applyTheme();
  saveTheme();
}

function applyTheme() {
  if (state.isDarkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
    elements.moonIcon.classList.add('hidden');
    elements.sunIcon.classList.remove('hidden');
  } else {
    document.documentElement.removeAttribute('data-theme');
    elements.moonIcon.classList.remove('hidden');
    elements.sunIcon.classList.add('hidden');
  }
}

function loadTheme() {
  const savedTheme = U.readStorage('theme');
  state.isDarkMode = savedTheme === 'dark';
  applyTheme();
}

function saveTheme() {
  U.writeStorage('theme', state.isDarkMode ? 'dark' : 'light');
}

function goHome() {
  state.selectedNovel = null;
  state.filteredNovels = [...state.novels];
  
  // Update URL
  const url = new URL(window.location);
  url.searchParams.delete('novel');
  if (pushHistory && new URL(location.href).searchParams.has('novel')) history.pushState({}, '', url);
  
  renderHomePage();
  window.scrollTo(0, 0);
}

function handlePopState(e) {
  const params = new URLSearchParams(window.location.search);
  const novelId = params.get('novel');
  
  if (novelId) {
    loadNovelDetail(novelId);
  } else {
    goHome();
  }
}

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const novelId = params.get('novel');
  
  if (novelId) {
    loadNovelDetail(novelId);
  }
}

function closeModal() {
  elements.modalOverlay.classList.add('hidden');
}

function showError(message) {
  elements.loadingState.classList.add('hidden');
  elements.homeContent.classList.remove('hidden');
  elements.homeContent.innerHTML = `
    <div class="empty-state">
      <p>${U.escapeHtml(message)}</p>
      <button class="btn btn-primary" onclick="location.reload()">Thử lại</button>
    </div>
  `;
}

// ========================================
// UTILITIES
// ========================================
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
