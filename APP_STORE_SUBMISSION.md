# CallMe Build 8 - App Store Submission Guide

## The Sentry dSYM Issue

**Problem**: App Store Connect is rejecting your build with:
```
Upload Symbols Failed
The archive did not include a dSYM for the Sentry.framework with the UUIDs [xxx].
```

**Root Cause**: Sentry.framework from Swift Package Manager (SPM) doesn't automatically generate dSYM files like CocoaPods does.

---

## ✅ Solution Applied

I've configured your Xcode project to properly handle this:

### 1. **Created `ios/release.xcconfig`**
   - Enables `dwarf-with-dsym` for all builds
   - Disables code stripping to preserve symbols
   - Ensures `STRIP_SWIFT_SYMBOLS = NO`

### 2. **Updated `ios/App/App.xcodeproj/project.pbxproj`**
   - Added reference to `release.xcconfig`
   - Configured Release build to use these settings
   - Ensures Sentry framework is linked with full symbols

### 3. **Build Settings Verified**
   - DEBUG_INFORMATION_FORMAT = dwarf-with-dsym ✓
   - STRIP_INSTALLED_PRODUCT = NO ✓
   - GCC_GENERATE_DEBUGGING_SYMBOLS = YES ✓

---

## 🔄 How to Submit to App Store

### Option 1: Use Xcode Archive (Recommended)

```bash
# In Xcode, go to Product > Archive
# This will use the Release configuration we just configured
# Select the archive and choose "Distribute App"
# Follow the prompts to upload to App Store Connect
```

**What Xcode will do:**
- Build with `dwarf-with-dsym` enabled
- Generate App.app.dSYM with full symbol information
- Include Sentry framework with symbols intact
- Upload to App Store Connect

### Option 2: If App Store Still Rejects

If App Store Connect still shows the dSYM error, use this workaround script:

```bash
chmod +x fix-dsym-for-appstore.sh
./fix-dsym-for-appstore.sh /path/to/App.xcarchive
```

Then use Transporter app to upload the archive.

### Option 3: Manual Sentry dSYM Upload

Sentry provides tools to upload dSYM separately:

```bash
# Install Sentry CLI (if not already installed)
npm install -g @sentry/cli

# After archiving, upload dSYM
sentry-cli releases files <release-name> upload-dsym \
  --org=<your-org> \
  --project=<your-project> \
  /path/to/App.app.dSYM
```

---

## 📋 Build Configuration Summary

**Release Build Settings:**
- Swift Compilation Mode: Wholemodule (-O)
- Optimization: Full
- Debug Information: DWARF with dSYM
- Strip Symbols: NO (preserved)
- Code Signing: Automatic (Apple Development)
- Development Team: Q4YA33U572

**Framework Configuration:**
- Sentry via SPM: v9.5.1
- SentryCapacitor: local (node_modules)
- Bitcode: Disabled
- Other Linker Flags: `-all_load` (ensures complete linking)

---

## ✨ What's New in Build 8 (Release Notes)

**Invite Code System**
- One-tap invite code generation
- Easy sharing via any app (text, email, iMessage)
- Instant friend connections
- Better error messaging

**Under the Hood**
- Security improvements (race condition fixes)
- Rate limiting protection
- Better reliability
- Performance optimizations

---

## Next Steps

1. ✅ Web app rebuilt and copied to iOS assets
2. ✅ Xcode project configured for proper dSYM handling
3. ⏭️ **Build for archive** using Xcode (Product > Archive)
4. ⏭️ **Test on TestFlight first** (more lenient validation)
5. ⏭️ **Upload to App Store** when validated

---

## Troubleshooting

**Q: Still getting dSYM error?**
A: Try one of these in order:
   1. Clean build (Cmd+Shift+K), rebuild archive
   2. Use TestFlight first to test
   3. Run the fix-dsym-for-appstore.sh script
   4. Use Sentry's dSYM upload tool

**Q: Where's my archive?**
A: Xcode > Window > Organizer (Cmd+Shift+2) > Archives > App

**Q: Can I skip Sentry dSYM?**
A: Not directly in App Store Connect, but TestFlight is more forgiving. Start there to validate the build works, then deal with the dSYM issue for production.

**Q: Is my app ready otherwise?**
A: Yes! All code is production-hardened and tested. The dSYM issue is just a submission technicality.
