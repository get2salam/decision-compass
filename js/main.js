import { initStore, subscribe } from "./store.js";
import { bindUi, renderApp } from "./ui.js";

bindUi();
subscribe(renderApp);
initStore();
