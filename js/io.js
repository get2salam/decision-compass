import { actions, getState } from "./store.js";

export const SCHEMA = "decision-compass/v1";

export function exportMatrix() {
  const payload = {
    schema: SCHEMA,
    exportedAt: new Date().toISOString(),
    ...getState(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `decision-compass-${new Date().toISOString().slice(0, 10)}.json`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("That file is not a Decision Compass backup.");
  }
  if (parsed.schema !== SCHEMA) {
    throw new Error("That file is not a Decision Compass backup.");
  }
  return parsed;
}

export async function importMatrixFile(file) {
  const text = await file.text();
  actions.replaceAll(parseBackup(text));
}
