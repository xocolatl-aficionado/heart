#!/bin/bash

# Get the TUNNEL_URL passed as an argument
TUNNEL_URL=$1

# Ensure TUNNEL_URL is set
if [ -z "$TUNNEL_URL" ]; then
  echo "TUNNEL_URL is not provided. Exiting."
  exit 1
fi

# Define the file path
FILE="src/index.html"

# Read the file content into a variable
CONTENT=$(<"$FILE")

# Define the new script tag
NEW_SCRIPT="<script>window.env = { REACT_APP_BACKEND_URL: '$TUNNEL_URL' };</script>"

# Check if the current content has the script tag with any URL
if echo "$CONTENT" | grep -q "<script>window.env = { REACT_APP_BACKEND_URL: '.*' };</script>"; then
  # Replace the existing script tag with the new one using `awk`
  UPDATED_CONTENT=$(echo "$CONTENT" | awk -v new_script="$NEW_SCRIPT" \
    '{gsub(/<script>window.env = { REACT_APP_BACKEND_URL: .+ };<\/script>/, new_script); print}')
else
  echo "No matching script tag found. Adding the new script tag."
  # Append the new script tag if none exists
  UPDATED_CONTENT="$CONTENT"$'\n'"$NEW_SCRIPT"
fi

# Check if the content was actually updated
if [ "$CONTENT" != "$UPDATED_CONTENT" ]; then
  # Write the updated content back to the file
  echo "$UPDATED_CONTENT" > "$FILE"
  echo "index.html updated with the new backend URL."
else
  echo "No update needed. The backend URL is already correct."
fi
