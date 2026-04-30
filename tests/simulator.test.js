import test from "node:test";
import assert from "node:assert/strict";

import {
  ROUND_MULTIPLIERS,
  STRATEGIES,
  anyStrategyIsStochastic,
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
});
