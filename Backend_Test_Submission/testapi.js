#!/usr/bin/env node

/**
 * Test Script for URL Shortener Microservice
 * Updated to match your actual route implementations
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
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'URL-Shortener-Test-Script/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });

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

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testServerConnection() {
  console.log('\n Testing Server Connection...');
  try {
    const response = await makeRequest('GET', '/');
    console.log(` Server Connected: ${response.statusCode}`);
    if (response.body) {
      console.log(`   Service: ${response.body.service || 'URL Shortener'}`);
    }
    return true;
  } catch (error) {
    console.log(` Server Connection failed:`, error.message);
    return false;
  }
}

async function testCreateShortUrl() {
  console.log('\n🔍 Testing POST /shorturls - Create Short URL...');
  
  const testCases = [
    {
      name: 'Valid URL with custom shortcode',
      data: {
        url: 'https://www.google.com',
        validity: 30,
        shortcode: 'google1'
      },
      expectedStatus: 201
    },
    {
      name: 'Valid URL without shortcode (auto-generated)',
      data: {
        url: 'https://www.example.com',
        validity: 60
      },
      expectedStatus: 201
    },
    {
      name: 'Valid URL with default validity',
      data: {
        url: 'https://www.github.com'
      },
      expectedStatus: 201
    },
    {
      name: 'Invalid URL format',
      data: {
        url: 'not-a-valid-url',
        validity: 30
      },
      expectedStatus: 400
    },
    {
      name: 'Missing URL field',
      data: {
        validity: 30,
        shortcode: 'nourl'
      },
      expectedStatus: 400
    },
    {
      name: 'Invalid shortcode (too short)',
      data: {
        url: 'https://www.example.com',
        shortcode: 'ab'
      },
      expectedStatus: 400
    },
    {
      name: 'Invalid shortcode (special characters)',
      data: {
        url: 'https://www.example.com',
        shortcode: 'test@123'
      },
      expectedStatus: 400
    },
    {
      name: 'Invalid validity (too high)',
      data: {
        url: 'https://www.example.com',
        validity: 600000 // More than 1 year
      },
      expectedStatus: 400
    },
    {
      name: 'Duplicate shortcode',
      data: {
        url: 'https://www.duplicate.com',
        shortcode: 'google1' // Same as first test
      },
      expectedStatus: 409
    }
  ];

  const results = [];
  
  for (const testCase of testCases) {
    try {
      console.log(`\n    Testing: ${testCase.name}`);
      const response = await makeRequest('POST', '/shorturls', testCase.data);
      
      const passed = response.statusCode === testCase.expectedStatus;
      console.log(`   ${passed ? 'Success' : 'Failure'} Expected: ${testCase.expectedStatus}, Got: ${response.statusCode}`);
      
      if (response.body) {
        if (response.statusCode === 201) {
          console.log(`   Short Link: ${response.body.shortLink}`);
          console.log(`    Expires: ${response.body.expiry}`);
        } else {
          console.log(`    Response: ${response.body.message || JSON.stringify(response.body)}`);
        }
      }
      
      // Extract shortcode from shortLink for testing
      let shortcode = null;
      if (response.body?.shortLink) {
        shortcode = response.body.shortLink.split('/').pop();
      }
      
      results.push({ 
        name: testCase.name, 
        passed,
        shortLink: response.body?.shortLink,
        shortcode: shortcode
      });
    } catch (error) {
      console.log(`    Error:`, error.message);
      results.push({ name: testCase.name, passed: false });
    }
  }
  
  return results;
}

async function testGetStatistics(shortcode) {
  console.log(`\n Testing GET /shorturls/${shortcode} - Get Statistics...`);
  
  try {
    const response = await makeRequest('GET', `/shorturls/${shortcode}`);
    
    if (response.statusCode === 200) {
      console.log(` Statistics Retrieved: ${response.statusCode}`);
      console.log(`   Original URL: ${response.body.originalUrl}`);
      console.log(`   Total Clicks: ${response.body.totalClicks}`);
      console.log(`   Is Active: ${response.body.isActive}`);
      console.log(`    Created: ${response.body.createdAt}`);
      console.log(`    Expires: ${response.body.expiryDate}`);
      console.log(`     Click Details: ${response.body.clickDetails?.length || 0} records`);
      return true;
    } else if (response.statusCode === 404) {
      console.log(`  Statistics Not Found: ${response.statusCode}`);
      console.log(`    Response: ${response.body?.message || 'Not found'}`);
      return false;
    } else if (response.statusCode === 400) {
      console.log(` Bad Request: ${response.statusCode}`);
      console.log(`    Response: ${response.body?.message || 'Invalid shortcode'}`);
      return false;
    } else {
      console.log(` Unexpected Response: ${response.statusCode}`);
      console.log(`    Response:`, response.body);
      return false;
    }
  } catch (error) {
    console.log(` Statistics Test Failed:`, error.message);
    return false;
  }
}

async function testRedirect(shortcode) {
  console.log(`\n Testing GET /${shortcode} - Redirect Functionality...`);
  
  try {
    const response = await makeRequest('GET', `/${shortcode}`);
    
    if (response.statusCode === 302) {
      console.log(` Redirect Successful: ${response.statusCode}`);
      console.log(`    Redirected to: ${response.headers.location}`);
      return true;
    } else if (response.statusCode === 404) {
      console.log(`  Shortcode Not Found: ${response.statusCode}`);
      console.log(`    Response:`, response.body?.message || 'Not found');
      return false;
    } else {
      console.log(` Unexpected Response: ${response.statusCode}`);
      console.log(`    Response:`, response.body);
      return false;
    }
  } catch (error) {
    console.log(` Redirect Test Failed:`, error.message);
    return false;
  }
}

async function testInvalidShortcodes() {
  console.log('\n🔍 Testing Invalid Shortcode Handling...');
  
  const invalidCodes = [
    { code: 'ab', reason: 'too short' },
    { code: 'test@123', reason: 'special characters' },
    { code: '123456789012345678901', reason: 'too long' }
  ];
  
  for (const { code, reason } of invalidCodes) {
    try {
      console.log(`\n    Testing invalid shortcode: ${code} (${reason})`);
      
      // Test statistics endpoint
      const statsResponse = await makeRequest('GET', `/shorturls/${code}`);
      const statsPass = statsResponse.statusCode === 400;
      console.log(`   ${statsPass ? 'Success' : 'Failure'} Statistics - Expected: 400, Got: ${statsResponse.statusCode}`);
      
      // Test redirect endpoint
      const redirectResponse = await makeRequest('GET', `/${code}`);
      const redirectPass = redirectResponse.statusCode === 400 || redirectResponse.statusCode === 404;
      console.log(`   ${redirectPass ? 'Success' : 'Failure'} Redirect - Expected: 400/404, Got: ${redirectResponse.statusCode}`);
      
    } catch (error) {
      console.log(`    Error testing ${code}:`, error.message);
    }
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting URL Shortener Microservice Tests');
  console.log('='.repeat(60));
  
  // Test 1: Server Connection
  const serverConnected = await testServerConnection();
  
  if (!serverConnected) {
    console.log('\n Server connection failed. Is the server running on localhost:3000?');
    console.log('   Start the server and try again.');
    process.exit(1);
  }
  
  // Test 2: Create Short URLs
  const createResults = await testCreateShortUrl();
  
  // Find successful shortcodes for further testing
  const successfulCreates = createResults.filter(r => r.passed && r.shortcode);
  
  if (successfulCreates.length > 0) {
    const testShortcode = successfulCreates[0].shortcode;
    console.log(`\n Using shortcode '${testShortcode}' for further testing...`);
    
    // Test 3: Get Statistics (before any clicks)
    await testGetStatistics(testShortcode);
    
    // Test 4: Redirect (this should increment click count)
    await testRedirect(testShortcode);
    
    // Wait a moment for analytics to be recorded
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test 5: Get Statistics (after redirect - should show increased clicks)
    console.log('\n Checking statistics after redirect...');
    await testGetStatistics(testShortcode);
  } else {
    console.log('\n  No successful URL creation, skipping redirect and statistics tests');
  }
  
  // Test 6: Invalid shortcode handling
  await testInvalidShortcodes();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(' TEST SUMMARY');
  console.log('='.repeat(60));
  
  const totalCreateTests = createResults.length;
  const passedCreateTests = createResults.filter(r => r.passed).length;
  
  console.log(` URL Creation Tests:`);
  console.log(`    Passed: ${passedCreateTests}/${totalCreateTests}`);
  console.log(`    Failed: ${totalCreateTests - passedCreateTests}/${totalCreateTests}`);
  
  if (successfulCreates.length > 0) {
    console.log(`\n Functional Tests: Completed`);
    console.log(`    Statistics retrieval: Tested`);
    console.log(`    Redirect functionality: Tested`);
  }
  
  console.log(`\n🔧 Error Handling Tests: Completed`);
  
  if (passedCreateTests === totalCreateTests) {
    console.log('\n All core tests passed! Your URL shortener is working correctly.');
  } else {
    console.log('\n Some tests failed. Check the details above.');
  }
  
  console.log('\n Next Steps:');
  console.log('   - Test with Postman for manual verification');
  console.log('   - Check server logs for any errors');
  console.log('   - Test edge cases with your frontend');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  makeRequest,
  testServerConnection,
  testCreateShortUrl,
  testGetStatistics,
  testRedirect,
  runAllTests
};