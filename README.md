# RouteMapD1 — Road Overlays & Manual Route Drawing (Draft 1)

Summary:
- Destination is chosen by tapping the map (preferred) or pressing "Find My Location".
- System retrieves all labeled roads in a 100m radius of the destination.
- Roads are rendered as real grey lines, highlighted on hover.
- User can tap any road segment as the Start Anchor and manually draw a polyline to the doorstep (no auto-routing).
- Polyline is smoothed on save.
- Saved addresses are persisted locally; example Firestore hooks included for shared storage.

Notes & tradeoffs:
- Google Roads API does NOT provide an endpoint to list "all roads inside a polygon". The "Nearest Roads" and "Snap to Roads" endpoints operate on sampled points.
  - If you must use Google-only, sample the area at a fine grid and batch call Nearest Roads (<=100 points/request). This is quota-heavy and approximative.
  - Recommended: use OpenStreetMap/Overpass to fetch all road ways within radius — complete, free, and straightforward.
- For multi-user shared saved-address listing (show saved addresses to ANY user within 100m), you need a server or hosted DB (e.g., Firestore). The repo includes a sketch for Firestore — production requires geospatial indexing (geohashes) or a geospatial DB.

Security & API keys:
- Keep Google API key private and restrict to your domain & Maps APIs.
- If using Firestore, secure rules must be added.

Next steps / improvements:
- Add place/address reverse-geocoding for nicer labels (use Google Geocoding).
- Implement geospatial index for fast server-side proximity queries.
- Improve drawing UX: add undo, snap-to-road segments (option), drag handles, mobile gestures.
- Add tests and error handling for network failures and rate-limits.

