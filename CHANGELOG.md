# Changelog

## v0.8.5

### Added
- Added persistent per-user view modes under `settings.viewModeByUserId` in local storage schema version 9.
- Added one role-aware bottom button that cycles through the views appropriate to each profile.

### Changed
- Users start with only their due tasks, can add unassigned due tasks, then reveal their completed tasks without hiding unassigned work.
- Admins start with only their due tasks, can expand to all household due tasks, then reveal household completed tasks.
- Owners start with all household due tasks with completed rows hidden, can reveal completed rows, then open the full task library for editing.
- Contribution counts remain based on the full section assignment count even when completed rows are hidden.
- User congratulations now evaluate only that user’s assigned due tasks; Admin and Owner congratulations continue to evaluate household due tasks.

## v0.8.5

### Fixed
- Restored task sorting within each section to completion status first, then category A–Z, then task name A–Z.
- Prevented focus, visibility, and polling refreshes from replacing an unchanged task board, eliminating the page vanish/reappear effect.
- Prevented unchanged background refreshes from visually reshuffling task rows.
- Excluded private tasks from the daily congratulations calculation; indefinite tasks remain excluded because they are never due.

## v0.8.3

### Fixed
- Reset Local Data now clears current occurrence state, unchecking tasks and removing temporary assignments before reloading.
- Built-in tasks receive their coded default assignment once during migration: normally Unassigned, with Shower and Groom remaining private and assigned to Steve.
- User-created tasks still begin assigned to their creator.
- Added uniform spacing between the task-name field and Continue button.

## v0.8.2

### Fixed
- Unassigned tasks completed by a user temporarily appear on that user's list, then return to Unassigned when the completion is unchecked.
- Owner/Admin can tap Unassigned for a temporary unassignment or hold it for a permanent unassignment.
- Task-name entry now matches the size, spacing, and visual weight of Chorey task buttons.
- Long-press assignment now fills the selected person's button using that person's color.

## v0.8.1

### Fixed
- Restored the original button-based Developer menu.
- Private tasks are permanently assigned to their creator and cannot be unassigned.
- Shower and Sunday Groom migrate as Steve's private assigned tasks.
- Newly created tasks default to their creator.
- Restored a cleaner swipe interaction and first-tap Edit action.
- Moved Shared Task below Cancel and made its selected state explicit.
- Moved Private Task below Cancel on the How Often screen.
- Disabled text selection throughout the app while preserving text inputs.

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
