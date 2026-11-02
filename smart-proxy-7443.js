const net = require('net');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const certPath = path.join(__dirname, '.local', 'certs', 'attendance.ai-asaas.com.crt');
const keyPath = path.join(__dirname, '.local', 'certs', 'attendance.ai-asaas.com.key');

const cert = fs.readFileSync(certPath);
const key = fs.readFileSync(keyPath);

const NEXTJS_PORT = 7442;
const PUBLIC_PORT = 7443;

// 1. The HTTPS proxy server
const httpsServer = https.createServer({ key, cert }, (req, res) => {
  if (req.url.startsWith('/print-employees')) {
    const filePath = path.join(__dirname, 'frontend', 'public', 'print-employees.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(filePath).pipe(res);
  }

  const options = {
    hostname: '127.0.0.1',
    port: NEXTJS_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      'x-forwarded-proto': 'https',
      'x-forwarded-host': req.headers.host || `attendance.ai-asaas.com:${PUBLIC_PORT}`,
      'x-forwarded-for': req.socket.remoteAddress
    }
  };

  const proxyReq = http.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', err => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('جاري تجهيز النظام...');
    }
  });

  req.pipe(proxyReq, { end: true });
});

// 2. The HTTP redirect server (for plain http connections)
const httpServer = http.createServer((req, res) => {
  const host = (req.headers.host || 'attendance.ai-asaas.com').split(':')[0];
  const target = `https://${host}:${PUBLIC_PORT}${req.url}`;
  res.writeHead(301, { 
    'Location': target,
    'Content-Type': 'text/plain; charset=utf-8'
  });
  res.end(`Redirecting to ${target}`);
});

// 3. The smart master TCP server on port 7443
const masterServer = net.createServer(socket => {
  socket.once('data', buffer => {
    socket.pause();
    socket.unshift(buffer);
    if (buffer[0] === 0x16) {
      httpsServer.emit('connection', socket);
    } else {
      httpServer.emit('connection', socket);
    }
    process.nextTick(() => socket.resume());
  });

  socket.on('error', () => {});
});

masterServer.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`Smart Dual HTTP/HTTPS Proxy listening on 0.0.0.0:${PUBLIC_PORT}`);
});

const masterServer8443 = net.createServer(socket => {
  socket.once('data', buffer => {
    socket.pause();
    socket.unshift(buffer);
    if (buffer[0] === 0x16) {
      httpsServer.emit('connection', socket);
    } else {
      httpServer.emit('connection', socket);
    }
    process.nextTick(() => socket.resume());
  });
  socket.on('error', () => {});
});

masterServer8443.listen(8443, '0.0.0.0', () => {
  console.log(`Smart Dual HTTP/HTTPS Proxy listening on 0.0.0.0:8443`);
});

