const express = require('express');
const path = require('path');
const fs = require('fs');

// Create Express application
const app = express();
console.log('Setting up static file serving');

// Define the public directory
const publicDir = path.join(__dirname, 'public');

// Check if the directory exists
const directoryExists = fs.existsSync(publicDir);
console.log('Public directory:', publicDir);
console.log('Directory exists:', directoryExists);

// List files in the public directory
if (directoryExists) {
  const files = fs.readdirSync(publicDir);
  console.log('Files in public directory:');
  files.forEach(file => console.log(' -', file));
}

// Configure static file serving
app.use(express.static(publicDir));

// Add some basic logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Start the server
const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log('\nTry these URLs:');
  console.log(` - http://localhost:${PORT}/test.html`);
  console.log(` - http://localhost:${PORT}/index.html`);
});
