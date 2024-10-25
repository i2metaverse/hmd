#!/bin/bash

# Navigate to the docs directory
cd docs || { echo "docs directory not found!"; exit 1; }

echo "Adding a header to index.html..."
if [ -f index.html ]; then
  # Insert the header text at the start of <body> tag
  # - note that macOS uses BSD sed, so the command takes in a backup file extension
  #   which we set to an empty string to avoid creating a backup file
  sed -i '' '/<body>/a\
    <h2 style="font-family: Helvetica, sans-serif; text-align: center; background-color: #333333; color: #B272FF; padding: 16px; margin: 0; position: fixed; top: 20px; z-index: 10; border-top-right-radius: 15px; border-bottom-right-radius: 15px; border: 3px solid #B272FF;">DIA Playground</h1>
' index.html

  # Remove leading slashes in asset paths in index.html
  #sed -i '' 's|src="/assets|src="assets|g' index.html

  echo "DONE adding a header to index.html!"
fi
# End of script
