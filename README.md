# Sweety – Blood Glucose Tracker

## Current milestone

Database and backend authentication are implemented. Reading endpoints, reports, the React interface and bonus features are not implemented yet.

The code follows the supplied car rental project: JavaScript ES modules, `client` / `server` organization, small controllers, route files, async/await and `{ success, message }` responses. Frontend work will follow its local state, `appContext`, direct Axios calls, Tailwind classes, Inter font, blue primary color and simple bordered forms.

## Requirements

- Node.js 22 or newer and npm
- PostgreSQL 18, used for local verification

## Setup

Create a PostgreSQL database named `sweety` using your PostgreSQL account. For example, with PostgreSQL command-line tools available:

```powershell
createdb -U postgres sweety
```

From the project root:

```powershell
Copy-Item .env.example server/.env
cd server
npm ci
```

Edit `server/.env` with your PostgreSQL connection string. URL-encode special characters in the username or password. Set `JWT_SECRET` to a random secret of at least 32 characters. You can generate one with:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

`PORT` defaults to `3000`. `CLIENT_URL` defaults to `http://localhost:5173` and must be an origin without a trailing slash. Keep `.env` private.

From `server`:

```powershell
npm run db:init
npm run db:seed
npm run dev
```

Use `npm start` to run without watch mode. Startup checks that the users table is accessible. The initialization script creates the users table if absent; it does not migrate an existing table to a different definition.

## Demo account

- Email: `demo@sweety.local`
- Password: `SweetyDemo123!`

The optional seed can be rerun. It restores this account's name and password without duplicating it or deleting other users. Use the demo account only in a development database.

## Authentication API

| Method | Endpoint | Input | Success |
| --- | --- | --- | --- |
| POST | `/api/user/register` | JSON `name`, `email`, `password` | 201, `user` and `token` |
| POST | `/api/user/login` | JSON `email`, `password` | 200, `user` and `token` |
| GET | `/api/user/data` | `Authorization: Bearer <token>` | 200 and `user` |

Registration trims names and normalizes email to lowercase. Names contain 1–80 characters; email addresses contain at most 254 characters. Registration passwords contain at least 8 characters and at most 72 UTF-8 bytes to respect bcrypt's input limit. Password whitespace is preserved. Password hashes are never returned.

JWTs use HS256 and expire after seven days. Protected requests verify the signature, expiry and user existence. Requests cannot choose a user ID. Authentication endpoints reject query parameters and unexpected JSON fields. JSON bodies are limited to 10 KB.

Errors use `{ "success": false, "message": "..." }`: 400 for invalid input, 401 for invalid credentials or sessions, 404 for unknown endpoints, 409 for duplicate email, 413 for oversized JSON and 500 for unexpected failures. Internal database errors are not exposed to clients.

## Tests

Create a separate test database. Its database user must be allowed to create schemas:

```powershell
createdb -U postgres sweety_test
```

From `server`, set your test connection string and run:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres:your_password@localhost:5432/sweety_test'
npm test
```

Tests require `TEST_DATABASE_URL` and do not fall back to the application database. They create a randomly named schema, run the actual Express API and SQL against PostgreSQL, then remove that schema. They generate their own JWT secret. If a test process is forcibly terminated, its test schema may require manual cleanup.

The eight integration tests cover registration, password hashing, email normalization and uniqueness under concurrent registration, login, input validation, token rejection, deleted users, malformed JSON, body size, query validation, SQL parameters and repeatable initialization/seeding.

## Implementation order and open details

1. Database and backend authentication: implemented.
2. Readings schema and authenticated CRUD: next. Confirm the assignment's four exact time-slot labels before defining their constraint.
3. Daily, month-to-date and previous-month report endpoints, with ownership checks and date-boundary tests.
4. React/Vite registration, login, dashboard, reading form, date selection and reports; responsive layout and validation feedback.
5. After required behavior works: server pagination, Recharts monthly trends, Docker Compose and React Testing Library form tests, in that order.

The intended frontend folders are `client/context` and `client/src/{components,pages,assets}`. Backend folders are `server/{config,controllers,middleware,routes,database,scripts,tests}`. No ORM, service layer or UI component framework is planned.

The reporting timezone and whether glucose values permit decimals still need a documented decision before implementing readings and reports. No deployment, chart, Docker or frontend test coverage is claimed in this milestone.

Possible later improvements include authentication rate limiting and a token revocation or refresh flow. Redis caching, background jobs and doctor permissions are outside the current milestones.
