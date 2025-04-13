# 0to100 API

## Security Model

The 0to100 API implements the following security measures:

1. **Password Security**:
   - Passwords are never stored in plain text
   - All passwords are hashed using bcrypt with unique salts
   - Password hashing is performed server-side

2. **Transport Security**:
   - Development: HTTP for easier local development
   - Production: HTTPS with proper certificates
   - All production traffic is encrypted

3. **Authentication**:
   - JWT tokens with 12-hour expiration
   - Secure cookies in production environments
   - Rate limiting on authentication endpoints

4. **API Security**:
   - CORS protection with allowlist of domains
   - Helmet.js for HTTP security headers
   - Rate limiting to prevent abuse

## Development Setup

To run the API in development mode:

```
npm run dev
```

## Production Deployment

For production, you'll need to:

1. Generate proper SSL certificates
2. Add them to the `certs` directory as `server.cert` and `server.key`
3. Set environment to production: `NODE_ENV=production`
4. Run with: `npm run prod` 