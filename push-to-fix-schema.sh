#!/bin/bash

# Script to push changes and fix AppSync schema sync issue

echo "=========================================="
echo "Fix AppSync Schema Sync Issue"
echo "=========================================="
echo ""

cd /var/www/html/MyTrainingApp

echo "Current status:"
echo "  ✅ Schema has all 8 models"
echo "  ✅ DynamoDB tables exist for all 8 models"
echo "  ❌ AppSync schema only has 5 models"
echo ""

echo "Ready to push changes to trigger schema rebuild..."
echo ""

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes. Please commit them first."
    git status --short
    exit 1
fi

# Check if there are commits to push
if [ -z "$(git log origin/dev..HEAD 2>/dev/null)" ]; then
    echo "✅ All changes are already pushed"
    echo ""
    echo "If deployment already completed, run:"
    echo "  npx ampx generate outputs --app-id d6c38s8spsb1t --branch dev --profile amplify"
    echo "  ./check-models.sh"
else
    echo "📤 Pushing changes to trigger deployment..."
    echo ""
    echo "After pushing, the deployment will:"
    echo "  1. Rebuild the AppSync GraphQL schema"
    echo "  2. Sync all 8 models from DynamoDB to AppSync"
    echo "  3. Update schema introspection"
    echo ""
    echo "Run this command to push:"
    echo "  git push origin dev"
    echo ""
    echo "Then wait 5-10 minutes and run:"
    echo "  npx ampx generate outputs --app-id d6c38s8spsb1t --branch dev --profile amplify"
    echo "  ./check-models.sh"
fi

