#!/bin/bash

# Step 0: Check if the server is running on port 5000
SERVER_PORT=5000

# Check if anything is listening on port 5000
if ! lsof -i :$SERVER_PORT -t > /dev/null; then
  echo "Server is not running on port $SERVER_PORT. Starting the server..."
  
  # Start the server (customize this command as needed)
  python3 backend.py &  # Running in the background
  
  # Give the server a few seconds to start
  sleep 5

  # Check again to see if the server started successfully
  if ! lsof -i :$SERVER_PORT -t > /dev/null; then
    echo "Failed to start the server on port $SERVER_PORT. Exiting."
    exit 1
  fi
else
  echo "Server is already running on port $SERVER_PORT."
fi

# Step 1: Call tunnel.sh to start the SSH tunnel and get the URL
TUNNEL_URL=$(bash ./tunnel.sh)

echo "REACT_APP_BACKEND_URL=$TUNNEL_URL" 

# Check if the tunnel URL was obtained
if [ -z "$TUNNEL_URL" ]; then
  echo "Failed to get the tunnel URL. Exiting."
  exit 1
fi

# Step 2: Ensure the URL ends with ".lhr.life"
if [[ ! "$TUNNEL_URL" =~ \.lhr\.life$ ]]; then
  echo "The URL does not end with .lhr.life. Exiting."
  exit 1
fi

# Step 4: Call the script to update index.html
echo "Updating index.html with the new backend URL..."
bash ./update_index.sh "$TUNNEL_URL" 

# Step 3: Commit and push changes to your Git branch
echo "Committing changes to Git..."

# Check if there are changes to commit
if git diff-index --quiet HEAD --; then
  echo "No changes to commit."
else
  git add src/index.html
  git commit -m "Update backend URL to $TUNNEL_URL"
  
  # Push to the current branch
  CURRENT_BRANCH=$(git branch --show-current)
  git push origin "$CURRENT_BRANCH"
  
  echo "Changes pushed to remote. Netlify will redeploy the site."
fi
