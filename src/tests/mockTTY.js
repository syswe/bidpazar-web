// Mock TTY for CI environments
// This needs to be required before any other modules to ensure process.stdout/stderr are properly mocked

// Ensure process exists
if (typeof process === 'undefined') {
  global.process = {};
}

// Ensure stdout and stderr exist
if (!process.stdout) {
  process.stdout = {};
}
if (!process.stderr) {
  process.stderr = {};
}

// Set isTTY properties
process.stdout.isTTY = true;
process.stderr.isTTY = true; 