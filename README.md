# LinkedBack

LinkedBack is a Chrome extension for finding LinkedIn posts you’ve previously seen. Click the LinkedBack toolbar icon to open the history dashboard in a browser tab.

## Development

Use Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

WXT starts Chrome with the development extension loaded. To load a production build manually, run `npm run build`, open `chrome://extensions`, enable developer mode, and load `.output/chrome-mv3` as an unpacked extension.

- `npm run typecheck` checks TypeScript.
- `npm run zip` packages the Chrome extension.
- `npx shadcn@latest add <component>` adds shadcn/ui source files under `components/ui`.
