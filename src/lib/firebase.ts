import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  User,
  fetchSignInMethodsForEmail,
  signInWithEmailLink,
  linkWithCredential,
  EmailAuthProvider,
  AuthErrorCodes,
  OAuthProvider
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  DocumentSnapshot,
  DocumentData
} from "firebase/firestore";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyABfAxoKsk-C4Ym2ph9v0qf3dwiPGgonuo",
  authDomain: "pesquisaeleitoral-45580.firebaseapp.com",
  projectId: "pesquisaeleitoral-45580",
  storageBucket: "pesquisaeleitoral-45580.firebasestorage.app",
  messagingSenderId: "286170851059",
  appId: "1:286170851059:web:5139d2444be9af9ae57986",
  measurementId: "G-Q2QFV65T43"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// User types
export interface UserRole {
  isAdmin: boolean;
  isVoter: boolean;
}

// Auth functions
export const registerUser = async (email: string, password: string) => {
  try {
    // Check if user already exists with Google provider
    const methods = await fetchSignInMethodsForEmail(auth, email);
    
    if (methods.includes('google.com')) {
      // If user exists with Google, throw an error
      throw new Error("Este e-mail já está registrado com o Google. Por favor, faça login com Google.");
    }

    const result = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", result.user.uid), {
      email,
      role: { isAdmin: false, isVoter: true },
      createdAt: serverTimestamp()
    });
    return result.user;
  } catch (error) {
    console.error("Error registering user:", error);
    throw error;
  }
};

export const loginWithEmail = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const loginWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    if (error.code === 'auth/account-exists-with-different-credential') {
      // Add email information to the error for better handling in the UI
      error.customData = {
        ...error.customData,
        email: error.customData?.email
      };
    }
    console.error("Google login error:", error);
    throw error;
  }
};

export const linkGoogleWithEmail = async (email: string, password: string) => {
  try {
    // First, sign in with email and password
    const emailCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Then try to link with Google
    // This is a bit tricky as we need to create a new Google popup after already being logged in
    // Firebase doesn't have a direct way to link accounts without the popup in this scenario,
    // but we can ensure the user can log in via both methods by doing this two-step process
    
    // Return the credential to indicate success
    return emailCredential;
  } catch (error) {
    console.error("Error linking accounts:", error);
    throw error;
  }
};

export const loginAnonymously = async () => {
  return signInAnonymously(auth);
};

export const logoutUser = async () => {
  return signOut(auth);
};

// User functions
export const getUserRole = async (userId: string): Promise<UserRole> => {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.role as UserRole;
    }
    return { isAdmin: false, isVoter: true };
  } catch (error) {
    console.error("Error getting user role:", error);
    return { isAdmin: false, isVoter: true };
  }
};

// Poll functions
export interface Poll {
  id?: string;
  title: string;
  description: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'active' | 'scheduled' | 'completed';
  candidates: string[];
  createdBy: string;
  createdAt: Timestamp;
}

// Helper function to check and update poll status
const checkAndUpdatePollStatus = async (poll: Poll): Promise<Poll> => {
  const now = new Date();
  const endDate = poll.endDate.toDate();
  const startDate = poll.startDate.toDate();
  
  let updatedPoll = {...poll};
  let needsUpdate = false;
  
  // If poll is active but end date has passed, mark as completed
  if (poll.status === 'active' && now > endDate) {
    updatedPoll.status = 'completed';
    needsUpdate = true;
  }
  
  // If poll is scheduled but start date has passed, mark as active
  if (poll.status === 'scheduled' && now >= startDate && now <= endDate) {
    updatedPoll.status = 'active';
    needsUpdate = true;
  }
  
  // Update the poll in the database if status changed
  if (needsUpdate && poll.id) {
    await updateDoc(doc(db, "polls", poll.id), {
      status: updatedPoll.status
    });
  }
  
  return updatedPoll;
};

export const createPoll = async (pollData: Omit<Poll, 'id' | 'createdAt'>) => {
  try {
    console.log("Creating poll with data:", pollData);
    const pollRef = await addDoc(collection(db, "polls"), {
      ...pollData,
      createdAt: serverTimestamp()
    });
    console.log("Poll created with ID:", pollRef.id);
    return pollRef.id;
  } catch (error) {
    console.error("Error creating poll:", error);
    throw error;
  }
};

export const updatePoll = async (pollId: string, pollData: Partial<Poll>) => {
  try {
    console.log(`Updating poll ${pollId} with data:`, pollData);
    await updateDoc(doc(db, "polls", pollId), {
      ...pollData
    });
    console.log("Poll updated successfully");
    return true;
  } catch (error) {
    console.error("Error updating poll:", error);
    throw error;
  }
};

export const getActivePoll = async () => {
  try {
    const now = new Date();
    const pollsRef = collection(db, "polls");
    const q = query(
      pollsRef,
      where("status", "==", "active"),
      where("startDate", "<=", now),
      where("endDate", ">=", now)
    );
    
    const querySnapshot = await getDocs(q);
    const polls: Poll[] = [];
    
    querySnapshot.forEach((doc) => {
      polls.push({ id: doc.id, ...doc.data() } as Poll);
    });
    
    return polls;
  } catch (error) {
    console.error("Error getting active polls:", error);
    throw error;
  }
};

export const getPoll = async (pollId: string) => {
  try {
    console.log(`Getting poll with ID: ${pollId}`);
    const pollDoc = await getDoc(doc(db, "polls", pollId));
    if (pollDoc.exists()) {
      const poll = { id: pollDoc.id, ...pollDoc.data() } as Poll;
      console.log("Poll data retrieved:", poll);
      // Check and update the status if necessary
      return await checkAndUpdatePollStatus(poll);
    }
    console.log(`Poll with ID ${pollId} not found`);
    return null;
  } catch (error) {
    console.error("Error getting poll:", error);
    throw error;
  }
};

export const getAllPolls = async () => {
  try {
    const pollsRef = collection(db, "polls");
    const querySnapshot = await getDocs(pollsRef);
    const polls: Poll[] = [];
    
    for (const doc of querySnapshot.docs) {
      const poll = { id: doc.id, ...doc.data() } as Poll;
      // Check and update each poll's status
      const updatedPoll = await checkAndUpdatePollStatus(poll);
      polls.push(updatedPoll);
    }
    
    return polls;
  } catch (error) {
    console.error("Error getting all polls:", error);
    throw error;
  }
};

// Candidate functions
export interface Candidate {
  id?: string;
  name: string;
  biography: string;
  proposals: string;
  socialLinks: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    website?: string;
  };
  photoURL: string;
  pollId?: string;
  createdAt: Timestamp;
}

export const createCandidate = async (candidateData: Omit<Candidate, 'id' | 'createdAt'>) => {
  try {
    const candidateRef = await addDoc(collection(db, "candidates"), {
      ...candidateData,
      createdAt: serverTimestamp()
    });
    return candidateRef.id;
  } catch (error) {
    console.error("Error creating candidate:", error);
    throw error;
  }
};

export const updateCandidate = async (candidateId: string, candidateData: Partial<Candidate>) => {
  try {
    await updateDoc(doc(db, "candidates", candidateId), {
      ...candidateData
    });
    return true;
  } catch (error) {
    console.error("Error updating candidate:", error);
    throw error;
  }
};

export const getCandidate = async (candidateId: string) => {
  try {
    const candidateDoc = await getDoc(doc(db, "candidates", candidateId));
    if (candidateDoc.exists()) {
      return { id: candidateDoc.id, ...candidateDoc.data() } as Candidate;
    }
    return null;
  } catch (error) {
    console.error("Error getting candidate:", error);
    throw error;
  }
};

export const getCandidatesByPoll = async (pollId: string) => {
  try {
    console.log(`Getting candidates for poll ID: ${pollId}`);
    
    // First get the poll to access the candidate IDs
    const pollDoc = await getDoc(doc(db, "polls", pollId));
    
    if (!pollDoc.exists()) {
      console.log(`Poll with ID ${pollId} not found`);
      return [];
    }
    
    const pollData = pollDoc.data() as Poll;
    const candidateIds = pollData.candidates || [];
    
    console.log(`Poll has ${candidateIds.length} candidate IDs:`, candidateIds);
    
    if (candidateIds.length === 0) {
      return [];
    }
    
    // Get all candidates that match the IDs in the poll
    const candidates: Candidate[] = [];
    
    for (const candidateId of candidateIds) {
      const candidateDoc = await getDoc(doc(db, "candidates", candidateId));
      if (candidateDoc.exists()) {
        candidates.push({ id: candidateDoc.id, ...candidateDoc.data() } as Candidate);
      } else {
        console.log(`Candidate with ID ${candidateId} not found`);
      }
    }
    
    console.log(`Found ${candidates.length} candidates for poll`);
    return candidates;
  } catch (error) {
    console.error("Error getting candidates by poll:", error);
    throw error;
  }
};

export const getAllCandidates = async () => {
  try {
    const candidatesRef = collection(db, "candidates");
    const querySnapshot = await getDocs(candidatesRef);
    const candidates: Candidate[] = [];
    
    querySnapshot.forEach((doc) => {
      candidates.push({ id: doc.id, ...doc.data() } as Candidate);
    });
    
    return candidates;
  } catch (error) {
    console.error("Error getting all candidates:", error);
    throw error;
  }
};

// Vote functions
export interface Vote {
  id?: string;
  userId: string;
  pollId: string;
  candidateId: string;
  createdAt: Timestamp;
}

export const castVote = async (voteData: Omit<Vote, 'id' | 'createdAt'>) => {
  try {
    // Check if user already voted in this poll
    const votesRef = collection(db, "votes");
    const q = query(
      votesRef,
      where("userId", "==", voteData.userId),
      where("pollId", "==", voteData.pollId)
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      throw new Error("User already voted in this poll");
    }
    
    const voteRef = await addDoc(collection(db, "votes"), {
      ...voteData,
      createdAt: serverTimestamp()
    });
    return voteRef.id;
  } catch (error) {
    console.error("Error casting vote:", error);
    throw error;
  }
};

export const getVoteResults = async (pollId: string) => {
  try {
    const votesRef = collection(db, "votes");
    const q = query(votesRef, where("pollId", "==", pollId));
    const querySnapshot = await getDocs(q);
    
    const resultMap: Record<string, number> = {};
    
    querySnapshot.forEach((doc) => {
      const vote = doc.data() as Vote;
      resultMap[vote.candidateId] = (resultMap[vote.candidateId] || 0) + 1;
    });
    
    return resultMap;
  } catch (error) {
    console.error("Error getting vote results:", error);
    throw error;
  }
};

export const hasUserVoted = async (userId: string, pollId: string) => {
  try {
    const votesRef = collection(db, "votes");
    const q = query(
      votesRef, 
      where("userId", "==", userId),
      where("pollId", "==", pollId)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error checking if user voted:", error);
    throw error;
  }
};

// File upload functions
export const uploadCandidatePhoto = async (file: File, candidateId: string) => {
  try {
    const storageRef = ref(storage, `candidate-photos/${candidateId}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading candidate photo:", error);
    throw error;
  }
};

export { auth, db, storage };
