# Figma Sticker Plugin

A Figma plugin for creating sticker-style outside borders from PNG alpha silhouettes.

## What it does

1. Exports the selected layer as PNG.
2. Uses the alpha channel to find the visible object.
3. Traces the silhouette into SVG contours.
4. Imports the SVG back into Figma.
5. Applies an outside stroke.
6. Groups the stroke with the original PNG/layer.

## Usage

1. Select exactly one PNG/image layer or transparent object in Figma.
2. Run **Figma Sticker Plugin**.
3. Choose stroke and tracing settings.
4. Click **Create alpha border**.

## Development install

No build step is required.

1. In Figma, go to **Plugins → Development → Import plugin from manifest…**
2. Select `manifest.json` from this repository.
3. Run the plugin from **Plugins → Development**.

## License

MIT
