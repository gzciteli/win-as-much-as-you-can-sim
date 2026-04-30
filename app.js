import {
  ROUND_MULTIPLIERS,
  SEATS,
  STRATEGIES,
  anyStrategyIsStochastic,
  getStrategyList,
  simulateGame,
  simulateTrials
} from "./simulator.js";

const seatInputs = Object.fromEntries(
  SEATS.map((seat) => [seat, document.querySelector(`#seat-${seat}`)])
);
const trialsControl = document.querySelector("#trials-control");
const trialsInput = document.querySelector("#trials");
const runButton = document.querySelector("#run-simulation");
const resultsBody = document.querySelector("#results-body");
const statsPanel = document.querySelector("#stats-panel");
const statsBody = document.querySelector("#stats-body");
const validationMessage = document.querySelector("#validation-message");
const runStatus = document.querySelector("#run-status");
let runStatusTimer = null;

seedStrategyOptions();
wireEvents();
runSimulation();

function seedStrategyOptions() {
  const optionsMarkup = getStrategyList()
    .map((strategy) => `<option value="${strategy.id}">${strategy.id}</option>`)
    .join("");

  for (const [seat, input] of Object.entries(seatInputs)) {
    input.innerHTML = optionsMarkup;
    input.value = defaultStrategyForSeat(seat);
  }
}

function wireEvents() {
  for (const input of Object.values(seatInputs)) {
    input.addEventListener("change", updateTrialsVisibility);
  }

  runButton.addEventListener("click", () => {
    runSimulation();
  });
  updateTrialsVisibility();
}

function updateTrialsVisibility() {
  const strategyIdsBySeat = readStrategySelection();
  const shouldShowTrials = anyStrategyIsStochastic(strategyIdsBySeat);
  trialsControl.hidden = !shouldShowTrials;
}

async function runSimulation() {
  const strategyIdsBySeat = readStrategySelection();
  const invalidSeat = SEATS.find((seat) => !STRATEGIES[strategyIdsBySeat[seat]]);

  if (invalidSeat) {
    validationMessage.textContent = `Seat ${invalidSeat} must use one of the listed strategies.`;
    return;
  }

  validationMessage.textContent = "";

  const stochastic = anyStrategyIsStochastic(strategyIdsBySeat);
  const requestedTrials = normalizeTrialCount(trialsInput.value);
  const effectiveTrials = stochastic ? requestedTrials : 1;

  setRunStatus("Running...", "running");
  runButton.disabled = true;
  await nextPaint();

  try {
    if (stochastic) {
      const trialSet = simulateTrials(strategyIdsBySeat, effectiveTrials);
      renderResultsTable(trialSet.representativeRun);
      renderStats(trialSet.summaryBySeat, effectiveTrials);
      showCompletionStatus(`Simulation complete: ${effectiveTrials} trials.`);
      return;
    }

    const run = simulateGame(strategyIdsBySeat);
    renderResultsTable(run);
    hideStats();
    showCompletionStatus("Simulation complete.");
  } finally {
    runButton.disabled = false;
  }
}

function readStrategySelection() {
  return Object.fromEntries(
    SEATS.map((seat) => [seat, seatInputs[seat].value])
  );
}

function normalizeTrialCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function renderResultsTable(run) {
  resultsBody.innerHTML = run.rounds
    .map((round) => {
      const roundBadge =
        round.multiplier > 1 ? `<small>bonus x${round.multiplier}</small>` : "<small>standard</small>";

      const seatCells = SEATS.map((seat, seatIndex) => {
        const seatClass = seatIndex === 0 ? ' class="seat-a-cell"' : "";
        return `<td${seatClass}><span class="cell-choice">${round.choicesBySeat[seat]}</span> <span class="cell-score">${formatScore(
          round.payoffsBySeat[seat]
        )} (${formatScore(round.cumulativeScoresBySeat[seat])})</span></td>`;
      }).join("");

      return `<tr>
        <td class="round-label">Round ${round.roundNumber}${roundBadge}</td>
        ${seatCells}
      </tr>`;
    })
    .join("");
}

function renderStats(summaryBySeat, trialCount) {
  statsPanel.hidden = trialCount <= 1;

  if (trialCount <= 1) {
    return;
  }

  statsBody.innerHTML = SEATS.map((seat) => {
    const summary = summaryBySeat[seat];
    return `<tr>
      <td>Seat ${seat}</td>
      <td>${formatNumber(summary.mean)}</td>
      <td>${formatNumber(summary.median)}</td>
      <td>${formatScore(summary.min)}</td>
      <td>${formatScore(summary.max)}</td>
      <td>${summary.wins}</td>
    </tr>`;
  }).join("");
}

function hideStats() {
  statsPanel.hidden = true;
  statsBody.innerHTML = "";
}

function formatScore(value) {
  return `${value}`;
}

function formatNumber(value) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function setRunStatus(message, mode) {
  clearTimeout(runStatusTimer);
  runStatusTimer = null;
  runStatus.textContent = message;
  runStatus.hidden = false;
  runStatus.classList.add("visible");
  runStatus.classList.toggle("success", mode === "success");
}

function showCompletionStatus(message) {
  setRunStatus(message, "success");
  runStatusTimer = setTimeout(() => {
    runStatus.classList.remove("visible");
    setTimeout(() => {
      runStatus.hidden = true;
      runStatus.classList.remove("success");
    }, 180);
  }, 2500);
}

function nextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

function defaultStrategyForSeat(seat) {
  if (seat === "A") {
    return "always_x";
  }

  if (seat === "C") {
    return "random";
  }

  return "always_y";
}
