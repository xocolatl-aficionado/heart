#!/bin/bash

# Start SSH command in a detached screen session
screen -dm bash -c 'ssh -v -R 80:localhost:5000 nokey@localhost.run > /tmp/tunnel_output.txt 2>&1'

# Give the SSH tunnel some time to establish and produce output
echo "Waiting for the SSH tunnel to establish..."
sleep 10  # Wait 5 seconds or adjust as needed

echo cat /tmp/tunnel_output.txt
# Check if the output file exists
if [ -f /tmp/tunnel_output.txt ]; then
    # Capture the URL from the output
    TUNNEL_URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.lhr\.life' /tmp/tunnel_output.txt)
    
    if [ -z "$TUNNEL_URL" ]; then
        echo "TUNNEL URL not found in the output file."
        exit 1
    else
        echo "$TUNNEL_URL"
    fi
else
    echo "Output file not found. SSH command might not have run properly."
    # Display the screen logs to debug
    screen -ls  # List active screen sessions
    echo "Check the logs for any issues with the SSH command."
    exit 1
fi
