/**
 * 图标生成脚本
 * 运行: node scripts/gen-icons.js
 * 依赖: 需要先 npm install canvas (仅用于生成图标)
 * 
 * 此脚本会生成一套蓝色主题的默认图标
 * 如果你有自己的图标，直接用: npx tauri icon your-icon.png
 */

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../src-tauri/icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// 生成一个简单的 SVG 图标并转为提示
const svgIcon = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="128" fill="#0067C0"/>
  <rect x="112" y="140" width="288" height="56" rx="28" fill="rgba(255,255,255,0.95)"/>
  <rect x="112" y="228" width="200" height="56" rx="28" fill="rgba(255,255,255,0.75)"/>
  <rect x="112" y="316" width="130" height="56" rx="28" fill="rgba(255,255,255,0.55)"/>
</svg>`;

const svgPath = path.join(iconsDir, 'icon.svg');
fs.writeFileSync(svgPath, svgIcon);

console.log('✅ SVG 图标已生成:', svgPath);
console.log('');
console.log('下一步：将此 SVG 转换为 PNG 后运行:');
console.log('  npx tauri icon src-tauri/icons/icon.png');
console.log('');
console.log('推荐在线转换: https://svgtopng.com/ (导出 512x512)');
