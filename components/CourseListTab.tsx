import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal } from 'react-native';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../amplify/data/resource';
import { VideoPlayerScreen } from './VideoPlayerScreen';
import { QuizScreen } from './QuizScreen';

const client = generateClient<Schema>();

type CourseWithAssignment = Schema['Course']['type'] & {
  assignmentStatus?: 'assigned' | 'completed';
  assignmentId?: string;
};

export function CourseListTab() {
  const [courses, setCourses] = useState<CourseWithAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithAssignment | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  const fetchCourses = useCallback(async () => {
    console.log('[CourseListTab] Starting to fetch assigned courses...');
    setLoading(true);
    setError(null);

    try {
      // Get current user
      const user = await getCurrentUser();
      console.log('[CourseListTab] Current user:', user.username);

      // Find the employee record for this user
      const { data: employees } = await client.models.Employee.list({
        filter: { userId: { eq: user.userId } }
      });

      if (!employees || employees.length === 0) {
        setError('Employee record not found');
        setLoading(false);
        return;
      }

      const employee = employees[0];
      console.log('[CourseListTab] Found employee:', employee.id);

      // Get assignments for this employee
      const { data: assignments, errors } = await client.models.Assignment.list({
        filter: { employeeId: { eq: employee.id } }
      });

      if (errors) {
        const errorMessage = `Error fetching assignments: ${JSON.stringify(errors)}`;
        console.error(errorMessage);
        setError(errorMessage);
        setLoading(false);
        return;
      }

      console.log(`[CourseListTab] Found ${assignments.length} assignments`);

      // Get courses for these assignments with their status
      const coursePromises = assignments.map(async (assignment) => {
        const result = await client.models.Course.get({ id: assignment.courseId });
        if (result.data && !result.errors) {
          return {
            ...result.data,
            assignmentStatus: assignment.status || 'assigned',
            assignmentId: assignment.id
          } as CourseWithAssignment;
        }
        return null;
      });

      const courseResults = await Promise.all(coursePromises);
      const assignedCourses = courseResults.filter(course => course !== null) as CourseWithAssignment[];

      console.log(`[CourseListTab] Successfully fetched ${assignedCourses.length} assigned courses.`);
      setCourses(assignedCourses);

    } catch (err) {
      const errorMessage = `Error: ${err}`;
      console.error(errorMessage);
      setError(errorMessage);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const viewCourseDetails = (course: CourseWithAssignment) => {
    if (course.assignmentStatus === 'completed') {
      Alert.alert(
        course.title,
        'You have already completed this course!',
        [
          { text: 'Review Training', onPress: () => startVideo(course) },
          { text: 'Retake Quiz', onPress: () => startQuiz(course) },
          { text: 'Close', style: 'cancel' }
        ]
      );
    } else {
      Alert.alert(
        course.title,
        'Ready to start your training?',
        [
          { text: 'Start Training', onPress: () => startVideo(course) },
          { text: 'Skip to Quiz', onPress: () => startQuiz(course) },
          { text: 'Close', style: 'cancel' }
        ]
      );
    }
  };

  const startVideo = (course: CourseWithAssignment) => {
    setSelectedCourse(course);
    setShowVideo(true);
  };

  const startQuiz = (course: CourseWithAssignment) => {
    setSelectedCourse(course);
    setShowQuiz(true);
  };

  const handleVideoComplete = () => {
    setShowVideo(false);
    if (selectedCourse) {
      setTimeout(() => {
        setShowQuiz(true);
      }, 500);
    }
  };

  const handleQuizComplete = (score: number, passed: boolean) => {
    setShowQuiz(false);
    setSelectedCourse(null);
    
    // Refresh courses to update status
    fetchCourses();
    
    Alert.alert(
      'Quiz Complete!',
      `You scored ${score}%${passed ? ' and passed!' : '. You can retake the quiz anytime.'}`,
      [{ text: 'OK' }]
    );
  };

  const closeModals = () => {
    setShowVideo(false);
    setShowQuiz(false);
    setSelectedCourse(null);
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>An Error Occurred:</Text>
        <Text style={styles.errorDetails}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchCourses}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && courses.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your courses...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <FlatList
        data={courses}
        keyExtractor={({ id }) => id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.itemContainer} 
            onPress={() => viewCourseDetails(item)}
          >
            <View style={styles.courseContent}>
              <Text style={styles.courseTitle}>{item.title}</Text>
              <View style={styles.statusContainer}>
                <Text style={[
                  styles.statusText,
                  item.assignmentStatus === 'completed' ? styles.completedStatus : styles.assignedStatus
                ]}>
                  {item.assignmentStatus === 'completed' ? '✅ Completed' : '📚 Assigned'}
                </Text>
              </View>
            </View>
            <Text style={styles.chevron}>➤</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No training assigned</Text>
            <Text style={styles.emptySubtitle}>Check back later for new courses</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchCourses}>
              <Text style={styles.retryButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchCourses} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Video Player Modal */}
      <Modal
        visible={showVideo}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        {selectedCourse && (
          <VideoPlayerScreen
            course={selectedCourse}
            onVideoComplete={handleVideoComplete}
            onClose={closeModals}
          />
        )}
      </Modal>

      {/* Quiz Modal */}
      <Modal
        visible={showQuiz}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        {selectedCourse && selectedCourse.assignmentId && (
          <QuizScreen
            course={selectedCourse}
            assignmentId={selectedCourse.assignmentId}
            onQuizComplete={handleQuizComplete}
            onClose={closeModals}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  itemContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  courseContent: {
    flex: 1,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  statusContainer: {
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  assignedStatus: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
  },
  completedStatus: {
    backgroundColor: '#e8f5e8',
    color: '#2e7d32',
  },
  chevron: {
    fontSize: 16,
    color: '#999',
    marginLeft: 10,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorDetails: {
    color: 'red',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});