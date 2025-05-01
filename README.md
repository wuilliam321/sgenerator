# Signed URL Generator

A Node.js service for generating and verifying signed URLs with built-in caching.

## Features

- Generate signed URLs with username and message parameters
- Verify signed URLs using secure HMAC-SHA256 signatures
- Automatic URL caching to improve performance
- URL expiration and cache invalidation
- List active URLs in the cache
- OpenAPI documentation with Swagger UI

## Installation

```bash
# Clone the repository
git clone git@github.com:wuilliam321/sgenerator.git signed-url-generator
cd signed-url-generator

# Install dependencies
npm install
```

## Configuration

Set the following environment variables:

- `PORT`: Server port (defaults to 3000)
- `SECRET_KEY`: Secret key for signing URLs (defaults to 'your-secret-key', but should be changed in production)

## Usage

### Start the server

```bash
npm start
```

The server will run on port 3000 by default.

### API Endpoints

| Endpoint      | Method | Description                   |
|---------------|--------|-------------------------------|
| /             | GET    | Welcome message               |
| /generate     | POST   | Generate a signed URL         |
| /verify       | GET    | Verify a signed URL           |
| /active-urls  | GET    | List active signed URLs       |
| /api-docs     | GET    | Swagger documentation         |

### Generate a signed URL

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "message": "Hello World"}'
```

Response:
```json
{
  "signedUrl": "/session?u=john&t=1609459200000&sig=abc123...",
  "expiresAt": "2021-01-01T01:00:00.000Z"
}
```

### Verify a signed URL

```bash
curl "http://localhost:3000/verify?u=john&t=1609459200000&sig=abc123..."
```

Response:
```json
{
  "valid": true,
  "username": "john",
  "expiresAt": "2021-01-01T01:00:00.000Z"
}
```

## API Documentation

Swagger UI is available at `/api-docs` when the server is running:

```
http://localhost:3000/api-docs
```

## Testing

Run the test suite:

```bash
npm test
```

Run a specific test:

```bash
npm test -- -t "test name pattern"
```

Debug tests:

```bash
npm test -- --debug
```

## License

TBD
