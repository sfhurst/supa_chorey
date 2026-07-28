# Changelog

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
