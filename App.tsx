import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Amplify } from 'aws-amplify';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import outputs from './amplify_outputs.json';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CourseListTab } from './components/CourseListTab';

// Configure Amplify with backend info
Amplify.configure(outputs);

const Tab = createBottomTabNavigator();

function CoursesScreen() {
  return (
    <View style={styles.container}>
      <CourseListTab />
    </View>
  );
}

function ProfileScreen() {
  const { user, signOut } = useAuthenticator();
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>
        Welcome, {user.signInDetails?.loginId || user.username}!
      </Text>
      <Text onPress={signOut} style={styles.signOutButton}>
        Sign Out
      </Text>
    </View>
  );
}

function AppContent() {
  const { user } = useAuthenticator();
  const [isEmployee, setIsEmployee] = useState<boolean | null>(null);

  useEffect(() => {
    const checkGroups = async () => {
      try {
        const currentUser = await getCurrentUser();
        const session = await fetchAuthSession({ forceRefresh: true });
        let groups = session.tokens?.idToken?.payload['cognito:groups'];
        if (typeof groups === 'string') {
          groups = [groups];
        } else if (!Array.isArray(groups)) {
          groups = [];
        }
        console.log('User groups:', groups);

        setIsEmployee((groups as string[]).includes('Employees'));
      } catch (err) {
        console.error('Error checking user groups:', err);
        setIsEmployee(false);
      }
    };
    checkGroups();
  }, []);

  if (isEmployee === null) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Checking permissions...</Text>
      </SafeAreaView>
    );
  }

  if (!isEmployee) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>Access denied. Employees only.</Text>
        <Text style={styles.subtitle}>Contact your manager for access.</Text>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#999',
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Tab.Screen 
          name="Courses" 
          component={CoursesScreen}
          options={{
            title: 'My Training',
            tabBarLabel: 'Courses',
          }}
        />
        <Tab.Screen 
          name="Profile" 
          component={ProfileScreen}
          options={{
            title: 'Profile',
            tabBarLabel: 'Profile',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <Authenticator.Provider>
      <Authenticator>
        <AppContent />
      </Authenticator>
    </Authenticator.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
  signOutButton: {
    fontSize: 16,
    color: '#dc3545',
    fontWeight: 'bold',
    padding: 10,
    textAlign: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 20,
  },
});