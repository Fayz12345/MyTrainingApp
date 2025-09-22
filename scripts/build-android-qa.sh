#!/bin/bash

# QA Android Build Script
# Tests Android build locally before deploying

set -e  # Exit on any error

echo "🚀 Starting QA Android Build..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Check if Android directory exists
if [ ! -d "android" ]; then
    echo "❌ Error: Android directory not found"
    exit 1
fi

echo "📋 Build Configuration:"
echo "  - Node version: $(node --version)"
echo "  - NPM version: $(npm --version)"
echo "  - React Native CLI: $(npx react-native --version 2>/dev/null || echo 'Not found')"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Check for common React Native issues
echo "🔍 Checking React Native setup..."

# Check if Metro bundler cache needs clearing
if [ -d "node_modules/.cache" ]; then
    echo "🧹 Clearing Metro cache..."
    rm -rf node_modules/.cache
fi

# Navigate to Android directory
cd android

# Make gradlew executable
chmod +x gradlew

echo "🧹 Cleaning Android build..."
./gradlew clean

echo "🔧 Building Android APK (Debug first)..."
if ./gradlew assembleDebug; then
    echo "✅ Debug build successful!"
    
    echo "🔧 Building Android APK (Release)..."
    if ./gradlew assembleRelease; then
        echo "✅ Release build successful!"
        
        APK_PATH="app/build/outputs/apk/release/app-release.apk"
        if [ -f "$APK_PATH" ]; then
            APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
            echo "📱 APK created successfully!"
            echo "  📁 Location: android/$APK_PATH"
            echo "  📏 Size: $APK_SIZE"
            echo ""
            echo "🎉 QA Android build completed successfully!"
            echo "🔗 APK ready for deployment: $(pwd)/$APK_PATH"
        else
            echo "❌ APK file not found at expected location"
            exit 1
        fi
    else
        echo "❌ Release build failed"
        exit 1
    fi
else
    echo "❌ Debug build failed"
    echo "💡 Common fixes:"
    echo "  - Check Android SDK installation"
    echo "  - Verify Java version (should be 17)"
    echo "  - Clear node_modules and reinstall"
    echo "  - Check for native module issues"
    exit 1
fi