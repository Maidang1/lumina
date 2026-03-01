# Lumina Usage Guide

This guide covers the main usage scenarios for the Lumina photography portfolio system.

## Table of Contents

- [Installation](#installation)
- [Desktop App](#desktop-app)
- [CLI Tool](#cli-tool)
- [Web Gallery](#web-gallery)
- [Local Development](#local-development)

## Installation

### Desktop App

Download the latest release from [GitHub Releases](https://github.com/user/lumina/releases) for your platform:

| Platform | Architecture | File |
|----------|--------------|------|
| macOS | Apple Silicon (M1+) | `Lumina.Desktop_x.x.x_aarch64.dmg` |
| macOS | Intel | `Lumina.Desktop_x.x.x_x64.dmg` |
| Windows | x64 | `Lumina.Desktop_x.x.x_x64-setup.exe` |
| Linux | x64 | `Lumina.Desktop_x.x.x_amd64.AppImage` or `.deb` |

**macOS Installation:**

1. Download the `.dmg` file
2. Open the DMG and drag `Lumina Desktop` to Applications
3. First launch may require allowing the app in System Preferences > Security & Privacy

**Windows Installation:**

1. Download the `.exe` installer
2. Run the installer and follow the prompts
3. Launch from Start Menu

**Linux Installation:**

AppImage:
```bash
chmod +x Lumina.Desktop_*.AppImage
./Lumina.Desktop_*.AppImage
```

Debian/Ubuntu:
```bash
sudo dpkg -i Lumina.Desktop_*.deb
```

### CLI Tool

```bash
npm install -g @luminafe/cli
# or
pnpm add -g @luminafe/cli
```

## Desktop App

The Lumina Desktop app provides a graphical interface for managing your photo portfolio.

### Features

- Browse and manage photos in your local repository
- Upload new photos with automatic processing (EXIF extraction, thumbnail generation)
- Preview changes before committing
- Git integration for syncing with remote repository

### Getting Started

1. Launch Lumina Desktop
2. Open Settings and configure your local repository path
3. Add photos via drag-and-drop or the upload dialog
4. Review changes in the Changes panel
5. Commit and push to sync with your remote repository

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + U` | Upload photos |
| `Cmd/Ctrl + Enter` | Commit changes |
| `Cmd/Ctrl + ,` | Open settings |

## CLI Tool

The `lumina-upload` CLI provides batch operations for photo management.

### Commands

#### Upload Photos

```bash
lumina-upload upload <input...> --repo-path <path>
```

Upload one or more image files or directories to your local repository.

**Options:**
- `--repo-path <path>`: Path to local git repository (or set `LUMINA_REPO_PATH` env var)

**Examples:**

```bash
# Upload a single photo
lumina-upload upload ./photo.jpg --repo-path ~/photos-repo

# Upload multiple files
lumina-upload upload ./photo1.jpg ./photo2.jpg --repo-path ~/photos-repo

# Upload a directory
lumina-upload upload ./vacation-photos --repo-path ~/photos-repo

# Using environment variable
export LUMINA_REPO_PATH=~/photos-repo
lumina-upload upload ./photos
```

#### Sync Changes

```bash
lumina-upload sync --repo-path <path> --message <message>
```

Commit pending changes and push to remote repository.

**Options:**
- `--repo-path <path>`: Path to local git repository
- `--message <message>`: Commit message

**Example:**

```bash
lumina-upload sync --repo-path ~/photos-repo --message "Add vacation photos"
```

#### Resume Uploads

```bash
lumina-upload resume --repo-path <path>
```

Resume any pending uploads that were interrupted.

#### Validate Files

```bash
lumina-upload validate <input...>
```

Check if image files are valid and supported.

**Example:**

```bash
lumina-upload validate ./photos/*.jpg
```

#### Migrate Layout

```bash
lumina-upload migrate-layout --repo-path <path> [--apply]
```

Migrate repository from legacy layout to current format.

**Options:**
- `--repo-path <path>`: Path to local git repository
- `--apply`: Actually apply changes (omit for dry-run)

**Example:**

```bash
# Dry-run to preview changes
lumina-upload migrate-layout --repo-path ~/photos-repo

# Apply migration
lumina-upload migrate-layout --repo-path ~/photos-repo --apply
```

## Web Gallery

The web gallery is automatically deployed when you push to your configured branch.

### Viewing Your Gallery

Access your gallery at your configured Cloudflare Pages URL.

### Features

- Masonry grid layout
- EXIF metadata display
- Interactive map view
- Photo details with location data
- Responsive design for all devices

## Local Development

### Prerequisites

- Node.js (LTS version recommended)
- pnpm
- Rust toolchain (for native modules)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/user/lumina.git
   cd lumina
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure environment:
   ```bash
   cp apps/web/.dev.vars.example apps/web/.dev.vars
   ```

4. Edit `apps/web/.dev.vars` with your values:
   - `GITHUB_TOKEN`: GitHub personal access token
   - `ALLOW_ORIGIN`: Allowed CORS origin (e.g., `http://localhost:3000`)

### Development Commands

```bash
# Start web dev server only
pnpm run dev:web

# Start full local mode (web + API)
pnpm run dev:full

# Build all packages
pnpm run build

# Run type checking
pnpm run typecheck

# Run dead code analysis
pnpm knip
```

### Desktop Development

```bash
# Navigate to desktop app
cd apps/desktop

# Start Tauri development
pnpm run dev
```

## Environment Variables

### Web Frontend (`apps/web/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `RSBUILD_API_URL` | No | API base URL (defaults to same origin) |
| `RSBUILD_GH_OWNER` | No | GitHub owner for jsDelivr URLs |
| `RSBUILD_GH_REPO` | No | GitHub repo for jsDelivr URLs |
| `RSBUILD_GH_BRANCH` | No | GitHub branch for jsDelivr URLs |

### Cloudflare Functions (`apps/web/.dev.vars`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub personal access token |
| `ALLOW_ORIGIN` | Yes | CORS allowed origin |

### Wrangler Config (`apps/web/wrangler.toml`)

| Variable | Description |
|----------|-------------|
| `GH_OWNER` | GitHub repository owner |
| `GH_REPO` | GitHub repository name |
| `GH_BRANCH` | GitHub branch name |

### CLI

| Variable | Description |
|----------|-------------|
| `LUMINA_REPO_PATH` | Default local repository path |

## Troubleshooting

### Desktop App Won't Open (macOS)

If macOS blocks the app:
1. Open System Preferences > Security & Privacy
2. Click "Open Anyway" for Lumina Desktop

### CLI Upload Fails

Check that:
1. The repository path is correct
2. You have write permissions to the repository
3. Git is properly configured with credentials

### Web Gallery Shows No Images

Verify:
1. `GITHUB_TOKEN` has read access to the repository
2. Images were properly uploaded and pushed
3. The `objects/_index/images.json` index file exists

### API Returns CORS Errors

Ensure `ALLOW_ORIGIN` in `.dev.vars` matches your frontend URL.
