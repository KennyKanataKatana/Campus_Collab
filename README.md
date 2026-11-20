# Campus Collab

Campus Collab is a web application for Singapore Polytechnic students to find and organise campus hangouts. It uses Node.js, Express, PostgreSQL, and a browser frontend served by Express.

- Create and browse hangout posts, bookmark them, comment, and accept or check in to a hangout.
- Manage friends and blocked users, send hangout invitations, and view notifications.
- Join forum discussions, manage your profile, and review your post history.
- Report content or users and submit appeals.

## Getting started

You'll need Node.js 22 or later, npm, and two PostgreSQL databases for development and testing. Run the commands from the repository root.

```bash
npm ci
```

Create `.env.dev` in the repository root and replace the placeholders with your development database connection string and local secrets.

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/campus_collab_dev
PORT=3000
JWT_SECRET_KEY=replace-with-a-local-secret
JWT_EXPIRES_IN=1h
JWT_ALGORITHM=HS256
BCRYPT_PEPPER=replace-with-a-local-pepper
```

Create `.env.test` with the same keys, a separate test database in `DATABASE_URL`, test-only secrets, and `PORT=3001`. If your database provider requires TLS, use the connection string supplied by the provider. Set `BCRYPT_PEPPER` before seeding and use the same value when starting the app so seeded users can log in.

```bash
npm run migration:reset
npm run seed
npm start
```

`migration:reset` drops and recreates the application tables from `schema.sql`. Run it only against a database whose application data you can discard. Seeding is optional and adds sample users, campus locations, hangouts, and other fixtures.

Open http://localhost:3000 with the default development configuration. If you seeded the database, you can sign in as `sarahlim.23@ichat.sp.edu.sg` with the password `password123`.

## Project structure

| Path | Contents |
| --- | --- |
| `src/app.js`, `src/server.js` | Express app configuration and server startup |
| `src/public/` | Browser pages, scripts, styles, and assets |
| `src/routers/`, `src/controllers/` | API routes and request handlers |
| `src/models/`, `src/middlewares/` | PostgreSQL queries and request middleware |
| `schema.sql`, `scripts/` | Database schema, migrations, seeding, and report generation |
| `__tests__/`, `e2e-tests/`, `configs/` | Jest and Playwright tests and tooling configuration |
| [Docs/](Docs/) | Feature specifications |

## API routes

These are the mounted route prefixes. See [MainRoute.js](src/routers/MainRoute.js) and the linked routers there for individual methods and paths.

| Feature | Route prefixes |
| --- | --- |
| Accounts and profiles | `/auth`, `/users`, `/profile` |
| Hangout posts and locations | `/posts`, `/locations`, `/post-history` |
| Hangout participation | `/accept`, `/checkin`, `/hangout-invitations`, `/notifications` |
| Community | `/friends`, `/block`, `/forum`, `/bookmark`, `/comments` |
| Moderation | `/reports`, `/appeals` |

`GET /health` returns `{"status":"ok"}` when the Express process is reachable.

## Testing

Install Chromium for Playwright before running browser tests.

```bash
npx playwright install chromium
npm test
```

| Command | What it runs |
| --- | --- |
| `npm run test:unit` | Jest unit tests in `__tests__/unit/` |
| `npm run test:integration` | Jest and Supertest API tests in `__tests__/integration/` |
| `npm run test:e2e` | Playwright browser tests in `e2e-tests/` |
| `npm run test:trace` | Playwright tests with tracing and an HTML report |
| `npm test` | Unit, integration, and browser tests in sequence |

Integration setup resets the database configured in `.env.test`. Playwright setup resets and seeds it, then the browser tests run with one worker because they share that database.

## Maintenance and reports

| Command | Purpose |
| --- | --- |
| `npm run start:test` | Start the app with `.env.test` |
| `npm run migration:reset:test` | Recreate the test schema |
| `npm run seed:test` | Load sample data into the test database |
| `npm run migration:invitations` | Apply invitation scheduling, expiry, and notification changes to an existing database using `.env.dev` |
| `npm run lint` / `npm run lint:fix` | Check code with ESLint or apply automatic fixes |
| `npm run format:check` / `npm run format` | Check formatting or apply Prettier |
| `npm run lint:report` | Generate `reports/eslint-report.html` |
| `npm run report` | Run QA checks and generate `reports/qa-report.html`, alongside lint, coverage, and browser test reports |

Jest applies an 80% global threshold for statements, branches, functions, and lines when coverage is collected. The coverage HTML report is written to `coverage-report/index.html`, and the Playwright HTML report is written to `playwright-report/index.html`.

## Deployment

[render.yaml](render.yaml) defines a Render web service that installs dependencies with `npm ci`, starts with `node src/server.js`, and checks `/health`. Configure `DATABASE_URL` and `BCRYPT_PEPPER` in Render and initialise the PostgreSQL schema separately before first use. The blueprint generates `JWT_SECRET_KEY` and sets the JWT algorithm and token lifetime. The current checkout contains no GitHub Actions workflows.
