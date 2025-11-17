
// process-picture.js
const sharp = require('sharp');

module.exports = async function processPicture(buffer) {
  // Resize cover image
  const coverBuffer = await sharp(buffer)
    .resize(1280, 720, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 85 })
    .toBuffer();
  return coverBuffer;
};
