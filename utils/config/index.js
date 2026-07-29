var dotenv = require("dotenv");
dotenv.config();

exports.config = {
  mongodburl: process.env.MONGO_URL || "mongodb://remoteUser:userRemote%232k24%2412345@43.204.39.194:27017/AskBizz?authSource=admin&directConnection=true",
  port: process.env.PORT || 8082,
  mail_email: process.env.MAIL_EMAIL || 'bhadauriaritik@gmail.com',
  mail_password: process.env.MAIL_PASSWORD || "lsfz odtm cedb zzmb",
  secret_key: process.env.SECRET_KEY || "fdsbdsbsdffsdfdsfgnrkrensf83dsfds",
  REACT_APP_BUCKET_ACCESS_KEY : process.env.REACT_APP_BUCKET_ACCESS || "AKIAQKGGXOAW6QVRXEVJ",
  REACT_APP_BUCKET_SECRET_KEY : process.env.REACT_APP_BUCKET_SECRET || "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",
  google_client_id : process.env.GOOGLE_CLIENT_ID || "658215578442-e518hnm9d8l2q5pjo6amqda5026bhieg.apps.googleusercontent.com",
  facebook_app_id : process.env.FACEBOOK_APP_ID || "961975802566763",
  facebook_app_secret: process.env.FACEBOOK_APP_SECRET || "77b00b4f3f0849e4dd038bc7a825f7e1",

  redis_host : process.env.REDIS_HOST || "redis-19563.c98.us-east-1-4.ec2.redns.redis-cloud.com",
  redis_port : process.env.REDIS_PORT || 19563,
  redis_url : process.env.REDIS_URL || "",
  redis_password : process.env.REDIS_PASSWORD || "Tt82r7C8VGQ2B6JyrnmNVzb7AJNhC57A",

  // AI assistant (Anthropic Claude + Pinecone RAG)
  anthropic_api_key : process.env.ANTHROPIC_API_KEY || "",
  pinecone_api_key : process.env.PINECONE_API_KEY || "",
  pinecone_index_name : process.env.PINECONE_INDEX_NAME || "platform-knowledge-base",
  pinecone_cloud : process.env.PINECONE_CLOUD || "aws",
  pinecone_region : process.env.PINECONE_REGION || "us-east-1",
  ai_model : process.env.AI_MODEL || "claude-sonnet-4-6",
  ai_max_tokens : parseInt(process.env.AI_MAX_TOKENS) || 1024,
  ai_chat_history_ttl : parseInt(process.env.AI_CHAT_HISTORY_TTL) || 86400,
  ai_chat_history_max_turns : parseInt(process.env.AI_CHAT_HISTORY_MAX_TURNS) || 20,
  ai_rate_limit_max : parseInt(process.env.AI_RATE_LIMIT_MAX) || 30,
  ai_rate_limit_window_seconds : parseInt(process.env.AI_RATE_LIMIT_WINDOW_SECONDS) || 3600,

};
