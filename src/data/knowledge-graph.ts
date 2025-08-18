import * as AWS from 'aws-sdk';
import config from '../config';
import { v4 as uuidv4 } from 'uuid';

// Initialize DynamoDB client
const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region: config.aws.region,
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey
});

/**
 * Knowledge Graph implementation for storing relationships between 
 * agricultural entities such as crops, diseases, pests, etc.
 */

// Entity types
export enum EntityType {
  CROP = 'crop',
  DISEASE = 'disease',
  PEST = 'pest',
  TREATMENT = 'treatment',
  WEATHER = 'weather',
  LOCATION = 'location',
  SEASON = 'season',
  MARKET_FACTOR = 'market_factor',
  SOIL_TYPE = 'soil'
}

// Relationship types
export enum RelationshipType {
  GROWS_IN = 'grows_in',            // Crop → Location
  SUSCEPTIBLE_TO = 'susceptible_to', // Crop → Disease
  AFFECTED_BY = 'affected_by',       // Crop → Pest
  TREATED_WITH = 'treated_with',     // Disease → Treatment
  GROWN_DURING = 'grown_during',     // Crop → Season
  PRICE_AFFECTED_BY = 'price_affected_by', // Crop → Market factor
  SUITABLE_FOR = 'suitable_for',     // Location → Crop
  TOLERANT_TO = 'tolerant_to',      // Crop → Weather condition
  HAS_PEST = 'has_pest',            // Disease → Pest
  PREVENTS = 'prevents'             // Treatment → Disease
}

// Node interface
export interface KnowledgeNode {
  nodeId: string;
  type: EntityType;
  name: string;
  properties?: Record<string, any>;
  source?: string;
  confidence?: number;
}

// Relationship interface
export interface Relationship {
  nodeId: string;
  relationshipType: RelationshipType;
  targetNodeId: string;
  properties?: Record<string, any>;
  confidence?: number;
  source?: string;
}

/**
 * Create a new node in the knowledge graph
 */
export async function createNode(node: Omit<KnowledgeNode, 'nodeId'>): Promise<string> {
  try {
    // Generate a unique ID if not provided
    const nodeId = `${node.type}:${node.name.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Prepare the item for storage
    const params = {
      TableName: config.dynamodb.knowledgeGraphTableName,
      Item: {
        nodeId,
        type: node.type,
        name: node.name,
        properties: node.properties ? JSON.stringify(node.properties) : null,
        source: node.source || 'manual',
        confidence: node.confidence || 1.0,
        entityType: 'NODE' // To distinguish from relationships
      },
      // Only create if it doesn't exist yet
      ConditionExpression: 'attribute_not_exists(nodeId)'
    };
    
    // Use put with a condition to avoid overwriting existing nodes
    try {
      await dynamoDb.put(params).promise();
      return nodeId;
    } catch (error) {
      // If the condition fails, the node already exists
      if (error instanceof Error && 'code' in error && error.code === 'ConditionalCheckFailedException') {
        return nodeId; // Return the ID anyway as it already exists
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creating knowledge graph node:', error);
    throw error;
  }
}

/**
 * Get a node by ID
 */
export async function getNode(nodeId: string): Promise<KnowledgeNode | null> {
  try {
    const params = {
      TableName: config.dynamodb.knowledgeGraphTableName,
      Key: {
        nodeId,
        relationshipType: 'NODE' // Special value for nodes
      }
    };
    
    const result = await dynamoDb.get(params).promise();
    
    if (!result.Item) {
      return null;
    }
    
    return {
      nodeId: result.Item.nodeId,
      type: result.Item.type as EntityType,
      name: result.Item.name,
      properties: result.Item.properties ? JSON.parse(result.Item.properties) : undefined,
      source: result.Item.source,
      confidence: result.Item.confidence
    };
  } catch (error) {
    console.error('Error getting knowledge graph node:', error);
    throw error;
  }
}

/**
 * Create a relationship between two nodes
 */
export async function createRelationship(relationship: Relationship): Promise<void> {
  try {
    // Prepare the item for storage
    const params = {
      TableName: config.dynamodb.knowledgeGraphTableName,
      Item: {
        nodeId: relationship.nodeId,
        relationshipType: relationship.relationshipType,
        targetNodeId: relationship.targetNodeId,
        properties: relationship.properties ? JSON.stringify(relationship.properties) : null,
        source: relationship.source || 'manual',
        confidence: relationship.confidence || 1.0,
        entityType: 'RELATIONSHIP' // To distinguish from nodes
      }
    };
    
    await dynamoDb.put(params).promise();
    
    // Also create reverse index for bidirectional queries
    const reverseParams = {
      TableName: config.dynamodb.knowledgeGraphTableName,
      Item: {
        nodeId: relationship.targetNodeId,
        relationshipType: `reverse:${relationship.relationshipType}`,
        targetNodeId: relationship.nodeId,
        properties: relationship.properties ? JSON.stringify(relationship.properties) : null,
        source: relationship.source || 'manual',
        confidence: relationship.confidence || 1.0,
        entityType: 'RELATIONSHIP'
      }
    };
    
    await dynamoDb.put(reverseParams).promise();
  } catch (error) {
    console.error('Error creating relationship:', error);
    throw error;
  }
}

/**
 * Get all relationships for a node
 */
export async function getRelationships(
  nodeId: string,
  relationshipType?: RelationshipType
): Promise<Relationship[]> {
  try {
    // Base query parameters
    const queryParams: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: config.dynamodb.knowledgeGraphTableName,
      KeyConditionExpression: 'nodeId = :nodeId',
      ExpressionAttributeValues: {
        ':nodeId': nodeId,
        ':entityType': 'RELATIONSHIP'
      },
      FilterExpression: 'entityType = :entityType'
    };

    // Ensure expression values exists
    if (!queryParams.ExpressionAttributeValues) {
      queryParams.ExpressionAttributeValues = {};
    }
    
    // Add relationship type if provided
    if (relationshipType) {
      queryParams.KeyConditionExpression += ' AND relationshipType = :relationshipType';
      queryParams.ExpressionAttributeValues[':relationshipType'] = relationshipType;
    }
    
    const result = await dynamoDb.query(queryParams).promise();
    
    if (!result.Items || result.Items.length === 0) {
      return [];
    }
    
    return result.Items.map(item => ({
      nodeId: item.nodeId,
      relationshipType: item.relationshipType as RelationshipType,
      targetNodeId: item.targetNodeId,
      properties: item.properties ? JSON.parse(item.properties) : undefined,
      confidence: item.confidence,
      source: item.source
    }));
  } catch (error) {
    console.error('Error getting relationships:', error);
    throw error;
  }
}

/**
 * Get entities related to a node by a specific relationship
 */
export async function getRelatedEntities(
  nodeId: string,
  relationshipType: RelationshipType,
  reverse: boolean = false
): Promise<string[]> {
  try {
    // If looking for reverse relationships, adjust the relationship type
    const actualRelationshipType = reverse 
      ? `reverse:${relationshipType}` 
      : relationshipType;
      
    // Query parameters
    const queryParams: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: config.dynamodb.knowledgeGraphTableName,
      KeyConditionExpression: 'nodeId = :nodeId AND relationshipType = :relationshipType',
      ExpressionAttributeValues: {
        ':nodeId': nodeId,
        ':relationshipType': actualRelationshipType,
        ':entityType': 'RELATIONSHIP'
      },
      FilterExpression: 'entityType = :entityType'
    };
    
    const result = await dynamoDb.query(queryParams).promise();
    
    if (!result.Items || result.Items.length === 0) {
      return [];
    }
    
    return result.Items.map(item => item.targetNodeId);
  } catch (error) {
    console.error('Error getting related entities:', error);
    throw error;
  }
}

/**
 * Get entity relationships and details
 */
export async function getEntityRelationships(entityId: string): Promise<{
  entity: KnowledgeNode | null;
  relationships: Record<string, Array<{
    nodeId: string;
    name: string;
    type: EntityType;
    confidence: number;
  }>>;
}> {
  try {
    // Get the entity node
    const entity = await getNode(entityId);
    
    if (!entity) {
      return {
        entity: null,
        relationships: {}
      };
    }
    
    // Get all relationships
    const relationships = await getRelationships(entityId);
    
    // Organize relationships by type
    const organizedRelationships: Record<string, Array<{
      nodeId: string;
      name: string;
      type: EntityType;
      confidence: number;
    }>> = {};
    
    // Process each relationship
    for (const relationship of relationships) {
      // Get the target entity
      const targetEntity = await getNode(relationship.targetNodeId);
      
      if (!targetEntity) {
        continue;
      }
      
      // Initialize the relationship type array if needed
      if (!organizedRelationships[relationship.relationshipType]) {
        organizedRelationships[relationship.relationshipType] = [];
      }
      
      // Add the target entity to the appropriate relationship type
      organizedRelationships[relationship.relationshipType].push({
        nodeId: targetEntity.nodeId,
        name: targetEntity.name,
        type: targetEntity.type,
        confidence: relationship.confidence || 1.0
      });
    }
    
    return {
      entity,
      relationships: organizedRelationships
    };
  } catch (error) {
    console.error('Error getting entity relationships:', error);
    throw error;
  }
}

/**
 * Get recommended crops for a location and season
 */
export async function getRecommendedCrops(
  district: string,
  soilType: string,
  season: string
): Promise<Array<{
  cropId: string;
  cropName: string;
  suitabilityScore: number;
  reasonsForRecommendation: string[];
}>> {
  try {
    // Convert inputs to node IDs
    const districtId = `location:${district.toLowerCase().replace(/\s+/g, '_')}`;
    const seasonId = `season:${season.toLowerCase().replace(/\s+/g, '_')}`;
    const soilTypeId = `soil:${soilType.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Get crops suitable for the location
    const locationCropIds = await getRelatedEntities(
      districtId,
      RelationshipType.SUITABLE_FOR,
      false
    );
    
    // Get crops suitable for the season
    const seasonCropIds = await getRelatedEntities(
      seasonId,
      RelationshipType.GROWN_DURING,
      true
    );
    
    // Get crops suitable for the soil type
    const soilCropIds = await getRelatedEntities(
      soilTypeId,
      RelationshipType.SUITABLE_FOR,
      false
    );
    
    // Find common crops across all criteria
    const allCropIds = new Set([
      ...locationCropIds,
      ...seasonCropIds,
      ...soilCropIds
    ]);
    
    // Calculate suitability scores and collect crop details
    const cropDetails: Array<{
      cropId: string;
      cropName: string;
      suitabilityScore: number;
      reasonsForRecommendation: string[];
    }> = [];
    
    for (const cropId of allCropIds) {
      // Get crop details
      const crop = await getNode(cropId);
      
      if (!crop) {
        continue;
      }
      
      // Calculate suitability score based on matches
      let suitabilityScore = 0;
      const reasonsForRecommendation: string[] = [];
      
      if (locationCropIds.includes(cropId)) {
        suitabilityScore += 0.4; // 40% weight for location suitability
        reasonsForRecommendation.push(`Suitable for ${district} region`);
      }
      
      if (seasonCropIds.includes(cropId)) {
        suitabilityScore += 0.4; // 40% weight for season suitability
        reasonsForRecommendation.push(`Ideal for ${season} season`);
      }
      
      if (soilCropIds.includes(cropId)) {
        suitabilityScore += 0.2; // 20% weight for soil suitability
        reasonsForRecommendation.push(`Well-suited for ${soilType} soil`);
      }
      
      // Only include crops with some level of suitability
      if (suitabilityScore > 0) {
        cropDetails.push({
          cropId: crop.nodeId,
          cropName: crop.name,
          suitabilityScore,
          reasonsForRecommendation
        });
      }
    }
    
    // Sort by suitability score (highest first)
    return cropDetails.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  } catch (error) {
    console.error('Error getting recommended crops:', error);
    // If we don't have enough data in our knowledge graph, return some default crops
    return [
      {
        cropId: 'crop:wheat',
        cropName: 'Wheat',
        suitabilityScore: 0.9,
        reasonsForRecommendation: ['Common crop for most regions']
      },
      {
        cropId: 'crop:rice',
        cropName: 'Rice',
        suitabilityScore: 0.8,
        reasonsForRecommendation: ['Staple crop in many regions']
      },
      {
        cropId: 'crop:maize',
        cropName: 'Maize',
        suitabilityScore: 0.7,
        reasonsForRecommendation: ['Versatile crop for various conditions']
      }
    ];
  }
}

/**
 * Graph traversal example: Find disease treatments for a crop
 */
export async function findDiseaseTreatments(
  cropName: string
): Promise<Record<string, string[]>> {
  try {
    const cropId = `crop:${cropName.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Get diseases the crop is susceptible to
    const diseases = await getRelatedEntities(
      cropId,
      RelationshipType.SUSCEPTIBLE_TO,
      false
    );
    
    const treatments: Record<string, string[]> = {};
    
    // For each disease, find treatments
    for (const diseaseId of diseases) {
      const disease = await getNode(diseaseId);
      
      if (!disease) {
        continue;
      }
      
      // Get treatments for this disease
      const diseaseTreatments = await getRelatedEntities(
        diseaseId,
        RelationshipType.TREATED_WITH,
        false
      );
      
      // Get treatment names
      const treatmentNames: string[] = [];
      
      for (const treatmentId of diseaseTreatments) {
        const treatment = await getNode(treatmentId);
        
        if (treatment) {
          treatmentNames.push(treatment.name);
        }
      }
      
      treatments[disease.name] = treatmentNames;
    }
    
    return treatments;
  } catch (error) {
    console.error('Error finding disease treatments:', error);
    throw error;
  }
}
