/**
 * ============================================================
 * DRAW GENERATION ENGINE
 * Generates N rounds of matchups for both single-group games
 * (Rotating Partners) and clustered games (Divisions, Ladder
 * Scramble, Pools, Pool Fusion), minimizing partner repeats,
 * opponent repeats, and DUPR gaps, while balancing court
 * exposure. Byes rotate through a fixed shuffled order that
 * repeats each cycle — calculated per-team for clustered games.
 * ============================================================
 */

// ---------- UTILITIES ----------

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function teamAvgDupr(team) {
  const vals = team.map(p => parseFloat(p.DUPR) || 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function calculateWinProbability(duprA, duprB) {
  const diff = duprA - duprB;
  return 1 / (1 + Math.pow(10, -diff / 2));
}

function generateMatchId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ---------- EVENT ROUNDS ----------

function getEventRoundCount() {
  const payload = window.cachedUserUniverse;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(payload.activeEventId));
  return parseInt(activeEvent?.NumberofRound) || 1;
}

// ---------- BYE SCHEDULE ----------

function generateByeSchedule(players, numberOfRounds, courtsCount) {
  const neededPerRound = Math.max(0, players.length - courtsCount * 4);
  const byesByRound = {};

  if (neededPerRound === 0) {
    for (let i = 0; i < numberOfRounds; i++) {
      byesByRound[i] = [];
    }
    return byesByRound;
  }

  const baseOrder = shuffle(players.map(p => p.PlayerID));
  let pointer = 0;

  for (let round = 0; round < numberOfRounds; round++) {
    const byes = [];
    for (let i = 0; i < neededPerRound; i++) {
      byes.push(baseOrder[pointer % baseOrder.length]);
      pointer++;
    }
    byesByRound[round] = byes;
  }

  return byesByRound;
}

function generateByeScheduleByTeam(players, numberOfRounds, courtsPerTeam) {
  const teams = {};
  players.forEach(p => {
    const t = p.Team;
    if (!teams[t]) teams[t] = [];
    teams[t].push(p);
  });

  const teamKeys = Object.keys(teams).sort((a, b) => parseInt(a) - parseInt(b));
  const byeSchedulesByTeam = {};

  teamKeys.forEach(teamKey => {
    byeSchedulesByTeam[teamKey] = generateByeSchedule(teams[teamKey], numberOfRounds, courtsPerTeam);
  });

  return byeSchedulesByTeam;
}

// ---------- HISTORY BUILDING ----------

function buildDrawHistory(matches) {
  const partnerCounts = {};
  const opponentCounts = {};
  const courtCounts = {};

  function bump(map, a, b) {
    if (!map[a]) map[a] = {};
    map[a][b] = (map[a][b] || 0) + 1;
  }

  matches.forEach(m => {
    const t1 = [m.Team1Player1, m.Team1Player2];
    const t2 = [m.Team2Player1, m.Team2Player2];

    bump(partnerCounts, t1[0], t1[1]);
    bump(partnerCounts, t1[1], t1[0]);
    bump(partnerCounts, t2[0], t2[1]);
    bump(partnerCounts, t2[1], t2[0]);

    [...t1].forEach(p1 => [...t2].forEach(p2 => {
      bump(opponentCounts, p1, p2);
      bump(opponentCounts, p2, p1);
    }));

    [...t1, ...t2].forEach(p => {
      if (!courtCounts[p]) courtCounts[p] = {};
      courtCounts[p][m.Court] = (courtCounts[p][m.Court] || 0) + 1;
    });
  });

  return { partnerCounts, opponentCounts, courtCounts };
}

// ---------- PARTNERSHIP GENERATION ----------

function scorePairing(p1, p2, partnerCounts) {
  const repeats = (partnerCounts[p1.PlayerID]?.[p2.PlayerID]) || 0;
  const duprGap = Math.abs((parseFloat(p1.DUPR) || 0) - (parseFloat(p2.DUPR) || 0));
  return repeats * 100 + duprGap * 10;
}

function attemptPartnerships(eligiblePlayers, partnerCounts) {
  const pool = shuffle(eligiblePlayers);
  const pairs = [];
  const used = new Set();
  let cost = 0;

  for (const p1 of pool) {
    if (used.has(p1.PlayerID)) continue;

    let bestPartner = null, bestCost = Infinity;
    for (const p2 of pool) {
      if (p2.PlayerID === p1.PlayerID || used.has(p2.PlayerID)) continue;
      const c = scorePairing(p1, p2, partnerCounts);
      if (c < bestCost) { bestCost = c; bestPartner = p2; }
    }

    if (bestPartner) {
      pairs.push([p1, bestPartner]);
      used.add(p1.PlayerID);
      used.add(bestPartner.PlayerID);
      cost += bestCost;
    }
  }

  return { pairs, cost };
}

function generateBestPartnerships(eligiblePlayers, partnerCounts, attempts = 300) {
  let best = null, bestCost = Infinity;
  for (let i = 0; i < attempts; i++) {
    const result = attemptPartnerships(eligiblePlayers, partnerCounts);
    if (result.cost < bestCost) { bestCost = result.cost; best = result.pairs; }
  }
  return best;
}

// ---------- MATCHUP GENERATION ----------

function scoreMatchup(teamA, teamB, opponentCounts) {
  let repeats = 0;
  teamA.forEach(p1 => teamB.forEach(p2 => {
    repeats += (opponentCounts[p1.PlayerID]?.[p2.PlayerID]) || 0;
  }));
  const duprGap = Math.abs(teamAvgDupr(teamA) - teamAvgDupr(teamB));
  return repeats * 100 + duprGap * 10;
}

function attemptMatchups(partnerships, opponentCounts) {
  const pool = shuffle(partnerships);
  const matchups = [];
  const used = new Set();
  let cost = 0;

  for (let a = 0; a < pool.length; a++) {
    if (used.has(a)) continue;

    let bestIdx = -1, bestCost = Infinity;
    for (let b = 0; b < pool.length; b++) {
      if (b === a || used.has(b)) continue;
      const c = scoreMatchup(pool[a], pool[b], opponentCounts);
      if (c < bestCost) { bestCost = c; bestIdx = b; }
    }

    if (bestIdx !== -1) {
      matchups.push({ teamA: pool[a], teamB: pool[bestIdx] });
      used.add(a);
      used.add(bestIdx);
      cost += bestCost;
    }
  }

  return { matchups, cost };
}

function generateBestMatchups(partnerships, opponentCounts, attempts = 300) {
  let best = null, bestCost = Infinity;
  for (let i = 0; i < attempts; i++) {
    const result = attemptMatchups(partnerships, opponentCounts);
    if (result.cost < bestCost) { bestCost = result.cost; best = result.matchups; }
  }
  return best;
}

// ---------- COURT ALLOCATION ----------

function assignCourts(matchups, courtNumbers, courtCounts) {
  const remainingCourts = [...courtNumbers];
  const assigned = [];

  matchups.forEach(match => {
    const players = [...match.teamA, ...match.teamB];

    let bestCourt = null, bestScore = Infinity;
    remainingCourts.forEach(court => {
      const score = players.reduce((sum, p) => sum + ((courtCounts[p.PlayerID]?.[court]) || 0), 0);
      if (score < bestScore) { bestScore = score; bestCourt = court; }
    });

    assigned.push({ ...match, court: bestCourt });
    remainingCourts.splice(remainingCourts.indexOf(bestCourt), 1);
  });

  return assigned;
}

// ---------- MATCH RECORD BUILDER ----------

function buildMatchRecord(m, idx, roundNumber, eventId, drawVersion, userEmail) {
  const avg1 = teamAvgDupr(m.teamA);
  const avg2 = teamAvgDupr(m.teamB);
  const winProb1 = calculateWinProbability(avg1, avg2);

  return {
    MatchID: generateMatchId(),
    EventID: eventId,
    Round: roundNumber,
    Court: m.court,
    DrawVersion: drawVersion,
    MatchType: "Round Robin",
    Team1: m.teamA[0].Team,
    Team2: m.teamB[0].Team,
    Team1Player1: m.teamA[0].PlayerID,
    Team1Player2: m.teamA[1].PlayerID,
    Team2Player1: m.teamB[0].PlayerID,
    Team2Player2: m.teamB[1].PlayerID,
    Team1AvgDUPR: avg1,
    Team2AvgDUPR: avg2,
    DUPRMatchDelta: Math.abs(avg1 - avg2), // NEW
    Team1WinProb: winProb1,
    Team2WinProb: 1 - winProb1,
    ExpectedTeam1Score: winProb1 >= 0.5 ? 11 : Math.round(winProb1 * 11 / (1 - winProb1)),
    ExpectedTeam2Score: winProb1 >= 0.5 ? Math.round((1 - winProb1) * 11 / winProb1) : 11,
    Team1Score: 0,
    Team2Score: 0,
    Team1WinLoss: '',
    Team2WinLoss: '',
    Active: 'Active', // NEW
    UserEmail: userEmail, // NEW
    Timestamp: new Date().toISOString()
  };
}

// ---------- SHARED GROUP GENERATOR ----------

function generateGroupMatches(groupPlayers, courtNumbers, partnerCounts, opponentCounts, courtCounts, roundNumber, eventId, drawVersion) {
  const partnerships = generateBestPartnerships(groupPlayers, partnerCounts);
  const matchups = generateBestMatchups(partnerships, opponentCounts);
  const courted = assignCourts(matchups, courtNumbers, courtCounts);

  return courted.map((m, idx) => buildMatchRecord(m, idx, roundNumber, eventId, drawVersion));
}

// ---------- SINGLE ROUND GENERATION (Rotating Partners — one group, all courts) ----------

function generateRoundDraw(players, matches, byePlayerIds, roundNumber, courtsCount, eventId, drawVersion) {
  const eligible = players.filter(p => !byePlayerIds.includes(p.PlayerID));
  const { partnerCounts, opponentCounts, courtCounts } = buildDrawHistory(matches);
  const courtNumbers = Array.from({ length: courtsCount }, (_, i) => i + 1);

  return generateGroupMatches(eligible, courtNumbers, partnerCounts, opponentCounts, courtCounts, roundNumber, eventId, drawVersion);
}

// ---------- CLUSTERED ROUND GENERATION (Divisions, Ladder Scramble, Pools, Pool Fusion) ----------

function generateClusteredRoundDraw(players, matches, byesByTeamForThisRound, roundNumber, courtsCount, eventId, drawVersion, numberOfTeams) {
  if (courtsCount % numberOfTeams !== 0) {
    console.error(`Cannot generate draw: courtsCount (${courtsCount}) is not evenly divisible by NumberOfTeams (${numberOfTeams}).`);
    return [];
  }

  const courtsPerTeam = courtsCount / numberOfTeams;
  const { partnerCounts, opponentCounts, courtCounts } = buildDrawHistory(matches);

  const teams = {};
  players.forEach(p => {
    const t = p.Team;
    if (!teams[t]) teams[t] = [];
    teams[t].push(p);
  });

  const teamKeys = Object.keys(teams).sort((a, b) => parseInt(a) - parseInt(b));

  let allMatches = [];
  let courtCursor = 1;

  teamKeys.forEach(teamKey => {
    const teamByes = byesByTeamForThisRound[teamKey] || [];
    const teamPlayers = teams[teamKey].filter(p => !teamByes.includes(p.PlayerID));

    const courtNumbers = [];
    for (let i = 0; i < courtsPerTeam; i++) {
      courtNumbers.push(courtCursor);
      courtCursor++;
    }

    if (teamPlayers.length !== courtsPerTeam * 4) {
      console.warn(`Team ${teamKey} has ${teamPlayers.length} eligible players but ${courtsPerTeam} courts expect ${courtsPerTeam * 4}. Proceeding anyway.`);
    }

    const teamMatches = generateGroupMatches(teamPlayers, courtNumbers, partnerCounts, opponentCounts, courtCounts, roundNumber, eventId, drawVersion);
    allMatches.push(...teamMatches);
  });

  return allMatches;
}

// ---------- MULTI-ROUND GENERATION ----------

function generateMultipleRounds(players, existingMatches, byesByRound, startRound, numberOfRounds, courtsCount, eventId, drawVersion, gameId, numberOfTeams) {
  let allMatches = [...existingMatches];
  const generatedRounds = [];

  const clusteredGames = ['divisions', 'ladder-scramble', 'pools', 'pool-fusion'];
  const isClustered = clusteredGames.includes(gameId);

  for (let i = 0; i < numberOfRounds; i++) {
    const roundNumber = startRound + i;

    let roundMatches;
    if (isClustered) {
      const byesByTeamForThisRound = {};
      Object.keys(byesByRound).forEach(teamKey => {
        byesByTeamForThisRound[teamKey] = byesByRound[teamKey][i] || [];
      });
      roundMatches = generateClusteredRoundDraw(players, allMatches, byesByTeamForThisRound, roundNumber, courtsCount, eventId, drawVersion, numberOfTeams);
    } else {
      const byesForThisRound = byesByRound[roundNumber] || [];
      roundMatches = generateRoundDraw(players, allMatches, byesForThisRound, roundNumber, courtsCount, eventId, drawVersion);
    }

    generatedRounds.push(...roundMatches);
    allMatches = [...allMatches, ...roundMatches];
  }

  return generatedRounds;
}

// ---------- PLAYER SUMMARY LOGGING ----------

function logPlayerSummary(players, matches, byesByRound) {
  const summary = {};

  players.forEach(p => {
    summary[p.PlayerID] = {
      games: 0,
      byes: 0,
      partners: {},
      opponents: {}
    };
  });

  Object.values(byesByRound).forEach(byeList => {
    byeList.forEach(pid => {
      if (summary[pid]) summary[pid].byes++;
    });
  });

  matches.forEach(m => {
    const t1 = [m.Team1Player1, m.Team1Player2];
    const t2 = [m.Team2Player1, m.Team2Player2];

    [...t1, ...t2].forEach(pid => {
      if (summary[pid]) summary[pid].games++;
    });

    if (summary[t1[0]]) summary[t1[0]].partners[t1[1]] = (summary[t1[0]].partners[t1[1]] || 0) + 1;
    if (summary[t1[1]]) summary[t1[1]].partners[t1[0]] = (summary[t1[1]].partners[t1[0]] || 0) + 1;
    if (summary[t2[0]]) summary[t2[0]].partners[t2[1]] = (summary[t2[0]].partners[t2[1]] || 0) + 1;
    if (summary[t2[1]]) summary[t2[1]].partners[t2[0]] = (summary[t2[1]].partners[t2[0]] || 0) + 1;

    t1.forEach(p1 => t2.forEach(p2 => {
      if (summary[p1]) summary[p1].opponents[p2] = (summary[p1].opponents[p2] || 0) + 1;
      if (summary[p2]) summary[p2].opponents[p1] = (summary[p2].opponents[p1] || 0) + 1;
    }));
  });

  console.log("=== PLAYER SUMMARY ===");
  players.forEach(p => {
    const s = summary[p.PlayerID];
    const uniquePartners = Object.keys(s.partners).length;
    const uniqueOpponents = Object.keys(s.opponents).length;
    const maxSamePartner = Object.values(s.partners).reduce((max, c) => Math.max(max, c), 0);
    const maxSameOpponent = Object.values(s.opponents).reduce((max, c) => Math.max(max, c), 0);

    console.log(
      `${p.PlayerID} || Games ${s.games} || Byes ${s.byes} || Unique Partners ${uniquePartners} || Unique Opponents ${uniqueOpponents} || Max Same Partner ${maxSamePartner} || Max Same Opponent ${maxSameOpponent}`
    );
  });
}

// ---------- TOP-LEVEL ENTRY POINT ----------

async function generateNRoundsAndPreview(numberOfRounds) {
  const payload = window.cachedUserUniverse;
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));

  console.log(`Number of rounds: ${numberOfRounds}`);

  const players = payload.players && payload.players.length > 0
    ? payload.players
    : await window.fetchPlayersFromFirestore(activeEventId, activeEvent.CurrentPlayerVersion);
  window.cachedUserUniverse.players = players;

  const courtsCount = Math.min(parseInt(activeEvent.NumberofCourts) || 1, Math.floor(players.length / 4) || 1);
  console.log(`Courts calculated: ${courtsCount} (NumberofCourts: ${activeEvent.NumberofCourts}, Players: ${players.length}, Max supportable courts: ${Math.floor(players.length / 4)})`);

  const gameId = activeEvent.GameID;
  const numberOfTeams = parseInt(activeEvent.NumberOfTeams) || 1;

  const startRound = 1;

  const clusteredGames = ['divisions', 'ladder-scramble', 'pools', 'pool-fusion'];
  const isClustered = clusteredGames.includes(gameId);

  let byesByRound;
  if (isClustered) {
    const courtsPerTeam = courtsCount / numberOfTeams;
    byesByRound = generateByeScheduleByTeam(players, numberOfRounds, courtsPerTeam);
  } else {
    const byeSchedule = generateByeSchedule(players, numberOfRounds, courtsCount);
    byesByRound = {};
    Object.keys(byeSchedule).forEach(i => {
      byesByRound[startRound + parseInt(i)] = byeSchedule[i];
    });
  }

  const newMatches = generateMultipleRounds(
    players,
    [],
    byesByRound,
    startRound,
    numberOfRounds,
    courtsCount,
    activeEventId,
    activeEvent.CurrentDrawVersion,
    gameId,
    numberOfTeams
  );

  console.log(`Generated ${newMatches.length} matches across ${numberOfRounds} round(s) for game type "${gameId}":`, newMatches);

  const flatByesByRound = {};
  for (let i = 0; i < numberOfRounds; i++) {
    flatByesByRound[startRound + i] = isClustered
      ? Object.values(byesByRound).flatMap(teamSchedule => teamSchedule[i] || [])
      : byesByRound[startRound + i] || [];
  }
  logPlayerSummary(players, newMatches, flatByesByRound);

  return newMatches;
}
