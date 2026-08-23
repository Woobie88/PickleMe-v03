/**
 * ============================================================
 * PLAYOFFS: 1 & 2 ROUND ENGINE
 *
 * 1 round (Final only): players grouped into courts by standings
 * rank (Court 1 = top ranks), DUPR-balanced 2v2 within each
 * group. Leftover players who don't fill a complete court of 4
 * are eliminated.
 *
 * 2 rounds (Elimination Final + Final): same rank-based grouping
 * for EF. Two DIFFERENT advancement rules depending on whether
 * byes exist:
 *   - No byes (groups divide evenly by 4): winning/losing DOUBLES
 *     TEAMS advance/drop intact — Final Court 1 = EF winners from
 *     both courts, Final Court 2 = EF losers from both courts.
 *   - Byes exist (uneven groups): individual players are re-ranked
 *     within their own EF court after results, using updated
 *     ladder points. Each court keeps its bye + as many top-ranked
 *     EF players as fit; leftover drops to the court below (or is
 *     eliminated if it's the bottom court).
 *
 * Verified against 2 EF-court examples (8 players/no-bye and
 * 10 players/with-bye). NOT yet verified for 3+ EF courts.
 * ============================================================
 */

function getStandingsRankedPlayers(payload) {
  const activeEventId = payload.activeEventId;
  const activeEvent = payload.events.find(e => String(e.EventID) === String(activeEventId));
  const matches = payload.draw || [];
  const players = payload.players.filter(p => String(p.PlayerVersion) === String(activeEvent.CurrentPlayerVersion) && p.playerExclude !== 'Yes');
  const ladderScoringMode = activeEvent.LadderScoring || 'Margin';

  const standings = players.map(player => {
    const stats = calculatePlayerStats(player.PlayerID, matches);
    const points = calculateLadderPoints(stats, ladderScoringMode);
    return { player, points };
  });

  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (parseFloat(b.player.DUPR) || 0) - (parseFloat(a.player.DUPR) || 0);
  });

  return standings.map(s => s.player);
}

function bestBalancedPairing(fourPlayers) {
  const [a, b, c, d] = fourPlayers;
  const options = [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] }
  ];
  let best = options[0], bestGap = Infinity;
  options.forEach(opt => {
    const gap = Math.abs(teamAvgDupr(opt.teamA) - teamAvgDupr(opt.teamB));
    if (gap < bestGap) { bestGap = gap; best = opt; }
  });
  return best;
}

// ---------- 1 ROUND: FINAL ONLY ----------

function generatePlayoffFinalRound(payload, roundNumber, eventId, drawVersion, userEmail) {
  const rankedPlayers = getStandingsRankedPlayers(payload);
  const courtsCount = Math.ceil(rankedPlayers.length / 4);

  const matches = [];
  for (let c = 0; c < courtsCount; c++) {
    const courtPlayers = rankedPlayers.slice(c * 4, c * 4 + 4);
    if (courtPlayers.length < 4) {
      console.log(`Eliminated (insufficient players for a full court): ${courtPlayers.map(p => p.PlayerID).join(', ')}`);
      break;
    }

    const courtNumber = c + 1;
    const pairing = bestBalancedPairing(courtPlayers);
    matches.push(buildMatchRecord(
      { teamA: pairing.teamA, teamB: pairing.teamB, court: courtNumber },
      0, roundNumber, eventId, drawVersion, userEmail
    ));
  }

  return matches;
}

// ---------- 2 ROUNDS: ELIMINATION FINAL + FINAL ----------

function computePlayoffGroups(rankedPlayers, courtsCount) {
  const n = rankedPlayers.length;
  const base = Math.floor(n / courtsCount);
  const remainder = n % courtsCount;
  const groupSizes = Array.from({ length: courtsCount }, (_, i) => base + (i < remainder ? 1 : 0));

  const groups = [];
  let cursor = 0;
  groupSizes.forEach(size => {
    const group = rankedPlayers.slice(cursor, cursor + size);
    cursor += size;
    const byeCount = Math.max(0, group.length - 4);
    const byes = group.slice(0, byeCount);
    const efPlayers = group.slice(byeCount);
    groups.push({ byes, efPlayers });
  });

  return groups;
}

function generatePlayoffEliminationRound(payload, roundNumber, eventId, drawVersion, userEmail) {
  const rankedPlayers = getStandingsRankedPlayers(payload);
  const courtsCount = Math.min(
    parseInt(payload.events.find(e => String(e.EventID) === String(payload.activeEventId)).NumberofCourts) || 1,
    Math.ceil(rankedPlayers.length / 4)
  );

  const groups = computePlayoffGroups(rankedPlayers, courtsCount);
  window.playoffGroupsCache = groups; // needed by the Final-round generator afterward

  const matches = [];
  groups.forEach((group, idx) => {
    if (group.efPlayers.length < 4) return; // shouldn't happen given computePlayoffGroups' logic, safety check
    const courtNumber = idx + 1;
    const pairing = bestBalancedPairing(group.efPlayers);
    matches.push(buildMatchRecord(
      { teamA: pairing.teamA, teamB: pairing.teamB, court: courtNumber },
      0, roundNumber, eventId, drawVersion, userEmail
    ));
  });

  return matches;
}

function generatePlayoffFinalAfterElimination(payload, efMatches, roundNumber, eventId, drawVersion, userEmail) {
  const groups = window.playoffGroupsCache;
  if (!groups) {
    console.error("No cached EF groups found — cannot build Final round.");
    return [];
  }

  const hasAnyByes = groups.some(g => g.byes.length > 0);

  let finalGroups;

  if (!hasAnyByes) {
    // TEAM-INTACT MERGE: only verified for exactly 2 EF courts
    if (groups.length !== 2) {
      console.warn("Team-intact merge only verified for 2 EF courts — proceeding with best-effort logic for other counts.");
    }
    const efResults = efMatches.map(m => {
      const winners = m.Team1WinLoss === 'Win' ? [m.Team1Player1, m.Team1Player2] : [m.Team2Player1, m.Team2Player2];
      const losers = m.Team1WinLoss === 'Loss' ? [m.Team1Player1, m.Team1Player2] : [m.Team2Player1, m.Team2Player2];
      return { winners, losers };
    });

    finalGroups = [
      [...efResults[0].winners, ...efResults[1].winners],
      [...efResults[0].losers, ...efResults[1].losers]
    ];

  } else {
    // INDIVIDUAL-RANKING CASCADE: only verified for exactly 2 EF courts
    const postEfRanks = groups.map((group, idx) => {
      const courtEfPlayerIds = group.efPlayers.map(p => p.PlayerID);
      const rankedWithinCourt = courtEfPlayerIds
        .map(pid => {
          const stats = calculatePlayerStats(pid, efMatches);
          const activeEvent = payload.events.find(e => String(e.EventID) === String(payload.activeEventId));
          const points = calculateLadderPoints(stats, activeEvent.LadderScoring || 'Margin');
          return { pid, points };
        })
        .sort((a, b) => b.points - a.points)
        .map(r => r.pid);
      return rankedWithinCourt;
    });

    const finalGroupsIds = groups.map(g => [...g.byes.map(p => p.PlayerID)]);
    let incoming = [];

    for (let c = 0; c < groups.length; c++) {
      const isLast = c === groups.length - 1;
      const ranked = [...postEfRanks[c]];

      finalGroupsIds[c].push(...incoming);

      const slotsAvailable = 4 - finalGroupsIds[c].length;
      const keepCount = Math.min(slotsAvailable, ranked.length);
      const kept = ranked.slice(0, keepCount);
      finalGroupsIds[c].push(...kept);

      incoming = isLast ? [] : ranked.slice(keepCount);
    }

    finalGroups = finalGroupsIds;
  }

  const allPlayersById = {};
  payload.players.forEach(p => { allPlayersById[p.PlayerID] = p; });

  const matches = [];
  finalGroups.forEach((groupIds, idx) => {
    if (groupIds.length < 4) return;
    const courtNumber = idx + 1;
    const groupPlayers = groupIds.map(pid => allPlayersById[pid]);
    const pairing = bestBalancedPairing(groupPlayers);
    matches.push(buildMatchRecord(
      { teamA: pairing.teamA, teamB: pairing.teamB, court: courtNumber },
      0, roundNumber, eventId, drawVersion, userEmail
    ));
  });

  return matches;
}

async function handlePlayoffFinalAdvance() {
  const activeEventId = window.cachedUserUniverse.activeEventId;
  const activeEvent = window.cachedUserUniverse.events.find(e => String(e.EventID) === String(activeEventId));
  const payload = window.cachedUserUniverse;
  const drawVersion = activeEvent.CurrentDrawVersion;
  const userEmail = window.currentUserEmail;

  const efRound = activeEvent.PlayoffEFRound;
  const finalRound = activeEvent.PlayoffFinalRound;

  const efMatches = (payload.draw || []).filter(m => parseInt(m.Round) === efRound);

  if (!isRoundComplete(payload.draw, efRound)) {
    alert("Enter results for every Elimination Final match before advancing to the Final.");
    return false;
  }

  const newMatches = generatePlayoffFinalAfterElimination(payload, efMatches, finalRound, activeEventId, drawVersion, userEmail);

  if (!newMatches || newMatches.length === 0) {
    console.error("Failed to generate Final round matches.");
    alert("Could not generate the Final round — check the console for details.");
    return false;
  }

  try {
    await window.saveGeneratedDrawToFirestore(newMatches);
    window.cachedUserUniverse.draw = [...(payload.draw || []), ...newMatches];
    console.log(`Playoffs Final generated (Round ${finalRound}): ${newMatches.length} match(es).`);
    return true;
  } catch (err) {
    console.error("Failed to save Final round matches:", err);
    alert("Failed to save the Final round — check the console for details.");
    return false;
  }
}