#!/usr/bin/env node

/**
 * Test Script for URL Shortener Microservice
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'URL-Shortener-Test-Script/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });

      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testServerConnection() {
  console.log('\nTesting Server Connection...');
  try {
    const response = await makeRequest('GET', '/');
    console.log(`Server Connected: ${response.statusCode}`);
    if (response.body) {
      console.log(`Service: ${response.body.service || 'URL Shortener'}`);
    }
    return true;
  } catch (error) {
    console.log(`Server Connection failed:`, error.message);
    return false;
  }
}

async function testCreateShortUrl() {
  console.log('\nTesting POST /shorturls - Create Short URL');
  
  const testCases = [
    { name: 'Valid URL with custom shortcode', data: { url: 'https://www.google.com', validity: 30, shortcode: 'google1' }, expectedStatus: 201 },
    { name: 'Valid URL without shortcode (auto-generated)', data: { url: 'https://www.example.com', validity: 60 }, expectedStatus: 201 },
    { name: 'Valid URL with default validity', data: { url: 'https://www.github.com' }, expectedStatus: 201 },
    { name: 'Invalid URL format', data: { url: 'not-a-valid-url', validity: 30 }, expectedStatus: 400 },
    { name: 'Missing URL field', data: { validity: 30, shortcode: 'nourl' }, expectedStatus: 400 },
    { name: 'Invalid shortcode (too short)', data: { url: 'https://www.example.com', shortcode: 'ab' }, expectedStatus: 400 },
    { name: 'Invalid shortcode (special characters)', data: { url: 'https://www.example.com', shortcode: 'test@123' }, expectedStatus: 400 },
    { name: 'Invalid validity (too high)', data: { url: 'https://www.example.com', validity: 600000 }, expectedStatus: 400 },
    { name: 'Duplicate shortcode', data: { url: 'https://www.duplicate.com', shortcode: 'google1' }, expectedStatus: 409 }
  ];

  const results = [];

  for (const testCase of testCases) {
    try {
      console.log(`\nTesting: ${testCase.name}`);
      const response = await makeRequest('POST', '/shorturls', testCase.data);

      const passed = response.statusCode === testCase.expectedStatus;
      console.log(`Expected: ${testCase.expectedStatus}, Got: ${response.statusCode}`);
      
      if (response.body) {
        if (response.statusCode === 201) {
          console.log(`Short Link: ${response.body.shortLink}`);
          console.log(`Expires: ${response.body.expiry}`);
        } else {
          console.log(`Message: ${response.body.message || JSON.stringify(response.body)}`);
        }
      }

      let shortcode = null;
      if (response.body?.shortLink) {
        shortcode = response.body.shortLink.split('/').pop();
      }

      results.push({ name: testCase.name, passed, shortLink: response.body?.shortLink, shortcode });
    } catch (error) {
      console.log(`Error:`, error.message);
      results.push({ name: testCase.name, passed: false });
    }
  }

  return results;
}

async function testGetStatistics(shortcode) {
  console.log(`\nTesting GET /shorturls/${shortcode} - Statistics`);
  try {
    const response = await makeRequest('GET', `/shorturls/${shortcode}`);
    if (response.statusCode === 200) {
      console.log(`Original URL: ${response.body.originalUrl}`);
      console.log(`Total Clicks: ${response.body.totalClicks}`);
      console.log(`Active: ${response.body.isActive}`);
      console.log(`Created: ${response.body.createdAt}`);
      console.log(`Expires: ${response.body.expiryDate}`);
      if (response.body.clickDetails?.length) {
        response.body.clickDetails.forEach((c, i) => {
          console.log(`#${i + 1} ${c.timestamp} | ${c.referrer} | ${c.location?.city || 'Unknown'}`);
        });
      }
      return true;
    } else {
      console.log(`Unexpected Response: ${response.statusCode}`, response.body);
      return false;
    }
  } catch (error) {
    console.log(`Failed to get statistics:`, error.message);
    return false;
  }
}

async function testRedirect(shortcode) {
  console.log(`\nTesting GET /${shortcode} - Redirect`);
  try {
    const response = await makeRequest('GET', `/${shortcode}`);
    if (response.statusCode === 302) {
      console.log(`Redirected to: ${response.headers.location}`);
      return true;
    } else {
      console.log(`Unexpected response: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log(`Redirect failed:`, error.message);
    return false;
  }
}

async function testInvalidShortcodes() {
  console.log('\nTesting Invalid Shortcodes...');
  const invalidCodes = [
    { code: 'ab', reason: 'too short' },
    { code: 'test@123', reason: 'special characters' },
    { code: '123456789012345678901', reason: 'too long' }
  ];

  for (const { code, reason } of invalidCodes) {
    try {
      console.log(`\nTesting invalid shortcode: ${code} (${reason})`);
      const statsRes = await makeRequest('GET', `/shorturls/${code}`);
      const redirectRes = await makeRequest('GET', `/${code}`);
      console.log(`Stats Status: ${statsRes.statusCode}, Redirect Status: ${redirectRes.statusCode}`);
    } catch (error) {
      console.log(`Error testing ${code}:`, error.message);
    }
  }
}

async function runAllTests() {
  console.log('Starting URL Shortener Microservice Tests');

  const serverConnected = await testServerConnection();
  if (!serverConnected) {
    console.log('\nServer connection failed. Is the server running on localhost:3000?');
    return;
  }

  const createResults = await testCreateShortUrl();
  const successful = createResults.find(r => r.passed && r.shortcode);

  if (successful) {
    await testGetStatistics(successful.shortcode);
    await testRedirect(successful.shortcode);
    await new Promise(resolve => setTimeout(resolve, 300));
    await testGetStatistics(successful.shortcode);
  }

  await testInvalidShortcodes();

  const total = createResults.length;
  const passed = createResults.filter(r => r.passed).length;

  console.log('\nTest Summary');
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Failed: ${total - passed}/${total}`);
}

if (require.main === module) {
  runAllTests().catch((err) => {
    console.error('Test script failed:', err.message);
    process.exit(1);
  });
}

module.exports = {
  makeRequest,
  runAllTests,
  testServerConnection,
  testCreateShortUrl,
  testGetStatistics,
  testRedirect
};
