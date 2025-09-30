import { Hono } from 'hono';
import { DeepInfra } from 'kathamo';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

// Available models from the select dropdown
const AVAILABLE_MODELS = [
  'google/gemma-3-12b-it',
  'google/gemma-1.1-7b-it',
  'google/gemma-3-4b-it',
  'google/gemini-1.5-flash',
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct-Turbo',
  'Sao10K/L3-8B-Lunaris-v1',
  'google/gemini-2.5-pro',
  'deepseek-ai/DeepSeek-V3',
  'google/gemini-1.5-flash-8b',
  'Sao10K/L3.3-70B-Euryale-v2.3',
  'Qwen/QVQ-72B-Preview',
  'mattshumer/Reflection-Llama-3.1-70B',
  'lizpreciatior/lzlv_70b_fp16_hf',
  'meta-llama/Llama-Guard-4-12B',
  'openai/gpt-oss-120b-Turbo',
  'Qwen/Qwen3-Coder-480B-A35B-Instruct',
  'microsoft/Phi-3-medium-4k-instruct',
  'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  'nvidia/Llama-3.1-Nemotron-70B-Instruct',
  'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
  'moonshotai/Kimi-K2-Instruct-0905',
  'openchat/openchat_3.5',
  'meta-llama/Llama-4-Scout-17B-16E-Instruct',
  'Sao10K/L3-8B-Lunaris-v1-Turbo',
  'deepseek-ai/DeepSeek-V3-0324',
  'mistralai/Mistral-Small-24B-Instruct-2501',
  'NovaSky-AI/Sky-T1-32B-Preview',
  'openai/gpt-oss-120b',
  'microsoft/phi-4',
  'meta-llama/Meta-Llama-3.1-70B-Instruct',
  'mistralai/Mixtral-8x7B-Instruct-v0.1',
  'anthropic/claude-4-sonnet',
  'mistralai/Mistral-Small-3.1-24B-Instruct-2503',
  'zai-org/GLM-4.5-Air',
  'Austism/chronos-hermes-13b-v2',
  'zai-org/GLM-4.5',
  'meta-llama/Llama-3.3-70B-Instruct',
  'meta-llama/Llama-2-70b-chat-hf',
  'deepseek-ai/DeepSeek-R1-0528-Turbo',
  'google/gemma-3-27b-it',
  'Qwen/Qwen2.5-Coder-32B-Instruct',
  'mistralai/Devstral-Small-2505',
  'microsoft/Phi-4-multimodal-instruct',
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  'openai/gpt-oss-20b',
  'mistralai/Mistral-Nemo-Instruct-2407',
  'allenai/olmOCR-7B-0725-FP8',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'cognitivecomputations/dolphin-2.6-mixtral-8x7b',
  'nvidia/Nemotron-4-340B-Instruct',
  'meta-llama/Llama-Guard-3-8B',
  'mistralai/Mixtral-8x22B-Instruct-v0.1',
  'Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo',
  'Qwen/Qwen3-Next-80B-A3B-Thinking',
  'Sao10K/L3.1-70B-Euryale-v2.2',
  'NousResearch/Hermes-3-Llama-3.1-405B',
  'meta-llama/Meta-Llama-3-8B-Instruct',
  'meta-llama/Meta-Llama-3-70B-Instruct',
  'google/codegemma-7b-it',
  'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  'deepseek-ai/DeepSeek-R1-0528',
  'bigcode/starcoder2-15b-instruct-v0.1',
  'deepseek-ai/DeepSeek-V3-0324-Turbo',
  'Gryphe/MythoMax-L2-13b-turbo',
  'moonshotai/Kimi-K2-Instruct',
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
  'openbmb/MiniCPM-Llama3-V-2_5',
  'cognitivecomputations/dolphin-2.9.1-llama-3-70b',
  'mistralai/Mistral-7B-Instruct-v0.1',
  'meta-llama/Llama-2-13b-chat-hf',
  'Qwen/Qwen3-235B-A22B-Thinking-2507',
  'Qwen/Qwen2.5-7B-Instruct',
  'meta-llama/Llama-3.2-90B-Vision-Instruct',
  'google/gemini-2.5-flash',
  'meta-llama/Meta-Llama-3.1-8B-Instruct',
  'Qwen/Qwen2.5-72B-Instruct',
  'deepseek-ai/DeepSeek-Prover-V2-671B',
  'deepseek-ai/DeepSeek-V3.1',
  'meta-llama/Llama-3.2-3B-Instruct',
  'microsoft/WizardLM-2-7B',
  'NousResearch/Hermes-3-Llama-3.1-70B',
  'meta-llama/Llama-3.2-1B-Instruct',
  'microsoft/WizardLM-2-8x22B',
  'deepseek-ai/DeepSeek-R1-Distill-Llama-70B',
  'Qwen/Qwen2.5-VL-32B-Instruct',
  'nvidia/NVIDIA-Nemotron-Nano-9B-v2',
  'meta-llama/Meta-Llama-3.1-405B-Instruct',
  'nvidia/Llama-3.3-Nemotron-Super-49B-v1.5',
  'KoboldAI/LLaMA2-13B-Tiefighter',
  'google/gemma-2-9b-it',
  'Qwen/Qwen2-7B-Instruct',
  'microsoft/phi-4-reasoning-plus',
  'Qwen/Qwen3-235B-A22B',
  'Qwen/Qwen3-30B-A3B',
  'meta-llama/Llama-3.2-11B-Vision-Instruct',
  'Qwen/QwQ-32B',
  'Qwen/QwQ-32B-Preview',
  'anthropic/claude-4-opus',
  'Phind/Phind-CodeLlama-34B-v2',
  'Qwen/Qwen2.5-Coder-7B',
  'google/gemini-2.0-flash-001',
  'Qwen/Qwen3-14B',
  'deepinfra/airoboros-70b',
  'Qwen/Qwen2-72B-Instruct',
  'Qwen/Qwen3-32B',
  'deepseek-ai/DeepSeek-V3.1-Terminus',
  'deepseek-ai/DeepSeek-R1-Turbo',
  'deepseek-ai/DeepSeek-R1',
  'mistralai/Mistral-7B-Instruct-v0.2',
  'Qwen/Qwen3-235B-A22B-Instruct-2507',
  'allenai/olmOCR-7B-0825',
  'google/gemma-2-27b-it',
  'Qwen/Qwen3-Next-80B-A3B-Instruct',
  'Sao10K/L3-70B-Euryale-v2.1',
  'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
  'anthropic/claude-3-7-sonnet-latest',
  'mistralai/Devstral-Small-2507',
  'openchat/openchat-3.6-8b',
  'Gryphe/MythoMax-L2-13b'
] as const;

// Type definitions
type ModelType = typeof AVAILABLE_MODELS[number];

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: string;
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

interface ChatCompletionChoice {
  index: number;
  message: Message;
  finish_reason: string | null;
}

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: Usage;
}

interface CompletionChoice {
  text: string;
  index: number;
  finish_reason: string | null;
}

interface CompletionResponse {
  id: string;
  object: 'text_completion';
  created: number;
  model: string;
  choices: CompletionChoice[];
  usage?: Usage;
}

interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

interface ModelsListResponse {
  object: 'list';
  data: ModelInfo[];
}

interface APIError {
  error: string;
  code?: string;
  message?: string;
}

// Zod schemas for validation
const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.union([
    z.string(),
    z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
      image_url: z.object({
        url: z.string()
      }).optional()
    }))
  ])
});

const chatCompletionSchema = z.object({
  model: z.string().refine((val) => AVAILABLE_MODELS.includes(val as ModelType), {
    message: 'Invalid model specified'
  }),
  messages: z.array(messageSchema).min(1),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional()
});

const completionSchema = z.object({
  model: z.string().refine((val) => AVAILABLE_MODELS.includes(val as ModelType), {
    message: 'Invalid model specified'
  }),
  prompt: z.string().min(1),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional()
});

// Type inference from schemas
type ChatCompletionRequest = z.infer<typeof chatCompletionSchema>;
type CompletionRequest = z.infer<typeof completionSchema>;

// Initialize Hono app
const app = new Hono();

// Enable CORS with more permissive settings for VS Code extensions
app.use('/*', cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'vscode-webview://', 'https://*.vscode.dev', 'https://*.github.dev'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// Helper function to extract API key
const getApiKey = (c: any): string | null => {
  // Try Authorization header first
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }

  // Try x-api-key header (common for VS Code extensions)
  const apiKeyHeader = c.req.header('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Try query parameter (for development)
  const url = new URL(c.req.url);
  const apiKeyParam = url.searchParams.get('api_key');
  if (apiKeyParam) {
    return apiKeyParam;
  }

  // Fallback to environment variable
  return process.env.DEEPINFRA_API_KEY || null;
};

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'OpenAI-Compatible API with DeepInfra',
    version: '1.0.0',
    endpoints: {
      models: '/v1/models',
      chat: '/v1/chat/completions',
      completions: '/v1/completions'
    }
  }, 200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-api-key'
  });
});

// List available models
app.get('/v1/models', (c) => {
  const models: ModelInfo[] = AVAILABLE_MODELS.map(id => ({
    id,
    object: 'model' as const,
    created: Math.floor(Date.now() / 1000),
    owned_by: 'deepinfra'
  }));

  const response: ModelsListResponse = {
    object: 'list',
    data: models
  };

  return c.json(response, 200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-api-key'
  });
});

// Chat completions endpoint
app.post(
  '/v1/chat/completions',
  zValidator('json', chatCompletionSchema),
  async (c) => {
    try {
      const body = c.req.valid('json') as ChatCompletionRequest;
      const { model, messages, stream, temperature, max_tokens, top_p } = body;

      // Get API key
      const apiKey = getApiKey(c);

      if (!apiKey) {
        const error: APIError = { 
          error: 'API key is required',
          code: 'invalid_api_key',
          message: 'Please provide a valid API key in the Authorization header'
        };
        return c.json(error, 401, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-api-key'
        });
      }

      // Initialize DeepInfra client
      const deepinfra = new DeepInfra({ apiKey });

      // Normalize messages - convert array content to string for models that don't support multimodal
      const normalizedMessages = messages.map(msg => {
        if (Array.isArray(msg.content)) {
          // Extract text from array content
          const textContent = msg.content
            .filter(item => item.type === 'text' && item.text)
            .map(item => item.text)
            .join('\n');
          return { ...msg, content: textContent || 'Hello' };
        }
        return msg;
      });

      // Log the request for debugging
      console.log('Request to DeepInfra:', {
        model,
        messageCount: normalizedMessages.length,
        temperature,
        max_tokens
      });

      // Make request
      const response = await deepinfra.chat.completions.create({
        model,
        messages: normalizedMessages as any,
        stream,
        temperature,
        max_tokens,
        top_p
      });

      // Log the raw response for debugging
      console.log('Raw response from DeepInfra:', JSON.stringify(response, null, 2));

      // Validate response
      if (!response || typeof response !== 'object') {
        console.error('Invalid response type:', typeof response);
        throw new Error('Invalid response from DeepInfra API');
      }

      const apiResponse = response as any;
      
      // Check if response has choices
      if (!apiResponse.choices || !Array.isArray(apiResponse.choices)) {
        console.error('Response structure:', {
          hasChoices: !!apiResponse.choices,
          isArray: Array.isArray(apiResponse.choices),
          responseKeys: Object.keys(apiResponse),
          fullResponse: apiResponse
        });
        throw new Error(`API returned invalid response structure: ${JSON.stringify(apiResponse)}`);
      }

      if (apiResponse.choices.length === 0) {
        console.error('Empty choices array. Full response:', apiResponse);
        throw new Error('API returned empty choices array');
      }

      // Ensure each choice has a message with content
      apiResponse.choices = apiResponse.choices.map((choice: any, index: number) => {
        // Handle different response formats
        const content = choice.message?.content || 
                       choice.text || 
                       choice.delta?.content || 
                       '';
        
        return {
          index: choice.index ?? index,
          message: {
            role: choice.message?.role || 'assistant',
            content: content
          },
          finish_reason: choice.finish_reason || 'stop'
        };
      });

      // Ensure response has all required fields
      const formattedResponse: ChatCompletionResponse = {
        id: apiResponse.id || `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: apiResponse.created || Math.floor(Date.now() / 1000),
        model: apiResponse.model || model,
        choices: apiResponse.choices,
        usage: apiResponse.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };

      return c.json(formattedResponse, 200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-api-key'
      });
    } catch (error) {
      console.error('Error in chat completions:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        response: (error as any)?.response?.data
      });
      
      const apiError: APIError = {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'internal_server_error',
        message: error instanceof Error ? error.stack : undefined
      };
      return c.json(apiError, 500, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-api-key'
      });
    }
  }
);

// Completions endpoint (legacy)
app.post(
  '/v1/completions',
  zValidator('json', completionSchema),
  async (c) => {
    try {
      const body = c.req.valid('json') as CompletionRequest;
      const { model, prompt, stream, temperature, max_tokens, top_p } = body;

      // Get API key
      const apiKey = getApiKey(c);

      if (!apiKey) {
        const error: APIError = {
          error: 'API key is required',
          code: 'invalid_api_key',
          message: 'Please provide a valid API key in the Authorization header'
        };
        return c.json(error, 401, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-api-key'
        });
      }

      // Convert prompt to messages format
      const messages: Message[] = [{ role: 'user', content: prompt }];

      // Initialize DeepInfra client
      const deepinfra = new DeepInfra({ apiKey });

      // Make request
      const response = await deepinfra.chat.completions.create({
        model,
        messages: messages as any,
        stream,
        temperature,
        max_tokens,
        top_p
      });

      // Convert response to completions format
      const completionResponse: CompletionResponse = {
        id: (response as any).id,
        object: 'text_completion',
        created: (response as any).created,
        model: (response as any).model,
        choices: (response as any).choices.map((choice: any) => ({
          text: choice.message?.content || '',
          index: choice.index,
          finish_reason: choice.finish_reason
        })),
        usage: (response as any).usage
      };

      return c.json(completionResponse, 200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-api-key'
      });
    } catch (error) {
      console.error('Error:', error);
      const apiError: APIError = {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'internal_server_error'
      };
      return c.json(apiError, 500, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-api-key'
      });
    }
  }
);

// 404 handler
app.notFound((c) => {
  const error: APIError = {
    error: 'Not Found',
    code: 'not_found',
    message: 'The requested endpoint does not exist'
  };
  return c.json(error, 404, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-api-key'
  });
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  const error: APIError = {
    error: 'Internal Server Error',
    code: 'internal_server_error',
    message: err instanceof Error ? err.message : 'An unexpected error occurred'
  };
  return c.json(error, 500, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-api-key'
  });
});

export default app;
