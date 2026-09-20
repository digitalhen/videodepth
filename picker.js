import * as THREE from "three";
const $ = (id) => document.getElementById(id);
function event(target, name, signal, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => done(Error("Video decoding timed out. Try another file.")),
      timeout,
    );
    function done(error) {
      clearTimeout(timer);
      target.removeEventListener(name, ok);
      target.removeEventListener("error", bad);
      signal?.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    }
    const ok = () => done(),
      bad = () => done(Error("This video needs conversion.")),
      abort = () => done(new DOMException("Cancelled", "AbortError"));
    target.addEventListener(name, ok, { once: true });
    target.addEventListener("error", bad, { once: true });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}
function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function texture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export async function prepare(file, signal, status) {
  let url = URL.createObjectURL(file),
    decoder = document.createElement("video");
  decoder.muted = true;
  decoder.preload = "auto";
  decoder.playsInline = true;
  let generated = [];
  try {
    try {
      const ready = event(decoder, "loadeddata", signal);
      decoder.src = url;
      await ready;
    } catch (e) {
      if (signal.aborted) throw e;
      if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname))
        throw Error(
          "Your browser cannot decode this format. Try an MP4 (H.264), or run the local app with FFmpeg for conversion.",
        );
      const capability = await fetch("/capabilities", { signal })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!capability?.conversion)
        throw Error(
          "Your browser cannot decode this format. Install FFmpeg and run python3 serve.py, or choose an MP4 (H.264).",
        );
      status("Converting this format locally…");
      URL.revokeObjectURL(url);
      const response = await fetch("/convert", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
        signal,
      });
      if (!response.ok) throw Error(await response.text());
      url = URL.createObjectURL(await response.blob());
      const ready = event(decoder, "loadeddata", signal);
      decoder.src = url;
      await ready;
    }
    const duration = decoder.duration;
    if (!Number.isFinite(duration) || duration <= 0)
      throw Error("This file has no readable video duration.");
    const count = Math.ceil(duration),
      ratio = decoder.videoWidth / decoder.videoHeight;
    // Keep snapshots within a 32-megapixel budget for longer clips.
    const h = Math.max(
        16,
        Math.min(480, Math.floor(Math.sqrt(32000000 / (count * ratio)))),
      ),
      w = Math.max(1, Math.round(h * ratio));
    const n = Math.max(2, Math.min(4096, Math.ceil(duration * 12))),
      sample = canvas(w, h),
      ctx = sample.getContext("2d");
    const edge = [canvas(n, h), canvas(n, h), canvas(w, n), canvas(w, n)],
      ec = edge.map((c) => c.getContext("2d"));
    const frames = new Array(count),
      jobs = new Map();
    const add = (t, kind, index) => {
      const key = t.toFixed(6);
      if (!jobs.has(key)) jobs.set(key, { time: t, edges: [], frames: [] });
      jobs.get(key)[kind].push(index);
    };
    for (let i = 0; i < n; i++)
      add(Math.min(duration - 0.001, (i * duration) / n), "edges", i);
    for (let i = 0; i < count; i++) add(i, "frames", i);
    const ordered = [...jobs.values()].sort((a, b) => a.time - b.time);
    let done = 0;
    for (const job of ordered) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      if (Math.abs(decoder.currentTime - job.time) > 0.000001) {
        const ready = event(decoder, "seeked", signal);
        decoder.currentTime = job.time;
        await ready;
      }
      ctx.drawImage(decoder, 0, 0, w, h);
      for (const i of job.edges) {
        ec[0].drawImage(sample, 0, 0, 1, h, i, 0, 1, h);
        ec[1].drawImage(sample, w - 1, 0, 1, h, i, 0, 1, h);
        ec[2].drawImage(sample, 0, 0, w, 1, 0, i, w, 1);
        ec[3].drawImage(sample, 0, h - 1, w, 1, 0, i, w, 1);
      }
      for (const i of job.frames) {
        const c = canvas(w, h);
        c.getContext("2d").drawImage(sample, 0, 0);
        frames[i] = texture(c);
        generated.push(frames[i]);
      }
      status(
        `Building layers · ${Math.round((++done / ordered.length) * 100)}%`,
      );
    }
    const assets = [...edge.map(texture), ...frames];
    generated = assets;
    return { url, assets, ratio, duration, name: file.name };
  } catch (e) {
    URL.revokeObjectURL(url);
    generated.forEach((t) => t.dispose());
    throw e;
  } finally {
    decoder.removeAttribute("src");
    decoder.load();
  }
}
export function installPicker(onReady) {
  let controller;
  async function loadFile(file) {
    controller?.abort();
    controller = new AbortController();
    const current = controller;
    $("video").pause();
    $("file").disabled = true;
    $("demo").disabled = true;
    $("cancelLoad").hidden = false;
    $("fileStatus").textContent = "Reading video…";
    try {
      const result = await prepare(
        file,
        current.signal,
        (text) => ($("fileStatus").textContent = text),
      );
      if (current.signal.aborted) {
        result.assets.forEach((t) => t.dispose());
        URL.revokeObjectURL(result.url);
        return;
      }
      await onReady(result);
      $("fileStatus").textContent = "Ready · stays on your computer";
    } catch (error) {
      $("fileStatus").textContent =
        error.name === "AbortError" ? "Loading cancelled." : error.message;
    } finally {
      if (controller === current) {
        $("file").disabled = false;
        $("demo").disabled = false;
        $("cancelLoad").hidden = true;
        $("file").value = "";
      }
    }
  }
  $("file").onchange = (e) => {
    const file = e.target.files[0];
    if (file) loadFile(file);
  };
  $("demo").onclick = async () => {
    try {
      const response = await fetch("public/demo.mp4");
      if (!response.ok) throw Error("Demo unavailable.");
      await loadFile(
        new File([await response.blob()], "Color & motion demo.mp4", {
          type: "video/mp4",
        }),
      );
    } catch (e) {
      $("fileStatus").textContent = e.message;
    }
  };
  $("cancelLoad").onclick = () => controller?.abort();
}
