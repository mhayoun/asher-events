// Photo and video compression in the browser, the same way MyMedia does it:
// photos are re-encoded as JPEG (resized, EXIF kept), videos as H.264/AAC MP4 with mediabunny.
// Videos need a computer (phones' browsers can't encode H.264 reliably); there they are uploaded as they are.

import { downloadRange, type DriveFile } from "./drive";
import { estimateJpegQuality, insertExif, jpegExif, resetOrientation } from "./jpeg";

export const SETTINGS = {
  photoQuality: 0.85,
  /** Longest side of a photo, in pixels. */
  photoMaxDimension: 2560,
  /** Shorter side of a video (720 = "720p"). Plenty for the site's player. */
  videoHeight: 720,
  videoBitrate: 2_500_000,
  audioBitrate: 128_000,
  /** Files smaller than this are left alone. */
  minPhotoBytes: 500 * 1024,
  minVideoBytes: 10 * 1024 * 1024,
  /** Keep the original when the saving is smaller than this. */
  minGain: 0.15,
};

/** Hidden Drive property set on every file this site (or MyMedia) compressed: never compressed twice. */
export const COMPRESSED_PROP = "mymedia_compressed";
/** Set on files where compression saved too little: not tried again. */
export const NO_GAIN_PROP = "events_no_gain";

export type MediaKind = "photo" | "video" | "audio" | "other";

export function kindOf(mimeType: string, name: string): MediaKind {
  if (mimeType.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|bmp)$/i.test(name)) return "photo";
  if (mimeType.startsWith("video/") || /\.(mp4|m4v|mov|avi|mkv|webm|3gp)$/i.test(name)) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "other";
}

/** WhatsApp, screenshots, Facebook…: already compressed by whoever made them. */
const ALREADY_NAMES = /^(FB_IMG|received_|Screenshot|Screen ?Shot|צילום מסך)|-WA\d+|WhatsApp/i;

export type Skip = "done" | "small" | "already" | "format" | "videoNotHere";

export const SKIP_LABEL: Record<Skip, string> = {
  done: "כבר נדחס",
  small: "קובץ קטן",
  already: "כבר דחוס",
  format: "לא נדחס (סוג קובץ)",
  videoNotHere: "וידאו נדחס רק ממחשב",
};

let videoCheck: Promise<boolean> | null = null;

/** True on a computer whose browser can encode H.264 video. */
export function canCompressVideo(): Promise<boolean> {
  videoCheck ??= (async () => {
    const ua = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
    const mobile = ua.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (mobile || typeof VideoEncoder === "undefined") return false;
    try {
      return !!(await VideoEncoder.isConfigSupported({ codec: "avc1.640028", width: 1280, height: 720, bitrate: SETTINGS.videoBitrate })).supported;
    } catch {
      return false;
    }
  })();
  return videoCheck;
}

/** Whether a Drive file is worth compressing; reads the first bytes of JPEGs to know their quality. */
export async function planDriveFile(f: DriveFile): Promise<Skip | null> {
  const kind = kindOf(f.mimeType, f.name);
  const size = Number(f.size ?? 0);
  if (f.appProperties?.[COMPRESSED_PROP]) return "done";
  if (f.appProperties?.[NO_GAIN_PROP]) return "already";
  if (kind === "audio" || kind === "other" || /gif|svg/.test(f.mimeType)) return "format";
  if (ALREADY_NAMES.test(f.name)) return "already";
  if (kind === "photo") {
    if (size < SETTINGS.minPhotoBytes) return "small";
    const { width = 0, height = 0 } = f.imageMediaMetadata ?? {};
    if (Math.max(width, height) > SETTINGS.photoMaxDimension) return null;
    if (f.mimeType === "image/jpeg") {
      const quality = estimateJpegQuality(await downloadRange(f.id, 0, Math.min(size, 65536)).catch(() => new Uint8Array()));
      if (quality != null && quality <= 85) return "already";
    }
    return null;
  }
  if (size < SETTINGS.minVideoBytes) return "small";
  if (!(await canCompressVideo())) return "videoNotHere";
  const meta = f.videoMediaMetadata;
  const duration = Number(meta?.durationMillis ?? 0);
  if (duration && meta?.width && meta.height && Math.min(meta.width, meta.height) <= SETTINGS.videoHeight) {
    const bitrate = (size * 8000) / duration;
    if (bitrate <= (SETTINGS.videoBitrate + SETTINGS.audioBitrate) * 1.15) return "already";
  }
  return null;
}

/** Same rules for a file picked on this device (no Drive metadata: only the name, type and size). */
export async function planLocalFile(file: File): Promise<Skip | null> {
  const kind = kindOf(file.type, file.name);
  if (kind === "audio" || kind === "other" || /gif|svg/.test(file.type)) return "format";
  if (ALREADY_NAMES.test(file.name)) return "already";
  if (kind === "photo") return file.size < SETTINGS.minPhotoBytes ? "small" : null;
  if (file.size < SETTINGS.minVideoBytes) return "small";
  return (await canCompressVideo()) ? null : "videoNotHere";
}

export async function compressPhoto(original: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await original.arrayBuffer());
  const exif = jpegExif(bytes);
  // createImageBitmap applies the EXIF orientation: pixels come out upright.
  const bitmap = await createImageBitmap(original);
  const long = Math.max(bitmap.width, bitmap.height);
  const scale = long > SETTINGS.photoMaxDimension ? SETTINGS.photoMaxDimension / long : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNG areas become white, not black
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: SETTINGS.photoQuality });
  if (!exif) return blob;
  const withExif = insertExif(new Uint8Array(await blob.arrayBuffer()), resetOrientation(exif));
  return new Blob([withExif as BlobPart], { type: "image/jpeg" });
}

type Mediabunny = typeof import("mediabunny");

/**
 * Some phones (files named "video-2021-…") write H.264 profile 0 in the video's header ("avc1.00a00b"),
 * which Chrome refuses to decode although the stream itself is plain Baseline. This decoder takes the
 * real profile from the stream's SPS and decodes with that.
 */
function registerFixedProfileDecoder({ CustomVideoDecoder, VideoSample, registerDecoder }: Mediabunny) {
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  function fixConfig(config: VideoDecoderConfig): VideoDecoderConfig {
    const d = config.description;
    const avcc = d ? (ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : new Uint8Array(d)).slice() : null;
    // avcC: version, profile, compatibility, level, length size, SPS count, SPS length (2 bytes), then the SPS NAL
    // whose bytes 1-3 are again profile, compatibility, level.
    if (!avcc || avcc.length < 12 || avcc[9] === 0) return { ...config, codec: "avc1.42E01F" };
    avcc.set([avcc[9], avcc[10], avcc[11]], 1);
    return { ...config, codec: `avc1.${hex(avcc[9])}${hex(avcc[10])}${hex(avcc[11])}`, description: avcc };
  }
  class FixedProfileAvcDecoder extends CustomVideoDecoder {
    private decoder: VideoDecoder | null = null;
    static override supports(codec: string, config: VideoDecoderConfig) {
      return codec === "avc" && /^avc1\.00/i.test(config.codec) && typeof VideoDecoder !== "undefined";
    }
    init() {
      this.decoder = new VideoDecoder({ output: (frame) => this.onSample(new VideoSample(frame)), error: (e) => this.onError(e) });
      this.decoder.configure(fixConfig(this.config));
    }
    decode(packet: import("mediabunny").EncodedPacket) {
      this.decoder!.decode(packet.toEncodedVideoChunk());
    }
    flush() {
      return this.decoder!.flush();
    }
    close() {
      this.decoder?.close();
    }
  }
  registerDecoder(FixedProfileAvcDecoder);
}

let mediabunny: Promise<Mediabunny> | null = null;
const loadMediabunny = () =>
  (mediabunny ??= import("mediabunny").then((m) => {
    registerFixedProfileDecoder(m);
    return m;
  }));

/** Re-encodes a video to H.264/AAC MP4, from a local file or a Drive file read piece by piece. */
export async function compressVideo(
  from: Blob | { id: string; size: number },
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  const { ALL_FORMATS, BlobSource, BufferSource, BufferTarget, Conversion, CustomSource, Input, Mp4OutputFormat, Output } = await loadMediabunny();
  const input = new Input({
    formats: ALL_FORMATS,
    source:
      from instanceof Blob
        ? new BlobSource(from)
        : new CustomSource({
            getSize: () => from.size,
            read: (start, end) => downloadRange(from.id, start, end, signal),
            prefetchProfile: "network",
          }),
  });
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  try {
    const conversion = await Conversion.init({
      input,
      output,
      video: (track) => {
        const landscape = track.displayWidth >= track.displayHeight;
        const short = Math.min(track.displayWidth, track.displayHeight);
        const h = SETTINGS.videoHeight;
        const resize = short > h ? (landscape ? { height: h } : { width: h }) : {};
        return { codec: "avc", bitrate: SETTINGS.videoBitrate, forceTranscode: true, ...resize };
      },
      // AAC sound (most phone videos) is copied as is; other formats are converted.
      audio: (track) => (track.codec === "aac" ? {} : { codec: "aac", bitrate: SETTINGS.audioBitrate }),
      tags: (tags) => tags,
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error("video format not supported");
    // A track mediabunny can't convert is silently left out: never lose the picture or the sound,
    // keep the original instead (a video without its picture played as a black screen).
    const lost = conversion.discardedTracks.find((d) => d.track.type === "video" || d.track.type === "audio");
    if (lost) throw new Error(`the ${lost.track.type} of this video cannot be kept (${lost.reason})`);
    const sourceDuration = await input.computeDuration();
    const hadVideo = (await input.getVideoTracks()).length > 0;
    conversion.onProgress = onProgress;
    const stop = () => void conversion.cancel();
    signal.addEventListener("abort", stop, { once: true });
    try {
      await conversion.execute();
    } finally {
      signal.removeEventListener("abort", stop);
    }
    signal.throwIfAborted();
    await checkOutput(target.buffer!, hadVideo, sourceDuration, { ALL_FORMATS, BufferSource, Input });
    return new Blob([target.buffer!], { type: "video/mp4" });
  } finally {
    input.dispose();
  }
}

/** Reads the new file back: it must still have its picture and last as long as the original. */
async function checkOutput(
  buffer: ArrayBuffer,
  hadVideo: boolean,
  sourceDuration: number,
  m: Pick<typeof import("mediabunny"), "ALL_FORMATS" | "BufferSource" | "Input">,
) {
  const out = new m.Input({ formats: m.ALL_FORMATS, source: new m.BufferSource(buffer) });
  try {
    if (hadVideo && !(await out.getPrimaryVideoTrack())) throw new Error("the compressed video has no picture");
    const duration = await out.computeDuration();
    if (Math.abs(duration - sourceDuration) > Math.max(1, sourceDuration * 0.02))
      throw new Error(`the compressed video lasts ${duration.toFixed(1)} s instead of ${sourceDuration.toFixed(1)} s`);
  } finally {
    out.dispose();
  }
}

/** Name and type of the compressed file. */
export function outputName(name: string, kind: MediaKind): { name: string; mimeType: string } {
  const base = name.replace(/\.[^.]+$/, "");
  return kind === "video" ? { name: `${base}.mp4`, mimeType: "video/mp4" } : { name: /\.jpe?g$/i.test(name) ? name : `${base}.jpg`, mimeType: "image/jpeg" };
}

export const compressedProps = (originalSize: number): Record<string, string> => ({
  [COMPRESSED_PROP]: "1",
  mymedia_original_size: String(originalSize),
});

/** Worth keeping: at least SETTINGS.minGain smaller. */
export const worthIt = (before: number, after: number) => after <= before * (1 - SETTINGS.minGain);
