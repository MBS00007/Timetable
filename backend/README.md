# Northwest University Timetable API

## Steps 1-5

This backend uses PostgreSQL, Express, and `pg`. It currently implements the public read API only. Authentication, admin CRUD, and PDF upload are intentionally deferred.

### Setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open **Connect**, choose **Connection string**, select **Node.js** or **URI**, and copy the PostgreSQL connection string. Prefer the **Session pooler** connection for this backend.
3. Copy `.env.example` to `.env` and replace the `DATABASE_URL` placeholder with that connection string. Do not commit `.env`.
4. Install dependencies:

```powershell
cd backend
npm install
```

5. Verify the hosted PostgreSQL connection:

```powershell
npm run db:check
```

6. Seed schema and existing project data:

```powershell
npm run seed
```

7. Start the API:

```powershell
npm run dev
```

The API runs at `http://localhost:4000`.

The Supabase database must be reachable before running `db:check` or `seed`. The seed script creates the schema and inserts the existing project timetable and announcements.

## Read endpoints

- `GET /api/health`
- `GET /api/courses`
- `GET /api/courses/:id`
- `GET /api/timetable`
- `GET /api/timetable/:id`
- `GET /api/timetable?day=Monday`
- `GET /api/announcements`
- `GET /api/announcements/:id`

The timetable response is joined with course data and keeps the frontend-compatible `start`, `end`, `venue`, `lecturer`, and course fields. Announcements include both `content` and the existing frontend-compatible `copy` property.
