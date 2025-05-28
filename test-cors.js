/**
 * CORS Configuration Test Script
 * 
 * Tests the comprehensive CORS setup for the Recovery Office booking system
 */

const http = require('http');

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function testCORS() {
  console.log('🧪 Testing CORS Configuration for Recovery Office Backend...\n');

  const baseURL = 'http://localhost:5000/api';
  const origin = 'http://localhost:3000';

  const tests = [
    {
      name: 'CORS Test Endpoint',
      method: 'GET',
      url: `${baseURL}/cors-test`,
      headers: {
        'Origin': origin,
        'Accept': 'application/json'
      }
    },
    {
      name: 'Services Endpoint (GET)',
      method: 'GET',
      url: `${baseURL}/services`,
      headers: {
        'Origin': origin,
        'Accept': 'application/json'
      }
    },
    {
      name: 'Clients Preflight (OPTIONS)',
      method: 'OPTIONS',
      url: `${baseURL}/clients`,
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Accept'
      }
    },
    {
      name: 'Client Creation (POST)',
      method: 'POST',
      url: `${baseURL}/clients`,
      headers: {
        'Origin': origin,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+44 1234 567890',
        gdprConsent: true
      })
    },
    {
      name: 'Bookings Preflight (OPTIONS)',
      method: 'OPTIONS',
      url: `${baseURL}/bookings`,
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Accept'
      }
    }
  ];

  for (const test of tests) {
    try {
      console.log(`🔍 Testing: ${test.name}`);
      console.log(`   Method: ${test.method}`);
      console.log(`   URL: ${test.url}`);
      console.log(`   Origin: ${origin}`);

      const response = await makeRequest(test.url, {
        method: test.method,
        headers: test.headers,
        body: test.body
      });

      console.log(`   Status: ${response.statusCode}`);
      
      // Check critical CORS headers
      const corsHeaders = {
        'access-control-allow-origin': response.headers['access-control-allow-origin'],
        'access-control-allow-methods': response.headers['access-control-allow-methods'],
        'access-control-allow-headers': response.headers['access-control-allow-headers'],
        'access-control-allow-credentials': response.headers['access-control-allow-credentials']
      };

      console.log('   CORS Headers:');
      console.log(`     Access-Control-Allow-Origin: ${corsHeaders['access-control-allow-origin'] || 'MISSING'}`);
      console.log(`     Access-Control-Allow-Methods: ${corsHeaders['access-control-allow-methods'] || 'MISSING'}`);
      console.log(`     Access-Control-Allow-Headers: ${corsHeaders['access-control-allow-headers'] || 'MISSING'}`);
      console.log(`     Access-Control-Allow-Credentials: ${corsHeaders['access-control-allow-credentials'] || 'MISSING'}`);

      // Evaluate test result
      let testResult = '✅ PASSED';
      if (response.statusCode >= 400) {
        testResult = '❌ FAILED (HTTP Error)';
      } else if (!corsHeaders['access-control-allow-origin']) {
        testResult = '❌ FAILED (Missing CORS Headers)';
      } else if (corsHeaders['access-control-allow-origin'] !== origin && corsHeaders['access-control-allow-origin'] !== '*') {
        testResult = '❌ FAILED (Origin Mismatch)';
      }

      console.log(`   Result: ${testResult}`);

      // Show response data for successful tests
      if (response.statusCode < 400 && test.method === 'GET') {
        try {
          const data = JSON.parse(response.data);
          if (data.status) {
            console.log(`   Response Status: ${data.status}`);
          }
          if (data.results !== undefined) {
            console.log(`   Results Count: ${data.results}`);
          }
        } catch (parseError) {
          console.log('   Response: Non-JSON response');
        }
      }

      console.log('');

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('   💡 Solution: Make sure backend server is running on http://localhost:5000');
      }
      
      console.log('');
    }
  }

  // Summary
  console.log('📋 CORS Configuration Summary:');
  console.log('   🎯 Target: http://localhost:5000 (Backend)');
  console.log('   🌐 Origin: http://localhost:3000 (Frontend)');
  console.log('   📡 Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
  console.log('   🔐 Credentials: Enabled');
  console.log('');
  console.log('💡 Next Steps:');
  console.log('   1. Ensure backend server is running: cd backend && npm start');
  console.log('   2. Test frontend booking flow with browser console open');
  console.log('   3. Look for CORS-related logs in backend console');
}

// Run the test
console.log('🚀 Starting CORS Test Suite...\n');
testCORS().catch(console.error); 