import VoiceResponse = require('twilio/lib/twiml/VoiceResponse');
import twilio from 'twilio';
import config from '../config';
import { TwiMLResponse as ITwiMLResponse } from './types';
import { createCallSession, updateCallSession, endCallSession } from './call-manager';
import { startOpenAIAgent, endOpenAIAgent } from './openai-voice';

// Initialize Twilio client
const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

// Re-export Twilio VoiceResponse as TwiMLResponse for routes.ts
export class TwiMLResponse extends VoiceResponse {}

/**
 * Handle incoming voice calls
 * @param body Twilio webhook request body
 * @returns TwiML response
 */
export async function handleIncomingCall(body: any): Promise<VoiceResponse> {
  console.log('Incoming call received:', body);
  
  // Create a new call session
  const callSid = body.CallSid;
  const conferenceName = `KissanMitra-${callSid}`;
  
  // Track the call in our system
  createCallSession(callSid, conferenceName);
  
  // Create TwiML response
  const twiml = new VoiceResponse();
  
  // Welcome message
  twiml.say({
    voice: 'woman',
    language: 'en-IN'
  }, 'Welcome to Kissan Mitra, your agricultural assistant.');
  
  // Create a conference call that our agent will join
  twiml.dial().conference({
    statusCallback: `/voice/conference/status?callSid=${callSid}`,
    statusCallbackEvent: ['start', 'end', 'join', 'leave', 'mute', 'hold'],
    endConferenceOnExit: true,
    startConferenceOnEnter: true,
    record: 'record-from-start',
    recordingStatusCallback: '/voice/recording',
    waitUrl: 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical'
  }, conferenceName);
  
  // Start OpenAI voice agent in separate process (non-blocking)
  try {
    // This is asynchronous but we don't await it
    // so the call flow can continue while the agent connects
    startOpenAIAgent(callSid, conferenceName);
  } catch (error) {
    console.error('Error starting OpenAI agent:', error);
    // Continue with the call even if there's an error with the agent
  }
  
  return twiml;
}

/**
 * Handle call status callbacks
 * @param body Twilio status callback request body
 */
export async function handleCallStatus(body: any): Promise<void> {
  console.log('Call status update:', body);
  
  const callSid = body.CallSid;
  
  if (body.CallStatus === 'completed' || body.CallStatus === 'failed') {
    try {
      // End the OpenAI agent session
      await endOpenAIAgent(callSid);
      
      // Update our call session
      endCallSession(callSid);
    } catch (error) {
      console.error(`Error handling call end for ${callSid}:`, error);
    }
  } else {
    // Update call status in our tracking system
    updateCallSession(callSid, {
      status: body.CallStatus === 'in-progress' ? 'active' : body.CallStatus
    });
  }
}

/**
 * Handle recording status callbacks
 * @param body Twilio recording status callback request body
 */
export async function handleRecording(body: any): Promise<void> {
  console.log('Recording update:', body);
  
  // In a production system, we might store the recording URL
  // or process the recording for analytics
}

/**
 * Handle conference status callbacks
 * @param body Twilio conference status callback request body
 */
export async function handleConferenceStatus(body: any): Promise<void> {
  console.log('Conference status update:', body);
  
  // Extract call SID from the query parameters
  const callSid = body.CallSid;
  
  if (body.ConferenceStatus === 'completed') {
    try {
      // End the OpenAI agent session
      await endOpenAIAgent(callSid);
      
      // Update our call session
      endCallSession(callSid);
    } catch (error) {
      console.error(`Error handling conference end for ${callSid}:`, error);
    }
  }
}
