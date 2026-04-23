import { initStore, subscribe } from "./store.js";
import { seedDecision } from "./seeds.js";
import { bindUi, renderApp } from "./ui.js";

bindUi();
subscribe(renderApp);
initStore({ seed: seedDecision });
