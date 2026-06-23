# Figma Sticker Plugin

A Figma plugin for creating sticker-style outside borders from PNG alpha silhouettes.

## What it does

1. Exports the selected layer as PNG.
2. Uses the alpha channel to find the visible object.
3. Traces the silhouette into SVG contours.
4. Imports the SVG back into Figma.
5. Applies a filled backing and outside stroke.
6. Groups the sticker backing with the original PNG/layer.

## Install from GitHub

The plugin can be installed locally from this repository while Figma Community review is pending. No build step is required.

1. Download this repository as a ZIP from GitHub, or clone it with Git.
2. Unzip the folder if needed.
3. In Figma, go to **Plugins → Development → Import plugin from manifest…**
4. Select `manifest.json` from this repository.
5. Run **Figma Sticker Plugin** from **Plugins → Development**.

Local development plugins do not auto-update. Download the latest version again, or run `git pull`, to get updates.

## Usage

1. Select exactly one PNG/image layer or transparent object in Figma.
2. Run **Figma Sticker Plugin**.
3. Choose stroke and tracing settings.
4. Click **Create alpha border**.

The default settings fill the sticker backing and scale the traced silhouette to `0.98` around the detected object bounds. This creates a tiny overlap under the PNG to avoid visible edge gaps. Set **Silhouette scale** to `1.0` if you want an exact trace.

## License

MIT
