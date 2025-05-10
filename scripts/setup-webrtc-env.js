#!/usr/bin/env node

/**
 * MediaSoup WebRTC Environment Setup Script
 *
 * This script helps to correctly configure the .env.local file
 * with the user's actual IP address to enable proper WebRTC connections.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Get the root directory of the project
const rootDir = path.resolve(__dirname, "..");
const envLocalExamplePath = path.join(rootDir, ".env.local.example");
const envLocalPath = path.join(rootDir, ".env.local");

// Function to get all non-internal IP addresses of the machine
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const interfaceName in interfaces) {
    const networkInterface = interfaces[interfaceName];
    for (const iface of networkInterface) {
      // Skip internal and non-IPv4 addresses
      if (!iface.internal && iface.family === "IPv4") {
        addresses.push({
          interface: interfaceName,
          address: iface.address,
        });
      }
    }
  }

  return addresses;
}

// Function to check if a port is in use
function isPortInUse(port) {
  try {
    // Different commands for Windows vs Unix
    if (process.platform === "win32") {
      const result = execSync(`netstat -ano | findstr :${port}`).toString();
      return result.length > 0;
    } else {
      const result = execSync(`lsof -i:${port}`).toString();
      return result.length > 0;
    }
  } catch (error) {
    // If the command fails, the port is likely not in use
    return false;
  }
}

// Function to check firewall for UDP ports
function checkFirewallForUdpPorts(startPort, endPort) {
  console.log(
    `\nChecking if UDP ports ${startPort}-${endPort} are accessible...`
  );

  try {
    if (process.platform === "win32") {
      console.log("On Windows, please check your firewall settings manually:");
      console.log("1. Open Windows Defender Firewall with Advanced Security");
      console.log(
        `2. Verify that UDP ports ${startPort}-${endPort} are allowed for inbound connections`
      );
    } else if (process.platform === "darwin") {
      console.log("On macOS, please check your firewall settings manually:");
      console.log("1. Open System Preferences > Security & Privacy > Firewall");
      console.log(
        `2. Ensure that your Node.js application is allowed to receive incoming connections`
      );
    } else {
      // Linux
      try {
        const result = execSync(
          "sudo iptables -L INPUT -n | grep udp"
        ).toString();
        console.log("Current UDP firewall rules:");
        console.log(result);
        console.log(
          `Ensure that UDP ports ${startPort}-${endPort} are allowed in the firewall rules above.`
        );
      } catch (error) {
        console.log(
          "Unable to check firewall settings. Please ensure your firewall allows UDP traffic on ports:"
        );
        console.log(`${startPort}-${endPort}`);
      }
    }
  } catch (error) {
    console.error("Error checking firewall:", error.message);
  }
}

// Main function
async function setupWebRtcEnv() {
  console.log("MediaSoup WebRTC Environment Setup");
  console.log("==================================\n");

  // Check if .env.local.example exists
  if (!fs.existsSync(envLocalExamplePath)) {
    console.error(
      "Error: .env.local.example file not found in project root directory."
    );
    rl.close();
    return;
  }

  // Get available IP addresses
  const ipAddresses = getLocalIpAddresses();

  if (ipAddresses.length === 0) {
    console.error("Error: No non-internal network interfaces found.");
    rl.close();
    return;
  }

  console.log("Available network interfaces:");
  ipAddresses.forEach((item, index) => {
    console.log(`${index + 1}. ${item.interface}: ${item.address}`);
  });

  // Prompt user to select an IP address
  const askForIpAddress = () => {
    return new Promise((resolve) => {
      rl.question(
        "\nWhich IP address should be used for WebRTC? (Enter the number): ",
        (answer) => {
          const index = parseInt(answer) - 1;
          if (isNaN(index) || index < 0 || index >= ipAddresses.length) {
            console.log("Invalid selection. Please try again.");
            resolve(askForIpAddress());
          } else {
            resolve(ipAddresses[index].address);
          }
        }
      );
    });
  };

  const selectedIp = await askForIpAddress();

  console.log(`\nSelected IP address: ${selectedIp}`);

  // Check if the required UDP ports are in use
  const startPort = 40000;
  const endPort = 40100;

  console.log(
    `\nChecking if MediaSoup ports ${startPort}-${endPort} are available...`
  );
  let portsInUse = false;

  // We'll only check a few ports as checking all 100+ would take too long
  const portsToCheck = [
    startPort,
    Math.floor((startPort + endPort) / 2),
    endPort,
  ];
  for (const port of portsToCheck) {
    if (isPortInUse(port)) {
      console.log(`Warning: Port ${port} appears to be in use.`);
      portsInUse = true;
    }
  }

  if (portsInUse) {
    console.log(
      `\nWarning: Some ports in the range ${startPort}-${endPort} may be in use.`
    );
    console.log("This could interfere with MediaSoup operation.");

    // Prompt user if they want to continue
    const continueSetup = await new Promise((resolve) => {
      rl.question(
        "Do you want to continue with the setup anyway? (y/n): ",
        (answer) => {
          resolve(answer.toLowerCase() === "y");
        }
      );
    });

    if (!continueSetup) {
      console.log(
        "Setup aborted. Please free up the required UDP ports and try again."
      );
      rl.close();
      return;
    }
  } else {
    console.log("No ports in the MediaSoup range appear to be in use. Good!");
  }

  // Check firewall
  checkFirewallForUdpPorts(startPort, endPort);

  // Create .env.local file with the selected IP
  let envContent = fs.readFileSync(envLocalExamplePath, "utf8");
  envContent = envContent.replace(
    /MY_LOCAL_IP=192\.168\.x\.x/g,
    `MY_LOCAL_IP=${selectedIp}`
  );

  // Replace ${MY_LOCAL_IP} with the actual IP
  envContent = envContent.replace(/\${MY_LOCAL_IP}/g, selectedIp);

  fs.writeFileSync(envLocalPath, envContent);

  console.log("\nSetup Complete!");
  console.log(
    `A new .env.local file has been created with your IP address (${selectedIp}).`
  );
  console.log(
    "This will allow devices on your network to connect to your MediaSoup WebRTC server."
  );

  console.log("\nNext Steps:");
  console.log("1. Restart your development server");
  console.log(
    "2. Navigate to http://localhost:3000/live-streams/diagnostics to test your WebRTC connection"
  );

  rl.close();
}

// Run the setup function
setupWebRtcEnv();
