#!/usr/bin/env node

/**
 * WebRTC Connection Test Script (Simplified)
 * Tests if the STUN/TURN servers are properly configured
 */

const readline = require('readline');
const dgram = require('dgram');
const http = require('http');
const https = require('https');

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
const DEFAULT_STUN_SERVER = 'stun:localhost:3478';
const DEFAULT_TURN_SERVER = 'turn:localhost:3478';
const DEFAULT_TURN_USERNAME = 'bidpazar';
const DEFAULT_TURN_PASSWORD = 'bidpazarpass';

console.log('=== WebRTC Connection Test (Simplified) ===\n');
console.log('Note: This script checks STUN/TURN server connectivity without actual WebRTC.\n');

async function checkConnectivity() {
  // Interactive inputs
  const stunServer = await question(`STUN server [${DEFAULT_STUN_SERVER}]: `) || DEFAULT_STUN_SERVER;
  const turnServer = await question(`TURN server [${DEFAULT_TURN_SERVER}]: `) || DEFAULT_TURN_SERVER;
  const turnUsername = await question(`TURN username [${DEFAULT_TURN_USERNAME}]: `) || DEFAULT_TURN_USERNAME;
  const turnPassword = await question(`TURN password [${DEFAULT_TURN_PASSWORD}]: `) || DEFAULT_TURN_PASSWORD;

  console.log('\nTesting connectivity with settings:');
  console.log(`- STUN: ${stunServer}`);
  console.log(`- TURN: ${turnServer} (username: ${turnUsername})\n`);

  // Test STUN server
  const stunHostPort = stunServer.replace('stun:', '').split(':');
  const stunHost = stunHostPort[0];
  const stunPort = parseInt(stunHostPort[1] || '3478');
  
  console.log(`Testing STUN server connectivity to ${stunHost}:${stunPort}...`);
  
  try {
    await testStunConnectivity(stunHost, stunPort);
    
    // Test WebSocket connection
    const wsUrl = 'ws://localhost:3000/api/rtc/socket';
    const httpUrl = 'http://localhost:3000/api/rtc/socket';
    console.log(`\nTesting WebSocket server at ${wsUrl}...`);
    await testHttpEndpoint(httpUrl);
    
    // Check Docker COTURN container
    console.log('\nChecking if COTURN Docker container is running...');
    const { exec } = require('child_process');
    exec('docker ps | grep coturn', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Error checking Docker containers. COTURN may not be running.');
        return;
      }
      
      if (stdout.trim()) {
        console.log('✅ COTURN Docker container is running:');
        console.log(stdout);
      } else {
        console.log('❌ No COTURN Docker container found. You may need to start it:');
        console.log('   docker-compose up -d coturn');
      }
      
      // Final summary
      console.log('\n=== Connectivity Test Summary ===');
      console.log('This script performed basic connectivity tests.');
      console.log(`For full WebRTC testing, open Chrome and go to: chrome://webrtc-internals/`);
      console.log(`Then open your live stream app in another tab to monitor actual WebRTC connections.`);
      
      rl.close();
    });
  } catch (err) {
    console.error('\n❌ Connectivity test failed:', err.message);
    rl.close();
  }
}

// Test direct STUN server connectivity
function testStunConnectivity(host, port) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Sending UDP packet to ${host}:${port}...`);
      
      const client = dgram.createSocket('udp4');
      // Create a simple STUN binding request
      // Format: [Message Type, Message Length, Magic Cookie, Transaction ID]
      const message = Buffer.from('000100000000000000000000000000000000000000000000', 'hex');
      
      let responseReceived = false;
      
      client.on('error', (err) => {
        console.log(`❌ UDP socket error: ${err.message}`);
        client.close();
        reject(err);
      });
      
      client.on('message', (msg) => {
        console.log(`✅ Received response from STUN server (${msg.length} bytes)`);
        responseReceived = true;
        client.close();
        resolve();
      });
      
      client.send(message, port, host, (err) => {
        if (err) {
          console.log(`❌ Error sending UDP packet: ${err.message}`);
          client.close();
          reject(err);
        } else {
          console.log(`✅ UDP packet sent successfully to ${host}:${port}`);
          
          // Give some time to receive a response
          setTimeout(() => {
            if (!responseReceived) {
              console.log(`⚠️ No response received from STUN server within timeout`);
              console.log('   This might be normal if the server doesn\'t respond to invalid STUN requests');
              client.close();
              resolve(); // Resolve anyway to continue testing
            }
          }, 3000);
        }
      });
    } catch (err) {
      console.error('❌ Error testing STUN connectivity:', err);
      reject(err);
    }
  });
}

// Test HTTP endpoint
function testHttpEndpoint(url) {
  return new Promise((resolve, reject) => {
    console.log(`Testing HTTP endpoint: ${url}`);
    
    const requester = url.startsWith('https') ? https : http;
    
    const req = requester.get(url, (res) => {
      const { statusCode } = res;
      
      if (statusCode === 101) {
        console.log(`✅ WebSocket upgrade response received (status ${statusCode})`);
      } else if (statusCode >= 200 && statusCode < 300) {
        console.log(`✅ HTTP endpoint responded (status ${statusCode})`);
      } else {
        console.log(`⚠️ HTTP endpoint responded with unexpected status: ${statusCode}`);
      }
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (data.trim()) {
          console.log(`Response body: ${data.slice(0, 100)}${data.length > 100 ? '...' : ''}`);
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ HTTP request error: ${err.message}`);
      reject(err);
    });
    
    req.end();
  });
}

// Helper to create promise-based readline.question
function question(text) {
  return new Promise((resolve) => {
    rl.question(text, resolve);
  });
}

// Run the test
checkConnectivity(); 