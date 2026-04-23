import { exportMatrix, importMatrixFile } from "./io.js";
import { actions, selectConfidence, selectRankedOptions, selectStats } from "./store.js";

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function criterionRow(criterion) {
  return `
    <li class="stack-item">
      <div class="row-head">
        <strong>${esc(criterion.label)}</strong>
        <button class="icon-btn" data-action="remove-criterion" data-id="${criterion.id}" type="button">✕</button>
      </div>
      <div class="field-row">
        <label>
          <span>Label</span>
          <input type="text" value="${esc(criterion.label)}" data-field="criterion-label" data-id="${criterion.id}" />
        </label>
        <label>
          <span>Weight</span>
          <input type="range" min="1" max="10" value="${criterion.weight}" data-field="criterion-weight" data-id="${criterion.id}" />
        </label>
        <span class="pill">${criterion.weight}/10</span>
      </div>
    </li>
  `;
}

function scoreField(optionId, criterion, value) {
  return `
    <label>
      <span>${esc(criterion.label)}</span>
      <input type="number" min="0" max="10" step="1" value="${value}" data-field="score" data-option-id="${optionId}" data-criterion-id="${criterion.id}" />
    </label>
  `;
}

function optionCard(option, state) {
  const scoreMap = state.scores?.[option.id] || {};
  const avg = state.criteria.length
    ? Math.round((state.criteria.reduce((sum, criterion) => sum + Number(scoreMap[criterion.id] || 0), 0) / state.criteria.length) * 10) / 10
    : 0;

  return `
    <li class="stack-item option-card">
      <div class="row-head">
        <strong>${esc(option.name)}</strong>
        <button class="icon-btn" data-action="remove-option" data-id="${option.id}" type="button">✕</button>
      </div>
      <div class="field-row option-meta">
        <label>
          <span>Name</span>
          <input type="text" value="${esc(option.name)}" data-field="option-name" data-id="${option.id}" />
        </label>
        <label class="option-note">
          <span>Notes</span>
          <textarea rows="2" data-field="option-note" data-id="${option.id}">${esc(option.note || "")}</textarea>
        </label>
        <span class="pill">Avg ${avg}/10</span>
      </div>
      <div class="score-grid">
        ${state.criteria.length ? state.criteria.map((criterion) => scoreField(option.id, criterion, Number(scoreMap[criterion.id] || 0))).join("") : `<div class="empty-inline">Add criteria first, then score this option.</div>`}
      </div>
    </li>
  `;
}

function resultsBoard(ranked) {
  if (!ranked.length) {
    return `
      <article class="panel card placeholder compact">
        <div>
          <h2>Ranking board</h2>
          <p>Your weighted results will appear here as soon as you add options.</p>
        </div>
      </article>
    `;
  }

  return `
    <article class="panel card stack">
      <div class="panel-head">
        <div>
          <h2>Ranking board</h2>
          <p>Weighted totals update instantly as you score each option.</p>
        </div>
      </div>
      <div class="ranking-list">
        ${ranked.map((option, index) => `
          <div class="ranking-row ${index === 0 ? "ranking-top" : ""}">
            <div>
              <strong>${index + 1}. ${esc(option.name)}</strong>
              <p>${esc(option.note || "No notes yet.")}</p>
            </div>
            <div class="ranking-score">
              <strong>${Math.round(option.normalized)}%</strong>
              <span>${option.weightedScore.toFixed(1)} weighted points</span>
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

export function renderApp(state) {
  const stats = selectStats(state);
  const ranked = selectRankedOptions(state);
  const confidence = selectConfidence(state);
  const titleEl = document.querySelector("[data-role='decision-title']");
  const noteEl = document.querySelector("[data-role='decision-note']");
  const optionsEl = document.querySelector("[data-role='options-count']");
  const criteriaEl = document.querySelector("[data-role='criteria-count']");
  const confidenceEl = document.querySelector("[data-role='confidence-score']");
  const bestChoiceEl = document.querySelector("[data-role='best-choice']");
  const workspaceEl = document.querySelector("[data-role='workspace']");
  const resultsEl = document.querySelector("[data-role='results']");

  titleEl.textContent = state.decisionTitle;
  noteEl.textContent = state.note || "Score your options against the criteria that matter, then follow the strongest signal.";
  optionsEl.textContent = String(stats.options);
  criteriaEl.textContent = String(stats.criteria);
  confidenceEl.textContent = `${confidence}%`;
  bestChoiceEl.textContent = ranked[0]?.name || "—";

  workspaceEl.innerHTML = `
    <article class="panel card stack">
      <div class="panel-head">
        <div>
          <h2>Criteria</h2>
          <p>What matters most in this decision?</p>
        </div>
        <button class="btn btn-primary" type="button" data-action="add-criterion">Add criterion</button>
      </div>
      <ul class="stack-list">
        ${state.criteria.length ? state.criteria.map(criterionRow).join("") : `<li class="empty-state">No criteria yet. Add your first signal.</li>`}
      </ul>
    </article>
    <article class="panel card stack">
      <div class="panel-head">
        <div>
          <h2>Options</h2>
          <p>${ranked.length ? `Leading option: ${esc(ranked[0].name)}` : "Add a few paths and start scoring them."}</p>
        </div>
        <button class="btn btn-primary" type="button" data-action="add-option">Add option</button>
      </div>
      <ul class="stack-list">
        ${state.options.length ? state.options.map((option) => optionCard(option, state)).join("") : `<li class="empty-state">No options yet. Add at least two paths to compare.</li>`}
      </ul>
    </article>
  `;

  resultsEl.innerHTML = resultsBoard(ranked);
}

export function bindUi() {
  document.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    if (target.dataset.action === "new-decision") {
      actions.setDecisionMeta({
        decisionTitle: "My next decision",
        note: "Define the tradeoffs, then score each path honestly.",
      });
    }

    if (target.dataset.action === "export") {
      exportMatrix();
    }

    if (target.dataset.action === "import") {
      document.querySelector("#import-file")?.click();
    }

    if (target.dataset.action === "add-criterion") {
      actions.addCriterion({ label: `Criterion ${document.querySelectorAll("[data-field='criterion-label']").length + 1}`, weight: 5 });
    }

    if (target.dataset.action === "remove-criterion") {
      actions.removeCriterion(target.dataset.id);
    }

    if (target.dataset.action === "add-option") {
      actions.addOption({ name: `Option ${document.querySelectorAll("[data-field='option-name']").length + 1}` });
    }

    if (target.dataset.action === "remove-option") {
      actions.removeOption(target.dataset.id);
    }
  });

  document.addEventListener("input", async (event) => {
    const { field, id, optionId, criterionId } = event.target.dataset || {};
    if (!field) return;

    if (field === "criterion-label") {
      actions.updateCriterion(id, { label: event.target.value || "Untitled criterion" });
    }

    if (field === "criterion-weight") {
      actions.updateCriterion(id, { weight: Number(event.target.value) });
    }

    if (field === "option-name") {
      actions.updateOption(id, { name: event.target.value || "Untitled option" });
    }

    if (field === "option-note") {
      actions.updateOption(id, { note: event.target.value || "" });
    }

    if (field === "score") {
      actions.setScore(optionId, criterionId, event.target.value);
    }
  });

  document.addEventListener("change", async (event) => {
    if (event.target.id !== "import-file") return;
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importMatrixFile(file);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Import failed.");
    } finally {
      event.target.value = "";
    }
  });
}
