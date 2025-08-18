import express, { Request, Response, NextFunction } from 'express';
import config from './config';
import { setupVoiceRoutes } from './voice/routes';
import path from 'path';

// Initialize Express app
const app = express();

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add basic logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.app.nodeEnv
  });
});

// Set up voice routes
setupVoiceRoutes(app);

// Serve static files from the public directory
const publicPath = path.join(__dirname, '../public');
console.log('Configuring static files from:', publicPath);
const publicDirExists = require('fs').existsSync(publicPath);
console.log('Public directory exists:', publicDirExists);

// List files in the public directory
if (publicDirExists) {
  const files = require('fs').readdirSync(publicPath);
  console.log('Files in public directory:');
  files.forEach((file: string) => console.log(' -', file));
}

// Serve static files from the public directory
app.use(express.static(publicPath));

// Route for the root path to serve index.html
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.app.nodeEnv === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', message: `Path ${req.path} not found` });
});

// Start server if this file is run directly
if (require.main === module) {
  const port = config.app.port;
  app.listen(port, () => {
    console.log(`Kissan Mitra server is running on port ${port} in ${config.app.nodeEnv} mode`);
  });
}

export default app;
