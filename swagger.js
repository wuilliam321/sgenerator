const swaggerJsDoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Import port from main app to ensure consistency
const PORT = process.env.PORT || 3000;

// Swagger definition - matches the one in index.js
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

// Generate swagger specification
const swaggerSpec = swaggerJsDoc(swaggerOptions);

// Convert to YAML
const swaggerYaml = yaml.dump(swaggerSpec);

// Write to file
fs.writeFileSync(
  path.join(__dirname, 'swagger.yaml'),
  swaggerYaml,
  'utf8'
);

console.log('Swagger documentation generated as swagger.yaml');