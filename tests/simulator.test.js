import test from "node:test";
import assert from "node:assert/strict";

import {
  ROUND_MULTIPLIERS,
  STRATEGIES,
  anyStrategyIsStochastic,
  getStrategyList,
  resolveRoundPayoffs,
  simulateGame,
  simulateTrials
} from "../simulator.js";

test("payoff schedule matches all possible X counts", () => {
  assert.deepEqual(resolveRoundPayoffs({ A: "X", B: "X", C: "X", D: "X" }), {
    A: -1,
    B: -1,
    C: -1,
    D: -1
  });
  assert.deepEqual(resolveRoundPayoffs({ A: "X", B: "X", C: "X", D: "Y" }), {
    A: 1,
    B: 1,
    C: 1,
    D: -3
  });
  assert.deepEqual(resolveRoundPayoffs({ A: "X", B: "X", C: "Y", D: "Y" }), {
    A: 2,
    B: 2,
    C: -2,
    D: -2
  });
  assert.deepEqual(resolveRoundPayoffs({ A: "X", B: "Y", C: "Y", D: "Y" }), {
    A: 3,
    B: -1,
    C: -1,
    D: -1
  });
  assert.deepEqual(resolveRoundPayoffs({ A: "Y", B: "Y", C: "Y", D: "Y" }), {
    A: 1,
    B: 1,
    C: 1,
    D: 1
  });
});

test("bonus multipliers apply on rounds 5, 8, and 10", () => {
  assert.equal(ROUND_MULTIPLIERS[4], 3);
  assert.equal(ROUND_MULTIPLIERS[7], 5);
  assert.equal(ROUND_MULTIPLIERS[9], 10);

  const game = simulateGame({
    A: "always_x",
    B: "always_x",
    C: "always_x",
    D: "always_y"
  });

  assert.equal(game.rounds[4].payoffsBySeat.A, 3);
  assert.equal(game.rounds[4].payoffsBySeat.D, -9);
  assert.equal(game.rounds[7].payoffsBySeat.A, 5);
  assert.equal(game.rounds[7].payoffsBySeat.D, -15);
  assert.equal(game.rounds[9].payoffsBySeat.A, 10);
  assert.equal(game.rounds[9].payoffsBySeat.D, -30);
});

test("cumulative scores are tracked through all 10 rounds", () => {
  const game = simulateGame({
    A: "always_x",
    B: "always_x",
    C: "always_x",
    D: "always_y"
  });

  assert.equal(game.rounds.length, 10);
  assert.equal(game.finalScores.A, 25);
  assert.equal(game.finalScores.B, 25);
  assert.equal(game.finalScores.C, 25);
  assert.equal(game.finalScores.D, -75);
  assert.equal(game.rounds[9].cumulativeScoresBySeat.A, 25);
});

test("strategies only receive prior history, not current round choices", () => {
  const observedHistoryLengths = [];
  const observedRounds = [];

  STRATEGIES.history_probe = {
    id: "history_probe",
    label: "history_probe",
    isStochastic: false,
    decide: (gameState) => {
      observedHistoryLengths.push(gameState.roundHistory.length);
      observedRounds.push(gameState.roundNumber);
      assert.equal(
        gameState.roundHistory.some((round) => round.roundNumber === gameState.roundNumber),
        false
      );
      return "Y";
    }
  };

  try {
    simulateGame({
      A: "history_probe",
      B: "always_y",
      C: "always_y",
      D: "always_y"
    });
  } finally {
    delete STRATEGIES.history_probe;
  }

  assert.deepEqual(observedRounds, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(observedHistoryLengths, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("stochastic strategy detection works", () => {
  assert.equal(
    anyStrategyIsStochastic({
      A: "always_x",
      B: "always_y",
      C: "always_x",
      D: "always_y"
    }),
    false
  );

  assert.equal(
    anyStrategyIsStochastic({
      A: "always_x",
      B: "always_y",
      C: "random",
      D: "always_y"
    }),
    true
  );
});

test("strategy list includes plain-language descriptions", () => {
  const strategyList = getStrategyList();
  const cooperative = strategyList.find((strategy) => strategy.id === "cooperative_tit_for_tat");
  const random = strategyList.find((strategy) => strategy.id === "random");

  assert.equal(typeof cooperative?.description, "string");
  assert.equal(cooperative.description.includes("Starts with Y"), true);
  assert.equal(random.description, "Randomly chooses X or Y each round with a 50/50 split.");
});

test("cooperative_tit_for_tat starts with Y and follows the previous-round majority", () => {
  assert.equal(
    STRATEGIES.cooperative_tit_for_tat.decide({
      actingSeat: "A",
      roundHistory: []
    }),
    "Y"
  );

  assert.equal(
    STRATEGIES.cooperative_tit_for_tat.decide({
      actingSeat: "A",
      roundHistory: [
        {
          choicesBySeat: {
            A: "Y",
            B: "X",
            C: "X",
            D: "Y"
          }
        }
      ]
    }),
    "X"
  );

  assert.equal(
    STRATEGIES.cooperative_tit_for_tat.decide({
      actingSeat: "A",
      roundHistory: [
        {
          choicesBySeat: {
            A: "X",
            B: "Y",
            C: "Y",
            D: "X"
          }
        }
      ]
    }),
    "Y"
  );
});

test("tit_for_tat_harsh, grim_trigger, and endgame_defector follow their trigger rules", () => {
  assert.equal(
    STRATEGIES.tit_for_tat_harsh.decide({
      actingSeat: "A",
      roundHistory: []
    }),
    "Y"
  );

  assert.equal(
    STRATEGIES.tit_for_tat_harsh.decide({
      actingSeat: "A",
      roundHistory: [
        {
          choicesBySeat: {
            A: "Y",
            B: "Y",
            C: "X",
            D: "Y"
          }
        }
      ]
    }),
    "X"
  );

  assert.equal(
    STRATEGIES.grim_trigger.decide({
      actingSeat: "A",
      roundHistory: [
        {
          choicesBySeat: {
            A: "Y",
            B: "Y",
            C: "Y",
            D: "Y"
          }
        },
        {
          choicesBySeat: {
            A: "Y",
            B: "Y",
            C: "X",
            D: "Y"
          }
        }
      ]
    }),
    "X"
  );

  assert.equal(
    STRATEGIES.endgame_defector.decide({
      roundNumber: 7
    }),
    "Y"
  );

  assert.equal(
    STRATEGIES.endgame_defector.decide({
      roundNumber: 8
    }),
    "X"
  );
});

test("behind_switch_x defects only when behind the current leader", () => {
  assert.equal(
    STRATEGIES.behind_switch_x.decide({
      actingSeat: "A",
      cumulativeScoresBySeat: {
        A: 4,
        B: 4,
        C: 2,
        D: 1
      }
    }),
    "Y"
  );

  assert.equal(
    STRATEGIES.behind_switch_x.decide({
      actingSeat: "A",
      cumulativeScoresBySeat: {
        A: 3,
        B: 5,
        C: 3,
        D: 1
      }
    }),
    "X"
  );
});

test("trial summaries compute mean, median, min, and max", () => {
  const draws = [...Array(40).fill(0.1), ...Array(40).fill(0.9)];
  let index = 0;
  const random = () => {
    const draw = draws[index % draws.length];
    index += 1;
    return draw;
  };

  const trialSet = simulateTrials(
    {
      A: "random",
      B: "random",
      C: "random",
      D: "random"
    },
    2,
    { random }
  );

  assert.equal(trialSet.runs.length, 2);
  assert.equal(trialSet.summaryBySeat.A.mean, 0);
  assert.equal(trialSet.summaryBySeat.A.median, 0);
  assert.equal(trialSet.summaryBySeat.A.min, -25);
  assert.equal(trialSet.summaryBySeat.A.max, 25);
  assert.equal(trialSet.summaryBySeat.A.wins, 2);
  assert.equal(trialSet.summaryBySeat.B.wins, 2);
  assert.equal(trialSet.summaryBySeat.C.wins, 2);
  assert.equal(trialSet.summaryBySeat.D.wins, 2);
});
