function playerDUPRrefresh() {
    // Get the event players
    const payload = window.cachedUserUniverse;
    console.log('The payload is',payload);
    const duprData = window.fetchDuprDatabaseFromFirestore();
    console.log('DUPR database is',duprData);

    // Get DUPR data

    // Update date Firestore

    // Re render players screen
}