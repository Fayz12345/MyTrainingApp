# My Training App - Flutter

This is a Flutter application converted from React Native. The app provides employee training functionality with video courses and quizzes, powered by AWS Amplify.

## Prerequisites

- Flutter SDK (3.35 or later)
- Dart SDK (3.0.0 or later)
- Android Studio / Xcode (for mobile development)
- AWS Amplify CLI (for backend setup)
- Node.js (for admin dashboard)

## Setup Instructions

### 1. Install Flutter Dependencies

```bash
flutter pub get
```

### 2. Configure AWS Amplify

1. Make sure you have `amplify_outputs.json` in the root directory. If not, generate it using:

```bash
npx ampx sandbox
```

2. Copy `amplify_outputs.json` to the root directory of the project.

### 3. Run the App

#### Android
```bash
flutter run
```

#### iOS
```bash
flutter run
```

## Project Structure

```
lib/
├── main.dart                 # App entry point
├── models/                   # Data models
│   ├── course_model.dart
│   └── quiz_question_model.dart
├── screens/                  # Screen widgets
│   ├── course_list_screen.dart
│   ├── profile_screen.dart
│   ├── video_player_screen.dart
│   └── quiz_screen.dart
└── services/                 # Business logic services
    ├── amplify_service.dart
    ├── auth_service.dart
    ├── course_service.dart
    ├── quiz_service.dart
    └── storage_service.dart
```

## Features

- **Authentication**: AWS Cognito authentication with user groups (Employees/Managers)
- **Course List**: View assigned training courses
- **Video Player**: Watch training videos from S3
- **Quiz System**: Take quizzes with multiple choice questions
- **Progress Tracking**: Track course completion and quiz scores

## Admin Dashboard

The admin dashboard is located in the `my-training-admin/` folder and remains unchanged. To run it:

```bash
cd my-training-admin
npm install
npm start
```

## Backend Configuration

The AWS Amplify backend configuration is in the `amplify/` folder. To deploy or update:

```bash
npx ampx sandbox
```

## Notes

- The app requires an active AWS Amplify backend
- Users must be in the "Employees" Cognito group to access the app
- Video files should be uploaded to S3 via the admin dashboard
- Quiz questions are managed through the admin dashboard

