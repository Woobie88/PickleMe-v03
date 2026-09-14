function playerDUPRrefresh() {
    // Get the event players
    const payload = window.cachedUserUniverse;
    console.log('The payload is',payload);
    if (!window.cachedUserUniverse.dupr || window.cachedUserUniverse.dupr.length === 0) {
        window.fetchDuprDatabaseFromFirestore().then(db => {
            window.cachedUserUniverse.dupr = db;
        });
    }
    console.log('DUPR database is',window.cachedUserUniverse.dupr);

    // Get DUPR data

    // Update date Firestore

    // Re render players screen
}