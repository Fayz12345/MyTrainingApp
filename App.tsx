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
import { CourseList } from './CourseList';

// Configure Amplify with backend info
Amplify.configure(outputs);

function AppContent() {
  const { user, signOut } = useAuthenticator();
  const [isEmployee, setIsEmployee] = useState<boolean | null>(null);

  useEffect(() => {
    const checkGroups = async () => {
      try {
        const user = await getCurrentUser();
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
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!isEmployee) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.errorText}>Access denied. Employees only.</Text>
        </View>
        <View style={styles.buttonContainer}>
          <Text onPress={signOut} style={styles.signOutButton}>
            Sign Out
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.welcomeText}>
          Welcome, {user.signInDetails?.loginId || user.username}!
        </Text>
        <CourseList />
        <Text>Your training app content will go here.</Text>
      </View>
      <View style={styles.buttonContainer}>
        <Text onPress={signOut} style={styles.signOutButton}>
          Sign Out
        </Text>
      </View>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    padding: 20,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  buttonContainer: {
    alignItems: 'center',
  },
  signOutButton: {
    fontSize: 18,
    color: 'red',
    padding: 10,
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
  },
});
