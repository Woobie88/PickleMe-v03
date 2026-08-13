import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, addDoc, onSnapshot, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
const firebaseConfig = {
  apiKey: "AIzaSyAVmJJ-uHf366tdd4T0BcceKkEEP16WIbE",
  authDomain: "pickleme-ef7ff.firebaseapp.com",
  projectId: "pickleme-ef7ff",
  storageBucket: "pickleme-ef7ff.firebasestorage.app",
  messagingSenderId: "573972572836",
  appId: "1:573972572836:web:6fc42c9856f0c762c99431"
};

const app = initializeApp(firebaseConfig);
window.db = getFirestore(app);

const auth = getAuth(app);
window.auth = auth;
setPersistence(auth, browserLocalPersistence);

window.fetchEventsFromFirestore = async function(userEmail) {
  const db = window.db;

  const accessQuery = query(collection(db, "userAccess"), where("UserEmail", "==", userEmail));
  const accessSnapshot = await getDocs(accessQuery);
  const permittedEventIds = accessSnapshot.docs.map(doc => doc.data().EventID);

  if (permittedEventIds.length === 0) {
    return { events: [], activeEventId: null };
  }

  const eventsQuery = query(collection(db, "events"), where("EventID", "in", permittedEventIds));
  const eventsSnapshot = await getDocs(eventsQuery);
  const events = eventsSnapshot.docs.map(doc => doc.data());

  const activeQuery = query(collection(db, "activeEvent"), where("UserEmail", "==", userEmail));
  const activeSnapshot = await getDocs(activeQuery);
  let activeEventId = null;
  if (!activeSnapshot.empty) {
    activeEventId = activeSnapshot.docs[0].data().EventID;
  }

  return { events, activeEventId };
};

window.setActiveEventInFirestore = async function(eventId, userEmail) {
  const db = window.db;
  const q = query(collection(db, "activeEvent"), where("UserEmail", "==", userEmail));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    await updateDoc(snapshot.docs[0].ref, { EventID: eventId });
  } else {
    await addDoc(collection(db, "activeEvent"), { UserEmail: userEmail, EventID: eventId });
  }
};

window.updateEventInFirestore = async function(eventId, updatedData) {
  const db = window.db;
  const eventDocRef = doc(db, "events", String(eventId));
  await updateDoc(eventDocRef, updatedData);
};

window.fetchPlayersFromFirestore = async function(eventId, playerVersion) {
  const db = window.db;

  const playersQuery = query(
    collection(db, "players"),
    where("EventID", "==", eventId),
    where("PlayerVersion", "==", playerVersion)
  );
  const snapshot = await getDocs(playersQuery);
  return snapshot.docs.map(doc => doc.data());
};

window.fetchDrawFromFirestore = async function(eventId, drawVersion) {
  const db = window.db;

  const drawQuery = query(
    collection(db, "draw"),
    where("EventID", "==", eventId),
    where("DrawVersion", "==", drawVersion)
  );
  const snapshot = await getDocs(drawQuery);
  return snapshot.docs.map(doc => doc.data());
};

window.updateMatchScoreInFirestore = async function(matchId, team1Score, team2Score, team1WinLoss, team2WinLoss) {
  const db = window.db;
  const matchDocRef = doc(db, "draw", String(matchId));
  await updateDoc(matchDocRef, {
    Team1Score: team1Score,
    Team2Score: team2Score,
    Team1WinLoss: team1WinLoss,
    Team2WinLoss: team2WinLoss
  });
};

window.updateCurrentRoundInFirestore = async function(eventId, roundNumber) {
  const db = window.db;
  const eventDocRef = doc(db, "events", String(eventId));
  await updateDoc(eventDocRef, { CurrentRound: roundNumber });
};

window.updateScoringModeInFirestore = async function(eventId, scoringMode) {
  const db = window.db;
  const eventDocRef = doc(db, "events", String(eventId));
  await updateDoc(eventDocRef, { Scoring: scoringMode });
};

window.updateMatchWinLossInFirestore = async function(matchId, team1WinLoss, team2WinLoss) {
  const db = window.db;
  const matchDocRef = doc(db, "draw", String(matchId));
  await updateDoc(matchDocRef, { Team1WinLoss: team1WinLoss, Team2WinLoss: team2WinLoss });
};

window.updateLadderScoringInFirestore = async function(eventId, ladderScoringMode) {
  const db = window.db;
  const eventDocRef = doc(db, "events", String(eventId));
  await updateDoc(eventDocRef, { LadderScoring: ladderScoringMode });
};

window.listenToDrawChanges = function(eventId, drawVersion, onChangeCallback) {
  const db = window.db;

  const drawQuery = query(
    collection(db, "draw"),
    where("EventID", "==", eventId),
    where("DrawVersion", "==", drawVersion)
  );

  const unsubscribe = onSnapshot(drawQuery, (snapshot) => {
    const matches = snapshot.docs.map(doc => doc.data());
    onChangeCallback(matches);
  }, (error) => {
    console.error("Draw listener error:", error);
  });

  return unsubscribe;
};

window.updateActiveGameInFirestore = async function(eventId, gameId) {
  const db = window.db;
  const eventDocRef = doc(db, "events", String(eventId));
  await updateDoc(eventDocRef, { GameID: gameId });
};

window.updatePlayerByeOrderInFirestore = async function(playerId, byeOrder) {
  const db = window.db;
  const playerDocRef = doc(db, "players", String(playerId));
  await updateDoc(playerDocRef, { byeOrder: byeOrder });
};

window.updatePlayerExcludeInFirestore = async function(playerId, playerExclude) {
  const db = window.db;
  const playerDocRef = doc(db, "players", String(playerId));
  await updateDoc(playerDocRef, { playerExclude: playerExclude });
};

window.deleteAllDrawDocumentsInFirestore = async function(eventId) {
  const db = window.db;
  const q = query(collection(db, "draw"), where("EventID", "==", eventId));
  const snapshot = await getDocs(q);

  const deletions = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
  await Promise.all(deletions);
  console.log(`Deleted ${snapshot.docs.length} draw document(s) for event ${eventId}.`);
};

window.deleteAllPlayerDocumentsInFirestore = async function(eventId) {
  const db = window.db;
  const q = query(collection(db, "players"), where("EventID", "==", eventId));
  const snapshot = await getDocs(q);

  const deletions = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
  await Promise.all(deletions);
  console.log(`Deleted ${snapshot.docs.length} player document(s) for event ${eventId}.`);
};

window.resetEventVersionsInFirestore = async function(eventId, resetDraw, resetPlayers) {
  const db = window.db;
  const eventDocRef = doc(db, "events", String(eventId));

  const updates = {};
  if (resetDraw) {
    updates.CurrentDrawVersion = 0;
    updates.CurrentRound = 1;
  }
  if (resetPlayers) updates.CurrentPlayerVersion = 0;

  if (Object.keys(updates).length > 0) {
    await updateDoc(eventDocRef, updates);
  }
};

window.updateEventDrawVersionAndRoundInFirestore = async function(eventId, newDrawVersion) {
  const db = window.db;
  const eventDocRef = doc(db, "events", String(eventId));
  await updateDoc(eventDocRef, {
    CurrentDrawVersion: newDrawVersion,
    CurrentRound: 1
  });
};

window.saveGeneratedDrawToFirestore = async function(matches) {
  const db = window.db;

  const writes = matches.map(match => {
    const matchDocRef = doc(db, "draw", String(match.MatchID));
    return setDoc(matchDocRef, match);
  });

  await Promise.all(writes);
  console.log(`Saved ${matches.length} match document(s) to Firestore.`);
};

window.updateEventFieldInFirestore = async function(eventId, fieldName, value) {
  const db = window.db;
  const eventDocRef = doc(db, "events", String(eventId));
  await updateDoc(eventDocRef, { [fieldName]: value });
};

window.fetchDuprDatabaseFromFirestore = async function() {
  const db = window.db;
  const snapshot = await getDocs(collection(db, "duprDatabase"));
  return snapshot.docs.map(doc => doc.data());
};

window.saveGeneratedPlayersToFirestore = async function(players) {
  const db = window.db;

  const writes = players.map(player => {
    const playerDocRef = doc(db, "players", String(player.PlayerID));
    return setDoc(playerDocRef, player);
  });

  await Promise.all(writes);
  console.log(`Saved ${players.length} player document(s) to Firestore.`);
};

window.updatePlayerTeamInFirestore = async function(playerId, teamNumber) {
  const db = window.db;
  const playerDocRef = doc(db, "players", String(playerId));
  await updateDoc(playerDocRef, { Team: teamNumber });
};

window.updatePlayerVersionInFirestore = async function(playerId, newVersion) {
  const db = window.db;
  const playerDocRef = doc(db, "players", String(playerId));
  await updateDoc(playerDocRef, { PlayerVersion: newVersion });
};

window.updatePlayerFieldInFirestore = async function(playerId, fieldName, value) {
  const db = window.db;
  const playerDocRef = doc(db, "players", String(playerId));
  await updateDoc(playerDocRef, { [fieldName]: value });
};

window.deletePlayerInFirestore = async function(playerId) {
  const db = window.db;
  const playerDocRef = doc(db, "players", String(playerId));
  await deleteDoc(playerDocRef);
};

window.updateMatchPlayerFieldInFirestore = async function(matchId, field, newPlayerId) {
  const db = window.db;
  const matchDocRef = doc(db, "draw", String(matchId));
  await updateDoc(matchDocRef, { [field]: newPlayerId });
};

window.updateMatchFieldsInFirestore = async function(matchId, fields) {
  const db = window.db;
  const matchDocRef = doc(db, "draw", String(matchId));
  await updateDoc(matchDocRef, fields);
};

window.signUpUser = async function(name, email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCredential.user.uid;

  await setDoc(doc(window.db, "users", uid), { Name: name, Email: email });

  return userCredential.user;
};

window.logInUser = async function(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

window.logOutUser = async function() {
  await signOut(auth);
};

window.fetchUserProfile = async function(uid) {
  const snapshot = await getDocs(query(collection(window.db, "users"), where("__name__", "==", uid)));
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
};

window.changeUserPassword = async function(newPassword) {
  if (!auth.currentUser) throw new Error("No user logged in");
  await updatePassword(auth.currentUser, newPassword);
};

window.onAuthStateChangedListener = function(callback) {
  onAuthStateChanged(auth, callback);
};
