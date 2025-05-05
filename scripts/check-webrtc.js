#!/usr/bin/env node

/**
 * A simple script to test STUN/TURN server connectivity
 * Run with: node scripts/check-webrtc.js
 */

const { execSync } = require('child_process');
const os = require('os');
const dns = require('dns');
const net = require('net');

console.log('===== WebRTC Connectivity Diagnostic Tool =====\n');

// Check IP addresses
console.log('Local network interfaces:');
const interfaces = os.networkInterfaces();
Object.keys(interfaces).forEach((ifname) => {
  interfaces[ifname].forEach((iface) => {
    if (iface.family === 'IPv4' && !iface.internal) {
      console.log(`  ${ifname}: ${iface.address}`);
    }
  });
});

console.log('\nChecking DNS resolution for STUN servers...');
dns.lookup('stun.l.google.com', (err, address) => {
  if (err) {
    console.error('  ❌ Failed to resolve stun.l.google.com:', err.message);
  } else {
    console.log(`  ✅ stun.l.google.com resolves to ${address}`);
  }
});

// Check if ports are open
function checkPort(host, port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(3000);
    
    client.on('connect', () => {
      console.log(`  ✅ Port ${port} is open on ${host}`);
      client.destroy();
      resolve(true);
    });
    
    client.on('timeout', () => {
      console.log(`  ❌ Connection to ${host}:${port} timed out`);
      client.destroy();
      resolve(false);
    });
    
    client.on('error', (err) => {
      console.log(`  ❌ Cannot connect to ${host}:${port} - ${err.message}`);
      client.destroy();
      resolve(false);
    });
    
    client.connect(port, host);
  });
}

async function checkPorts() {
  console.log('\nChecking server connectivity...');
  
  // Parse TURN_SERVER_URL from .env if present
  let turnHost = '192.168.1.5';
  try {
    const envContent = require('fs').readFileSync('.env', 'utf8');
    const match = envContent.match(/NEXT_PUBLIC_TURN_SERVER_URL=turn:([^:]+):(\d+)/);
    if (match) {
      turnHost = match[1];
    }
  } catch (err) {
    console.log('  ⚠️ Could not read .env file');
  }
  
  await checkPort(turnHost, 3478); // STUN/TURN
  await checkPort(turnHost, 3000); // WebRTC server
  
  console.log('\nChecking MediaSoup port range...');
  await checkPort(turnHost, 40000); // Start of MediaSoup port range
  await checkPort(turnHost, 40050); // Middle of MediaSoup port range
  await checkPort(turnHost, 40100); // End of MediaSoup port range
  
  console.log('\nChecking firewall status...');
  try {
    if (os.platform() === 'win32') {
      console.log('  Windows detected. Check firewall manually in Windows Defender.');
    } else if (os.platform() === 'darwin') {
      console.log('  macOS detected. Sample firewall status:');
      try {
        console.log(execSync('/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate').toString());
      } catch (e) {
        console.log('  ⚠️ Unable to check macOS firewall status');
      }
    } else {
      console.log('  Linux detected. Sample firewall status:');
      try {
        console.log(execSync('sudo iptables -L | grep -i drop').toString());
      } catch (e) {
        console.log('  ⚠️ Unable to check Linux firewall status');
      }
    }
  } catch (e) {
    console.log('  ⚠️ Error checking firewall status');
  }
  
  console.log('\n===== Configuration Recommendations =====');
  console.log('1. Ensure your MEDIASOUP_ANNOUNCED_IP in .env is set to your actual server IP');
  console.log('2. Make sure UDP ports 40000-40100 are open for WebRTC media');
  console.log('3. Check that the TURN server is properly configured');
  console.log('4. If using Docker, ensure port mappings are correct');
}

checkPorts(); 