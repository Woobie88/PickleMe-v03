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
// --- Priority 1: unique partnerships (hard cap per cycle) --- //
// --- Priority 2: lowest total absDUPR + penalty among the valid cycles --- //
// --- Full pool restored at the start of each cycle; combos used before carry the 1000000 penalty --- //
function buildRounds(playerCombos, numberOfRounds, byeSchedule = []) {
    const score = c => c.comboAbsTotal + c.penalty;
    const pairKey = (a, b) => [a, b].sort().join("|");
    const teamsKey = teams => [...teams].map(String).sort().join(",");
    const NODE_LIMIT = 2000000;

    // Precompute per combo
    playerCombos.forEach(c => {
        c.pairKeys = c.matches.flatMap(m => [
            pairKey(m.pair1.player1PlayerID, m.pair1.player2PlayerID),
            pairKey(m.pair2.player1PlayerID, m.pair2.player2PlayerID)
        ]);
        c.pairSig = [...c.pairKeys].sort().join(";");   // same partnerships = same signature
        c.playerIDs = new Set(c.matches.flatMap(m => [
            m.pair1.player1PlayerID, m.pair1.player2PlayerID,
            m.pair2.player1PlayerID, m.pair2.player2PlayerID
        ]));
        c.excludedKey = teamsKey(c.excludedTeams);
        c.penalty = 0;
    });

    // --- Cycle length: rounds before the bye pattern repeats --- //
    let cycleLength = numberOfRounds;
    for (let j = 1; j < numberOfRounds; j++) {
        const a = byeSchedule[0], b = byeSchedule[j];
        if (a && b &&
            teamsKey(a.excludedTeams) === teamsKey(b.excludedTeams) &&
            [...a.playersOnBye].sort().join() === [...b.playersOnBye].sort().join()) {
            cycleLength = j;
            break;
        }
    }

    // Fallback: no bye pattern found, so size the cycle by how long it takes to use every partnership once
    if (cycleLength === 1) {
        const distinctPairs = new Set(playerCombos.flatMap(c => c.pairKeys)).size;
        const pairsPerRound = playerCombos[0]?.pairKeys.length || 1;
        cycleLength = Math.max(1, Math.floor(distinctPairs / pairsPerRound));
    }
    console.log(`Cycle length: ${cycleLength}`);

    const rounds = [];

    for (let start = 0; start < numberOfRounds; start += cycleLength) {
        const end = Math.min(start + cycleLength, numberOfRounds);

        // --- Full pool for each round of this cycle, grouped by partnership set, best score first --- //
        const groupsByLevel = [];
        for (let i = start; i < end; i++) {
            const byes = byeSchedule[i] ?? { excludedTeams: [], playersOnBye: [] };
            const byeKey = teamsKey(byes.excludedTeams);

            // Eligible = right excluded team(s) and none of this round's bye players
            const eligible = playerCombos.filter(c =>
                (byeSchedule.length === 0 || c.excludedKey === byeKey) &&
                !byes.playersOnBye.some(id => c.playerIDs.has(id))
            );

            const bySig = new Map();
            eligible.forEach(c => {
                if (!bySig.has(c.pairSig)) bySig.set(c.pairSig, []);
                bySig.get(c.pairSig).push(c);
            });

            const groups = [...bySig.values()];
            groups.forEach(g => g.sort((a, b) => score(a) - score(b)));
            groups.sort((a, b) => score(a[0]) - score(b[0]));
            groupsByLevel.push(groups);
        }

        if (groupsByLevel.some(g => g.length === 0)) {
            console.log(`Cycle starting round ${start + 1}: a round has no eligible combos`);
            break;
        }

        // --- Branch and bound --- //
        const levels = groupsByLevel.length;

        // Cheapest possible score for the remaining rounds, used to prune hopeless paths early
        const minFrom = Array(levels + 1).fill(0);
        for (let l = levels - 1; l >= 0; l--) {
            minFrom[l] = minFrom[l + 1] + score(groupsByLevel[l][0][0]);
        }

        const search = cap => {
            const counts = {};
            const path = [];
            let best = null;
            let bestCost = Infinity;
            let nodes = 0;
            let hitLimit = false;

            const dfs = (level, cost) => {
                if (hitLimit) return;

                if (level === levels) {
                    if (cost < bestCost) { bestCost = cost; best = [...path]; }
                    return;
                }

                for (const group of groupsByLevel[level]) {
                    if (++nodes > NODE_LIMIT) { hitLimit = true; return; }

                    const combo = group[0];                                     // best-scoring combo for this partnership set
                    const newCost = cost + score(combo);
                    if (newCost + minFrom[level + 1] >= bestCost) continue;    // cannot beat the best found
                    if (combo.pairKeys.some(k => (counts[k] || 0) >= cap)) continue;

                    combo.pairKeys.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
                    path.push(combo);

                    dfs(level + 1, newCost);

                    path.pop();
                    combo.pairKeys.forEach(k => { counts[k]--; });
                }
            };

            dfs(0, 0);
            return { best, bestCost, hitLimit };
        };

        // Strictest uniqueness first; only relax the cap if no valid cycle exists
        let chosen = null;
        for (const cap of [1, 2, 3, Infinity]) {
            const result = search(cap);
            if (result.best) {
                chosen = result.best;
                console.log(`Cycle rounds ${start + 1}-${end}: cap ${cap} | total score ${result.bestCost}${result.hitLimit ? " (node limit hit, best found so far)" : " (optimal)"}`);
                break;
            }
        }
        if (!chosen) {
            console.log(`Cycle rounds ${start + 1}-${end}: no valid cycle found`);
            break;
        }

        // --- Record the rounds and penalise the combos used --- //
        chosen.forEach((selected, idx) => {
            const i = start + idx;
            const byes = byeSchedule[i] ?? { excludedTeams: [], playersOnBye: [] };
            const roundScore = score(selected);   // score before the penalty is applied
            selected.penalty += 1000000;

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
        });
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

// *** Convert buildRounds output into match records (same format as newMatches) *** //
function buildMatchRecordsFromRounds(rounds, players, courtsCount, eventId, drawVersion, userEmail) {
    const playerById = {};
    players.forEach(p => { playerById[p.PlayerID] = p; });

    const courtNumbers = Array.from({ length: courtsCount }, (_, i) => i + 1);
    const allRecords = [];

    rounds.forEach(r => {
        // Match-ups in the shape assignCourts / buildMatchRecord expect
        const matchups = r.combo.matches.map(m => ({
            teamA: [playerById[m.pair1.player1PlayerID], playerById[m.pair1.player2PlayerID]],
            teamB: [playerById[m.pair2.player1PlayerID], playerById[m.pair2.player2PlayerID]]
        }));

        // Allocate courts using the court history built from earlier rounds
        const { courtCounts } = buildDrawHistory(allRecords);
        const courted = assignCourts(matchups, courtNumbers, courtCounts);

        courted.forEach((m, idx) => {
            allRecords.push(buildMatchRecord(m, idx, r.round, eventId, drawVersion, userEmail));
        });
    });

    return allRecords;
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

    // Same format as newMatches
    return buildMatchRecordsFromRounds(rounds, players, courtsCount, activeEventId, newDrawVersion, userEmail);
}