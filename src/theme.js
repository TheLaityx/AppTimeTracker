export class ThemeManager {
    constructor() {
        this.current = 'light';
    }

    async init() {
        this.applySystemTheme();
        // 监听系统主题变化
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener('change', () => this.applySystemTheme());
    }

    applySystemTheme() {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.current = isDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.current);
        this.updateCSSVars(isDark);
    }

    updateCSSVars(isDark) {
        const root = document.documentElement;
        if (isDark) {
            root.style.setProperty('--bg-primary', 'rgba(32, 32, 32, 0.95)');
            root.style.setProperty('--bg-secondary', 'rgba(45, 45, 45, 0.97)');
            root.style.setProperty('--bg-tertiary', 'rgba(58, 58, 58, 0.93)');
            root.style.setProperty('--bg-hover', 'rgba(255,255,255,0.06)');
            root.style.setProperty('--bg-active', 'rgba(255,255,255,0.1)');
            root.style.setProperty('--text-primary', 'rgba(255,255,255,0.92)');
            root.style.setProperty('--text-secondary', 'rgba(255,255,255,0.55)');
            root.style.setProperty('--text-tertiary', 'rgba(255,255,255,0.35)');
            root.style.setProperty('--accent', '#60CDFF');
            root.style.setProperty('--accent-hover', '#82D8FF');
            root.style.setProperty('--accent-bg', 'rgba(96,205,255,0.15)');
            root.style.setProperty('--border', 'rgba(255,255,255,0.08)');
            root.style.setProperty('--border-strong', 'rgba(255,255,255,0.14)');
            root.style.setProperty('--shadow', '0 8px 32px rgba(0,0,0,0.5)');
            root.style.setProperty('--bar-bg', 'rgba(255,255,255,0.08)');
            root.style.setProperty('--scrollbar-bg', 'rgba(255,255,255,0.1)');
        } else {
            root.style.setProperty('--bg-primary', 'rgba(243, 243, 243, 0.96)');
            root.style.setProperty('--bg-secondary', 'rgba(255, 255, 255, 0.98)');
            root.style.setProperty('--bg-tertiary', 'rgba(240, 240, 240, 0.94)');
            root.style.setProperty('--bg-hover', 'rgba(0,0,0,0.04)');
            root.style.setProperty('--bg-active', 'rgba(0,0,0,0.08)');
            root.style.setProperty('--text-primary', 'rgba(0,0,0,0.87)');
            root.style.setProperty('--text-secondary', 'rgba(0,0,0,0.55)');
            root.style.setProperty('--text-tertiary', 'rgba(0,0,0,0.35)');
            root.style.setProperty('--accent', '#0067C0');
            root.style.setProperty('--accent-hover', '#0057A8');
            root.style.setProperty('--accent-bg', 'rgba(0,103,192,0.1)');
            root.style.setProperty('--border', 'rgba(0,0,0,0.06)');
            root.style.setProperty('--border-strong', 'rgba(0,0,0,0.12)');
            root.style.setProperty('--shadow', '0 8px 32px rgba(0,0,0,0.15)');
            root.style.setProperty('--bar-bg', 'rgba(0,0,0,0.06)');
            root.style.setProperty('--scrollbar-bg', 'rgba(0,0,0,0.08)');
        }
    }
}
