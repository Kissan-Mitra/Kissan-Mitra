import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

interface Config {
  // AWS Configuration
  aws: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  
  // DynamoDB Tables
  dynamodb: {
    vectorDbTableName: string;
    knowledgeGraphTableName: string;
    timeSeriesTableName: string;
  };
  
  // OpenAI Configuration
  openai: {
    apiKey: string;
    model: string;
    voiceId: string;
  };
  
  // Twilio Configuration
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  
  // Application Configuration
  app: {
    port: number;
    nodeEnv: string;
    logLevel: string;
  };
  
  // Development Settings
  environment: string;
  mockEmbeddings: boolean;
}

export const config: Config = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  },
  
  dynamodb: {
    vectorDbTableName: process.env.VECTOR_DB_TABLE_NAME || 'KissanMitraVectorDB',
    knowledgeGraphTableName: process.env.KNOWLEDGE_GRAPH_TABLE_NAME || 'KissanMitraKnowledgeGraph',
    timeSeriesTableName: process.env.TIME_SERIES_TABLE_NAME || 'KissanMitraTimeSeries'
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    voiceId: process.env.OPENAI_VOICE_ID || 'nova'
  },
  
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
  },
  
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  
  // Development Settings
  environment: process.env.NODE_ENV || 'development',
  mockEmbeddings: process.env.MOCK_EMBEDDINGS === 'true' || true
};

// Validate required configuration
function validateConfig() {
  const requiredEnvVars = [
    { key: 'OPENAI_API_KEY', name: 'OpenAI API Key' },
    { key: 'TWILIO_ACCOUNT_SID', name: 'Twilio Account SID' },
    { key: 'TWILIO_AUTH_TOKEN', name: 'Twilio Auth Token' }
  ];

  if (process.env.NODE_ENV === 'development') {
    // In development, we can use mock values
    return;
  }

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar.key]) {
      console.error(`Error: ${envVar.name} (${envVar.key}) is required but not set.`);
      process.exit(1);
    }
  }
}

// Only validate in production
if (process.env.NODE_ENV === 'production') {
  validateConfig();
}

export default config;
