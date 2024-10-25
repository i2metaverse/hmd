#!/bin/bash
# =============================================================================
# Script Name: setup-jekyll.sh
# Description: This script sets up a Jekyll project in the 'docs' Directory
# Usage:       Run the script in the root directory of the project.
# =============================================================================

# Navigate to the docs directory
cd docs || { echo "docs directory not found!"; exit 1; }

# Create necessary directories if they don't exist
mkdir -p _layouts _includes _posts

echo "Creating _config.yml..."
if [ ! -f _config.yml ]; then
  cat <<EOL > _config.yml
title: DIA Playground
description: A playground for Developing Immersive Applications
baseurl: ""
url: "https://sit-dia.github.io/dia-playground/"
theme: minima
EOL
fi

echo "Creating default layout..."
if [ ! -f _layouts/default.html ]; then
  cat <<EOL > _layouts/default.html
{{ content }}
EOL
fi

echo "Creating default index.md..."
if [ -f index.html ]; then
  # Insert the header text at the start of <body> tag
  # - note that macOS uses BSD sed, so the command takes in a backup file extension
  #   which we set to an empty string to avoid creating a backup file
  sed -i '' '/<body>/a\
    <h2 style="font-family: Helvetica, sans-serif; text-align: center; background-color: #333333; color: #B272FF; padding: 16px; margin: 0; position: fixed; top: 20px; z-index: 10; border-top-right-radius: 15px; border-bottom-right-radius: 15px; border: 3px solid #B272FF;">DIA Playground</h1>
' index.html

  # Remove leading slashes in asset paths in index.html
  sed -i '' 's|src="/assets|src="assets|g' index.html

  # add front matter to index.html
  echo -e "---\nlayout: default\ntitle: Home\n---\n" | cat - index.html > temp && mv temp index.html
  # add a visual title header text "Developing Immersive Applications Playground"
fi

echo "Creating Gemfile..."
# add source, gem and theme defaults to Gemfile
if [ ! -f Gemfile ]; then
  cat <<EOL > Gemfile
source "https://rubygems.org"
gem "jekyll"
gem "minima"
EOL
fi


# Inform the user that setup is complete
echo "Jekyll setup is complete. To test locally, you can now run 'bundle exec jekyll build' to build the site and 'bundle exec jekyll serve' to serve the site."

# End of script
