import * as AWS from 'aws-sdk';
import config from '../config';
import { v4 as uuidv4 } from 'uuid';
import { OpenAI } from 'openai';

// Initialize clients
const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region: config.aws.region,
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey
});

// Initialize OpenAI for embeddings
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Vector Database implementation for semantic search capabilities
 * Uses DynamoDB as the storage layer and OpenAI embeddings
 */

// Vector item interface
export interface VectorItem {
  id: string;
  vector: number[];
  text: string;
  metadata: {
    category?: string;
    source?: string;
    dateAdded?: string;
    [key: string]: any;
  };
}

/**
 * Generate an embedding vector for text using OpenAI's embeddings API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (config.environment === 'development' && config.mockEmbeddings) {
      // Return mock embedding vector for testing
      return createMockEmbedding();
    }
    
    // Use OpenAI to generate embedding
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Store a vector item in DynamoDB
 */
export async function storeVector({
  vector,
  text,
  metadata,
  id = uuidv4()
}: {
  vector: number[];
  text: string;
  metadata: Record<string, any>;
  id?: string;
}): Promise<string> {
  try {
    // Convert vector to binary for storage
    const vectorBase64 = Buffer.from(
      Float32Array.from(vector).buffer
    ).toString('base64');
    
    // Prepare the item for storage
    const params = {
      TableName: config.dynamodb.vectorDbTableName,
      Item: {
        id,
        vector: vectorBase64,
        text,
        metadata: JSON.stringify(metadata),
        lastUpdated: new Date().toISOString()
      }
    };
    
    await dynamoDb.put(params).promise();
    return id;
  } catch (error) {
    console.error('Error storing vector:', error);
    throw error;
  }
}

/**
 * Get a vector item by ID
 */
export async function getVector(id: string): Promise<VectorItem | null> {
  try {
    const params = {
      TableName: config.dynamodb.vectorDbTableName,
      Key: { id }
    };
    
    const result = await dynamoDb.get(params).promise();
    
    if (!result.Item) {
      return null;
    }
    
    // Convert base64 back to vector
    const vectorBase64 = result.Item.vector;
    const buffer = Buffer.from(vectorBase64, 'base64');
    const vector = Array.from(new Float32Array(buffer.buffer));
    
    return {
      id: result.Item.id,
      vector,
      text: result.Item.text,
      metadata: JSON.parse(result.Item.metadata)
    };
  } catch (error) {
    console.error('Error getting vector:', error);
    throw error;
  }
}

/**
 * Search for vectors by similarity to a query vector
 */
export async function searchVectors(
  queryVector: number[],
  metadataFilter?: Record<string, any>,
  top_k: number = 5
): Promise<VectorItem[]> {
  try {
    // Scan the entire table
    // In a production system, we would use approximate nearest neighbor search
    const params: AWS.DynamoDB.DocumentClient.ScanInput = {
      TableName: config.dynamodb.vectorDbTableName
    };
    
    const result = await dynamoDb.scan(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
      return [];
    }
    
    // Calculate similarity for each item
    const itemsWithSimilarity = await Promise.all(result.Items.map(async (item) => {
      // Convert base64 back to vector
      const vectorBase64 = item.vector;
      const buffer = Buffer.from(vectorBase64, 'base64');
      const vector = Array.from(new Float32Array(buffer.buffer));
      
      // Calculate cosine similarity
      const similarity = cosineSimilarity(queryVector, vector);
      
      // Parse metadata
      const metadata = JSON.parse(item.metadata);
      
      // Filter based on metadata if specified
      if (metadataFilter) {
        for (const [key, value] of Object.entries(metadataFilter)) {
          if (metadata[key] !== value) {
            return null; // Skip this item
          }
        }
      }
      
      return {
        id: item.id,
        vector,
        text: item.text,
        metadata,
        similarity
      };
    }));
    
    // Filter out null items and sort by similarity (highest first)
    const filteredItems = itemsWithSimilarity
      .filter(item => item !== null) as (VectorItem & { similarity: number })[];
    
    filteredItems.sort((a, b) => b.similarity - a.similarity);
    
    // Return the top k items (removing similarity from the result)
    return filteredItems
      .slice(0, top_k)
      .map(({ id, vector, text, metadata }) => ({
        id,
        vector,
        text,
        metadata
      }));
  } catch (error) {
    console.error('Error searching vectors:', error);
    throw error;
  }
}

/**
 * Search for vectors by text query
 */
export async function searchVectorsByText(
  query: string,
  metadataFilter?: Record<string, any>,
  top_k: number = 5
): Promise<VectorItem[]> {
  try {
    // Generate embedding for the query
    const queryVector = await generateEmbedding(query);
    
    // Search vectors by similarity
    return searchVectors(queryVector, metadataFilter, top_k);
  } catch (error) {
    console.error('Error searching vectors by text:', error);
    throw error;
  }
}

/**
 * Delete a vector item by ID
 */
export async function deleteVector(id: string): Promise<void> {
  try {
    const params = {
      TableName: config.dynamodb.vectorDbTableName,
      Key: { id }
    };
    
    await dynamoDb.delete(params).promise();
  } catch (error) {
    console.error('Error deleting vector:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimensions');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

/**
 * Create a mock embedding vector for testing purposes
 */
export function createMockEmbedding(): number[] {
  // Create a random 1536-dimensional embedding vector
  // This is just for testing - real embeddings would come from OpenAI
  return new Array(1536).fill(0).map(() => (Math.random() * 2) - 1);
}
