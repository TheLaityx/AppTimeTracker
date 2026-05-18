import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function renderWelcome(container, onDone) {
    container.innerHTML = `
    <style>${getStyles()}</style>
    <div class="app-root">
      <div class="titlebar" id="titlebar-drag">
        <div class="titlebar-title" id="titlebar-title">应用时长</div>
        <button class="titlebar-btn close-btn" id="btn-close" title="关闭到托盘">
          ${iconClose()}
        </button>
      </div>
      <div class="welcome-body">
        <div class="welcome-icon">${appIconSVG()}</div>
        <h1 class="welcome-title">欢迎使用 应用时长</h1>
        <p class="welcome-sub">轻量追踪你每天使用各应用的时长</p>
        
        <div class="privacy-card">
          <div class="privacy-header">
            ${iconShield()}
            <span>隐私承诺</span>
          </div>
          <ul class="privacy-list">
            <li>${iconCheck()} 完全离线运行，<strong>不联网</strong>，不上传任何数据</li>
            <li>${iconCheck()} 所有记录仅保存在你的本地电脑</li>
            <li>${iconCheck()} 不读取文件内容，仅记录应用名称和使用时长</li>
            <li>${iconCheck()} 开源代码，随时可审查</li>
          </ul>
        </div>

        <div class="feature-row">
          <div class="feature-item">
            ${iconChart()}
            <span>7/30天统计图</span>
          </div>
          <div class="feature-item">
            ${iconTray()}
            <span>系统托盘后台</span>
          </div>
          <div class="feature-item">
            ${iconBoot()}
            <span>开机自启动</span>
          </div>
        </div>

        <button class="btn-primary" id="btn-start">开始使用</button>
        <p class="welcome-hint">关闭窗口后软件仍在后台运行，可从右下角托盘图标访问</p>
      </div>
    </div>
    `;

    document.getElementById('btn-start').addEventListener('click', async () => {
        await invoke('mark_first_launch_done').catch(() => {});
        onDone();
    });

    document.getElementById('btn-close').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await getCurrentWindow().hide();
        } catch (err) {
            console.error('hide failed:', err);
        }
    });

    // 手动实现拖拽
    const titlebar = document.getElementById('titlebar-drag');
    if (titlebar) {
        titlebar.addEventListener('mousedown', async (e) => {
            if (e.target.closest('.titlebar-btn')) return;
            try {
                await getCurrentWindow().startDragging();
            } catch (err) {}
        });
    }
}

function getStyles() {
    return `
    :root {
      --bg-primary: rgba(243,243,243,0.88);
      --bg-secondary: rgba(255,255,255,0.92);
      --text-primary: rgba(0,0,0,0.87);
      --text-secondary: rgba(0,0,0,0.55);
      --accent: #0067C0;
      --border: rgba(0,0,0,0.06);
      --shadow: 0 8px 32px rgba(0,0,0,0.15);
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background: transparent; font-family: "Microsoft YaHei UI","Segoe UI Variable",system-ui,sans-serif; }
    .app-root {
      width: 420px; height: 720px;
      background: var(--bg-primary);
      backdrop-filter: blur(40px) saturate(180%);
      -webkit-backdrop-filter: blur(40px) saturate(180%);
      border-radius: 12px;
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    .titlebar {
      height: 44px; display:flex; align-items:center; padding: 0 12px;
      border-bottom: 1px solid var(--border);
      user-select: none; -webkit-user-select: none;
      flex-shrink: 0;
    }
    .titlebar-title { flex: 1; font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .titlebar-btn {
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: transparent; cursor: pointer; display:flex; align-items:center; justify-content:center;
      color: var(--text-secondary); transition: background 0.15s;
    }
    .titlebar-btn:hover { background: rgba(0,0,0,0.06); }
    .close-btn:hover { background: #C42B1C !important; color: white; }

    .welcome-body {
      flex: 1; display:flex; flex-direction:column; align-items:center;
      padding: 28px 28px 24px; overflow-y: auto; gap: 16px;
    }
    .welcome-icon { width:72px; height:72px; }
    .welcome-title { font-size: 20px; font-weight: 700; color: var(--text-primary); text-align:center; }
    .welcome-sub { font-size: 13px; color: var(--text-secondary); text-align:center; margin-top:-8px; }

    .privacy-card {
      width:100%; background: var(--bg-secondary); border-radius:10px;
      border: 1px solid var(--border); padding: 16px;
    }
    .privacy-header {
      display:flex; align-items:center; gap:8px;
      font-size:14px; font-weight:600; color: var(--text-primary); margin-bottom:12px;
    }
    .privacy-list { list-style:none; display:flex; flex-direction:column; gap:8px; }
    .privacy-list li { display:flex; align-items:center; gap:8px; font-size:13px; color: var(--text-secondary); }
    .privacy-list strong { color: var(--text-primary); }

    .feature-row { display:flex; gap:12px; width:100%; }
    .feature-item {
      flex:1; display:flex; flex-direction:column; align-items:center; gap:8px;
      padding:14px 8px; background: var(--bg-secondary); border-radius:10px;
      border: 1px solid var(--border); font-size:12px; color: var(--text-secondary);
    }

    .btn-primary {
      width:100%; height:42px; border-radius:8px; border:none;
      background: var(--accent); color:#fff; font-size:14px; font-weight:600;
      cursor:pointer; transition: opacity 0.15s, transform 0.1s;
      margin-top:4px;
    }
    .btn-primary:hover { opacity:0.9; }
    .btn-primary:active { transform:scale(0.98); }
    .welcome-hint { font-size:11px; color: var(--text-tertiary, rgba(0,0,0,0.35)); text-align:center; }

    [data-theme="dark"] .titlebar-btn:hover:not(.close-btn) { background: rgba(255,255,255,0.08) !important; }
    `;
}

function appIconSVG() {
    return `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
      <rect width="72" height="72" rx="18" fill="#0067C0"/>
      <rect x="16" y="20" width="40" height="6" rx="3" fill="rgba(255,255,255,0.9)"/>
      <rect x="16" y="33" width="28" height="6" rx="3" fill="rgba(255,255,255,0.7)"/>
      <rect x="16" y="46" width="20" height="6" rx="3" fill="rgba(255,255,255,0.5)"/>
    </svg>`;
}

function iconClose() {
    return `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
}

function iconShield() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z" fill="#4CAF50"/>
      <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function iconCheck() {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
      <circle cx="8" cy="8" r="7" fill="#4CAF50"/>
      <path d="M5 8l2 2 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function iconChart() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="14" width="4" height="7" rx="1.5" fill="#0067C0"/>
      <rect x="10" y="9" width="4" height="12" rx="1.5" fill="#0067C0" opacity="0.8"/>
      <rect x="17" y="5" width="4" height="16" rx="1.5" fill="#0067C0" opacity="0.6"/>
    </svg>`;
}

function iconTray() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="17" width="20" height="4" rx="1" fill="#0067C0" opacity="0.3"/>
      <rect x="3" y="18" width="18" height="2" rx="1" fill="#0067C0"/>
      <circle cx="12" cy="10" r="5" fill="#0067C0" opacity="0.8"/>
      <path d="M10 10l1.5 1.5L14 8" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function iconBoot() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="#0067C0" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="4" fill="#0067C0"/>
    </svg>`;
}
