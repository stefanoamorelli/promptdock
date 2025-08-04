# Node.js API Patterns

## Express.js Structure
Follow RESTful conventions and proper middleware organization.

```typescript
import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = express.Router();

router.get('/users', authMiddleware, async (req, res) => {
  try {
    const users = await userService.findAll();
    res.json({ data: users, status: 'success' });
  } catch (error) {
    res.status(500).json({ error: error.message, status: 'error' });
  }
});
```

## Error Handling
- Use consistent error response format
- Implement global error middleware
- Log errors with proper context
- Return appropriate HTTP status codes

## Database Integration
- Use TypeORM or Prisma for database operations
- Implement proper connection pooling
- Use transactions for data consistency
- Always validate input data

## Security
- Implement rate limiting
- Use helmet for security headers
- Validate and sanitize all inputs
- Use JWT for authentication with proper expiration