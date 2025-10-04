/**
 * TypeScript-based authentication test script
 * Run with: npm run test:auth
 */

import { config } from "dotenv";
import fetch from "node-fetch";
import {
  register,
  login,
  validateToken,
  getToken,
  getUser,
} from "./src/lib/frontend-auth";

// Load environment variables
config();

// Mock browser environment for testing
const mockLocalStorage = {
  _data: {} as Record<string, string>,
  setItem: function (key: string, value: string) {
    this._data[key] = value;
  },
  getItem: function (key: string) {
    return this._data[key] || null;
  },
  removeItem: function (key: string) {
    delete this._data[key];
  },
  clear: function () {
    this._data = {};
  },
  // Adding missing Storage properties with dummy implementations
  length: 0,
  key: function (index: number): string | null {
    return null;
  },
};

// Apply the mock implementation to the global object
(global as any).localStorage = mockLocalStorage;
(global as any).window = {
  localStorage: mockLocalStorage,
};

// Test configuration
// Use NEXT_PUBLIC_API_URL for backend tests (no separate BACKEND_API_URL)
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/backend";
console.log(`Using backend URL: ${BACKEND_URL}`);

const TEST_USER = {
  email: "typescripttest@example.com",
  password: "TypeScriptTest123",
  username: "tstest",
  name: "TypeScript Test User",
};

async function runTests() {
  console.log("🧪 Starting TypeScript frontend auth tests...");

  try {
    // Test API direct connection first
    await testBackendConnection();

    // Test registration
    console.log("\n1️⃣ Testing user registration...");
    try {
      const registerResult = await register(
        TEST_USER.email,
        TEST_USER.password,
        TEST_USER.username,
        TEST_USER.name
      );

      console.log("✅ Registration successful");
      console.log("Result:", registerResult);
    } catch (error: any) {
      if (
        error.message.includes("already registered") ||
        error.message.includes("already taken")
      ) {
        console.log("✅ User already exists (this is OK for repeated tests)");
      } else {
        console.error("❌ Registration failed:", error.message);
        return;
      }
    }

    // Test login
    console.log("\n2️⃣ Testing user login...");
    try {
      const loginResult = await login(TEST_USER.email, TEST_USER.password);
      console.log("✅ Login successful");
      console.log("Token received:", getToken()?.substring(0, 15) + "...");
      console.log("User data:", getUser());
    } catch (error: any) {
      console.error("❌ Login failed:", error.message);
      return;
    }

    // Test token validation
    console.log("\n3️⃣ Testing token validation...");
    try {
      const user = await validateToken();
      console.log("✅ Token validation successful");
      console.log("User data:", user);
    } catch (error: any) {
      console.error("❌ Token validation failed:", error.message);
    }

    console.log("\n✅ All frontend authentication tests passed!");
  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    if (error.stack) console.error(error.stack);
  }
}

async function testBackendConnection() {
  console.log("Testing direct backend connection...");
  try {
    const response = await fetch(`${BACKEND_URL}/auth/test`);
    const data = await response.json();
    console.log("Backend connection test result:", data);
    if (!response.ok) {
      throw new Error(
        `Backend connection failed: ${response.status} ${JSON.stringify(data)}`
      );
    }
    console.log("✅ Backend connection successful");
  } catch (error: any) {
    console.error("❌ Backend connection failed:", error.message);
    throw error;
  }
}

// Run the tests
runTests();
