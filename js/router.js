/**
 * Router Module
 * Handles client-side navigation.
 * Supports both clean SEO paths (using History API) and fallback Hash routing (default, zero-config).
 */

export const ROUTER_CONFIG = {
    // Set to true if hosting supports rewriting all requests to index.html (Netlify, Vercel, etc.)
    useHistory: false 
};

let routeChangeCallback = null;

/**
 * Extract active path based on current routing configuration.
 * @returns {string} The normalized path (e.g. '/' or '/category/nhan-su')
 */
function getActivePath() {
    if (ROUTER_CONFIG.useHistory) {
        return window.location.pathname;
    } else {
        const hash = window.location.hash;
        if (!hash) return '/';
        // Remove leading '#'
        return hash.substring(1) || '/';
    }
}

/**
 * Parses the current active path.
 * @returns {Object} Route information containing route name and matched params
 */
export function parseCurrentRoute() {
    const path = getActivePath();

    // Home Page
    if (path === '/' || path === '') {
        return { name: 'home', params: {} };
    }

    // Category Page: /category/[slug]
    const categoryMatch = path.match(/^\/category\/([^/]+)$/);
    if (categoryMatch) {
        return { name: 'category', params: { slug: categoryMatch[1] } };
    }

    // FAQ Detail Page: /faq/[slug]
    const faqMatch = path.match(/^\/faq\/([^/]+)$/);
    if (faqMatch) {
        return { name: 'faq', params: { slug: faqMatch[1] } };
    }

    // 404 Fallback
    return { name: 'notfound', params: { path } };
}

/**
 * Navigates programmatically to a path.
 * @param {string} path - Target path (e.g. '/category/nhan-su')
 */
export function navigate(path) {
    if (ROUTER_CONFIG.useHistory) {
        window.history.pushState({}, '', path);
        triggerRouteUpdate();
    } else {
        window.location.hash = path;
    }
}

/**
 * Generate formatted href string for anchors in templates.
 * @param {string} path - Base target path
 * @returns {string} Proper href attribute value
 */
export function getLink(path) {
    if (ROUTER_CONFIG.useHistory) {
        return path;
    } else {
        return `#${path}`;
    }
}

/**
 * Triggers route change callback.
 */
function triggerRouteUpdate() {
    if (routeChangeCallback) {
        const routeInfo = parseCurrentRoute();
        routeChangeCallback(routeInfo);
    }
}

/**
 * Initialize the router.
 * @param {Function} callback - Callback function run when route changes
 */
export function initRouter(callback) {
    routeChangeCallback = callback;

    if (ROUTER_CONFIG.useHistory) {
        window.addEventListener('popstate', triggerRouteUpdate);

        // Global event listener to intercept local link clicks with data-link attribute
        document.addEventListener('click', (e) => {
            const anchor = e.target.closest('a[data-link]');
            if (anchor && !e.defaultPrevented) {
                // Only intercept left clicks without modifier keys
                if (e.button === 0 && !e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
                    const href = anchor.getAttribute('href');
                    if (href && href.startsWith('/')) {
                        e.preventDefault();
                        navigate(href);
                    }
                }
            }
        });
    } else {
        window.addEventListener('hashchange', triggerRouteUpdate);
    }

    // Execute once initially to render the entry route
    triggerRouteUpdate();
}
