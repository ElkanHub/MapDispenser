const fs = require('fs');
const path = require('path');

const mapsDir = path.join(process.cwd(), 'public', 'maps');

if (!fs.existsSync(mapsDir)) {
    fs.mkdirSync(mapsDir, { recursive: true });
}

const colors = ['#e0f2fe', '#f0fdf4', '#fefce8', '#fef2f2', '#fdf4ff'];
const secondaryColors = ['#0ea5e9', '#22c55e', '#eab308', '#ef4444', '#d946ef'];

for (let i = 1; i <= 5; i++) {
    const color = colors[i - 1];
    const secondary = secondaryColors[i - 1];

    const svgContent = `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="800" height="600" fill="${color}" />
  <path d="M0 0 L 800 600" stroke="${secondary}" stroke-width="2" opacity="0.1" />
  <path d="M800 0 L 0 600" stroke="${secondary}" stroke-width="2" opacity="0.1" />
  
  <rect x="50" y="50" width="700" height="500" rx="20" fill="none" stroke="${secondary}" stroke-width="4" stroke-dasharray="10 10" />
  
  <circle cx="400" cy="300" r="100" fill="${secondary}" opacity="0.2" />
  <circle cx="400" cy="300" r="80" fill="${secondary}" opacity="0.3" />
  <circle cx="400" cy="300" r="10" fill="${secondary}" />
  
  <text x="400" y="500" font-family="sans-serif" font-size="40" fill="${secondary}" text-anchor="middle" font-weight="bold">Territory #00${i}</text>
  <text x="400" y="540" font-family="sans-serif" font-size="20" fill="${secondary}" text-anchor="middle" opacity="0.8">Official Assignment Map</text>
</svg>`;

    fs.writeFileSync(path.join(mapsDir, `${i}.svg`), svgContent);
}

console.log('Generated 5 map SVGs in public/maps');
