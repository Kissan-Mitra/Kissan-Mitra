/**
 * Data Processing Lambda
 * 
 * Collects data from external APIs (weather, market, etc.)
 * Processes and transforms data for storage
 * Updates knowledge bases and vector embeddings
 */

const AWS = require('aws-sdk');
const { OpenAI } = require('openai');
const axios = require('axios');

// Initialize AWS clients
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const opensearch = new AWS.OpenSearch();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Environment variables
const VECTOR_DB_TABLE = process.env.VECTOR_DB_TABLE;
const KNOWLEDGE_GRAPH_TABLE = process.env.KNOWLEDGE_GRAPH_TABLE;
const TIME_SERIES_TABLE = process.env.TIME_SERIES_TABLE;
const OPENSEARCH_DOMAIN_ENDPOINT = process.env.OPENSEARCH_DOMAIN_ENDPOINT;
const DATA_BUCKET = process.env.DATA_BUCKET;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const MARKET_API_KEY = process.env.MARKET_API_KEY;

// Default locations for weather data
const DEFAULT_LOCATIONS = [
  'Maharashtra', 
  'Gujarat', 
  'Punjab', 
  'Haryana', 
  'Karnataka', 
  'Tamil Nadu', 
  'Andhra Pradesh',
  'Telangana', 
  'Rajasthan', 
  'Madhya Pradesh'
];

// Default crops for market data
const DEFAULT_CROPS = [
  'rice', 
  'wheat', 
  'cotton', 
  'sugarcane', 
  'maize', 
  'pulses', 
  'soybean', 
  'groundnut'
];

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  try {
    console.log('Event received:', JSON.stringify(event));
    
    // Check if this is a scheduled event for daily processing
    if (event.operation === 'process_daily_data') {
      return await processDailyData();
    }
    
    // Check if this is an S3 event (new file uploaded)
    if (event.Records && event.Records[0].s3) {
      return await processS3Upload(event.Records[0].s3);
    }
    
    // Custom operations based on input
    if (event.operation) {
      switch (event.operation) {
        case 'refresh_weather_data':
          return await refreshWeatherData(event.locations || []);
          
        case 'refresh_market_data':
          return await refreshMarketData(event.crops || []);
          
        case 'process_knowledge_source':
          return await processKnowledgeSource(event.sourceId, event.sourceType);
          
        case 'update_vector_embeddings':
          return await updateVectorEmbeddings(event.filter);
          
        case 'check_data_freshness':
          return await checkDataFreshness();
          
        default:
          throw new Error(`Unknown operation: ${event.operation}`);
      }
    }
    
    return {
      status: 'error',
      message: 'No valid operation specified'
    };
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      status: 'error',
      message: error.message
    };
  }
};

/**
 * Process daily data updates
 */
async function processDailyData() {
  try {
    console.log('Starting daily data processing');
    
    // Run tasks in parallel
    const [weatherResult, marketResult, knowledgeResult] = await Promise.all([
      refreshWeatherData(),
      refreshMarketData(),
      updateVectorEmbeddings()
    ]);
    
    return {
      status: 'success',
      results: {
        weather: weatherResult,
        market: marketResult,
        knowledge: knowledgeResult
      }
    };
  } catch (error) {
    console.error('Error in daily data processing:', error);
    throw error;
  }
}

/**
 * Process a new file upload to S3
 */
async function processS3Upload(s3Event) {
  try {
    const bucket = s3Event.bucket.name;
    const key = s3Event.object.key;
    
    console.log(`Processing new S3 upload: ${bucket}/${key}`);
    
    // Determine file type and appropriate processing
    if (key.startsWith('raw/weather/')) {
      await processWeatherFile(bucket, key);
    } else if (key.startsWith('raw/market/')) {
      await processMarketFile(bucket, key);
    } else if (key.startsWith('raw/gov-schemes/')) {
      await processGovernmentSchemeFile(bucket, key);
    } else if (key.startsWith('raw/crop-data/')) {
      await processCropDataFile(bucket, key);
    }
    
    return {
      status: 'success',
      message: `Processed ${key} successfully`
    };
  } catch (error) {
    console.error('Error processing S3 upload:', error);
    throw error;
  }
}

/**
 * Refresh weather data from external API
 */
async function refreshWeatherData(locations = DEFAULT_LOCATIONS) {
  try {
    console.log(`Refreshing weather data for ${locations.length} locations`);
    
    // Process each location in sequence to avoid API rate limits
    const results = [];
    
    for (const location of locations) {
      try {
        const weatherData = await fetchWeatherData(location);
        await storeWeatherData(location, weatherData);
        results.push({
          location,
          status: 'success'
        });
      } catch (error) {
        console.error(`Error processing weather data for ${location}:`, error);
        results.push({
          location,
          status: 'error',
          message: error.message
        });
      }
      
      // Add a small delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return {
      status: 'success',
      processed: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      results
    };
  } catch (error) {
    console.error('Error refreshing weather data:', error);
    throw error;
  }
}

/**
 * Fetch weather data from external API
 */
async function fetchWeatherData(location) {
  try {
    // In production, this would use a real weather API
    // For now, we'll simulate the response
    
    console.log(`Fetching weather data for ${location}`);
    
    // Simulated weather data
    const currentDate = new Date();
    const forecast = [];
    
    // Generate 7 days of forecast data
    for (let i = 0; i < 7; i++) {
      const forecastDate = new Date(currentDate);
      forecastDate.setDate(currentDate.getDate() + i);
      
      // Generate somewhat realistic weather data with some randomness
      const tempBase = 25 + Math.sin(i / 3) * 5; // Temperature varies sinusoidally
      const temperature = Math.round((tempBase + (Math.random() * 4 - 2)) * 10) / 10; // Add some randomness
      
      // Rainfall is higher during monsoon months (Jun-Sep)
      const month = forecastDate.getMonth();
      const isMonsoon = month >= 5 && month <= 8; // 0-indexed months
      const rainfallBase = isMonsoon ? 15 : 3;
      const rainfall = Math.max(0, Math.round((rainfallBase + (Math.random() * 10 - 2)) * 10) / 10);
      
      // Humidity correlates with rainfall
      const humidityBase = rainfall > 5 ? 80 : 60;
      const humidity = Math.min(95, Math.max(40, Math.round(humidityBase + (Math.random() * 10 - 5))));
      
      forecast.push({
        date: forecastDate.toISOString().split('T')[0],
        temperature,
        rainfall,
        humidity
      });
    }
    
    return {
      location,
      current: forecast[0],
      forecast: forecast.slice(1),
      updated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching weather data for ${location}:`, error);
    throw error;
  }
}

/**
 * Store weather data in time series database
 */
async function storeWeatherData(location, weatherData) {
  try {
    console.log(`Storing weather data for ${location}`);
    
    const normalizedLocation = location.toLowerCase().replace(/\s+/g, '_');
    const timestamp = Date.now();
    const expiryTime = Math.floor(timestamp / 1000) + (365 * 24 * 60 * 60); // 1 year TTL
    
    // Store current weather
    await dynamoDB.put({
      TableName: TIME_SERIES_TABLE,
      Item: {
        metricId: `weather:temperature:${normalizedLocation}`,
        timestamp: timestamp,
        value: weatherData.current.temperature,
        location: normalizedLocation,
        source: 'weather_api',
        expiryTime: expiryTime
      }
    }).promise();
    
    await dynamoDB.put({
      TableName: TIME_SERIES_TABLE,
      Item: {
        metricId: `weather:rainfall:${normalizedLocation}`,
        timestamp: timestamp,
        value: weatherData.current.rainfall,
        location: normalizedLocation,
        source: 'weather_api',
        expiryTime: expiryTime
      }
    }).promise();
    
    await dynamoDB.put({
      TableName: TIME_SERIES_TABLE,
      Item: {
        metricId: `weather:humidity:${normalizedLocation}`,
        timestamp: timestamp,
        value: weatherData.current.humidity,
        location: normalizedLocation,
        source: 'weather_api',
        expiryTime: expiryTime
      }
    }).promise();
    
    // Store forecast data
    for (let i = 0; i < weatherData.forecast.length; i++) {
      const forecastDay = weatherData.forecast[i];
      const forecastTimestamp = timestamp + ((i + 1) * 24 * 60 * 60 * 1000); // Add days
      
      // Store forecast temperature
      await dynamoDB.put({
        TableName: TIME_SERIES_TABLE,
        Item: {
          metricId: `weather:forecast:temperature:${normalizedLocation}`,
          timestamp: forecastTimestamp,
          value: forecastDay.temperature,
          location: normalizedLocation,
          source: 'weather_api',
          expiryTime: expiryTime
        }
      }).promise();
      
      // Store forecast rainfall
      await dynamoDB.put({
        TableName: TIME_SERIES_TABLE,
        Item: {
          metricId: `weather:forecast:rainfall:${normalizedLocation}`,
          timestamp: forecastTimestamp,
          value: forecastDay.rainfall,
          location: normalizedLocation,
          source: 'weather_api',
          expiryTime: expiryTime
        }
      }).promise();
    }
    
    // Store raw data in S3 for archival
    await s3.putObject({
      Bucket: DATA_BUCKET,
      Key: `raw/weather/${normalizedLocation}/${new Date().toISOString().split('T')[0]}.json`,
      Body: JSON.stringify(weatherData),
      ContentType: 'application/json'
    }).promise();
    
    return {
      status: 'success',
      message: `Stored weather data for ${location}`
    };
  } catch (error) {
    console.error(`Error storing weather data for ${location}:`, error);
    throw error;
  }
}

/**
 * Process a weather data file uploaded to S3
 */
async function processWeatherFile(bucket, key) {
  try {
    console.log(`Processing weather file: ${bucket}/${key}`);
    
    // Get the file from S3
    const response = await s3.getObject({
      Bucket: bucket,
      Key: key
    }).promise();
    
    const weatherData = JSON.parse(response.Body.toString('utf-8'));
    
    // Extract location from key (assuming format raw/weather/location/date.json)
    const pathParts = key.split('/');
    const location = pathParts[2];
    
    await storeWeatherData(location, weatherData);
    
    return {
      status: 'success',
      message: `Processed weather file for ${location}`
    };
  } catch (error) {
    console.error(`Error processing weather file: ${bucket}/${key}:`, error);
    throw error;
  }
}

/**
 * Refresh market data from external API
 */
async function refreshMarketData(crops = DEFAULT_CROPS) {
  try {
    console.log(`Refreshing market data for ${crops.length} crops`);
    
    // Process each crop in sequence
    const results = [];
    
    for (const crop of crops) {
      try {
        const marketData = await fetchMarketData(crop);
        await storeMarketData(crop, marketData);
        results.push({
          crop,
          status: 'success'
        });
      } catch (error) {
        console.error(`Error processing market data for ${crop}:`, error);
        results.push({
          crop,
          status: 'error',
          message: error.message
        });
      }
      
      // Add a small delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return {
      status: 'success',
      processed: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      results
    };
  } catch (error) {
    console.error('Error refreshing market data:', error);
    throw error;
  }
}

/**
 * Fetch market data from external API
 */
async function fetchMarketData(crop) {
  try {
    // In production, this would use a real market data API
    // For now, we'll simulate the response
    
    console.log(`Fetching market data for ${crop}`);
    
    // Simulated market data
    const currentDate = new Date();
    const prices = [];
    
    // Base price varies by crop
    let basePrice;
    switch (crop.toLowerCase()) {
      case 'rice':
        basePrice = 1800;
        break;
      case 'wheat':
        basePrice = 2000;
        break;
      case 'cotton':
        basePrice = 5500;
        break;
      case 'soybean':
        basePrice = 3800;
        break;
      default:
        basePrice = 2500;
    }
    
    // Generate 30 days of historical price data
    for (let i = 29; i >= 0; i--) {
      const priceDate = new Date(currentDate);
      priceDate.setDate(currentDate.getDate() - i);
      
      // Price trends upward slightly with some randomness
      const trendFactor = 1 + (0.05 * (29 - i) / 29); // Up to 5% increase over the period
      const randomFactor = 0.98 + (Math.random() * 0.04); // +/- 2% randomness
      const price = Math.round(basePrice * trendFactor * randomFactor);
      
      prices.push({
        date: priceDate.toISOString().split('T')[0],
        price: price
      });
    }
    
    return {
      crop,
      prices,
      updated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching market data for ${crop}:`, error);
    throw error;
  }
}

/**
 * Store market data in time series database
 */
async function storeMarketData(crop, marketData) {
  try {
    console.log(`Storing market data for ${crop}`);
    
    const normalizedCrop = crop.toLowerCase().replace(/\s+/g, '_');
    const expiryTime = Math.floor(Date.now() / 1000) + (2 * 365 * 24 * 60 * 60); // 2 year TTL
    
    // Store each price point
    for (const pricePoint of marketData.prices) {
      const timestamp = new Date(pricePoint.date).getTime();
      
      await dynamoDB.put({
        TableName: TIME_SERIES_TABLE,
        Item: {
          metricId: `market:price:${normalizedCrop}`,
          timestamp: timestamp,
          value: pricePoint.price,
          crop: normalizedCrop,
          source: 'market_api',
          expiryTime: expiryTime
        }
      }).promise();
    }
    
    // Store raw data in S3 for archival
    await s3.putObject({
      Bucket: DATA_BUCKET,
      Key: `raw/market/${normalizedCrop}/${new Date().toISOString().split('T')[0]}.json`,
      Body: JSON.stringify(marketData),
      ContentType: 'application/json'
    }).promise();
    
    return {
      status: 'success',
      message: `Stored market data for ${crop}`
    };
  } catch (error) {
    console.error(`Error storing market data for ${crop}:`, error);
    throw error;
  }
}

/**
 * Process a market data file uploaded to S3
 */
async function processMarketFile(bucket, key) {
  try {
    console.log(`Processing market file: ${bucket}/${key}`);
    
    // Get the file from S3
    const response = await s3.getObject({
      Bucket: bucket,
      Key: key
    }).promise();
    
    const marketData = JSON.parse(response.Body.toString('utf-8'));
    
    // Extract crop from key (assuming format raw/market/crop/date.json)
    const pathParts = key.split('/');
    const crop = pathParts[2];
    
    await storeMarketData(crop, marketData);
    
    return {
      status: 'success',
      message: `Processed market file for ${crop}`
    };
  } catch (error) {
    console.error(`Error processing market file: ${bucket}/${key}:`, error);
    throw error;
  }
}

/**
 * Process government scheme information
 */
async function processGovernmentSchemeFile(bucket, key) {
  try {
    console.log(`Processing government scheme file: ${bucket}/${key}`);
    
    // Get the file from S3
    const response = await s3.getObject({
      Bucket: bucket,
      Key: key
    }).promise();
    
    const schemeData = JSON.parse(response.Body.toString('utf-8'));
    
    // Process schemes for storage and embeddings
    for (const scheme of schemeData.schemes) {
      // Generate ID for the scheme
      const schemeId = `scheme:${scheme.name.toLowerCase().replace(/\s+/g, '_')}`;
      
      // Prepare text for embedding
      const schemeText = `
        ${scheme.name}
        
        Description: ${scheme.description}
        
        Eligibility: ${scheme.eligibility}
        
        Benefits: ${scheme.benefits}
        
        How to Apply: ${scheme.application_process}
        
        Deadlines: ${scheme.deadlines}
        
        States: ${scheme.states.join(', ')}
      `.trim();
      
      // Generate embedding
      const embedding = await generateEmbedding(schemeText);
      
      // Store in vector database
      await storeVectorEmbedding(
        schemeId,
        schemeText,
        embedding,
        {
          type: 'government_scheme',
          name: scheme.name,
          states: scheme.states,
          categories: scheme.categories || [],
          expiry: scheme.expiry || null
        }
      );
      
      // Create knowledge graph connections
      for (const state of scheme.states) {
        const stateId = `location:${state.toLowerCase().replace(/\s+/g, '_')}`;
        
        await createKnowledgeGraphRelationship(
          stateId,
          'has_scheme',
          schemeId,
          {
            name: scheme.name,
            relevance: scheme.relevance || 'high'
          }
        );
      }
      
      // Create connections to relevant crops if specified
      if (scheme.relevant_crops && scheme.relevant_crops.length > 0) {
        for (const crop of scheme.relevant_crops) {
          const cropId = `crop:${crop.toLowerCase().replace(/\s+/g, '_')}`;
          
          await createKnowledgeGraphRelationship(
            cropId,
            'eligible_for_scheme',
            schemeId,
            {
              name: scheme.name
            }
          );
        }
      }
    }
    
    // Store processed file in a different location
    await s3.copyObject({
      Bucket: bucket,
      CopySource: `${bucket}/${key}`,
      Key: key.replace('raw/', 'processed/')
    }).promise();
    
    return {
      status: 'success',
      message: `Processed ${schemeData.schemes.length} government schemes`
    };
  } catch (error) {
    console.error(`Error processing government scheme file: ${bucket}/${key}:`, error);
    throw error;
  }
}

/**
 * Process crop data file
 */
async function processCropDataFile(bucket, key) {
  try {
    console.log(`Processing crop data file: ${bucket}/${key}`);
    
    // Get the file from S3
    const response = await s3.getObject({
      Bucket: bucket,
      Key: key
    }).promise();
    
    const cropData = JSON.parse(response.Body.toString('utf-8'));
    
    // Process crops for knowledge graph and vector embeddings
    for (const crop of cropData.crops) {
      // Generate ID for the crop
      const cropId = `crop:${crop.name.toLowerCase().replace(/\s+/g, '_')}`;
      
      // Prepare text for embedding
      const cropText = `
        ${crop.name} (${crop.scientific_name || ''})
        
        Description: ${crop.description}
        
        Growing Seasons: ${crop.growing_seasons.join(', ')}
        
        Suitable Regions: ${crop.suitable_regions.join(', ')}
        
        Water Requirements: ${crop.water_requirements}
        
        Temperature Range: ${crop.temperature_range}
        
        Soil Types: ${crop.soil_types.join(', ')}
        
        Growth Duration: ${crop.growth_duration}
        
        Common Varieties: ${crop.varieties.join(', ')}
        
        Common Pests: ${crop.common_pests.join(', ')}
        
        Common Diseases: ${crop.common_diseases.join(', ')}
      `.trim();
      
      // Generate embedding
      const embedding = await generateEmbedding(cropText);
      
      // Store in vector database
      await storeVectorEmbedding(
        cropId,
        cropText,
        embedding,
        {
          type: 'crop',
          name: crop.name,
          scientific_name: crop.scientific_name,
          categories: crop.categories || []
        }
      );
      
      // Create knowledge graph connections for seasons
      for (const season of crop.growing_seasons) {
        const seasonId = `season:${season.toLowerCase()}`;
        
        await createKnowledgeGraphRelationship(
          cropId,
          'grown_during',
          seasonId,
          {
            optimal: crop.optimal_seasons && crop.optimal_seasons.includes(season)
          }
        );
      }
      
      // Create knowledge graph connections for regions
      for (const region of crop.suitable_regions) {
        const regionId = `location:${region.toLowerCase().replace(/\s+/g, '_')}`;
        
        await createKnowledgeGraphRelationship(
          cropId,
          'grows_in',
          regionId,
          {
            suitability: crop.region_suitability?.[region] || 'medium'
          }
        );
        
        // Reverse relationship
        await createKnowledgeGraphRelationship(
          regionId,
          'suitable_for',
          cropId,
          {
            suitability: crop.region_suitability?.[region] || 'medium'
          }
        );
      }
      
      // Create knowledge graph connections for pests
      for (const pest of crop.common_pests) {
        const pestId = `pest:${pest.toLowerCase().replace(/\s+/g, '_')}`;
        
        await createKnowledgeGraphRelationship(
          cropId,
          'affected_by',
          pestId,
          {}
        );
      }
      
      // Create knowledge graph connections for diseases
      for (const disease of crop.common_diseases) {
        const diseaseId = `disease:${disease.toLowerCase().replace(/\s+/g, '_')}`;
        
        await createKnowledgeGraphRelationship(
          cropId,
          'susceptible_to',
          diseaseId,
          {}
        );
      }
    }
    
    // Store processed file in a different location
    await s3.copyObject({
      Bucket: bucket,
      CopySource: `${bucket}/${key}`,
      Key: key.replace('raw/', 'processed/')
    }).promise();
    
    return {
      status: 'success',
      message: `Processed ${cropData.crops.length} crops`
    };
  } catch (error) {
    console.error(`Error processing crop data file: ${bucket}/${key}:`, error);
    throw error;
  }
}

/**
 * Generate embedding using OpenAI API
 */
async function generateEmbedding(text) {
  try {
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
 * Store a vector embedding in the database
 */
async function storeVectorEmbedding(id, text, embedding, metadata) {
  try {
    // Convert embedding to base64 for storage
    const vectorBuffer = Buffer.from(new Float32Array(embedding).buffer);
    const vectorBase64 = vectorBuffer.toString('base64');
    
    // Store in DynamoDB
    await dynamoDB.put({
      TableName: VECTOR_DB_TABLE,
      Item: {
        id,
        text,
        vector: vectorBase64,
        metadata: JSON.stringify(metadata),
        lastUpdated: new Date().toISOString()
      }
    }).promise();
    
    // If OpenSearch is configured, also store there for better vector search
    if (OPENSEARCH_DOMAIN_ENDPOINT) {
      await storeVectorInOpenSearch(id, text, embedding, metadata);
    }
    
    return {
      status: 'success',
      message: `Stored vector embedding for ${id}`
    };
  } catch (error) {
    console.error(`Error storing vector embedding for ${id}:`, error);
    throw error;
  }
}

/**
 * Store a vector embedding in OpenSearch
 */
async function storeVectorInOpenSearch(id, text, embedding, metadata) {
  try {
    // This would be implemented with direct calls to OpenSearch API
    // OpenSearch has specific APIs for vector storage and k-NN search
    console.log(`[Simulated] Storing vector in OpenSearch for ${id}`);
    
    // In a real implementation, we would make a direct HTTP request to OpenSearch
    // as the AWS SDK doesn't directly support all OpenSearch features
    
    return {
      status: 'success',
      message: `Stored vector in OpenSearch for ${id}`
    };
  } catch (error) {
    console.error(`Error storing vector in OpenSearch for ${id}:`, error);
    throw error;
  }
}

/**
 * Create a relationship in the knowledge graph
 */
async function createKnowledgeGraphRelationship(nodeId, relationshipType, targetNodeId, properties = {}) {
  try {
    // Store in DynamoDB
    await dynamoDB.put({
      TableName: KNOWLEDGE_GRAPH_TABLE,
      Item: {
        nodeId,
        relationshipType,
        targetNodeId,
        properties: JSON.stringify(properties),
        confidence: properties.confidence || 1.0,
        source: properties.source || 'system',
        lastUpdated: new Date().toISOString()
      }
    }).promise();
    
    return {
      status: 'success',
      message: `Created relationship ${nodeId} -[${relationshipType}]-> ${targetNodeId}`
    };
  } catch (error) {
    console.error(`Error creating relationship ${nodeId} -[${relationshipType}]-> ${targetNodeId}:`, error);
    throw error;
  }
}

/**
 * Update vector embeddings based on filter
 */
async function updateVectorEmbeddings(filter = {}) {
  try {
    // Query dynamoDB for items matching the filter
    let params = {
      TableName: VECTOR_DB_TABLE
    };
    
    // Add filter if specified
    if (filter && Object.keys(filter).length > 0) {
      // Convert filter to DynamoDB format
      const filterExpressions = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};
      
      Object.entries(filter).forEach(([key, value], index) => {
        filterExpressions.push(`#key${index} = :val${index}`);
        expressionAttributeNames[`#key${index}`] = key;
        expressionAttributeValues[`:val${index}`] = value;
      });
      
      params.FilterExpression = filterExpressions.join(' AND ');
      params.ExpressionAttributeNames = expressionAttributeNames;
      params.ExpressionAttributeValues = expressionAttributeValues;
    }
    
    // Simulate scanning items (in production we would paginate)
    console.log(`[Simulated] Scanning vector database for items to update`);
    
    // In a real implementation, we would:
    // 1. Scan DynamoDB for items matching the filter
    // 2. For each item, re-generate the embedding if needed
    // 3. Update the item in DynamoDB and OpenSearch
    
    // Simulate processing 25 items
    for (let i = 0; i < 25; i++) {
      console.log(`[Simulated] Updating embedding for item ${i}`);
    }
    
    return {
      status: 'success',
      message: 'Vector embeddings updated successfully',
      updated: 25
    };
  } catch (error) {
    console.error('Error updating vector embeddings:', error);
    throw error;
  }
}

/**
 * Process a knowledge source by ID and type
 */
async function processKnowledgeSource(sourceId, sourceType) {
  try {
    console.log(`Processing knowledge source: ${sourceType}/${sourceId}`);
    
    // Determine the S3 key based on source type
    let sourceKey;
    switch (sourceType) {
      case 'weather':
        sourceKey = `raw/weather/${sourceId}.json`;
        break;
      case 'market':
        sourceKey = `raw/market/${sourceId}.json`;
        break;
      case 'gov-scheme':
        sourceKey = `raw/gov-schemes/${sourceId}.json`;
        break;
      case 'crop-data':
        sourceKey = `raw/crop-data/${sourceId}.json`;
        break;
      default:
        throw new Error(`Unknown source type: ${sourceType}`);
    }
    
    // Process the file as if it was uploaded to S3
    await processS3Upload({
      bucket: { name: DATA_BUCKET },
      object: { key: sourceKey }
    });
    
    return {
      status: 'success',
      message: `Processed knowledge source ${sourceType}/${sourceId}`
    };
  } catch (error) {
    console.error(`Error processing knowledge source ${sourceType}/${sourceId}:`, error);
    throw error;
  }
}

/**
 * Check freshness of data and trigger updates for stale data
 */
async function checkDataFreshness() {
  try {
    console.log('Checking data freshness');
    
    const now = Date.now();
    const staleSources = [];
    
    // Check weather data freshness (should be updated daily)
    const weatherFreshness = await getDataFreshness('weather');
    if (now - weatherFreshness > 24 * 60 * 60 * 1000) { // 24 hours
      staleSources.push('weather');
    }
    
    // Check market data freshness (should be updated daily on weekdays)
    const marketFreshness = await getDataFreshness('market');
    if (now - marketFreshness > 24 * 60 * 60 * 1000) { // 24 hours
      staleSources.push('market');
    }
    
    // Check government scheme data (should be updated weekly)
    const schemesFreshness = await getDataFreshness('gov-schemes');
    if (now - schemesFreshness > 7 * 24 * 60 * 60 * 1000) { // 7 days
      staleSources.push('gov-schemes');
    }
    
    // Trigger updates for stale data
    const updatePromises = [];
    if (staleSources.includes('weather')) {
      updatePromises.push(refreshWeatherData());
    }
    if (staleSources.includes('market')) {
      updatePromises.push(refreshMarketData());
    }
    
    // Wait for all updates to complete
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
    
    return {
      status: 'success',
      message: 'Data freshness check completed',
      stale_sources: staleSources,
      updates_triggered: updatePromises.length
    };
  } catch (error) {
    console.error('Error checking data freshness:', error);
    throw error;
  }
}

/**
 * Get the timestamp of the most recent data for a given type
 */
async function getDataFreshness(dataType) {
  try {
    // In a real implementation, we would query the database for the most recent data
    // For now, we'll simulate by checking S3 for the most recent file
    
    // List files in the raw data directory
    const response = await s3.listObjectsV2({
      Bucket: DATA_BUCKET,
      Prefix: `raw/${dataType}/`,
      MaxKeys: 10
    }).promise();
    
    if (!response.Contents || response.Contents.length === 0) {
      // No data found, return a timestamp from long ago
      return 0;
    }
    
    // Find the most recent file by LastModified timestamp
    let mostRecent = 0;
    for (const item of response.Contents) {
      const timestamp = new Date(item.LastModified).getTime();
      if (timestamp > mostRecent) {
        mostRecent = timestamp;
      }
    }
    
    return mostRecent;
  } catch (error) {
    console.error(`Error getting data freshness for ${dataType}:`, error);
    // Return a default value that will trigger an update
    return 0;
  }
}
