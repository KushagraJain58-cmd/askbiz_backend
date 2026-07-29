require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');

async function setup() {
  if (!process.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY === 'your_pinecone_api_key_here') {
    console.error('PINECONE_API_KEY is not set in .env — add a real key before running this script.');
    process.exit(1);
  }

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

  const indexName = process.env.PINECONE_INDEX_NAME || 'platform-knowledge-base';
  const existing = await pc.listIndexes();
  const exists = existing.indexes?.some(i => i.name === indexName);

  if (exists) {
    console.log(`Index "${indexName}" already exists. Skipping creation.`);
    return;
  }

  await pc.createIndex({
    name: indexName,
    dimension: 1536,
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: process.env.PINECONE_CLOUD || 'aws',
        region: process.env.PINECONE_REGION || 'us-east-1',
      },
    },
  });

  console.log(`Pinecone index "${indexName}" created successfully.`);
}

setup().catch(err => {
  console.error('Pinecone setup failed:', err);
  process.exit(1);
});
