import { createServer } from 'node:http';
import { handleChat } from './chat-handler.js';

const port = Number(process.env.AGENT_PORT ?? 4111);
const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') {
    void handleChat(req, res);
    return;
  }
  res.writeHead(404).end('Not found');
});

server.listen(port, () => {
  console.log(`LangChain agent listening on http://localhost:${port}`);
});
