# Publishing to GitHub

This folder is ready to be pushed as a repository. It contains no absolute
paths to the original machine and no OCR export or PDF.

## Option A — Git CLI

```bash
cd becmi-foundry
git init -b main
git add .
git commit -m "Initial BECMI Foundry v13 system"
git remote add origin https://github.com/glauberraffael-dev/becmi-foundry.git
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
https://raw.githubusercontent.com/glauberraffael-dev/becmi-foundry/main/system.json
```

The manifest declares:

- `url`: the GitHub repository page
- `manifest`: the stable raw URL above
- `download`: `https://raw.githubusercontent.com/glauberraffael-dev/becmi-foundry/main/becmi-foundry.zip`

`becmi-foundry.zip` must contain `system.json` at the archive root (no enclosing folder).
Regenerate it whenever the system files change. On Windows PowerShell:

```powershell
$src = (Get-Location).Path
$zip = Join-Path $src "becmi-foundry.zip"
Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fs = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create, $false)
$files = Get-ChildItem -LiteralPath $src -Recurse -File -Force | Where-Object {
  $rel = $_.FullName.Substring($src.Length + 1)
  $parts = $rel -split '[\\/]'
  -not ($parts -contains 'node_modules' -or $parts -contains '.git' -or $parts -contains 'becmi-foundry.zip')
}
foreach ($f in $files) {
  $rel = $f.FullName.Substring($src.Length + 1).Replace('\', '/')
  $entry = $archive.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
  $entryStream = $entry.Open()
  $fileStream = [System.IO.File]::OpenRead($f.FullName)
  $fileStream.CopyTo($entryStream)
  $fileStream.Dispose()
  $entryStream.Dispose()
}
$archive.Dispose()
$fs.Dispose()
```

## Before publishing

- Confirm `system.json` version and author details are what you want.
- Read [CREDITS.md](CREDITS.md). The PDF and verbatim rules text are not included.
- Optionally run `npm install && npm run verify` from a clean checkout.
