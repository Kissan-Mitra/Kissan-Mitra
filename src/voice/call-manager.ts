import { CallSession, CallInteraction, ToolCallRecord } from './types';

/**
 * Call session manager for tracking active calls
 */

// Active call sessions
const callSessions: Record<string, CallSession> = {};

/**
 * Create a new call session
 */
export function createCallSession(callSid: string, conferenceName: string): CallSession {
  const session: CallSession = {
    callSid,
    conferenceName,
    startTime: new Date(),
    status: 'active',
    interactions: []
  };
  
  callSessions[callSid] = session;
  return session;
}

/**
 * Get a call session by SID
 */
export function getCallSession(callSid: string): CallSession | undefined {
  return callSessions[callSid];
}

/**
 * Update a call session
 */
export function updateCallSession(callSid: string, updates: Partial<CallSession>): CallSession {
  const session = callSessions[callSid];
  if (!session) {
    throw new Error(`Call session not found: ${callSid}`);
  }
  
  // Apply updates
  Object.assign(session, updates);
  
  return session;
}

/**
 * Add an interaction to a call session
 */
export function addCallInteraction(callSid: string, interaction: Partial<CallInteraction>): CallSession {
  const session = callSessions[callSid];
  if (!session) {
    throw new Error(`Call session not found: ${callSid}`);
  }
  
  const newInteraction: CallInteraction = {
    timestamp: new Date(),
    ...interaction
  };
  
  session.interactions.push(newInteraction);
  
  return session;
}

/**
 * End a call session
 */
export function endCallSession(callSid: string): CallSession {
  const session = callSessions[callSid];
  if (!session) {
    throw new Error(`Call session not found: ${callSid}`);
  }
  
  session.status = 'completed';
  session.endTime = new Date();
  
  return session;
}

/**
 * Get all active call sessions
 */
export function getActiveSessions(): CallSession[] {
  return Object.values(callSessions).filter(session => session.status === 'active');
}

/**
 * Get call session statistics
 */
export function getCallStatistics() {
  const allSessions = Object.values(callSessions);
  const activeSessions = allSessions.filter(s => s.status === 'active');
  const completedSessions = allSessions.filter(s => s.status === 'completed');
  const failedSessions = allSessions.filter(s => s.status === 'failed');
  
  // Calculate average call duration for completed calls
  const avgDurationMs = completedSessions.length > 0 
    ? completedSessions.reduce((sum, s) => sum + ((s.endTime?.getTime() || 0) - s.startTime.getTime()), 0) / completedSessions.length
    : 0;
  
  return {
    total: allSessions.length,
    active: activeSessions.length,
    completed: completedSessions.length,
    failed: failedSessions.length,
    averageDurationSeconds: avgDurationMs > 0 ? Math.round(avgDurationMs / 1000) : 0
  };
}
