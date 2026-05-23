# Solid Desktop

A thin Electron shell over [jspod](https://jspod.org) — your own Solid pod running locally, in a desktop window with a URI bar for visiting other people's pods.

On first start, jspod's bootstrap installs the `default` app bundle (home, app store, plaza, vellum, plume, charlie, file explorer, …) into your local pod and seeds the welcome / signin / account pages. Sign in with `me / me` (localhost only).

## Quick Start

```bash
npx solid-desktop
```

## Install Globally

```bash
npm install -g solid-desktop
solid-desktop
```

## Development

```bash
git clone https://github.com/JavaScriptSolidServer/solid-desktop.git
cd solid-desktop
npm install
npm start
```

## Configure

Edit `config.json`:

```json
{
  "port": 3011,
  "width": 1200,
  "height": 800,
  "root": "./data"
}
```

`root` is passed to jspod as `--root`. The first start populates it; subsequent starts are no-ops on the seed data.

## License

AGPL-3.0
