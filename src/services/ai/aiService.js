const Anthropic = require('@anthropic-ai/sdk');
const { searchRAG } = require('./ragService');
const { searchBusinesses, searchExperts, searchCommunities, searchPosts, formatDBContext, buildEntityPayload} = require('./dbContextService');
const { getChatHistory, appendMessage } = require('./chatHistoryService');
const AIQueryLog = require('../../models/aiQueryLog');
const { config } = require('../../../utils/config');

let anthropicClient = null;
function getClient() {
  if (!anthropicClient) {
    if (!config.anthropic_api_key) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    anthropicClient = new Anthropic({ apiKey: config.anthropic_api_key });
  }
  return anthropicClient;
}

function buildSystemPrompt(dbContext, ragContext, userRole) {
  const roleContext = {
    Individual: 'The user is an aspiring entrepreneur or someone looking to start or grow a business in India.',
    Bussiness: 'The user is a business owner (often a legacy or traditional business) looking to grow, connect with other businesses, or get advice.',
    Expert: 'The user is a domain expert such as a CA, lawyer, or consultant on the platform.',
  }[userRole] || 'The user is a member of this platform.';

  return `You are the AskBiz Business Assistant — an intelligent business advisor for AskBiz, a platform connecting Indian entrepreneurs, businesses, and experts.

ROLE CONTEXT:
${roleContext}

${dbContext ? `PLATFORM DATA (real businesses, experts, communities, and posts on AskBiz matching this query):\n${dbContext}\n` : ''}
${ragContext ? `KNOWLEDGE BASE:\n${ragContext}\n` : ''}

INSTRUCTIONS:
- Respond in the same language the user writes in. If they write in Hindi (Devanagari or Hinglish), respond in Hindi/Hinglish. If English, respond in English.
- Be practical, specific, and relevant to the Indian business context.
- If relevant businesses, experts, communities, or posts are shown in the platform data above, mention them naturally by name as people to connect with, communities to join, or posts to check out on AskBiz. Only mention entries that actually appear in the platform data.
- For government schemes, registrations, and regulations, always specify they apply to India. Include specific scheme names (Udyam, PMEGP, Startup India, etc.) where relevant.
- Be concise. Avoid unnecessary preamble. Get to the useful information quickly.
- Match response length to question complexity: a factual lookup gets 1-3 sentences; a multi-step process gets a short list. Never pad a short answer with a header, intro, or closing summary.
- Do not restate the user's question before answering.
- Do not end with "Let me know if you have other questions" or similar filler.
- If the platform data or knowledge base context above does not contain the answer, say exactly "I don't have verified information on that" and suggest the user post the question to an AskBiz community, rather than guessing.
- Never make up business names, phone numbers, prices, or regulatory details you are not certain about.
- Always prioritise accuracy over appearing knowledgeable.

FORMATTING (the app renders Markdown, so use it to make answers scannable):
- Use **bold** for scheme names, key terms, thresholds, and numbers a user would want to spot at a glance (e.g. "**Udyam Registration**", "turnover under **₹40 lakh**").
- Use bullet or numbered lists for steps, eligibility criteria, or multiple options — don't bury them in a paragraph.
- Use short markdown headers (## or ###) only when the answer covers multiple distinct topics or sections; skip headers for short, single-point answers.
- Keep formatting proportional to length — a one-line answer needs no headers or lists, just plain text with bold on the key term if any.
- Do not use tables unless the data is genuinely tabular.`;
}

/**
 * Stream an AI response to a user query.
 *
 * @param {Object} params
 * @param {string} params.userId - MongoDB ObjectId string
 * @param {string} params.sessionId - Chat session to read history from and append to
 * @param {string} params.userRole - 'Individual' | 'Bussiness' | 'Expert'
 * @param {string} params.query - The user's message
 * @param {Function} params.onChunk - Called with each streamed text chunk
 * @param {Function} params.onDone - Called with (fullResponse, entities) when done.
 *   `entities` is the structured list of platform records (businesses, experts,
 *   communities, posts) referenced in the answer, for rendering tappable cards
 * @param {Function} params.onError - Called with an Error object on failure
 */
async function streamAIResponse({ userId, sessionId, userRole, query, onChunk, onDone, onError }) {
  const startTime = Date.now();
  let fullResponse = '';
  let dbResultsCount = 0;
  let ragResultsCount = 0;
  let settled = false;

  try {
    const client = getClient();

    // Fetch all context in parallel — none of these should block the others
    const [history, businesses, experts, communities, posts, ragResult] = await Promise.all([
      getChatHistory(userId, sessionId),
      searchBusinesses(query),
      searchExperts(query),
      searchCommunities(query),
      searchPosts(query),
      searchRAG(query),
    ]);

    dbResultsCount = businesses.length + experts.length + communities.length + posts.length;
    ragResultsCount = ragResult.count;

    const dbContext = formatDBContext({ businesses, experts, communities, posts });

    // Structured, client-safe copies of the same records for tappable cards
    const entities = buildEntityPayload({ businesses, experts, communities, posts });

    const systemPrompt = buildSystemPrompt(dbContext, ragResult.context, userRole);

    const messages = [
      ...history,
      { role: 'user', content: query },
    ];

    const stream = client.messages.stream({
      model: config.ai_model,
      max_tokens: config.ai_max_tokens,
      temperature: 0.3,
      system: systemPrompt,
      messages,
    });

    stream.on('text', (text) => {
      fullResponse += text;
      onChunk(text);
    });

    stream.on('finalMessage', async () => {
      if (settled) return;
      settled = true;
      const durationMs = Date.now() - startTime;

      try {
        // Persist conversation (entities saved on the assistant turn so a
        // history reload can re-render the same suggestion cards)
        await appendMessage(userId, sessionId, 'user', query);
        await appendMessage(userId, sessionId, 'assistant', fullResponse, entities);

        // Log query for analytics
        await AIQueryLog.create({
          userId,
          userRole,
          query,
          responseLength: fullResponse.length,
          dbResultsCount,
          ragResultsCount,
          durationMs,
        });
      } catch (err) {
        console.error('[AILog] Failed to persist query:', err.message);
      }

      onDone(fullResponse, entities);
    });

    stream.on('error', async (err) => {
      if (settled) return;
      settled = true;

      await AIQueryLog.create({
        userId,
        userRole,
        query,
        errorOccurred: true,
        durationMs: Date.now() - startTime,
      }).catch(() => {});

      onError(err);
    });

  } catch (error) {
    if (!settled) {
      settled = true;
      onError(error);
    }
  }
}

module.exports = { streamAIResponse, buildSystemPrompt };
