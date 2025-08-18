import { generateEmbedding } from '../data/vector-db';
import { createNode, createRelationship, EntityType, RelationshipType } from '../data/knowledge-graph';
import { storeTimeSeriesPoint, TimeSeriesPoint } from '../data/time-series';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed mock data for testing and development
 */

/**
 * Seed vector database with mock agricultural knowledge
 */
export async function seedMockVectorData(): Promise<void> {
  console.log('Seeding vector database with mock data...');
  
  const agricultureKnowledge = [
    {
      text: 'Rice is a kharif crop that grows well in areas with high rainfall or irrigation facilities. It requires hot and humid conditions with temperature between 25°C and 35°C.',
      metadata: {
        category: 'crop_info',
        source: 'agricultural_handbook',
        dateAdded: new Date().toISOString()
      }
    },
    {
      text: 'Wheat is a rabi crop that grows best in cool climates with moderate rainfall. It requires well-drained loamy soil and temperatures between 15°C and 25°C during growing season.',
      metadata: {
        category: 'crop_info',
        source: 'agricultural_handbook',
        dateAdded: new Date().toISOString()
      }
    },
    {
      text: 'PM-KISAN scheme provides income support of ₹6,000 per year to all farmer families across the country in three equal installments of ₹2,000 each every four months.',
      metadata: {
        category: 'government_scheme',
        source: 'ministry_of_agriculture',
        dateAdded: new Date().toISOString()
      }
    },
    {
      text: 'Bacterial leaf blight in rice can be managed by using resistant varieties, balanced fertilization, and maintaining proper spacing between plants.',
      metadata: {
        category: 'disease_management',
        source: 'plant_protection_guide',
        dateAdded: new Date().toISOString()
      }
    },
    {
      text: 'Drip irrigation can save up to 60% water compared to conventional flood irrigation methods and provides better yield by maintaining optimal soil moisture levels.',
      metadata: {
        category: 'irrigation',
        source: 'water_management_handbook',
        dateAdded: new Date().toISOString()
      }
    }
  ];
  
  // Generate embeddings and store each item in vector database
  for (const item of agricultureKnowledge) {
    // For testing purposes, we'll generate mock embeddings
    const vector = createMockEmbedding();
    
    await storeVector({
      vector,
      text: item.text,
      metadata: item.metadata
    });
  }
  
  console.log('Successfully seeded vector database with mock data');
}

/**
 * Seed knowledge graph with mock agricultural relationships
 */
export async function seedMockKnowledgeGraph(): Promise<void> {
  console.log('Seeding knowledge graph with mock relationships...');
  
  // First, create all the nodes
  const nodes = [
    { type: EntityType.CROP, name: 'Rice' },
    { type: EntityType.CROP, name: 'Wheat' },
    { type: EntityType.CROP, name: 'Cotton' },
    { type: EntityType.LOCATION, name: 'Punjab' },
    { type: EntityType.LOCATION, name: 'Gujarat' },
    { type: EntityType.SEASON, name: 'Kharif' },
    { type: EntityType.SEASON, name: 'Rabi' },
    { type: EntityType.DISEASE, name: 'Blast' },
    { type: EntityType.DISEASE, name: 'Rust' },
    { type: EntityType.SOIL_TYPE, name: 'Loamy' },
    { type: EntityType.SOIL_TYPE, name: 'Clay' }
  ];
  
  // Create all nodes
  for (const node of nodes) {
    await createNode(node);
  }
  
  // Define relationships
  const relationships = [
    // Crop to Location relationships
    {
      nodeId: 'crop:rice',
      relationshipType: RelationshipType.GROWS_IN,
      targetNodeId: 'location:punjab',
      properties: {
        confidence: 0.9,
        source: 'agricultural_handbook'
      },
      confidence: 0.9,
      source: 'agricultural_handbook'
    },
    {
      nodeId: 'crop:wheat',
      relationshipType: RelationshipType.GROWS_IN,
      targetNodeId: 'location:punjab',
      properties: {
        confidence: 0.95,
        source: 'agricultural_handbook'
      },
      confidence: 0.95,
      source: 'agricultural_handbook'
    },
    {
      nodeId: 'crop:cotton',
      relationshipType: RelationshipType.GROWS_IN,
      targetNodeId: 'location:gujarat',
      properties: {
        confidence: 0.85,
        source: 'agricultural_handbook'
      },
      confidence: 0.85,
      source: 'agricultural_handbook'
    },
    
    // Crop to Season relationships
    {
      nodeId: 'crop:rice',
      relationshipType: RelationshipType.GROWN_DURING,
      targetNodeId: 'season:kharif',
      properties: {
        confidence: 0.95,
        source: 'agricultural_handbook'
      },
      confidence: 0.95,
      source: 'agricultural_handbook'
    },
    {
      nodeId: 'crop:wheat',
      relationshipType: RelationshipType.GROWN_DURING,
      targetNodeId: 'season:rabi',
      properties: {
        confidence: 0.95,
        source: 'agricultural_handbook'
      },
      confidence: 0.95,
      source: 'agricultural_handbook'
    },
    
    // Crop to Disease relationships
    {
      nodeId: 'crop:rice',
      relationshipType: RelationshipType.SUSCEPTIBLE_TO,
      targetNodeId: 'disease:blast',
      properties: {
        confidence: 0.8,
        source: 'plant_protection_guide'
      },
      confidence: 0.8,
      source: 'plant_protection_guide'
    },
    {
      nodeId: 'crop:wheat',
      relationshipType: RelationshipType.SUSCEPTIBLE_TO,
      targetNodeId: 'disease:rust',
      properties: {
        confidence: 0.8,
        source: 'plant_protection_guide'
      },
      confidence: 0.8,
      source: 'plant_protection_guide'
    },
    
    // Soil type relationships
    {
      nodeId: 'location:punjab',
      relationshipType: RelationshipType.SUITABLE_FOR,
      targetNodeId: 'crop:wheat',
      properties: {
        confidence: 0.9,
        source: 'soil_survey'
      },
      confidence: 0.9,
      source: 'soil_survey'
    },
    {
      nodeId: 'soil:loamy',
      relationshipType: RelationshipType.SUITABLE_FOR,
      targetNodeId: 'crop:wheat',
      properties: {
        confidence: 0.9,
        source: 'soil_survey'
      },
      confidence: 0.9,
      source: 'soil_survey'
    },
    {
      nodeId: 'soil:clay',
      relationshipType: RelationshipType.SUITABLE_FOR,
      targetNodeId: 'crop:rice',
      properties: {
        confidence: 0.95,
        source: 'soil_survey'
      },
      confidence: 0.95,
      source: 'soil_survey'
    }
  ];
  
  // Create all relationships
  for (const relationship of relationships) {
    await createRelationship(relationship);
  }
  
  console.log('Successfully seeded knowledge graph with mock relationships');
}

/**
 * Seed time series database with mock weather and market data
 */
export async function seedMockTimeSeriesData(): Promise<void> {
  console.log('Seeding time series database with mock data...');
  
  await seedMockWeatherData('punjab');
  await seedMockWeatherData('gujarat');
  await seedMockMarketData('rice');
  await seedMockMarketData('wheat');
  
  console.log('Successfully seeded time series database with mock data');
}

/**
 * Generate mock weather data for a district
 */
async function seedMockWeatherData(district: string): Promise<void> {
  const districtId = district.toLowerCase().trim().replace(/\s+/g, '_');
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  
  // Generate data for the next 14 days
  for (let i = 0; i < 14; i++) {
    const timestamp = now + (i * dayInMs);
    const date = new Date(timestamp);
    
    // Generate mock temperature data
    const baseTemp = 25 + (Math.random() * 10) - 5; // Base temperature between 20-30°C
    const highTemp = baseTemp + 5 + (Math.random() * 3); // High temp 5-8°C above base
    const lowTemp = baseTemp - 5 - (Math.random() * 3); // Low temp 5-8°C below base
    
    // Generate mock rainfall data (more likely in summer months)
    const month = date.getMonth();
    const isSummerMonth = month >= 5 && month <= 8; // June to September
    const rainfall = isSummerMonth ? 
      Math.random() * 20 : // 0-20mm in summer
      Math.random() * 5;   // 0-5mm in other seasons
    
    // Generate mock humidity data
    const humidity = 50 + (Math.random() * 40); // 50-90%
    
    // Generate mock wind speed data
    const windSpeed = 2 + (Math.random() * 10); // 2-12 km/h
    
    // Store high temperature
    await storeTimeSeriesPoint({
      metricId: `weather:temperature:high:${districtId}`,
      timestamp,
      value: highTemp,
      location: {
        district
      },
      source: 'mock_data',
      unit: 'celsius'
    });
    
    // Store low temperature
    await storeTimeSeriesPoint({
      metricId: `weather:temperature:low:${districtId}`,
      timestamp,
      value: lowTemp,
      location: {
        district
      },
      source: 'mock_data',
      unit: 'celsius'
    });
    
    // Store rainfall
    await storeTimeSeriesPoint({
      metricId: `weather:rainfall:${districtId}`,
      timestamp,
      value: rainfall,
      location: {
        district
      },
      source: 'mock_data',
      unit: 'mm'
    });
    
    // Store humidity
    await storeTimeSeriesPoint({
      metricId: `weather:humidity:${districtId}`,
      timestamp,
      value: humidity,
      location: {
        district
      },
      source: 'mock_data',
      unit: 'percent'
    });
    
    // Store wind speed
    await storeTimeSeriesPoint({
      metricId: `weather:wind_speed:${districtId}`,
      timestamp,
      value: windSpeed,
      location: {
        district
      },
      source: 'mock_data',
      unit: 'km/h'
    });
  }
}

/**
 * Generate mock market price data for a crop
 */
async function seedMockMarketData(crop: string): Promise<void> {
  const cropId = crop.toLowerCase().trim().replace(/\s+/g, '_');
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  
  // Base price for different crops
  let basePrice = 0;
  switch (cropId) {
    case 'rice':
      basePrice = 2000; // ₹/quintal
      break;
    case 'wheat':
      basePrice = 2200; // ₹/quintal
      break;
    case 'cotton':
      basePrice = 6000; // ₹/quintal
      break;
    default:
      basePrice = 1800; // ₹/quintal
  }
  
  // Generate daily price data for the past 90 days
  for (let i = 90; i >= 0; i--) {
    const timestamp = now - (i * dayInMs);
    
    // Add some random fluctuation to the price
    const fluctuation = (Math.random() * 200) - 100; // +/- 100
    // Add a slight upward trend
    const trend = i > 45 ? 0 : (90 - i) * 0.5; // Slight increase in recent days
    
    const price = basePrice + fluctuation + trend;
    
    await storeTimeSeriesPoint({
      metricId: `market:price:${cropId}`,
      timestamp,
      value: price,
      source: 'mock_data',
      unit: 'INR/quintal',
      metadata: {
        market: 'national_average'
      }
    });
  }
}

/**
 * Helper function to store a vector item with its embedding
 */
async function storeVector(item: { text: string; metadata: any; vector?: number[] }): Promise<string> {
  // If vector is not provided, generate one
  const vector = item.vector || await generateEmbedding(item.text);
  
  return import('../data/vector-db').then(vectorDb => {
    return vectorDb.storeVector({
      vector,
      text: item.text,
      metadata: item.metadata
    });
  });
}

/**
 * Create a mock embedding vector
 */
function createMockEmbedding(): number[] {
  // Create a random 1536-dimensional embedding vector
  // This is just for testing - real embeddings would come from OpenAI
  const embedding = new Array(1536).fill(0).map(() => (Math.random() * 2) - 1);
  return embedding;
}

/**
 * Seed all databases with mock data
 */
export async function seedAllMockData(): Promise<void> {
  try {
    await seedMockVectorData();
    await seedMockKnowledgeGraph();
    await seedMockTimeSeriesData();
    console.log('Successfully seeded all databases with mock data');
  } catch (error) {
    console.error('Error seeding mock data:', error);
    throw error;
  }
}
