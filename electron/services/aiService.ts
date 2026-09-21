import { databaseManager } from '../persistence/DatabaseManager'
import { getActiveUserId } from '../store'

// ─────────────────────────────────────────────────────────────────────────────
// AI Provider abstraction
// ─────────────────────────────────────────────────────────────────────────────

interface AIProvider {
  generate(systemPrompt: string, userMessage: string): Promise<string>
}

class OpenAIProvider implements AIProvider {
  private readonly apiKey: string
  constructor(apiKey: string) { this.apiKey = apiKey }

  async generate(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1024,
      }),
    })
    if (!response.ok) {
      const err = await response.json() as any
      throw new Error(err.error?.message ?? 'OpenAI request failed')
    }
    const data = await response.json() as any
    return data.choices[0].message.content
  }
}

class AnthropicProvider implements AIProvider {
  private readonly apiKey: string
  constructor(apiKey: string) { this.apiKey = apiKey }

  async generate(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
    if (!response.ok) {
      const err = await response.json() as any
      throw new Error(err.error?.message ?? 'Anthropic request failed')
    }
    const data = await response.json() as any
    return data.content[0].text
  }
}

class OllamaProvider implements AIProvider {
  private readonly endpoint: string
  constructor(endpoint: string) { this.endpoint = endpoint.replace(/\/$/, '') }

  async generate(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    })
    if (!response.ok) throw new Error('Ollama request failed')
    const data = await response.json() as any
    return data.message.content
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider factory
// ─────────────────────────────────────────────────────────────────────────────

async function resolveAIProvider(): Promise<AIProvider> {
  const userId = getActiveUserId()
  const settings = userId && databaseManager.isConnected()
    ? databaseManager.getProvider().settings
    : null

  const get = async (key: string): Promise<string | null> =>
    settings ? settings.get(userId!, key) : null

  const providerName = (await get('ai_provider')) ?? 'openai'

  if (providerName === 'anthropic') {
    const key = await get('anthropic_api_key')
    if (!key) throw new Error('Anthropic API key not configured. Go to Settings → AI Provider.')
    return new AnthropicProvider(key)
  }

  if (providerName === 'ollama') {
    const endpoint = (await get('ollama_endpoint')) ?? 'http://localhost:11434'
    return new OllamaProvider(endpoint)
  }

  // Default: OpenAI
  const key = await get('openai_api_key')
  if (!key) throw new Error('OpenAI API key not configured. Go to Settings → AI Provider.')
  return new OpenAIProvider(key)
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt templates
// ─────────────────────────────────────────────────────────────────────────────

const PROMPTS: Record<string, { system: string; buildUser: (content: string) => string }> = {
  summarize: {
    system: 'You are a concise assistant that summarizes notes. Respond with a 2-3 sentence summary only.',
    buildUser: (c) => `Summarize this note:\n\n${c}`,
  },
  expand: {
    system: 'You are a writing assistant. Expand the given bullet points or outline into well-written prose paragraphs. Preserve markdown structure.',
    buildUser: (c) => `Expand this outline into prose:\n\n${c}`,
  },
  improve: {
    system: 'You are a professional editor. Improve the grammar, clarity, and style of the text. Return only the improved text with no commentary.',
    buildUser: (c) => `Improve this writing:\n\n${c}`,
  },
  title: {
    system: 'You are a helpful assistant. Generate a short, descriptive title (5 words or fewer) for this note. Return only the title.',
    buildUser: (c) => `Generate a title for:\n\n${c}`,
  },
}

export async function generateAI(content: string, action: string): Promise<string> {
  const template = PROMPTS[action]
  if (!template) throw new Error(`Unknown AI action: ${action}`)
  const provider = await resolveAIProvider()
  return provider.generate(template.system, template.buildUser(content))
}
