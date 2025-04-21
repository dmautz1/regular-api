# 0to100 API Server

This is the API server for the 0to100 application.

## Migration to Supabase

This project is being migrated from MongoDB to Supabase for database, authentication, and storage. Below are the steps for migration:

### Prerequisites

1. Create a Supabase project at [https://supabase.com](https://supabase.com)
2. Get your Supabase URL and anon key from the project settings
3. Add these values to your environment variables

### Environment Configuration

Add the following variables to your `.env` file:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Database Migration

1. Set up the database schema:
   - Run the SQL in `migrations/supabase-schema.sql` in the Supabase SQL editor
   - This creates all necessary tables with proper relationships and security policies

2. Migrate your data:
   ```bash
   npm run migrate:data
   ```

3. Migrate your files:
   ```bash
   npm run migrate:files:avatars
   npm run migrate:files:programs
   ```

### Testing Supabase Connection

You can test your Supabase connection with:

```bash
npm run test:supabase
```

### Running with Supabase

During the migration phase, the API supports both MongoDB and Supabase. 

- MongoDB auth routes: `/auth/*`
- Supabase auth routes: `/auth/supabase/*`
- MongoDB tasks API: `/tasks/*`
- Supabase tasks API: `/tasks/supabase/*`

To fully switch to Supabase, update the API routes in your client application to use the Supabase endpoints.

### Updated API Endpoints

The following endpoints are available for the Supabase tasks API:

- `GET /tasks/supabase` - Get tasks for a specific day
- `GET /tasks/supabase/:userId/:day` - Get tasks for a specific user and day
- `POST /tasks/supabase/populate` - Populate tasks for a day based on user's program subscriptions
- `PATCH /tasks/supabase/:id/complete` - Toggle completion status of a task
- `DELETE /tasks/supabase/:id/delete` - Delete a task (or mark as deleted for program-related tasks)
- `POST /tasks/supabase/new` - Create a new task

### Deployment Considerations

When deploying to production:

1. Ensure all environment variables are properly set
2. Run the migration scripts on your production server
3. Update client-side code to use the new API endpoints

## Standard API Documentation

### Running the Server

```bash
npm run dev     # Development mode
npm run test    # Test mode
npm run prod    # Production mode
```

### API Routes

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login a user
- `POST /auth/request-reset` - Request password reset
- `POST /auth/reset-password` - Reset password

For detailed API documentation, refer to the API specification document.

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