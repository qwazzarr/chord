#!/bin/bash

# Ports range: 3000 to 3009
for port in {3000..3009}; do
    # Fetch the PIDs of the processes running on the given port
    pids=$(lsof -t -i:"$port")

    if [ -n "$pids" ]; then
        echo "Stopping processes on port $port (PIDs: $pids)"
        # Iterate over each PID and kill it individually
        for pid in $pids; do
            kill -9 "$pid" 2>/dev/null && echo "Killed PID $pid on port $port"
        done
    else
        echo "No process found on port $port"
    fi
done
