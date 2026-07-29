const { Pinecone } = require('@pinecone-database/pinecone');
const { config } = require("../../utils/config");

let pineconeInstance = null;

const getPinecone = () => {
  if (!pineconeInstance) {
    if (!config.pinecone_api_key) {
      throw new Error('PINECONE_API_KEY is not configured');
    }
    pineconeInstance = new Pinecone({ apiKey: config.pinecone_api_key });
  }
  return pineconeInstance;
};

const getPineconeIndex = () => {
  return getPinecone().index(config.pinecone_index_name);
};

module.exports = { getPinecone, getPineconeIndex };
