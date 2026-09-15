# Support ticket operations

Apply migration `008_support_workflow.sql` before deploying the updated API.

Administrators can call `PATCH /api/admin/tickets/:id` with:

```json
{"status":"in_progress","assignedTo":"<administrator UUID>"}
```

Statuses are `open`, `in_progress`, and `resolved`. Resolving requires a nonempty `resolution` (maximum 5000 characters). Reopening clears the resolution and resolved timestamp. Omit `assignedTo` to preserve assignment; send null to unassign. Only active administrators can be assigned. Ticket updates and their audit records commit together. This endpoint does not send an email.

Run `npm run test:integration:support` from the backend directory with `TEST_DATABASE_URL` pointing to an isolated database with all migrations applied. The verifier checks assignment validation, resolution, reopening, and audit records, then removes its fixtures. It refuses to use the application database implicitly.

Current validation: TypeScript build and existing unit suite pass. The database integration verifier still needs to run against an isolated PostgreSQL instance.
