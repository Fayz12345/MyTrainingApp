#!/bin/bash

# Force Full Backend Redeploy to Sync All Models
# This will trigger a complete backend rebuild

echo "=========================================="
echo "Force Full Backend Redeploy"
echo "=========================================="
echo ""

cd /var/www/html/MyTrainingApp

# Step 1: Make a small change to trigger redeploy
echo "1. Updating schema to force redeploy..."
cat >> amplify/data/resource.ts << 'EOF'

// Force redeploy - ensure all models are in AppSync schema
EOF

# Step 2: Commit and push
echo ""
echo "2. Committing changes..."
git add amplify/data/resource.ts
git commit -m "Force full backend redeploy - sync AppSync schema with DynamoDB tables" || echo "Already committed"

echo ""
echo "3. Pushing to trigger deployment..."
echo "   (You'll need to push manually: git push origin dev)"
echo ""

# Step 3: Instructions
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo ""
echo "1. Push the changes:"
echo "   git push origin dev"
echo ""
echo "2. Wait 5-10 minutes for deployment to complete"
echo ""
echo "3. After deployment, regenerate outputs:"
echo "   npx ampx generate outputs --app-id d6c38s8spsb1t --branch dev --profile amplify"
echo ""
echo "4. Verify all models are present:"
echo "   ./check-models.sh"
echo ""
echo "5. Copy to admin app:"
echo "   cp amplify_outputs.json my-training-admin/src/amplify_outputs.json"
echo ""

