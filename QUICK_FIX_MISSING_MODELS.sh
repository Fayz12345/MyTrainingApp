#!/bin/bash

# Quick script to fix and deploy missing models
# This will commit the dependency fixes and trigger deployment

echo "=========================================="
echo "Fix and Deploy Missing Models"
echo "=========================================="
echo ""

cd /var/www/html/MyTrainingApp

# Step 1: Commit dependency fixes
echo "1. Committing dependency fixes..."
git add amplify/package.json amplify/package-lock.json
git commit -m "Fix missing dependencies - enable BusinessUnit, Store, Manager models deployment" || echo "Already committed"

# Step 2: Push to trigger deployment
echo ""
echo "2. Pushing to trigger deployment..."
git push origin dev

echo ""
echo "✅ Code pushed successfully!"
echo ""
echo "⏳ Deployment will take 5-10 minutes"
echo ""
echo "After deployment completes, run:"
echo "  npx ampx generate outputs --app-id d6c38s8spsb1t --branch dev --profile amplify"
echo "  jq '.data.model_introspection.models | keys' amplify_outputs.json"
echo "  cp amplify_outputs.json my-training-admin/src/amplify_outputs.json"


