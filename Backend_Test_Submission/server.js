const UrlShortenerApp = require('./src/app');
const { logger } = require('./src/middleware/logger');
const { Log } = require('./src/Logging-Middleware/logger'); // ✅ Remote logger
const UrlModel = require('./src/models/UrlModel');

// Environment configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create application instance
const appInstance = new UrlShortenerApp();
const app = appInstance.getApp();

// Start server
const server = app.listen(PORT, HOST, () => {
  logger.info('URL Shortener Microservice started', {
    port: PORT,
    host: HOST,
    environment: NODE_ENV,
    pid: process.pid,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });

  Log("backend", "info", "middleware", "URL Shortener Microservice started"); // 

  console.log(`\n URL Shortener Microservice is running!`);
  console.log(`Server: http://${HOST}:${PORT}`);
  console.log(` Environment: ${NODE_ENV}`);
  console.log(`Process ID: ${process.pid}`);
  console.log(`\n Available Endpoints:`);
  console.log(`   POST http://${HOST}:${PORT}/shorturls - Create short URL`);
  console.log(`   GET  http://${HOST}:${PORT}/shorturls/:shortcode - Get statistics`);
  console.log(`   GET  http://${HOST}:${PORT}/:shortcode - Redirect to original URL`);
  console.log(`   GET  http://${HOST}:${PORT}/health - Health check`);
  console.log(`\n Logs are stored in: ./logs/`);
  console.log(`\n   Press Ctrl+C to stop the server\n`);
});

// Scheduled cleanup of expired URLs (every hour)
const cleanupInterval = setInterval(() => {
  logger.info('Running scheduled cleanup of expired URLs');
  Log("backend", "info", "middleware", "Scheduled cleanup triggered"); // 

  const cleanedCount = UrlModel.cleanupExpired();

  if (cleanedCount > 0) {
    logger.info('Cleanup completed', { expiredUrlsRemoved: cleanedCount });
    Log("backend", "info", "middleware", `${cleanedCount} expired URLs cleaned`); // 
  }
}, 60 * 60 * 1000); // Every 1 hour

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info('Graceful shutdown initiated', { signal });
  Log("backend", "info", "middleware", `Graceful shutdown initiated with signal: ${signal}`); // 

  console.log(`\n Received ${signal}. Shutting down gracefully...`);

  clearInterval(cleanupInterval);

  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', { error: err.message });
      Log("backend", "fatal", "middleware", `Error during shutdown: ${err.message}`); // 
      console.error('❌ Error during shutdown:', err.message);
      process.exit(1);
    }

    logger.info('Server shut down successfully');
    Log("backend", "info", "middleware", "Server shut down successfully"); // 
    console.log(' Server shut down complete');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    Log("backend", "fatal", "middleware", "Forced shutdown due to timeout"); // 
    console.error('❌ Forced shutdown due to timeout');
    process.exit(1);
  }, 10000); // 10s timeout
};

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle server errors
server.on('error', (error) => {
  logger.error('Server error', { error: error.message, stack: error.stack });
  Log("backend", "fatal", "middleware", `Server error: ${error.message}`); // 

  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please use a different port.`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', error.message);
  }
});

module.exports = server;
