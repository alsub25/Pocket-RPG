/**
 * Firebase Configuration
 * 
 * This module provides Firebase integration for authentication and cloud saves.
 * Firebase is a free backend-as-a-service that works with static hosting like GitHub Pages.
 * 
 * Setup Instructions:
 * 1. Create a Firebase project at https://console.firebase.google.com/
 * 2. Enable Authentication > Sign-in method > Email/Password
 * 3. Enable Firestore Database
 * 4. Copy your Firebase config values below
 * 5. Update Firestore rules to secure user data
 */

// Firebase configuration
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCDW_uDqS3bo9MgJDbUoRUJlTSn_OzSeUo",
  authDomain: "emberwood-game.firebaseapp.com",
  projectId: "emberwood-game",
  storageBucket: "emberwood-game.firebasestorage.app",
  messagingSenderId: "956338840984",
  appId: "1:956338840984:web:6bfa60b02edff461aef7ed"
};

// Feature flag to enable/disable backend features
// Set to false to disable backend and use localStorage only
export const BACKEND_ENABLED = firebaseConfig.apiKey !== "YOUR_API_KEY";

/**
 * Firestore Security Rules (to be set in Firebase Console):
 * 
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     // Users can only read/write their own saves
 *     match /users/{userId}/saves/{saveId} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *     }
 *     
 *     // Users can only read/write their own profile
 *     match /users/{userId} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *     }
 *   }
 * }
 */
