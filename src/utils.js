export function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return s > 0 ? `${m}分${s}秒` : `${m}分钟`;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}时${m}分` : `${h}小时`;
}

export function formatDurationShort(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds/60)}m`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h${m}m` : `${h}h`;
}

// 颜色列表（配色用于图标背景）
const COLORS = [
    '#4FC3F7', '#81C784', '#FFB74D', '#F06292',
    '#BA68C8', '#4DB6AC', '#FF8A65', '#90A4AE',
    '#FFD54F', '#A5D6A7', '#80DEEA', '#FFCC02',
];

export function getAppColor(index) {
    return COLORS[index % COLORS.length];
}

// SVG 图标生成（根据应用名首字母）
export function getAppIconSVG(appName, size = 36) {
    const letter = (appName || '?').charAt(0).toUpperCase();
    const color = getAppColor(appName.charCodeAt(0) % COLORS.length);
    const textColor = isLightColor(color) ? '#333' : '#fff';
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${size * 0.28}" fill="${color}"/>
      <text x="${size/2}" y="${size/2 + size*0.13}" text-anchor="middle" font-size="${size * 0.44}" font-weight="600" fill="${textColor}" font-family="system-ui,-apple-system,sans-serif">${letter}</text>
    </svg>`;
}

function isLightColor(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return (r*299 + g*587 + b*114) / 1000 > 160;
}

export function svgToDataURL(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
