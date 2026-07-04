# Password Protection Setup

## Protected Pages

The following management pages are now password-protected:

- `/reports` - Monthly financial reports
- `/sales-assessment` - Sales analysis and breakdown
- `/products` - Product inventory and management

## Configuration

### Setting the Admin Password

1. Create or edit `.env.local` in the project root:

```bash
NEXT_PUBLIC_ADMIN_PASSWORD=your-secure-password
```

2. The default password is `gembira2026` (can be changed)

### Password Features

- **Session Duration**: 24 hours (sessions expire after 1 day)
- **Logout Button**: Appears in top-right corner of protected pages
- **Persistent Sessions**: Uses browser localStorage

## How to Use

1. Access any protected page (e.g., `/reports`)
2. You'll be redirected to `/login`
3. Enter the admin password
4. Click "Access Portal"
5. You'll be authenticated for 24 hours
6. Click "Logout" to immediately end your session

## Security Notes

⚠️ **Important**:

- The password is stored as an environment variable
- Change the default password immediately in production
- The authentication is client-side only (localStorage)
- For production, consider implementing server-side authentication
- HTTPS is required for production deployments

## Changing the Password

Simply update the `NEXT_PUBLIC_ADMIN_PASSWORD` in `.env.local` and restart the application.
