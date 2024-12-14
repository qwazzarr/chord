#!/bin/bash

# Configuration
START_PORT=3000   # Starting port for the first node
NODE_COUNT=10     # Number of nodes to start
M=6               # Keyspace size (2^M)

# Start nodes without connecting them
echo "Starting $NODE_COUNT Chord nodes with m=$M..."
for ((i=0; i<NODE_COUNT; i++)); do
    PORT=$((START_PORT + i))
    echo "Starting node on port $PORT with m=$M..."

    # Run each node using ts-node
    npx ts-node server.ts --port=$PORT --dummy="Node$PORT" --m=$M &

    # Capture the PID for future management
    echo $! >> node_pids.txt
    sleep 1 # Short delay to ensure node starts
done

echo "All $NODE_COUNT nodes started. Logs for each node are shown above."

# Print a reminder about connecting nodes
echo "Nodes are running but not connected. Use the /join endpoint to connect them to the ring."
