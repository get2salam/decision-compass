import { actions, selectStats } from "./store.js";

function criterionRow(criterion) {
  return `
    <li class="stack-item">
      <div class="row-head">
        <strong>${criterion.label}</strong>
        <button class="icon-btn" data-action="remove-criterion" data-id="${criterion.id}" type="button">✕</button>
      </div>
      <div class="field-row">
        <label>
          <span>Label</span>
          <input type="text" value="${criterion.label}" data-field="criterion-label" data-id="${criterion.id}" />
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

export function renderApp(state) {
  const stats = selectStats(state);
  const titleEl = document.querySelector("[data-role='decision-title']");
  const noteEl = document.querySelector("[data-role='decision-note']");
  const optionsEl = document.querySelector("[data-role='options-count']");
  const criteriaEl = document.querySelector("[data-role='criteria-count']");
  const workspaceEl = document.querySelector("[data-role='workspace']");

  titleEl.textContent = state.decisionTitle;
  noteEl.textContent = state.note || "Score your options against the criteria that matter, then follow the strongest signal.";
  optionsEl.textContent = String(stats.options);
  criteriaEl.textContent = String(stats.criteria);

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
          <p>Your ranked choices will appear here next.</p>
        </div>
        <button class="btn" type="button" disabled>Add option</button>
      </div>
      <div class="placeholder compact">Option scoring lands in the next commit.</div>
    </article>
  `;
}

export function bindUi() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    if (target.dataset.action === "new-decision") {
      actions.setDecisionMeta({
        decisionTitle: "My next decision",
        note: "Define the tradeoffs, then score each path honestly.",
      });
    }

    if (target.dataset.action === "add-criterion") {
      actions.addCriterion({ label: `Criterion ${document.querySelectorAll("[data-field='criterion-label']").length + 1}`, weight: 5 });
    }

    if (target.dataset.action === "remove-criterion") {
      actions.removeCriterion(target.dataset.id);
    }
  });

  document.addEventListener("input", (event) => {
    const { field, id } = event.target.dataset || {};
    if (!field || !id) return;

    if (field === "criterion-label") {
      actions.updateCriterion(id, { label: event.target.value || "Untitled criterion" });
    }

    if (field === "criterion-weight") {
      actions.updateCriterion(id, { weight: Number(event.target.value) });
    }
  });
}
