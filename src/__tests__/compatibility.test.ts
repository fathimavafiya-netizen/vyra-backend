import request from 'supertest';
import server from '../server';

describe('Web and Mobile Compatibility Tests', () => {
  afterAll((done) => {
    server.close(done);
  });

  describe('Web Compatibility (CORS & Headers)', () => {
    it('should return CORS headers allowing cross-origin requests for web browsers', async () => {
      const response = await request(server)
        .options('/health') // Preflight request
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });

    it('should successfully parse web user agents', async () => {
      const response = await request(server)
        .get('/health')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Mobile Compatibility', () => {
    it('should correctly accept and respond to mobile user agents (iOS/Android)', async () => {
      const iosResponse = await request(server)
        .get('/health')
        .set('User-Agent', 'VyraApp/1.0 (iPhone; iOS 15.0; Scale/3.00)');

      expect(iosResponse.status).toBe(200);
      expect(iosResponse.body.success).toBe(true);

      const androidResponse = await request(server)
        .get('/health')
        .set('User-Agent', 'VyraApp/1.0 (Android 12; Mobile; rv:68.0)');

      expect(androidResponse.status).toBe(200);
      expect(androidResponse.body.success).toBe(true);
    });

    it('should handle missing Origin headers gracefully (typical for mobile native apps)', async () => {
      // Mobile apps often don't send Origin headers like browsers do
      const response = await request(server)
        .get('/health')
        .unset('Origin');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
