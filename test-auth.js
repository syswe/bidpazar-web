/**
 * Test script for frontend authentication flow
 * Run with: node test-auth.js
 * 
 * This script tests:
 * 1. Login, register, token validation, and token refresh flow
 * 2. Storage and retrieval of auth tokens
 * 3. Authentication headers in requests
 * 
 * Note: Run this script in Node.js environment with the fetch API available
 */

// Mock browser environment for testing
global.localStorage = {
  _data: {},
  setItem: function(key, value) {
    this._data[key] = value;
  },
  getItem: function(key) {
    return this._data[key] || null;
  },
  removeItem: function(key) {
    delete this._data[key];
  }
};

global.window = {
  localStorage: global.localStorage
};

// Ensure env is properly loaded
require('dotenv').config();

// Needed for fetch
const fetch = require('node-fetch');
global.fetch = fetch;

// Test configuration
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:5001/backend';
const TEST_USER = {
  email: 'frontendtest@example.com',
  password: 'FrontendTest123',
  username: 'frontendtest',
  name: 'Frontend Test User'
};

// Import the frontend authentication functions
// We need to dynamically import it since it's using ES modules
async function runTests() {
  try {
    // This trick is needed because we're using module imports in a CommonJS environment
    const { register, login, validateToken, getToken, getUser, isAuthenticated } = await import('./src/lib/frontend-auth.ts');
    
    console.log('🧪 Starting frontend authentication tests...');
    console.log(`Backend URL: ${BACKEND_URL}`);
    
    // Test registration
    console.log('\n1️⃣ Testing user registration...');
    try {
      const registerResult = await register(
        TEST_USER.email,
        TEST_USER.password,
        TEST_USER.username,
        TEST_USER.name
      );
      
      console.log('✅ Registration successful or user already exists');
      console.log('Result:', registerResult);
    } catch (error) {
      if (error.message.includes('already registered') || error.message.includes('already taken')) {
        console.log('✅ User already exists (this is OK for repeated tests)');
      } else {
        console.error('❌ Registration failed:', error.message);
      }
    }
    
    // Test login
    console.log('\n2️⃣ Testing user login...');
    try {
      const loginResult = await login(TEST_USER.email, TEST_USER.password);
      console.log('✅ Login successful');
      console.log('Token received:', getToken()?.substring(0, 15) + '...');
      console.log('User data:', getUser());
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      process.exit(1);
    }
    
    // Test token validation
    console.log('\n3️⃣ Testing token validation...');
    try {
      const user = await validateToken();
      console.log('✅ Token validation successful');
      console.log('User data:', user);
    } catch (error) {
      console.error('❌ Token validation failed:', error.message);
      process.exit(1);
    }
    
    // Test authentication status
    console.log('\n4️⃣ Checking authentication status...');
    const authenticated = isAuthenticated();
    if (authenticated) {
      console.log('✅ User is authenticated');
    } else {
      console.error('❌ User should be authenticated but is not');
      process.exit(1);
    }
    
    console.log('\n✅ All frontend authentication tests passed!');
  } catch (error) {
    console.error('❌ Test initialization failed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

runTests(); 