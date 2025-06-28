const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { logger, requestLogger } = require('./middleware/logger');
const { Log } = require('./Logging-Middleware/logger'); // ✅ Remote logger
const urlRoutes = require('./routes/urlRoutes');
const redirectRoutes = require('./routes/redirectRoutes');

class UrlShortenerApp {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false // Disable for redirect functionality
    }));

    // CORS middleware
    this.app.use(cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Trust proxy
    this.app.set('trust proxy', true);

    // Request logging middleware
    this.app.use(requestLogger);

    // Body parsers
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request sanitization
    this.app.use((req, res, next) => {
      if (req.body) {
        Object.keys(req.body).forEach(key => {
          if (typeof req.body[key] === 'string') {
            req.body[key] = req.body[key].trim();
          }
        });
      }
      next();
    });

    logger.info('Middleware setup completed');
    Log("backend", "info", "middleware", "Middleware setup completed"); // ✅ Remote logging
  }

  setupRoutes() {
    // API & direct routes
    this.app.use('/api', urlRoutes);
    this.app.use('/', urlRoutes);

    // Redirect route (should be last)
    this.app.use('/', redirectRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      logger.info('Root endpoint accessed');
      Log("backend", "info", "middleware", "Root endpoint accessed"); // ✅

      res.json({
        service: 'URL Shortener Microservice',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
          create: 'POST /shorturls',
          statistics: 'GET /shorturls/:shortcode',
          redirect: 'GET /:shortcode',
          health: 'GET /health'
        }
      });
    });

    logger.info('Routes setup completed');
    Log("backend", "info", "middleware", "Routes setup completed"); // ✅
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      logger.warn('404 - Route not found', {
        method: req.method,
        url: req.url,
        ip: req.ip
      });
      Log("backend", "warn", "middleware", `404 - Route not found: ${req.method} ${req.url}`); // ✅

      res.status(404).json({
        success: false,
        message: 'Route not found',
        timestamp: new Date().toISOString(),
        path: req.url
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        ip: req.ip
      });
      Log("backend", "error", "middleware", `Unhandled error: ${error.message}`); // ✅

      res.status(error.status || 500).json({
        success: false,
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    });

    // Catch uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      Log("backend", "fatal", "middleware", `Uncaught Exception: ${error.message}`); // ✅
      process.exit(1);
    });

    // Catch unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason,
        promise
      });
      Log("backend", "fatal", "middleware", `Unhandled Rejection: ${reason}`); // ✅
      process.exit(1);
    });

    logger.info('Error handling setup completed');
    Log("backend", "info", "middleware", "Error handling setup completed"); // ✅
  }

  getApp() {
    return this.app;
  }
}

module.exports = UrlShortenerApp;
