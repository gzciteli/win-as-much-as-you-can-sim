export const SEATS = ["A", "B", "C", "D"];

export const ROUND_MULTIPLIERS = [1, 1, 1, 1, 3, 1, 1, 5, 1, 10];

const PAYOFF_BY_X_COUNT = {
  0: { X: 0, Y: 1 },
  1: { X: 3, Y: -1 },
  2: { X: 2, Y: -2 },
  3: { X: 1, Y: -3 },
  4: { X: -1, Y: 0 }
};

export const STRATEGIES = {
  always_x: {
    id: "always_x",
    label: "always_x",
    description: "Always plays X in every round.",
    isStochastic: false,
    decide: () => "X"
  },
  always_y: {
    id: "always_y",
    label: "always_y",
    description: "Always plays Y in every round.",
    isStochastic: false,
    decide: () => "Y"
  },
  cooperative_tit_for_tat: {
    id: "cooperative_tit_for_tat",
    label: "cooperative_tit_for_tat",
    description:
      "Starts with Y, then copies the majority choice made by the other three seats in the previous round.",
    isStochastic: false,
    decide: (gameState) => {
      const previousRound = getPreviousRound(gameState);
      if (!previousRound) {
        return "Y";
      }

      return majorityChoiceOfOtherSeats(gameState.actingSeat, previousRound);
    }
  },
  tit_for_tat_harsh: {
    id: "tit_for_tat_harsh",
    label: "tit_for_tat_harsh",
    description:
      "Starts with Y, then plays X if any other seat played X in the previous round; otherwise plays Y.",
    isStochastic: false,
    decide: (gameState) => {
      const previousRound = getPreviousRound(gameState);
      if (!previousRound) {
        return "Y";
      }

      return otherSeatsPlayedChoice(gameState.actingSeat, previousRound, "X") ? "X" : "Y";
    }
  },
  endgame_defector: {
    id: "endgame_defector",
    label: "endgame_defector",
    description: "Plays Y through round 7, then switches to X for rounds 8, 9, and 10.",
    isStochastic: false,
    decide: (gameState) => (gameState.roundNumber >= 8 ? "X" : "Y")
  },
  behind_switch_x: {
    id: "behind_switch_x",
    label: "behind_switch_x",
    description:
      "Plays Y when tied for first or ahead, but switches to X whenever it is behind the current leader on cumulative score.",
    isStochastic: false,
    decide: (gameState) => {
      const currentScore = gameState.cumulativeScoresBySeat[gameState.actingSeat];
      const topScore = Math.max(...Object.values(gameState.cumulativeScoresBySeat));

      return currentScore < topScore ? "X" : "Y";
    }
  },
  grim_trigger: {
    id: "grim_trigger",
    label: "grim_trigger",
    description:
      "Starts with Y; once any other seat has ever played X, it plays X for the rest of the game.",
    isStochastic: false,
    decide: (gameState) => {
      const triggered = gameState.roundHistory.some((round) =>
        otherSeatsPlayedChoice(gameState.actingSeat, round, "X")
      );

      return triggered ? "X" : "Y";
    }
  },
  random: {
    id: "random",
    label: "random",
    description: "Randomly chooses X or Y each round with a 50/50 split.",
    isStochastic: true,
    decide: (_gameState, random = Math.random) => (random() < 0.5 ? "X" : "Y")
  }
};

export function getStrategyList() {
  return Object.values(STRATEGIES).map(({ id, label, description, isStochastic }) => ({
    id,
    label,
    description,
    isStochastic
  }));
}

export function resolveRoundPayoffs(choicesBySeat, multiplier = 1) {
  const choiceEntries = Object.entries(choicesBySeat);
  const xCount = choiceEntries.filter(([, choice]) => choice === "X").length;
  const payoffs = {};

  for (const [seat, choice] of choiceEntries) {
    const base = PAYOFF_BY_X_COUNT[xCount][choice];
    payoffs[seat] = base * multiplier;
  }

  return payoffs;
}

export function simulateGame(strategyIdsBySeat, options = {}) {
  const random = options.random ?? Math.random;
  const history = [];
  const cumulativeScores = Object.fromEntries(SEATS.map((seat) => [seat, 0]));

  ROUND_MULTIPLIERS.forEach((multiplier, index) => {
    const roundNumber = index + 1;
    const choicesBySeat = {};

    for (const seat of SEATS) {
      const strategyId = strategyIdsBySeat[seat];
      const strategy = STRATEGIES[strategyId];

      if (!strategy) {
        throw new Error(`Unknown strategy for seat ${seat}: ${strategyId}`);
      }

      const gameState = {
        roundNumber,
        actingSeat: seat,
        seats: [...SEATS],
        roundHistory: history.map((round) => ({
          roundNumber: round.roundNumber,
          multiplier: round.multiplier,
          choicesBySeat: { ...round.choicesBySeat },
          payoffsBySeat: { ...round.payoffsBySeat },
          cumulativeScoresBySeat: { ...round.cumulativeScoresBySeat }
        })),
        cumulativeScoresBySeat: { ...cumulativeScores }
      };

      choicesBySeat[seat] = strategy.decide(gameState, random);
    }

    const payoffsBySeat = resolveRoundPayoffs(choicesBySeat, multiplier);

    for (const seat of SEATS) {
      cumulativeScores[seat] += payoffsBySeat[seat];
    }

    history.push({
      roundNumber,
      multiplier,
      choicesBySeat,
      payoffsBySeat,
      cumulativeScoresBySeat: { ...cumulativeScores }
    });
  });

  return {
    rounds: history,
    finalScores: { ...cumulativeScores }
  };
}

export function simulateTrials(strategyIdsBySeat, trialCount, options = {}) {
  const count = Math.max(1, Math.floor(trialCount));
  const runs = [];

  for (let trialIndex = 0; trialIndex < count; trialIndex += 1) {
    runs.push(simulateGame(strategyIdsBySeat, options));
  }

  return {
    representativeRun: runs[0],
    summaryBySeat: summarizeRuns(runs),
    runs
  };
}

export function summarizeRuns(runs) {
  const winsBySeat = countWinsBySeat(runs);

  return Object.fromEntries(
    SEATS.map((seat) => {
      const scores = runs
        .map((run) => run.finalScores[seat])
        .sort((left, right) => left - right);
      const sum = scores.reduce((total, score) => total + score, 0);

      return [
        seat,
        {
          mean: sum / scores.length,
          median: median(scores),
          min: scores[0],
          max: scores[scores.length - 1],
          wins: winsBySeat[seat]
        }
      ];
    })
  );
}

export function anyStrategyIsStochastic(strategyIdsBySeat) {
  return Object.values(strategyIdsBySeat).some(
    (strategyId) => STRATEGIES[strategyId]?.isStochastic
  );
}

function getPreviousRound(gameState) {
  return gameState.roundHistory[gameState.roundHistory.length - 1];
}

function majorityChoiceOfOtherSeats(actingSeat, round) {
  const otherChoices = SEATS.filter((seat) => seat !== actingSeat).map(
    (seat) => round.choicesBySeat[seat]
  );
  const xCount = otherChoices.filter((choice) => choice === "X").length;
  return xCount >= 2 ? "X" : "Y";
}

function otherSeatsPlayedChoice(actingSeat, round, choiceToFind) {
  return SEATS.some(
    (seat) => seat !== actingSeat && round.choicesBySeat[seat] === choiceToFind
  );
}

function median(sortedValues) {
  const middle = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (sortedValues[middle - 1] + sortedValues[middle]) / 2;
  }

  return sortedValues[middle];
}

function countWinsBySeat(runs) {
  const winsBySeat = Object.fromEntries(SEATS.map((seat) => [seat, 0]));

  for (const run of runs) {
    const topScore = Math.max(...SEATS.map((seat) => run.finalScores[seat]));

    for (const seat of SEATS) {
      if (run.finalScores[seat] === topScore) {
        winsBySeat[seat] += 1;
      }
    }
  }

  return winsBySeat;
}
