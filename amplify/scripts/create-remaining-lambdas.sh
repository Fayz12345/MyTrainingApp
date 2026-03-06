#!/usr/bin/env bash
#
# Create remaining Lambda functions by ensuring Amplify backend is deployed.
#
# Lambdas are defined in amplify/backend.ts and created when the Amplify backend
# is deployed. This script:
#   1. Lists Lambda names expected from backend.ts
#   2. Checks which exist in AWS (by name substring match)
#   3. Reports missing ones
#   4. Optionally runs Amplify sandbox deploy to create missing Lambdas
#
# Usage:
#   ./create-remaining-lambdas.sh              # Check and report only
#   ./create-remaining-lambdas.sh --deploy    # Check, then run Amplify deploy
#   ./create-remaining-lambdas.sh --list-aws   # List all Lambdas in AWS (for debugging)
#
# Prerequisites: AWS CLI configured, Node/npx available for Amplify.
# Run from project root or from amplify/scripts/.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AMPLIFY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$AMPLIFY_DIR/.." && pwd)"

# Expected Lambda name substrings (from defineFunction name in each resource.ts)
# Amplify may deploy as e.g. "amplify-xxx-dev-certificationExpirationCheck-yyy"
EXPECTED_LAMBDAS=(
  quizCompletion
  assignEmployeeGroup
  createCognitoGroups
  assignUserToGroup
  subscribeManagerToSNS
  sendManagerNotification
  sendWelcomeEmail
  sendLearningPathAssignmentNotification
  sendEmployeeSupportMessage
  schedulingTest
  schedulingEligibility
  certificationExpirationCheck
)

AWS_REGION="${AWS_REGION:-ca-central-1}"
DO_DEPLOY=false
LIST_AWS_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --deploy)    DO_DEPLOY=true ;;
    --list-aws)  LIST_AWS_ONLY=true ;;
    -h|--help)
      echo "Usage: $0 [--deploy] [--list-aws]"
      echo "  --deploy    After reporting, run Amplify sandbox to deploy and create missing Lambdas"
      echo "  --list-aws  Only list all Lambda function names in AWS (no check)"
      exit 0
      ;;
  esac
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Lambda deployment check (region: $AWS_REGION)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Fetch all Lambda function names from AWS
AWS_FUNCTIONS=$(aws lambda list-functions --region "$AWS_REGION" --query 'Functions[].FunctionName' --output text 2>/dev/null || true)
if [ -z "$AWS_FUNCTIONS" ]; then
  echo "Could not list Lambdas (check AWS CLI and credentials)."
  exit 1
fi

# Optional: only list AWS Lambdas
if [ "$LIST_AWS_ONLY" = true ]; then
  echo "Lambdas in AWS:"
  echo "$AWS_FUNCTIONS" | tr '\t' '\n' | sort
  exit 0
fi

# Check each expected Lambda (match by substring in full name)
MISSING=()
FOUND=()

for name in "${EXPECTED_LAMBDAS[@]}"; do
  if echo "$AWS_FUNCTIONS" | tr '\t' '\n' | grep -qFi "$name"; then
    FOUND+=("$name")
  else
    MISSING+=("$name")
  fi
done

echo "Expected Lambdas (from backend.ts): ${#EXPECTED_LAMBDAS[@]}"
echo "Found in AWS: ${#FOUND[@]}"
echo "Missing: ${#MISSING[@]}"
echo ""

if [ ${#FOUND[@]} -gt 0 ]; then
  echo "Found:"
  for n in "${FOUND[@]}"; do echo "  ✓ $n"; done
  echo ""
fi

if [ ${#MISSING[@]} -eq 0 ]; then
  echo "All expected Lambdas exist in AWS."
  exit 0
fi

echo "Missing Lambdas:"
for n in "${MISSING[@]}"; do echo "  ✗ $n"; done
echo ""

echo "To create missing Lambdas, deploy the Amplify backend:"
echo "  1. From project root run:"
echo "     cd $PROJECT_ROOT"
echo "     npx ampx sandbox --no-browser"
echo "  or push your branch and let the Amplify pipeline deploy the backend."
echo ""

if [ "$DO_DEPLOY" = true ]; then
  echo "Running Amplify sandbox (this may take several minutes)..."
  cd "$PROJECT_ROOT"
  npx ampx sandbox --no-browser
else
  echo "Tip: run with --deploy to run 'npx ampx sandbox --no-browser' now."
fi
