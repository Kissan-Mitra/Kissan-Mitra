const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// For all other requests, send the index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Kissan Mitra static server running at http://localhost:${port}`);
  console.log(`Open http://localhost:${port} in your browser to view the application`);
});
