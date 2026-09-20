# videodepth

Turn a video into a growing, interactive 3D cuboid. Width and height come from the image; depth comes from time. Every second adds a layer you can orbit, inspect, and separate from the rest.

**[Open videodepth](https://apps.cleartextlabs.com/videodepth/)** · [Source](https://github.com/digitalhen/videodepth)

## Try it

1. Open the app and click **Choose video**, or **Try demo** for a synthetic six-second clip.
2. Wait for the browser to build the layers. Progress appears beside the picker; you can cancel preparation.
3. Press **Play**. The front face plays the video while the cuboid grows continuously.
4. Drag to rotate, scroll or pinch to zoom, and right-drag to pan. Use the view buttons to inspect each side.

Videos are processed on your device. The hosted app does not upload selected files, use an account, or call a video-processing service.

## Controls

| Control                      | What it does                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Play / Pause or Space        | Start or pause playback. Space works when a form control is not focused.            |
| Restart                      | Rebuild from the beginning.                                                         |
| Timeline                     | Scrub forward or backward; the volume follows the selected time.                    |
| Layer spacing                | Separate the one-second slabs to reveal earlier images. Keep **Solid** for no gaps. |
| Depth per second             | Adjust how much the cuboid grows each second.                                       |
| Auto-rotate                  | Orbit automatically, including during playback.                                     |
| Perspective / six face views | Move to a preset camera position.                                                   |
| Sound / Speed / Loop         | Control audio, playback speed, and repetition. Loop is off by default.              |

## Run locally

Requires Python 3.9 or newer. No npm install, API key, or build step is needed.

```sh
git clone https://github.com/digitalhen/videodepth.git
cd videodepth
python3 serve.py
```

Open **http://localhost:8793**. On Windows, use `py serve.py` if `python3` is unavailable. On macOS, you can also double-click `Start.command` after cloning.

### Video formats

Browser codec support varies. **MP4 with H.264 video** is the most portable choice. WebM and many MOV files also work when the browser can decode their codecs. A `.mov` extension alone does not guarantee support. DRM-protected, corrupt, or unsupported media cannot be rendered directly.

The local Python server offers optional FFmpeg conversion for files the browser cannot decode. Install FFmpeg and put it on your PATH; for example, on macOS with Homebrew:

```sh
brew install ffmpeg
```

Only the localhost app can use this fallback. It sends the selected file to your own loopback server, converts it to MP4 in a temporary directory, and deletes temporary files when the request finishes. It does not send media to an external service. Conversion accepts files up to 4 GiB and has a 30-minute timeout. Cancelling stops browser preparation; an already-running local conversion may continue until it completes or times out.

The hosted static app never attempts server conversion. It explains how to choose a compatible file instead.

## How it works

The browser opens the selected file using an object URL, seeks through an offscreen video element, and samples frames into Canvas 2D. It saves snapshots at one-second boundaries and assembles four edge textures from the top, bottom, left, and right pixels of sampled frames. Three.js renders these textures on the growing cuboid, with a live video texture on the front face.

This is an **image × time volume**, not a reconstruction of the physical scene. Moving around the cuboid reveals the history of the image rather than new real-world camera angles.

- One slab per second; the last slab can be fractional.
- Edge sampling targets 12 samples per second, capped at 4,096 samples per clip.
- Snapshot resolution adapts to duration with a target budget of 32 million pixels.
- Long clips take more time to prepare and create more geometry. Start with short clips of a few seconds to a few minutes.
- The browser handles rotation metadata and color conversion. HDR appearance can vary by browser and display.
- Original files are never modified. Closing or reloading the page clears the selection.

## Deploy a static copy

Serve these files over HTTP or HTTPS:

```text
index.html
style.css
app.js
picker.js
vendor/
public/
```

Do not open `index.html` directly using `file://`; JavaScript modules require an HTTP server. No backend is needed for browser-supported videos.

The Dockerfile serves only these public files with Nginx on port 8080, under `/videodepth/`. Health checks use `/healthz`. Route `/videodepth` to the container with path stripping disabled. The included demo is generated test imagery, with no personal footage. GitHub Actions checks JavaScript and Python syntax on pushes and pull requests.

## Project files

- `app.js`: scene, cuboid geometry, playback, and controls.
- `picker.js`: local file loading, browser sampling, cancellation, and optional local conversion.
- `serve.py`: local server, byte-range support, and optional FFmpeg conversion.
- `public/demo.mp4`: synthetic demo clip.
- `vendor/`: Three.js 0.180.0 and OrbitControls, with their upstream license.

## License

MIT. Three.js is distributed under its own MIT license in `vendor/LICENSE`.
