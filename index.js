import express from 'express';
import { DeepInfra, HuggingFace, Worker } from './sdk.js';

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize clients
const clients = {
  deepinfra: new DeepInfra(),
  huggingface: new HuggingFace(),
  worker: new Worker(),
  airforce: new (class Airforce {
    constructor() {
      this.baseUrl = 'https://api.airforce';
      this.apiEndpoint = 'https://api.airforce/chat/completions';
      this.imageEndpoint = 'https://api.airforce/imagine2';
    }
    
    get chat() {
      return {
        completions: {
          create: async (params) => {
            const { signal, ...options } = params;
            const response = await fetch(this.apiEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(options),
              signal
            });
            
            if (params.stream) {
              return this._streamResponse(response);
            }
            
            if (!response.ok) {
              throw new Error(`Status ${response.status}: ${await response.text()}`);
            }
            return response.json();
          }
        }
      };
    }
    
    get models() {
      return {
        list: async () => {
          try {
            const response = await fetch(`${this.baseUrl}/models`);
            if (!response.ok) throw new Error('Failed to fetch');
            return await response.json();
          } catch {
            return [
              { id: 'gpt-4o-mini', type: 'chat' },
              { id: 'claude-3-5-sonnet', type: 'chat' },
              { id: 'flux-pro', type: 'image' }
            ];
          }
        }
      };
    }
    
    get images() {
      return {
        generate: async (params) => {
          const response = await fetch(this.imageEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });
          
          if (!response.ok) {
            throw new Error(`Status ${response.status}: ${await response.text()}`);
          }
          return response.json();
        }
      };
    }
    
    async *_streamResponse(response) {
      if (!response.ok) {
        throw new Error(`Status ${response.status}: ${await response.text()}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop();
        
        for (const part of parts) {
          if (!part.trim() || part === 'data: [DONE]') continue;
          try {
            if (part.startsWith('data: ')) {
              yield JSON.parse(part.slice(6));
            }
          } catch (err) {
            console.error('Parse error:', err);
          }
        }
      }
    }
  })()
};

// Dummy API key
const DUMMY_API_KEY = 'sk-deepinfra-dummy-key-12345';

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// API Key validation
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/v1/models') {
    return next();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: {
        message: 'Authorization header is required',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    });
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (token !== DUMMY_API_KEY) {
    return res.status(401).json({
      error: {
        message: 'Invalid API key. Use: ' + DUMMY_API_KEY,
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    });
  }

  next();
});

// Get provider from query or header
function getProvider(req) {
  const provider = req.query.provider || req.headers['x-provider'] || 'deepinfra';
  return clients[provider] || clients.deepinfra;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', providers: Object.keys(clients) });
});

// List models
app.get('/v1/models', async (req, res) => {
  try {
    const provider = getProvider(req);
    const models = await provider.models.list();
    res.json({
      object: 'list',
      data: models.map(model => ({
        id: model.id,
        object: 'model',
        created: Date.now(),
        owned_by: req.query.provider || 'deepinfra',
        type: model.type || 'chat'
      }))
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error'
      }
    });
  }
});

// Chat completions
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const params = req.body;
    const provider = getProvider(req);

    if (!params.messages || !Array.isArray(params.messages)) {
      return res.status(400).json({
        error: {
          message: 'Invalid request: messages array is required',
          type: 'invalid_request_error'
        }
      });
    }

    if (params.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const stream = await provider.chat.completions.create(params);
        
        for await (const chunk of stream) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (streamError) {
        console.error('Streaming error:', streamError);
        res.write(`data: ${JSON.stringify({
          error: {
            message: streamError.message,
            type: 'server_error'
          }
        })}\n\n`);
        res.end();
      }
    } else {
      const response = await provider.chat.completions.create(params);
      res.json(response);
    }
  } catch (error) {
    console.error('Error in chat completion:', error);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error'
      }
    });
  }
});

// Image generation
app.post('/v1/images/generations', async (req, res) => {
  try {
    const params = req.body;
    const provider = getProvider(req);

    if (!params.prompt) {
      return res.status(400).json({
        error: {
          message: 'Invalid request: prompt is required',
          type: 'invalid_request_error'
        }
      });
    }

    const response = await provider.images.generate(params);
    res.json(response);
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error'
      }
    });
  }
});

// Image edit
app.post('/v1/images/edits', async (req, res) => {
  try {
    const params = req.body;
    const provider = getProvider(req);

    if (!provider.images.edit) {
      return res.status(400).json({
        error: {
          message: 'Image editing not supported by this provider',
          type: 'invalid_request_error'
        }
      });
    }

    const response = await provider.images.edit(params);
    res.json(response);
  } catch (error) {
    console.error('Error editing image:', error);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error'
      }
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      message: err.message || 'Internal server error',
      type: 'server_error'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Multi-Provider API Server running on port ${PORT}`);
  console.log(`📋 Models: http://localhost:${PORT}/v1/models?provider=deepinfra`);
  console.log(`💬 Chat: http://localhost:${PORT}/v1/chat/completions?provider=airforce`);
  console.log(`🖼️  Images: http://localhost:${PORT}/v1/images/generations?provider=worker`);
  console.log(`\n Available providers: ${Object.keys(clients).join(', ')}`);
  console.log(`\n Use ?provider=<name> or header X-Provider: <name>`);
});
