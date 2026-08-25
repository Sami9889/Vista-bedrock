const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 19144;

// Simple HTTP server for serving files
const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }
  
  const extname = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.css': 'text/css',
    '.mcaddon': 'application/octet-stream'
  };
  
  const contentType = contentTypes[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Vista debugger server running on port ${PORT}`);
  console.log(`Connect in Minecraft: /script debugger connect`);
  console.log(`Or use: /script debugger ${process.env.DEBUGGER_HOST || 'localhost'}:${PORT}`);
});
