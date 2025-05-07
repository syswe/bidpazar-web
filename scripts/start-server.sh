#!/bin/bash

# Ensure ts-node is installed
if ! command -v ts-node &> /dev/null; then
    echo "ts-node is not installed. Installing..."
    npm install -g ts-node typescript
fi

# Run the server
echo "Starting server with ts-node..."
ts-node --project tsconfig.json server.ts 