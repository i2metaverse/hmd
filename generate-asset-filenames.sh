#!/bin/bash

# Define the assets directory and output file
ASSETS_DIR="./assets"
OUTPUT_FILE="./assets/assets.json"

# Check if the assets directory exists
if [ ! -d "$ASSETS_DIR" ]; then
    echo "Error: Assets directory '$ASSETS_DIR' does not exist."
    exit 1
fi

# Start building the JSON array
echo "[" > "$OUTPUT_FILE"

# Loop through .splat files in the assets directory
FIRST=true
for file in "$ASSETS_DIR"/*.splat; do
    # Check if any .splat files exist
    if [ ! -e "$file" ]; then
        echo "Error: No .splat files found in '$ASSETS_DIR'."
        echo "[]" > "$OUTPUT_FILE" # Create an empty JSON array
        exit 1
    fi

    # Append a comma on the same line if this is not the first file
    if [ "$FIRST" = true ]; then
        FIRST=false
    else
        echo "," >> "$OUTPUT_FILE"
    fi

    # Add the filename to the JSON array
    BASENAME=$(basename "$file")
    echo "  \"$BASENAME\"" >> "$OUTPUT_FILE"
done

# End the JSON array
echo "]" >> "$OUTPUT_FILE"

echo "Successfully generated '$OUTPUT_FILE'."
