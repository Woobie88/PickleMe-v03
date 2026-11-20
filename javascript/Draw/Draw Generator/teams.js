function generateTeamsRoundDraw(players, allMatches, numberOfRounds, courtsCount, activeEventId, newDrawVersion, userEmail, numberOfTeams, scorers) {
    // --- Determine the structure of the match ups based on the number of teams & number of courts --- //
    const structure = determineTeamRoundStructure(totalTeamsInput, courtsCount);
    if (!structure) {
        console.error(`No valid team round structure found for ${totalTeamsInput} teams / ${courtsCount} courts.`);
        return [];
    }

    // --- Build the players into each team, sorting rank by DUPR rating --- //
    const allTeams = {};
    players.forEach(p => { (allTeams[p.Team] = allTeams[p.Team] || []).push(p); });
    const allTeamKeys = Object.keys(allTeams).sort((a, b) => parseInt(a) - parseInt(b));
    console.log(`All teams is ${allTeamKeys}`);
    return;

    // --- NOTE MAY DO AT END --- //

    // const { partnerCounts, opponentCounts, courtCounts } = buildDrawHistory(matches);
    // const teamOpponentCounts = buildTeamOpponentHistory(matches);

    // --- ****************** --- //

    // --- Build bye order based on first selecting team with manual bye, then applying byes accross all teams based on DUPR ranking --- //
    const wholeTeamByesNeeded = allTeamKeys.length - structure.activeTeams;

    const teamGroupsArray = allTeamKeys.map(k => allTeams[k]);
    const orderedTeamGroups = buildStableTeamOrder(teamGroupsArray);
    const orderedTeamKeys = orderedTeamGroups.map(team => team[0].Team);

    window.gdTeamByeCache = window.gdTeamByeCache || {};
    const teamByeCacheKey = `${eventId}_teamByes`;
    if (!window.gdTeamByeCache[teamByeCacheKey]) {
        window.gdTeamByeCache[teamByeCacheKey] = generateEntityByeScheduleOrdered(
        orderedTeamKeys, window.gdCurrentNumberOfRounds || 1, wholeTeamByesNeeded
        );
    }
    const wholeTeamByesThisRound = window.gdTeamByeCache[teamByeCacheKey][roundNumber - 1] || [];

    const activeTeamKeys = allTeamKeys.filter(t => !wholeTeamByesThisRound.map(String).includes(String(t)));
    

    // --- Build matrix of team pairings, with Avg. DUPR & Delta DUPR --- //
    const teamPairings = pairActiveTeamsForRound(activeTeamKeys, structure.mode, teamOpponentCounts);

    // --- Build all potential court pairings for the full event, including DUPR delta --- //

    // --- Define stored data variables --- //

    // *** BUILD MATCHUPS FOR EACH ROUND *** //
    // --- Pick best scoring matches, excluding players having a bye --- //

    // --- Revise scoring of round match ups --- //

    // --- Move all instances of pairings to partnership played --- //

    // --- Resort potential round match ups --- //

    // --- How many pairings is each active team involved in this round? ---
    const pairingCountPerTeam = {};
    activeTeamKeys.forEach(t => pairingCountPerTeam[t] = 0);
    teamPairings.forEach(([a, b]) => { pairingCountPerTeam[a]++; pairingCountPerTeam[b]++; });

    // --- Individual within-team byes (manual byeOrder-aware, only when no whole-team bye applies) ---
    let individualByesByTeam = {};
    if (wholeTeamByesNeeded === 0) {
        activeTeamKeys.forEach(teamKey => {
        const teamPlayers = allTeams[teamKey];
        const playersNeeded = 2 * structure.courtsPerPairing * pairingCountPerTeam[teamKey];
        const byesNeeded = Math.max(0, teamPlayers.length - playersNeeded);

        const orderedTeamPlayers = buildStablePoolOrder(teamPlayers); // manual byeOrder first, same as Pools
        const orderedIds = orderedTeamPlayers.map(p => p.PlayerID);

        window.gdIndivByeCache = window.gdIndivByeCache || {};
        const cacheKey = `${eventId}_${teamKey}_indivByes`;
        if (!window.gdIndivByeCache[cacheKey]) {
            window.gdIndivByeCache[cacheKey] = generateEntityByeScheduleOrdered(
            orderedIds, window.gdCurrentNumberOfRounds || 1, byesNeeded
            );
        }
        individualByesByTeam[teamKey] = window.gdIndivByeCache[cacheKey][roundNumber - 1] || [];
        });
    }

    // --- Build each active team's FULL pair-pool ONCE per round ---
    const teamPairPools = {};
    activeTeamKeys.forEach(teamKey => {
        const activePlayers = allTeams[teamKey].filter(p => !(individualByesByTeam[teamKey] || []).includes(p.PlayerID));
        teamPairPools[teamKey] = generateBestPartnerships(activePlayers, partnerCounts, scorers);
    });

    const teamPoolCursor = {};
    activeTeamKeys.forEach(t => teamPoolCursor[t] = 0);

    const allMatches = [];
    let courtCursor = 1;

    teamPairings.forEach(([teamAKey, teamBKey]) => {
        const cpp = structure.courtsPerPairing;

        const teamAChunk = teamPairPools[teamAKey].slice(teamPoolCursor[teamAKey], teamPoolCursor[teamAKey] + cpp);
        const teamBChunk = teamPairPools[teamBKey].slice(teamPoolCursor[teamBKey], teamPoolCursor[teamBKey] + cpp);
        teamPoolCursor[teamAKey] += cpp;
        teamPoolCursor[teamBKey] += cpp;

        if (teamAChunk.length === 0 || teamBChunk.length === 0) {
        console.warn(`Skipping pairing ${teamAKey} vs ${teamBKey} — pair pool exhausted (likely a stale bye cache or structure mismatch).`);
        return;
        }

        const matchups = assignBipartitePairings(teamAChunk, teamBChunk, opponentCounts);

        const courtNumbers = [];
        for (let i = 0; i < cpp; i++) {
        courtNumbers.push(courtCursor);
        courtCursor++;
        }

        const courted = assignCourts(matchups, courtNumbers, courtCounts);
        const records = courted.map((m, idx) => buildMatchRecord(m, idx, roundNumber, eventId, drawVersion, userEmail));
        allMatches.push(...records);
    });

    return allMatches;
}
