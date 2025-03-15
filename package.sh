#!/bin/bash

# Extract version from manifest.json
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)

# Create release directory if it doesn't exist
RELEASE_DIR="release"
if [ ! -d "$RELEASE_DIR" ]; then
    mkdir -p "$RELEASE_DIR"
    echo "Created $RELEASE_DIR directory"
fi

# Create zip filename with version
ZIP_FILE="$RELEASE_DIR/GitInsight-v${VERSION}.zip"

# Remove existing zip file if it exists
if [ -f "$ZIP_FILE" ]; then
    rm "$ZIP_FILE"
    echo "Removed existing $ZIP_FILE"
fi

# Create zip archive, excluding the package script itself and the release directory
zip -r "$ZIP_FILE" . -x "package.sh" "$RELEASE_DIR/*" "*.git*" "*.DS_Store" "*__MACOSX*" "*.zip"

echo "Created $ZIP_FILE with version $VERSION"
echo "Files included in the zip:"
unzip -l "$ZIP_FILE"
