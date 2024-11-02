#!/bin/bash
# =============================================================================
# Script Name: decorate-html.sh
# Description: This script navigates to the 'docs' directory and adds a custom 
#              header to the top of 'index.html'
# Usage:       Run the script in the root directory of the project.
# =============================================================================

# Navigate to the docs directory
# - if directory exists, navigate to it
# - create the directory if it doesn't exist
if [ -d docs ]; then
  cd docs
else
  mkdir -p docs
  cd docs
fi

echo "Adding a header to index.html..."
if [ -f index.html ]; then
  # Insert the header text at the start of <body> tag
  # - note that macOS uses BSD sed, so the command takes in a backup file extension
  #   which we set to an empty string to avoid creating a backup file
  sed -i '' '/<body>/a\
    <h2 style="font-family: Helvetica, sans-serif; text-align: center; background-color: #333333; color: #B272FF; padding: 16px; margin: 0; position: fixed; top: 10px; z-index: 10; border-top-right-radius: 15px; border-bottom-right-radius: 15px; border: 3px solid #B272FF;">DIAversity</h1>
' index.html

  # Remove leading slashes in asset paths in index.html
  #sed -i '' 's|src="/assets|src="assets|g' index.html

  echo "DONE adding a header to index.html!"
fi
# End of script
