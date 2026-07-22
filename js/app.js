/**
 * Application Orchestrator
 * Binds modules together, manages state, renders views, and handles UI events.
 */

import { initTheme, toggleTheme } from './theme.js';
import { parseMarkdown } from './markdown.js';
import { fetchFAQData, clearCache } from './api.js';
import { initRouter, navigate, getLink } from './router.js';
import { renderStatementSearchPage } from './statement-search.js';

// Global Application State
const state = {
    faqData: [],      // Raw array from API
    categories: [],   // Processed categories
    activeCategory: null,
    searchQuery: '',
    isLoading: true,
    error: null
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Theme (Sync with local preferences or system)
    initTheme();
    setupThemeToggleListener();

    // 2. Initialize Client-side Router
    initRouter(handleRouteTransition);
});

// Theme switch listener
function setupThemeToggleListener() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            toggleTheme();
        });
    }
}

// ==========================================================================
// ROUTE TRANSITION HANDLER (SPA CONTROLLER)
// ==========================================================================
async function handleRouteTransition(routeInfo) {
    state.isLoading = true;
    state.error = null;
    renderLoadingState(routeInfo.name);

    // Trang Tra cứu sao kê không cần FAQ data → render trực tiếp, không fetch
    if (routeInfo.name === 'statement-search') {
        state.isLoading = false;
        renderStatementSearchPage(appContainer);
        updateBreadcrumbs([
            { name: 'Tra cứu sao kê', path: '/statement-search' }
        ]);
        return;
    }

    try {
        // Load data (loads from cache or fetches API)
        state.faqData = await fetchFAQData();
        const processed = processSheetData(state.faqData);
        state.categories = processed.categories;
        state.isLoading = false;

        // Route matching
        switch (routeInfo.name) {
            case 'home':
                renderHome();
                break;
            case 'category':
                renderCategory(routeInfo.params.slug);
                break;
            case 'faq':
                renderFAQDetail(routeInfo.params.slug);
                break;
            default:
                renderNotFound();
                break;
        }
    } catch (err) {
        console.error('Error handling route transition:', err);
        state.isLoading = false;
        state.error = err.message || 'Đã xảy ra lỗi không xác định.';
        renderErrorState();
    }
}

// ==========================================================================
// DATA UTILITIES
// ==========================================================================
/**
 * Processes flat sheet rows into categories and lists.
 * Supports configurations rows (Topic column empty).
 */
function processSheetData(rows) {
    const categoriesMap = new Map();
    const faqs = [];

    // First pass: Create Category wrappers (handling config rows)
    rows.forEach(row => {
        const catName = row.Category;
        if (!catName || catName.trim() === '') return;

        if (!categoriesMap.has(catName)) {
            categoriesMap.set(catName, {
                name: catName,
                icon: 'help-circle', // default icon
                description: `Xem các tài liệu, hướng dẫn liên quan đến danh mục ${catName}.`,
                slug: slugify(catName),
                topics: [],
                count: 0
            });
        }

        const cat = categoriesMap.get(catName);
        const isConfigRow = !row.Topic || row.Topic.trim() === '';

        if (isConfigRow) {
            if (row.Description?.trim()) {
                cat.description = row.Description;
            }

            if (row.Icon?.trim()) {
                cat.icon = row.Icon.trim().toLowerCase();
                console.log('CONFIG ICON:', catName, cat.icon);
            }
        } else {
            faqs.push(row);
        }
    });

    // Second pass: Populate FAQs
    faqs.forEach(faq => {
        const catName = faq.Category;
        const cat = categoriesMap.get(catName);
        if (cat) {
            cat.topics.push(faq);
            cat.count++;
            // Fallback icon from the first topic if category has default icon
            if (
                cat.icon === 'help-circle' &&
                faq.Icon?.trim()
            ) {
                cat.icon = faq.Icon.trim().toLowerCase();
                console.log('FAQ ICON:', catName, cat.icon);
            }
        }
    });

    // Sort topics by date (newest first) if an UpdatedAt / Date column exists
    Array.from(categoriesMap.values()).forEach(cat => {
        cat.topics.sort((a, b) => {
            const dateA = parseTopicDate(a);
            const dateB = parseTopicDate(b);
            if (dateA && dateB) return dateB - dateA; // newest first
            if (dateA) return -1;
            if (dateB) return 1;
            return 0; // keep original order if no dates
        });
    });

    return {
        categories: Array.from(categoriesMap.values()),
        faqs: faqs
    };
}

/**
 * Helper to parse Vietnamese date strings (DD/MM/YYYY or DD-MM-YYYY)
 * or standard JS date formats.
 */
function parseDateString(raw) {
    if (!raw) return null;
    if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;

    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        // Regex for DD/MM/YYYY or DD-MM-YYYY, optionally followed by HH:mm:ss
        const match = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // 0-indexed
            const year = parseInt(match[3], 10);
            const hour = match[4] ? parseInt(match[4], 10) : 0;
            const minute = match[5] ? parseInt(match[5], 10) : 0;
            const second = match[6] ? parseInt(match[6], 10) : 0;
            return new Date(year, month, day, hour, minute, second);
        }
    }

    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Parses a date from a FAQ topic row.
 * Looks for UpdatedAt, Date, or CreatedAt columns.
 * Returns a Date object or null.
 */
function parseTopicDate(faq) {
    const raw = faq.UpdatedAt || faq.Date || faq.CreatedAt || '';
    if (!raw) return null;
    return parseDateString(raw);
}

/**
 * Normalizes Vietnamese strings to generate SEO-friendly slugs.
 */
function slugify(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/([^a-z0-9\s-]|_)+/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

/**
 * Simple debounce function for search performance.
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// ==========================================================================
// VIEW RENDERERS & TEMPLATES
// ==========================================================================

const appContainer = document.getElementById('app');

// Update breadcrumbs
function updateBreadcrumbs(crumbs = []) {
    const breadcrumbsContainer = document.getElementById('breadcrumbs');
    if (!breadcrumbsContainer) return;

    if (crumbs.length === 0) {
        breadcrumbsContainer.innerHTML = '';
        return;
    }

    let html = `
        <li class="breadcrumb-item">
            <a href="${getLink('/')}" data-link>Trang chủ</a>
        </li>
    `;

    crumbs.forEach((crumb, idx) => {
        html += `<span class="breadcrumb-separator">/</span>`;
        if (idx === crumbs.length - 1) {
            html += `<li class="breadcrumb-item active" title="${crumb.name}">${crumb.name}</li>`;
        } else {
            html += `
                <li class="breadcrumb-item">
                    <a href="${getLink(crumb.path)}" data-link>${crumb.name}</a>
                </li>
            `;
        }
    });

    breadcrumbsContainer.innerHTML = html;
}

// Render Loading Skeleton State
function renderLoadingState(routeName) {
    updateBreadcrumbs([]);
    let template = '';

    if (routeName === 'home') {
        template = `
            <div class="hero">
                <div class="skeleton skeleton-title" style="margin: 0 auto 1.5rem;"></div>
                <div class="skeleton skeleton-desc" style="margin: 0 auto;"></div>
            </div>
            <div class="category-grid">
                ${Array(6).fill().map(() => '<div class="skeleton skeleton-card"></div>').join('')}
            </div>
        `;
    } else {
        template = `
            <div class="category-header-section">
                <div class="skeleton skeleton-title" style="width: 150px; height: 38px;"></div>
                <div class="skeleton skeleton-desc" style="width: 300px;"></div>
            </div>
            <div class="skeleton skeleton-text" style="width: 100%; height: 50px; margin-bottom: 2rem;"></div>
            <div class="topics-list">
                ${Array(4).fill().map(() => '<div class="skeleton skeleton-topic"></div>').join('')}
            </div>
        `;
    }

    appContainer.innerHTML = template;
}

// Render Error State
function renderErrorState() {
    updateBreadcrumbs([]);
    appContainer.innerHTML = `
        <div class="error-state">
            <svg class="error-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <h3>Không thể tải dữ liệu FAQ</h3>
            <p>${state.error || 'Vui lòng kiểm tra kết nối mạng hoặc thử lại.'}</p>
            <button id="btn-retry" class="btn-primary">Thử lại</button>
        </div>
    `;

    document.getElementById('btn-retry')?.addEventListener('click', () => {
        clearCache();
        window.location.reload();
    });
}

// Render 404 Not Found Page
function renderNotFound() {
    updateBreadcrumbs([]);
    appContainer.innerHTML = `
        <div class="empty-state">
            <svg class="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <h3>Trang không tồn tại</h3>
            <p>Trang bạn tìm kiếm không có trong cơ sở dữ liệu tri thức của chúng tôi.</p>
            <a href="${getLink('/')}" class="btn-primary" data-link>Về trang chủ</a>
        </div>
    `;
}

// Render Home View (Category Grid)
function renderHome() {
    document.title = 'Trang chủ | GHN Support';
    updateBreadcrumbs([]);

    // Sort categories: put common ones at top or keep sheet order
    const categoriesHtml = state.categories.map(cat => `
        <div class="category-card" data-slug="${cat.slug}">
            <div class="category-card-icon"><i data-lucide="${(cat.icon || 'help-circle').trim().toLowerCase()}"></i></div>
            <h3 class="category-card-title">${cat.name}</h3>
            <p class="category-card-desc">${cat.description}</p>
            <span class="category-card-meta">${cat.count} chủ đề</span>
        </div>
    `).join('');

    // Feature card: Tra cứu sao kê
    const statementCardHtml = `
        <div class="category-card feature-card-statement" data-action="statement-search">
            <div class="category-card-icon"><i data-lucide="file-text"></i></div>
            <h3 class="category-card-title">Tra cứu sao kê</h3>
            <p class="category-card-desc">Kiểm tra trạng thái nạp Xu theo sao kê ngân hàng nhanh chóng.</p>
            <span class="category-card-meta">Tra cứu</span>
        </div>
    `;

    appContainer.innerHTML = `
        <div class="hero">
            <h1>Trung tâm Hỗ trợ GHN</h1>
            <p>Tìm kiếm thông tin, quy trình và câu hỏi thường gặp nhanh chóng của Giao Hàng Nhanh.</p>
        </div>
        <div class="category-grid">
            ${categoriesHtml}
            ${statementCardHtml}
        </div>
    `;

    refreshIcons();

    // Attach click listeners to category cards
    const cards = appContainer.querySelectorAll('.category-card[data-slug]');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const slug = card.getAttribute('data-slug');
            navigate(`/category/${slug}`);
        });
    });

    // Attach click listener to statement card
    const statementCard = appContainer.querySelector('.feature-card-statement');
    if (statementCard) {
        statementCard.addEventListener('click', () => {
            navigate('/statement-search');
        });
    }
}

// Render Category View (Topics List)
function renderCategory(catSlug) {
    const category = state.categories.find(c => c.slug === catSlug);
    if (!category) {
        renderNotFound();
        return;
    }

    state.activeCategory = category;
    state.searchQuery = ''; // reset search query
    document.title = `${category.name} | GHN Support`;
    
    // Breadcrumbs: Home / Category Name
    updateBreadcrumbs([{ name: category.name, path: `/category/${catSlug}` }]);

    renderTopicsList(category.topics);
}

// Draw the HTML for category topics
function renderTopicsList(topicsList) {
    const category = state.activeCategory;
    const searchVal = state.searchQuery.trim().toLowerCase();

    // Filter topics by title, description or content
    const filteredTopics = topicsList.filter(t => 
        t.Topic.toLowerCase().includes(searchVal) || 
        t.Description.toLowerCase().includes(searchVal) ||
        (t.Content || '').toLowerCase().includes(searchVal)
    );

    let listHtml = '';
    if (filteredTopics.length === 0) {
        // Debounced Search empty state
        listHtml = `
            <div class="empty-state" style="margin-top: 1rem;">
                <svg class="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <h3>Không tìm thấy kết quả</h3>
                <p>Không có câu hỏi nào khớp với từ khóa "${state.searchQuery}". Vui lòng thử từ khóa khác.</p>
                ${state.searchQuery ? '<button id="btn-clear-search" class="btn-primary">Xóa tìm kiếm</button>' : ''}
            </div>
        `;
    } else {
        listHtml = `
            <div class="topics-list">
                ${filteredTopics.map(topic => `
                    <div class="topic-card" data-slug="${topic.Slug}">
                        <div class="topic-card-content">
                            <h4 class="topic-card-title">${topic.Topic}</h4>
                            <p class="topic-card-desc">${topic.Description}</p>
                        </div>
                        <svg class="topic-card-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Chỉ hiển thị button "Tra cứu sao kê" khi đang ở category Xu GHN (slug: xu-ghn)
    const isXuGHN = category.slug === 'xu-ghn';
    const statementBtnHtml = isXuGHN ? `
        <button id="btn-statement-search" class="btn-primary btn-statement-search">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Tra cứu sao kê
        </button>` : '';

    appContainer.innerHTML = `
        <div class="category-header-section">
            <div class="category-header-top-row">
                <button id="btn-home" class="btn-back">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                    </svg>
                    Quay lại
                </button>
                ${statementBtnHtml}
            </div>
            <div class="category-info">
                <div class="category-title-badge"><i data-lucide="${(category.icon || 'help-circle').trim().toLowerCase()}"></i></div>
                <div class="category-text-info">
                    <h2>${category.name}</h2>
                    <p>${category.description}</p>
                </div>
            </div>
        </div>

        <div class="search-container">
            <svg class="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" id="search-input" class="search-input" placeholder="Tìm kiếm câu hỏi trong danh mục này..." value="${state.searchQuery}">
        </div>

        <div id="topics-results-container">
            ${listHtml}
        </div>
    `;

    // Hook Back Button
    document.getElementById('btn-home')?.addEventListener('click', () => {
        navigate('/');
    });

    // Hook Tra cứu sao kê button (chỉ xuất hiện ở category xu-ghn)
    document.getElementById('btn-statement-search')?.addEventListener('click', () => {
        navigate('/statement-search');
    });

    // Hook search clear button if visible
    document.getElementById('btn-clear-search')?.addEventListener('click', () => {
        state.searchQuery = '';
        renderTopicsList(topicsList);
    });

    // Hook input field with debounce
    const input = document.getElementById('search-input');
    if (input) {
        input.focus();
        
        // Custom 250ms debounce handler
        const handleSearchInputDebounced = debounce((e) => {
            state.searchQuery = e.target.value;
            renderTopicsListInner(topicsList);
        }, 250);

        input.addEventListener('input', handleSearchInputDebounced);
    }

    // Attach click listeners to topic cards
    const cardElements = appContainer.querySelectorAll('.topic-card');
    cardElements.forEach(card => {
        card.addEventListener('click', () => {
            const slug = card.getAttribute('data-slug');
            navigate(`/faq/${slug}`);
        });
    });

    refreshIcons();
}

// Render only the dynamic topic list inside the search wrapper to preserve input focus
function renderTopicsListInner(topicsList) {
    const resultsContainer = document.getElementById('topics-results-container');
    if (!resultsContainer) return;

    const searchVal = state.searchQuery.trim().toLowerCase();
    const filteredTopics = topicsList.filter(t => 
        t.Topic.toLowerCase().includes(searchVal) || 
        t.Description.toLowerCase().includes(searchVal) ||
        (t.Content || '').toLowerCase().includes(searchVal)
    );

    let listHtml = '';
    if (filteredTopics.length === 0) {
        listHtml = `
            <div class="empty-state" style="margin-top: 1rem;">
                <svg class="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <h3>Không tìm thấy kết quả</h3>
                <p>Không có câu hỏi nào khớp với từ khóa "${state.searchQuery}". Vui lòng thử từ khóa khác.</p>
                ${state.searchQuery ? '<button id="btn-clear-search-inner" class="btn-primary">Xóa tìm kiếm</button>' : ''}
            </div>
        `;
    } else {
        listHtml = `
            <div class="topics-list">
                ${filteredTopics.map(topic => `
                    <div class="topic-card" data-slug="${topic.Slug}">
                        <div class="topic-card-content">
                            <h4 class="topic-card-title">${topic.Topic}</h4>
                            <p class="topic-card-desc">${topic.Description}</p>
                        </div>
                        <svg class="topic-card-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </div>
                `).join('')}
            </div>
        `;
    }

    resultsContainer.innerHTML = listHtml;

    // Attach click listeners to topic cards
    const cardElements = resultsContainer.querySelectorAll('.topic-card');
    cardElements.forEach(card => {
        card.addEventListener('click', () => {
            const slug = card.getAttribute('data-slug');
            navigate(`/faq/${slug}`);
        });
    });

    // Rebind inner clear search button
    document.getElementById('btn-clear-search-inner')?.addEventListener('click', () => {
        state.searchQuery = '';
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        renderTopicsListInner(topicsList);
    });

    refreshIcons();
}

// Render FAQ Detail View
function renderFAQDetail(faqSlug) {
    // Find the FAQ item by slug
    let activeFaq = null;
    let category = null;

    for (const cat of state.categories) {
        const found = cat.topics.find(t => t.Slug === faqSlug);
        if (found) {
            activeFaq = found;
            category = cat;
            break;
        }
    }

    if (!activeFaq) {
        renderNotFound();
        return;
    }

    document.title = `${activeFaq.Topic} | Chi tiết hỗ trợ GHN`;

    // Breadcrumbs: Home / Category / Topic Title
    updateBreadcrumbs([
        { name: category.name, path: `/category/${category.slug}` },
        { name: activeFaq.Topic, path: `/faq/${faqSlug}` }
    ]);

    // Parse Markdown to Safe Sanitized HTML
    const htmlBodyContent = parseMarkdown(activeFaq.Content);

    // Format date if available
    const dateRaw = activeFaq.UpdatedAt || activeFaq.Date || activeFaq.CreatedAt || '';
    let dateStr = '';
    if (dateRaw) {
        const d = parseDateString(dateRaw);
        if (d) {
            dateStr = d.toLocaleDateString('vi-VN', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        }
    }

    appContainer.innerHTML = `
        <div class="faq-detail-container">
            <div class="faq-header-actions">
                <div class="actions-left">
                    <button id="btn-back-to-cat" class="btn-back">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                        Quay lại danh mục
                    </button>
                    <button id="btn-back-to-home" class="btn-back">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                        </svg>
                        Trang chủ
                    </button>
                </div>
            </div>

            <article class="faq-article">
                <div class="faq-article-category">${category.name}</div>
                <h1 class="faq-article-title">${activeFaq.Topic}</h1>
                ${dateStr ? `<div class="faq-article-date">🕐 Cập nhật: ${dateStr}</div>` : ''}
                <div class="faq-body-content">
                    ${htmlBodyContent}
                </div>
            </article>
        </div>
    `;

    // Bind navigation actions
    document.getElementById('btn-back-to-cat')?.addEventListener('click', () => {
        navigate(`/category/${category.slug}`);
    });

    document.getElementById('btn-back-to-home')?.addEventListener('click', () => {
        navigate('/');
    });

    refreshIcons();

    // Post-render: process collapsible headings within rendered content
    processCollapsibleHeadings();
}

/**
 * Helper: Refreshes Lucide Vector SVGs in DOM.
 */
function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

/**
 * Post-render processor: wraps [!COLLAPSE] heading sections into
 * native <details>/<summary> elements.
 *
 * After parseMarkdown() runs, collapsible headings appear as:
 *   <h2 data-collapse="true">Title</h2>
 * (from the renderCollapsibleSection marker).
 *
 * This function is a no-op for the current implementation because
 * markdown.js generates full <details> HTML directly.
 * Kept as a hook for future enhancements.
 */
function processCollapsibleHeadings() {
    // Currently markdown.js renders details/summary natively.
    // This function handles any cleanup if needed.
    const container = document.querySelector('.faq-body-content');
    if (!container) return;
    // Ensure details within faq-body-content have the correct class
    container.querySelectorAll('details').forEach(d => {
        if (!d.classList.contains('md-collapse')) {
            d.classList.add('md-collapse');
        }
    });
}
