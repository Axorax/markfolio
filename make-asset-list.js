const fs = require('fs');
const path = require('path');

const folderPath = './images';
const repoUrl = 'https://raw.githubusercontent.com/Axorax/markfolio/476d2242727560ca1a584d351a8e2a40f71ec57e';

fs.readdir(folderPath, (err, files) => {
  if (err) {
    console.error('Error reading folder:', err);
    return;
  }

  let assets = [];
  files.forEach(file => {
    const fileUrl = `${repoUrl}/images/${file}`;
    assets.push(fileUrl);
  });

  const assetsString = `let assets = ${JSON.stringify(assets, null, 2)};`;

  const outputPath = './data/assets.js';
  fs.writeFile(outputPath, assetsString, (writeErr) => {
    if (writeErr) {
      console.error('Error writing to file:', writeErr);
    } else {
      console.log(`Assets list written to ${outputPath}`);
    }
  });
});
