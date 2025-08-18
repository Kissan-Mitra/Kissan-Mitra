/**
 * Voice Gateway Lambda
 * 
 * Handles incoming voice requests from web/mobile interface
 * Manages OpenAI Voice Agent session creation
 * Forwards audio streams between client and OpenAI
 */

const AWS = require('aws-sdk');
const { OpenAI } = require('openai');

// Initialize AWS clients
const secretsManager = new AWS.SecretsManager();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Environment variables
const SESSION_TABLE = process.env.SESSION_TABLE;
const AGENT_TOOLS_FUNCTION_ARN = process.env.AGENT_TOOLS_FUNCTION_ARN;
const VOICE_AGENT_CONFIG = JSON.parse(process.env.VOICE_AGENT_CONFIG || '{}');

// Lambda client for invoking other functions
const lambda = new AWS.Lambda();

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  try {
    console.log('Event received:', JSON.stringify(event));
    
    // Extract the route from the API Gateway event
    const route = event.path.split('/').pop();
    
    switch (route) {
      case 'voice-session':
        return await createVoiceSession(event);
        
      case 'voice-stream':
        return await processVoiceStream(event);
        
      case 'voice-response':
        return await getVoiceResponse(event);
        
      default:
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Route not found' })
        };
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};

/**
 * Create a new voice agent session
 */
async function createVoiceSession(event) {
  try {
    // Parse request body
    const requestBody = JSON.parse(event.body || '{}');
    const { language = 'en-IN', userContext = {} } = requestBody;
    
    // Get agent configuration with appropriate voice for the language
    const agentConfig = await getVoiceAgentConfig(language);
    
    // Create a new session with OpenAI
    console.log('Creating new voice session');
    const session = await openai.beta.voice.createSession(agentConfig);
    
    // Store session information in DynamoDB
    const sessionData = {
      sessionId: session.id,
      created: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      language,
      userContext: JSON.stringify(userContext),
      status: 'active'
    };
    
    await dynamoDB.put({
      TableName: SESSION_TABLE,
      Item: sessionData
    }).promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        sessionId: session.id,
        created: sessionData.created
      })
    };
  } catch (error) {
    console.error('Error creating voice session:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to create voice session',
        details: error.message
      })
    };
  }
}

/**
 * Process audio from the client to OpenAI voice agent
 */
async function processVoiceStream(event) {
  try {
    // Parse request body
    const requestBody = JSON.parse(event.body || '{}');
    const { sessionId, audioData, contentType = 'audio/webm' } = requestBody;
    
    if (!sessionId || !audioData) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing sessionId or audioData'
        })
      };
    }
    
    // Get session from DynamoDB
    const sessionResponse = await dynamoDB.get({
      TableName: SESSION_TABLE,
      Key: { sessionId }
    }).promise();
    
    if (!sessionResponse.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Session not found'
        })
      };
    }
    
    // Update last active timestamp
    await dynamoDB.update({
      TableName: SESSION_TABLE,
      Key: { sessionId },
      UpdateExpression: 'set lastActive = :lastActive',
      ExpressionAttributeValues: {
        ':lastActive': new Date().toISOString()
      }
    }).promise();
    
    // Process audio data
    // The binary audio data is base64-encoded in the request
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Send audio to OpenAI
    console.log(`Sending audio to OpenAI (${audioBuffer.length} bytes)`);
    
    // In a real implementation, we would stream this to OpenAI
    // For Lambda, we'll send the complete chunk and get a response
    const response = await openai.beta.voice.sessions.add(
      sessionId,
      {
        audio: audioBuffer,
        content_type: contentType
      }
    );
    
    // Check for tool calls and invoke agent tools lambda if needed
    if (response.tool_calls && response.tool_calls.length > 0) {
      await handleToolCalls(sessionId, response.tool_calls);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        processed: true,
        message: `Processed ${audioBuffer.length} bytes of audio`,
        toolCalls: response.tool_calls ? response.tool_calls.length : 0
      })
    };
  } catch (error) {
    console.error('Error processing voice stream:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process voice stream',
        details: error.message
      })
    };
  }
}

/**
 * Get voice response from OpenAI
 */
async function getVoiceResponse(event) {
  try {
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const { sessionId } = queryParams;
    
    if (!sessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing sessionId'
        })
      };
    }
    
    // Get session from DynamoDB
    const sessionResponse = await dynamoDB.get({
      TableName: SESSION_TABLE,
      Key: { sessionId }
    }).promise();
    
    if (!sessionResponse.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Session not found'
        })
      };
    }
    
    // Update last active timestamp
    await dynamoDB.update({
      TableName: SESSION_TABLE,
      Key: { sessionId },
      UpdateExpression: 'set lastActive = :lastActive',
      ExpressionAttributeValues: {
        ':lastActive': new Date().toISOString()
      }
    }).promise();
    
    // Get audio response from OpenAI
    console.log('Getting voice response from OpenAI');
    
    // In a real implementation, we would stream the response
    // For simplicity, we'll get the complete audio response
    const response = await openai.beta.voice.sessions.get(sessionId);
    
    // In a real scenario, the audio would be streamed to the client
    // For this Lambda implementation, we'll return the audio as base64
    const audioBase64 = response.audio ? response.audio.toString('base64') : null;
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        audio: audioBase64,
        contentType: 'audio/webm',
        status: response.status,
        hasMore: response.has_more,
        lastEventTimestamp: response.last_event_timestamp
      })
    };
  } catch (error) {
    console.error('Error getting voice response:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to get voice response',
        details: error.message
      })
    };
  }
}

/**
 * Handle tool calls from the OpenAI voice agent
 */
async function handleToolCalls(sessionId, toolCalls) {
  try {
    // Get session data
    const sessionResponse = await dynamoDB.get({
      TableName: SESSION_TABLE,
      Key: { sessionId }
    }).promise();
    
    if (!sessionResponse.Item) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const sessionData = sessionResponse.Item;
    const userContext = JSON.parse(sessionData.userContext || '{}');
    
    // Process each tool call
    for (const toolCall of toolCalls) {
      const { id, function: func } = toolCall;
      
      // Invoke agent tools lambda to execute the function
      const payload = {
        sessionId,
        toolCallId: id,
        function: func.name,
        arguments: func.arguments,
        language: sessionData.language,
        userContext
      };
      
      console.log(`Invoking agent tools lambda for function: ${func.name}`);
      const response = await lambda.invoke({
        FunctionName: AGENT_TOOLS_FUNCTION_ARN,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(payload)
      }).promise();
      
      // Parse the response
      const responsePayload = JSON.parse(response.Payload);
      
      // Submit the tool output back to OpenAI
      await openai.beta.voice.sessions.tools.submit(
        sessionId,
        id,
        {
          output: responsePayload.result
        }
      );
      
      console.log(`Submitted tool output for function: ${func.name}`);
    }
  } catch (error) {
    console.error('Error handling tool calls:', error);
    throw error;
  }
}

/**
 * Get voice agent configuration with language-specific settings
 */
async function getVoiceAgentConfig(language) {
  // Start with base configuration
  const config = { ...VOICE_AGENT_CONFIG };
  
  // Set appropriate voice for the language
  const voice = getVoiceForLanguage(language);
  
  // Update the config with language-specific settings
  config.voice = voice;
  
  return config;
}

/**
 * Get the appropriate voice for a given language
 */
function getVoiceForLanguage(languageCode) {
  const voiceMap = {
    'en-IN': { model: 'nova', voice_id: 'nova' },
    'hi-IN': { model: 'alloy', voice_id: 'alloy' },
    'ta-IN': { model: 'alloy', voice_id: 'alloy' },
    'te-IN': { model: 'alloy', voice_id: 'alloy' },
    'bn-IN': { model: 'alloy', voice_id: 'alloy' },
    'mr-IN': { model: 'alloy', voice_id: 'alloy' }
  };
  
  return voiceMap[languageCode] || { model: 'nova', voice_id: 'nova' };
}
