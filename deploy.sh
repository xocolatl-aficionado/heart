#!/bin/bash

# Step 1: Start the tunnel and extract the new public URL
echo "Starting SSH tunnel..."
TUNNEL_OUTPUT=$(ssh -R 80:localhost:5000 localhost.run 2>&1)
NEW_URL=$(echo "$TUNNEL_OUTPUT" | grep -o 'https://[^ ]*')

# Check if the tunnel URL was successfully obtained
if [ -z "$NEW_URL" ]; then
  echo "Failed to get the tunnel URL. Exiting."
  exit 1
fi

echo "New backend URL: $NEW_URL"

# Step 2: Update the .env file with the new URL
ENV_FILE=".env"

# If the .env file exists, update it. Otherwise, create it.
if [ -f "$ENV_FILE" ]; then
  if grep -q "REACT_APP_BACKEND_URL=" "$ENV_FILE"; then
    # Update existing line
    sed -i'' -e "s|REACT_APP_BACKEND_URL=.*|REACT_APP_BACKEND_URL=$NEW_URL|" "$ENV_FILE"
  else
    # Append if the variable is not already set
    echo "REACT_APP_BACKEND_URL=$NEW_URL" >> "$ENV_FILE"
  fi
else
  # Create the .env file if it doesn't exist
  echo "REACT_APP_BACKEND_URL=$NEW_URL" > "$ENV_FILE"
fi

echo "Updated $ENV_FILE with new backend URL."

# Step 3: Commit and push changes to your Git branch
echo "Committing changes to Git..."
git add "$ENV_FILE"

# Check if there are changes to commit
if git diff-index --quiet HEAD --; then
  echo "No changes to commit."
else
  git commit -m "Update backend URL to $NEW_URL"
  git push origin your-branch-name
  echo "Changes pushed to remote. Netlify will redeploy the site."
fi
