#!/bin/bash

# Quick script to check and verify SES email

set -e

REGION="ca-central-1"
FROM_EMAIL="circular360dev@gmail.com"

echo "📧 SES Email Verification Check"
echo "================================="
echo ""

# Check current status
echo "Checking verification status for: $FROM_EMAIL"
echo ""

STATUS=$(aws ses get-identity-verification-attributes \
  --identities "$FROM_EMAIL" \
  --region "$REGION" \
  --query "VerificationAttributes.\"$FROM_EMAIL\".VerificationStatus" \
  --output text 2>/dev/null || echo "NotVerified")

if [ "$STATUS" == "Success" ]; then
    echo "✅ Email is VERIFIED"
    echo ""
    echo "You're all set! SES can send emails from this address."
    echo ""
elif [ "$STATUS" == "Pending" ]; then
    echo "⚠️  Email verification is PENDING"
    echo ""
    echo "📧 Action Required:"
    echo "   1. Check inbox for: $FROM_EMAIL"
    echo "   2. Look for email from: AWS Notifications"
    echo "   3. Subject: 'Amazon SES Address Verification Request'"
    echo "   4. Click the verification link"
    echo ""
    echo "   Or request a new verification email:"
    echo "   aws ses verify-email-identity --email-address $FROM_EMAIL --region $REGION"
    echo ""
elif [ "$STATUS" == "NotVerified" ]; then
    echo "❌ Email is NOT VERIFIED"
    echo ""
    echo "📧 Requesting verification email..."
    aws ses verify-email-identity \
      --email-address "$FROM_EMAIL" \
      --region "$REGION"
    echo ""
    echo "✅ Verification email sent!"
    echo "   Check inbox for: $FROM_EMAIL"
    echo "   Click the verification link"
    echo ""
else
    echo "⚠️  Status: $STATUS"
    echo ""
    echo "📧 To verify, run:"
    echo "   aws ses verify-email-identity --email-address $FROM_EMAIL --region $REGION"
    echo ""
fi

# Check SES account status
echo "📊 SES Account Status:"
QUOTA=$(aws ses get-send-quota --region "$REGION" --output json 2>/dev/null)
if [ -n "$QUOTA" ]; then
    MAX_24H=$(echo "$QUOTA" | python3 -c "import sys, json; print(json.load(sys.stdin).get('Max24HourSend', 'N/A'))" 2>/dev/null || echo "N/A")
    if [ "$MAX_24H" == "200.0" ]; then
        echo "   ⚠️  Sandbox Mode (200 emails/day limit)"
        echo "   💡 To send to any email, request production access"
    else
        echo "   ✅ Production Mode (higher limits)"
    fi
fi
echo ""

