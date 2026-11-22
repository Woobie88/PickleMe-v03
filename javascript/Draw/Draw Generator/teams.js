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
// --- The match selected MUST NOT include the team(s) or player(s) having a bye that round --- //
function buildRounds(playerCombos, numberOfRounds, byeSchedule = []) {
    const score = c => c.comboAbsTotal + c.penalty;
    const pairKey = (a, b) => [a, b].sort().join("|");
    const teamsKey = teams => [...teams].map(String).sort().join(",");

    // Precompute per combo: partnerships, players used, excluded-team key
    playerCombos.forEach(c => {
        c.pairKeys = c.matches.flatMap(m => [
            pairKey(m.pair1.player1PlayerID, m.pair1.player2PlayerID),
            pairKey(m.pair2.player1PlayerID, m.pair2.player2PlayerID)
        ]);
        c.playerIDs = new Set(c.matches.flatMap(m => [
            m.pair1.player1PlayerID, m.pair1.player2PlayerID,
            m.pair2.player1PlayerID, m.pair2.player2PlayerID
        ]));
        c.excludedKey = teamsKey(c.excludedTeams);
    });

    let available = [...playerCombos];
    let removed = [];
    const rounds = [];

    for (let i = 0; i < numberOfRounds; i++) {
        const byes = byeSchedule[i] ?? { excludedTeams: [], playersOnBye: [] };
        const byeKey = teamsKey(byes.excludedTeams);
        const byePlayers = new Set(byes.playersOnBye);

        // Only combos with this round's excluded team(s) and none of the bye players
        const isEligible = c =>
            (byeSchedule.length === 0 || c.excludedKey === byeKey) &&
            ![...byePlayers].some(id => c.playerIDs.has(id));

        // --- A. Pick best scoring eligible match; if none, add back in all of C --- //
        let candidates = available.filter(isEligible);
        if (candidates.length === 0 && removed.length > 0) {
            available = available.concat(removed);
            removed = [];
            candidates = available.filter(isEligible);
        }
        if (candidates.length === 0) {
            console.log(`Round ${i + 1}: no eligible combos left`);
            break;
        }

        const selected = candidates.reduce((best, c) => (score(c) < score(best) ? c : best));
        const roundScore = score(selected);   // score before the penalty is applied

        // --- B. Add 1000000 to the penalty of the selected match up --- //
        selected.penalty += 1000000;

        // --- C. Remove all instances of those players partnering together & store --- //
        const usedPairs = new Set(selected.pairKeys);
        const stillAvailable = [];
        available.forEach(c => {
            if (c.pairKeys.some(k => usedPairs.has(k))) removed.push(c);
            else stillAvailable.push(c);
        });
        available = stillAvailable;

        rounds.push({
            round: i + 1,
            combo: selected,
            score: roundScore,
            teamsOnBye: byes.excludedTeams,
            playersOnBye: byes.playersOnBye
        });

        console.log(`===== Round ${i + 1} | Abs DUPR total: ${roundScore} | Teams on bye: ${byes.excludedTeams.join(", ") || "none"} | Players on bye: ${byes.playersOnBye.join(", ") || "none"} =====`);
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

// *** Partner & Opponent Summary By PlayerID *** //
// --- rounds = output of buildRounds; players (optional) adds names and teams to the summary --- //
function summarisePlayerHistory(rounds, players = []) {
    const info = {};
    players.forEach(p => { info[p.PlayerID] = { Name: p.Name, Team: p.Team }; });

    const stats = {};
    const get = id => (stats[id] ??= {
        PlayerID: id,
        Name: info[id]?.Name ?? "",
        Team: info[id]?.Team ?? "",
        roundsPlayed: 0,
        partners: new Map(),    // PlayerID -> times partnered
        opponents: new Map()    // PlayerID -> times opposed
    });

    const bump = (map, id) => map.set(id, (map.get(id) ?? 0) + 1);

    // Highest count in a map, plus who it was with (ties are all listed)
    const maxOf = map => {
        let max = 0;
        map.forEach(v => { if (v > max) max = v; });
        const ids = [...map.entries()].filter(([, v]) => v === max).map(([id]) => id);
        return { max, ids };
    };
    const sumOf = map => [...map.values()].reduce((a, b) => a + b, 0);

    rounds.forEach(r => {
        r.combo.matches.forEach(m => {
            const pairA = [m.pair1.player1PlayerID, m.pair1.player2PlayerID];
            const pairB = [m.pair2.player1PlayerID, m.pair2.player2PlayerID];

            [[pairA, pairB], [pairB, pairA]].forEach(([own, other]) => {
                own.forEach(id => {
                    const s = get(id);
                    s.roundsPlayed++;

                    bump(s.partners, own.find(x => x !== id));
                    other.forEach(o => bump(s.opponents, o));
                });
            });
        });
    });

    // Flat summary, one row per player
    const summary = Object.values(stats)
        .map(s => {
            const mp = maxOf(s.partners);
            const mo = maxOf(s.opponents);
            return {
                PlayerID: s.PlayerID,
                Name: s.Name,
                Team: s.Team,
                roundsPlayed: s.roundsPlayed,
                uniquePartners: s.partners.size,
                uniqueOpponents: s.opponents.size,
                maxSamePartner: mp.max,
                maxSameOpponent: mo.max,
                totalPartnerings: sumOf(s.partners),
                totalOpponentings: sumOf(s.opponents),
                maxPartnerIDs: mp.ids.join(", "),       // who the max was with
                maxOpponentIDs: mo.ids.join(", "),
                partnerIDs: [...s.partners.keys()].join(", "),
                opponentIDs: [...s.opponents.keys()].join(", ")
            };
        })
        .sort((a, b) => String(a.Team).localeCompare(String(b.Team)) || a.PlayerID.localeCompare(b.PlayerID));

    console.log("===== Partner & Opponent Summary By Player =====");
    console.table(summary.map(({ partnerIDs, opponentIDs, maxPartnerIDs, maxOpponentIDs, ...rest }) => rest));

    // Overall maximums across all players
    const overallMaxPartner = Math.max(0, ...summary.map(s => s.maxSamePartner));
    const overallMaxOpponent = Math.max(0, ...summary.map(s => s.maxSameOpponent));
    console.log(`Overall max same partner: ${overallMaxPartner} | Overall max same opponent: ${overallMaxOpponent}`);

    return summary;   // full version, including the ID lists
}

// *** Build byes by round *** //
// --- A. Whole team byes: shuffle the rotation order once, then repeat the sequence --- //
// --- B. Player byes: shuffle seeds in one team, every team uses the same seed(s), repeat the cycle --- //
// --- Even teams only for now --- //
function buildByeSchedule(allTeams, teamCombos, byeInfo, numberOfRounds) {
    // A1-A3. Each team combo already has its own excluded team(s), so every team gets a bye per cycle
    const teamOrder = shuffle(teamCombos.map(c => c.excludedTeams));

    // B. Teams that need player byes (team size > players needed per round)
    const byTeams = byeInfo.teamByeDetails.filter(d => d.playersOnBye > 0);

    // B1-B2. Random seed order taken from one randomly chosen team
    let seedOrder = [];
    if (byTeams.length > 0) {
        const refKey = byTeams[Math.floor(Math.random() * byTeams.length)].teamKey;
        seedOrder = shuffle([...Array(allTeams[refKey].length).keys()]);
    }

    const schedule = [];
    for (let r = 0; r < numberOfRounds; r++) {
        const excludedTeams = (teamOrder[r % teamOrder.length] ?? []).map(String);
        const playersOnBye = [];

        // B3-B4. Same seeds in every team that plays this round, cycling once all have had a bye
        byTeams.forEach(d => {
            if (excludedTeams.includes(String(d.teamKey))) return;   // whole team is out anyway
            const roster = allTeams[d.teamKey];                      // already sorted by DUPR, so index = seed
            for (let b = 0; b < d.playersOnBye; b++) {
                const seed = seedOrder[(r * d.playersOnBye + b) % seedOrder.length] % roster.length;
                playersOnBye.push(roster[seed].PlayerID);
            }
        });

        schedule.push({ round: r + 1, excludedTeams, playersOnBye });
    }

    console.log("===== Bye schedule =====");
    console.table(schedule.map(s => ({
        round: s.round,
        teamsOnBye: s.excludedTeams.join(", ") || "none",
        playersOnBye: s.playersOnBye.join(", ") || "none"
    })));

    return schedule;
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

    // --- Build byes by round --- //
    // --- A. Whole Team Byes = Yes --- //
        // --- A1. Calculate number of teams needed for bye per round: Number of teams - teams playing per round --- //
        // --- A2. Randomise teams selected such that each team gets a bye --- //
        // --- A3. Build off A2, which team(s) have a bye each round. Once all are exhausted, repeat the sequence built in A2 --- //
    // --- B. By team, take the number of players needed each round - total players per team --- //
        // --- B1. If each team is even, randomise the PlayerID selected in 1 of the team --- //
        // --- B2. Do B1 until all players within that team have been selected --- //
        // --- B3. For the remaining teams, match the seeded player (by DUPR) selected in B2 above. For example if seed 1 is first then all seed 1s --- //
        // --- B4. Build byes per round, repeating the cycle once all players have their first bye --- //
        // --- NOTE: I will do If each team is even = No later --- //
    

    // --- Build matrix of team pairings, with Avg. DUPR & Delta DUPR --- //
    const pairings = buildPairingMatrices(allTeams);
    console.log('The eligible team pairings', pairings);

    const teamCombos = buildTeamCombos(players, courtsCount, numberOfTeams, allTeams);

    if (!teamCombos.valid || !isByeStructures.valid) {
        alert(`Invalid structure: ${teamCombos.reason ?? isByeStructures.reason}`);
        return [];
    }

    // --- Build byes by round --- //
    const byeSchedule = buildByeSchedule(allTeams, teamCombos.combos, isByeStructures, numberOfRounds);

    const playerCombos = buildPlayerCombos(teamCombos.combos, pairings);
    playerCombos.sort((a, b) => (a.comboAbsTotal + a.penalty) - (b.comboAbsTotal + b.penalty));

    // *** BUILD MATCHUPS FOR EACH ROUND *** //
    const rounds = buildRounds(playerCombos, numberOfRounds, byeSchedule);
    summarisePlayerHistory(rounds, players);

    return rounds;
}