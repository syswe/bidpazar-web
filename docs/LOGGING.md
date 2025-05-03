
Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool

Ran tool




Read file: src/app/api/route.ts

Read file: src/app/api/live-streams/route.ts

Read file: src/app/api/devices/route.ts

Read file: src/app/api/categories/route.ts

Read file: src/app/api/products/route.ts

Read file: src/app/api/users/route.ts

Read file: src/app/api/live-streams/[id]/route.ts
To add "extreme" (detailed) logging to your API endpoints, you should log the following for every request:
- HTTP method and URL
- Request headers
- Request body (if present)
- Query parameters (if present)
- Auth info (if present)
- Response status and body (if possible, at least status)
- Errors (with stack trace)

### How to do this efficiently:
1. **Create a logging utility** (e.g., `src/lib/logger.ts`) to standardize logs.
2. **Add logging at the start of each API handler** (GET, POST, etc.) in your `route.ts` files.
3. **Log errors in catch blocks** (you already do this in many places).

---

### Example Logging Utility (`src/lib/logger.ts`)
```ts
export async function logApiRequest({
  method,
  url,
  headers,
  body,
  query,
  user,
  extra,
}: {
  method: string;
  url: string;
  headers: any;
  body?: any;
  query?: any;
  user?: any;
  extra?: any;
}) {
  console.log('[API REQUEST]', {
    method,
    url,
    headers,
    body,
    query,
    user,
    ...extra,
  });
}
```

---

### Example Usage in an API Route

```ts
import { logApiRequest } from '@/lib/logger';

export async function POST(request: Request) {
  const url = request.url;
  const method = 'POST';
  const headers = Object.fromEntries(request.headers.entries());
  let body;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  await logApiRequest({ method, url, headers, body });

  // ...rest of your handler
}
```

- For GET requests, you can log `request.url` and parse query params from it.
- For routes using `NextRequest`, you can use `req.nextUrl` for more info.

---

### Next Steps

Would you like me to:
- Generate the logging utility file for you?
- Inject this logging into a few representative API route files as a template for you to follow?
- Or do you want this added to all your main `route.ts` files automatically?

Let me know your preference!
