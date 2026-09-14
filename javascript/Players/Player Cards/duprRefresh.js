function playerDUPRrefresh() {
    // Get the event players
    const players = window.cachedUserUniverse.players;
    console.log('The players payload is', players);

    // Get DUPR data
    const duprData = window.fetchDuprDatabaseFromFirestore();
    console.log('DUPR database is', duprData);

    // Get current DUPR rating for each player
    players.forEach(player => {
        console.log(
            'The player name is',
            player.Name,
            'DUPR ID',
            player.DUPRId
        );

        const currentDUPRRate = duprData.find(
            e => String(e.DUPRId) === String(player.DUPRId)
        );

        console.log(
            'Their current rating is',
            currentDUPRRate ? currentDUPRRate["DUPR Rating"] : 'No DUPR rating found'
        );
    });

    // Update date Firestore

    // Re render players screen
}