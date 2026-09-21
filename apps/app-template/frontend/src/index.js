// Minimal static server placeholder for the app-template frontend.
// Replace this file with your real UI (React/Vue/whatever your app uses).

import http from "node:http";

const PORT = process.env.PORT || 5173;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("app-template frontend is running\n");
});

server.listen(PORT, () => {
  console.log(`app-template frontend listening on http://localhost:${PORT}`);
});