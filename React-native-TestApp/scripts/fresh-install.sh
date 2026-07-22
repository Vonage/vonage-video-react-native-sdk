#!/bin/bash

echo "🧹 Starting fresh install..."

CONFIG_FILE="sdk-config.json"

# Check if sdk-config.json exists
if [ -f "$CONFIG_FILE" ]; then
  echo "� Applying SDK profile configuration..."
  
  # Get current profile
  PROFILE=$(jq -r '.currentProfile' "$CONFIG_FILE")
  echo "🎯 Current profile: $PROFILE"
  
  # Check if profile contains "github" - if so, generate .npmrc
  if [[ "$PROFILE" == *"github"* ]]; then
    echo "🔑 Generating .npmrc from credentials..."
    
    # Extract GitHub token from config
    GITHUB_TOKEN=$(jq -r '.credentials.github.authToken // "YOUR_GITHUB_TOKEN"' "$CONFIG_FILE")
    
    # Generate .npmrc file
    cat > .npmrc << EOF
@opentok:registry=https://npm.pkg.github.com
# This file is auto-generated from sdk-config.json
# Run fresh-install.sh to regenerate
//npm.pkg.github.com/:_authToken=$GITHUB_TOKEN
EOF
    
    echo "✅ Generated .npmrc with GitHub token"
  else
    echo "ℹ️  Skipping .npmrc generation (not a GitHub profile)"
    # Remove .npmrc if it exists
    rm -f .npmrc
  fi
  
  # Extract configuration (using bracket notation to handle hyphens in profile names)
  PACKAGE_NAME=$(jq -r ".profiles[\"$PROFILE\"].packageName" "$CONFIG_FILE")
  PACKAGE_SOURCE=$(jq -r ".profiles[\"$PROFILE\"].packageSource" "$CONFIG_FILE")
  IMPORT_PATH=$(jq -r ".profiles[\"$PROFILE\"].importPath" "$CONFIG_FILE")
  
  if [ "$PACKAGE_NAME" != "null" ] && [ "$PACKAGE_SOURCE" != "null" ]; then
    echo "📦 Package: $PACKAGE_NAME"
    echo "🔗 Source: $PACKAGE_SOURCE"
    
    # Get current SDK packages (vonage or opentok variants)
    CURRENT_PACKAGES=$(jq -r '.dependencies | keys[] | select(. | test("vonage|opentok"))' package.json 2>/dev/null)
    
    # Read package.json
    PACKAGE_JSON=$(cat package.json)
    
    # Remove all SDK variants from dependencies
    for pkg in $CURRENT_PACKAGES; do
      PACKAGE_JSON=$(echo "$PACKAGE_JSON" | jq "del(.dependencies[\"$pkg\"])")
    done
    
    # Add new package
    PACKAGE_JSON=$(echo "$PACKAGE_JSON" | jq ".dependencies[\"$PACKAGE_NAME\"] = \"$PACKAGE_SOURCE\"")
    
    # Write updated package.json
    echo "$PACKAGE_JSON" | jq '.' > package.json
    echo "✅ Updated package.json with $PACKAGE_NAME"
    
    # Update imports in source files
    echo "🔧 Updating imports in source files..."
    
    # Find all TypeScript/JavaScript files in src
    SRC_FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null)
    
    # Define the regex patterns for all possible import paths
    IMPORT_PATTERNS=(
      "@vonage/client-sdk-video-react-native"
      "opentok-react-native"
      "@opentok/opentok-react-native"
    )
    
    # Replace imports in each file
    for file in $SRC_FILES; do
      for pattern in "${IMPORT_PATTERNS[@]}"; do
        if [[ "$pattern" != "$IMPORT_PATH" ]]; then
          # Escape special characters for sed (@ and /)
          ESCAPED_PATTERN=$(echo "$pattern" | sed 's/\//\\\//g' | sed 's/@/\\@/g')
          ESCAPED_IMPORT=$(echo "$IMPORT_PATH" | sed 's/\//\\\//g' | sed 's/@/\\@/g')
          
          # Replace the import (macOS compatible sed)
          sed -i '' "s/from '$ESCAPED_PATTERN'/from '$ESCAPED_IMPORT'/g" "$file" 2>/dev/null
          sed -i '' "s/from \"$ESCAPED_PATTERN\"/from \"$ESCAPED_IMPORT\"/g" "$file" 2>/dev/null
        fi
      done
    done
    
    echo "✅ Updated imports to use $IMPORT_PATH"
  fi
else
  echo "⚠️  sdk-config.json not found, skipping profile configuration"
fi

# Remove node_modules
rm -rf node_modules

# Remove package-lock.json
rm -f package-lock.json

# Remove iOS dependencies
rm -rf ios/Pods
rm -f ios/Podfile.lock

# Install npm dependencies
npm install

# Install iOS pods
cd ios && pod install && cd ..

