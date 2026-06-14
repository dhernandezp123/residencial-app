# Edge Functions

## create-admin-user

Function responsible for creating operational administrators for a residential.

This must run server-side as a Supabase Edge Function because creating an Auth
user for another person requires privileged Supabase Admin APIs. The frontend
must not call `supabase.auth.signUp()` for this flow.

### Input

```json
{
  "first_name": "Ana",
  "last_name": "Lopez",
  "phone": "9999-9999",
  "email": "admin@example.com",
  "password": "temporary-password",
  "residential_id": "00000000-0000-0000-0000-000000000000"
}
```

### Process

1. Validate the caller is allowed to create admins for the target residential.
2. Create the Supabase Auth user with `admin.createUser()`.
3. Create the related `public.profiles` row:
   - `user_id` from the created Auth user.
   - `first_name` from input.
   - `last_name` from input.
   - `phone` from input.
   - `role = 'admin'`.
   - `status = 'approved'`.
   - `residential_id` from input.
   - `house_id = null`.

### Response

```json
{
  "success": true
}
```

### Security Notes

- Keep the Service Role key only inside the Edge Function environment.
- Do not expose privileged keys to the frontend.
- Do not add permissive RLS policies for this flow.
- Keep residential scoping explicit through `residential_id`.
