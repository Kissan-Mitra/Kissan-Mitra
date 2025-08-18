import { Express, Request, Response } from 'express';
import { TwiMLResponse as ITwiMLResponse } from './types';
import { 
  TwiMLResponse, 
  handleIncomingCall, 
  handleCallStatus, 
  handleRecording, 
  handleConferenceStatus 
} from './twilio-handler';

/**
 * Sets up all voice-related routes for the application
 * @param app Express application
 */
export function setupVoiceRoutes(app: Express): void {
  // Main voice webhook endpoint for incoming calls
  app.post('/voice', async (req: Request, res: Response) => {
    try {
      const twimlResponse = await handleIncomingCall(req.body);
      res.type('text/xml');
      res.send(twimlResponse.toString());
    } catch (error) {
      console.error('Error handling incoming call:', error);
      const errorResponse = new TwiMLResponse();
      errorResponse.say({ voice: 'woman', language: 'en-IN' }, 'Sorry, an error occurred. Please try again later.');
      res.type('text/xml');
      res.send(errorResponse.toString());
    }
  });

  // Call status callback endpoint
  app.post('/voice/status', async (req: Request, res: Response) => {
    try {
      await handleCallStatus(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling call status:', error);
      res.sendStatus(500);
    }
  });

  // Recording status callback endpoint
  app.post('/voice/recording', async (req: Request, res: Response) => {
    try {
      await handleRecording(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling recording:', error);
      res.sendStatus(500);
    }
  });

  // Conference status callback endpoint
  app.post('/voice/conference/status', async (req: Request, res: Response) => {
    try {
      await handleConferenceStatus(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling conference status:', error);
      res.sendStatus(500);
    }
  });
}
