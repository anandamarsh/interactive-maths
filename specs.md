# See Maths Platform Specs

## YouTube Channel Popup

The shell displays a promotional popup bubble prompting users to view and subscribe to the See Maths YouTube channel.

### Behaviour

- The popup appears on page load in the bottom-left corner, above the YouTube icon button.
- Users can manually dismiss it by clicking **"Don't show again"** — this persists in `localStorage`.
- **Auto-fade:** If not manually dismissed, the popup automatically fades out after **3 minutes** (180 seconds) with a 1-second opacity transition, then removes itself from the DOM.
- Once dismissed (manually or via auto-fade), it does not reappear for that browser.
- The YouTube icon button remains visible at all times regardless of popup state.

### Spec for Template Game & All Games

All games on the See Maths platform (including the [maths-game-template](https://github.com/anandamarsh/maths-game-template)) should follow these rules for any promotional or informational popup:

1. **Auto-dismiss after 3 minutes** — any non-critical popup or banner must fade out automatically after 3 minutes of being visible, using a smooth opacity transition (~1 second).
2. **Manual dismiss** — always provide a visible dismiss/close control.
3. **Persist dismissal** — once dismissed (manually or by timeout), store the preference in `localStorage` so it does not reappear on subsequent visits.
4. **Non-blocking** — popups must not block game interaction. They should be positioned as overlays that do not obscure primary gameplay.
