export class VideoRecorder {
  private mr: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType = "video/webm";

  startRecording(stream: MediaStream): void {
    this.chunks = [];
    const preferred = "video/webm;codecs=vp9";
    this.mimeType = MediaRecorder.isTypeSupported(preferred)
      ? preferred
      : "video/webm";

    this.mr = new MediaRecorder(stream, {
      mimeType: this.mimeType,
      videoBitsPerSecond: 2_500_000,
    });

    this.mr.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mr.start(1000); // collect a chunk every 1 s
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mr || this.mr.state === "inactive") {
        reject(new Error("Not recording"));
        return;
      }
      const type = this.mimeType;
      const chunks = this.chunks;
      this.mr.onstop = () => resolve(new Blob(chunks, { type }));
      this.mr.stop();
    });
  }

  /** Abort without returning a blob (e.g. on component unmount). */
  abort(): void {
    if (this.mr && this.mr.state !== "inactive") {
      this.mr.onstop = null;
      this.mr.stop();
    }
    this.chunks = [];
  }

  get isActive(): boolean {
    return this.mr?.state === "recording";
  }
}
