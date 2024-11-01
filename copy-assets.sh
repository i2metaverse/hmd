#!/bin/bash
# =============================================================================
# Script Name: copy-assets.sh
# Description: This script copies the contents of the root 'assets' directory 
#              to the 'docs/assets' directory.
# Usage:       Run the script in the root directory of the project.
# =============================================================================

# move assets to docs directory
echo "Moving assets to docs directory..."

# if no 'docs/assets/' directory exists, exit the script
if [ ! -d docs/assets ]; then
  echo "No 'docs/assets/' directory found. Exiting script..."
  exit 1
fi

# copy the contents of the root 'assets' directory to 'docs/assets'
cp assets/* docs/assets

echo "DONE moving assets to docs/assets directory!"
