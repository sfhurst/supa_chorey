# Changelog

## 0.8.0 — Combined ownership, privacy, sharing, and scheduler milestone

### Features
- Added creator-owned task definitions.
- Added permanent Visible and Private tasks.
- Added private lock UI and removed assignment controls from private tasks.
- Added temporary and permanent assignment.
- Added shared multi-person assignments with one shared completion state.
- Added Indefinite tasks.
- Allowed every signed-in household member to create tasks.

### Improvements
- Background refresh keeps the existing interface visible while loading.
- Completion remains Supabase-first.
- Task library is available to every profile while respecting private visibility.
- Category colors use the complete normalized category and avoid active collisions.
- Task-name and category forms use reliable submit handling on iPhone.
- Swipe Edit interaction retains the first-tap fix.

### Bug fixes
- Fixed multi-word category color collisions such as Living Room and Living Area.
- Fixed task creator Continue failures from the iPhone keyboard.
- Fixed long-press actions falling through into normal tap actions.

### Database
- Migrates `defaultAssigneeId` to `defaultAssignedIds[]`.
- Migrates occurrence `assignedToId` to `assignedIds[]`.
- Migrates legacy visibility objects to `visible` or `private`.
- Migrates Shower and Groom defaults to private tasks owned by Steve.
- Added optional nightly cleanup for expired Once tasks and completed prior-day Indefinite tasks.
