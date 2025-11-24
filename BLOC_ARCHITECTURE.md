# BLoC Architecture Documentation

This app now uses the **BLoC (Business Logic Component) pattern** for state management, providing a clean separation of business logic from UI.

## Architecture Overview

### BLoC Pattern Benefits
- **Separation of Concerns**: Business logic is separated from UI
- **Testability**: Easy to test business logic independently
- **Reusability**: BLoCs can be reused across different widgets
- **Predictable State Management**: State changes are explicit and traceable

## BLoC Structure

### 1. Auth BLoC (`lib/bloc/auth/`)

**Purpose**: Manages user authentication and authorization

**Events**:
- `CheckUserGroups`: Checks if user is in Employees group
- `SignOut`: Signs out the current user

**States**:
- `AuthInitial`: Initial state
- `AuthLoading`: Checking user groups
- `AuthAuthenticated`: User is authenticated and authorized (isEmployee, username, userId)
- `AuthUnauthenticated`: User is not authorized or signed out
- `AuthError`: Error occurred during authentication

**Usage**:
```dart
BlocProvider(
  create: (context) => AuthBloc()..add(const CheckUserGroups()),
  child: BlocBuilder<AuthBloc, AuthState>(
    builder: (context, state) {
      // Build UI based on state
    },
  ),
)
```

### 2. Course BLoC (`lib/bloc/course/`)

**Purpose**: Manages course list fetching and refreshing

**Events**:
- `LoadCourses`: Loads assigned courses for the current user
- `RefreshCourses`: Refreshes the course list

**States**:
- `CourseInitial`: Initial state
- `CourseLoading`: Loading courses
- `CourseLoaded`: Courses loaded successfully (contains List<Course>)
- `CourseError`: Error loading courses

**Usage**:
```dart
BlocProvider(
  create: (context) => CourseBloc()..add(const LoadCourses()),
  child: BlocBuilder<CourseBloc, CourseState>(
    builder: (context, state) {
      if (state is CourseLoaded) {
        // Display courses
      }
    },
  ),
)
```

### 3. Quiz BLoC (`lib/bloc/quiz/`)

**Purpose**: Manages quiz state, question navigation, and submission

**Events**:
- `LoadQuizQuestions`: Loads quiz questions for a course
- `SelectAnswer`: Selects an answer for the current question
- `NextQuestion`: Moves to the next question
- `PreviousQuestion`: Moves to the previous question
- `SubmitQuiz`: Submits the quiz and calculates score
- `ResetQuiz`: Resets the quiz to start over

**States**:
- `QuizInitial`: Initial state
- `QuizLoading`: Loading quiz questions
- `QuizLoaded`: Quiz loaded (questions, answers, currentQuestionIndex)
- `QuizSubmitting`: Submitting quiz results
- `QuizResults`: Quiz completed (score, passed, questions, answers)
- `QuizError`: Error occurred

**Usage**:
```dart
BlocProvider(
  create: (context) => QuizBloc()..add(LoadQuizQuestions(courseId)),
  child: BlocBuilder<QuizBloc, QuizState>(
    builder: (context, state) {
      if (state is QuizLoaded) {
        // Display quiz
      } else if (state is QuizResults) {
        // Display results
      }
    },
  ),
)
```

## File Structure

```
lib/
├── bloc/
│   ├── auth/
│   │   ├── auth_bloc.dart
│   │   ├── auth_event.dart
│   │   └── auth_state.dart
│   ├── course/
│   │   ├── course_bloc.dart
│   │   ├── course_event.dart
│   │   └── course_state.dart
│   └── quiz/
│       ├── quiz_bloc.dart
│       ├── quiz_event.dart
│       └── quiz_state.dart
├── screens/
│   ├── course_list_screen.dart (uses CourseBloc)
│   ├── quiz_screen.dart (uses QuizBloc)
│   └── profile_screen.dart (uses AuthBloc)
└── main.dart (provides AuthBloc at root)
```

## How to Use BLoC

### Dispatching Events

```dart
// In a widget
context.read<CourseBloc>().add(const LoadCourses());
context.read<QuizBloc>().add(SelectAnswer(questionIndex: 0, answerIndex: 1));
context.read<AuthBloc>().add(const SignOut());
```

### Listening to State Changes

```dart
BlocBuilder<CourseBloc, CourseState>(
  builder: (context, state) {
    if (state is CourseLoading) {
      return CircularProgressIndicator();
    }
    if (state is CourseLoaded) {
      return ListView(children: state.courses.map(...));
    }
    if (state is CourseError) {
      return Text('Error: ${state.message}');
    }
    return SizedBox();
  },
)
```

### Listening for Side Effects

```dart
BlocListener<QuizBloc, QuizState>(
  listener: (context, state) {
    if (state is QuizResults) {
      // Show dialog, navigate, etc.
    }
  },
  child: YourWidget(),
)
```

## Benefits of This Architecture

1. **Testable**: Each BLoC can be tested independently
2. **Maintainable**: Clear separation between UI and business logic
3. **Scalable**: Easy to add new features by creating new BLoCs
4. **Predictable**: State changes are explicit through events
5. **Reactive**: UI automatically updates when state changes

## Dependencies

- `flutter_bloc: ^8.1.6` - BLoC pattern implementation
- `equatable: ^2.0.5` - Value equality for states and events

## Migration Notes

- All `StatefulWidget` screens converted to `StatelessWidget` with BLoC
- State management moved from `setState()` to BLoC events/states
- Business logic extracted from UI into BLoC classes
- Services remain unchanged and are called from BLoC handlers

