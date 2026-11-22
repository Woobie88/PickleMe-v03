// *** Helper: normalise allTeams (keyed object or array) into [teamKey, roster] pairs *** //
function getTeamEntries(allTeams) {
    if (Array.isArray(allTeams)) return allTeams.map((team, i) => [String(i + 1), team]);
    if (allTeams && typeof allTeams === "object") return Object.entries(allTeams);
    return [];
}

// *** Team Structure Validation *** //
// --- Valid team structures --- //
// --- 1. Number of teams = 2; ALWAYS valid, provided there are enough players --- //
// --- 2. More than 2 teams & courts <= number of teams; ALWAYS valid provided there are enough players --- //
// --- 3. More than 2 teams & courts  > number of teams; ONLY valid if courts are divisible by number teams & there are enough players --- //
// --- 4. More than 2 teams & courts  > number of teams; NOT valid if courts are not divisible by number of teams--- //
// --- isValidPlayer is number of players / 4 >= courtsCount //
function teamStructureType(players, courtsCount, numberOfTeams, allTeams) {
    const teamEntries = getTeamEntries(allTeams);
    const playerCount = Array.isArray(players) ? players.length : players;
    const teamCount = numberOfTeams ?? teamEntries.length;

    // allTeams (if provided) must agree with numberOfTeams
    if (teamEntries.length > 0 && teamEntries.length !== teamCount) {
        return { type: 0, valid: false, reason: "allTeams length does not match numberOfTeams" };
    }

    if (teamCount < 2) {
        return { type: 0, valid: false, reason: "At least 2 teams are required" };
    }

    const isValidPlayer = playerCount / 4 >= courtsCount;
    if (!isValidPlayer) {
        return { type: 0, valid: false, reason: "Not enough players for the number of courts" };
    }

    // 1. Exactly 2 teams: always valid
    if (teamCount === 2) {
        return { type: 1, valid: true, reason: "Two teams", teamsPerRound: 2, playersNeededPerTeam: courtsCount * 2 };
    }

    // 2. More than 2 teams, courts <= teams: always valid
    if (courtsCount <= teamCount) {
        return { type: 2, valid: true, reason: "Courts do not exceed number of teams", teamsPerRound: 2, playersNeededPerTeam: 2 * 2 };
    }

    // 3. More than 2 teams, courts > teams: valid only if courts divisible by teams
    if (courtsCount % teamCount === 0) {
        return { type: 3, valid: true, reason: "Courts are divisible by number of teams", teamsPerRound: teamCount, playersNeededPerTeam: (courtsCount / teamCount) * 2 };
    }

    // 4. More than 2 teams, courts > teams, not divisible: invalid
    return { type: 4, valid: false, reason: "Courts are not divisible by number of teams" };
}

// *** Bye Structure Determination *** //
// --- wholeTeamByes = Yes if numberOfTeams > courtCounts --- //
// --- playerByes = Yes if players in each team > playersNeededPerTeam --- //
function byeStructure(players, courtsCount, numberOfTeams, allTeams) {
    const teamEntries = getTeamEntries(allTeams);
    const playerCount = Array.isArray(players) ? players.length : players;
    const teamCount = numberOfTeams ?? teamEntries.length;

    const structure = teamStructureType(players, courtsCount, teamCount, allTeams);
    if (!structure.valid) {
        return { valid: false, reason: structure.reason };
    }
    const playersNeededPerTeam = structure.playersNeededPerTeam;

    // Real team sizes if each team is an array of players, otherwise assume an even split
    const teamsArePlayerArrays =
        teamEntries.length > 0 && teamEntries.every(([, roster]) => Array.isArray(roster));
    const teamSizes = teamsArePlayerArrays
        ? teamEntries.map(([, roster]) => roster.length)
        : Array(teamCount).fill(Math.floor(playerCount / teamCount));

    const evenPlayersPerTeam = teamsArePlayerArrays
        ? teamSizes.every(size => size === teamSizes[0])
        : playerCount % teamCount === 0;

    const teamByeDetails = teamSizes.map((size, i) => {
        const playersOnBye = Math.max(0, size - playersNeededPerTeam);
        const [teamKey, roster] = teamEntries[i] ?? [String(i + 1), null];
        return {
            team: teamsArePlayerArrays || roster === null ? `Team ${teamKey}` : roster, // names if allTeams holds strings
            teamKey,
            teamSize: size,
            playersNeeded: playersNeededPerTeam,
            playerByes: playersOnBye > 0,
            playersOnBye
        };
    });

    const wholeTeamByes = teamCount > courtsCount;

    return {
        valid: true,
        wholeTeamByes,
        teamByes: wholeTeamByes ? teamCount - courtsCount : 0,
        evenPlayersPerTeam,
        playersNeededPerTeam,
        teamByeDetails
    };
}

// --- Build all eligible partnerships within each team --- //
// --- For each team, every possible pairing of two players from that team, with the average DUPR --- //
// *** Pairing Matrix Per Team *** //
// --- For each team, every pairing of two players from that team, with the average DUPR --- //
// *** Pairing List Per Team *** //
// --- For each team, one entry per pairing: player1 fields, player2 fields, then avgDUPR --- //
function buildPairingMatrices(allTeams) {
    const result = {};

    Object.entries(allTeams).forEach(([teamKey, roster]) => {
        const pairings = [];

        for (let i = 0; i < roster.length; i++) {
            for (let j = i + 1; j < roster.length; j++) {
                const a = roster[i];
                const b = roster[j];

                pairings.push({
                    player1PlayerID: a.PlayerID,
                    player1DUPR: Number(a.DUPR),
                    player1ByeOrder: a.byeOrder,
                    player1PlayerExclude: a.playerExclude,

                    player2PlayerID: b.PlayerID,
                    player2DUPR: Number(b.DUPR),
                    player2ByeOrder: b.byeOrder,
                    player2PlayerExclude: b.playerExclude,

                    avgDUPR: Math.round(((Number(a.DUPR) + Number(b.DUPR)) / 2) * 1000) / 1000
                });
            }
        }

        result[teamKey] = pairings;
    });

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
        `Teams playing per round: ${isTeamStructure.teamsPerRound}\n` +
        `Players needed per team: ${isTeamStructure.playersNeededPerTeam}`
    );

    // --- Determine bye structure --- //
    const isByeStructures = byeStructure(players, courtsCount, numberOfTeams, allTeams);

    if (!isByeStructures.valid) {
        alert(`Invalid structure: ${isByeStructures.reason}`);
    } else {
        const { wholeTeamByes, teamByes, evenPlayersPerTeam, teamByeDetails } = isByeStructures;

        const anyPlayerByes = teamByeDetails.some(t => t.playerByes);
        const totalPlayersOnBye = teamByeDetails.reduce((sum, t) => sum + t.playersOnBye, 0);

        const perTeamLines = teamByeDetails
            .filter(t => t.playerByes)
            .map(t => `  ${t.team}: ${t.playersOnBye} (${t.teamSize} players, ${t.playersNeeded} needed)`)
            .join("\n");

        alert(
            `Even Players Per Team: ${evenPlayersPerTeam ? "Yes" : "No"}\n` +
            `Whole Team Byes: ${wholeTeamByes ? "Yes" : "No"}` +
            (wholeTeamByes ? `\nNumber of team byes: ${teamByes}` : "") +
            `\nPlayer Byes: ${anyPlayerByes ? "Yes" : "No"}` +
            (anyPlayerByes ? `\nTotal players on bye: ${totalPlayersOnBye}\n${perTeamLines}` : "")
        );
    }

    // --- NOTE MAY DO AT END --- //

    // const { partnerCounts, opponentCounts, courtCounts } = buildDrawHistory(matches);
    // const teamOpponentCounts = buildTeamOpponentHistory(matches);

    // --- ****************** --- //

    // --- Build bye order based on first selecting team with manual bye, then applying byes accross all teams based on DUPR ranking --- /
    

    // --- Build matrix of team pairings, with Avg. DUPR & Delta DUPR --- //
    const eligibleTeamPairs = buildPairingMatrices(allTeams);
    console.log('The eligible pairing are', eligibleTeamPairs);
   

    // --- Build all potential court pairings for the full event, including DUPR delta --- //

    // --- Define stored data variables --- //

    // *** BUILD MATCHUPS FOR EACH ROUND *** //
    // --- Pick best scoring matches, excluding players having a bye --- //

    // --- Revise scoring of round match ups --- //

    // --- Move all instances of pairings to partnership played --- //

    // --- Resort potential round match ups --- //

    
    return allMatches;
}
