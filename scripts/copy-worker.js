const fs = require('fs');
const path = require('path');

const srcMjs = path.join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const srcJs = path.join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.js');
const destDir = path.join(__dirname, '../assets');
const dest = path.join(destDir, 'pdf.worker.min.js'); // Always output as .js for Chrome Extension compatibility

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

let srcFile = null;
if (fs.existsSync(srcMjs)) {
  srcFile = srcMjs;
} else if (fs.existsSync(srcJs)) {
  srcFile = srcJs;
}

if (srcFile) {
  let content = fs.readFileSync(srcFile, 'utf8');
  // Strip export { WorkerMessageHandler }; or export{WorkerMessageHandler}; from the end
  const originalLength = content.length;
  content = content.replace(/export\s*\{\s*WorkerMessageHandler\s*\}\s*;?\s*$/, '');
  
  if (content.length === originalLength) {
    // Try without trailing space/newline constraints in case there is a sourceMappingURL comment after it
    content = content.replace(/export\s*\{\s*WorkerMessageHandler\s*\}\s*;?/, '');
  }

  fs.writeFileSync(dest, content, 'utf8');
  console.log(`PDF.js worker copied from ${srcFile} and modified to classic worker successfully.`);
} else {
  console.error('Could not find pdf.worker in node_modules/pdfjs-dist/build/');
}

