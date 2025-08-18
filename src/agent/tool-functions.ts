import { 
  getRecommendedCrops, 
  getEntityRelationships 
} from '../data/knowledge-graph';
import { 
  searchVectorsByText, 
  generateEmbedding 
} from '../data/vector-db';
import { 
  getWeatherForecast, 
  getMarketPrices 
} from '../data/time-series';
import config from '../config';

/**
 * Tool functions for the OpenAI Voice Agent
 * These functions are called when the agent determines it needs specific agricultural data
 */

interface ToolResult {
  data: any;
  error?: string;
}

// Define the specific argument types for each tool function
interface WeatherForecastArgs {
  district: string;
  days?: number;
}

interface CropRecommendationArgs {
  district: string;
  soil_type?: string;
  season?: string;
}

interface MarketPriceArgs {
  crop: string;
  market_area?: string;
}

interface GovernmentSchemeArgs {
  farmer_type?: string;
  crop_type?: string;
  state?: string;
}

// A type that captures all possible tool function arguments
type ToolArgs = 
  | WeatherForecastArgs 
  | CropRecommendationArgs 
  | MarketPriceArgs 
  | GovernmentSchemeArgs;

// Generic tool function type 
type ToolFunction = (args: any) => Promise<ToolResult>;

/**
 * Execute a tool function by name with the given arguments
 */
export async function executeToolFunction(
  toolName: string, 
  args: Record<string, any>
): Promise<any> {
  console.log(`Executing tool function: ${toolName}`, args);
  
  const toolFunctions: Record<string, ToolFunction> = {
    get_weather_forecast,
    get_crop_recommendations,
    get_market_prices,
    check_government_schemes
  };
  
  const toolFunction = toolFunctions[toolName];
  
  if (!toolFunction) {
    throw new Error(`Tool function ${toolName} not found`);
  }
  
  try {
    const result = await toolFunction(args);
    return result.data;
  } catch (error) {
    console.error(`Error executing tool function ${toolName}:`, error);
    throw error;
  }
}

/**
 * Get weather forecast for a location
 */
async function get_weather_forecast(args: WeatherForecastArgs): Promise<ToolResult> {
  try {
    const { district, days = 7 } = args;
    
    if (!district) {
      return {
        data: null,
        error: 'District is required'
      };
    }
    
    const forecast = await getWeatherForecast(district, days);
    
    return {
      data: forecast
    };
  } catch (error: unknown) {
    console.error('Error getting weather forecast:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      data: null,
      error: `Failed to get weather forecast: ${errorMessage}`
    };
  }
}

/**
 * Get crop recommendations based on location, soil type, and season
 */
async function get_crop_recommendations(args: CropRecommendationArgs): Promise<ToolResult> {
  try {
    const { district, soil_type = 'medium', season = 'current' } = args;
    
    if (!district) {
      return {
        data: null,
        error: 'District is required'
      };
    }
    
    // Get recommended crops from knowledge graph
    const recommendedCrops = await getRecommendedCrops(
      district,
      soil_type,
      season
    );
    
    // Get cultivation practices for top crops
    const cultivationPractices: Record<string, string[]> = {};
    
    if (recommendedCrops.length > 0) {
      // Get practices for top 3 crops
      for (const crop of recommendedCrops.slice(0, 3)) {
        const cropId = crop.cropId;
        
        // Search vector database for cultivation practices
        const practices = await searchVectorsByText(
          `cultivation practices for ${crop.cropName}`,
          { category: 'crop_info' },
          5
        );
        
        // Extract practices from search results
        cultivationPractices[cropId] = practices.map(practice => practice.text);
      }
    }
    
    return {
      data: {
        district,
        season,
        recommendations: recommendedCrops.slice(0, 5),
        cultivation_practices: cultivationPractices
      }
    };
  } catch (error: unknown) {
    console.error('Error getting crop recommendations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      data: null,
      error: `Failed to get crop recommendations: ${errorMessage}`
    };
  }
}

/**
 * Get market prices for a crop
 */
async function get_market_prices(args: MarketPriceArgs): Promise<ToolResult> {
  try {
    const { crop, market_area = 'all' } = args;
    
    if (!crop) {
      return {
        data: null,
        error: 'Crop is required'
      };
    }
    
    // Get market prices from time series database
    const marketPrices = await getMarketPrices(crop, 30, market_area);
    
    return {
      data: marketPrices
    };
  } catch (error: unknown) {
    console.error('Error getting market prices:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      data: null,
      error: `Failed to get market prices: ${errorMessage}`
    };
  }
}

/**
 * Check for government schemes
 */
async function check_government_schemes(args: GovernmentSchemeArgs): Promise<ToolResult> {
  try {
    const { farmer_type = 'all', crop_type = 'all', state = 'all' } = args;
    
    // Build search query
    let query = 'government scheme';
    
    if (farmer_type !== 'all') {
      query += ` for ${farmer_type} farmers`;
    }
    
    if (crop_type !== 'all') {
      query += ` growing ${crop_type}`;
    }
    
    if (state !== 'all') {
      query += ` in ${state}`;
    }
    
    // Search for schemes in vector database
    const schemes = await searchVectorsByText(
      query,
      { category: 'government_scheme' },
      5
    );
    
    // Process schemes into a more structured format
    const structuredSchemes = schemes.map(scheme => {
      // Extract fields from text using simple heuristics
      const lines = scheme.text.split('\n');
      const name = lines[0]?.trim() || 'Unknown Scheme';
      const description = lines.slice(1).join(' ').trim();
      
      // Extract eligibility if mentioned
      let eligibility = '';
      if (description.includes('eligibility') || description.includes('eligible')) {
        eligibility = description
          .split(/eligibility[:|\s]/i)[1]?.split('.')[0]?.trim() || '';
      }
      
      // Extract benefits if mentioned
      let benefits = '';
      if (description.includes('benefit') || description.includes('provides')) {
        benefits = description
          .split(/benefits[:|\s]/i)[1]?.split('.')[0]?.trim() || '';
      }
      
      // Extract application process if mentioned
      let applicationProcess = '';
      if (description.includes('apply') || description.includes('application')) {
        applicationProcess = description
          .split(/apply[:|\s]/i)[1]?.split('.')[0]?.trim() || '';
      }
      
      return {
        name,
        description,
        eligibility,
        benefits,
        applicationProcess
      };
    });
    
    // Additional resources
    const additionalResources = [
      'Contact your local Krishi Vigyan Kendra for more information',
      'Visit the official PM-KISAN portal at pmkisan.gov.in',
      'Download the Kisan Suvidha mobile app for more government schemes'
    ];
    
    return {
      data: {
        schemes: structuredSchemes,
        additionalResources
      }
    };
  } catch (error: unknown) {
    console.error('Error checking government schemes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      data: null,
      error: `Failed to check government schemes: ${errorMessage}`
    };
  }
}

/**
 * Get detailed information about a crop
 */
export async function getCropInformation(cropName: string): Promise<any> {
  try {
    const cropId = `crop:${cropName.toLowerCase()}`;
    
    // Get entity relationships from knowledge graph
    const entityInfo = await getEntityRelationships(cropId);
    
    // Search for detailed information in vector database
    const vectorResults = await searchVectorsByText(
      cropName,
      { category: 'crop_info' },
      5
    );
    
    return {
      cropId: cropId,
      cropName: cropName,
      relationships: entityInfo,
      details: vectorResults.map(item => item.text)
    };
  } catch (error: unknown) {
    console.error('Error getting crop information:', error);
    throw error;
  }
}

/**
 * Search for answers to agricultural questions
 */
export async function searchAgricultureKnowledge(question: string): Promise<any> {
  try {
    // Generate embedding for the question
    const queryEmbedding = await generateEmbedding(question);
    
    // Search using vector embedding
    // For now we'll use text search as a fallback
    const results = await searchVectorsByText(question);
    
    return results.map(item => ({
      text: item.text,
      metadata: item.metadata
    }));
  } catch (error: unknown) {
    console.error('Error searching agriculture knowledge:', error);
    throw error;
  }
}
