const crypto = require('crypto');

/**
 * Generate a 1536-dimension embedding for a given text.
 *
 * TODO(PRODUCTION): Replace this stub with a real embedding provider before
 * going live. The stub below is deterministic and safe for development
 * testing, but it produces MEANINGLESS semantic search results — Pinecone
 * matches will be effectively random.
 *
 * Recommended: Voyage AI (Anthropic's recommended embedding provider).
 *   npm install voyageai
 *   docs: https://docs.voyageai.com/docs/embeddings
 *
 * Production replacement (uncomment and set VOYAGE_API_KEY in .env):
 *
 *   const { VoyageAIClient } = require('voyageai');
 *   const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
 *   async function generateEmbedding(text) {
 *     const result = await voyage.embed({ input: [text], model: 'voyage-3' });
 *     return result.data[0].embedding;
 *   }
 */
async function generateEmbedding(text) {
  // Development stub — deterministic pseudo-embedding derived from a SHA-256
  // hash of the text. Same input always yields the same vector.
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  const embedding = Array.from({ length: 1536 }, (_, i) => {
    const byte = parseInt(hash[(i * 2) % 64] + hash[(i * 2 + 1) % 64], 16);
    return (byte / 255) * 2 - 1;
  });

  return embedding;
}

module.exports = { generateEmbedding };
