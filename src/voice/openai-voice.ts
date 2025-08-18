import { OpenAI } from 'openai';
import config from '../config';
import { executeToolFunction } from '../agent/tool-functions';
import { CallSession } from './types';
import { addCallInteraction, getCallSession, updateCallSession } from './call-manager';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Active voice agent sessions
interface AgentSession {
  callSid: string;
  conferenceName: string;
  session: any; // OpenAI voice session
  startTime: Date;
  status: 'connecting' | 'active' | 'ended';
}

const activeSessions: Record<string, AgentSession> = {};

/**
 * Start an OpenAI voice agent session for a call
 * @param callSid Twilio Call SID
 * @param conferenceName Name of the Twilio conference to join
 */
export async function startOpenAIAgent(callSid: string, conferenceName: string): Promise<void> {
  try {
    console.log(`Starting OpenAI voice agent for call ${callSid}`);
    
    // Create voice agent configuration
    const voiceAgentConfig = createAgentConfiguration();
    
    // For hackathon/demo purposes, we'll just log what would happen
    // since we don't have actual Twilio-OpenAI voice integration set up
    console.log(`[MOCK] Creating voice session for call ${callSid}`);
    console.log(`[MOCK] Agent config:`, JSON.stringify(voiceAgentConfig, null, 2));
    
    // In a real implementation with valid API keys, we would:
    // const session = await openai.beta.voice.createSession(voiceAgentConfig);
    
    // Store mock session for now
    const mockSession = {
      id: `mock-session-${Date.now()}`,
      on: (event: string, callback: Function) => {
        console.log(`[MOCK] Registered event handler for: ${event}`);
      },
      close: async () => {
        console.log(`[MOCK] Closing voice session for call ${callSid}`);
      }
    };
    
    // Store session for later reference
    activeSessions[callSid] = {
      callSid,
      conferenceName,
      session: mockSession,
      startTime: new Date(),
      status: 'active'
    };
    
    // Update call session with language info
    updateCallSession(callSid, {
      language: 'en-IN' // Default language
    });
    
    console.log(`Voice agent started successfully for call ${callSid}`);
    return;
  } catch (error) {
    console.error('Error starting OpenAI voice agent:', error);
    throw error;
  }
}

/**
 * End an OpenAI voice agent session
 * @param callSid Twilio Call SID
 */
export async function endOpenAIAgent(callSid: string): Promise<void> {
  try {
    const sessionInfo = activeSessions[callSid];
    if (sessionInfo && sessionInfo.session) {
      // Close the session
      await sessionInfo.session.close();
      
      // Update session status
      sessionInfo.status = 'ended';
      
      console.log(`Voice agent ended successfully for call ${callSid}`);
    }
  } catch (error) {
    console.error(`Error ending OpenAI voice agent for call ${callSid}:`, error);
  }
}

/**
 * Create the OpenAI voice agent configuration
 */
function createAgentConfiguration() {
  return {
    name: "Krishi Mitra", // "Farmer's Friend" in Hindi
    model: config.openai.model,
    voice: {
      model: "nova", // High quality voice model
      voice_id: config.openai.voiceId
    },
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather_forecast",
          description: "Get weather forecast for a location",
          parameters: {
            type: "object",
            properties: {
              district: {
                type: "string",
                description: "The district to get weather for"
              },
              days: {
                type: "number",
                description: "Number of days forecast"
              }
            },
            required: ["district"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_crop_recommendations",
          description: "Get crop recommendations based on season and location",
          parameters: {
            type: "object",
            properties: {
              district: {
                type: "string",
                description: "The district"
              },
              soil_type: {
                type: "string",
                description: "Type of soil"
              },
              season: {
                type: "string",
                enum: ["kharif", "rabi", "zaid"],
                description: "The growing season"
              }
            },
            required: ["district", "season"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_market_prices",
          description: "Get current market prices for crops",
          parameters: {
            type: "object",
            properties: {
              crop: {
                type: "string",
                description: "The crop name"
              },
              market_area: {
                type: "string",
                description: "Market area or district"
              }
            },
            required: ["crop"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "check_government_schemes",
          description: "Get information about government schemes for farmers",
          parameters: {
            type: "object",
            properties: {
              farmer_type: {
                type: "string",
                description: "Type of farmer (small, medium, large)"
              },
              crop_type: {
                type: "string",
                description: "Type of crop"
              },
              state: {
                type: "string",
                description: "Indian state"
              }
            },
            required: ["state"]
          }
        }
      }
    ],
    instructions: `You are Krishi Mitra (Farmer's Friend), an agricultural advisor for farmers in India.
    
    Help farmers with:
    - Weather forecasts and irrigation timing
    - Crop recommendations based on soil and season
    - Market price information and selling advice
    - Pest and disease management
    - Government schemes and financial assistance

    Always speak clearly and simply. Use short sentences. Be respectful and empathetic.
    
    For weather advice, always consider recent rainfall and temperature patterns.
    For market advice, explain price trends and compare to historical patterns.
    For crop recommendations, factor in water availability and climate resilience.
    
    If you don't know something, say so clearly and never provide incorrect information.
    
    At the end of the conversation, summarize your advice in 1-2 simple sentences.`
  };
}
