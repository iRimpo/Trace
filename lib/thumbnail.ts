/**
 * Capture the first frame (0:00) of a video file as a small JPEG blob for use as a thumbnail.
 * Keeps size small for scalability: max width 320px, JPEG quality 0.78.
 * Use when uploading a video to Supabase: capture thumbnail, upload to storage, set videos.thumbnail_url.
 */
const THUMB_MAX_WIDTH = 320;
const JPEG_QUALITY = 0.78;

export function captureVideoThumbnail(videoFile: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(videoFile);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    video.onloadeddata = () => {
      video.currentTime = 0;
    };
    video.onseeked = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) {
          URL.revokeObjectURL(url);
          reject(new Error("Could not read video dimensions"));
          return;
        }
        const scale = Math.min(1, THUMB_MAX_WIDTH / w);
        const cw = Math.round(w * scale);
        const ch = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(video, 0, 0, cw, ch);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) resolve(blob);
            else reject(new Error("Could not encode thumbnail"));
          },
          "image/jpeg",
          JPEG_QUALITY
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video for thumbnail"));
    };
    video.src = url;
  });
}
