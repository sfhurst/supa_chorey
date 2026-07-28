# Chorey 0.8.0

Chorey is a Supabase-backed household task manager built around one idea: **help, never hurt**.

## This release

- Creator ownership for every task
- Owner, Admin, and User editing permissions
- Permanent Visible or Private task visibility
- Private lock UI with no assignment controls
- Temporary and permanent single-person assignment
- Shared multi-person assignment with one completion record
- `defaultAssignedIds[]` task schema
- Indefinite tasks that remain until completed
- Automatic migration from legacy assignment and visibility fields
- Private migration for Steve's Shower and Groom tasks
- Background refresh without clearing the current screen first
- Supabase-first completion writes
- Optional nightly cleanup SQL
- iPhone task-form and swipe-action fixes
- Full-category color assignment

## Assignment controls

Owner and Admin:

- Tap a person for a temporary assignment.
- Long-press a person for a permanent assignment.
- Tap **Shared**, select multiple people, then tap **Confirm** for temporary assignment.
- Long-press **Confirm** for permanent shared assignment.

Users may self-assign an unassigned task and may undo only their own temporary self-assignment.

## Task ownership

The creator owns the task definition. The Owner may edit or delete any task. Admins and Users may edit or delete tasks they created. Assignment management is available to Owner and Admin.

## Private tasks

Private tasks are visible only to their creator, never show an assignment icon, and cannot become visible later. Visible tasks likewise cannot become private later. Delete and recreate a task to change visibility.

## Supabase setup

Run `SUPABASE_SETUP.sql` in the Supabase SQL Editor. The final commented `cron.schedule` statement can be enabled after confirming `pg_cron` is available.

## Files

- `scheduler.js` — recurrence and visibility windows
- `task-model.js` — schema normalization, migration, and permissions
- `repositories.js` — Supabase boundary
- `app.js` — application behavior
- `ui.js` — rendering
- `task-creator.js` — task creation and editing
- `PHILOSOPHY.md` — product principles
