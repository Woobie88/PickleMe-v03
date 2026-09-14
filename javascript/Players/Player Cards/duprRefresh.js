function playerDUPRrefresh() {
    // Get the event players
    const players = window.cachedUserUniverse.players;
    console.log('The players payload is',players);
    const duprData = window.fetchDuprDatabaseFromFirestore();
    console.log('DUPR database is',duprData);

    // Get DUPR data
    players.forEach(player => {
        console.log('The player name is',player.Name,'DUPR ID',player.DUPRId);
        let currentDUPRRate = duprData["DUPR Rating"].find(e => String(e.DUPRId) === String(DUPRId));
        console.log('Their current rating is',currentDUPRRate);
    });

    // Update date Firestore

    // Re render players screen
}