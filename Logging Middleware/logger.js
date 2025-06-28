// /Backend-Test-Submission/Logging-Middleware/logger.js

const http = require('http');

function Log(stack, level, pkg, message) {
  const payload = JSON.stringify({
    stack: stack.toLowerCase(),
    level: level.toLowerCase(),
    package: pkg.toLowerCase(),
    message
  });

  const options = {
    hostname: '20.244.56.144',
    port: 80,
    path: '/evaluation-service/logs',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log(`[RemoteLog] Success:`, json.message, `ID: ${json.logID}`);
      } catch {
        console.log(`[RemoteLog] Unexpected response format`);
      }
    });
  });

  req.on('error', (error) => {
    console.error(`[RemoteLog] Failed: ${error.message}`);
  });

  req.write(payload);
  req.end();
}

module.exports = { Log };
