import { listen } from '@tauri-apps/api/event';
import { renderHome } from './views/home.js';
import { renderSettings } from './views/settings.js';
import { ThemeManager } from './theme.js';

export class App {
    constructor() {
        this.currentView = 'home';
        this.theme = new ThemeManager();
        this.container = document.getElementById('app');
    }

    async init() {
        await this.theme.init();
        this.setupNavigation();
        this.navigate('home');

        // 监听托盘导航事件
        await listen('navigate', (event) => {
            this.navigate(event.payload);
        });
    }

    setupNavigation() {
        window.__app = this;
    }

    async navigate(view) {
        this.currentView = view;
        switch (view) {
            case 'home':
                this.container.innerHTML = '';
                renderHome(this.container, () => this.navigate('settings'));
                break;
            case 'settings':
                this.container.innerHTML = '';
                renderSettings(this.container, () => this.navigate('home'));
                break;
        }
    }
}
