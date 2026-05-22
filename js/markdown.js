/**
 * Markdown Module
 * A secure, feature-complete Markdown compiler with built-in XSS sanitization.
 *
 * Supported features:
 *  - Headings H1–H6  (trims leading whitespace for Google Sheets compatibility)
 *  - Fenced code blocks  ```lang ... ```
 *  - GitHub-style callout blockquotes  > [!NOTE|TIP|IMPORTANT|WARNING|CAUTION]
 *  - Nested unordered lists  (-, *, +)
 *  - Nested ordered lists    (1. 2. …)
 *  - Tables                  (| col | col |)
 *  - Horizontal rules        (---, ***, ___)
 *  - Images                  ![alt](url)
 *  - Links                   [text](url)
 *  - Inline bold, italic, code
 *  - XSS sanitization on all URLs
 */

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
    //    Also normalises Windows/Mac line endings (\r\n, \r) to standard \n.
    let escaped = md
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // ── Step 2: Extract fenced code blocks before any other processing ──────
    //    Stores them in an array and replaces with safe placeholders so that
    //    inner content is never touched by subsequent passes.
    const codeBlocks = [];
    escaped = escaped.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
        const id = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push(
            `<pre><code class="language-${lang || 'txt'}">${code.trim()}</code></pre>`
        );
        return id;
    });

    // ── Step 3: Line-by-line block parsing ──────────────────────────────────
    const lines = escaped.split('\n');
    const htmlBlocks = [];

    // Accumulated lines for the current block type
    let currentBlock = [];
    // Current block type: 'ul' | 'ol' | 'table' | 'blockquote' | null
    let inList = null;

    /**
     * Flush whatever is in currentBlock into htmlBlocks, then reset state.
     */
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

        // ── Empty line → flush current block ────────────────────────────────
        if (trimmed === '') {
            closeCurrentBlock();
            continue;
        }

        // ── Code block placeholder → flush, emit verbatim ───────────────────
        if (trimmed.startsWith('__CODE_BLOCK_') && trimmed.endsWith('__')) {
            closeCurrentBlock();
            htmlBlocks.push(trimmed);
            continue;
        }

        // ── Headings (H1–H6) ────────────────────────────────────────────────
        //    Match on the *trimmed* line so leading spaces (from Google Sheets)
        //    do not prevent detection.
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            closeCurrentBlock();
            const level   = headingMatch[1].length;
            const content = headingMatch[2];
            htmlBlocks.push(`<h${level}>${content}</h${level}>`);
            continue;
        }

        // ── Horizontal rule ──────────────────────────────────────────────────
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
            closeCurrentBlock();
            htmlBlocks.push('<hr>');
            continue;
        }

        // ── Blockquote (> …) ────────────────────────────────────────────────
        //    The `>` must appear at the start of the *original* (non-trimmed)
        //    line so we honour indentation of the quote content.
        const blockquoteMatch = line.match(/^(\s*)(?:>|&gt;)\s?(.*)$/);
        if (blockquoteMatch) {
            if (inList !== 'blockquote') {
                closeCurrentBlock();
                inList = 'blockquote';
            }
            // Store the content that follows the `> ` prefix
            currentBlock.push(blockquoteMatch[2]);
            continue;
        }

        // ── Unordered list  (-, *, +) ────────────────────────────────────────
        //    Capture leading whitespace so we can build nested levels.
        const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
        if (ulMatch) {
            if (inList !== 'ul') {
                closeCurrentBlock();
                inList = 'ul';
            }
            currentBlock.push({ indent: ulMatch[1].length, text: ulMatch[2] });
            continue;
        }

        // ── Ordered list  (1. 2. …) ──────────────────────────────────────────
        const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (olMatch) {
            if (inList !== 'ol') {
                closeCurrentBlock();
                inList = 'ol';
            }
            currentBlock.push({ indent: olMatch[1].length, text: olMatch[3] });
            continue;
        }

        // ── Table row  (| … |) ───────────────────────────────────────────────
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            if (inList !== 'table') {
                closeCurrentBlock();
                inList = 'table';
            }
            currentBlock.push(trimmed);
            continue;
        }

        // ── Paragraph accumulator ────────────────────────────────────────────
        //    A non-list line while inside a list block closes the list first.
        if (inList) {
            closeCurrentBlock();
        }
        currentBlock.push(line);
    }

    // Flush any remaining block
    closeCurrentBlock();

    // ── Step 4: Re-assemble blocks ───────────────────────────────────────────
    let finalHtml = htmlBlocks.join('\n');

    // Restore fenced code blocks
    codeBlocks.forEach((codeHtml, idx) => {
        finalHtml = finalHtml.replace(`__CODE_BLOCK_${idx}__`, codeHtml);
    });

    // ── Step 5: Inline transformations ───────────────────────────────────────
    finalHtml = applyInlineMarkdown(finalHtml);

    return finalHtml;
}

// ---------------------------------------------------------------------------
// INLINE MARKDOWN
// ---------------------------------------------------------------------------

/**
 * Applies inline Markdown patterns to an HTML string.
 * Order matters:
 *   1. Inline code  (`…`)  — must come first so * inside code is not italicised
 *   2. Bold         (**…**)
 *   3. Italic       (*…*)
 *   4. Images       (![alt](url))  — must come before links
 *   5. Links        ([text](url))
 *
 * @param {string} html
 * @returns {string}
 */
function applyInlineMarkdown(html) {
    // Temporarily stash inline-code spans so their contents are not touched
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (_, code) => {
        const id = `__INLINE_CODE_${inlineCodes.length}__`;
        inlineCodes.push(`<code>${code}</code>`);
        return id;
    });

    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text*  (single asterisk, not preceded/followed by another *)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Images: ![alt](url)  — processed BEFORE links to avoid conflict
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
        const safeUrl = sanitizeUrl(url);
        // alt text is already HTML-escaped from Step 1; no further escaping needed
        return `<img src="${safeUrl}" alt="${alt}" loading="lazy" class="markdown-image">`;
    });

    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
        const safeUrl = sanitizeUrl(url);
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    });

    // Restore inline code spans
    inlineCodes.forEach((codeHtml, idx) => {
        html = html.replace(`__INLINE_CODE_${idx}__`, codeHtml);
    });

    return html;
}

// ---------------------------------------------------------------------------
// NESTED LIST RENDERER
// ---------------------------------------------------------------------------

/**
 * Converts an array of  { indent: number, text: string }  items into
 * nested  <ul>  or  <ol>  HTML.  Supports arbitrary depth.
 *
 * Algorithm:
 *  - Walk through items in order, keeping a stack of open list levels.
 *  - When indent increases → open a new nested list inside the last <li>.
 *  - When indent decreases → close open levels until we match the target depth.
 *
 * @param {Array<{indent: number, text: string}>} items
 * @param {'ul'|'ol'} tag
 * @returns {string} HTML
 */
function renderNestedList(items, tag) {
    if (!items || items.length === 0) return '';

    // Normalise indentation to 0-based levels using the minimum indent found
    const minIndent = Math.min(...items.map(it => it.indent));
    const normalised = items.map(it => ({
        level: it.indent - minIndent,
        text:  it.text
    }));

    let html = '';
    // Stack stores the current indent level of each open list
    const stack = []; // stack of indent levels

    // Open the root list
    html += `<${tag}>\n`;
    stack.push(0);

    for (let i = 0; i < normalised.length; i++) {
        const { level, text } = normalised[i];
        const currentLevel = stack[stack.length - 1];

        if (level > currentLevel) {
            // Deeper indent → open a new nested list (inside the previous <li>)
            // Close the previous <li> tag isn't emitted yet; we nest inside it.
            // Remove the last ">" so we can append a nested list before closing </li>
            html = html.trimEnd();
            // Strip the last </li> if present (it was prematurely closed)
            if (html.endsWith('</li>')) {
                html = html.slice(0, -5);
            }
            html += `\n<${tag}>\n`;
            stack.push(level);
        } else if (level < currentLevel) {
            // Shallower indent → close open lists until we match
            while (stack.length > 1 && stack[stack.length - 1] > level) {
                html += `</${tag}>\n</li>\n`;
                stack.pop();
            }
        }

        html += `  <li>${applyInlineMarkdown(text)}</li>\n`;
    }

    // Close all remaining open lists
    while (stack.length > 0) {
        html += `</${tag}>\n`;
        stack.pop();
    }

    return html;
}

// ---------------------------------------------------------------------------
// BLOCKQUOTE / CALLOUT RENDERER
// ---------------------------------------------------------------------------

/**
 * Renders accumulated blockquote lines.
 * Detects GitHub-style alert headers: [!NOTE], [!TIP], [!IMPORTANT],
 * [!WARNING], [!CAUTION] and maps them to CSS callout classes.
 *
 * Google Sheets stores multi-line cell values with literal \n characters.
 * Each line is already split before arriving here (one entry per array slot),
 * so joining with \n and then detecting the first token works reliably.
 *
 * @param {string[]} lines - Lines collected after stripping the leading `> `
 * @returns {string} Blockquote HTML
 */
function renderBlockquote(lines) {
    if (lines.length === 0) return '';

    // Join all lines so we can inspect the full content as one string
    let content = lines.join('\n').trim();
    let alertClass = '';
    let alertLabel = '';

    // Detect [!TYPE] as the very first token (possibly on its own line)
    const alertMatch = content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*([\s\S]*)$/i);
    if (alertMatch) {
        const type = alertMatch[1].toUpperCase();

        const classMap = {
            NOTE:      'callout-note',
            TIP:       'callout-note',
            IMPORTANT: 'callout-important',
            WARNING:   'callout-warning',
            CAUTION:   'callout-danger',
        };
        alertClass = classMap[type] || '';
        alertLabel = type.charAt(0) + type.slice(1).toLowerCase(); // e.g. "Important"

        // The rest of the content follows after the [!TYPE] line
        content = alertMatch[2].trim();
    }

    // Apply inline Markdown to the inner content
    const formattedContent = applyInlineMarkdown(content.replace(/\n/g, '<br>'));

    const classAttr = alertClass ? ` class="${alertClass}"` : '';

    // If it is a callout, prepend a labelled header badge
    if (alertClass) {
        return `<blockquote${classAttr}><p class="callout-label">${alertLabel}</p>${formattedContent}</blockquote>`;
    }

    return `<blockquote${classAttr}>${formattedContent}</blockquote>`;
}

// ---------------------------------------------------------------------------
// TABLE RENDERER
// ---------------------------------------------------------------------------

/**
 * Renders collected Markdown table rows as an HTML table.
 * @param {string[]} rows - Raw table row strings  (| cell | cell |)
 * @returns {string} Table HTML
 */
function renderTable(rows) {
    if (rows.length === 0) return '';

    const parsedRows = rows.map(row => {
        const cells = row.replace(/^\||\|$/g, '').split('|');
        return cells.map(cell => cell.trim());
    });

    // Detect alignment separator row (row index 1 with  :---  patterns)
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

    let html = '<div class="table-container"><table>\n';

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
        bodyRows.forEach(row => {
            html += '    <tr>\n';
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

/**
 * Blocks dangerous URL protocols (javascript:, data:, vbscript:).
 * @param {string} url - Raw URL string (may come from Markdown syntax)
 * @returns {string} Safe URL, or '#' if the protocol is disallowed
 */
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
