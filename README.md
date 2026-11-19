# Sweety – Blood Glucose Tracker

## Current milestone

Database, backend authentication, authenticated reading CRUD and report endpoints are implemented. The React interface and bonus features are not implemented yet.

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

Use `npm start` to run without watch mode. Startup checks that the users and readings tables are accessible. Rerun `npm run db:init` after updating from the authentication milestone to create the readings table. The initialization script creates missing tables; it does not migrate an existing table to a different definition.

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

Errors use `{ "success": false, "message": "..." }`: 400 for invalid input, 401 for invalid credentials or sessions, 404 for unknown endpoints or unavailable readings, 409 for duplicate email or reading slots, 413 for oversized JSON and 500 for unexpected failures. Internal database errors are not exposed to clients.

## Readings API

All reading endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Input | Success |
| --- | --- | --- | --- |
| GET | `/api/readings` | Optional `date=YYYY-MM-DD` query | 200 and `readings` array |
| POST | `/api/readings` | JSON `date`, `slot`, `glucose` | 201 and `reading` |
| PUT | `/api/readings/:id` | Complete JSON `date`, `slot`, `glucose` | 200 and updated `reading` |
| DELETE | `/api/readings/:id` | No request body | 200 and confirmation message |

Example reading body:

```json
{ "date": "2026-11-18", "slot": "Morning (fasting)", "glucose": 110.5 }
```

The exact slots are `Morning (fasting)`, `After breakfast`, `After lunch` and `After dinner`. PostgreSQL enforces these slots, glucose bounds, the user foreign key and `UNIQUE (user_id, reading_date, slot)`. Each user can have at most four readings per day. Duplicate creates and conflicting edits return a friendly 409 error.

Dates must be real calendar dates in exact `YYYY-MM-DD` format, from year 0001 through today in `Asia/Kolkata`. Future dates are rejected by the API. Dates are stored as PostgreSQL `DATE` and returned as date-only strings. Glucose must be a JSON number from 40 to 600 mg/dL; decimals are accepted and stored as `NUMERIC`. The client cannot submit an owner ID.

Lists contain only the current user's readings, ordered by date descending and then the four slots in the order above. An empty result returns `readings: []`. Update and delete queries enforce ownership and return 404 for missing or other users' readings. Unsupported query parameters and extra body fields are rejected. Pagination is deferred until the required application works.

## Reports API

All reports require `Authorization: Bearer <token>` and use only the authenticated user's readings.

| Method | Endpoint | Period |
| --- | --- | --- |
| GET | `/api/reports/daily` | Optional `date=YYYY-MM-DD`; defaults to today |
| GET | `/api/reports/month-to-date` | First day of the current month through today |
| GET | `/api/reports/previous-month` | First through last day of the previous month |

Today is determined in `Asia/Kolkata`. Period boundaries are inclusive and returned as `startDate` and `endDate`. Monthly endpoints do not accept date or month overrides. Daily dates use the same validation as readings.

Each response contains `success: true` and a `report` object with `min`, `max`, `average` and `count`. Statistics are calculated in PostgreSQL, with the average rounded to one decimal place and returned as a JSON number. Daily reports also include a `readings` array containing `id`, `date`, `slot` and `glucose`, ordered by the four predefined slots. Daily statistics and readings are calculated in one query.

With no readings, reports return HTTP 200, `count: 0`, null statistics and `message: "No readings for this period"`. Empty daily reports also contain `readings: []`.

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

Tests require `TEST_DATABASE_URL` and do not fall back to the application database. Each integration test file uses a randomly named schema and verifies that the database connection selects it. The shared `server/tests/setup.js` starts the real Express API, generates a test JWT secret and clears the isolated tables before each test. Test files create their own users and readings. The schema is removed when the file finishes. If a test process is forcibly terminated, its test schema may require manual cleanup.

The suite contains 25 integration tests and three date tests. It covers authentication, password hashing, concurrent email and reading uniqueness, repeatable initialization/seeding, reading CRUD, ownership, invalid inputs, database constraints and reports. Report tests create the data they need and reset their controlled clock after each test. They check decimal rounding, empty periods, other users' data, inclusive month boundaries, leap February and India's midnight/month/year transitions.

Tests can also run individually. From `server`, with `TEST_DATABASE_URL` still set:

```powershell
node --test tests/readings.test.js
node --test --test-name-pattern="one user cannot list" tests/readings.test.js
```

## Implementation order and open details

1. Database and backend authentication: implemented.
2. Readings schema and authenticated CRUD: implemented with the assignment's exact four slot labels.
3. Daily, month-to-date and previous-month report endpoints, with ownership checks and date-boundary tests: implemented.
4. React/Vite registration, login, dashboard, reading form, date selection and reports; responsive layout and validation feedback: next.
5. After required behavior works: server pagination, Recharts monthly trends, Docker Compose and React Testing Library form tests, in that order.

The intended frontend folders are `client/context` and `client/src/{components,pages,assets}`. Backend folders are `server/{config,controllers,middleware,routes,database,scripts,tests}`. No ORM, service layer or UI component framework is planned.

The application date timezone is `Asia/Kolkata` and glucose values may contain decimals. Reports use the same timezone for month boundaries. No deployment, chart, Docker or frontend test coverage is claimed in this milestone.

Possible later improvements include authentication rate limiting and a token revocation or refresh flow. Redis caching, background jobs and doctor permissions are outside the current milestones.
