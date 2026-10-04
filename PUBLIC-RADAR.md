# Public Apple ranking observations

The Game Radar on GitHub Pages reads only the already-published `apple-game-charts.json` file. It shows the actual row count for each Apple Games RSS chart, country, chart type, App ID, ranking position, the official App Store link, and the **time this system fetched the feed**. Apple’s official update time is unknown. The scheduled publisher retains the last successful chart after a partial failure; the UI labels observations older than its own 12-hour freshness threshold as stale.

This is not download, revenue, growth, or investment evidence. Those fields remain null, and a single ranking observation does not form a trend. The visible opportunity area gives an evidence-bound observation and an insufficient-evidence state, not a score or strong recommendation. The rollback switch is `PUBLIC_APPLE_RADAR_ENABLED` in `app.js`; setting it to `false` empties the public radar without touching the source snapshot.

`apple-games-rss` is registered separately from the App Store Search API. Apple’s RSS website-embedding guidance does not itself resolve permission for indefinite JSON mirror redistribution; retention and redistribution are recorded as unreviewed in the public registry. No collector credentials, session data, or private source records are read by this static page.
