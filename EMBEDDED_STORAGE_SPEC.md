# see-maths Embedded Storage Spec

## Role

`see-maths` is the storage authority for embedded maths apps.

## Responsibilities

- Listen for `interactive-maths:storage:get|set|remove` messages.
- Accept only keys prefixed with `interactive-maths:`.
- Reply only to the requesting iframe via `event.source.postMessage(...)`.
- Keep storage in the parent page's `localStorage`.
- Continue handling overlay visibility messages independently.

## Shared Keys

- `interactive-maths:youtubeBubbleDismissed`
- `interactive-maths:reportName`
- `interactive-maths:reportEmail`
- `interactive-maths:locale`

## Verification

- Embedded child requests return values from the parent page's storage.
- Writes from one embedded maths app are visible in another embedded maths app.
- Standalone shell preferences remain unaffected.
