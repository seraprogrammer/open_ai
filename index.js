import express from 'express';
import { DeepInfra } from './sdk.js';
import ProxyChain from 'proxy-chain';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Proxy management class
class ProxyManager {
  constructor() {
    this.proxies = [];
    this.currentIndex = 0;
    this.lastFetch = 0;
    this.fetchInterval = 5 * 60 * 1000; // 5 minutes
  }

  async fetchProxies() {
    const now = Date.now();
    if (now - this.lastFetch < this.fetchInterval && this.proxies.length > 0) {
      return this.proxies;
    }

    console.log('Fetching fresh proxies...');
    const proxySources = [
      'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=10000&country=all&ssl=all&anonymity=elite&simplified=true',
      'https://www.proxy-list.download/api/v1/get?type=http&anon=elite',
      'https://api.openproxylist.xyz/http.txt',
      'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
      'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt'
    ];

    const allProxies = [];

    for (const source of proxySources) {
      try {
        const response = await fetch(source, { timeout: 5000 });
        const text = await response.text();
        const proxies = text.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const proxy = line.trim();
            if (proxy.includes('://')) return proxy;
            return `http://${proxy}`;
          });
        allProxies.push(...proxies);
      } catch (error) {
        console.log(`Failed to fetch from ${source}`);
      }
    }

    // Remove duplicates and validate format
    this.proxies = [...new Set(allProxies)]
      .filter(proxy => /^https?:\/\/\d+\.\d+\.\d+\.\d+:\d+$/.test(proxy))
      .slice(0, 100); // Limit to 100 proxies

    this.lastFetch = now;
    console.log(`Loaded ${this.proxies.length} proxies`);
    return this.proxies;
  }

  async getWorkingProxy() {
    await this.fetchProxies();
    
    if (this.proxies.length === 0) {
      return null;
    }

    // Try proxies in rotation
    for (let i = 0; i < Math.min(10, this.proxies.length); i++) {
      const proxy = this.proxies[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

      // Quick test if proxy works
      try {
        const agent = new HttpsProxyAgent(proxy);
        const testResponse = await fetch('http://httpbin.org/ip', {
          agent,
          timeout: 3000
        });
        
        if (testResponse.ok) {
          const data = await testResponse.json();
          console.log(`Working proxy found: ${proxy} -> IP: ${data.origin}`);
          return proxy;
        }
      } catch (error) {
        // Proxy didn't work, try next
      }
    }

    return null;
  }
}

// Alternative: Use Tor for rotation
class TorProxyManager {
  constructor() {
    this.torProxies = [];
    this.currentIndex = 0;
  }

  async setupTorProxies() {
    // Create multiple Tor circuits
    const proxies = [];
    for (let i = 0; i < 5; i++) {
      const port = 9050 + i;
      proxies.push(`socks5://127.0.0.1:${port}`);
    }
    this.torProxies = proxies;
    console.log('Tor proxies configured');
    return proxies;
  }

  getNextProxy() {
    if (this.torProxies.length === 0) return null;
    const proxy = this.torProxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.torProxies.length;
    return proxy;
  }
}

const proxyManager = new ProxyManager();
const torManager = new TorProxyManager();

// Custom fetch with automatic proxy rotation
async function fetchWithRotation(url, options = {}) {
  let lastError;
  
  // Try with proxy first
  const proxy = await proxyManager.getWorkingProxy();
  
  if (proxy) {
    try {
      const agent = new HttpsProxyAgent(proxy);
      const response = await fetch(url, { ...options, agent, timeout: 10000 });
      return response;
    } catch (error) {
      lastError = error;
      console.log('Proxy request failed, trying direct...');
    }
  }

  // Fallback to direct connection
  try {
    return await fetch(url, options);
  } catch (error) {
    throw lastError || error;
  }
}

// Enhanced DeepInfra client with proxy support
class ProxyDeepInfra extends DeepInfra {
  constructor() {
    super();
    this.requestCount = 0;
  }

  async createChatCompletion(params) {
    this.requestCount++;
    
    // Use browser automation for every 5th request to avoid detection
    if (this.requestCount % 5 === 0) {
      return await this.createWithBrowser(params);
    }

    // Regular API call with proxy
    const proxy = await proxyManager.getWorkingProxy();
    
    if (!proxy) {
      console.log('No proxy available, using direct connection');
      return await this.chat.completions.create(params);
    }

    // Override the fetch method for this request
    const originalFetch = global.fetch;
    const agent = new HttpsProxyAgent(proxy);
    
    global.fetch = (url, opts = {}) => {
      return originalFetch(url, { ...opts, agent });
    };

    try {
      const result = await this.chat.completions.create(params);
      return result;
    } finally {
      global.fetch = originalFetch;
    }
  }

  async createWithBrowser(params) {
    console.log('Using browser automation for request...');
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    try {
      const page = await browser.newPage();
      
      // Randomize viewport and user agent
      await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100)
      });

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Make API call through browser
      const result = await page.evaluate(async (params) => {
        const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params)
        });
        return await response.json();
      }, params);

      return result;
    } finally {
      await browser.close();
    }
  }
}

// Initialize DeepInfra client
const deepinfra = new ProxyDeepInfra();

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
app.get('/health', async (req, res) => {
  const proxyCount = proxyManager.proxies.length;
  res.json({ 
    status: 'ok', 
    provider: 'DeepInfra',
    proxies_available: proxyCount,
    request_count: deepinfra.requestCount
  });
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

// Chat completions endpoint with automatic retry
app.post('/v1/chat/completions', async (req, res) => {
  const maxRetries = 5;
  let retries = 0;
  let lastError;

  // Add random delay to avoid burst detection
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

  while (retries < maxRetries) {
    try {
      const params = req.body;

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
          const stream = await deepinfra.createChatCompletion(params);
          
          for await (const chunk of stream) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
          
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        } catch (streamError) {
          lastError = streamError;
          retries++;
          
          if (retries >= maxRetries) {
            res.write(`data: ${JSON.stringify({
              error: {
                message: streamError.message,
                type: 'server_error'
              }
            })}\n\n`);
            res.end();
            return;
          }
        }
      } else {
        // Non-streaming response
        const response = await deepinfra.createChatCompletion(params);
        return res.json(response);
      }
    } catch (error) {
      console.error(`Attempt ${retries + 1} failed:`, error.message);
      lastError = error;
      retries++;
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      
      // Refresh proxies after 3 retries
      if (retries === 3) {
        await proxyManager.fetchProxies();
      }
    }
  }

  res.status(500).json({
    error: {
      message: lastError?.message || 'Request failed after multiple retries',
      type: 'server_error'
    }
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 DeepInfra OpenAI-compatible API server running on port ${PORT}`);
  console.log(`📋 Models endpoint: http://localhost:${PORT}/v1/models`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/v1/chat/completions`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`\n🔑 Use API Key: ${DUMMY_API_KEY}`);
  
  // Initialize proxies
  await proxyManager.fetchProxies();
  console.log(`\n🌐 Proxy rotation enabled with ${proxyManager.proxies.length} proxies`);
});
