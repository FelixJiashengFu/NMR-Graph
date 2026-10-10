const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const img = name => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, name)).toString('base64');
const html = read('template.html')
  .replace('__STYLE__', read('style.css'))
  .replace('__SCRIPT__', read('app.js'))
  .replace('__DETAIL__', img('detail.png'))
  .replace('__ORIGINAL__', img('original.png'));
fs.writeFileSync(path.join(base, 'index.html'), html, 'utf8');
console.log(`Built ${path.join(base, 'index.html')} (${Buffer.byteLength(html)} bytes)`);
