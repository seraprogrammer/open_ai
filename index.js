import express from 'express';
import { DeepInfra } from './sdk.js';

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json({ limit: '50mb' })); // Increased for large requests
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize DeepInfra client
const deepinfra = new DeepInfra();
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

// API Key validation middleware
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

// Enhanced chat completions endpoint
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

    // Handle streaming with enhanced timeout prevention
    if (params.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering
      
      // Increase timeout for long responses
      req.setTimeout(600000); // 10 minutes
      res.setTimeout(600000);

      try {
        const stream = await deepinfra.chat.completions.create(params);
        
        let chunkCount = 0;
        for await (const chunk of stream) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          chunkCount++;
          
          // Send periodic keep-alive comments to prevent timeout
          if (chunkCount % 50 === 0) {
            res.write(': keep-alive\n\n');
          }
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
      // Non-streaming response with extended timeout
      req.setTimeout(600000); // 10 minutes
      res.setTimeout(600000);
      
      const response = await deepinfra.chat.completions.create(params);
      
      // Use chunked transfer for large responses
      const responseStr = JSON.stringify(response);
      if (responseStr.length > 100000) { // > 100KB
        res.setHeader('Transfer-Encoding', 'chunked');
      }
      
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

// Start server with keep-alive settings
const server = app.listen(PORT, () => {
  console.log(`🚀 DeepInfra OpenAI-compatible API server running on port ${PORT}`);
  console.log(`📋 Models endpoint: http://localhost:${PORT}/v1/models`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/v1/chat/completions`);
  console.log(`⚡ Optimized for long responses and serverless environments`);
});

// Extended keep-alive and timeout settings
server.keepAliveTimeout = 620000; // 10 minutes + buffer
server.headersTimeout = 630000; // Slightly higher than keepAliveTimeout

export default app;
