import { exportMatrix } from "./io.js";
import { actions } from "./store.js";
import { showToast } from "./feedback.js";

let mounted = false;
let helpDialog;

function buildHelpDialog() {
  if (helpDialog) return helpDialog;
  helpDialog = document.createElement("dialog");
  helpDialog.className = "shortcut-dialog";
  helpDialog.setAttribute("aria-labelledby", "shortcut-dialog-title");
  helpDialog.innerHTML = `
    <form method="dialog" class="shortcut-sheet card">
      <div class="panel-head">
        <div>
          <h2 id="shortcut-dialog-title">Keyboard shortcuts</h2>
          <p>Keep the decision flow moving.</p>
        </div>
        <button class="icon-btn" value="close" aria-label="Close shortcuts">✕</button>
      </div>
      <div class="shortcut-list">
        <div><kbd>N</kbd><span>New decision</span></div>
        <div><kbd>C</kbd><span>Add criterion</span></div>
        <div><kbd>O</kbd><span>Add option</span></div>
        <div><kbd>E</kbd><span>Export backup</span></div>
        <div><kbd>I</kbd><span>Import backup</span></div>
        <div><kbd>?</kbd><span>Show this help</span></div>
      </div>
    </form>
  `;
  helpDialog.addEventListener("click", (event) => {
    if (event.target === helpDialog) helpDialog.close();
  });
  document.body.appendChild(helpDialog);
  return helpDialog;
}

export function showShortcutHelp() {
  buildHelpDialog().showModal();
}

function typingTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select"));
}

export function mountShortcuts() {
  if (mounted) return;
  mounted = true;

  document.addEventListener("keydown", (event) => {
    if (typingTarget(event.target)) return;

    const key = event.key.toLowerCase();
    if (key === "n") {
      event.preventDefault();
      actions.setDecisionMeta({
        decisionTitle: "My next decision",
        note: "Define the tradeoffs, then score each path honestly.",
      });
      showToast("Started a fresh decision.", "success");
    } else if (key === "c") {
      event.preventDefault();
      actions.addCriterion({ label: `Criterion ${document.querySelectorAll("[data-field='criterion-label']").length + 1}`, weight: 5 });
      showToast("Added a new criterion.", "success");
    } else if (key === "o") {
      event.preventDefault();
      actions.addOption({ name: `Option ${document.querySelectorAll("[data-field='option-name']").length + 1}` });
      showToast("Added a new option.", "success");
    } else if (key === "e") {
      event.preventDefault();
      exportMatrix();
      showToast("Downloaded a backup.", "success");
    } else if (key === "i") {
      event.preventDefault();
      document.querySelector("#import-file")?.click();
    } else if (key === "?") {
      event.preventDefault();
      showShortcutHelp();
    }
  });
}
