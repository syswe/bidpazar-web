#!/bin/bash

# Open MediaSoup ports script for macOS
# This script helps open the required UDP ports for MediaSoup WebRTC
# Run with: bash scripts/open-mediasoup-ports.sh

# Load environment variables if .env exists
if [ -f .env ]; then
  source <(grep -v '^#' .env | sed 's/^/export /')
fi

# Default ports if not in environment
MIN_PORT=${MEDIASOUP_MIN_PORT:-40000}
MAX_PORT=${MEDIASOUP_MAX_PORT:-40100}

echo "======== MediaSoup Port Configuration ========"
echo "Opening UDP ports $MIN_PORT-$MAX_PORT for WebRTC media..."

# Create a temporary pf.conf file
PF_CONF="/tmp/mediasoup_pf.conf"

cat > $PF_CONF << EOF
# MediaSoup WebRTC port range
pass out proto udp from any to any port $MIN_PORT:$MAX_PORT keep state
pass in proto udp from any to any port $MIN_PORT:$MAX_PORT keep state
EOF

echo "Created temporary PF configuration:"
cat $PF_CONF

# Check if pf is enabled
PF_STATUS=$(sudo pfctl -s info 2>/dev/null | grep "Status" || echo "Status: Disabled")
echo "Current PF Status: $PF_STATUS"

# Try different approaches to enable the rules
echo "Attempting to load rules..."

# Method 1: Try adding rules to existing configuration
echo "Method 1: Trying to add rules to existing configuration..."
sudo pfctl -a com.apple/mediasoup -f $PF_CONF

# Method 2: Try enabling pf with the new rules
echo "Method 2: Trying to enable pf with the new rules..."
sudo pfctl -e -f $PF_CONF

echo "Checking if rules were loaded successfully..."
sudo pfctl -sa | grep "udp" | grep "$MIN_PORT:$MAX_PORT"

if [ $? -eq 0 ]; then
  echo "✅ Ports opened successfully!"
else
  echo "⚠️ Could not automatically open ports."
  echo "Please manually open UDP ports $MIN_PORT-$MAX_PORT using:"
  echo "1. Create file /etc/pf.anchors/mediasoup with these contents:"
  echo "   pass out proto udp from any to any port $MIN_PORT:$MAX_PORT keep state"
  echo "   pass in proto udp from any to any port $MIN_PORT:$MAX_PORT keep state"
  echo "2. Add to /etc/pf.conf: anchor \"mediasoup\""
  echo "3. Load with: sudo pfctl -f /etc/pf.conf"
fi

# Test UDP port accessibility
echo "Testing UDP ports..."
for port in $MIN_PORT $(( (MIN_PORT + MAX_PORT) / 2 )) $MAX_PORT; do
  nc -zu -w1 localhost $port
  if [ $? -eq 0 ]; then
    echo "✅ Port $port is accessible"
  else
    echo "❌ Port $port is not accessible"
  fi
done

echo "All tests completed."

# Clean up temporary files
rm -f $PF_CONF