require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

async function test() {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
    console.error('ANTHROPIC_API_KEY is not set in .env — add a real key before running this script.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
    max_tokens: 64,
    messages: [{ role: 'user', content: 'Reply with: Claude API connected.' }],
  });
  console.log(msg.content[0].text);
}

test().catch(err => {
  console.error('Claude API test failed:', err);
  process.exit(1);
});
