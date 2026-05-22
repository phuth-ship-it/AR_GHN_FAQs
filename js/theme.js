/**
 * Theme Module
 * Handles system color scheme preference, user preference overrides, and localStorage sync.
 */

const STORAGE_KEY = 'faq-theme-preference';

// Initialize Theme
export function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        setDarkTheme(true);
    } else {
        setDarkTheme(false);
    }

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // Only change theme if user has not set a manual override
        if (!localStorage.getItem(STORAGE_KEY)) {
            setDarkTheme(e.matches);
        }
    });
}

// Check if dark theme is currently active
export function isDark() {
    return document.documentElement.classList.contains('dark');
}

// Toggle between light and dark theme
export function toggleTheme() {
    const makeDark = !isDark();
    setDarkTheme(makeDark);
    localStorage.setItem(STORAGE_KEY, makeDark ? 'dark' : 'light');
    return makeDark;
}

// Set theme state on document
function setDarkTheme(isDarkState) {
    if (isDarkState) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
    }
}
