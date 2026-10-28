# Cool Bron Games

A complete static basketball arcade rewrite: FlappyBron, PacBron, and LeBron Fighter. Original SVG artwork, responsive homepage, keyboard and touch controls, pause on focus loss, three difficulties, local records, earned rings, jersey unlocks, CPU campaign and shared-keyboard versus.

## Run

Use Node 22+ for tests: `npm test` and `npm run check`. No package installation is required. Run `npm start` with Python 3 installed, then visit http://localhost:4173.

## Deploy

GitHub Settings → Pages → Source: GitHub Actions. Push to main. The included workflow checks JavaScript, runs tests and publishes dist. All asset paths work under a repository subpath. The expected Pages URL is https://unsead2.github.io/cool-bron-games-rebuilt/.

## Scope

This is a fresh implementation; original source and backend were not available. Saves are local to this browser and use a new versioned key. Old progress is not migrated. Records are personal, not a global leaderboard. Local versus needs two people on one keyboard. No accounts or server are required. The existing coolbrongames.com deployment is unchanged.

## Files

`dist/app.js`: game shell and input. `dist/storage.js`: saves and unlocks. `dist/games/`: independent fixed-step game engines. `dist/assets/`: original SVG artwork.

Independent fan project, not affiliated with LeBron James or the NBA.

## Validation

14 automated tests pass for collisions, safe gaps, maze reachability, combat, lifecycle, storage recovery, scores and purchases. Browser smoke checks covered all three launches, keyboard input, pause/resume, game-over/restart, score persistence and on-screen controls. Responsive layout checked at 390×844 and desktop. Real-device multi-touch, Safari and long-session performance have not been benchmarked. Legacy game and information-page URLs redirect to the new game shell.
