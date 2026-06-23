/**
 * Markdown Module
 * A secure, feature-complete Markdown compiler with built-in XSS sanitization.
 *
 * Supported features:
 *  - Headings H1–H6 with collapsible (accordion) mode  (## [!COLLAPSE] Title)
 *  - Fenced code blocks  ```lang ... ```
 *  - GitHub-style callout blockquotes  > [!NOTE|TIP|IMPORTANT|WARNING|CAUTION]
 *    with Vietnamese labels
 *  - Step-by-step wizard  (::steps ... ::endsteps)
 *  - Nested unordered lists  (-, *, +)
 *  - Nested ordered lists    (1. 2. …)
 *  - Tables                  (| col | col |) with long-table handling
 *  - Horizontal rules        (---, ***, ___)
 *  - Images                  ![alt](url) — clickable lightbox
 *  - Video embed             @[video](url)
 *  - Download link           @[download](url "Tên file")
 *  - Slide carousel          @[slide](url1 | url2 | url3)
 *  - Links                   [text](url)
 *  - Inline bold, italic, code
 *  - XSS sanitization on all URLs
 */

// ---------------------------------------------------------------------------
// CALLOUT LABEL MAP (tiếng Việt)
// ---------------------------------------------------------------------------
const CALLOUT_LABEL_VI = {
    NOTE:      '📝 Ghi chú',
    TIP:       '💡 Mẹo hay',
    IMPORTANT: '⚠️ Quan trọng',
    WARNING:   '🚨 Lưu ý',
    CAUTION:   '🔴 Cảnh báo',
};

const TAG_NORMALIZATION_MAP = {
    // English
    'NOTE': 'NOTE',
    'TIP': 'TIP',
    'IMPORTANT': 'IMPORTANT',
    'WARNING': 'WARNING',
    'CAUTION': 'CAUTION',
    
    // Vietnamese
    'GHI CHÚ': 'NOTE',
    'GHICHU': 'NOTE',
    'MẸO': 'TIP',
    'MẸO HAY': 'TIP',
    'GỢI Ý': 'TIP',
    'QUAN TRỌNG': 'IMPORTANT',
    'LƯU Ý': 'WARNING',
    'LUU Y': 'WARNING',
    'CẢNH BÁO': 'CAUTION',
    'CANH BAO': 'CAUTION'
};

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Parses a Markdown string and returns safe, styled HTML.
 * @param {string} md - Raw Markdown (may come from a Google Sheets cell)
 * @returns {string} Safe HTML string
 */
export function parseMarkdown(md) {
    if (!md) return '';

    // ── Step 1: HTML-escape the raw text to prevent XSS injection ──────────
    let escaped = md
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // ── Step 2: Extract fenced code blocks ──────────────────────────────────
    const codeBlocks = [];
    escaped = escaped.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
        const id = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push(
            `<pre><code class="language-${lang || 'txt'}">${code.trim()}</code></pre>`
        );
        return id;
    });

    // ── Step 2b: Extract ::steps ... ::endsteps blocks ──────────────────────
    const stepBlocks = [];
    escaped = escaped.replace(/::steps\s*\n([\s\S]*?)\n\s*::endsteps/g, (match, content) => {
        const id = `__STEP_BLOCK_${stepBlocks.length}__`;
        stepBlocks.push(renderStepWizard(content));
        return id;
    });

    // ── Step 2c: Extract @[slide](...) ──────────────────────────────────────
    const slideBlocks = [];
    escaped = escaped.replace(/@\[slide\]\(([^)]+)\)/g, (match, urlList) => {
        const id = `__SLIDE_BLOCK_${slideBlocks.length}__`;
        slideBlocks.push(renderSlideCarousel(urlList));
        return id;
    });

    // ── Step 2d: Extract @selector ... @endselector blocks ──────────────────
    const selectorBlocks = [];
    escaped = escaped.replace(/@selector\s*\n([\s\S]*?)\n\s*@endselector/g, (match, content) => {
        const id = `__SELECTOR_BLOCK_${selectorBlocks.length}__`;
        selectorBlocks.push(renderSelector(content, selectorBlocks.length));
        return id;
    });

    // ── Step 3: Line-by-line block parsing ──────────────────────────────────
    const lines = escaped.split('\n');
    const htmlBlocks = [];

    let currentBlock = [];
    let inList = null;

    // Track active collapsible headings
    const openCollapses = [];

    const closeCollapsesAboveOrEqual = (level) => {
        while (openCollapses.length > 0 && openCollapses[openCollapses.length - 1] >= level) {
            htmlBlocks.push('  </div>\n</details>');
            openCollapses.pop();
        }
    };

    const closeCurrentBlock = () => {
        if (inList === 'ul') {
            htmlBlocks.push(renderNestedList(currentBlock, 'ul'));
            currentBlock = [];
            inList = null;
        } else if (inList === 'ol') {
            htmlBlocks.push(renderNestedList(currentBlock, 'ol'));
            currentBlock = [];
            inList = null;
        } else if (inList === 'table') {
            htmlBlocks.push(renderTable(currentBlock));
            currentBlock = [];
            inList = null;
        } else if (inList === 'blockquote') {
            htmlBlocks.push(renderBlockquote(currentBlock));
            currentBlock = [];
            inList = null;
        } else if (currentBlock.length > 0) {
            const paraText = currentBlock.join('<br>').trim();
            if (paraText) {
                htmlBlocks.push(`<p>${paraText}</p>`);
            }
            currentBlock = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line  = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
            closeCurrentBlock();
            continue;
        }

        // Code block placeholder
        if (trimmed.startsWith('__CODE_BLOCK_') && trimmed.endsWith('__')) {
            closeCurrentBlock();
            htmlBlocks.push(trimmed);
            continue;
        }

        // Step block placeholder
        if (trimmed.startsWith('__STEP_BLOCK_') && trimmed.endsWith('__')) {
            closeCurrentBlock();
            htmlBlocks.push(trimmed);
            continue;
        }

        // Slide block placeholder
        if (trimmed.startsWith('__SLIDE_BLOCK_') && trimmed.endsWith('__')) {
            closeCurrentBlock();
            htmlBlocks.push(trimmed);
            continue;
        }

        // ── @[video](url) embed ─────────────────────────────────────────────
        const videoMatch = trimmed.match(/^@\[video\]\(([^)]+)\)$/);
        if (videoMatch) {
            closeCurrentBlock();
            htmlBlocks.push(renderVideoEmbed(videoMatch[1]));
            continue;
        }

        // ── @[download](url "Label") ────────────────────────────────────────
        const downloadMatch = trimmed.match(/^@\[download\]\(([^\s)]+)(?:\s+(?:&quot;|"|&#039;|')([\s\S]*?)(?:&quot;|"|&#039;|'))?\)$/);
        if (downloadMatch) {
            closeCurrentBlock();
            const rawUrl = downloadMatch[1];
            const label  = downloadMatch[2] || 'Tải xuống';
            htmlBlocks.push(renderDownloadLink(rawUrl, label));
            continue;
        }

        // ── Headings — support [!COLLAPSE] flag ────────────────────────────
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            closeCurrentBlock();
            const level   = headingMatch[1].length;
            const content = headingMatch[2];
            
            // Close any open collapses of level >= current level
            closeCollapsesAboveOrEqual(level);

            // Check for collapse flag: ## [!COLLAPSE] My Title
            const collapseMatch = content.match(/^\[!COLLAPSE\]\s+(.+)$/i);
            if (collapseMatch) {
                const title = collapseMatch[1];
                const safeTitle = applyInlineMarkdown(title);
                htmlBlocks.push(`<details class="md-collapse h${level}">
  <summary class="md-collapse-summary">
    <span class="md-collapse-icon">▶</span>
    <span class="md-collapse-title">${safeTitle}</span>
  </summary>
  <div class="md-collapse-body">`);
                openCollapses.push(level);
            } else {
                htmlBlocks.push(`<h${level}>${content}</h${level}>`);
            }
            continue;
        }

        // ── Horizontal rule ─────────────────────────────────────────────────
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
            closeCurrentBlock();
            htmlBlocks.push('<hr>');
            continue;
        }

        // ── Blockquote ──────────────────────────────────────────────────────
        const blockquoteMatch = line.match(/^(\s*)(?:>|&gt;)\s?(.*)$/);
        if (blockquoteMatch) {
            if (inList !== 'blockquote') {
                closeCurrentBlock();
                inList = 'blockquote';
            }
            currentBlock.push(blockquoteMatch[2]);
            continue;
        }

        // ── Unordered list ──────────────────────────────────────────────────
        const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
        if (ulMatch) {
            if (inList !== 'ul') {
                closeCurrentBlock();
                inList = 'ul';
            }
            currentBlock.push({ indent: ulMatch[1].length, text: ulMatch[2] });
            continue;
        }

        // ── Ordered list ────────────────────────────────────────────────────
        const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (olMatch) {
            if (inList !== 'ol') {
                closeCurrentBlock();
                inList = 'ol';
            }
            currentBlock.push({ indent: olMatch[1].length, text: olMatch[3] });
            continue;
        }

        // ── Table row ────────────────────────────────────────────────────────
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            if (inList !== 'table') {
                closeCurrentBlock();
                inList = 'table';
            }
            currentBlock.push(trimmed);
            continue;
        }

        // ── Paragraph accumulator ────────────────────────────────────────────
        if (inList) {
            closeCurrentBlock();
        }
        currentBlock.push(line);
    }

    closeCurrentBlock();

    // Close any remaining open collapses
    while (openCollapses.length > 0) {
        htmlBlocks.push('  </div>\n</details>');
        openCollapses.pop();
    }

    // ── Step 4: Re-assemble ──────────────────────────────────────────────────
    let finalHtml = htmlBlocks.join('\n');

    // Restore code blocks
    codeBlocks.forEach((codeHtml, idx) => {
        finalHtml = finalHtml.replace(`__CODE_BLOCK_${idx}__`, codeHtml);
    });
    // Restore step blocks
    stepBlocks.forEach((stepHtml, idx) => {
        finalHtml = finalHtml.replace(`__STEP_BLOCK_${idx}__`, stepHtml);
    });
    // Restore slide blocks
    slideBlocks.forEach((slideHtml, idx) => {
        finalHtml = finalHtml.replace(`__SLIDE_BLOCK_${idx}__`, slideHtml);
    });
    // Restore selector blocks
    selectorBlocks.forEach((selectorHtml, idx) => {
        finalHtml = finalHtml.replace(`__SELECTOR_BLOCK_${idx}__`, selectorHtml);
    });

    // ── Step 5: Inline transformations ─────────────────────────────────────
    finalHtml = applyInlineMarkdown(finalHtml);

    return finalHtml;
}

// ---------------------------------------------------------------------------
// INLINE MARKDOWN
// ---------------------------------------------------------------------------

function applyInlineMarkdown(html) {
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (_, code) => {
        const id = `__INLINE_CODE_${inlineCodes.length}__`;
        inlineCodes.push(`<code>${code}</code>`);
        return id;
    });

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // @[video] inline (inside paragraphs — secondary pass)
    html = html.replace(/@\[video\]\(([^)]+)\)/g, (_, url) => renderVideoEmbed(url));

    // @[download] inline
    html = html.replace(/@\[download\]\(([^\s)]+)(?:\s+(?:&quot;|"|&#039;|')([\s\S]*?)(?:&quot;|"|&#039;|'))?\)/g, (_, url, label) =>
        renderDownloadLink(url, label || 'Tải xuống')
    );

    // Images — clickable lightbox: ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
        const safeUrl = sanitizeUrl(url);
        return `<img src="${safeUrl}" alt="${alt}" loading="lazy" class="markdown-image md-lightbox-trigger" data-src="${safeUrl}">`;
    });

    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
        const safeUrl = sanitizeUrl(url);
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    });

    // Restore inline code
    inlineCodes.forEach((codeHtml, idx) => {
        html = html.replace(`__INLINE_CODE_${idx}__`, codeHtml);
    });

    return html;
}

// ---------------------------------------------------------------------------
// COLLAPSIBLE HEADING  (uses native <details>/<summary>)
// ---------------------------------------------------------------------------

function getDirectDownloadUrl(url) {
    const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/([A-Za-z0-9_-]+)|open\?id=([A-Za-z0-9_-]+))/i);
    if (driveMatch) {
        const fileId = driveMatch[1] || driveMatch[2];
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return url;
}

// ---------------------------------------------------------------------------
// VIDEO EMBED
// ---------------------------------------------------------------------------

function renderVideoEmbed(rawUrl) {
    const url = sanitizeUrl(rawUrl.trim());

    // YouTube formats (support watch, embed, shorts, and youtu.be)
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
    if (ytMatch) {
        const vid = ytMatch[1];
        return `<div class="md-video-wrapper">
  <iframe class="md-video-frame"
    src="https://www.youtube.com/embed/${vid}"
    title="Video YouTube"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>
</div>`;
    }

    // Google Drive formats (support file/d and open?id)
    const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/([A-Za-z0-9_-]+)|open\?id=([A-Za-z0-9_-]+))/i);
    if (driveMatch) {
        const fileId = driveMatch[1] || driveMatch[2];
        return `<div class="md-video-wrapper">
  <iframe class="md-video-frame"
    src="https://drive.google.com/file/d/${fileId}/preview"
    title="Video hướng dẫn"
    frameborder="0"
    allowfullscreen>
  </iframe>
</div>`;
    }

    // Generic video file
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
        return `<div class="md-video-wrapper">
  <video class="md-video-native" controls>
    <source src="${url}" type="video/mp4">
    Trình duyệt của bạn không hỗ trợ phát video.
  </video>
</div>`;
    }

    // Fallback: link
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="md-video-fallback">🎬 Xem video hướng dẫn</a>`;
}

// ---------------------------------------------------------------------------
// DOWNLOAD LINK
// ---------------------------------------------------------------------------

function renderDownloadLink(rawUrl, label) {
    const url = sanitizeUrl(rawUrl.trim());
    const directUrl = getDirectDownloadUrl(url);
    const safeLabel = label
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return `<a href="${directUrl}" class="md-download-link" download target="_blank" rel="noopener noreferrer">
  <span class="md-download-icon">⬇</span>
  <span>${safeLabel}</span>
</a>`;
}

// ---------------------------------------------------------------------------
// STEP WIZARD
// ---------------------------------------------------------------------------

function renderStepWizard(rawContent) {
    // Each step starts with a line: ## Step Title  (or ### Step Title)
    // Alternative: lines starting with "Step N:" or just sequential paragraphs.
    // We use the pattern: lines starting with ## as step titles.
    const lines = rawContent.split('\n');
    const steps = [];
    let current = null;

    for (const line of lines) {
        const stepTitleMatch = line.trim().match(/^#{1,3}\s+(.+)$/);
        if (stepTitleMatch) {
            if (current) steps.push(current);
            current = { title: stepTitleMatch[1], body: [] };
        } else if (current) {
            current.body.push(line);
        }
    }
    if (current) steps.push(current);

    if (steps.length === 0) {
        // Treat each paragraph as a step
        const paras = rawContent.split('\n\n').filter(p => p.trim());
        paras.forEach((p, i) => {
            steps.push({ title: `Bước ${i + 1}`, body: [p] });
        });
    }

    const stepsHtml = steps.map((step, idx) => {
        const bodyHtml = parseMarkdown(step.body.join('\n'));
        return `<div class="md-step" data-step="${idx}" ${idx === 0 ? 'data-active="true"' : ''}>
  <div class="md-step-body">${bodyHtml}</div>
</div>`;
    }).join('\n');

    const navButtons = `
<div class="md-steps-nav">
  <button class="md-steps-btn md-steps-prev" onclick="mdStepPrev(this)" disabled>← Bước trước</button>
  <span class="md-steps-indicator">Bước <span class="md-steps-current">1</span> / ${steps.length}</span>
  <button class="md-steps-btn md-steps-next" onclick="mdStepNext(this)">Bước sau →</button>
</div>`;

    const progressDots = steps.map((step, idx) => `
  <button class="md-step-dot ${idx === 0 ? 'active' : ''}" data-goto="${idx}" title="${step.title.replace(/"/g, '&quot;')}">
    <span class="md-step-dot-num">${idx + 1}</span>
    <span class="md-step-dot-label">${step.title}</span>
  </button>`).join('');

    return `<div class="md-steps-wizard" data-total="${steps.length}" data-current="0">
<div class="md-steps-progress">${progressDots}</div>
${stepsHtml}
${navButtons}
</div>`;
}

// ---------------------------------------------------------------------------
// SLIDE CAROUSEL
// ---------------------------------------------------------------------------

function renderSlideCarousel(urlList) {
    const urls = urlList.split(/[\r\n,|]+/).map(u => sanitizeUrl(u.trim())).filter(Boolean);
    if (urls.length === 0) return '';

    const slides = urls.map((url, idx) => `
  <div class="md-slide" data-index="${idx}" ${idx === 0 ? 'data-active="true"' : ''}>
    <img src="${url}" alt="Slide ${idx + 1}" loading="lazy" class="md-slide-img md-lightbox-trigger" data-src="${url}">
  </div>`).join('');

    const dots = urls.map((_, idx) =>
        `<button class="md-slide-dot ${idx === 0 ? 'active' : ''}" data-goto="${idx}" title="Slide ${idx + 1}"></button>`
    ).join('');

    return `<div class="md-slide-carousel" data-total="${urls.length}" data-current="0">
  <div class="md-slides-track">${slides}</div>
  <div class="md-slide-controls">
    <button class="md-slide-btn md-slide-prev" onclick="mdSlidePrev(this)" disabled>‹</button>
    <div class="md-slide-dots">${dots}</div>
    <button class="md-slide-btn md-slide-next" onclick="mdSlideNext(this)">›</button>
  </div>
  <div class="md-slide-counter"><span class="md-slide-cur">1</span> / ${urls.length}</div>
</div>`;
}

// ---------------------------------------------------------------------------
// SELECTOR RENDERER
// ---------------------------------------------------------------------------

function unescapeHtml(html) {
    if (!html) return '';
    return html
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function renderSelector(content, index) {
    const parts = content.split(/\n\s*---+\s*\n/);
    const definitionPart = parts[0] || '';
    const contentPart = parts.slice(1).join('\n---');

    // Parse dropdown definitions
    const defLines = definitionPart.split('\n');
    const dropdowns = [];
    let currentDropdown = null;
    for (const line of defLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.endsWith(':')) {
            currentDropdown = {
                label: trimmed.slice(0, -1).trim(),
                options: []
            };
            dropdowns.push(currentDropdown);
        } else if (currentDropdown && (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('+'))) {
            const optionText = trimmed.replace(/^[-*+]\s+/, '').trim();
            if (optionText) {
                currentDropdown.options.push(optionText);
            }
        }
    }

    // Helper to identify condition rows matching the dropdown values
    function isConditionLine(line, dropdowns) {
        const trimmed = line.trim();
        if (!trimmed.endsWith(':')) return null;
        const conditionText = trimmed.slice(0, -1).trim();
        const optionParts = conditionText.split('|').map(s => s.trim());
        if (optionParts.length !== dropdowns.length) return null;
        
        for (let i = 0; i < dropdowns.length; i++) {
            if (!dropdowns[i].options.includes(optionParts[i])) {
                return null;
            }
        }
        return optionParts.join('|');
    }

    // Parse conditional content blocks
    const contentLines = contentPart.split('\n');
    const blocks = {};
    let currentKey = null;

    for (const line of contentLines) {
        const matchedKey = isConditionLine(line, dropdowns);
        if (matchedKey !== null) {
            currentKey = matchedKey;
            blocks[currentKey] = [];
        } else if (currentKey !== null) {
            blocks[currentKey].push(line);
        }
    }

    // Generate dropdown controls HTML
    let dropdownsHtml = '';
    dropdowns.forEach((dd, ddIdx) => {
        const ddLabel = unescapeHtml(dd.label);
        dropdownsHtml += `
            <div class="md-selector-field">
                <label class="md-selector-label">${ddLabel}</label>
                <select class="md-selector-select" data-dropdown-index="${ddIdx}" onchange="mdSelectorChange(this)">
                    <option value="">-- Chọn ${ddLabel} --</option>
                    ${dd.options.map(opt => {
                        const optUnescaped = unescapeHtml(opt);
                        return `<option value="${optUnescaped.replace(/"/g, '&quot;')}">${optUnescaped}</option>`;
                    }).join('\n')}
                </select>
            </div>
        `;
    });

    // Generate content panels HTML
    let contentsHtml = '';
    for (const key in blocks) {
        const blockMarkdown = unescapeHtml(blocks[key].join('\n'));
        const blockHtml = parseMarkdown(blockMarkdown);
        contentsHtml += `
            <div class="md-selector-content" data-key="${unescapeHtml(key).replace(/"/g, '&quot;')}" style="display: none;">
                ${blockHtml}
            </div>
        `;
    }

    return `
        <div class="md-selector" id="md-selector-${index}">
            <div class="md-selector-header">
                ${dropdownsHtml}
            </div>
            <div class="md-selector-body">
                <div class="md-selector-placeholder active">Vui lòng chọn đầy đủ thông tin</div>
                ${contentsHtml}
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// NESTED LIST RENDERER
// ---------------------------------------------------------------------------

function renderNestedList(items, tag) {
    if (!items || items.length === 0) return '';

    const minIndent = Math.min(...items.map(it => it.indent));
    const normalised = items.map(it => ({
        level: it.indent - minIndent,
        text:  it.text
    }));

    let html = '';
    const stack = [];
    html += `<${tag}>\n`;
    stack.push(0);

    for (let i = 0; i < normalised.length; i++) {
        const { level, text } = normalised[i];
        const currentLevel = stack[stack.length - 1];

        if (level > currentLevel) {
            html = html.trimEnd();
            if (html.endsWith('</li>')) {
                html = html.slice(0, -5);
            }
            html += `\n<${tag}>\n`;
            stack.push(level);
        } else if (level < currentLevel) {
            while (stack.length > 1 && stack[stack.length - 1] > level) {
                html += `</${tag}>\n</li>\n`;
                stack.pop();
            }
        }

        html += `  <li>${applyInlineMarkdown(text)}</li>\n`;
    }

    while (stack.length > 0) {
        html += `</${tag}>\n`;
        stack.pop();
    }

    return html;
}

// ---------------------------------------------------------------------------
// BLOCKQUOTE / CALLOUT RENDERER
// ---------------------------------------------------------------------------

function renderBlockquote(lines) {
    if (lines.length === 0) return '';

    let content = lines.join('\n').trim();
    let alertClass = '';
    let alertLabel = '';

    const alertMatch = content.match(/^\[!([^\]]+)\][ \t]*([\s\S]*)$/i);
    if (alertMatch) {
        const rawTag = alertMatch[1].trim().toUpperCase();
        const type = TAG_NORMALIZATION_MAP[rawTag];
        if (type) {
            const classMap = {
                NOTE:      'callout-note',
                TIP:       'callout-note',
                IMPORTANT: 'callout-important',
                WARNING:   'callout-warning',
                CAUTION:   'callout-danger',
            };
            alertClass = classMap[type] || '';
            alertLabel = CALLOUT_LABEL_VI[type] || type;
            content = alertMatch[2].trim();
        }
    }

    const formattedContent = applyInlineMarkdown(content.replace(/\n/g, '<br>'));
    const classAttr = alertClass ? ` class="${alertClass}"` : '';

    if (alertClass) {
        return `<blockquote${classAttr}><p class="callout-label">${alertLabel}</p>${formattedContent}</blockquote>`;
    }

    return `<blockquote${classAttr}>${formattedContent}</blockquote>`;
}

// ---------------------------------------------------------------------------
// TABLE RENDERER (with long-table freeze support)
// ---------------------------------------------------------------------------

function renderTable(rows) {
    if (rows.length === 0) return '';

    const parsedRows = rows.map(row => {
        const cells = row.replace(/^\||\|$/g, '').split('|');
        return cells.map(cell => cell.trim());
    });

    let hasSeparator = false;
    let alignments   = [];

    if (parsedRows.length > 1) {
        hasSeparator = parsedRows[1].every(cell => /^:?-+:?$/.test(cell));
        if (hasSeparator) {
            alignments = parsedRows[1].map(cell => {
                const start = cell.startsWith(':');
                const end   = cell.endsWith(':');
                if (start && end) return 'center';
                if (end)          return 'right';
                return 'left';
            });
        }
    }

    const headerRow = parsedRows[0];
    const bodyRows  = hasSeparator ? parsedRows.slice(2) : parsedRows.slice(1);

    const isWideTable = headerRow.length > 5;
    const isLongTable = bodyRows.length > 15;

    const tableClasses = [];
    if (isLongTable) tableClasses.push('md-table-long');
    if (isWideTable) tableClasses.push('md-table-wide');

    const tableClass = tableClasses.length > 0 ? ` class="${tableClasses.join(' ')}"` : '';

    const containerClasses = ['table-container'];
    if (isLongTable) containerClasses.push('table-container-long');
    if (isWideTable) containerClasses.push('table-container-wide');

    let html = `<div class="${containerClasses.join(' ')}"><table${tableClass}>\n`;

    if (headerRow.length > 0) {
        html += '  <thead>\n    <tr>\n';
        headerRow.forEach((cell, idx) => {
            const align = alignments[idx] ? ` align="${alignments[idx]}"` : '';
            html += `      <th${align}>${applyInlineMarkdown(cell)}</th>\n`;
        });
        html += '    </tr>\n  </thead>\n';
    }

    if (bodyRows.length > 0) {
        html += '  <tbody>\n';
        bodyRows.forEach((row, rowIdx) => {
            const rowClass = rowIdx % 2 === 0 ? '' : ' class="odd"';
            html += `    <tr${rowClass}>\n`;
            row.forEach((cell, idx) => {
                const align = alignments[idx] ? ` align="${alignments[idx]}"` : '';
                html += `      <td${align}>${applyInlineMarkdown(cell)}</td>\n`;
            });
            html += '    </tr>\n';
        });
        html += '  </tbody>\n';
    }

    html += '</table></div>';
    return html;
}

// ---------------------------------------------------------------------------
// URL SANITIZER
// ---------------------------------------------------------------------------

function sanitizeUrl(url) {
    const trimmed = url.trim().toLowerCase();
    if (
        trimmed.startsWith('javascript:') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('vbscript:')
    ) {
        return '#';
    }
    return url.trim();
}

// ---------------------------------------------------------------------------
// GLOBAL INTERACTIVE HANDLERS (called by inline onclick)
// Exported to window so inline HTML callbacks work.
// ---------------------------------------------------------------------------

/**
 * Toggle collapse section open/closed.
 */
window.mdToggleCollapse = function(btn) {
    const details = btn.closest('details.md-collapse');
    if (!details) return;
    // details handles open/close natively, just animate icon
    const icon = btn.querySelector('.md-collapse-icon');
    if (icon) {
        icon.style.transform = details.open ? 'rotate(0deg)' : 'rotate(90deg)';
    }
};

/**
 * Step wizard: go to next step.
 */
window.mdStepNext = function(btn) {
    const wizard = btn.closest('.md-steps-wizard');
    if (!wizard) return;
    const current = parseInt(wizard.dataset.current, 10);
    const total   = parseInt(wizard.dataset.total, 10);
    if (current < total - 1) mdStepGoTo(wizard, current + 1);
};

/**
 * Step wizard: go to previous step.
 */
window.mdStepPrev = function(btn) {
    const wizard = btn.closest('.md-steps-wizard');
    if (!wizard) return;
    const current = parseInt(wizard.dataset.current, 10);
    if (current > 0) mdStepGoTo(wizard, current - 1);
};

function mdStepGoTo(wizard, idx) {
    const total = parseInt(wizard.dataset.total, 10);
    wizard.dataset.current = idx;

    // Update steps visibility
    wizard.querySelectorAll('.md-step').forEach((step, i) => {
        step.dataset.active = (i === idx) ? 'true' : 'false';
    });

    // Update dots
    wizard.querySelectorAll('.md-step-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === idx);
        dot.classList.toggle('done', i < idx);
    });

    // Update nav buttons
    const prev = wizard.querySelector('.md-steps-prev');
    const next = wizard.querySelector('.md-steps-next');
    if (prev) prev.disabled = idx === 0;
    if (next) next.disabled = idx === total - 1;

    // Update indicator
    const cur = wizard.querySelector('.md-steps-current');
    if (cur) cur.textContent = idx + 1;
}

// Dot click for steps
document.addEventListener('click', (e) => {
    const dot = e.target.closest('.md-step-dot[data-goto]');
    if (dot) {
        const wizard = dot.closest('.md-steps-wizard');
        if (wizard) mdStepGoTo(wizard, parseInt(dot.dataset.goto, 10));
    }
});

/**
 * Slide carousel: next.
 */
window.mdSlideNext = function(btn) {
    const carousel = btn.closest('.md-slide-carousel');
    if (!carousel) return;
    const current = parseInt(carousel.dataset.current, 10);
    const total   = parseInt(carousel.dataset.total, 10);
    if (current < total - 1) mdSlideGoTo(carousel, current + 1);
};

/**
 * Slide carousel: prev.
 */
window.mdSlidePrev = function(btn) {
    const carousel = btn.closest('.md-slide-carousel');
    if (!carousel) return;
    const current = parseInt(carousel.dataset.current, 10);
    if (current > 0) mdSlideGoTo(carousel, current - 1);
};

function mdSlideGoTo(carousel, idx) {
    const total = parseInt(carousel.dataset.total, 10);
    carousel.dataset.current = idx;

    carousel.querySelectorAll('.md-slide').forEach((slide, i) => {
        slide.dataset.active = (i === idx) ? 'true' : 'false';
    });
    carousel.querySelectorAll('.md-slide-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === idx);
    });

    const prev = carousel.querySelector('.md-slide-prev');
    const next = carousel.querySelector('.md-slide-next');
    if (prev) prev.disabled = idx === 0;
    if (next) next.disabled = idx === total - 1;

    const cur = carousel.querySelector('.md-slide-cur');
    if (cur) cur.textContent = idx + 1;
}

// Dot click for slides
document.addEventListener('click', (e) => {
    const dot = e.target.closest('.md-slide-dot[data-goto]');
    if (dot) {
        const carousel = dot.closest('.md-slide-carousel');
        if (carousel) mdSlideGoTo(carousel, parseInt(dot.dataset.goto, 10));
    }
});

/**
 * Selector dropdown selection change handler
 */
window.mdSelectorChange = function(selectEl) {
    const selectorEl = selectEl.closest('.md-selector');
    if (!selectorEl) return;
    
    const dropdowns = selectorEl.querySelectorAll('.md-selector-select');
    const selectedValues = [];
    let allSelected = true;
    
    dropdowns.forEach(select => {
        if (!select.value) {
            allSelected = false;
        }
        selectedValues.push(select.value);
    });
    
    const placeholder = selectorEl.querySelector('.md-selector-placeholder');
    const contentBlocks = selectorEl.querySelectorAll('.md-selector-content');
    
    // Hide all blocks
    contentBlocks.forEach(block => {
        block.style.display = 'none';
    });
    
    if (!allSelected) {
        if (placeholder) {
            placeholder.textContent = 'Vui lòng chọn đầy đủ thông tin';
            placeholder.style.display = 'block';
        }
    } else {
        if (placeholder) placeholder.style.display = 'none';
        const targetKey = selectedValues.join('|');
        const activeBlock = selectorEl.querySelector(`.md-selector-content[data-key="${targetKey}"]`);
        if (activeBlock) {
            activeBlock.style.display = 'block';
        } else {
            if (placeholder) {
                placeholder.textContent = 'Không tìm thấy nội dung phù hợp';
                placeholder.style.display = 'block';
            }
        }
    }
};

// ---------------------------------------------------------------------------
// LIGHTBOX (Image zoom)
// ---------------------------------------------------------------------------

(function setupLightbox() {
    // Inject lightbox DOM once
    let overlay = document.getElementById('md-lightbox-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'md-lightbox-overlay';
        overlay.innerHTML = `
          <button class="md-lightbox-close" title="Đóng" aria-label="Đóng ảnh">&times;</button>
          <img class="md-lightbox-img" src="" alt="Phóng to ảnh">
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.classList.contains('md-lightbox-close')) {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // Event delegation: listen for clicks on lightbox-trigger images
    document.addEventListener('click', (e) => {
        const img = e.target.closest('.md-lightbox-trigger');
        if (img) {
            const src = img.dataset.src || img.src;
            const lightboxImg = overlay.querySelector('.md-lightbox-img');
            if (lightboxImg) {
                lightboxImg.src = src;
                lightboxImg.alt = img.alt || 'Ảnh phóng to';
            }
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    });
})();
