const crypto = require('crypto');
const { getPineconeIndex } = require('../../config/pinecone');
const { generateEmbedding } = require('./embeddingService');
const KnowledgeChunk = require('../../models/knowledgeChunk');

/**
 * Search the RAG knowledge base for chunks relevant to the query.
 * Returns a formatted context string ready for injection into the system prompt.
 */
async function searchRAG(query, topK = 4) {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const index = getPineconeIndex();

    const results = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    if (!results.matches || results.matches.length === 0) {
      return { context: '', count: 0 };
    }

    // Filter by minimum relevance score
    const MIN_SCORE = 0.65;
    const relevant = results.matches.filter(m => m.score >= MIN_SCORE);

    if (relevant.length === 0) {
      return { context: '', count: 0 };
    }

    const context = relevant
      .map(m => `### ${m.metadata.title}\n${m.metadata.content}`)
      .join('\n\n');

    return { context, count: relevant.length };
  } catch (error) {
    console.error('[RAG] Search error:', error.message);
    return { context: '', count: 0 };
  }
}

/**
 * Ingest a single knowledge chunk into Pinecone.
 * Called from the admin knowledge route and the ingestion script.
 */
async function ingestChunk(chunkId, title, content, category, tags = []) {
  const index = getPineconeIndex();

  const pineconeId = `chunk_${crypto.randomUUID()}`;
  const embedding = await generateEmbedding(`${title}\n${content}`);

  await index.upsert({
    records: [{
      id: pineconeId,
      values: embedding,
      metadata: {
        mongoId: chunkId.toString(),
        title,
        content: content.substring(0, 1000), // Pinecone metadata size limit
        category,
        tags,
      },
    }],
  });

  // Mark as embedded in MongoDB
  await KnowledgeChunk.findByIdAndUpdate(chunkId, {
    pineconeId,
    isEmbedded: true,
  });

  return pineconeId;
}

module.exports = { searchRAG, ingestChunk };
