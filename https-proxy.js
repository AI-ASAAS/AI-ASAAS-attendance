const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const certPath = path.join(__dirname, '.local', 'certs', 'attendance.ai-asaas.com.crt');
const keyPath = path.join(__dirname, '.local', 'certs', 'attendance.ai-asaas.com.key');

const cert = fs.readFileSync(certPath);
const key = fs.readFileSync(keyPath);

const PORT = 8088;

const server = https.createServer({ key, cert }, (req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 7443,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      'x-forwarded-proto': 'https',
      'x-forwarded-host': req.headers.host || 'attendance.ai-asaas.com:8088',
      'x-forwarded-for': req.socket.remoteAddress
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway');
    }
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTPS Reverse Proxy listening on 0.0.0.0:${PORT}`);
});

// Also create an HTTP redirect server on port 8090
const httpRedirectServer = http.createServer((req, res) => {
  const host = (req.headers.host || 'attendance.ai-asaas.com').split(':')[0];
  const target = `https://${host}:${PORT}${req.url}`;
  res.writeHead(301, { Location: target });
  res.end(`Redirecting to ${target}`);
});

httpRedirectServer.listen(8090, '0.0.0.0', () => {
  console.log(`HTTP Redirect Server listening on 0.0.0.0:8090 -> redirects to :${PORT}`);
});

