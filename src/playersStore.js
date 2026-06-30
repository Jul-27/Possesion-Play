// Lädt die große Spielerliste (players.js) lazy als eigenen Vite-Chunk.
// Gecacht: ein gemeinsamer Promise für alle Consumer.
let promise;
export function loadPlayers() {
  return (promise ||= import("./players.js").then((m) => m.PLAYERS));
}
