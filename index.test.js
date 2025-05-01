const request = require('supertest');
const app = require('./index');

describe('Signed URL Generator API', () => {
  test('GET / should return welcome message', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Welcome to Signed URL Generator API');
  });

  test('POST /generate should return a signed URL with all required components', async () => {
    const requestBody = {
      username: 'testuser',
      message: 'Test session access'
    };

    const response = await request(app)
      .post('/generate')
      .send(requestBody);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('signedUrl');
    expect(response.body).toHaveProperty('expiresAt');

    // Check URL contains all expected components
    const urlString = `http://example.com${response.body.signedUrl}`;
    const url = new URL(urlString);
    expect(url.searchParams.get('u')).toBe(requestBody.username);
    expect(url.searchParams.has('m')).toBe(false); // message no longer included
    expect(url.searchParams.has('t')).toBe(true); // timestamp
    expect(url.searchParams.has('sig')).toBe(true); // signature
    expect(url.searchParams.has('e')).toBe(false); // expiry not included in URL
  });

  test('POST /generate should reuse cached URL when called with same parameters', async () => {
    const requestBody = {
      username: 'cacheuser',
      message: 'Cacheable message'
    };

    // First call should generate a new URL
    const firstResponse = await request(app)
      .post('/generate')
      .send(requestBody);

    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.body).toHaveProperty('signedUrl');
    expect(firstResponse.body).not.toHaveProperty('cached');

    // Second call with same params should return cached URL
    const secondResponse = await request(app)
      .post('/generate')
      .send(requestBody);

    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.body).toHaveProperty('cached', true);
    expect(secondResponse.body.signedUrl).toBe(firstResponse.body.signedUrl);
  });

  test('GET /active-urls should list active cached URLs', async () => {
    // Generate a few URLs to populate the cache
    await request(app)
      .post('/generate')
      .send({ username: 'user1', message: 'test message 1' });

    await request(app)
      .post('/generate')
      .send({ username: 'user2', message: 'test message 2' });

    // Check active URLs endpoint
    const response = await request(app).get('/active-urls');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('count');
    expect(response.body).toHaveProperty('urls');
    expect(Array.isArray(response.body.urls)).toBe(true);
    expect(response.body.count).toBe(response.body.urls.length);
    expect(response.body.count).toBeGreaterThan(0);

    // Check URL structure
    const urlItem = response.body.urls[0];
    expect(urlItem).toHaveProperty('username');
    expect(urlItem).toHaveProperty('signedUrl');
    expect(urlItem).toHaveProperty('expiresAt');
  });

  test('POST /generate should regenerate URL when cached URL is near expiry', async () => {
    // Mock Date.now() to manipulate time
    const realDateNow = Date.now.bind(global.Date);
    const testTime = realDateNow();
    global.Date.now = jest.fn(() => testTime);

    const requestBody = {
      username: 'expiryuser',
      message: 'Expiring message'
    };

    // First call generates a URL
    const firstResponse = await request(app)
      .post('/generate')
      .send(requestBody);

    // Fast forward time to near expiry (55 minutes later)
    // This should be within the 5-minute buffer window before full expiry
    global.Date.now = jest.fn(() => testTime + (55 * 60 * 1000));

    // Second call should generate a new URL instead of using cache
    const secondResponse = await request(app)
      .post('/generate')
      .send(requestBody);

    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.body).not.toHaveProperty('cached');
    expect(secondResponse.body.signedUrl).not.toBe(firstResponse.body.signedUrl);

    // Restore original Date.now
    global.Date.now = realDateNow;
  });

  test('POST /generate should return 400 when username is missing', async () => {
    const response = await request(app)
      .post('/generate')
      .send({ message: 'Test message' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Username');
  });

  test('POST /generate should return 400 when message is missing', async () => {
    const response = await request(app)
      .post('/generate')
      .send({ username: 'testuser' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Message');
  });

  test('URL verification should work with a valid URL', async () => {
    // First generate a signed URL
    const generateResponse = await request(app)
      .post('/generate')
      .send({
        username: 'testuser',
        message: 'Test verification'
      });

    // Extract just the query parameters from the signed URL
    const urlString = `http://example.com${generateResponse.body.signedUrl}`;
    const url = new URL(urlString);
    const queryParams = url.search;

    // Verify the URL
    const verifyResponse = await request(app)
      .get(`/verify${queryParams}`);

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.body).toHaveProperty('valid', true);
    expect(verifyResponse.body).toHaveProperty('username', 'testuser');
  });

  test('Expired URL should be rejected', async () => {
    // Mock Date.now() to return a future time for verification
    const realDateNow = Date.now.bind(global.Date);
    const testTime = realDateNow();

    // Generate URL at current time
    const generateResponse = await request(app)
      .post('/generate')
      .send({
        username: 'testuser',
        message: 'Test expiration'
      });

    // Fast-forward time by simulating future Date.now() for verification
    global.Date.now = jest.fn(() => testTime + (61 * 60 * 1000)); // 61 minutes later

    // Extract query parameters
    const urlString = `http://example.com${generateResponse.body.signedUrl}`;
    const url = new URL(urlString);
    const queryParams = url.search;

    // Verify the now-expired URL
    const verifyResponse = await request(app)
      .get(`/verify${queryParams}`);

    expect(verifyResponse.statusCode).toBe(401);
    expect(verifyResponse.body).toHaveProperty('error');
    expect(verifyResponse.body.error).toContain('expired');

    // Restore original Date.now
    global.Date.now = realDateNow;
  });
});
