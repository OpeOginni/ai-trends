# Job Queue System

This project uses a job queue system to process AI prompts efficiently on Vercel's serverless infrastructure.

## Architecture

### Overview
- **Cron Endpoint** (`/api/cron`): Scheduled to run daily, creates jobs for due prompts
- **Job Processor** (`/api/jobs/process`): Processes individual jobs as separate lambda invocations
- **Job Status** (`/api/jobs/status`): Query job statuses and statistics

### How It Works

1. **Scheduling (Cron)**
   - Vercel Cron triggers `/api/cron` daily at midnight UTC
   - Finds prompts that are due (active + not run in last 24 hours)
   - Creates individual jobs for each model × run combination
   - Jobs are idempotent via unique key: `(promptId, modelId, runIndex, batchKey)`
   - Updates `lastRunAt` to prevent duplicate scheduling

2. **Execution (Job Processor)**
   - Each job is processed by a separate lambda invocation
   - Atomically claims job by updating status: `queued → processing`
   - Runs the AI model with the prompt
   - Saves results to database
   - Updates job status: `processing → succeeded/failed`
   - Records error messages on failure

3. **Monitoring (Job Status)**
   - Query jobs by: jobId, batchKey, promptId, or status
   - Get summary statistics (queued, processing, succeeded, failed)
   - Inspect error messages for failed jobs

## Database Schema

### `prompt_jobs` Table
- `id`: Job identifier
- `promptId`: Reference to prompt
- `modelId`: Reference to model
- `runIndex`: 0-based run number (for multiple runs)
- `batchKey`: Date key (YYYY-MM-DD) for daily batches
- `status`: queued | processing | succeeded | failed | skipped
- `errorMessage`: Error details if failed
- `attemptCount`: Number of processing attempts
- `scheduledFor`, `startedAt`, `finishedAt`: Timestamps

### Idempotency
- Unique constraint on `(promptId, modelId, runIndex, batchKey)`
- Prevents duplicate jobs for the same prompt/model/run on the same day
- Atomic status updates prevent double-processing

## API Endpoints

### `/api/cron` (GET)
**Triggers job creation for due prompts**

Headers:
```
Authorization: <CRON_SECRET>
```

Response:
```json
{
  "success": true,
  "message": "Enqueued 20 jobs for 2 prompts",
  "promptCount": 2,
  "jobsCreated": 20,
  "batchKey": "2025-10-14"
}
```

### `/api/jobs/process` (POST)
**Processes a single job**

Headers:
```
Authorization: <CRON_SECRET>
Content-Type: application/json
```

Body:
```json
{
  "jobId": 123
}
```

Response:
```json
{
  "success": true,
  "jobId": 123,
  "status": "succeeded",
  "entityId": 456
}
```

### `/api/jobs/status` (GET)
**Query job statuses**

Headers:
```
Authorization: <CRON_SECRET>
```

Query Parameters:
- `jobId`: Filter by job ID
- `batchKey`: Filter by batch (e.g., "2025-10-14")
- `promptId`: Filter by prompt
- `status`: Filter by status (queued, processing, succeeded, failed)

Response:
```json
{
  "success": true,
  "summary": {
    "total": 20,
    "queued": 0,
    "processing": 2,
    "succeeded": 15,
    "failed": 3,
    "skipped": 0
  },
  "jobs": [...]
}
```

## Vercel Configuration

The `vercel.json` file configures the cron schedule:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 0 * * *"
    }
  ]
}
```

This runs daily at midnight UTC. Adjust the cron expression as needed:
- `0 0 * * *` - Daily at midnight
- `0 */6 * * *` - Every 6 hours
- `0 12 * * *` - Daily at noon

## Environment Variables

Required:
- `CRON_SECRET`: Secret for authenticating cron and job endpoints
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key
- `OPENROUTER_API_KEY`: OpenRouter API key
- `NEXT_PUBLIC_APP_URL`: Your app URL (for triggering jobs)

## Testing Locally

1. **Start your database:**
   ```bash
   docker-compose up -d
   ```

2. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

3. **Start the dev server:**
   ```bash
   npm run dev
   ```

4. **Trigger cron manually:**
   ```bash
   curl -X GET http://localhost:3000/api/cron \
     -H "Authorization: your-cron-secret"
   ```

5. **Check job status:**
   ```bash
   curl -X GET "http://localhost:3000/api/jobs/status?batchKey=2025-10-14" \
     -H "Authorization: your-cron-secret"
   ```

## Error Handling

- **Per-Job Errors**: Recorded in `errorMessage` field, status set to `failed`
- **Model Failures**: Gracefully handled, job marked as failed with error details
- **Network Issues**: Retry logic can be added by checking `attemptCount`
- **Idempotency**: Duplicate triggers safely ignored via unique constraints

## Monitoring

View job statistics in Drizzle Studio:
```bash
npm run db:studio
```

Query failed jobs:
```sql
SELECT * FROM prompt_jobs WHERE status = 'failed' ORDER BY created_at DESC;
```

## Advantages Over Previous System

1. **Vercel-Optimized**: Each job runs in its own lambda (no 10s timeout issues)
2. **Idempotent**: No duplicate processing via unique constraints
3. **Observable**: Per-job status and error tracking
4. **Resilient**: Failed jobs don't block others
5. **Scalable**: Parallel lambda invocations for all jobs
6. **Debuggable**: Error messages stored for investigation

