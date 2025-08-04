/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React from 'react';
import { SafeAreaView, Text, View, StyleSheet } from 'react-native';
import { Amplify } from 'aws-amplify';
import outputs from './amplify_outputs.json';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react-native';

// This line configures Amplify with the backend info from your sandbox
Amplify.configure(outputs);

// This is a simple component that will be shown ONLY to logged-in users.
function AppContent() {
  // The useAuthenticator hook gives us access to user data and a sign-out function
  const { user, signOut } = useAuthenticator();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.welcomeText}>Welcome, {user.signInDetails?.loginId || user.username}!</Text>
        {/* We will add the CourseList component here later */}
        <Text>Your training app content will go here.</Text>
      </View>
      {/* A simple button to allow users to sign out */}
      <View style={styles.buttonContainer}>
         <Text onPress={signOut} style={styles.signOutButton}>Sign Out</Text>
      </View>
    </SafeAreaView>
  );
}

// This is the main App component that wraps everything
function App() {
  return (
    // The Authenticator.Provider is needed for the hooks to work
    <Authenticator.Provider>
      {/* The Authenticator component handles the entire UI flow.
          If the user is not logged in, it shows sign-in/sign-up forms.
          If they are logged in, it renders its children. */}
      <Authenticator>
        <AppContent />
      </Authenticator>
    </Authenticator.Provider>
  );
}

// Some basic styling to make it look nice
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
});

export default App;
