import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/course_model.dart';
import '../bloc/course/course_bloc.dart';
import '../bloc/quiz/quiz_bloc.dart';
import 'video_player_screen.dart';
import 'quiz_screen.dart';

class CourseListScreen extends StatelessWidget {
  const CourseListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => CourseBloc()..add(const LoadCourses()),
      child: const CourseListContent(),
    );
  }
}

class CourseListContent extends StatelessWidget {
  const CourseListContent({super.key});

  void _viewCourseDetails(BuildContext context, Course course) {
    if (course.assignmentStatus == 'completed') {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(course.title),
          content: const Text('You have already completed this course!'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                _startVideo(context, course);
              },
              child: const Text('Review Training'),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                _startQuiz(context, course);
              },
              child: const Text('Retake Quiz'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } else {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(course.title),
          content: const Text('Ready to start your training?'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                _startVideo(context, course);
              },
              child: const Text('Start Training'),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                _startQuiz(context, course);
              },
              child: const Text('Skip to Quiz'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    }
  }

  void _startVideo(BuildContext context, Course course) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => VideoPlayerScreen(
          course: course,
          onVideoComplete: () {
            Navigator.pop(context);
            Future.delayed(const Duration(milliseconds: 500), () {
              _startQuiz(context, course);
            });
          },
          onClose: () {
            Navigator.pop(context);
          },
        ),
      ),
    );
  }

  void _startQuiz(BuildContext context, Course course) {
    if (course.assignmentId == null) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BlocProvider(
          create: (context) => QuizBloc()..add(LoadQuizQuestions(course.id)),
          child: QuizScreen(
            course: course,
            assignmentId: course.assignmentId!,
            onQuizComplete: (score, passed) {
              Navigator.pop(context);
              context.read<CourseBloc>().add(const RefreshCourses());
              _showQuizResult(context, score, passed);
            },
            onClose: () {
              Navigator.pop(context);
            },
          ),
        ),
      ),
    );
  }

  void _showQuizResult(BuildContext context, int score, bool passed) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Quiz Complete!'),
        content: Text(
          'You scored $score%${passed ? ' and passed!' : '. You can retake the quiz anytime.'}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Training'),
        backgroundColor: const Color(0xFF007AFF),
        foregroundColor: Colors.white,
      ),
      body: BlocBuilder<CourseBloc, CourseState>(
        builder: (context, state) {
          if (state is CourseError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'An Error Occurred:',
                      style: TextStyle(
                        color: Colors.red[700],
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      state.message,
                      style: TextStyle(
                        color: Colors.red[600],
                        fontSize: 12,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: () {
                        context.read<CourseBloc>().add(const LoadCourses());
                      },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          if (state is CourseLoading) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(
                    'Loading your courses...',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            );
          }

          if (state is CourseLoaded) {
            final courses = state.courses;
print("courses $courses");
            return RefreshIndicator(
              onRefresh: () async {
                context.read<CourseBloc>().add(const RefreshCourses());
                // Wait a bit for the state to update
                await Future.delayed(const Duration(milliseconds: 500));
              },
              child: courses.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(40.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'No training assigned',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.grey[600],
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Check back later for new courses',
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey[500],
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 20),
                            ElevatedButton(
                              onPressed: () {
                                print("courses RefreshCourses $courses");
                                context
                                    .read<CourseBloc>()
                                    .add(const RefreshCourses());
                              },
                              child: const Text('Refresh'),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: courses.length,
                      itemBuilder: (context, index) {
                        final course = courses[index];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          elevation: 2,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: ListTile(
                            contentPadding: const EdgeInsets.all(16),
                            title: Text(
                              course.title,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: course.assignmentStatus == 'completed'
                                      ? Colors.green[50]
                                      : Colors.blue[50],
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  course.assignmentStatus == 'completed'
                                      ? '✅ Completed'
                                      : '📚 Assigned',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color:
                                        course.assignmentStatus == 'completed'
                                            ? Colors.green[700]
                                            : Colors.blue[700],
                                  ),
                                ),
                              ),
                            ),
                            trailing: Icon(
                              Icons.chevron_right,
                              color: Colors.grey[400],
                            ),
                            onTap: () => _viewCourseDetails(context, course),
                          ),
                        );
                      },
                    ),
            );
          }

          return const Center(
            child: CircularProgressIndicator(),
          );
        },
      ),
    );
  }
}
