# Lambda Functions Detailed Flow Documentation

This document provides a detailed explanation of the Lambda functions in the Kissan Mitra Agricultural AI System, including their roles, interactions, and data flows.

## Overview of Lambda Architecture

The system uses three primary Lambda functions in a coordinated workflow:

1. **Voice Gateway Lambda**: Entry point for voice interactions
2. **Agent Tools Lambda**: Provides domain-specific agricultural tools and knowledge
3. **Data Processing Lambda**: Handles background data collection and processing

```
┌───────────────────┐     ┌────────────────┐     ┌─────────────────┐
│   Farmer          │     │  Voice Gateway │     │   Agent Tools   │
│  Phone Call       │────>│     Lambda     │────>│     Lambda      │
└───────────────────┘     └────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ DynamoDB Tables │
                                                 │ & OpenSearch    │
                                                 └─────────────────┘
                                                          ▲
                                                          │
                                                 ┌─────────────────┐
                                                 │ Data Processing │
                                                 │     Lambda      │
                                                 └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  External APIs  │
                                                 └─────────────────┘
```

## 1. Voice Gateway Lambda

**File**: `lambdas/voice-gateway/index.js`

### Purpose
Serves as the entry point for all voice interactions, managing the communication between users and the OpenAI Voice Agent.

### Trigger Events
- API Gateway HTTP requests
- WebSocket connections for streaming audio

### Main Functions

1. **Session Creation**
   ```javascript
   async function createVoiceSession(event) {
     // Initialize OpenAI Voice Agent session
     const session = await openai.beta.voice.createSession({
       name: "Krishi Mitra",
       model: "gpt-4",
       voice: { model: "nova" },
       tools: voiceAgentTools
     });
     
     // Store session in DynamoDB
     await dynamodb.putItem({
       TableName: process.env.SESSION_TABLE,
       Item: {
         sessionId: { S: session.id },
         createdAt: { S: new Date().toISOString() },
         expiryTime: { N: (Math.floor(Date.now() / 1000) + 86400).toString() } // 24 hour TTL
       }
     }).promise();
     
     return { sessionId: session.id };
   }
   ```

2. **Audio Streaming**
   ```javascript
   async function processAudioStream(event) {
     const { sessionId, audioChunk } = JSON.parse(event.body);
     
     // Get session from DynamoDB
     const session = await retrieveSession(sessionId);
     
     // Send audio to OpenAI Voice Agent
     await session.sendAudio(audioChunk);
     
     // Return audio response if available
     if (session.hasResponse()) {
       return {
         statusCode: 200,
         body: JSON.stringify({
           audio: session.getAudioResponse(),
           transcript: session.getTranscript()
         })
       };
     }
     
     return { statusCode: 202 }; // Accepted, processing
   }
   ```

3. **Tool Invocation**
   ```javascript
   session.on('tool_call', async (toolCall) => {
     console.log(`Received tool call: ${toolCall.name}`);
     
     // Invoke Agent Tools Lambda
     const response = await lambda.invoke({
       FunctionName: process.env.AGENT_TOOLS_FUNCTION_ARN,
       Payload: JSON.stringify({
         toolName: toolCall.name,
         arguments: toolCall.arguments
       })
     }).promise();
     
     // Return tool result to OpenAI
     await toolCall.submitToolOutputs({
       tool_outputs: [{ output: response.Payload }]
     });
   });
   ```

### Input and Output
- **Input**: HTTP requests with audio data or session commands
- **Output**: Audio responses, session status

## 2. Agent Tools Lambda

**File**: `lambdas/agent-tools/index.js`

### Purpose
Provides domain-specific agricultural knowledge and tools that the OpenAI Voice Agent can invoke to answer user queries.

### Trigger Events
- Invocation from Voice Gateway Lambda when tools are requested by OpenAI

### Main Functions

1. **Tool Function Router**
   ```javascript
   exports.handler = async (event) => {
     const { toolName, arguments: args } = event;
     
     console.log(`Executing tool: ${toolName}`);
     
     switch (toolName) {
       case 'get_weather_forecast':
         return await getWeatherForecast(args);
       case 'get_crop_recommendations':
         return await getCropRecommendations(args);
       case 'get_market_prices':
         return await getMarketPrices(args);
       case 'check_government_schemes':
         return await checkGovernmentSchemes(args);
       default:
         throw new Error(`Unknown tool: ${toolName}`);
     }
   };
   ```

2. **Weather Forecast Tool**
   ```javascript
   async function getWeatherForecast({ district, days = 7 }) {
     // Normalize district name
     const normalizedDistrict = district.toLowerCase().trim();
     
     // Query the Time Series table for weather data
     const timeSeriesData = await dynamodb.query({
       TableName: process.env.TIME_SERIES_TABLE,
       KeyConditionExpression: "metricId = :metricId",
       ExpressionAttributeValues: {
         ":metricId": { S: `weather:combined:${normalizedDistrict}` }
       },
       Limit: days
     }).promise();
     
     // Format weather data for the agent
     return formatWeatherResponse(timeSeriesData.Items, district, days);
   }
   ```

3. **Crop Recommendations Tool**
   ```javascript
   async function getCropRecommendations({ district, season, soil_type = "medium" }) {
     // Get current weather trends
     const weatherTrends = await getWeatherTrends(district);
     
     // Query Knowledge Graph for suitable crops
     const graphResults = await dynamodb.query({
       TableName: process.env.KNOWLEDGE_GRAPH_TABLE,
       KeyConditionExpression: "nodeId = :location AND relationshipType = :relation",
       ExpressionAttributeValues: {
         ":location": { S: `location:${district.toLowerCase()}` },
         ":relation": { S: "suitable_for" }
       }
     }).promise();
     
     // Filter by season and soil type
     const suitableCrops = filterCropsBySeason(graphResults.Items, season);
     
     // Apply weather risk factors
     return generateRecommendations(suitableCrops, weatherTrends, soil_type);
   }
   ```

4. **Market Price Tool**
   ```javascript
   async function getMarketPrices({ crop, market_area = "all" }) {
     // Normalize crop name
     const normalizedCrop = normalizeCropName(crop);
     
     // Get recent price data from Time Series table
     const priceData = await dynamodb.query({
       TableName: process.env.TIME_SERIES_TABLE,
       KeyConditionExpression: "metricId = :metricId",
       ExpressionAttributeValues: {
         ":metricId": { S: `market:price:${normalizedCrop}:${market_area}` }
       },
       ScanIndexForward: false, // descending order (newest first)
       Limit: 30 // Last 30 data points
     }).promise();
     
     // Analyze trends
     return analyzeMarketPrices(crop, priceData.Items, market_area);
   }
   ```

5. **Government Schemes Tool**
   ```javascript
   async function checkGovernmentSchemes({ farmer_type = "all", crop_type = "all", state }) {
     // Use OpenSearch for semantic search
     const searchParams = {
       index: 'government_schemes',
       body: {
         query: {
           bool: {
             must: [
               {
                 match: {
                   "farmer_type": farmer_type
                 }
               },
               {
                 match: {
                   "crop_type": crop_type
                 }
               },
               {
                 match: {
                   "state": state
                 }
               }
             ]
           }
         }
       }
     };
     
     const response = await opensearch.search(searchParams);
     
     // Format scheme information
     return formatSchemeInformation(response.body.hits.hits);
   }
   ```

### Input and Output
- **Input**: Tool name and arguments from Voice Gateway Lambda
- **Output**: Structured data responses to the specific queries

## 3. Data Processing Lambda

**File**: `lambdas/data-processing/index.js`

### Purpose
Collects, processes, and stores data from external sources for use by the Agent Tools Lambda. Runs on schedules or triggered by new data.

### Trigger Events
- CloudWatch scheduled events (daily data refresh)
- S3 object creation (new raw data files)

### Main Functions

1. **Event Router**
   ```javascript
   exports.handler = async (event) => {
     console.log('Received event:', JSON.stringify(event, null, 2));
     
     // Handle S3 events (new data files)
     if (event.Records && event.Records[0].s3) {
       return await handleS3Event(event);
     }
     
     // Handle scheduled events
     if (event.operation === 'process_daily_data') {
       return await processDailyData();
     }
     
     // Handle data freshness checks
     if (event.operation === 'check_data_freshness') {
       return await checkDataFreshness();
     }
     
     throw new Error('Unsupported event type');
   };
   ```

2. **Daily Data Processing**
   ```javascript
   async function processDailyData() {
     console.log('Processing daily data');
     
     // Process weather data
     const weatherData = await fetchWeatherData();
     await storeTimeSeriesData(processWeatherData(weatherData));
     
     // Process market data
     const marketData = await fetchMarketPrices();
     await storeTimeSeriesData(processMarketData(marketData));
     
     // Update vector embeddings
     await updateVectorEmbeddings([
       ...weatherData,
       ...marketData
     ]);
     
     return { status: 'success' };
   }
   ```

3. **S3 Event Handler**
   ```javascript
   async function handleS3Event(event) {
     const bucket = event.Records[0].s3.bucket.name;
     const key = decodeURIComponent(event.Records[0].s3.object.key);
     
     console.log(`Processing new file: s3://${bucket}/${key}`);
     
     // Get file from S3
     const data = await s3.getObject({
       Bucket: bucket,
       Key: key
     }).promise();
     
     const fileContent = data.Body.toString('utf-8');
     const fileType = determineFileType(key);
     
     // Process based on file type
     switch (fileType) {
       case 'weather':
         await processWeatherFile(JSON.parse(fileContent));
         break;
       case 'market':
         await processMarketFile(JSON.parse(fileContent));
         break;
       case 'crop':
         await processCropFile(JSON.parse(fileContent));
         break;
       case 'scheme':
         await processSchemeFile(JSON.parse(fileContent));
         break;
       default:
         console.warn(`Unknown file type for key: ${key}`);
     }
     
     return { status: 'success', processedFile: key };
   }
   ```

4. **Vector Embedding Generation**
   ```javascript
   async function updateVectorEmbeddings(dataItems) {
     for (const item of dataItems) {
       // Generate text representation of data item
       const text = generateTextFromData(item);
       
       // Call OpenAI for embeddings
       const embeddingResponse = await openai.embeddings.create({
         model: "text-embedding-ada-002",
         input: text
       });
       
       const vector = embeddingResponse.data[0].embedding;
       
       // Store in Vector Database (DynamoDB)
       await dynamodb.putItem({
         TableName: process.env.VECTOR_DB_TABLE,
         Item: {
           id: { S: generateId(item) },
           text: { S: text },
           vector: { B: Buffer.from(new Float32Array(vector).buffer) },
           metadata: { S: JSON.stringify(item.metadata || {}) },
           lastUpdated: { S: new Date().toISOString() }
         }
       }).promise();
       
       // Also index in OpenSearch for efficient vector search
       await opensearch.index({
         index: 'vector_embeddings',
         body: {
           id: generateId(item),
           text: text,
           vector_field: vector,
           metadata: item.metadata || {}
         }
       });
     }
   }
   ```

5. **Knowledge Graph Updates**
   ```javascript
   async function processCropFile(cropData) {
     const cropId = cropData.id;
     const cropName = cropData.name;
     
     // Create crop node relationships
     const relationships = [
       // Seasons relationship
       ...cropData.seasons.map(season => ({
         nodeId: cropId,
         relationshipType: "grown_during",
         targetNodeId: `season:${season}`,
         properties: {}
       })),
       
       // Pests relationship
       ...cropData.pests.map(pest => ({
         nodeId: cropId,
         relationshipType: "susceptible_to",
         targetNodeId: `pest:${pest}`,
         properties: {}
       })),
       
       // Diseases relationship
       ...cropData.diseases.map(disease => ({
         nodeId: cropId,
         relationshipType: "affected_by",
         targetNodeId: `disease:${disease}`,
         properties: {}
       }))
     ];
     
     // Batch write to Knowledge Graph table
     await batchWriteRelationships(relationships);
     
     return { status: 'success', processedCrop: cropId };
   }
   ```

### Input and Output
- **Input**: Scheduled events or S3 events containing new data
- **Output**: Status of data processing operations

## Lambda Function Interactions

### 1. Voice Interaction Flow

1. **User Voice Input → Voice Gateway Lambda**
   - User speaks to the system via phone or app
   - Voice Gateway Lambda receives audio stream

2. **Voice Gateway Lambda → OpenAI Voice Agent**
   - Audio is sent to OpenAI for transcription and processing
   - OpenAI determines intent and required tools

3. **OpenAI Voice Agent → Voice Gateway Lambda → Agent Tools Lambda**
   - When OpenAI needs information, it requests tool functions
   - Voice Gateway Lambda forwards these requests to Agent Tools Lambda

4. **Agent Tools Lambda → DynamoDB/OpenSearch → Voice Gateway Lambda → User**
   - Agent Tools Lambda queries databases for information
   - Results flow back to user through Voice Gateway Lambda

### 2. Data Update Flow

1. **External API/S3 Upload → Data Processing Lambda**
   - New data triggers processing (scheduled or event-based)

2. **Data Processing Lambda → S3/DynamoDB/OpenSearch**
   - Raw data is transformed and stored
   - Vector embeddings are generated and indexed
   - Knowledge graph is updated

3. **Agent Tools Lambda → Updated Data → User**
   - Agent Tools Lambda uses freshly processed data for user queries

## Database Table Interactions

### Vector Database Table (DynamoDB)
- **Writer**: Data Processing Lambda
- **Reader**: Agent Tools Lambda
- **Purpose**: Semantic search for agricultural knowledge

### Knowledge Graph Table (DynamoDB)
- **Writer**: Data Processing Lambda
- **Reader**: Agent Tools Lambda
- **Purpose**: Store relationships between agricultural entities

### Time Series Table (DynamoDB)
- **Writer**: Data Processing Lambda
- **Reader**: Agent Tools Lambda
- **Purpose**: Store temporal data (weather, prices, etc.)

### Session Table (DynamoDB)
- **Writer**: Voice Gateway Lambda
- **Reader**: Voice Gateway Lambda
- **Purpose**: Manage voice interaction sessions

## Summary of Data Flow

1. **Data Collection**
   - External APIs → Data Processing Lambda → DynamoDB/OpenSearch

2. **User Interaction**
   - User → Voice Gateway Lambda → OpenAI → Agent Tools Lambda → DynamoDB/OpenSearch → User

This architecture enables a highly responsive, knowledge-rich voice assistant for farmers that can be updated with fresh agricultural data regularly while maintaining low latency for user interactions.
