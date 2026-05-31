import express from 'express';
import axios from 'axios';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Proxy endpoint to bypass CORS for image exports
  app.get('/api/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).send('URL query parameter is required');
    }

    try {
      console.log(`[Proxy] Fetching: ${url}`);
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      res.setHeader('Content-Type', String(response.headers['content-type'] || 'image/jpeg'));
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      response.data.pipe(res);
    } catch (error: any) {
      console.error(`[Proxy] Error fetching ${url}:`, error.message);
      res.status(500).send(`Failed to fetch image: ${error.message}`);
    }
  });

  // Calendar proxy endpoint to fetch webcal ICS files
  app.get('/api/fetch-calendar', async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL query parameter is required' });
    }

    let fetchUrl = url.trim();
    if (fetchUrl.startsWith('webcal://')) {
      fetchUrl = 'https://' + fetchUrl.slice(9);
    } else if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
      fetchUrl = 'https://' + fetchUrl;
    }

    try {
      console.log(`[Calendar Proxy] Fetching: ${fetchUrl}`);
      const response = await axios({
        method: 'get',
        url: fetchUrl,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(response.data);
    } catch (error: any) {
      console.error(`[Calendar Proxy] Error fetching ${fetchUrl}:`, error.message);
      res.status(500).json({ error: `Failed to fetch calendar: ${error.message}` });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
