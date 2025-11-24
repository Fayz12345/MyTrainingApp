#!/bin/bash

# Script to manually update amplify_outputs.json with all groups
# This adds the missing groups (Store, BusinessUnit, SuperAdmin) to the groups array

AMPLIFY_OUTPUTS_ROOT="../../amplify_outputs.json"
AMPLIFY_OUTPUTS_ADMIN="./src/amplify_outputs.json"

echo "🔄 Updating amplify_outputs.json with all groups..."
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required but not installed"
    echo "   Install with: sudo apt-get install jq"
    exit 1
fi

# Function to update a file
update_file() {
    local file=$1
    if [ ! -f "$file" ]; then
        echo "⚠️  File not found: $file (skipping)"
        return 1
    fi
    
    echo "📝 Updating: $file"
    
    # Create updated groups array
    jq '.auth.groups = [
        {"Employees": {"precedence": 0}},
        {"Managers": {"precedence": 1}},
        {"Store": {"precedence": 2}},
        {"BusinessUnit": {"precedence": 3}},
        {"SuperAdmin": {"precedence": 4}}
    ]' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    
    if [ $? -eq 0 ]; then
        echo "  ✅ Updated successfully"
        return 0
    else
        echo "  ❌ Failed to update"
        return 1
    fi
}

# Update root file
if [ -f "$AMPLIFY_OUTPUTS_ROOT" ]; then
    update_file "$AMPLIFY_OUTPUTS_ROOT"
else
    echo "⚠️  Root amplify_outputs.json not found at: $AMPLIFY_OUTPUTS_ROOT"
fi

echo ""

# Update admin file
if [ -f "$AMPLIFY_OUTPUTS_ADMIN" ]; then
    update_file "$AMPLIFY_OUTPUTS_ADMIN"
else
    echo "⚠️  Admin amplify_outputs.json not found at: $AMPLIFY_OUTPUTS_ADMIN"
fi

echo ""
echo "✅ Update complete!"
echo ""
echo "📋 Verification:"
if [ -f "$AMPLIFY_OUTPUTS_ADMIN" ]; then
    echo "Groups in admin amplify_outputs.json:"
    jq -r '.auth.groups[] | keys[]' "$AMPLIFY_OUTPUTS_ADMIN" | while read group; do
        precedence=$(jq -r ".auth.groups[] | select(has(\"$group\")) | .\"$group\".precedence" "$AMPLIFY_OUTPUTS_ADMIN")
        echo "  ✅ $group (precedence: $precedence)"
    done
fi

