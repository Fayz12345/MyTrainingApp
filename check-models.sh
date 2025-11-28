#!/bin/bash

# Script to check all models in schema and deployed backend
# Usage: ./check-models.sh

echo "=========================================="
echo "Check All Models Listing"
echo "=========================================="
echo ""

cd /var/www/html/MyTrainingApp

# Check 1: Models in Schema File
echo "📋 Models Defined in Schema (amplify/data/resource.ts):"
echo "──────────────────────────────────────────────────"
if [ -f "amplify/data/resource.ts" ]; then
    SCHEMA_MODELS=$(grep -E "^  [A-Z][a-zA-Z]+:" amplify/data/resource.ts | grep -v "^\s*//" | sed 's/:.*//' | sed 's/^  //' | sort)
    if [ -n "$SCHEMA_MODELS" ]; then
        echo "$SCHEMA_MODELS" | while read model; do
            echo "  ✅ $model"
        done
        echo ""
        echo "Total: $(echo "$SCHEMA_MODELS" | wc -l) models"
    else
        echo "  ❌ No models found in schema"
    fi
else
    echo "❌ Schema file not found"
fi

echo ""
echo ""

# Check 2: Models in Deployed Backend (amplify_outputs.json)
echo "🚀 Models in Deployed Backend (amplify_outputs.json):"
echo "──────────────────────────────────────────────────"
if [ -f "amplify_outputs.json" ]; then
    MODELS=$(jq -r '.data.model_introspection.models | keys[]' amplify_outputs.json 2>/dev/null | sort)
    if [ -n "$MODELS" ]; then
        echo "$MODELS" | while read model; do
            echo "  ✅ $model"
        done
        echo ""
        echo "Total: $(echo "$MODELS" | wc -l) models"
    else
        echo "  ❌ No models found in outputs"
    fi
else
    echo "  ❌ amplify_outputs.json not found"
    echo "  Run: npx ampx generate outputs --app-id <APP_ID> --branch <BRANCH> --profile amplify"
fi

echo ""
echo ""

# Check 3: Models in Admin App Outputs
echo "📱 Models in Admin App (my-training-admin/src/amplify_outputs.json):"
echo "──────────────────────────────────────────────────"
if [ -f "my-training-admin/src/amplify_outputs.json" ]; then
    ADMIN_MODELS=$(jq -r '.data.model_introspection.models | keys[]' my-training-admin/src/amplify_outputs.json 2>/dev/null | sort)
    if [ -n "$ADMIN_MODELS" ]; then
        echo "$ADMIN_MODELS" | while read model; do
            echo "  ✅ $model"
        done
        echo ""
        echo "Total: $(echo "$ADMIN_MODELS" | wc -l) models"
    else
        echo "  ❌ No models found"
    fi
else
    echo "  ❌ Admin app outputs not found"
fi

echo ""
echo ""

# Check 4: Compare Schema vs Deployed
echo "🔍 Comparison: Schema vs Deployed"
echo "──────────────────────────────────────────────────"
if [ -f "amplify/data/resource.ts" ] && [ -f "amplify_outputs.json" ]; then
    SCHEMA_MODELS=$(grep -E "^  [A-Z][a-zA-Z]+:" amplify/data/resource.ts | grep -v "^\s*//" | sed 's/:.*//' | sed 's/^  //' | sort)
    DEPLOYED_MODELS=$(jq -r '.data.model_introspection.models | keys[]' amplify_outputs.json 2>/dev/null | sort)
    
    echo "Models in Schema but NOT deployed:"
    MISSING=$(comm -23 <(echo "$SCHEMA_MODELS") <(echo "$DEPLOYED_MODELS"))
    if [ -n "$MISSING" ]; then
        echo "$MISSING" | while read model; do
            echo "  ❌ $model"
        done
    else
        echo "  ✅ All models are deployed"
    fi
    
    echo ""
    echo "Models deployed but NOT in schema:"
    EXTRA=$(comm -13 <(echo "$SCHEMA_MODELS") <(echo "$DEPLOYED_MODELS"))
    if [ -n "$EXTRA" ]; then
        echo "$EXTRA" | while read model; do
            echo "  ⚠️  $model (orphaned)"
        done
    else
        echo "  ✅ No orphaned models"
    fi
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
if [ -f "amplify/data/resource.ts" ]; then
    SCHEMA_COUNT=$(grep -E "^  [A-Z][a-zA-Z]+:" amplify/data/resource.ts | grep -v "^\s*//" | wc -l)
    echo "📋 Schema models: $SCHEMA_COUNT"
fi

if [ -f "amplify_outputs.json" ]; then
    DEPLOYED_COUNT=$(jq -r '.data.model_introspection.models | keys | length' amplify_outputs.json 2>/dev/null || echo "0")
    echo "🚀 Deployed models: $DEPLOYED_COUNT"
fi

echo ""
echo "✅ Check complete!"

