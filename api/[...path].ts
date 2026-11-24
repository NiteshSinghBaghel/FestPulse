import type { IncomingMessage, ServerResponse } from 'node:http';
import { apiMiddleware } from '../src/server/apiPlugin';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  await apiMiddleware(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'API endpoint not found.' }));
  });
}
