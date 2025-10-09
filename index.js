import express from 'express';
import { DeepInfra } from './sdk.js'; // Adjust path to your client file

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());

// Initialize DeepInfra client (no API key needed)
const deepinfra = new DeepInfra();

// Dummy API key for authentication (required by some IDEs like VSCode extensions)
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

// API Key validation middleware (accepts dummy key)
app.use((req, res, next) => {
  // Skip auth for health and models endpoints
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
  
  // Accept any API key (dummy or real) since DeepInfra doesn't need auth
  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Invalid API key',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    });
  }

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', provider: 'DeepInfra' });
});

// List available models
app.get('/v1/models', async (req, res) => {
  try {
    const models = await deepinfra.models.list();
    res.json({
      object: 'list',
      data: models.map(model => ({
        id: model.id,
        object: 'model',
        created: Date.now(),
        owned_by: 'deepinfra',
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

// Chat completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const params = req.body;

    // Validate required parameters
    if (!params.messages || !Array.isArray(params.messages)) {
      return res.status(400).json({
        error: {
          message: 'Invalid request: messages array is required',
          type: 'invalid_request_error'
        }
      });
    }

    // Handle streaming
    if (params.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const stream = await deepinfra.chat.completions.create(params);
        
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
      // Non-streaming response
      const response = await deepinfra.chat.completions.create(params);
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

// Image generation endpoint
app.post('/v1/images/generations', async (req, res) => {
  try {
    const params = req.body;

    // Validate required parameters
    if (!params.prompt) {
      return res.status(400).json({
        error: {
          message: 'Invalid request: prompt is required',
          type: 'invalid_request_error'
        }
      });
    }

    const response = await deepinfra.images.generate(params);
    res.json(response);
  } catch (error) {
    console.error('Error in image generation:', error);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error'
      }
    });
  }
});

// Image editing endpoint
app.post('/v1/images/edits', async (req, res) => {
  try {
    const params = req.body;

    const response = await deepinfra.images.edit(params);
    res.json(response);
  } catch (error) {
    console.error('Error in image editing:', error);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error'
      }
    });
  }
});

// Error handling middleware
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
  console.log(`🚀 DeepInfra OpenAI-compatible API server running on port ${PORT}`);
  console.log(`📋 Models endpoint: http://localhost:${PORT}/v1/models`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/v1/chat/completions`);
  console.log(`🖼️  Images endpoint: http://localhost:${PORT}/v1/images/generations`);
  console.log(`✏️  Image edit endpoint: http://localhost:${PORT}/v1/images/edits`);
});

export default app;