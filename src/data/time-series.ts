import * as AWS from 'aws-sdk';
import config from '../config';

// Initialize DynamoDB client
const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region: config.aws.region,
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey
});

/**
 * Time Series Database implementation for storing temporal data like
 * weather measurements, market prices, and other time-based agricultural data
 */

// Time series data point interface
export interface TimeSeriesPoint {
  metricId: string;        // E.g., 'weather:temperature:district_123'
  timestamp: number;       // Epoch milliseconds
  value: number;          // The measured/predicted value
  location?: {           // Optional geographical reference
    district?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
    [key: string]: any;
  };
  source?: string;         // E.g., 'imd', 'agmarknet'
  unit?: string;          // E.g., 'celsius', 'mm', 'INR/quintal'
  metadata?: {           // Additional metadata
    [key: string]: any;
  };
}

/**
 * Store a time series data point
 */
export async function storeTimeSeriesPoint(point: TimeSeriesPoint): Promise<void> {
  try {
    // Calculate TTL if not present
    // By default, expire data after 1 year
    const oneYearFromNowInSeconds = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);
    
    // Prepare the item for storage
    const params = {
      TableName: config.dynamodb.timeSeriesTableName,
      Item: {
        metricId: point.metricId,
        timestamp: point.timestamp,
        value: point.value,
        location: point.location ? JSON.stringify(point.location) : null,
        source: point.source || 'unknown',
        unit: point.unit || '',
        metadata: point.metadata ? JSON.stringify(point.metadata) : null,
        expiryTime: oneYearFromNowInSeconds
      }
    };
    
    await dynamoDb.put(params).promise();
  } catch (error) {
    console.error('Error storing time series point:', error);
    throw error;
  }
}

/**
 * Get time series data for a specific metric within a time range
 */
export async function getTimeSeriesData(
  metricId: string,
  startTime: number,
  endTime: number = Date.now()
): Promise<TimeSeriesPoint[]> {
  try {
    const params = {
      TableName: config.dynamodb.timeSeriesTableName,
      KeyConditionExpression: 'metricId = :metricId AND timestamp BETWEEN :startTime AND :endTime',
      ExpressionAttributeValues: {
        ':metricId': metricId,
        ':startTime': startTime,
        ':endTime': endTime
      }
    };
    
    const result = await dynamoDb.query(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
      return [];
    }
    
    // Convert DynamoDB items to TimeSeriesPoint objects
    return result.Items.map(item => ({
      metricId: item.metricId,
      timestamp: item.timestamp,
      value: item.value,
      location: item.location ? JSON.parse(item.location) : undefined,
      source: item.source,
      unit: item.unit,
      metadata: item.metadata ? JSON.parse(item.metadata) : undefined
    }));
  } catch (error) {
    console.error('Error getting time series data:', error);
    throw error;
  }
}

/**
 * Get the latest time series data point for a specific metric
 */
export async function getLatestTimeSeriesPoint(metricId: string): Promise<TimeSeriesPoint | null> {
  try {
    const params = {
      TableName: config.dynamodb.timeSeriesTableName,
      KeyConditionExpression: 'metricId = :metricId',
      ExpressionAttributeValues: {
        ':metricId': metricId
      },
      ScanIndexForward: false, // Get descending order (newest first)
      Limit: 1
    };
    
    const result = await dynamoDb.query(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
      return null;
    }
    
    const item = result.Items[0];
    
    return {
      metricId: item.metricId,
      timestamp: item.timestamp,
      value: item.value,
      location: item.location ? JSON.parse(item.location) : undefined,
      source: item.source,
      unit: item.unit,
      metadata: item.metadata ? JSON.parse(item.metadata) : undefined
    };
  } catch (error) {
    console.error('Error getting latest time series point:', error);
    throw error;
  }
}

/**
 * Get time series data for multiple metrics within a time range
 */
export async function getMultipleTimeSeriesData(
  metricIds: string[],
  startTime: number,
  endTime: number = Date.now()
): Promise<{ [metricId: string]: TimeSeriesPoint[] }> {
  try {
    // Query each metric ID in parallel
    const promises = metricIds.map(metricId => 
      getTimeSeriesData(metricId, startTime, endTime)
    );
    
    const results = await Promise.all(promises);
    
    // Organize results by metric ID
    const organizedResults: { [metricId: string]: TimeSeriesPoint[] } = {};
    
    metricIds.forEach((metricId, index) => {
      organizedResults[metricId] = results[index];
    });
    
    return organizedResults;
  } catch (error) {
    console.error('Error getting multiple time series data:', error);
    throw error;
  }
}

/**
 * Get aggregated time series data with reduced resolution
 * This is useful for efficiently retrieving large time ranges
 */
export async function getAggregatedTimeSeriesData(
  metricId: string,
  startTime: number,
  endTime: number = Date.now(),
  aggregationPeriodMs: number = 24 * 60 * 60 * 1000 // Default: daily
): Promise<{
  timestamp: number;
  min: number;
  max: number;
  avg: number;
  count: number;
}[]> {
  try {
    // Get raw data
    const rawData = await getTimeSeriesData(metricId, startTime, endTime);
    
    // If no data or just one point, return early
    if (rawData.length <= 1) {
      return rawData.map(point => ({
        timestamp: point.timestamp,
        min: point.value,
        max: point.value,
        avg: point.value,
        count: 1
      }));
    }
    
    // Group by time periods
    const periodGroups: { [period: number]: number[] } = {};
    
    // Put each data point in the appropriate period bucket
    for (const point of rawData) {
      const periodStart = Math.floor(point.timestamp / aggregationPeriodMs) * aggregationPeriodMs;
      
      if (!periodGroups[periodStart]) {
        periodGroups[periodStart] = [];
      }
      
      periodGroups[periodStart].push(point.value);
    }
    
    // Calculate aggregates for each period
    const aggregatedData = Object.entries(periodGroups).map(([periodStart, values]) => {
      const timestamp = parseInt(periodStart);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / values.length;
      const count = values.length;
      
      return {
        timestamp,
        min,
        max,
        avg,
        count
      };
    });
    
    // Sort by timestamp
    return aggregatedData.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Error getting aggregated time series data:', error);
    throw error;
  }
}

/**
 * Calculate statistics for a time series
 */
export async function calculateTimeSeriesStatistics(
  metricId: string,
  startTime: number,
  endTime: number = Date.now()
): Promise<{
  min: number;
  max: number;
  avg: number;
  count: number;
  stdDev: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}> {
  try {
    const data = await getTimeSeriesData(metricId, startTime, endTime);
    
    if (data.length === 0) {
      throw new Error(`No data found for metric ${metricId} in the specified time range`);
    }
    
    // Extract values
    const values = data.map(point => point.value);
    
    // Calculate basic statistics
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    const count = values.length;
    
    // Calculate standard deviation
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / count;
    const stdDev = Math.sqrt(variance);
    
    // Determine trend
    // Simple linear regression to get slope
    const timestamps = data.map(point => point.timestamp);
    const firstTimestamp = timestamps[0];
    // Normalize timestamps to avoid numerical issues
    const normalizedTimestamps = timestamps.map(t => (t - firstTimestamp) / (1000 * 60 * 60 * 24)); // Days
    
    const tAvg = normalizedTimestamps.reduce((acc, val) => acc + val, 0) / count;
    const vAvg = avg;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < count; i++) {
      numerator += (normalizedTimestamps[i] - tAvg) * (values[i] - vAvg);
      denominator += Math.pow(normalizedTimestamps[i] - tAvg, 2);
    }
    
    const slope = denominator !== 0 ? numerator / denominator : 0;
    
    // Determine trend based on slope
    let trend: 'increasing' | 'decreasing' | 'stable';
    const slopeThreshold = 0.05 * avg; // 5% of average as threshold
    
    if (slope > slopeThreshold) {
      trend = 'increasing';
    } else if (slope < -slopeThreshold) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }
    
    return {
      min,
      max,
      avg,
      count,
      stdDev,
      trend
    };
  } catch (error) {
    console.error('Error calculating time series statistics:', error);
    throw error;
  }
}

/**
 * Delete time series data points within a time range
 */
export async function deleteTimeSeriesData(
  metricId: string,
  startTime?: number,
  endTime?: number
): Promise<void> {
  try {
    // Get data to delete
    const params: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: config.dynamodb.timeSeriesTableName,
      KeyConditionExpression: 'metricId = :metricId' + 
        (startTime && endTime ? ' AND timestamp BETWEEN :startTime AND :endTime' : ''),
      ExpressionAttributeValues: {
        ':metricId': metricId,
        ...(startTime && { ':startTime': startTime }),
        ...(endTime && { ':endTime': endTime })
      }
    };
    
    const result = await dynamoDb.query(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
      return;
    }
    
    // DynamoDB doesn't support batch deletes with range keys directly
    // We need to delete items one by one
    const deletePromises = result.Items.map(item => {
      const deleteParams = {
        TableName: config.dynamodb.timeSeriesTableName,
        Key: {
          metricId: item.metricId,
          timestamp: item.timestamp
        }
      };
      
      return dynamoDb.delete(deleteParams).promise();
    });
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting time series data:', error);
    throw error;
  }
}

/**
 * Get weather forecast data for a location
 */
export async function getWeatherForecast(
  district: string,
  days: number = 7
): Promise<{
  district: string;
  forecast: Array<{
    date: string;
    highTemp: number;
    lowTemp: number;
    rainfall: number;
    humidity: number;
    windSpeed: number;
  }>;
  summary: {
    temperature?: { min: number; max: number; avg: number };
    rainProbability: number;
    agriculturalImplications: string[];
  };
}> {
  try {
    const now = Date.now();
    const districtId = district.toLowerCase().replace(/\s+/g, '_');
    
    // Get high temperature forecast
    const highTempData = await getTimeSeriesData(
      `weather:temperature:high:${districtId}`,
      now,
      now + days * 24 * 60 * 60 * 1000
    );
    
    // Get low temperature forecast
    const lowTempData = await getTimeSeriesData(
      `weather:temperature:low:${districtId}`,
      now,
      now + days * 24 * 60 * 60 * 1000
    );
    
    // Get rainfall forecast
    const rainfallData = await getTimeSeriesData(
      `weather:rainfall:${districtId}`,
      now,
      now + days * 24 * 60 * 60 * 1000
    );
    
    // Get humidity forecast
    const humidityData = await getTimeSeriesData(
      `weather:humidity:${districtId}`,
      now,
      now + days * 24 * 60 * 60 * 1000
    );
    
    // Get wind speed forecast
    const windSpeedData = await getTimeSeriesData(
      `weather:wind_speed:${districtId}`,
      now,
      now + days * 24 * 60 * 60 * 1000
    );
    
    // Process forecast data
    const forecast = [];
    
    for (let i = 0; i < days; i++) {
      const dayStart = now + i * 24 * 60 * 60 * 1000;
      const date = new Date(dayStart).toISOString().split('T')[0];
      
      const highTemp = highTempData[i]?.value ?? 25;
      const lowTemp = lowTempData[i]?.value ?? 15;
      const rainfall = rainfallData[i]?.value ?? 0;
      const humidity = humidityData[i]?.value ?? 50;
      const windSpeed = windSpeedData[i]?.value ?? 5;
      
      forecast.push({
        date,
        highTemp,
        lowTemp,
        rainfall,
        humidity,
        windSpeed
      });
    }
    
    // Calculate summary statistics
    const allTemps = [
      ...highTempData.map(point => point.value),
      ...lowTempData.map(point => point.value)
    ];
    
    const temperatureSummary = allTemps.length > 0 ? {
      min: Math.min(...allTemps),
      max: Math.max(...allTemps),
      avg: allTemps.reduce((acc, val) => acc + val, 0) / allTemps.length
    } : undefined;
    
    const totalRainfall = rainfallData.reduce((acc, point) => acc + point.value, 0);
    const rainProbability = rainfallData.filter(point => point.value > 0).length / days;
    
    // Generate agricultural implications
    const agriculturalImplications = [];
    
    // Temperature implications
    if (temperatureSummary) {
      if (temperatureSummary.max > 35) {
        agriculturalImplications.push(
          'High temperatures may cause heat stress in crops. Consider additional irrigation.'
        );
      } else if (temperatureSummary.min < 10) {
        agriculturalImplications.push(
          'Low temperatures may affect sensitive crops. Monitor for frost damage.'
        );
      } else {
        agriculturalImplications.push(
          'Temperature conditions are favorable for most crops.'
        );
      }
    }
    
    // Rainfall implications
    if (totalRainfall > 50) {
      agriculturalImplications.push(
        'Heavy rainfall expected. Ensure proper drainage in fields.'
      );
    } else if (totalRainfall < 5 && days >= 7) {
      agriculturalImplications.push(
        'Dry conditions expected. Plan for irrigation if available.'
      );
    } else if (totalRainfall > 0) {
      agriculturalImplications.push(
        'Moderate rainfall expected. Good conditions for most crops.'
      );
    }
    
    return {
      district,
      forecast,
      summary: {
        temperature: temperatureSummary,
        rainProbability,
        agriculturalImplications
      }
    };
  } catch (error) {
    console.error('Error getting weather forecast:', error);
    throw error;
  }
}

/**
 * Get market price data for a crop
 */
export async function getMarketPrices(
  crop: string,
  days: number = 30,
  marketArea: string = 'all'
): Promise<{
  crop: string;
  currentPrice?: number;
  weeklyChange?: string;
  monthlyChange?: string;
  trend?: 'rising' | 'falling' | 'stable';
  marketArea: string;
  priceForecast?: string;
  marketingTips?: string[];
}> {
  try {
    const now = Date.now();
    const cropId = crop.toLowerCase().replace(/\s+/g, '_');
    const metricId = `market:price:${cropId}`;
    
    // Add market area to metric ID if specified
    const fullMetricId = marketArea !== 'all' ? 
      `${metricId}:${marketArea.toLowerCase().replace(/\s+/g, '_')}` : 
      metricId;
    
    // Get historical price data
    const priceData = await getTimeSeriesData(
      fullMetricId,
      now - (days * 24 * 60 * 60 * 1000),
      now
    );
    
    if (priceData.length === 0) {
      return {
        crop,
        marketArea
      };
    }
    
    // Sort by timestamp (newest first)
    priceData.sort((a, b) => b.timestamp - a.timestamp);
    
    // Current price
    const currentPrice = priceData[0].value;
    
    // Calculate weekly change
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const weekAgoPrice = priceData.find(point => point.timestamp <= oneWeekAgo)?.value;
    let weeklyChange: string | undefined;
    
    if (weekAgoPrice) {
      const weeklyChangePct = ((currentPrice - weekAgoPrice) / weekAgoPrice) * 100;
      const sign = weeklyChangePct >= 0 ? '+' : '';
      weeklyChange = `${sign}${weeklyChangePct.toFixed(2)}%`;
    }
    
    // Calculate monthly change
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);
    const monthAgoPrice = priceData.find(point => point.timestamp <= oneMonthAgo)?.value;
    let monthlyChange: string | undefined;
    
    if (monthAgoPrice) {
      const monthlyChangePct = ((currentPrice - monthAgoPrice) / monthAgoPrice) * 100;
      const sign = monthlyChangePct >= 0 ? '+' : '';
      monthlyChange = `${sign}${monthlyChangePct.toFixed(2)}%`;
    }
    
    // Determine trend
    let trend: 'rising' | 'falling' | 'stable' | undefined;
    if (priceData.length >= 7) {
      const recentPrices = priceData.slice(0, 7).map(point => point.value);
      const avgRecentPrice = recentPrices.reduce((acc, val) => acc + val, 0) / recentPrices.length;
      
      const olderPrices = priceData.slice(-7).map(point => point.value);
      const avgOlderPrice = olderPrices.reduce((acc, val) => acc + val, 0) / olderPrices.length;
      
      const changePct = ((avgRecentPrice - avgOlderPrice) / avgOlderPrice) * 100;
      
      if (changePct > 3) {
        trend = 'rising';
      } else if (changePct < -3) {
        trend = 'falling';
      } else {
        trend = 'stable';
      }
    }
    
    // Generate price forecast
    let priceForecast: string | undefined;
    if (trend) {
      const forecastPct = trend === 'rising' ? 
        '+5 to +10%' : (trend === 'falling' ? '-5 to -10%' : '±2%');
        
      priceForecast = `Based on current trends, prices are expected to change by ${forecastPct} over the next 2 weeks.`;
    }
    
    // Generate marketing tips
    let marketingTips: string[] | undefined;
    if (trend === 'rising') {
      marketingTips = [
        'Consider phased selling to benefit from potential further price increases.',
        'Monitor daily market rates before selling large quantities.',
        'Explore nearby markets for better price options.'
      ];
    } else if (trend === 'falling') {
      marketingTips = [
        'Consider selling soon if storage costs are high.',
        'Explore value-added processing options to increase returns.',
        'Check government procurement programs for minimum support price options.'
      ];
    } else {
      marketingTips = [
        'Prices are stable. Good time for planned, gradual marketing.',
        'Compare prices across different markets before selling.',
        'Consider quality grading to fetch premium prices.'
      ];
    }
    
    return {
      crop,
      currentPrice,
      weeklyChange,
      monthlyChange,
      trend,
      marketArea,
      priceForecast,
      marketingTips
    };
  } catch (error) {
    console.error('Error getting market prices:', error);
    throw error;
  }
}
