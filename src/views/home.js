import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { formatDuration, getAppIconSVG } from '../utils.js';

let refreshTimer = null;
let isFirstLoad = true;

export async function renderHome(container, onSettings) {
    container.innerHTML = `<style>${getStyles()}</style>
    <div class="app-root">
      <div class="titlebar" id="titlebar-drag">
        <div class="titlebar-icon">${appMiniIcon()}</div>
        <div class="titlebar-title" id="titlebar-title">应用时长</div>
        <div class="tab-group">
          <button class="tab active" id="tab-today">今日</button>
          <button class="tab" id="tab-7">近7天</button>
          <button class="tab" id="tab-30">近30天</button>
        </div>
        <button class="titlebar-btn" id="btn-settings" title="设置">${iconSettings()}</button>
        <button class="titlebar-btn close-btn" id="btn-close" title="隐藏到托盘">${iconClose()}</button>
      </div>

      <div class="content" id="content">
        <div class="loading">
          <div class="spinner"></div>
          <span>加载中...</span>
        </div>
      </div>
    </div>`;

    let currentRange = 'today';

    async function getRefreshInterval() {
        try {
            return await invoke('get_refresh_interval');
        } catch { return 60; }
    }

    async function loadData() {
        const content = document.getElementById('content');
        if (!content) return;

        // 只在首次加载时显示loading，后续刷新静默更新
        if (isFirstLoad) {
            content.innerHTML = `<div class="loading"><div class="spinner"></div><span>加载中...</span></div>`;
        }

        try {
            let data, chartData = null, hourlyData = null;
            if (currentRange === 'today') {
                data = await invoke('get_today_usage');
                hourlyData = await invoke('get_hourly_usage_today');
            } else {
                const days = currentRange === 7 ? 7 : 30;
                data = currentRange === 7
                    ? await invoke('get_app_usage_7days')
                    : await invoke('get_app_usage_30days');
                chartData = await invoke('get_daily_usage', { days });
            }
            renderContent(content, data, currentRange, chartData, hourlyData);
            isFirstLoad = false;
        } catch (e) {
            if (isFirstLoad) {
                content.innerHTML = `<div class="error">加载失败: ${e}</div>`;
            }
        }
    }

    function renderAppIcon(app) {
        if (app.icon_base64) {
            return `<img src="data:image/png;base64,${escHtml(app.icon_base64)}" class="app-icon-img" />`;
        }
        return getAppIconSVG(app.app_name, 38);
    }

    function renderContent(content, data, range, chartData, hourlyData) {
        if (!data || data.length === 0) {
            content.innerHTML = `<div class="empty">
              ${emptyIcon()}
              <p>暂无记录</p>
              <p class="empty-sub">开始使用应用后会自动记录</p>
            </div>`;
            return;
        }

        const total = data.reduce((sum, d) => sum + d.total_seconds, 0);

        let chartHtml = '';
        if (range === 'today' && hourlyData && hourlyData.length > 0) {
            // 今日按2小时柱状图
            const maxSec = Math.max(...hourlyData.map(d => d.total_seconds), 1);
            chartHtml = `<div class="chart-section">
              <div class="chart-title">今日使用时段</div>
              <div class="daily-chart" id="daily-chart">
                ${hourlyData.map(d => {
                    const pct = (d.total_seconds / maxSec * 100).toFixed(1);
                    const label = `${d.hour}:00`;
                    return `<div class="bar-col" data-tooltip="${label}  ${formatDuration(d.total_seconds)}">
                      <div class="bar-fill" style="height:${pct}%"></div>
                      <div class="bar-label">${label}</div>
                    </div>`;
                }).join('')}
              </div>
            </div>`;
        } else if (chartData && chartData.length > 0 && range !== 'today') {
            const maxSec = Math.max(...chartData.map(d => d.total_seconds), 1);
            const barCount = chartData.length;
            // 30天时标签间隔显示
            const showEvery = barCount > 15 ? 3 : (barCount > 7 ? 2 : 1);

            chartHtml = `<div class="chart-section">
              <div class="chart-title">每日使用时长</div>
              <div class="daily-chart" id="daily-chart">
                ${chartData.map((d, i) => {
                    const pct = (d.total_seconds / maxSec * 100).toFixed(1);
                    const dayLabel = d.date.slice(5); // MM-DD
                    const showLabel = (i % showEvery === 0 || i === chartData.length - 1);
                    return `<div class="bar-col" data-tooltip="${d.date}  ${formatDuration(d.total_seconds)}">
                      <div class="bar-fill" style="height:${pct}%"></div>
                      <div class="bar-label">${showLabel ? dayLabel : ''}</div>
                    </div>`;
                }).join('')}
              </div>
            </div>`;
        }

        const maxSec = data[0].total_seconds;

        content.innerHTML = `
          <div class="summary-bar">
            <div class="summary-item">
              <span class="summary-label">共追踪</span>
              <span class="summary-value">${data.length} 款应用</span>
            </div>
            <div class="summary-divider"></div>
            <div class="summary-item">
              <span class="summary-label">累计使用</span>
              <span class="summary-value">${formatDuration(total)}</span>
            </div>
          </div>

          ${chartHtml}

          <div class="chart-section">
            <div class="chart-title">使用时长排行</div>
            <div class="app-list" id="app-list"></div>
          </div>
        `;

        const list = document.getElementById('app-list');
        data.slice(0, 20).forEach((app, idx) => {
            const pct = maxSec > 0 ? (app.total_seconds / maxSec * 100) : 0;
            const item = document.createElement('div');
            item.className = 'app-item';
            item.innerHTML = `
              <div class="app-rank">${idx + 1}</div>
              <div class="app-icon">${renderAppIcon(app)}</div>
              <div class="app-info">
                <div class="app-name">${escHtml(app.app_name)}</div>
                <div class="app-bar-wrap">
                  <div class="app-bar" style="width:${pct.toFixed(1)}%"></div>
                </div>
              </div>
              <div class="app-time">${formatDuration(app.total_seconds)}</div>
            `;
            list.appendChild(item);
        });

        // 柱状图 tooltip — 用 fixed 定位跟随鼠标，不跑出窗口
        setupChartTooltip();
    }

    function setupChartTooltip() {
        const chart = document.getElementById('daily-chart');
        if (!chart) return;

        // 创建全局 tooltip（fixed 定位）
        let tooltip = document.getElementById('chart-tooltip-global');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'chart-tooltip-global';
            tooltip.className = 'chart-tooltip';
            document.body.appendChild(tooltip);
        }

        chart.querySelectorAll('.bar-col').forEach(col => {
            col.addEventListener('mouseenter', () => {
                tooltip.textContent = col.dataset.tooltip;
                tooltip.style.display = 'block';
            });
            col.addEventListener('mousemove', (e) => {
                // fixed 定位，直接用 clientX/Y，自动限制在视口内
                let x = e.clientX + 12;
                let y = e.clientY - 32;
                // 防止超出右边
                const tipW = tooltip.offsetWidth || 120;
                if (x + tipW > window.innerWidth - 8) {
                    x = e.clientX - tipW - 8;
                }
                // 防止超出上方
                if (y < 4) y = e.clientY + 16;
                tooltip.style.left = x + 'px';
                tooltip.style.top = y + 'px';
            });
            col.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        });
    }

    // 滚动条：滚轮滚动时显示，停止后自动隐藏
    const contentEl = document.getElementById('content');
    let scrollHideTimer = null;
    if (contentEl) {
        contentEl.addEventListener('scroll', () => {
            contentEl.classList.add('scrolling');
            clearTimeout(scrollHideTimer);
            scrollHideTimer = setTimeout(() => {
                contentEl.classList.remove('scrolling');
            }, 1200);
        });
    }

    // 手动实现拖拽
    const titlebar = document.getElementById('titlebar-drag');
    if (titlebar) {
        titlebar.addEventListener('mousedown', async (e) => {
            if (e.target.closest('.titlebar-btn') || e.target.closest('.tab')) return;
            try {
                await getCurrentWindow().startDragging();
            } catch (err) {}
        });
    }

    // tab 切换
    document.getElementById('tab-today').addEventListener('click', () => {
        currentRange = 'today';
        isFirstLoad = true;
        document.getElementById('tab-today').classList.add('active');
        document.getElementById('tab-7').classList.remove('active');
        document.getElementById('tab-30').classList.remove('active');
        loadData();
    });
    document.getElementById('tab-7').addEventListener('click', () => {
        currentRange = 7;
        isFirstLoad = true;
        document.getElementById('tab-today').classList.remove('active');
        document.getElementById('tab-7').classList.add('active');
        document.getElementById('tab-30').classList.remove('active');
        loadData();
    });
    document.getElementById('tab-30').addEventListener('click', () => {
        currentRange = 30;
        isFirstLoad = true;
        document.getElementById('tab-today').classList.remove('active');
        document.getElementById('tab-7').classList.remove('active');
        document.getElementById('tab-30').classList.add('active');
        loadData();
    });

    document.getElementById('btn-settings').addEventListener('click', onSettings);
    document.getElementById('btn-close').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await getCurrentWindow().hide();
        } catch (err) {
            console.error('hide failed:', err);
        }
    });

    // 定时刷新 — 每次加载时重新读取间隔并设置定时器
    async function setupRefreshTimer() {
        if (refreshTimer) clearInterval(refreshTimer);
        const interval = await getRefreshInterval();
        refreshTimer = setInterval(loadData, interval * 1000);
    }

    setupRefreshTimer();
    loadData();
}

function getStyles() {
    return `
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #app { width:100%; height:100%; overflow:hidden; }
    body { background:transparent; font-family:"Microsoft YaHei UI","Segoe UI Variable",system-ui,sans-serif; color: var(--text-primary); }

    .app-root {
      width:100%; height:100%;
      background: var(--bg-primary);
      backdrop-filter: blur(120px) saturate(200%) brightness(1.05);
      -webkit-backdrop-filter: blur(120px) saturate(200%) brightness(1.05);
      border-radius: 12px;
      border: 1px solid var(--border);
      box-shadow: var(--shadow), 0 0 0 1px rgba(255,255,255,0.05) inset;
      display:flex; flex-direction:column; overflow:hidden;
    }

    .titlebar {
      height:48px; display:flex; align-items:center; padding:0 8px 0 12px;
      border-bottom: 1px solid var(--border);
      user-select:none; -webkit-user-select:none; flex-shrink:0; gap:4px;
    }
    .titlebar-icon { width:20px; height:20px; display:flex; align-items:center; margin-right:2px; }
    .titlebar-title { font-size:14px; font-weight:700; color:var(--text-primary); flex:0 0 auto; margin-right:8px; }
    .tab-group { display:flex; flex:1; gap:2px; }
    .tab {
      flex:1; height:28px; border-radius:6px; border:none; background:transparent;
      font-size:12px; color:var(--text-secondary); cursor:pointer; transition:all 0.15s;
      font-family:inherit; font-weight:500;
    }
    .tab:hover { background:var(--bg-hover); color:var(--text-primary); }
    .tab.active { background:var(--accent-bg); color:var(--accent); font-weight:600; }

    .titlebar-btn {
      width:32px; height:32px; border-radius:8px; border:none;
      background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center;
      color:var(--text-secondary); transition:background 0.15s; flex-shrink:0;
    }
    .titlebar-btn:hover { background:var(--bg-hover); color:var(--text-primary); }
    .close-btn:hover { background:#C42B1C !important; color:white !important; }

    .content { flex:1; min-height:0; overflow-y:auto; padding:0; background:var(--bg-primary); }
    .content::-webkit-scrollbar { width:6px; }
    .content::-webkit-scrollbar-track { background:transparent; }
    .content::-webkit-scrollbar-thumb { background:transparent; border-radius:3px; transition:background 0.3s; }
    .content:hover::-webkit-scrollbar-thumb { background:var(--scrollbar-bg); }
    .content.scrolling::-webkit-scrollbar-thumb { background:var(--scrollbar-bg); }

    .loading, .error, .empty {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      height:100%; gap:12px; color:var(--text-secondary); font-size:14px;
    }
    .empty-sub { font-size:12px; color:var(--text-tertiary); }

    .spinner {
      width:28px; height:28px; border:3px solid var(--border);
      border-top-color:var(--accent); border-radius:50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform:rotate(360deg); } }

    .summary-bar {
      display:flex; align-items:center; padding:14px 16px;
      border-bottom:1px solid var(--border); gap:0;
    }
    .summary-item { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; }
    .summary-label { font-size:11px; color:var(--text-secondary); }
    .summary-value { font-size:15px; font-weight:700; color:var(--text-primary); }
    .summary-divider { width:1px; height:32px; background:var(--border); }

    .chart-section { padding: 12px 0 8px; position:relative; }
    .chart-title { font-size:12px; color:var(--text-tertiary); padding: 0 16px 8px; text-transform:uppercase; letter-spacing:0.5px; }

    .app-item {
      display:flex; align-items:center; padding:10px 16px;
      gap:10px; transition:background 0.12s; cursor:default;
    }
    .app-item:hover { background:var(--bg-hover); }

    .app-rank { width:18px; font-size:11px; color:var(--text-tertiary); text-align:center; flex-shrink:0; font-weight:600; }
    .app-item:nth-child(1) .app-rank { color:#FFB400; }
    .app-item:nth-child(2) .app-rank { color:#9E9E9E; }
    .app-item:nth-child(3) .app-rank { color:#CD7F32; }

    .app-icon { width:38px; height:38px; flex-shrink:0; border-radius:10px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    .app-icon svg { width:100%; height:100%; }
    .app-icon-img { width:38px; height:38px; border-radius:10px; object-fit:cover; }

    .app-info { flex:1; min-width:0; }
    .app-name { font-size:13px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:5px; }
    .app-bar-wrap { height:4px; background:var(--bar-bg); border-radius:2px; overflow:hidden; }
    .app-bar { height:100%; background:var(--accent); border-radius:2px; transition:width 0.6s ease; }

    .app-time { font-size:12px; font-weight:600; color:var(--text-secondary); flex-shrink:0; min-width:48px; text-align:right; }

    /* 柱状图 — 关键修改：加 padding 防溢出，bar-fill 限制最大宽度 */
    .daily-chart {
      display:flex; align-items:flex-end; gap:2px;
      height:140px; padding:0 24px; position:relative;
      margin:0 8px;
    }
    .bar-col {
      flex:1; display:flex; flex-direction:column; align-items:center;
      justify-content:flex-end; height:100%; position:relative; cursor:pointer;
      padding:0 1px; min-width:0;
    }
    .bar-fill {
      width:100%; max-width:24px; min-width:3px; min-height:2px;
      background:var(--accent); border-radius:2px 2px 0 0;
      transition:height 0.4s ease; opacity:0.8;
      align-self:center;
    }
    .bar-col:hover .bar-fill { opacity:1; }
    .bar-label {
      font-size:9px; color:var(--text-tertiary); margin-top:4px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      max-width:100%; text-align:center; min-height:14px;
    }
    .chart-tooltip {
      display:none; position:fixed; z-index:9999;
      background:var(--bg-secondary);
      border:1px solid var(--border-strong); border-radius:6px;
      padding:6px 10px; font-size:11px; color:var(--text-primary);
      pointer-events:none; box-shadow:0 2px 8px rgba(0,0,0,0.25);
      white-space:nowrap;
    }
    `;
}

function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function appMiniIcon() {
    return `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <rect width="20" height="20" rx="5" fill="var(--accent)"/>
      <rect x="4" y="5" width="12" height="2" rx="1" fill="rgba(255,255,255,0.9)"/>
      <rect x="4" y="9" width="8" height="2" rx="1" fill="rgba(255,255,255,0.7)"/>
      <rect x="4" y="13" width="5" height="2" rx="1" fill="rgba(255,255,255,0.5)"/>
    </svg>`;
}

function iconSettings() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2"/>
    </svg>`;
}

function iconClose() {
    return `<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
}

function emptyIcon() {
    return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="12" width="48" height="40" rx="6" fill="var(--bar-bg)"/>
      <rect x="16" y="24" width="32" height="4" rx="2" fill="var(--border-strong, rgba(0,0,0,0.12))"/>
      <rect x="16" y="34" width="20" height="4" rx="2" fill="var(--border-strong, rgba(0,0,0,0.12))"/>
    </svg>`;
}
