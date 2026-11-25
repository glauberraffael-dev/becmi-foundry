# Publishing to GitHub

This folder is ready to be pushed as a repository. It contains no absolute
paths to the original machine and no OCR export or PDF.

## Option A — Git CLI

```bash
cd becmi-foundry
git init -b main
git add .
git commit -m "Initial BECMI Foundry v13 system"
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```

This folder already contains an initial commit on `main`. Add your remote and push,
or use GitHub Desktop's **Publish repository** button.

## Option B — GitHub web interface

1. Create a new repository on GitHub.
2. Drag the contents of this folder into the upload area.
3. Commit with the message `Initial BECMI Foundry v13 system`.

Do not upload `node_modules/`; it is excluded by `.gitignore`.

## Install URL for Foundry

After pushing, install the system in Foundry with this manifest URL:

```text
https://raw.githubusercontent.com/<USER>/<REPO>/main/system.json
```

Replace `<USER>` and `<REPO>` with your GitHub username and repository name.

## Before publishing

- Confirm `system.json` version and author details are what you want.
- Read [CREDITS.md](CREDITS.md). The PDF and verbatim rules text are not included.
- Optionally run `npm install && npm run verify` from a clean checkout.
