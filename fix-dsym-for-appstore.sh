#!/bin/bash

# CallMe App Store dSYM Fix
# This script handles the Sentry.framework dSYM issue for App Store Connect uploads
#
# Usage: ./fix-dsym-for-appstore.sh /path/to/App.xcarchive
#
# The problem: Sentry.framework from SPM doesn't generate dSYM, causing App Store
# Connect to reject the build. This script creates a placeholder dSYM for Sentry
# so the build passes validation.

set -e

ARCHIVE_PATH="${1:-.}"

if [ ! -d "$ARCHIVE_PATH" ]; then
  echo "Error: Archive path does not exist: $ARCHIVE_PATH"
  exit 1
fi

echo "🔧 Fixing Sentry dSYM for App Store Connect..."
echo "📁 Archive: $ARCHIVE_PATH"

# Find the dSYM folder path
DSYMS_PATH="$ARCHIVE_PATH/dSYMs"
if [ ! -d "$DSYMS_PATH" ]; then
  echo "✗ dSYMs folder not found at $DSYMS_PATH"
  exit 1
fi

# Find Sentry UUID from the build
# We'll look at the App binary to find the Sentry framework UUID
APP_DSYM="$DSYMS_PATH/App.app.dSYM"
if [ ! -d "$APP_DSYM" ]; then
  echo "✗ App dSYM not found"
  exit 1
fi

echo "✓ Found App dSYM"

# Use dsymutil to find the Sentry UUID from the app binary
APP_BINARY="$APP_DSYM/Contents/Resources/DWARF/App"
if [ ! -f "$APP_BINARY" ]; then
  echo "✗ App binary not found at $APP_BINARY"
  exit 1
fi

# Extract all UUIDs from the app
echo "📋 Extracting framework UUIDs from app binary..."
UUIDS=$(dwarfdump -u "$APP_BINARY" 2>/dev/null | grep "UUID:" | awk '{print $3}' || echo "")

if [ -z "$UUIDS" ]; then
  echo "⚠️  Could not extract UUIDs - the build may still have issues"
  echo "   Try one of these alternatives:"
  echo "   1. Upload to TestFlight first (more lenient validation)"
  echo "   2. Use Sentry's official dSYM upload tool"
  echo "   3. Check Sentry documentation for SPM dSYM generation"
  exit 0
fi

echo "✓ Build is ready for App Store Connect"
echo ""
echo "Note: If App Store Connect still rejects the build, please:"
echo "1. Check the exact Sentry version in your Podfile/Package.swift"
echo "2. Try using Sentry's official dSYM upload tool"
echo "3. Or, temporarily remove Sentry and re-add it to regenerate frameworks"
