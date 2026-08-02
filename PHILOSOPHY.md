# Chorey Philosophy

Chorey exists to help, never hurt.

It provides focus and clarity without guilt, streaks, penalties, or accumulated debt. Only the current scheduling window matters. A missed task does not become a judgment about yesterday; when the cycle ends, Chorey lets it go.

Tasks should remain calm and understandable. Private tasks are truly private within the application. Shared tasks represent shared responsibility: one completion resolves the task for everyone assigned, and everyone shares the credit without assigning blame.

## Stability over activity

Chorey should feel like a piece of paper on the refrigerator. If nothing has changed, the user should not perceive that anything happened.

Opening the app, resuming it from the background, reconnecting to Supabase, polling for shared changes, or completing a background synchronization must never cause the interface to visibly refresh unless the user would actually see different information. A screen that redraws identical content wastes attention, disrupts focus, and makes the application feel less trustworthy.

A visible update is justified only when the displayed state meaningfully changes, including a new day, a different view, a task or assignment change, a completion change, a scheduling change, or a setting that affects what is shown.

**Same day + same user + same view + same normalized task state = do nothing.**

This is a core product principle, not a performance optimization.
