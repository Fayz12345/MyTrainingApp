# Fixing Gradle Cache Issues

If you encounter cache corruption errors, run these commands:

## Quick Fix Commands

```bash
# 1. Clean Flutter build
cd /Users/webtechsoft/Documents/new/MyTrainingApp-develop
flutter clean

# 2. Clean Android build
cd android
rm -rf .gradle build
cd ..

# 3. Clean corrupted Gradle cache
rm -rf ~/.gradle/caches/8.14.1/kotlin-dsl
rm -rf ~/.gradle/caches/8.14.1/scripts
rm -rf ~/.gradle/caches/8.14.1/accessors

# 4. Get dependencies
flutter pub get

# 5. Try building again
flutter build apk --debug
```

## If Still Having Issues

### Complete Cache Cleanup (Use with caution - will require re-downloading dependencies)

```bash
# Clean all Gradle caches (will free up ~15GB but requires re-download)
rm -rf ~/.gradle/caches

# Clean Flutter cache (will free up ~3.5GB)
rm -rf ~/Downloads/development/flutter/bin/cache

# Clean Dart cache (will free up ~1.2GB)
rm -rf ~/.dartServer
```

### Check Disk Space

```bash
df -h
```

If disk is full (100% capacity), you need to free up space before building.

## Current Configuration

- **Android Gradle Plugin**: 8.6.0
- **Kotlin**: 2.2.0
- **compileSdk**: 36
- **targetSdk**: 36
- **Min SDK**: 21 (from Flutter defaults)

