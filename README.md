# rar/zip-extractor

Recursively extracts `.rar`, `.7z`, and `.zip` archives from a source directory into a destination directory. Handles multi-part archives, password-protected archives, and permission-restricted directories.

## Requirements

- [Node.js](https://nodejs.org) (v21+)
- [7-Zip](https://www.7-zip.org) installed and available on your PATH

## Usage

**From source**

```bash
npm start
```

Or pass paths directly to skip the prompts:

```bash
npm start -- "C:\path\to\source" "D:\path\to\destination"
```

**As a Windows executable**

Build the exe:

```bash
npm run build
```

This produces `output/extract.exe`. Run it from anywhere:

```bash
extract.exe "C:\path\to\source" "D:\path\to\destination"
```

The destination directory will be created automatically if it doesn't exist.
