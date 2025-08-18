/**
 * Type definitions for voice agent integration
 */

// Call session tracking interfaces
export interface CallSession {
  callSid: string;
  conferenceName: string;
  startTime: Date;
  status: 'active' | 'completed' | 'failed';
  interactions: CallInteraction[];
  endTime?: Date;
  language?: string; // Selected language for the call
}

export interface CallInteraction {
  timestamp: Date;
  userInput?: string;
  systemResponse?: string;
  toolCalls?: ToolCallRecord[];
  stage?: CallStage;
  language?: string;
}

export interface ToolCallRecord extends ToolCall {
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  status: 'pending' | 'completed' | 'failed';
}

// Twilio specific types
export interface TwiMLResponse {
  twiml: string;
  contentType: string;
}

// Voice API integration interfaces
export interface VoiceSessionConfig {
  name: string;
  model: string;
  voice: {
    model: string;
    voice_id: string;
  };
  tools: Tool[];
  instructions: string;
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}

export interface VoiceSession {
  id: string;
  config: VoiceSessionConfig;
  language: string;
  startTime: Date;
  lastActiveTime: Date;
  isActive: boolean;
  callSid?: string; // For Twilio integration
}

export interface AudioStreamData {
  sessionId: string;
  audio: Buffer | string; // Base64 encoded audio or binary buffer
  contentType: string;
}

export interface VoiceResponse {
  audio: Buffer | string; // Base64 encoded audio or binary buffer
  contentType: string;
  text?: string; // Transcript of the audio response
  toolCalls?: ToolCall[]; // Any tool calls made
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  response?: string;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
}

// Supported languages
export enum SupportedLanguage {
  ENGLISH = 'en-IN',
  HINDI = 'hi-IN',
  TAMIL = 'ta-IN',
  TELUGU = 'te-IN',
  BENGALI = 'bn-IN',
  MARATHI = 'mr-IN'
}

// Call flow stages
export enum CallStage {
  WELCOME = 'welcome',
  LANGUAGE_SELECTION = 'language_selection',
  QUESTION_RECORDING = 'question_recording',
  ANSWER_PLAYBACK = 'answer_playback',
  FOLLOW_UP = 'follow_up',
  EXIT_SURVEY = 'exit_survey',
  GOODBYE = 'goodbye'
}
