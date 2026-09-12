// Stamps the service worker with a per-build version so installed apps
// detect updates. Runs automatically via the `prebuild` npm script.
import fs from 'fs';

const template = fs.readFileSync('scripts/sw.template.js', 'utf8');
const version = `${Date.now().toString(36)}`;
fs.writeFileSync('public/sw.js', template.replace(/__BUILD_VERSION__/g, version));
console.log(`service worker built (version ${version})`);
