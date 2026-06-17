// Entry point: middleware, route mounts, server listen.
// Business logic lives in routes/, db/, and services/.

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check (no DB hit — lets Neon auto-suspend)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// API routes
app.use('/api/leads', require('./routes/leads'));
app.use('/api/counties', require('./routes/counties'));

// Marketing landing page (public, no auth)
app.use('/', require('./routes/marketing'));

// App pages
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/lead/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'lead-detail.html'));
});

app.get('/counties', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'counties.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
