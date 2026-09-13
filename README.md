# Resume Mongo Collection Schema Maker

Frontend app to manage MongoDB collection schemas through the `resume-backend` API.

## Setup

1. Copy `.env.example` to `.env` and update `VITE_API_BASE_URL` if needed.
2. Install dependencies.
3. Start the dev server.

```bash
npm install
npm run dev
```

## Features

- List all collections in `resume_db`
- Describe a selected collection schema
- Create a new collection with JSON schema fields and bson types
- Display backend command result, return code, and resulting schema
