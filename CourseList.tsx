import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from './amplify/data/resource';

const client = generateClient<Schema>();

export function CourseList() {
  // THIS IS THE CORRECTED LINE
  const [courses, setCourses] = useState<Schema['Course']['type'][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    console.log('[CourseList] Starting to fetch courses...');
    setLoading(true);
    setError(null);

    const { data: items, errors } = await client.models.Course.list();

    if (errors) {
      const errorMessage = `Error fetching courses: ${JSON.stringify(errors)}`;
      console.error(errorMessage);
      setError(errorMessage);
    } else {
      console.log(`[CourseList] Successfully fetched ${items.length} courses.`);
      console.log(items);
      setCourses(items);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>An Error Occurred:</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (loading && courses.length === 0) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Available Courses</Text>
      <FlatList
        data={courses}
        keyExtractor={({ id }) => id}
        renderItem={({ item }) => (
            <TouchableOpacity style={styles.itemContainer} onPress={() => Alert.alert('Tapped!', `You selected the course: ${item.title}`)}>
            <Text style={styles.itemText}>{item.title}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text>No courses found.</Text>
            <Text>Pull down to refresh.</Text>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchCourses} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  loader: {
    marginTop: 50,
  },
  itemContainer: {
    backgroundColor: '#f9f9f9',
    padding: 20,
    marginVertical: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#eee'
  },
  itemText: {
    fontSize: 18,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  }
});