import { actions, initStore, selectStats, subscribe } from "./store.js";

const titleEl = document.querySelector("[data-role='decision-title']");
const noteEl = document.querySelector("[data-role='decision-note']");
const optionsEl = document.querySelector("[data-role='options-count']");
const criteriaEl = document.querySelector("[data-role='criteria-count']");
const workspaceEl = document.querySelector("[data-role='workspace']");
const newDecisionBtn = document.querySelector("[data-action='new-decision']");

function render(state) {
  const stats = selectStats(state);
  titleEl.textContent = state.decisionTitle;
  noteEl.textContent = state.note || "Score your options against the criteria that matter, then follow the strongest signal.";
  optionsEl.textContent = String(stats.options);
  criteriaEl.textContent = String(stats.criteria);
  workspaceEl.innerHTML = `
    <article class="panel card placeholder">
      <div>
        <h2>Criteria editor</h2>
        <p>${stats.criteria ? `You have ${stats.criteria} criteria ready.` : "Your criteria controls will land here next."}</p>
      </div>
    </article>
    <article class="panel card placeholder">
      <div>
        <h2>Ranking board</h2>
        <p>${stats.options ? `You have ${stats.options} options ready.` : "Option scoring and weighted totals are coming up."}</p>
      </div>
    </article>
  `;
}

newDecisionBtn?.addEventListener("click", () => {
  actions.setDecisionMeta({
    decisionTitle: "My next decision",
    note: "Start with the decision you want to compare.",
  });
  if (!document.querySelector("[data-seeded='true']")) {
    actions.addCriterion({ label: "Impact", weight: 8 });
    actions.addOption({ name: "Option A" });
    document.body.dataset.seeded = "true";
  }
});

subscribe(render);
initStore();
