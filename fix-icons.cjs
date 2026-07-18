const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'CreatePersonView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  [/\bicon: 'Ã°Å¸Ââ€°'/g, "icon: '⚽'"],
  [/Giocatore Ã°Å¸Å¸Â¥/g, 'Giocatore 🔥'],
  [/\bicon: 'Ã°Å¸â€œÂ'/g, "icon: '📝'"],
  [/\bicon: 'Ã°Å¸ÂÂ¥'/g, "icon: '🩹'"],
  [/\bicon: 'Ã°Å¸â€˜Â¨Ã¢â‚¬ÂÃ°Å¸â€˜Â©Ã¢â‚¬ÂÃ°Å¸â€˜Â§Ã¢â‚¬ÂÃ°Å¸â€˜Â¦'/g, "icon: '👨‍👩‍👦‍👦'"],
  [/\bicon: 'Ã°Å¸â€˜Â¥'/g, "icon: '👔'"],
  [/\bicon: 'Ã°Å¸Ââ€°'/g, "icon: '⚽'"],
  [/\bicon: 'Ã°Å¸â€œÂ'/g, "icon: '📝'"],
  [/\bicon: 'Ã°Å¸ÂÂ¥'/g, "icon: '🩹'"],
  // Family icon (mojibake of 👨‍👩‍👦‍👦)
  [/icon: 'Ã°Å¸â€˜Â¨Ã¢â‚¬ÂÃ°Å¸â€˜Â©Ã¢â‚¬ÂÃ°Å¸â€˜Â§Ã¢â‚¬ÂÃ°Å¸â€˜Â¦'/g, "icon: '👨‍👩‍👦‍👦'"],
  [/\bicon: 'Ã°Å¸â€˜Â¥'/g, "icon: '👔'"],
];

let changed = false;
for (const [pattern, replacement] of replacements) {
  const newContent = content.replace(pattern, replacement);
  if (newContent !== content) {
    content = newContent;
    changed = true;
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done. Changed:', changed);
