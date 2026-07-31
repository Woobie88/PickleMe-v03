import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
