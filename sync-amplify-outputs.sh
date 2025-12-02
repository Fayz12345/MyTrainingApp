#!/bin/bash

# Script to sync amplify_outputs.json to all required locations after deployment
# This ensures the React admin app and Flutter app have the latest configuration

AMPLIFY_OUTPUTS_ROOT="./amplify_outputs.json"
AMPLIFY_OUTPUTS_ADMIN="./my-training-admin/src/amplify_outputs.json"
AMPLIFY_OUTPUTS_FLUTTER_ASSETS="./assets/amplify_outputs.json"

echo "🔄 Syncing amplify_outputs.json to all locations..."
echo ""

# Check if root file exists
if [ ! -f "$AMPLIFY_OUTPUTS_ROOT" ]; then
    echo "❌ Error: Root amplify_outputs.json not found at: $AMPLIFY_OUTPUTS_ROOT"
    echo "   Make sure you've deployed the backend first!"
    exit 1
fi

echo "✅ Found root amplify_outputs.json"
echo ""

# Copy to React admin app
if [ -d "$(dirname "$AMPLIFY_OUTPUTS_ADMIN")" ]; then
    echo "📋 Copying to React admin app..."
    cp "$AMPLIFY_OUTPUTS_ROOT" "$AMPLIFY_OUTPUTS_ADMIN"
    if [ $? -eq 0 ]; then
        echo "  ✅ Copied to: $AMPLIFY_OUTPUTS_ADMIN"
    else
        echo "  ❌ Failed to copy to admin app"
        exit 1
    fi
else
    echo "⚠️  Admin directory not found: $(dirname "$AMPLIFY_OUTPUTS_ADMIN")"
fi

echo ""

# Check if Flutter assets directory exists and copy there if needed
if [ -d "./assets" ]; then
    echo "📋 Copying to Flutter assets..."
    cp "$AMPLIFY_OUTPUTS_ROOT" "$AMPLIFY_OUTPUTS_FLUTTER_ASSETS"
    if [ $? -eq 0 ]; then
        echo "  ✅ Copied to: $AMPLIFY_OUTPUTS_FLUTTER_ASSETS"
    else
        echo "  ⚠️  Failed to copy to Flutter assets (may not be needed)"
    fi
else
    echo "ℹ️  Flutter assets directory not found (Flutter app may use root file)"
fi

echo ""
echo "✅ Sync complete!"
echo ""
echo "📋 Verification:"
echo "  Root file: $AMPLIFY_OUTPUTS_ROOT"
if [ -f "$AMPLIFY_OUTPUTS_ROOT" ]; then
    echo "    ✅ Exists ($(wc -c < "$AMPLIFY_OUTPUTS_ROOT") bytes)"
fi

echo "  Admin file: $AMPLIFY_OUTPUTS_ADMIN"
if [ -f "$AMPLIFY_OUTPUTS_ADMIN" ]; then
    echo "    ✅ Exists ($(wc -c < "$AMPLIFY_OUTPUTS_ADMIN") bytes)"
    
    # Check if storage paths include courses/images
    if grep -q "courses/images" "$AMPLIFY_OUTPUTS_ADMIN"; then
        echo "    ✅ Contains courses/images/* path"
    else
        echo "    ⚠️  Missing courses/images/* path (may need to redeploy)"
    fi
else
    echo "    ❌ Not found"
fi

echo ""
echo "💡 Next steps:"
echo "   1. Restart your React dev server if running"
echo "   2. Rebuild your Flutter app if needed"
echo "   3. Test the image upload functionality"

