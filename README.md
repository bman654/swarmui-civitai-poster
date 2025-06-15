# SwarmUI CivitAI Post Assistant Chrome Extension

This Chrome extension automates the process of posting images from SwarmUI to CivitAI while ensuring
that the image metadata is loaded correctly into CivitAI (maybe you've noticed CivitAI fails to find
the image metadata when you manually post something).

## Usage

1. Open SwarmUI
2. Select an image
3. Click the extension button
4. A new tab will open to CivitAI and the image and metadata will be loaded.  wait for the page to finish refreshing
5. If you want to add more images for the same model, go back to SwarmUI and select another image and click the extension button
6. When finished, don't forget to publish the post!

Here is a video demo of it in action: https://www.youtube.com/watch?v=ajzStKS9VWc

## Features

- Silently waits in your Chrome toolbar.
- Extension button lights up when you have an image selected in SwarmUI
- Clicking the extension button will automatically launch a new tab to CivitAI and paste the image and its metadata into it.
- If you leave the tab open and unpublished, you can select more images in Swarm and click the extension button to add them to the same CivitAI post
- Adds all image metadata: prompts, parameters, LoRAs, Embeddings, etc

## Installation in Chrome for Testing

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this directory
4. The extension should now be active

## Project Structure

- `manifest.json` - Chrome extension manifest file
- `swarm-get-image-info.js` - Script that runs inside SwarmUI web page when you click the extension button to capture the image and its metadata
- `civitai-post-image.js` - Script that runs inside CivitAI when you are creating a new post.  It is responsible for loading the image and metadata into the post.
- `background.js` - Background service worker that manages the extension

## License

MIT
