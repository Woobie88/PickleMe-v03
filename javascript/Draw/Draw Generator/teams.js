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

/// *** Step 1: Team-level combos *** //
// --- courtsCount = combo length (one match per court, but no court is allocated) --- //
// --- A team never plays itself --- //
// --- If wholeTeamByes, the excluded team(s) rotate through each combo --- //
function buildTeamCombos(players, courtsCount, numberOfTeams, allTeams) {
    const teamKeys = getTeamEntries(allTeams).map(([key]) => key);
    const teamCount = numberOfTeams ?? teamKeys.length;

    const structure = teamStructureType(players, courtsCount, teamCount, allTeams);
    if (!structure.valid) return { valid: false, reason: structure.reason };

    const teamByes = Math.max(0, teamCount - courtsCount);
    const rotations = teamByes > 0 ? teamCount : 1;   // one combo per rotation of the byes
    const combos = [];

    for (let r = 0; r < rotations; r++) {
        // Cycle which team(s) are excluded
        const excludedTeams = [];
        for (let b = 0; b < teamByes; b++) excludedTeams.push(teamKeys[(r + b) % teamCount]);

        const playing = teamKeys.filter(k => !excludedTeams.includes(k));

        // 2 teams: one matchup. 3+ teams: ring (1v2, 2v3, 3v1...) so each team plays 2 matches
        const ring = playing.length === 2
            ? [[playing[0], playing[1]]]
            : playing.map((team, i) => [team, playing[(i + 1) % playing.length]]);

        // One match per court slot; the ring repeats if there are more courts than ring matches
        // (no court number is assigned)
        const matches = Array.from({ length: courtsCount }, (_, c) => {
            const [team1, team2] = ring[c % ring.length];
            return { team1, team2 };
        });

        combos.push({ comboId: r + 1, excludedTeams, matches });
    }

    return { valid: true, combos };
}

// *** Step 2: Player-level combos *** //
// --- Fills each match with a pairing from each team, no player used twice within a combo --- //
// --- pairings = output of buildPairingMatrices(allTeams) --- //
// --- No court is allocated; combo length = number of matches (courtsCount) --- //
function buildPlayerCombos(teamCombos, pairings, maxCombos = 100000) {
    const results = [];
    const round3 = n => Math.round(n * 1000) / 1000;

    teamCombos.forEach(combo => {
        const usedByTeam = {};                    // teamKey -> Set of PlayerIDs already used
        const chosen = [];

        const clashes = (team, pair) => {
            const used = usedByTeam[team] ?? (usedByTeam[team] = new Set());
            return used.has(pair.player1PlayerID) || used.has(pair.player2PlayerID);
        };

        const mark = (team, pair, add) => {
            const used = usedByTeam[team] ?? (usedByTeam[team] = new Set());
            [pair.player1PlayerID, pair.player2PlayerID].forEach(id =>
                add ? used.add(id) : used.delete(id)
            );
        };

        const slim = p => ({
            player1PlayerID: p.player1PlayerID,
            player2PlayerID: p.player2PlayerID,
            avgDUPR: p.avgDUPR
        });

        const recurse = m => {
            if (results.length >= maxCombos) return;

            // Base case: every match in the combo has been filled
            if (m === combo.matches.length) {
                const matches = chosen.map((c, i) => ({
                    team1: combo.matches[i].team1,
                    team2: combo.matches[i].team2,
                    pair1: slim(c.p1),
                    pair2: slim(c.p2),
                    absDiff: round3(Math.abs(c.p1.avgDUPR - c.p2.avgDUPR))
                }));

                const absAvgMatrix = matches.map(x => x.absDiff);   // |avg1 - avg2| per match

                results.push({
                    comboId: combo.comboId,
                    excludedTeams: combo.excludedTeams,
                    matches,
                    absAvgMatrix,
                    comboAbsTotal: round3(absAvgMatrix.reduce((a, b) => a + b, 0)),
                    penalty: 0
                });
                return;
            }

            const { team1, team2 } = combo.matches[m];

            for (const p1 of pairings[team1]) {
                if (clashes(team1, p1)) continue;
                mark(team1, p1, true);

                for (const p2 of pairings[team2]) {
                    if (clashes(team2, p2)) continue;
                    mark(team2, p2, true);

                    chosen.push({ p1, p2 });
                    recurse(m + 1);
                    chosen.pop();

                    mark(team2, p2, false);
                }

                mark(team1, p1, false);
            }
        };

        recurse(0);
    });

    return results;
}

// *** BUILD MATCHUPS FOR EACH ROUND *** //
function buildRounds(playerCombos, numberOfRounds) {
    const score = c => c.comboAbsTotal + c.penalty;
    const pairKey = (a, b) => [a, b].sort().join("|");

    // Every same-team partnership used in a combo, e.g. "JOLJDrSK|WI0THs5q"
    const getPairKeys = combo =>
        combo.matches.flatMap(m => [
            pairKey(m.pair1.player1PlayerID, m.pair1.player2PlayerID),
            pairKey(m.pair2.player1PlayerID, m.pair2.player2PlayerID)
        ]);

    // Compute pair keys once per combo
    playerCombos.forEach(c => { c.pairKeys = getPairKeys(c); });

    let available = [...playerCombos];   // combos still in play
    let removed = [];                    // C. stored combos
    const rounds = [];

    for (let i = 0; i < numberOfRounds; i++) {
        // --- A. Pick best scoring matches --- //
        // --- If combo length = 0, add back in all of C. --- //
        if (available.length === 0) {
            available = removed;
            removed = [];
        }
        if (available.length === 0) {
            console.log(`Round ${i + 1}: no combos left`);
            break;
        }

        // --- If combo length > 0, pick the lowest comboAbsTotal + penalty --- //
        available.sort((a, b) => score(a) - score(b));
        const selected = available[0];
        const roundScore = score(selected);   // score before the penalty is applied

        // --- B. For the match up selected, add 1000000 to the penalty --- //
        selected.penalty += 1000000;

        // --- C. Remove all instances of those players partnering together & store --- //
        const usedPairs = new Set(selected.pairKeys);
        const stillAvailable = [];
        available.forEach(c => {
            if (c.pairKeys.some(k => usedPairs.has(k))) removed.push(c);
            else stillAvailable.push(c);
        });
        available = stillAvailable;

        rounds.push({ round: i + 1, combo: selected, score: roundScore });

        // --- Console log the result for this round --- //
        console.log(`===== Round ${i + 1} | Abs DUPR total: ${roundScore} | Excluded teams: ${selected.excludedTeams.join(", ") || "none"} =====`);
        console.table(selected.matches.map(m => ({
            match: `Team ${m.team1} v Team ${m.team2}`,
            pair1: `${m.pair1.player1PlayerID} / ${m.pair1.player2PlayerID}`,
            pair1Avg: m.pair1.avgDUPR,
            pair2: `${m.pair2.player1PlayerID} / ${m.pair2.player2PlayerID}`,
            pair2Avg: m.pair2.avgDUPR,
            absDiff: m.absDiff
        })));
        console.log(`Combos remaining: ${available.length} | Stored (removed): ${removed.length}`);
    }

    return rounds;
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
    const pairings = buildPairingMatrices(allTeams);
    console.log('The eligible team pairings', pairings);

        const teamCombos = buildTeamCombos(players, courtsCount, numberOfTeams, allTeams);

    if (!teamCombos.valid) {
        alert(`Invalid structure: ${teamCombos.reason}`);
        return [];   // nothing to build
    }

    console.log(teamCombos.combos);   // e.g. 4 teams / 3 courts -> 4 combos
    const playerCombos = buildPlayerCombos(teamCombos.combos, pairings);

    // Sort by absolute DUPR difference total, ascending (most balanced first)
    playerCombos.sort((a, b) => (a.comboAbsTotal + a.penalty) - (b.comboAbsTotal + b.penalty));
    console.log('The best match up', playerCombos[0]?.comboAbsTotal);
    console.log('The worst match up', playerCombos[playerCombos.length - 1]?.comboAbsTotal);

    // *** BUILD MATCHUPS FOR EACH ROUND *** //
    const rounds = buildRounds(playerCombos, numberOfRounds);

    return rounds;
}
