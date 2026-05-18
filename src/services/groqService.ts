export interface ContentPack {
  tweets: string[];
  linkedin: string;
  reelScript: {
    hook: string;
    body: string;
    cta: string;
  };
  memeCopy: {
    topText: string;
    bottomText: string;
  };
  email: {
    subject: string;
    body: string;
  };
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

/**
 * Generates a content pack using the Groq API.
 * 
 * NOTE: This function uses a client-side API key (VITE_GROQ_API_KEY).
 * For production applications, it is recommended to proxy these requests 
 * through a server to keep the API key secure.
 * 
 * @param systemPrompt - The brand brain system prompt.
 * @param userInput - The user's specific request or topic.
 * @returns A promise that resolves to a ContentPack object.
 */
export async function generateContentPack(systemPrompt: string, userInput: string): Promise<ContentPack> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_GROQ_API_KEY is not defined in environment variables. Please add it to your settings.');
  }

  const userMessage = `
User Input: ${userInput}

Generate a full content pack based on the above input and your system instructions. 
You MUST return the response as a clean JSON object with the following exact keys:
- "tweets": An array of exactly 3 strings.
- "linkedin": A string (the post content).
- "reelScript": An object with "hook", "body", and "cta" strings.
- "memeCopy": An object with "topText" and "bottomText" strings.
- "email": An object with "subject" and "body" strings.

Strictly adhere to the brand voice provided in the system prompt.
Do not include any introductory text, concluding remarks, or markdown code blocks. Only the raw JSON object.
`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        // Some models support response_format: { type: 'json_object' }
        // Llama 3 on Groq generally respects the JSON request well if prompted correctly.
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_completion_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Groq API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      return JSON.parse(content) as ContentPack;
    } catch (parseError) {
      console.error('Failed to parse Groq response as JSON:', content);
      throw new Error('The AI generated an invalid response format. Please try again.');
    }
  } catch (error) {
    console.error('Error in generateContentPack:', error);
    throw error;
  }
}
