function playerDUPRrefresh() {
    // Get the event players
    const players = window.cachedUserUniverse.players;
    console.log('The players payload is',players);
    const duprData = window.fetchDuprDatabaseFromFirestore();
    console.log('DUPR database is',duprData);

    // Get DUPR data

    // Update date Firestore

    // Re render players screen
}