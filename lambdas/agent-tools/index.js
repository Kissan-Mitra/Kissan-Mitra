/**
 * Agent Tools Lambda
 * 
 * Implements tool functions called by the OpenAI Voice Agent
 * Retrieves data from databases and external services
 * Transforms data for agent consumption
 */

const AWS = require('aws-sdk');
const { OpenAI } = require('openai');

// Initialize AWS clients
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

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

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  try {
    console.log('Event received:', JSON.stringify(event));
    
    const { function: functionName, arguments: args, sessionId, language = 'en-IN' } = event;
    
    // Parse arguments (they come as a JSON string)
    let parsedArgs;
    try {
      parsedArgs = JSON.parse(args);
    } catch (error) {
      console.error('Error parsing arguments:', error);
      parsedArgs = {};
    }
    
    // Execute the requested function
    let result;
    switch (functionName) {
      case 'get_weather_forecast':
        result = await getWeatherForecast(parsedArgs, language);
        break;
        
      case 'get_crop_recommendations':
        result = await getCropRecommendations(parsedArgs, language);
        break;
        
      case 'get_market_prices':
        result = await getMarketPrices(parsedArgs, language);
        break;
        
      case 'check_government_schemes':
        result = await checkGovernmentSchemes(parsedArgs, language);
        break;
        
      case 'get_pest_management':
        result = await getPestManagement(parsedArgs, language);
        break;
        
      case 'search_agricultural_knowledge':
        result = await searchAgriculturalKnowledge(parsedArgs, language);
        break;
        
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
    
    return {
      function: functionName,
      result: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      error: error.message,
      result: JSON.stringify({
        error: error.message
      })
    };
  }
};

/**
 * Get weather forecast for a location
 */
async function getWeatherForecast(args, language) {
  try {
    const { district, days = 7 } = args;
    
    if (!district) {
      throw new Error('District is required');
    }
    
    // Normalize district name
    const normalizedDistrict = district.toLowerCase().replace(/\s+/g, '_');
    
    console.log(`Getting weather forecast for ${district} for ${days} days`);
    
    // Get current weather data
    const currentWeather = await getTimeSeriesData(
      `weather:temperature:${normalizedDistrict}`,
      `weather:rainfall:${normalizedDistrict}`,
      `weather:humidity:${normalizedDistrict}`
    );
    
    // Get forecast data
    const forecastTemperatures = await getForecastData(
      `weather:forecast:temperature:${normalizedDistrict}`,
      days
    );
    
    const forecastRainfall = await getForecastData(
      `weather:forecast:rainfall:${normalizedDistrict}`,
      days
    );
    
    // Format the data for the agent
    const current = {
      temperature: currentWeather.temperature?.value || 'Unknown',
      rainfall: currentWeather.rainfall?.value || 'Unknown',
      humidity: currentWeather.humidity?.value || 'Unknown',
      timestamp: currentWeather.temperature?.timestamp || Date.now()
    };
    
    // Build forecast array
    const forecast = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      
      // Find matching forecast data for this day
      const dayTemp = forecastTemperatures.find(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate.getDate() === date.getDate() &&
               itemDate.getMonth() === date.getMonth();
      });
      
      const dayRain = forecastRainfall.find(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate.getDate() === date.getDate() &&
               itemDate.getMonth() === date.getMonth();
      });
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        temperature: dayTemp?.value || 'Unknown',
        rainfall: dayRain?.value || 'Unknown'
      });
    }
    
    // Add agricultural advice based on weather
    const advice = generateWeatherAdvice(current, forecast, language);
    
    return {
      district,
      current,
      forecast,
      advice
    };
  } catch (error) {
    console.error(`Error getting weather forecast:`, error);
    throw error;
  }
}

/**
 * Get crop recommendations based on location, season, and soil type
 */
async function getCropRecommendations(args, language) {
  try {
    const { district, season, soil_type = 'medium' } = args;
    
    if (!district || !season) {
      throw new Error('District and season are required');
    }
    
    // Normalize district and season names
    const normalizedDistrict = district.toLowerCase().replace(/\s+/g, '_');
    const normalizedSeason = season.toLowerCase();
    
    console.log(`Getting crop recommendations for ${district} in ${season} season with ${soil_type} soil`);
    
    // Query the knowledge graph to find suitable crops for this district
    const districtId = `location:${normalizedDistrict}`;
    const suitableCropsForLocation = await getKnowledgeGraphRelationships(
      districtId,
      'suitable_for'
    );
    
    // Filter crops that are suitable for the specified season
    const seasonalCrops = [];
    for (const crop of suitableCropsForLocation) {
      // Check if this crop grows in the specified season
      const cropId = crop.targetNodeId;
      const cropSeasons = await getKnowledgeGraphRelationships(
        cropId,
        'grown_during'
      );
      
      // If the crop grows in this season, add it to the list
      const growsInSeason = cropSeasons.some(s => 
        s.targetNodeId === `season:${normalizedSeason}` || 
        s.targetNodeId.includes(normalizedSeason)
      );
      
      if (growsInSeason) {
        // Get crop details from vector database
        const cropDetails = await getVectorDatabaseItem(cropId);
        if (cropDetails) {
          // Check if soil type is suitable
          const metadata = JSON.parse(cropDetails.metadata || '{}');
          const suitability = crop.properties.suitability || 'medium';
          
          seasonalCrops.push({
            id: cropId,
            name: metadata.name || cropId.replace('crop:', '').replace(/_/g, ' '),
            suitability,
            details: cropDetails.text
          });
        }
      }
    }
    
    // Sort crops by suitability
    seasonalCrops.sort((a, b) => {
      const suitabilityScore = {
        'high': 3,
        'medium': 2,
        'low': 1
      };
      return (suitabilityScore[b.suitability] || 0) - (suitabilityScore[a.suitability] || 0);
    });
    
    // Get current weather trends for the district
    const weatherTrends = await getWeatherTrends(normalizedDistrict);
    
    // Generate recommendations based on crops and weather
    const recommendations = generateCropRecommendations(
      seasonalCrops.slice(0, 5),
      weatherTrends,
      soil_type,
      language
    );
    
    return {
      district,
      season,
      soil_type,
      weather_conditions: {
        temperature: weatherTrends.avgTemperature,
        rainfall: weatherTrends.totalRainfall,
        humidity: weatherTrends.avgHumidity
      },
      recommended_crops: recommendations
    };
  } catch (error) {
    console.error(`Error getting crop recommendations:`, error);
    throw error;
  }
}

/**
 * Get market prices for a crop
 */
async function getMarketPrices(args, language) {
  try {
    const { crop, market_area = 'all' } = args;
    
    if (!crop) {
      throw new Error('Crop is required');
    }
    
    // Normalize crop name
    const normalizedCrop = crop.toLowerCase().replace(/\s+/g, '_');
    
    console.log(`Getting market prices for ${crop} in ${market_area}`);
    
    // Get recent price data
    const priceData = await getTimeSeriesData(
      `market:price:${normalizedCrop}`,
      null,
      null,
      30 // Last 30 days
    );
    
    // Sort by timestamp and extract just the prices
    let prices = [];
    if (priceData.price) {
      prices = priceData.price
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(item => ({
          date: new Date(item.timestamp).toISOString().split('T')[0],
          price: item.value
        }));
    }
    
    // Calculate trends
    const trends = analyzeMarketTrends(prices);
    
    // Add market advice
    const advice = generateMarketAdvice(trends, crop, language);
    
    return {
      crop,
      market_area,
      current_price: prices.length > 0 ? prices[prices.length - 1].price : null,
      price_history: prices,
      trends,
      advice
    };
  } catch (error) {
    console.error(`Error getting market prices:`, error);
    throw error;
  }
}

/**
 * Check government schemes available for farmers
 */
async function checkGovernmentSchemes(args, language) {
  try {
    const { farmer_type = 'all', crop_type = 'all', state } = args;
    
    if (!state) {
      throw new Error('State is required');
    }
    
    // Normalize state name
    const normalizedState = state.toLowerCase().replace(/\s+/g, '_');
    
    console.log(`Checking government schemes for ${farmer_type} farmers growing ${crop_type} in ${state}`);
    
    // Query the knowledge graph to find schemes for this state
    const stateId = `location:${normalizedState}`;
    const stateSchemes = await getKnowledgeGraphRelationships(
      stateId,
      'has_scheme'
    );
    
    // If crop type is specified, also get schemes for that crop
    let cropSchemes = [];
    if (crop_type !== 'all') {
      const normalizedCrop = crop_type.toLowerCase().replace(/\s+/g, '_');
      const cropId = `crop:${normalizedCrop}`;
      cropSchemes = await getKnowledgeGraphRelationships(
        cropId,
        'eligible_for_scheme'
      );
    }
    
    // Combine schemes and remove duplicates
    const allSchemeIds = new Set([
      ...stateSchemes.map(s => s.targetNodeId),
      ...cropSchemes.map(s => s.targetNodeId)
    ]);
    
    // Get details for each scheme
    const schemes = [];
    for (const schemeId of allSchemeIds) {
      // Get scheme details from vector database
      const schemeDetails = await getVectorDatabaseItem(schemeId);
      if (schemeDetails) {
        const metadata = JSON.parse(schemeDetails.metadata || '{}');
        
        // Check if scheme is applicable for the farmer type
        // For simplicity, assume all schemes apply unless explicitly filtered
        let applies = true;
        if (farmer_type !== 'all' && metadata.farmer_type && 
            metadata.farmer_type !== farmer_type && 
            !metadata.farmer_type.includes(farmer_type)) {
          applies = false;
        }
        
        if (applies) {
          schemes.push({
            id: schemeId,
            name: metadata.name || schemeId.replace('scheme:', '').replace(/_/g, ' '),
            details: schemeDetails.text,
            expiry: metadata.expiry
          });
        }
      }
    }
    
    return {
      state,
      farmer_type,
      crop_type,
      schemes: schemes.map(s => ({
        name: s.name,
        description: extractSchemeDescription(s.details),
        eligibility: extractSchemeEligibility(s.details),
        benefits: extractSchemeBenefits(s.details),
        how_to_apply: extractSchemeApplication(s.details),
        expiry: s.expiry
      }))
    };
  } catch (error) {
    console.error(`Error checking government schemes:`, error);
    throw error;
  }
}

/**
 * Get pest management advice
 */
async function getPestManagement(args, language) {
  try {
    const { crop, pest } = args;
    
    if (!crop) {
      throw new Error('Crop is required');
    }
    
    // Normalize crop name
    const normalizedCrop = crop.toLowerCase().replace(/\s+/g, '_');
    const cropId = `crop:${normalizedCrop}`;
    
    console.log(`Getting pest management advice for ${crop}`);
    
    // If specific pest is provided, get info for that pest
    if (pest) {
      const normalizedPest = pest.toLowerCase().replace(/\s+/g, '_');
      const pestId = `pest:${normalizedPest}`;
      
      // Check if this pest affects the specified crop
      const cropPests = await getKnowledgeGraphRelationships(
        cropId,
        'affected_by'
      );
      
      const pestAffectsCrop = cropPests.some(p => p.targetNodeId === pestId);
      
      if (pestAffectsCrop) {
        // Search vector database for pest management info
        const searchQuery = `pest management for ${pest} in ${crop}`;
        const searchResults = await searchVectorDatabase(searchQuery);
        
        if (searchResults.length > 0) {
          return {
            crop,
            pest,
            management_methods: extractPestManagementMethods(searchResults[0].text),
            organic_solutions: extractOrganicSolutions(searchResults),
            chemical_solutions: extractChemicalSolutions(searchResults),
            preventive_measures: extractPreventiveMeasures(searchResults)
          };
        }
      }
      
      // If no specific info found, return general pest management advice
      return getGeneralPestManagementAdvice(crop, pest);
    } else {
      // Get all pests that affect this crop
      const cropPests = await getKnowledgeGraphRelationships(
        cropId,
        'affected_by'
      );
      
      // Get management advice for common pests
      const pestAdvice = [];
      for (const pest of cropPests.slice(0, 3)) { // Limit to 3 most common pests
        const pestId = pest.targetNodeId;
        
        // Get pest details from vector database
        const pestDetails = await getVectorDatabaseItem(pestId);
        if (pestDetails) {
          pestAdvice.push({
            pest: pestId.replace('pest:', '').replace(/_/g, ' '),
            management: extractPestManagementMethods(pestDetails.text)
          });
        }
      }
      
      return {
        crop,
        common_pests: pestAdvice,
        general_advice: getGeneralPestManagementAdvice(crop)
      };
    }
  } catch (error) {
    console.error(`Error getting pest management advice:`, error);
    throw error;
  }
}

/**
 * Search agricultural knowledge for a query
 */
async function searchAgriculturalKnowledge(args, language) {
  try {
    const { query, category = 'all' } = args;
    
    if (!query) {
      throw new Error('Query is required');
    }
    
    console.log(`Searching agricultural knowledge for: ${query} in category: ${category}`);
    
    // Search vector database
    const searchResults = await searchVectorDatabase(query);
    
    // Filter by category if specified
    let filteredResults = searchResults;
    if (category !== 'all') {
      filteredResults = searchResults.filter(result => {
        const metadata = JSON.parse(result.metadata || '{}');
        return metadata.type === category || 
               (metadata.categories && metadata.categories.includes(category));
      });
      
      // If no results after filtering, fall back to all results
      if (filteredResults.length === 0) {
        filteredResults = searchResults;
      }
    }
    
    // Format the results
    const formattedResults = filteredResults.slice(0, 3).map(result => {
      const metadata = JSON.parse(result.metadata || '{}');
      return {
        title: metadata.name || result.id.replace(/^[^:]+:/, '').replace(/_/g, ' '),
        text: result.text,
        type: metadata.type || 'unknown',
        similarity: result.similarity || 0
      };
    });
    
    return {
      query,
      category,
      results: formattedResults
    };
  } catch (error) {
    console.error(`Error searching agricultural knowledge:`, error);
    throw error;
  }
}

/**
 * Get time series data points
 */
async function getTimeSeriesData(primaryMetric, secondaryMetric = null, tertiaryMetric = null, days = 7) {
  try {
    const now = Date.now();
    const startTime = now - (days * 24 * 60 * 60 * 1000); // days in milliseconds
    
    // Get primary metric data
    const primaryResult = await dynamoDB.query({
      TableName: TIME_SERIES_TABLE,
      KeyConditionExpression: 'metricId = :metricId AND timestamp >= :startTime',
      ExpressionAttributeValues: {
        ':metricId': primaryMetric,
        ':startTime': startTime
      },
      ScanIndexForward: true // ascending order by timestamp
    }).promise();
    
    // Get secondary metric data if specified
    let secondaryResult = { Items: [] };
    if (secondaryMetric) {
      secondaryResult = await dynamoDB.query({
        TableName: TIME_SERIES_TABLE,
        KeyConditionExpression: 'metricId = :metricId AND timestamp >= :startTime',
        ExpressionAttributeValues: {
          ':metricId': secondaryMetric,
          ':startTime': startTime
        },
        ScanIndexForward: true
      }).promise();
    }
    
    // Get tertiary metric data if specified
    let tertiaryResult = { Items: [] };
    if (tertiaryMetric) {
      tertiaryResult = await dynamoDB.query({
        TableName: TIME_SERIES_TABLE,
        KeyConditionExpression: 'metricId = :metricId AND timestamp >= :startTime',
        ExpressionAttributeValues: {
          ':metricId': tertiaryMetric,
          ':startTime': startTime
        },
        ScanIndexForward: true
      }).promise();
    }
    
    // Format the results
    const result = {};
    
    // Extract metric name from the ID (e.g., 'weather:temperature:location' -> 'temperature')
    const primaryName = primaryMetric.split(':')[1] || 'primary';
    result[primaryName] = primaryResult.Items.map(item => ({
      timestamp: item.timestamp,
      value: item.value,
      source: item.source
    }));
    
    if (secondaryMetric) {
      const secondaryName = secondaryMetric.split(':')[1] || 'secondary';
      result[secondaryName] = secondaryResult.Items.map(item => ({
        timestamp: item.timestamp,
        value: item.value,
        source: item.source
      }));
    }
    
    if (tertiaryMetric) {
      const tertiaryName = tertiaryMetric.split(':')[1] || 'tertiary';
      result[tertiaryName] = tertiaryResult.Items.map(item => ({
        timestamp: item.timestamp,
        value: item.value,
        source: item.source
      }));
    }
    
    return result;
  } catch (error) {
    console.error('Error getting time series data:', error);
    throw error;
  }
}

/**
 * Get forecast data from time series database
 */
async function getForecastData(metricId, days = 7) {
  try {
    const now = Date.now();
    const endTime = now + (days * 24 * 60 * 60 * 1000); // days in milliseconds
    
    const result = await dynamoDB.query({
      TableName: TIME_SERIES_TABLE,
      KeyConditionExpression: 'metricId = :metricId AND timestamp BETWEEN :startTime AND :endTime',
      ExpressionAttributeValues: {
        ':metricId': metricId,
        ':startTime': now,
        ':endTime': endTime
      },
      ScanIndexForward: true // ascending order by timestamp
    }).promise();
    
    return result.Items.map(item => ({
      timestamp: item.timestamp,
      value: item.value,
      source: item.source
    }));
  } catch (error) {
    console.error('Error getting forecast data:', error);
    throw error;
  }
}

/**
 * Get relationships from the knowledge graph
 */
async function getKnowledgeGraphRelationships(nodeId, relationshipType = null) {
  try {
    let params = {
      TableName: KNOWLEDGE_GRAPH_TABLE,
      KeyConditionExpression: 'nodeId = :nodeId'
    };
    
    // Add relationship type filter if specified
    if (relationshipType) {
      params.KeyConditionExpression += ' AND relationshipType = :relType';
      params.ExpressionAttributeValues = {
        ':nodeId': nodeId,
        ':relType': relationshipType
      };
    } else {
      params.ExpressionAttributeValues = {
        ':nodeId': nodeId
      };
    }
    
    const result = await dynamoDB.query(params).promise();
    
    return result.Items.map(item => ({
      nodeId: item.nodeId,
      relationshipType: item.relationshipType,
      targetNodeId: item.targetNodeId,
      properties: JSON.parse(item.properties || '{}'),
      confidence: item.confidence
    }));
  } catch (error) {
    console.error('Error getting knowledge graph relationships:', error);
    throw error;
  }
}

/**
 * Get an item from the vector database by ID
 */
async function getVectorDatabaseItem(id) {
  try {
    const result = await dynamoDB.get({
      TableName: VECTOR_DB_TABLE,
      Key: { id }
    }).promise();
    
    if (!result.Item) {
      return null;
    }
    
    return {
      id: result.Item.id,
      text: result.Item.text,
      metadata: result.Item.metadata,
      lastUpdated: result.Item.lastUpdated
    };
  } catch (error) {
    console.error('Error getting vector database item:', error);
    throw error;
  }
}

/**
 * Search the vector database
 */
async function searchVectorDatabase(query, topK = 5) {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    // If OpenSearch is available, use it for the search
    if (OPENSEARCH_DOMAIN_ENDPOINT) {
      return await searchOpenSearch(query, embedding, topK);
    }
    
    // Otherwise, perform a simple scan and vector similarity calculation
    const result = await dynamoDB.scan({
      TableName: VECTOR_DB_TABLE
    }).promise();
    
    // Calculate similarity for each item
    const items = result.Items.map(item => {
      const vectorBase64 = item.vector;
      // Convert from base64 to float32array
      const vectorBuffer = Buffer.from(vectorBase64, 'base64');
      const vectorArray = new Float32Array(vectorBuffer.buffer);
      
      // Calculate cosine similarity
      const similarity = cosineSimilarity(embedding, Array.from(vectorArray));
      
      return {
        id: item.id,
        text: item.text,
        metadata: item.metadata,
        similarity
      };
    });
    
    // Sort by similarity (highest first) and take top K
    items.sort((a, b) => b.similarity - a.similarity);
    return items.slice(0, topK);
  } catch (error) {
    console.error('Error searching vector database:', error);
    throw error;
  }
}

/**
 * Search OpenSearch for similar vectors
 */
async function searchOpenSearch(query, embedding, topK) {
  // In a real implementation, this would make a direct HTTP request to OpenSearch
  // For this example, we'll simulate the response
  
  console.log(`[Simulated] Searching OpenSearch for query: ${query}`);
  
  // Generate some dummy results
  const results = [];
  for (let i = 0; i < topK; i++) {
    results.push({
      id: `simulated_result_${i}`,
      text: `This is a simulated result for the query: ${query}. Result number ${i + 1}.`,
      metadata: JSON.stringify({
        type: 'simulated',
        name: `Result ${i + 1}`,
        categories: ['agriculture', 'simulation']
      }),
      similarity: 0.9 - (i * 0.1) // Decreasing similarity
    });
  }
  
  return results;
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
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Get weather trends for a location
 */
async function getWeatherTrends(location) {
  try {
    // Get temperature data for the last 30 days
    const weatherData = await getTimeSeriesData(
      `weather:temperature:${location}`,
      `weather:rainfall:${location}`,
      `weather:humidity:${location}`,
      30
    );
    
    // Calculate averages
    const temperatures = weatherData.temperature || [];
    const rainfall = weatherData.rainfall || [];
    const humidity = weatherData.humidity || [];
    
    let totalTemp = 0;
    let totalRain = 0;
    let totalHumidity = 0;
    
    temperatures.forEach(item => {
      totalTemp += item.value;
    });
    
    rainfall.forEach(item => {
      totalRain += item.value;
    });
    
    humidity.forEach(item => {
      totalHumidity += item.value;
    });
    
    const avgTemperature = temperatures.length > 0 ? totalTemp / temperatures.length : null;
    const totalRainfall = totalRain;
    const avgHumidity = humidity.length > 0 ? totalHumidity / humidity.length : null;
    
    // Determine trends
    let temperatureTrend = 'stable';
    if (temperatures.length >= 7) {
      const recent = temperatures.slice(-3).reduce((sum, item) => sum + item.value, 0) / 3;
      const earlier = temperatures.slice(-7, -4).reduce((sum, item) => sum + item.value, 0) / 3;
      
      if (recent > earlier + 1) {
        temperatureTrend = 'rising';
      } else if (recent < earlier - 1) {
        temperatureTrend = 'falling';
      }
    }
    
    let rainfallTrend = 'dry';
    if (rainfall.length >= 7) {
      const recent = rainfall.slice(-3).reduce((sum, item) => sum + item.value, 0);
      
      if (recent > 10) {
        rainfallTrend = 'wet';
      } else if (recent > 2) {
        rainfallTrend = 'moderate';
      }
    }
    
    return {
      avgTemperature,
      totalRainfall,
      avgHumidity,
      temperatureTrend,
      rainfallTrend
    };
  } catch (error) {
    console.error('Error getting weather trends:', error);
    return {
      avgTemperature: 25, // Default values if error
      totalRainfall: 0,
      avgHumidity: 60,
      temperatureTrend: 'unknown',
      rainfallTrend: 'unknown'
    };
  }
}

/**
 * Generate weather advice based on forecast
 */
function generateWeatherAdvice(current, forecast, language) {
  // Base advice
  let advice = [];
  
  // Current conditions advice
  if (current.temperature > 35) {
    advice.push("It's very hot. Ensure crops have adequate water. Consider protective measures for heat-sensitive crops.");
  } else if (current.temperature < 10) {
    advice.push("It's cold. Protect sensitive crops from frost damage. Cover delicate plants overnight if temperatures are expected to drop further.");
  }
  
  // Rainfall advice
  if (current.rainfall > 20) {
    advice.push("Heavy rainfall observed. Check for water logging and ensure proper drainage in your fields.");
  } else if (current.rainfall < 2 && forecast.some(day => day.rainfall < 2)) {
    advice.push("Dry conditions expected. Plan irrigation accordingly and conserve water where possible.");
  }
  
  // Forecast-based advice
  const highTempDays = forecast.filter(day => day.temperature > 35).length;
  const rainDays = forecast.filter(day => day.rainfall > 5).length;
  
  if (highTempDays > 3) {
    advice.push(`Heat stress expected for ${highTempDays} days. Consider extra irrigation and use mulching to retain soil moisture.`);
  }
  
  if (rainDays > 2) {
    advice.push(`Rainfall expected on ${rainDays} days. Plan field operations accordingly and delay spraying pesticides.`);
  } else if (rainDays === 0) {
    advice.push("No significant rainfall expected in the forecast period. Plan irrigation schedule for the coming days.");
  }
  
  return advice;
}

/**
 * Generate crop recommendations based on seasonal crops and weather
 */
function generateCropRecommendations(crops, weatherTrends, soilType, language) {
  // Format the recommendations
  const recommendations = crops.map(crop => {
    // Extract relevant crop info
    const cropName = crop.name;
    const suitability = crop.suitability;
    
    // Weather-based risk assessment
    let weatherRisk = 'low';
    let riskFactors = [];
    
    // Check temperature trends
    if (weatherTrends.temperatureTrend === 'rising' && weatherTrends.avgTemperature > 32) {
      weatherRisk = 'moderate';
      riskFactors.push('high temperature');
    }
    
    // Check rainfall trends
    if (weatherTrends.rainfallTrend === 'dry') {
      weatherRisk = 'moderate';
      riskFactors.push('low rainfall');
    } else if (weatherTrends.rainfallTrend === 'wet' && weatherTrends.totalRainfall > 100) {
      weatherRisk = 'high';
      riskFactors.push('excessive rainfall');
    }
    
    // Soil considerations
    let soilSuitability = 'medium';
    let soilNotes = '';
    
    // Extract soil preferences from crop details
    if (crop.details) {
      const soilInfo = extractSoilInfo(crop.details);
      
      if (soilInfo && soilInfo.includes(soilType.toLowerCase())) {
        soilSuitability = 'high';
      } else if (soilInfo && soilInfo.includes('all') || soilInfo.includes('various')) {
        soilSuitability = 'medium';
      }
      
      soilNotes = soilInfo || '';
    }
    
    // Generate specific recommendations
    let specificAdvice = [];
    
    if (weatherRisk === 'high') {
      specificAdvice.push(`Consider weather protection measures due to ${riskFactors.join(' and ')}`);
    }
    
    if (soilSuitability !== 'high') {
      specificAdvice.push(`May need soil amendments for optimal growth in ${soilType} soil`);
    }
    
    return {
      crop: cropName,
      suitability: suitability,
      weatherRisk: weatherRisk,
      soilSuitability: soilSuitability,
      riskFactors: riskFactors,
      advice: specificAdvice
    };
  });
  
  return recommendations;
}

/**
 * Extract soil information from crop details
 */
function extractSoilInfo(cropDetails) {
  // Look for soil information in the text
  const soilMatch = cropDetails.match(/soil types?:?\s*([^.]+)/i) || 
                    cropDetails.match(/suitable soils?:?\s*([^.]+)/i) ||
                    cropDetails.match(/grows in ([^.]+) soils?/i);
  
  return soilMatch ? soilMatch[1].trim().toLowerCase() : null;
}

/**
 * Analyze market price trends
 */
function analyzeMarketTrends(prices) {
  if (!prices || prices.length === 0) {
    return {
      trend: 'unknown',
      changePercent: 0,
      volatility: 'unknown',
      priceRange: { min: 0, max: 0 },
      averagePrice: 0
    };
  }
  
  // Calculate basic statistics
  let min = prices[0].price;
  let max = prices[0].price;
  let sum = 0;
  
  prices.forEach(item => {
    min = Math.min(min, item.price);
    max = Math.max(max, item.price);
    sum += item.price;
  });
  
  const averagePrice = sum / prices.length;
  
  // Calculate trend
  let trend = 'stable';
  let changePercent = 0;
  
  if (prices.length >= 7) {
    // Compare recent prices with earlier ones
    const recentAvg = prices.slice(-3).reduce((sum, item) => sum + item.price, 0) / 3;
    const earlierAvg = prices.slice(-10, -3).reduce((sum, item) => sum + item.price, 0) / 7;
    
    changePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100;
    
    if (changePercent > 5) {
      trend = 'rising';
    } else if (changePercent < -5) {
      trend = 'falling';
    }
  }
  
  // Calculate volatility
  let volatility = 'low';
  const range = max - min;
  const rangePercent = (range / averagePrice) * 100;
  
  if (rangePercent > 20) {
    volatility = 'high';
  } else if (rangePercent > 10) {
    volatility = 'moderate';
  }
  
  return {
    trend,
    changePercent: Math.round(changePercent * 100) / 100,
    volatility,
    priceRange: { min, max },
    averagePrice: Math.round(averagePrice * 100) / 100
  };
}

/**
 * Generate market advice based on trends
 */
function generateMarketAdvice(trends, crop, language) {
  const advice = [];
  
  // Price trend advice
  if (trends.trend === 'rising') {
    advice.push(`Prices are trending upward (${trends.changePercent}% increase). Consider holding your ${crop} for better prices if storage is available.`);
  } else if (trends.trend === 'falling') {
    advice.push(`Prices are declining (${trends.changePercent}% decrease). If you need to sell, consider selling quickly before further drops.`);
  } else {
    advice.push(`Prices are relatively stable. Current average price is ₹${trends.averagePrice} per quintal.`);
  }
  
  // Volatility advice
  if (trends.volatility === 'high') {
    advice.push(`Market is highly volatile (price range: ₹${trends.priceRange.min}-${trends.priceRange.max}). Consider selling in smaller batches to manage risk.`);
  }
  
  // General advice
  if (trends.trend === 'rising' && trends.volatility === 'high') {
    advice.push(`Watch the market closely. High volatility with rising trend suggests unstable conditions that could change rapidly.`);
  }
  
  return advice;
}

/**
 * Extract scheme description from scheme details
 */
function extractSchemeDescription(schemeDetails) {
  const descriptionMatch = schemeDetails.match(/description:?\s*([^]*?)(?=eligibility:|benefits:|how to apply:|deadlines:|$)/i);
  return descriptionMatch ? descriptionMatch[1].trim() : "No description available";
}

/**
 * Extract eligibility information from scheme details
 */
function extractSchemeEligibility(schemeDetails) {
  const eligibilityMatch = schemeDetails.match(/eligibility:?\s*([^]*?)(?=benefits:|how to apply:|deadlines:|$)/i);
  return eligibilityMatch ? eligibilityMatch[1].trim() : "No eligibility information available";
}

/**
 * Extract benefits information from scheme details
 */
function extractSchemeBenefits(schemeDetails) {
  const benefitsMatch = schemeDetails.match(/benefits:?\s*([^]*?)(?=eligibility:|how to apply:|deadlines:|$)/i);
  return benefitsMatch ? benefitsMatch[1].trim() : "No benefits information available";
}

/**
 * Extract application information from scheme details
 */
function extractSchemeApplication(schemeDetails) {
  const applicationMatch = schemeDetails.match(/how to apply:?\s*([^]*?)(?=eligibility:|benefits:|deadlines:|$)/i);
  return applicationMatch ? applicationMatch[1].trim() : "No application information available";
}

/**
 * Extract pest management methods from text
 */
function extractPestManagementMethods(text) {
  // Look for management methods in the text
  const managementSection = text.match(/management:?\s*([^]*?)(?=prevention:|organic solutions:|chemical control:|$)/i);
  
  if (managementSection) {
    // Extract individual methods
    const methodsText = managementSection[1];
    const methods = methodsText.split(/\.\s+/)
                             .filter(method => method.trim().length > 10) // Filter out short fragments
                             .map(method => method.trim() + (method.endsWith('.') ? '' : '.'));
    
    return methods;
  }
  
  return ["No specific management methods found."];
}

/**
 * Extract organic solutions from search results
 */
function extractOrganicSolutions(results) {
  for (const result of results) {
    // Look for organic control sections
    const organicMatch = result.text.match(/organic\s+(?:control|solutions|management):?\s*([^]*?)(?=chemical|prevention:|$)/i);
    
    if (organicMatch) {
      // Extract individual solutions
      const solutionsText = organicMatch[1];
      const solutions = solutionsText.split(/\.\s+/)
                                  .filter(solution => solution.trim().length > 10)
                                  .map(solution => solution.trim() + (solution.endsWith('.') ? '' : '.'));
      
      return solutions;
    }
  }
  
  return ["No specific organic solutions found."];
}

/**
 * Extract chemical solutions from search results
 */
function extractChemicalSolutions(results) {
  for (const result of results) {
    // Look for chemical control sections
    const chemicalMatch = result.text.match(/chemical\s+(?:control|solutions|management):?\s*([^]*?)(?=organic|prevention:|$)/i);
    
    if (chemicalMatch) {
      // Extract individual solutions
      const solutionsText = chemicalMatch[1];
      const solutions = solutionsText.split(/\.\s+/)
                                  .filter(solution => solution.trim().length > 10)
                                  .map(solution => solution.trim() + (solution.endsWith('.') ? '' : '.'));
      
      return solutions;
    }
  }
  
  return ["No specific chemical solutions found."];
}

/**
 * Extract preventive measures from search results
 */
function extractPreventiveMeasures(results) {
  for (const result of results) {
    // Look for prevention sections
    const preventionMatch = result.text.match(/prevent(?:ion|ive\s+measures):?\s*([^]*?)(?=chemical|organic|$)/i);
    
    if (preventionMatch) {
      // Extract individual measures
      const measuresText = preventionMatch[1];
      const measures = measuresText.split(/\.\s+/)
                               .filter(measure => measure.trim().length > 10)
                               .map(measure => measure.trim() + (measure.endsWith('.') ? '' : '.'));
      
      return measures;
    }
  }
  
  return ["No specific preventive measures found."];
}

/**
 * Get general pest management advice
 */
function getGeneralPestManagementAdvice(crop, pest = null) {
  // Basic integrated pest management advice
  const advice = {
    crop,
    pest: pest || "general",
    management_methods: [
      "Implement Integrated Pest Management (IPM) practices.",
      "Regularly monitor your fields for early detection of pests.",
      "Use pest-resistant varieties when available.",
      "Maintain field hygiene by removing crop residues and weeds."
    ],
    organic_solutions: [
      "Apply neem oil spray for general pest control.",
      "Use beneficial insects like ladybugs for biological control.",
      "Apply compost tea or vermicompost to strengthen plants.",
      "Set up yellow sticky traps to monitor and reduce flying pests."
    ],
    chemical_solutions: [
      "Use pesticides as a last resort when other methods fail.",
      "Follow recommended dosage and safety precautions when applying chemicals.",
      "Rotate pesticide classes to prevent resistance development.",
      "Apply pesticides during calm weather to prevent drift."
    ],
    preventive_measures: [
      "Implement crop rotation to break pest cycles.",
      "Maintain healthy soil with proper nutrition to strengthen plants.",
      "Use mulch to reduce weed pressure and improve soil health.",
      "Time planting to avoid peak pest pressure periods."
    ]
  };
  
  return advice;
}
