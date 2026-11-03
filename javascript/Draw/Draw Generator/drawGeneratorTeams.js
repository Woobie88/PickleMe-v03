/**
 * ============================================================
 * TEAMS DRAW ENGINE
 * For games where Team === "Yes" and Division === "No" (e.g.
 * the "teams" game type). Handles the 5 verified scenarios:
 * full round-robin (every active team plays every other team
 * simultaneously), standard pairing (each team plays one
 * opponent, extra courts double up), whole-team byes, and
 * individual within-team byes — reusing your existing verified
 * bye-rotation logic at whichever level applies each round.
 * ============================================================
 */

// var numberOfRounds = 10;
// var players = [[{name: "Emi Landan", team: 3, dupr: 2.919}],[{name: "Patrick Needham", team: 3, dupr: 3.027}],[{name: "Brett Collins", team: 2, dupr: 3.328}],[{name: "Anthony Vriens", team: 1, dupr: 3.85}],[{name: "Matt Featherstone", team: 1, dupr: 3.252}],[{name: "Fiona Boustred", team: 2, dupr: 2.879}],[{name: "Michael Watson", team: 2, dupr: 3.548}],[{name: "Keith Lund", team: 3, dupr: 3.541}],[{name: "Rod Kearns", team: 2, dupr: 3.106}],[{name: "Wendy Fitzgerald", team: 1, dupr: 3.17}],
// [{name: "Clarence Mok", team: 1, dupr: 3.178}],[{name: "Geoffrey Shuetrim", team: 3, dupr: 3.386}],[{name: "Jaew Senta", team: 3, dupr: 3.21}],[{name: "Liz Haywood", team: 2, dupr: 3.189}],[{name: "Sarah Gibson", team: 1, dupr: 2.069}]];
var teamByesPerRound = 1;
var byesByPlayer = 2;
var roundsBetweenByes = 3;

var repeatPenalty = 100;  // cost for repeating a partnership before all pairs have been used
var matchupPenalty = 100; // cost for repeating a pair-vs-pair matchUp before all have been played
var byesPenalty = 20;

// Search settings
var numberOfAttempts = 300;
var iterationsPerAttempt = 20000;
// var maxRunMs = 300000; // stop early to stay inside the Apps Script time limit

function generateTeamsRoundDraw(players, numberOfRounds, courtsCount, numberOfTeams, activeEventId, newDrawVersion, userEmail) {
  // Get the number of teams
  // const numberOfTeams = new Set(players.map(p => p[0].team)).size;
  console.log("The players are", players);

  // Determine each teams make up
  const teamMap = new Map();
  for (const p of players.flat()) {
    if (!teamMap.has(p.Team)) teamMap.set(p.Team, []);
    teamMap.get(p.Team).push(p);
  }
  const teamArrays = [...teamMap.values()];
  console.log("teamMap", teamArrays);

  // Draw setup
  var playersPerTeam = teamArrays[0].length;
  var pairsPerRound = (playersPerTeam - teamByesPerRound) / 2;
  var pairsPerTeam = playersPerTeam * (playersPerTeam - 1) / 2;
  var maxPairRepeats = Math.ceil(numberOfRounds * pairsPerRound / pairsPerTeam);
  var matchesPerRound = numberOfTeams * (numberOfTeams - 1) / 2;
  
  console.log("numberOfTeams", numberOfTeams,
  "team sizes", teamArrays.map(function(t) { return t.length; }),
  "playersPerTeam", playersPerTeam,
  "pairsPerRound", pairsPerRound);

  if (pairsPerRound !== numberOfTeams - 1) throw new Error("Each team needs " + (numberOfTeams - 1) + " pairs per round");
  if (matchesPerRound > courtsCount) throw new Error("Not enough courts");

  // schedule[t][r] = player order: first teamByesPerRound are byes, then consecutive pairs
  function buildInitialSchedule() {
    var sched = [];
    for (var t = 0; t < numberOfTeams; t++) {
      sched.push([]);
      for (var r = 0; r < numberOfRounds; r++) {
        var order = [];
        for (var p = 0; p < playersPerTeam; p++) order.push((p + r * teamByesPerRound) % playersPerTeam);
        // Rotate pair slots each time the pair cycle restarts, so matchUps differ on the second pass
          if (teamByesPerRound === 1 && playersPerTeam % 2 === 1 && pairsPerRound > 1) {
            var shift = Math.floor(r / playersPerTeam) % pairsPerRound;
            if (shift > 0) {
              var pairsPart = order.slice(teamByesPerRound);
              var rotated = pairsPart.slice(2 * shift).concat(pairsPart.slice(0, 2 * shift));
              order = order.slice(0, teamByesPerRound).concat(rotated);
            }
          }
        sched[t].push(order);
      }
    }
    return sched;
  }

  // Total DUPR of team t's pair in a given slot of round r
  function pairTotal(sched, t, r, slot) {
    var order = sched[t][r];
    var a = order[teamByesPerRound + 2 * slot];
    var b = order[teamByesPerRound + 2 * slot + 1];
    return teamArrays[t][a].dupr + teamArrays[t][b].dupr;
  }

  // Team i's slot against team j (i < j) is j - 1; team j's slot against i is i
  function scoreDraw(sched) {
    var cost = 0;
    var byeRounds = [];
    var seen = [], seenCount = [];
    for (var t = 0; t < numberOfTeams; t++) {
      byeRounds.push([]);
      for (var p = 0; p < playersPerTeam; p++) byeRounds[t].push([]);
      seen.push({}); seenCount.push(0);
    }

    // matchUp tracking per team fixture (i vs j)
    var matchSeen = {}, matchSeenCount = {};
    var matchupsPerFixture = pairsPerTeam * pairsPerTeam;

    function pairKey(t, r, slot) {
      var order = sched[t][r];
      var a = order[teamByesPerRound + 2 * slot];
      var c = order[teamByesPerRound + 2 * slot + 1];
      return Math.min(a, c) * playersPerTeam + Math.max(a, c);
    }

    for (var r = 0; r < numberOfRounds; r++) {
      // byes and partnership cycle
      for (var t = 0; t < numberOfTeams; t++) {
        var order = sched[t][r];
        for (var b = 0; b < teamByesPerRound; b++) byeRounds[t][order[b]].push(r);
        for (var k = 0; k < pairsPerRound; k++) {
          var key = pairKey(t, r, k);
          if (seen[t][key]) {
            cost += repeatPenalty;
          } else {
            seen[t][key] = true;
            seenCount[t]++;
          }
          if (seenCount[t] === pairsPerTeam) { seen[t] = {}; seenCount[t] = 0; }
        }
      }

      // DUPR balance and matchUp cycle
      for (var i = 0; i < numberOfTeams; i++) {
        for (var j = i + 1; j < numberOfTeams; j++) {
          var slotI = j - 1, slotJ = i;
          cost += Math.abs(pairTotal(sched, i, r, slotI) - pairTotal(sched, j, r, slotJ));

          var fixture = i * numberOfTeams + j;
          if (!matchSeen[fixture]) { matchSeen[fixture] = {}; matchSeenCount[fixture] = 0; }
          var mKey = pairKey(i, r, slotI) * playersPerTeam * playersPerTeam + pairKey(j, r, slotJ);
          if (matchSeen[fixture][mKey]) {
            cost += matchupPenalty;
          } else {
            matchSeen[fixture][mKey] = true;
            matchSeenCount[fixture]++;
          }
          if (matchSeenCount[fixture] === matchupsPerFixture) {
            matchSeen[fixture] = {}; matchSeenCount[fixture] = 0;
          }
        }
      }
    }

    for (var t = 0; t < numberOfTeams; t++) {
      for (var p = 0; p < playersPerTeam; p++) {
        var rounds = byeRounds[t][p];
        if (rounds.length > byesByPlayer) cost += (rounds.length - byesByPlayer) * byesPenalty;
        for (var q = 1; q < rounds.length; q++) {
          if (rounds[q] - rounds[q - 1] < roundsBetweenByes) cost += byesPenalty;
        }
      }
    }
    return cost;
  }

  // Multiple annealing attempts, keep the best draw
  var startTime = Date.now();
  var startTemp = 10;
  var bestCost = Infinity;
  var bestSchedule = null;
  var attemptsRun = 0;
  for (var attempt = 0; attempt < numberOfAttempts; attempt++) {
    // if (Date.now() - startTime > maxRunMs) break;
    var schedule = buildInitialSchedule();
    var currentCost = scoreDraw(schedule);
    var attemptBestCost = currentCost;
    var attemptBestSchedule = JSON.parse(JSON.stringify(schedule));
    for (var n = 0; n < iterationsPerAttempt; n++) {
      var temp = startTemp * (1 - n / iterationsPerAttempt) + 0.01;
      var t = Math.floor(Math.random() * numberOfTeams);
      var r = Math.floor(Math.random() * numberOfRounds);
      var a = Math.floor(Math.random() * playersPerTeam);
      var b = Math.floor(Math.random() * playersPerTeam);
      if (a === b) continue;
      var order = schedule[t][r];
      var tmp = order[a]; order[a] = order[b]; order[b] = tmp;
      var newCost = scoreDraw(schedule);
      if (newCost <= currentCost || Math.random() < Math.exp((currentCost - newCost) / temp)) {
        currentCost = newCost;
        if (currentCost < attemptBestCost) {
          attemptBestCost = currentCost;
          attemptBestSchedule = JSON.parse(JSON.stringify(schedule));
        }
      } else {
        tmp = order[a]; order[a] = order[b]; order[b] = tmp;
      }
    }
    attemptsRun++;
    if (attemptBestCost < bestCost) {
      bestCost = attemptBestCost;
      bestSchedule = attemptBestSchedule;
    }
  }

  // Build the draw
  var draw = [];
  var totalDelta = 0;
  for (var r = 0; r < numberOfRounds; r++) {
    var court = 1;
    var byes = [];
    for (var t = 0; t < numberOfTeams; t++) {
      for (var b = 0; b < teamByesPerRound; b++) byes.push(teamArrays[t][bestSchedule[t][r][b]].name);
    }
    for (var i = 0; i < numberOfTeams; i++) {
      for (var j = i + 1; j < numberOfTeams; j++) {
        var slotI = j - 1;
        var slotJ = i;
        var orderI = bestSchedule[i][r];
        var orderJ = bestSchedule[j][r];
        var totDUPRDelta = Math.round(Math.abs(pairTotal(bestSchedule, i, r, slotI) - pairTotal(bestSchedule, j, r, slotJ)) * 100) / 100;
        totalDelta += totDUPRDelta;
        draw.push({
          round: r + 1,
          court: court++,
          team1: teamArrays[i][0].team,
          player1: teamArrays[i][orderI[teamByesPerRound + 2 * slotI]].name,
          player2: teamArrays[i][orderI[teamByesPerRound + 2 * slotI + 1]].name,
          team2: teamArrays[j][0].team,
          player3: teamArrays[j][orderJ[teamByesPerRound + 2 * slotJ]].name,
          player4: teamArrays[j][orderJ[teamByesPerRound + 2 * slotJ + 1]].name,
          totDUPRDelta: totDUPRDelta,
          byes: byes.join(", ")
        });
      }
    }
  }

  // Player summary
  var playerSummary = [];
  var summaryByName = {};
  for (var t = 0; t < numberOfTeams; t++) {
    for (var p = 0; p < playersPerTeam; p++) {
      var summary = {
        name: teamArrays[t][p].name,
        team: teamArrays[t][p].team,
        gamesPlayed: 0,
        byes: 0,
        byeRounds: [],
        partners: {},
        opponents: {},
        totDeltaSum: 0
      };
      playerSummary.push(summary);
      summaryByName[summary.name] = summary;
    }
  }

  // Games, partners, opponents and deltas from each match
  for (var m = 0; m < draw.length; m++) {
    var match = draw[m];
    var sideA = [match.player1, match.player2];
    var sideB = [match.player3, match.player4];
    var sides = [[sideA, sideB], [sideB, sideA]];
    for (var s = 0; s < sides.length; s++) {
      var ownSide = sides[s][0];
      var oppSide = sides[s][1];
      for (var k = 0; k < ownSide.length; k++) {
        var playerStats = summaryByName[ownSide[k]];
        playerStats.gamesPlayed++;
        playerStats.totDeltaSum += match.totDUPRDelta;
        playerStats.partners[ownSide[1 - k]] = true;
        for (var o = 0; o < oppSide.length; o++) playerStats.opponents[oppSide[o]] = true;
      }
    }
  }

  // Byes (the same for every match in a round, so read the first match of each round)
  for (var r = 0; r < numberOfRounds; r++) {
    var roundByes = draw[r * matchesPerRound].byes.split(", ");
    for (var b = 0; b < roundByes.length; b++) {
      summaryByName[roundByes[b]].byes++;
      summaryByName[roundByes[b]].byeRounds.push(r + 1);
    }
  }

  // Final shape
  var playerSummaryOutput = playerSummary.map(function(ps) {
    return {
      name: ps.name,
      team: ps.team,
      gamesPlayed: ps.gamesPlayed,
      byes: ps.byes,
      byeRounds: ps.byeRounds.join(", "),
      uniquePartners: Object.keys(ps.partners).length,
      uniqueOpponents: Object.keys(ps.opponents).length,
      avgMatchUpDUPRDelta: Math.round(ps.totDeltaSum / ps.gamesPlayed * 100) / 100
    };
  });

  console.log("attemptsRun", attemptsRun, "bestCost", Math.round(bestCost * 100) / 100, "totalDelta", Math.round(totalDelta * 100) / 100);
  // console.log(JSON.stringify(draw));
  for (var i = 1; i <= numberOfRounds; i++) {
    console.log("---------ROUND ",i,"-----------");
    const roundResults = draw
        .filter(match => match.round === i)
        .sort((a, b) => a.court - b.court);

    roundResults.forEach(match => {
        console.log(
            `Court ${match.court}:`,
            `${match.team1}`,
            `${match.player1} / ${match.player2}`,
            "vs",
            `${match.team2}`,
            `${match.player3} / ${match.player4}`,
            `DUPR Gap: ${match.totDUPRDelta}`
        );
    });

  }
  // console.log(JSON.stringify(playerSummaryOutput));
  console.log("---------PLAYER STATS-----------")
  playerSummaryOutput.forEach(player => {
    console.log(
      `${player.name} | Team ${player.team} | ` +
      `Games: ${player.gamesPlayed} | ` +
      `Byes: ${player.byes} (${player.byeRounds}) | ` +
      `Partners: ${player.uniquePartners} | ` +
      `Opponents: ${player.uniqueOpponents} | ` +
      `Avg DUPR Delta: ${player.avgMatchUpDUPRDelta.toFixed(2)}`
    );
  });
  return {draw: draw, playerSummary: playerSummaryOutput};
}