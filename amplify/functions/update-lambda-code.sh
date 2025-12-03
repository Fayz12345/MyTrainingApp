#!/bin/bash

# Quick script to update Lambda function code only (no prompts)

set -e

REGION="ca-central-1"
FUNCTION_NAME="subscribeManagerToSNS-manual"

echo "🔄 Updating Lambda Function Code"
echo "================================="
echo ""

# Step 1: Create deployment package
echo "📦 Step 1: Creating deployment package..."
cd /var/www/html/MyTrainingApp/amplify/functions/subscribeManagerToSNS

# Create temp directory
TEMP_DIR=$(mktemp -d)

# Compile TypeScript to JavaScript using esbuild
echo "   Compiling TypeScript..."
cd /var/www/html/MyTrainingApp/amplify

if command -v npx &> /dev/null; then
    npx esbuild functions/subscribeManagerToSNS/handler.ts \
        --bundle \
        --platform=node \
        --target=node20 \
        --format=esm \
        --outfile="$TEMP_DIR/handler.js" \
        --external:@aws-sdk/client-sns \
        --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
        2>/dev/null || {
        echo "   ⚠️  esbuild failed, using simple conversion..."
        # Fallback
        sed 's/: [A-Za-z<>|&\[\]{}?]*//g; s/interface [A-Za-z]* {/\/\/ interface/g; s/^import type.*/\/\/ type import/g' \
            functions/subscribeManagerToSNS/handler.ts | \
            sed 's/export const handler/export const handler/g' > "$TEMP_DIR/handler.js"
    }
else
    echo "   ⚠️  npx not found, using simple conversion..."
    sed 's/: [A-Za-z<>|&\[\]{}?]*//g; s/interface [A-Za-z]* {/\/\/ interface/g; s/^import type.*/\/\/ type import/g' \
        functions/subscribeManagerToSNS/handler.ts | \
        sed 's/export const handler/export const handler/g' > "$TEMP_DIR/handler.js"
fi

# Create package.json
cat > "$TEMP_DIR/package.json" << EOF
{
  "name": "subscribeManagerToSNS",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-sns": "^3.0.0"
  }
}
EOF

# Install dependencies
cd "$TEMP_DIR"
echo "   Installing dependencies..."
npm install --production --silent 2>/dev/null || npm install --production --silent

# Create zip
ZIP_FILE="/tmp/subscribeManagerToSNS-update-$(date +%s).zip"
cd "$TEMP_DIR"
zip -r "$ZIP_FILE" . -q
echo "✅ Package created: $ZIP_FILE"

# Step 2: Update Lambda function code
echo ""
echo "🔧 Step 2: Updating Lambda function code..."
aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$ZIP_FILE" \
    --region $REGION \
    --output json > /dev/null

echo "✅ Lambda function updated successfully"

# Cleanup
rm -rf "$TEMP_DIR"
rm -f "$ZIP_FILE"

echo ""
echo "================================="
echo "✅ Update Complete!"
echo "================================="
echo ""
echo "📝 Next Steps:"
echo "   1. Test by creating a new manager"
echo "   2. Check browser console for success"
echo "   3. Check manager email for confirmation"
echo ""

