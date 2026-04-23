import { initStore, subscribe } from "./store.js";
import { seedDecision } from "./seeds.js";
import { mountShortcuts } from "./shortcuts.js";
import { bindUi, renderApp } from "./ui.js";

bindUi();
mountShortcuts();
subscribe(renderApp);
initStore({ seed: seedDecision });
