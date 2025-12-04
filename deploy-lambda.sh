#!/bin/bash

# Quick deployment script for sendManagerNotification Lambda
# This deploys the Lambda and sets up SNS subscription

set -e

echo "🚀 Deploying sendManagerNotification Lambda"
echo "==========================================="
echo ""

# Step 1: Deploy using Amplify
echo "📦 Step 1: Deploying Lambda functions..."
echo "   Running: npx ampx sandbox"
echo ""

cd /var/www/html/MyTrainingApp

npx ampx sandbox

echo ""
echo "✅ Deployment complete!"
echo ""

# Step 2: Wait a moment for Lambda to be ready
echo "⏳ Waiting for Lambda to be ready (10 seconds)..."
sleep 10

# Step 3: Setup SNS subscription
echo ""
echo "🔗 Step 2: Setting up SNS subscription..."
cd amplify/functions

if [ -f "./setup-html-email.sh" ]; then
    ./setup-html-email.sh
else
    echo "⚠️  Setup script not found. Please run manually:"
    echo "   cd amplify/functions"
    echo "   ./setup-html-email.sh"
fi

echo ""
echo "==========================================="
echo "✅ Deployment and Setup Complete!"
echo "==========================================="
echo ""
echo "📧 HTML email rendering is now enabled!"
echo ""
echo "🧪 Test:"
echo "   1. Have an employee complete and pass a quiz"
echo "   2. Manager should receive HTML email (properly formatted)"
echo ""

