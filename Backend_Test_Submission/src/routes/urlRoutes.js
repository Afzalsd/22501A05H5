const express = require('express');
const router = express.Router();
const UrlModel = require('../models/UrlModel');
const UrlHelpers = require('../utils/helpers');
const { logger } = require('../middleware/logger');
const { Log } = require('../Logging-Middleware/logger'); // ✅ Remote logger

// POST /shorturls - Create a new short URL
router.post('/shorturls', async (req, res) => {
  try {
    const { url, validity, shortcode } = req.body;

    logger.info('Create short URL request', { 
      url, 
      validity, 
      shortcode, 
      ip: UrlHelpers.getClientIP(req) 
    });

    // Validate required fields
    if (!url) {
      logger.warn('Missing required field: url');
      Log("backend", "warn", "handler", "Missing required field: url");
      return res.status(400).json(
        UrlHelpers.formatResponse(false, null, 'URL is required', ['url field is missing'])
      );
    }

    // Validate URL format
    if (!UrlHelpers.isValidUrl(url)) {
      logger.warn('Invalid URL format', { url });
      Log("backend", "warn", "handler", `Invalid URL format: ${url}`);
      return res.status(400).json(
        UrlHelpers.formatResponse(false, null, 'Invalid URL format', ['Please provide a valid HTTP/HTTPS URL'])
      );
    }

    // Validate and set validity period
    let validityMinutes = validity || 30;
    if (validityMinutes < 1 || validityMinutes > 525600) {
      logger.warn('Invalid validity period', { validity: validityMinutes });
      Log("backend", "warn", "handler", `Invalid validity period: ${validityMinutes}`);
      return res.status(400).json(
        UrlHelpers.formatResponse(false, null, 'Invalid validity period', ['Validity must be between 1 and 525600 minutes (1 year)'])
      );
    }

    let finalShortcode = shortcode;

    // Validate custom shortcode if provided
    if (shortcode) {
      if (!UrlHelpers.isValidShortcode(shortcode)) {
        logger.warn('Invalid shortcode format', { shortcode });
        Log("backend", "warn", "handler", `Invalid shortcode format: ${shortcode}`);
        return res.status(400).json(
          UrlHelpers.formatResponse(false, null, 'Invalid shortcode format', ['Shortcode must be 3-20 alphanumeric characters'])
        );
      }

      if (UrlModel.exists(shortcode)) {
        logger.warn('Shortcode already exists', { shortcode });
        Log("backend", "warn", "handler", `Shortcode already exists: ${shortcode}`);
        return res.status(409).json(
          UrlHelpers.formatResponse(false, null, 'Shortcode already exists', ['The provided shortcode is already in use'])
        );
      }
    } else {
      let attempts = 0;
      do {
        finalShortcode = UrlHelpers.generateShortcode();
        attempts++;
        if (attempts > 10) {
          logger.error('Failed to generate unique shortcode after 10 attempts');
          Log("backend", "error", "handler", "Failed to generate unique shortcode after 10 attempts");
          return res.status(500).json(
            UrlHelpers.formatResponse(false, null, 'Unable to generate unique shortcode', ['Please try again'])
          );
        }
      } while (UrlModel.exists(finalShortcode));
    }

    const expiryDate = UrlHelpers.calculateExpiryDate(validityMinutes);
    const urlData = UrlModel.create(finalShortcode, url, expiryDate);
    const shortLink = UrlHelpers.generateShortUrl(req, finalShortcode);

    logger.info('Short URL created successfully', {
      shortcode: finalShortcode,
      originalUrl: url,
      shortLink,
      expiryDate: expiryDate.toISOString()
    });
    Log("backend", "info", "handler", `Short URL created: ${finalShortcode}`);

    res.status(201).json({
      shortLink,
      expiry: expiryDate.toISOString()
    });

  } catch (error) {
    logger.error('Error creating short URL', { 
      error: error.message, 
      stack: error.stack,
      requestBody: req.body 
    });
    Log("backend", "error", "handler", `Error creating short URL: ${error.message}`);
    
    res.status(500).json(
      UrlHelpers.formatResponse(false, null, 'Internal server error', ['An unexpected error occurred'])
    );
  }
});

// GET /shorturls/:shortcode - Get statistics for a short URL
router.get('/shorturls/:shortcode', async (req, res) => {
  try {
    const { shortcode } = req.params;

    logger.info('Get URL statistics request', { 
      shortcode,
      ip: UrlHelpers.getClientIP(req)
    });

    if (!UrlHelpers.isValidShortcode(shortcode)) {
      logger.warn('Invalid shortcode format in statistics request', { shortcode });
      Log("backend", "warn", "handler", `Invalid shortcode format for stats: ${shortcode}`);
      return res.status(400).json(
        UrlHelpers.formatResponse(false, null, 'Invalid shortcode format', ['Shortcode must be 3-20 alphanumeric characters'])
      );
    }

    const analytics = UrlModel.getAnalytics(shortcode);

    if (!analytics) {
      logger.warn('Shortcode not found for statistics', { shortcode });
      Log("backend", "warn", "handler", `Shortcode not found for stats: ${shortcode}`);
      return res.status(404).json(
        UrlHelpers.formatResponse(false, null, 'Short URL not found', ['The requested shortcode does not exist or has expired'])
      );
    }

    logger.info('URL statistics retrieved', {
      shortcode,
      totalClicks: analytics.totalClicks,
      isActive: analytics.isActive
    });
    Log("backend", "info", "handler", `Stats retrieved for shortcode: ${shortcode}`);

    res.status(200).json({
      shortcode: analytics.shortcode,
      originalUrl: analytics.originalUrl,
      createdAt: analytics.createdAt,
      expiryDate: analytics.expiryDate,
      isActive: analytics.isActive,
      totalClicks: analytics.totalClicks,
      clickDetails: analytics.clicks.map(click => ({
        timestamp: click.timestamp,
        referrer: click.referrer,
        location: {
          country: click.location.country,
          region: click.location.region,
          city: click.location.city
        },
        userAgent: click.userAgent
      }))
    });

  } catch (error) {
    logger.error('Error retrieving URL statistics', { 
      error: error.message, 
      stack: error.stack,
      shortcode: req.params.shortcode 
    });
    Log("backend", "error", "handler", `Error retrieving stats: ${error.message}`);

    res.status(500).json(
      UrlHelpers.formatResponse(false, null, 'Internal server error', ['An unexpected error occurred'])
    );
  }
});

module.exports = router;
