import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export async function renderSettings(container, onBack) {
    container.innerHTML = `<style>${getStyles()}</style>
    <div class="app-root">
      <div class="titlebar" id="titlebar-drag">
        <button class="titlebar-btn" id="btn-back" title="返回">${iconBack()}</button>
        <div class="titlebar-title" id="titlebar-title">设置</div>
        <div style="flex:1"></div>
        <button class="titlebar-btn close-btn" id="btn-close" title="隐藏到托盘">${iconClose()}</button>
      </div>

      <div class="content">
        <div class="section">
          <div class="section-title">启动 &amp; 运行</div>
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-name">开机自动启动</div>
              <div class="setting-desc">登录 Windows 后自动在后台运行，不显示窗口</div>
            </div>
            <label class="toggle" id="toggle-autostart">
              <input type="checkbox" id="cb-autostart">
              <span class="slider"></span>
            </label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-name">数据刷新间隔</div>
              <div class="setting-desc">每隔多少秒自动刷新使用时长数据（5-600秒）</div>
            </div>
            <div class="interval-control">
              <input type="number" class="interval-input" id="interval-input" min="5" max="600" value="60" />
              <span class="interval-unit">秒</span>
              <button class="interval-save-btn" id="btn-interval-save">保存</button>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">数据 &amp; 隐私</div>
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-name">数据存储位置</div>
              <div class="setting-desc">%APPDATA%\\AppTimeTracker\\usage.db</div>
            </div>
            <button class="btn-ghost" id="btn-opendir">${iconFolder()} 打开</button>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-name">数据保留时长</div>
              <div class="setting-desc">自动清理 35 天前的使用记录</div>
            </div>
            <span class="badge">35天</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">关于</div>
          <div class="about-card">
            <div class="about-icon">${appLogo()}</div>
            <div class="about-info">
              <div class="about-name">应用时长</div>
              <div class="about-ver">版本 1.0.0</div>
              <div class="about-desc">轻量、离线、不联网 · 完全保护你的隐私</div>
            </div>
          </div>
          <div class="setting-item borderless">
            <div class="setting-info">
              <div class="setting-name">技术栈</div>
              <div class="setting-desc">Rust + Tauri 2 + SQLite · 体积 &lt; 10MB</div>
            </div>
          </div>
        </div>

        <div class="section danger-section">
          <div class="section-title">危险操作</div>
          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-name">清除所有记录</div>
              <div class="setting-desc">删除全部使用历史，操作不可撤销</div>
            </div>
            <button class="btn-danger" id="btn-clear">清除数据</button>
          </div>
        </div>
      </div>
    </div>`;

    // 加载当前设置
    let refreshInterval = 60;
    try {
        const autoEnabled = await invoke('get_autostart');
        document.getElementById('cb-autostart').checked = autoEnabled;
    } catch (e) {}
    try {
        refreshInterval = await invoke('get_refresh_interval');
        document.getElementById('interval-input').value = refreshInterval;
    } catch (e) {}

    // 刷新间隔保存
    document.getElementById('btn-interval-save').addEventListener('click', async () => {
        const input = document.getElementById('interval-input');
        let val = parseInt(input.value, 10);
        if (isNaN(val) || val < 5) val = 5;
        if (val > 600) val = 600;
        input.value = val;
        try {
            await invoke('set_refresh_interval', { interval: val });
            showToast(`刷新间隔已设为 ${val} 秒`);
        } catch (e) {
            showToast('保存失败: ' + e, true);
        }
    });

    // 开机自启开关
    document.getElementById('cb-autostart').addEventListener('change', async (e) => {
        try {
            await invoke('set_autostart', { enabled: e.target.checked });
        } catch (err) {
            alert('设置失败: ' + err);
            e.target.checked = !e.target.checked;
        }
    });

    document.getElementById('btn-back').addEventListener('click', onBack);
    document.getElementById('btn-close').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await getCurrentWindow().hide();
        } catch (err) {
            console.error('hide failed:', err);
        }
    });

    // 滚动条：滚轮滚动时显示，停止后自动隐藏
    const settingsContent = container.querySelector('.content');
    let settingsScrollTimer = null;
    if (settingsContent) {
        settingsContent.addEventListener('scroll', () => {
            settingsContent.classList.add('scrolling');
            clearTimeout(settingsScrollTimer);
            settingsScrollTimer = setTimeout(() => {
                settingsContent.classList.remove('scrolling');
            }, 1200);
        });
    }

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

    document.getElementById('btn-opendir').addEventListener('click', async () => {
        try {
            await invoke('open_data_dir');
        } catch (e) {
            showToast('打开失败: ' + e, true);
        }
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        showConfirmDialog(
            '清除所有记录',
            '确定要删除全部使用历史吗？此操作无法撤销。',
            async () => {
                try {
                    await invoke('clear_all_data');
                    showToast('数据已清除');
                } catch (e) {
                    showToast('清除失败: ' + e, true);
                }
            }
        );
    });
}

function showToast(msg, isError = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' toast-err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
}

function showConfirmDialog(title, msg, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box">
        <div class="dialog-title">${title}</div>
        <div class="dialog-msg">${msg}</div>
        <div class="dialog-actions">
          <button class="btn-ghost" id="dlg-cancel">取消</button>
          <button class="btn-danger" id="dlg-confirm">确认删除</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('dlg-cancel').onclick = () => overlay.remove();
    document.getElementById('dlg-confirm').onclick = () => { overlay.remove(); onConfirm(); };
}

function getStyles() {
    return `
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #app { width:100%; height:100%; overflow:hidden; }
    body { background:transparent; font-family:"Microsoft YaHei UI","Segoe UI Variable",system-ui,sans-serif; color:var(--text-primary); }

    .app-root {
      width:100%; height:100%;
      background:var(--bg-primary);
      backdrop-filter:blur(60px) saturate(180%);
      -webkit-backdrop-filter:blur(60px) saturate(180%);
      border-radius:12px; border:1px solid var(--border);
      box-shadow:var(--shadow); display:flex; flex-direction:column; overflow:hidden;
    }
    .titlebar {
      height:48px; display:flex; align-items:center; padding:0 8px;
      border-bottom:1px solid var(--border);
      user-select:none; -webkit-user-select:none; flex-shrink:0; gap:4px;
    }
    .titlebar-title { font-size:15px; font-weight:700; color:var(--text-primary); }
    .titlebar-btn {
      width:32px; height:32px; border-radius:8px; border:none;
      background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center;
      color:var(--text-secondary); transition:background 0.15s;
    }
    .titlebar-btn:hover { background:var(--bg-hover); color:var(--text-primary); }
    .close-btn:hover { background:#C42B1C !important; color:white !important; }

    .content { flex:1; min-height:0; overflow-y:auto; padding:8px 0 24px; background:var(--bg-primary); }
    .content::-webkit-scrollbar { width:6px; }
    .content::-webkit-scrollbar-thumb { background:transparent; border-radius:3px; transition:background 0.3s; }
    .content:hover::-webkit-scrollbar-thumb { background:var(--scrollbar-bg); }
    .content.scrolling::-webkit-scrollbar-thumb { background:var(--scrollbar-bg); }

    .section { margin-top:16px; }
    .section-title { font-size:11px; color:var(--text-tertiary); padding:0 16px 8px; text-transform:uppercase; letter-spacing:0.6px; font-weight:600; }
    .section > .setting-item { border-top:1px solid var(--border); }
    .section > .setting-item:last-child { border-bottom:1px solid var(--border); }

    .setting-item {
      display:flex; align-items:center; padding:14px 16px;
      gap:12px; background:var(--bg-secondary); transition:background 0.12s;
    }
    .setting-item:hover { background:var(--bg-hover); }
    .setting-item.borderless { border:none; }

    .setting-info { flex:1; }
    .setting-name { font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:2px; }
    .setting-desc { font-size:11px; color:var(--text-secondary); line-height:1.4; }

    /* Toggle */
    .toggle { position:relative; display:inline-block; width:44px; height:24px; flex-shrink:0; }
    .toggle input { opacity:0; width:0; height:0; }
    .slider {
      position:absolute; inset:0; background:var(--bar-bg);
      border-radius:12px; transition:0.2s; cursor:pointer;
      border:1.5px solid var(--border-strong);
    }
    .slider:before {
      content:''; position:absolute; width:18px; height:18px;
      left:2px; top:50%; transform:translateY(-50%);
      background:var(--text-secondary); border-radius:50%; transition:0.2s;
    }
    input:checked + .slider { background:var(--accent); border-color:var(--accent); }
    input:checked + .slider:before { transform:translate(20px,-50%); background:white; }

    .badge {
      padding:3px 10px; background:var(--accent-bg); color:var(--accent);
      border-radius:20px; font-size:11px; font-weight:600; flex-shrink:0;
    }

    .btn-ghost {
      display:flex; align-items:center; gap:6px; padding:6px 12px;
      border-radius:6px; border:1px solid var(--border-strong);
      background:transparent; color:var(--text-primary); font-size:12px;
      cursor:pointer; transition:background 0.15s; font-family:inherit; flex-shrink:0;
    }
    .btn-ghost:hover { background:var(--bg-hover); }

    .btn-danger {
      padding:6px 12px; border-radius:6px; border:none;
      background:#C42B1C; color:white; font-size:12px; font-weight:600;
      cursor:pointer; font-family:inherit; flex-shrink:0; transition:opacity 0.15s;
    }
    .btn-danger:hover { opacity:0.85; }

    .about-card {
      display:flex; align-items:center; gap:14px; padding:16px;
      background:var(--bg-secondary); border-top:1px solid var(--border);
    }
    .about-icon { width:52px; height:52px; flex-shrink:0; }
    .about-name { font-size:16px; font-weight:700; color:var(--text-primary); }
    .about-ver { font-size:12px; color:var(--accent); margin:2px 0 4px; }
    .about-desc { font-size:11px; color:var(--text-secondary); }

    .danger-section .setting-item { background:var(--bg-secondary); }

    /* Interval control */
    .interval-control { display:flex; align-items:center; gap:6px; flex-shrink:0; }
    .interval-input {
      width:60px; padding:4px 8px; border-radius:6px; border:1px solid var(--border-strong);
      background:var(--bg-primary); color:var(--text-primary); font-size:13px; font-weight:600;
      text-align:center; font-family:inherit; outline:none;
    }
    .interval-input:focus { border-color:var(--accent); }
    .interval-unit { font-size:12px; color:var(--text-secondary); }
    .interval-save-btn {
      padding:4px 10px; border-radius:6px; border:none;
      background:var(--accent); color:white; font-size:11px; font-weight:600;
      cursor:pointer; font-family:inherit; transition:opacity 0.15s;
    }
    .interval-save-btn:hover { opacity:0.85; }

    /* Toast */
    .toast {
      position:fixed; bottom:20px; left:50%; transform:translateX(-50%);
      background:var(--bg-secondary); color:var(--text-primary);
      padding:10px 20px; border-radius:8px; font-size:13px;
      box-shadow:0 4px 16px rgba(0,0,0,0.2); border:1px solid var(--border);
      animation: fadeIn 0.2s ease; z-index:9999;
    }
    .toast-err { background:#C42B1C; color:white; border-color:#C42B1C; }
    @keyframes fadeIn { from { opacity:0; transform:translate(-50%,8px); } }

    /* Dialog */
    .dialog-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,0.4);
      display:flex; align-items:center; justify-content:center; z-index:9998;
    }
    .dialog-box {
      background:var(--bg-secondary); border-radius:12px; padding:24px;
      width:300px; box-shadow:0 16px 48px rgba(0,0,0,0.3); border:1px solid var(--border);
    }
    .dialog-title { font-size:15px; font-weight:700; color:var(--text-primary); margin-bottom:8px; }
    .dialog-msg { font-size:13px; color:var(--text-secondary); margin-bottom:20px; line-height:1.5; }
    .dialog-actions { display:flex; justify-content:flex-end; gap:8px; }
    `;
}

function iconBack() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function iconClose() {
    return `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
}

function iconFolder() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function appLogo() {
    return `<svg viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
      <rect width="52" height="52" rx="13" fill="var(--accent)"/>
      <rect x="12" y="14" width="28" height="5" rx="2.5" fill="rgba(255,255,255,0.9)"/>
      <rect x="12" y="24" width="20" height="5" rx="2.5" fill="rgba(255,255,255,0.7)"/>
      <rect x="12" y="34" width="13" height="5" rx="2.5" fill="rgba(255,255,255,0.5)"/>
    </svg>`;
}
