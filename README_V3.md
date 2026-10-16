# Novel Atelier V3

A full-stack light novel reader built with FastAPI, SQLite and vanilla JavaScript.

## Run locally

1. Create a Python virtual environment.
2. Install: `pip install -r backend/requirements-dev.txt`
3. Run: `uvicorn backend.main:app --reload`
4. Visit http://127.0.0.1:8000/ for V3, /admin.html for the studio, /docs for API docs.

The original index.html and reader.html remain available.

## Admin onboarding

Register normally, then use a trusted server shell:
`python -m backend.admin promote admin@example.com`

## Features

- Responsive discovery, catalog search, genre filters, reader themes and font size.
- FastAPI REST backend and SQLite seeded once from the original JSON and Markdown.
- HttpOnly signed session cookies, CSRF protection, user library and reading progress.
- Admin dashboard: book create/edit and chapter create/edit/delete.
- Automated Python API tests and JS syntax checks.

## Production checklist

- APP_ENV=production, a SECRET_KEY of >=32 random characters and persistent DATABASE_PATH.
- HTTPS with reliable backups; use managed PostgreSQL for multi-instance operation.
- Included Render persistent disk is paid: free ephemeral hosts can lose SQLite data.
- Public authentication requires further safeguards including login rate limits,
  password reset/email verification and moderation before exposing to unknown users.
- Markdown HTML is disabled. Cover images depend on external hosts.
- Check distribution rights before publishing copyrighted stories.
