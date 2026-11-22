// *** Team Structure Validation *** //
// --- Valid team structures --- //
// --- 1. Number of teams = 2; ALWAYS valid, provided there are enough players --- //
// --- 2. More than 2 teams & courts <= number of teams; ALWAYS valid provided there are enough players --- //
// --- 3. More than 2 teams & courts  > number of teams; ONLY valid if courts are divisible by number teams & there are enough players --- //
// --- 4. More than 2 teams & courts  > number of teams; NOT valid if courts are not divisible by number of teams--- //
// --- isValidPlayer is number of players / 4 >= courtsCount //
function teamStructureType(players, courtsCount, numberOfTeams, allTeams) {
    // players can be a count or an array of players
    const playerCount = Array.isArray(players) ? players.length : players;

    // Fall back to allTeams.length if numberOfTeams isn't supplied
    const teamCount = numberOfTeams ?? (Array.isArray(allTeams) ? allTeams.length : 0);

    // allTeams (if provided) must agree with numberOfTeams
    if (Array.isArray(allTeams) && allTeams.length !== teamCount) {
        return { type: 0, valid: false, reason: "allTeams length does not match numberOfTeams" };
    }

    // Need at least 2 teams
    if (teamCount < 2) {
        return { type: 0, valid: false, reason: "At least 2 teams are required" };
    }

    // Player check: players / 4 >= courtsCount
    const isValidPlayer = playerCount / 4 >= courtsCount;
    if (!isValidPlayer) {
        return { type: 0, valid: false, reason: "Not enough players for the number of courts" };
    }

    // 1. Exactly 2 teams: always valid
    if (teamCount === 2) {
        return { type: 1, valid: true, reason: "Two teams", teamsPerRound: 2, playersNeededPerRound: courtsCount * 2 };
    }

    // 2. More than 2 teams, courts <= teams: always valid
    if (courtsCount <= teamCount) {
        return { type: 2, valid: true, reason: "Courts do not exceed number of teams", teamsPerRound: 2, playersNeededPerTeam: 2 * 2 };
    }

    // 3. More than 2 teams, courts > teams: valid only if courts divisible by teams
    if (courtsCount % teamCount === 0) {
        return { type: 3, valid: true, reason: "Courts are divisible by number of teams", teamsPerRound: numberOfTeams, playersNeededPerTeam: courtsCount / teamCount * 2 };
    }

    // 4. More than 2 teams, courts > teams, not divisible: invalid
    return { type: 4, valid: false, reason: "Courts are not divisible by number of teams" };
}

// *** Bye Structure Determination *** // 
// --- Depending on the number of teams, players & court count, will determine if wholeTeamByes & playerByes are needed --- //
// --- wholeTeamByes = Yes if numberOfTeams > courtCounts --- //
// --- playerByes = Yes if players.length / 4 > courtCounts --- //
function byeStructure(players, courtsCount, numberOfTeams, allTeams) {
    // players can be a count or an array of players
    const playerCount = Array.isArray(players) ? players.length : players;

    // Fall back to allTeams.length if numberOfTeams isn't supplied
    const teamCount = numberOfTeams ?? (Array.isArray(allTeams) ? allTeams.length : 0);

    const wholeTeamByes = teamCount > courtsCount;
    const playerByes = playerCount / 4 > courtsCount;

    const result = {
        wholeTeamByes,
        // Teams sitting out once every court is filled
        teamByes: wholeTeamByes ? teamCount - courtsCount : 0,
        playerByes,
        // Players left over once every court is filled (4 per court)
        playersOnBye: playerByes ? playerCount - courtsCount * 4 : 0
    };

    return result;
}

// *** CORE FUNCTION CALLED TO GENERATE TEAM DRAW *** //
function generateTeamsRoundTest(players, allMatches, numberOfRounds, courtsCount, activeEventId, newDrawVersion, userEmail, numberOfTeams, scorers) {
    // --- Build the players into each team, sorting rank by DUPR rating --- //
    const allTeams = {};
    [...players]
    .sort((a, b) => (parseFloat(b.DUPR) || 0) - (parseFloat(a.DUPR) || 0))
    .forEach(p => { (allTeams[p.Team] = allTeams[p.Team] || []).push(p); });

    const allTeamKeys = Object.keys(allTeams).sort((a, b) => parseInt(a) - parseInt(b));
    console.log(`All teams key is ${allTeamKeys}, with the teams being`, allTeams);

    // --- Determine the structure of the match ups based on the number of teams & number of courts --- //
    const isTeamStructure = teamStructureType(players, courtsCount, numberOfTeams, allTeams);

    alert(
        `Type: ${isTeamStructure.type}\n` +
        `Valid: ${isTeamStructure.valid ? "Yes" : "No"}\n` +
        `Reason: ${isTeamStructure.reason}\n` +
        `Number of Courts: ${courtsCount}\n` +
        `Number of Teams: ${numberOfTeams}\n` +
        `Teams playing per round': ${isTeamStructure.teamsPerRound}\n` +
        `Players needed per team: ${isTeamStructure.playersNeededPerTeam}`
    );

    // --- Determine bye structure --- //
    const isByeStructures = byeStructure(players, courtsCount, numberOfTeams, allTeams);

    alert(
        `Whole Team Byes: ${isByeStructures.wholeTeamByes ? "Yes" : "No"}\n` +
        (isByeStructures.wholeTeamByes ? `\nNumber of team byes: ${result.teamByes}` : "") +
        `Player Byes: ${isByeStructures.playerByes ? "Yes" : "No"}` +
        (isByeStructures.playerByes ? `\nPlayers on bye: ${isByeStructures.playersOnBye}` : "")
    );

    // --- NOTE MAY DO AT END --- //

    // const { partnerCounts, opponentCounts, courtCounts } = buildDrawHistory(matches);
    // const teamOpponentCounts = buildTeamOpponentHistory(matches);

    // --- ****************** --- //

    // --- Build bye order based on first selecting team with manual bye, then applying byes accross all teams based on DUPR ranking --- //
    const wholeTeamByesNeeded = allTeamKeys.length - structure.activeTeams;

    const teamGroupsArray = allTeamKeys.map(k => allTeams[k]);
    console.log(`Byes needed are ${wholeTeamByesNeeded}, with the teamsGroupApp of`, teamGroupsArray);
    
    

    // --- Build matrix of team pairings, with Avg. DUPR & Delta DUPR --- //
   

    // --- Build all potential court pairings for the full event, including DUPR delta --- //

    // --- Define stored data variables --- //

    // *** BUILD MATCHUPS FOR EACH ROUND *** //
    // --- Pick best scoring matches, excluding players having a bye --- //

    // --- Revise scoring of round match ups --- //

    // --- Move all instances of pairings to partnership played --- //

    // --- Resort potential round match ups --- //

    
    return allMatches;
}
