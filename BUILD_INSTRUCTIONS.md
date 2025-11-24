# Build Instructions

## Android Build

### Prerequisites
- Flutter SDK 3.35 or later
- Android Studio with Android SDK
- Java JDK 11 or later

### Build Steps

1. **Get Flutter dependencies:**
   ```bash
   flutter pub get
   ```

2. **Build APK (Debug):**
   ```bash
   flutter build apk --debug
   ```

3. **Build APK (Release):**
   ```bash
   flutter build apk --release
   ```

4. **Build App Bundle (for Play Store):**
   ```bash
   flutter build appbundle --release
   ```

5. **Run on connected device:**
   ```bash
   flutter run
   ```

### Android Configuration
- **Min SDK:** 21 (Android 5.0)
- **Target SDK:** 34 (Android 14)
- **Gradle Plugin:** 8.3.0
- **Kotlin:** 1.9.22

## iOS Build

### Prerequisites
- macOS with Xcode installed
- CocoaPods installed: `sudo gem install cocoapods`
- Flutter SDK 3.35 or later

### Build Steps

1. **Get Flutter dependencies:**
   ```bash
   flutter pub get
   ```

2. **Install iOS dependencies:**
   ```bash
   cd ios
   pod install
   cd ..
   ```

3. **Build iOS (Debug):**
   ```bash
   flutter build ios --debug
   ```

4. **Build iOS (Release):**
   ```bash
   flutter build ios --release
   ```

5. **Run on connected device:**
   ```bash
   flutter run
   ```

### iOS Configuration
- **Minimum iOS Version:** 12.0
- **Swift Version:** 5.0+

## Important Notes

1. **Amplify Configuration:**
   - Make sure `amplify_outputs.json` is in the root directory or `assets/` folder
   - Generate it using: `npx ampx sandbox`

2. **Signing:**
   - Android: Currently using debug signing. Update `android/app/build.gradle` for release signing.
   - iOS: Configure signing in Xcode project settings.

3. **First Build:**
   - The first build may take longer as it downloads dependencies
   - Android: Gradle will download required dependencies
   - iOS: CocoaPods will install required pods

## Troubleshooting

### Android Build Issues

1. **Gradle sync failed:**
   ```bash
   cd android
   ./gradlew clean
   cd ..
   flutter clean
   flutter pub get
   ```

2. **SDK version issues:**
   - Make sure Android SDK 34 is installed in Android Studio

### iOS Build Issues

1. **Pod install failed:**
   ```bash
   cd ios
   pod deintegrate
   pod install
   cd ..
   ```

2. **Code signing issues:**
   - Open `ios/Runner.xcworkspace` in Xcode
   - Configure signing in project settings

3. **Swift version issues:**
   - Make sure Xcode is up to date
   - Check Swift version in project settings

