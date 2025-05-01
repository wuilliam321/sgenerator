const express = require('express');
const crypto = require('crypto');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const app = express();
const PORT = process.env.PORT || 3000;

// Secret key for signing URLs
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';

// Default URL expiry time in minutes
const MINUTES = 60 * 1000
const DEFAULT_EXPIRY_MINUTES = 60 * MINUTES;
const DEFAULT_EXPIRY_BUFFER_MINUTES = 5 * MINUTES;


// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Signed URL Generator API',
      version: '1.0.0',
      description: 'A service to generate signed URLs',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./index.js'], // files containing annotations
};

// Cache for storing active signed URLs
// Format: { key: { signedUrl, expiresAt, timestamp } }
const urlCache = new Map();

// Middleware
app.use(express.json());

// Initialize Swagger
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /:
 *   get:
 *     summary: Welcome message
 *     description: Returns a welcome message for the API
 *     responses:
 *       200:
 *         description: Welcome message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 */
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Signed URL Generator API' });
});

/**
 * @swagger
 * /generate:
 *   post:
 *     summary: Generate a signed URL
 *     description: Generates a URL with signature based on username and message
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - message
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username for the signed URL
 *               message:
 *                 type: string
 *                 description: Message to include in the signed URL
 *     responses:
 *       200:
 *         description: Successfully generated signed URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signedUrl:
 *                   type: string
 *                   description: The generated signed URL
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: Expiration date and time
 *                 cached:
 *                   type: boolean
 *                   description: Whether the URL was retrieved from cache
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
app.post('/generate', (req, res) => {
  const { username, message } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Generate cache key based on username and message
  const cacheKey = `${username}`;

  // Check if we have a valid cached URL
  if (urlCache.has(cacheKey)) {
    const cachedData = urlCache.get(cacheKey);
    const now = Date.now();

    // Add a buffer of 5 minutes to ensure we don't serve nearly-expired URLs
    const safeExpiryTime = new Date(cachedData.expiresAt).getTime() - DEFAULT_EXPIRY_BUFFER_MINUTES;

    if (now < safeExpiryTime) {
      // Return the cached URL if it's still valid
      return res.json({
        signedUrl: cachedData.signedUrl,
        expiresAt: cachedData.expiresAt,
        cached: true
      });
    }
    // If expired or close to expiry, remove from cache
    urlCache.delete(cacheKey);
  }

  // Current timestamp
  const timestamp = Date.now();

  // Calculate expiry time (server-side only)
  const expiryTime = timestamp + (DEFAULT_EXPIRY_MINUTES);

  // Data to sign - no longer using message in signature
  const dataToSign = `${username}:${timestamp}`;

  // Create signature
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(dataToSign)
    .digest('hex');

  // Create signed URL with just the path and query parameters
  const signedUrl = `/session?u=${encodeURIComponent(username)}&t=${timestamp}&sig=${signature}`;

  // Store in cache
  urlCache.set(cacheKey, {
    signedUrl,
    expiresAt: new Date(expiryTime).toISOString(),
    timestamp
  });

  res.json({
    signedUrl,
    expiresAt: new Date(expiryTime).toISOString()
  });
});

/**
 * @swagger
 * /verify:
 *   get:
 *     summary: Verify a signed URL
 *     description: Verifies the signature and expiration of a signed URL
 *     parameters:
 *       - in: query
 *         name: u
 *         schema:
 *           type: string
 *         required: true
 *         description: Username from the URL
 *       - in: query
 *         name: t
 *         schema:
 *           type: string
 *         required: true
 *         description: Timestamp from the URL
 *       - in: query
 *         name: sig
 *         schema:
 *           type: string
 *         required: true
 *         description: Signature from the URL
 *     responses:
 *       200:
 *         description: Valid signed URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 username:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Invalid or expired URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
app.get('/verify', (req, res) => {
  const { u: username, t: timestamp, sig: signature } = req.query;

  // Check if URL has expired
  const expiryTime = parseInt(timestamp) + (DEFAULT_EXPIRY_MINUTES);
  if (Date.now() > expiryTime) {
    return res.status(401).json({ error: 'URL has expired' });
  }

  // Verify signature - no message in signature verification
  const dataToSign = `${username}:${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(dataToSign)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  res.json({
    valid: true,
    username,
    expiresAt: new Date(expiryTime).toISOString()
  });
});

/**
 * @swagger
 * /active-urls:
 *   get:
 *     summary: List active signed URLs
 *     description: Lists all active signed URLs in the cache
 *     responses:
 *       200:
 *         description: List of active URLs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of active URLs
 *                 urls:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       username:
 *                         type: string
 *                       message:
 *                         type: string
 *                       signedUrl:
 *                         type: string
 *                       expiresAt:
 *                         type: string
 *                         format: date-time
 */
app.get('/active-urls', (req, res) => {
  const now = Date.now();
  const activeUrls = [];

  urlCache.forEach((data, key) => {
    const expiryTime = new Date(data.expiresAt).getTime();

    if (now < expiryTime) {
      const [username, message] = key.split(':');
      activeUrls.push({
        username,
        message,
        signedUrl: data.signedUrl,
        expiresAt: data.expiresAt
      });
    } else {
      // Clean up expired entries
      urlCache.delete(key);
    }
  });

  res.json({
    count: activeUrls.length,
    urls: activeUrls
  });
});

// Only start the server if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app; // Export for testing
