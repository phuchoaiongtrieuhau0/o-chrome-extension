const { Jimp } = require('jimp');
const path = require('path');

const source = path.resolve(__dirname, '../extension/icons/icon128.png');

async function resize() {
  const image = await Jimp.read(source);
  
  await image.clone().resize({ w: 16, h: 16 }).write(path.resolve(__dirname, '../extension/icons/icon16.png'));
  await image.clone().resize({ w: 32, h: 32 }).write(path.resolve(__dirname, '../extension/icons/icon32.png'));
  await image.clone().resize({ w: 48, h: 48 }).write(path.resolve(__dirname, '../extension/icons/icon48.png'));
  
  console.log('Icons resized successfully');
}

resize().catch(console.error);
