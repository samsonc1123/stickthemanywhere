# Security Middleware Implementation

This directory contains security middleware for protecting sensitive API routes in the application.

## Authentication Middleware

### `requireAdminAuth`
- **Purpose**: Protects admin-only routes with authentication and authorization checks
- **Implementation**: Combines authentication token verification with admin privilege validation
- **Usage**: Applied to all GitHub integration routes to prevent unauthorized access

### Authentication Flow
1. **Token Verification**: Checks for `x-admin-token` header
2. **Token Validation**: Validates against `ADMIN_TOKEN` environment variable
3. **User Context**: Attaches authenticated user data to request object
4. **Admin Check**: Verifies user has administrative privileges

### Security Configuration
- **Token Header**: `x-admin-token`
- **Environment Variable**: `ADMIN_TOKEN` (must be set for production)
- **Error Handling**: Returns structured 401/403 errors with clear messages

## Validation Middleware

### Request Validation
- **Body Validation**: `validateBody()` - Validates request payloads
- **Query Validation**: `validateQuery()` - Validates query parameters  
- **Params Validation**: `validateParams()` - Validates URL parameters

### Zod Schema Integration
- **Repository Creation**: Validates name (required), description, privacy settings
- **Issue Creation**: Validates title (required), body, labels array
- **Pagination**: Validates page numbers and limits with defaults
- **Repository Parameters**: Validates owner/repo URL segments

### Error Handling
- Returns structured 400 errors with field-level validation details
- Includes human-readable error messages for API consumers
- Prevents malformed requests from reaching business logic

## Protected Routes

All GitHub integration routes are now secured:

### Repository Management
- `GET /api/github/user` - Get current GitHub user
- `GET /api/github/repositories` - List user repositories
- `POST /api/github/repositories` - Create new repository
- `GET /api/github/repositories/:owner/:repo` - Get specific repository

### Repository Operations
- `GET /api/github/repositories/:owner/:repo/commits` - Get commits
- `GET /api/github/repositories/:owner/:repo/branches` - Get branches
- `GET /api/github/repositories/:owner/:repo/workflows` - Get workflow runs
- `POST /api/github/repositories/:owner/:repo/workflows/deploy` - Create deployment

### Issue Management
- `GET /api/github/repositories/:owner/:repo/issues` - Get issues
- `POST /api/github/repositories/:owner/:repo/issues` - Create issue

## Usage Example

```typescript
// Protected route with authentication and validation
app.post("/api/github/repositories", 
  requireAdminAuth, 
  validateBody(createRepositorySchema), 
  async (req: AuthenticatedRequest, res) => {
    // Route logic here - user is authenticated and data is validated
  }
);
```

## Security Benefits

1. **Access Control**: Only authenticated admin users can access GitHub operations
2. **Data Validation**: All request data is validated before processing
3. **Error Handling**: Consistent, secure error responses
4. **Token Management**: Centralized authentication logic
5. **Type Safety**: TypeScript integration with validated request types

## Production Considerations

1. **Environment Variables**: Ensure `ADMIN_TOKEN` is set securely
2. **Token Rotation**: Consider implementing token rotation mechanisms
3. **Rate Limiting**: Add rate limiting for additional protection
4. **Logging**: Monitor authentication attempts and failures
5. **HTTPS**: Always use HTTPS in production environments

## Testing

The middleware has been tested to ensure:
- ✅ Requests without tokens are rejected (401)
- ✅ Requests with invalid tokens are rejected (401) 
- ✅ Validation schemas work correctly (400 for invalid data)
- ✅ Authentication flow is applied to all GitHub routes
- ✅ Server restarts properly with middleware applied