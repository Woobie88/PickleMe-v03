function playerDUPRrefresh() {
    // Get the event players
    const payload = window.cachedUserUniverse;
    console.log('The payload is',payload);
    const duprDatabase = window.cachedUserUniverse.dupr || [];
    console.log('The DUPR data is',window.fetchDuprDatabaseFromFirestore());

    // Get DUPR data

    // Update date Firestore

    // Re render players screen
}