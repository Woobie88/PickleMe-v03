/**
 * ============================================================
 * CIRCLE DRAW GENERATOR FOR FIXED TEAMS
 * Fixed teams (from players.Team, 2 or 4 players per team).
 * Uses the circle method to guarantee every team plays every
 * other team exactly once, with automatic bye handling for
 * odd team counts. DUPR calculations average across all
 * players on each team, regardless of team size.
 * ============================================================
 */

// ---------- FIXED TEAM ASSIGNMENT (from players.Team) ----------

function assignDoublesProPartnerships(players) {
  const teams = {};
  players.forEach(p => {
    const t = p.Team;
    if (!teams[t]) teams[t] = [];
    teams[t].push(p);
  });

  const teamKeys = Object.keys(teams).sort((a, b) => parseInt(a) - parseInt(b));

  return teamKeys.map(teamKey => teams[teamKey]); // array of arrays — each inner array = all players on that team
}

// ---------- CIRCLE METHOD SCHEDULER (guaranteed no-repeat opponents) ----------

function generateCircleMethodSchedule(teams) {
  const teamList = [...teams];
  const isOdd = teamList.length % 2 !== 0;

  if (isOdd) {
    teamList.push(null); // null = bye slot for this round
  }

  const n = teamList.length;
  const numberOfRounds = n - 1;
  const half = n / 2;

  const rounds = [];
  let arrangement = [...teamList];

  for (let round = 0; round < numberOfRounds; round++) {
    const roundMatchups = [];
    for (let i = 0; i < half; i++) {
      const teamA = arrangement[i];
      const teamB = arrangement[n - 1 - i];
      if (teamA !== null && teamB !== null) {
        roundMatchups.push({ teamA, teamB });
      }
      // if either is null, that team has a bye this round
    }
    rounds.push(roundMatchups);

    // Rotate — fix the first team in place, rotate everyone else
    const fixed = arrangement[0];
    const rest = arrangement.slice(1);
    rest.unshift(rest.pop());
    arrangement = [fixed, ...rest];
  }

  return rounds; // array of rounds, each an array of { teamA, teamB } matchups
}

// ---------- MATCH RECORD BUILDER (2 or 4 players per team, always populated) ----------

function buildDoublesProMatchRecord(m, roundNumber, eventId, drawVersion, userEmail) {
  const teamA = m.teamA;
  const teamB = m.teamB;

  const avg1 = teamAvgDupr(teamA); // averages across however many players are in the array
  const avg2 = teamAvgDupr(teamB);
  const winProb1 = calculateWinProbability(avg1, avg2);

  return {
    MatchID: generateMatchId(),
    EventID: eventId,
    Round: roundNumber,
    Court: m.court,
    DrawVersion: drawVersion,
    MatchType: "Round Robin",
    Team1: teamA[0].Team,
    Team2: teamB[0].Team,
    Team1Player1: teamA[0]?.PlayerID || null,
    Team1Player2: teamA[1]?.PlayerID || null,
    Team1Player3: teamA[2]?.PlayerID || null,
    Team1Player4: teamA[3]?.PlayerID || null,
    Team2Player1: teamB[0]?.PlayerID || null,
    Team2Player2: teamB[1]?.PlayerID || null,
    Team2Player3: teamB[2]?.PlayerID || null,
    Team2Player4: teamB[3]?.PlayerID || null,
    Team1AvgDUPR: avg1,
    Team2AvgDUPR: avg2,
    DUPRMatchDelta: Math.abs(avg1 - avg2),
    Team1WinProb: winProb1,
    Team2WinProb: 1 - winProb1,
    ExpectedTeam1Score: winProb1 >= 0.5 ? 11 : Math.round(winProb1 * 11 / (1 - winProb1)),
    ExpectedTeam2Score: winProb1 >= 0.5 ? Math.round((1 - winProb1) * 11 / winProb1) : 11,
    Team1Score: 0,
    Team2Score: 0,
    Team1WinLoss: '',
    Team2WinLoss: '',
    Active: 'Active',
    UserEmail: userEmail,
    Timestamp: new Date().toISOString()
  };
}

// ---------- DOUBLES PRO ENTRY POINT (with full court balancing) ----------

function generateDoublesProDraw(players, courtsCount, eventId, drawVersion, userEmail, numberOfRounds) {
  const teamGroups = assignDoublesProPartnerships(players);
  const oneCycle = generateCircleMethodSchedule(teamGroups); // one complete round-robin cycle

  const { courtCounts } = buildDrawHistory([]);
  const allMatches = [];

  let roundNumber = 1;

  while (roundNumber <= numberOfRounds) {
    // Cycle back to the start of oneCycle once we've used all of it
    const cycleIndex = (roundNumber - 1) % oneCycle.length;
    const roundMatchups = oneCycle[cycleIndex];

    const courtNumbers = Array.from({ length: courtsCount }, (_, i) => i + 1);
    const courted = assignCourts(roundMatchups, courtNumbers, courtCounts); // court balance considers ALL prior rounds, including earlier cycles

    const roundRecords = courted.map(m => buildDoublesProMatchRecord(m, roundNumber, eventId, drawVersion, userEmail));
    allMatches.push(...roundRecords);

    roundRecords.forEach(rec => {
      const allTeamPlayers = [
        rec.Team1Player1, rec.Team1Player2, rec.Team1Player3, rec.Team1Player4,
        rec.Team2Player1, rec.Team2Player2, rec.Team2Player3, rec.Team2Player4
      ].filter(pid => pid !== null);

      allTeamPlayers.forEach(pid => {
        if (!courtCounts[pid]) courtCounts[pid] = {};
        courtCounts[pid][rec.Court] = (courtCounts[pid][rec.Court] || 0) + 1;
      });
    });

    roundNumber++;
  }

  return allMatches;
}
