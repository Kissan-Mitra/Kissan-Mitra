import app from './app';
import config from './config';

// Start the server
const port = config.app.port;
app.listen(port, () => {
  console.log(`
  ┌───────────────────────────────────────────────┐
  │                                               │
  │             KISSAN MITRA SERVER               │
  │        Agricultural Voice AI Assistant         │
  │                                               │
  └───────────────────────────────────────────────┘

  Server is running on port ${port} in ${config.app.nodeEnv} mode
  
  Available endpoints:
  - POST /voice         : Main Twilio webhook for incoming calls
  - POST /voice/status  : Call status callback webhook
  - GET  /health        : Health check endpoint
  
  Press Ctrl+C to stop the server
  `);
});
