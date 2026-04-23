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
  link.click();
  URL.revokeObjectURL(url);
}

export async function importMatrixFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (parsed.schema !== SCHEMA) {
    throw new Error("That file is not a Decision Compass backup.");
  }
  actions.replaceAll(parsed);
}
