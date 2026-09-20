# Time / Volume

A local interactive space-time cuboid made from IMG_3122.MOV.

Run `python3 serve.py`, then open http://localhost:8793. Or double-click Start.command.

- Play: the front face plays the video while depth grows continuously.
- Each second becomes one slab. The final slab covers the remaining fraction of a second.
- Drag to orbit, scroll to zoom, right-drag to pan. View buttons cover all six sides.
- Layer spacing separates slabs to expose frozen images at second boundaries.
- Seek backward or forward to reconstruct the volume at that time.
- Depth per second changes the aspect ratio; Auto-rotate turns the camera during playback.

This represents image x, image y, and time—not reconstructed physical scene geometry. Side textures use edge pixels sampled at 12 fps; frozen layer images are 270 × 480, and the moving face is 540 × 960. The phone's HLG footage is converted to SDR using a generated LUT, so color is an approximation. All media and dependencies are local; no upload or network service is involved.

Preparation: `python3 prepare.py` (requires ffmpeg and Pillow). The original MOV is untouched. The lightweight Python server supports byte-range requests for reliable seeking. Three.js 0.180.0 is vendored under its MIT license. API reference: https://threejs.org/docs/.

Verified in Chrome: playback, solid and separated layers, timeline seeking, and view controls.
