/**
 * DevInquire Automated 9:16 Short Video (Instagram Reels & Facebook Reels) Generator
 * - Converts any Blog article (title, excerpt, content, category, tags, featured_image)
 *   into a branded 720x1280 (9:16) H.264 + AAC MP4 Reel with:
 *   1) Multi-scene motion graphics & cover-photo Ken Burns zoom
 *   2) Synchronized karaoke-style animated on-screen captions
 *   3) Built-in synthesized royalty-free 108 BPM ambient tech synth beat (no external API needed)
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let videoLibsPromise = null;
async function getVideoLibs() {
  if (!videoLibsPromise) {
    videoLibsPromise = (async () => {
      const [ffMod, canvasMod] = await Promise.all([
        import("ffmpeg-static"),
        import("@napi-rs/canvas"),
      ]);
      const bin = ffMod.default || ffMod;
      if (bin && typeof bin === "string" && fs.existsSync(bin)) {
        try {
          fs.chmodSync(bin, 0o755);
        } catch {
          // ignore on read-only fs
        }
      }
      return {
        ffmpegBin: bin || "ffmpeg",
        createCanvas: canvasMod.createCanvas,
        loadImage: canvasMod.loadImage,
        GlobalFonts: canvasMod.GlobalFonts,
      };
    })().catch((err) => {
      videoLibsPromise = null;
      throw err;
    });
  }
  return videoLibsPromise;
}

export const REELS_DIR = path.join(__dirname, "data", "reels");
const FONTS_DIR = path.join(__dirname, "data", "fonts");

const WIDTH = 720;
const HEIGHT = 1280;
const FPS = 24;
const DURATION_SEC = 14;
const TOTAL_FRAMES = FPS * DURATION_SEC; // 336 frames

const activeRenders = new Map();
let fontsInitialized = false;
let resolvedFontFamily = "sans-serif";

function ensureDirs() {
  if (!fs.existsSync(REELS_DIR)) {
    fs.mkdirSync(REELS_DIR, { recursive: true });
  }
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
  }
}

/**
 * Ensure crisp typography on both macOS and minimal Linux (Hostinger) containers
 */
async function ensureFontsReady(GlobalFonts) {
  if (fontsInitialized) return resolvedFontFamily;
  ensureDirs();

  // Register common OS fonts if present, or download Inter TTF once so Linux containers never render missing glyphs
  const systemCandidates = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  ];

  let registeredCustom = false;
  const cachedBold = path.join(FONTS_DIR, "Inter-Bold.ttf");
  const cachedMedium = path.join(FONTS_DIR, "Inter-Medium.ttf");

  try {
    if (!fs.existsSync(cachedBold) || !fs.existsSync(cachedMedium)) {
      const [boldRes, medRes] = await Promise.all([
        fetch(
          "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf",
          { signal: AbortSignal.timeout(2000) }
        ).catch(() => null),
        fetch(
          "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf",
          { signal: AbortSignal.timeout(2000) }
        ).catch(() => null),
      ]);
      if (boldRes && boldRes.ok) {
        fs.writeFileSync(cachedBold, Buffer.from(await boldRes.arrayBuffer()));
      }
      if (medRes && medRes.ok) {
        fs.writeFileSync(cachedMedium, Buffer.from(await medRes.arrayBuffer()));
      }
    }

    if (fs.existsSync(cachedMedium)) {
      GlobalFonts.registerFromPath(cachedMedium, "DIInter");
      registeredCustom = true;
    }
    if (fs.existsSync(cachedBold)) {
      GlobalFonts.registerFromPath(cachedBold, "DIInter");
      registeredCustom = true;
    }
  } catch {
    // Fallback to system fonts
  }

  if (registeredCustom) {
    resolvedFontFamily = "DIInter, Arial, sans-serif";
  } else {
    for (const sysFont of systemCandidates) {
      if (fs.existsSync(sysFont)) {
        try {
          GlobalFonts.registerFromPath(sysFont, "DISystemSans");
          resolvedFontFamily = "DISystemSans, Arial, sans-serif";
        } catch {
          // ignore
        }
      }
    }
  }

  fontsInitialized = true;
  return resolvedFontFamily;
}

/**
 * Strip markdown/HTML into clean readable sentences for Reel captions
 */
function cleanText(raw = "") {
  return String(raw || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/Original Source:.*$/gim, " ")
    .replace(/Topics:\s*(#\S+\s*)+/gim, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract 2 punchy takeaway captions from the blog post
 */
export function extractReelInsights(blog = {}) {
  const title = cleanText(blog.title || "Engineering Deep Dive");
  const excerpt = cleanText(blog.excerpt || "");
  const body = cleanText(blog.content || "");

  const combined = [excerpt, body].filter(Boolean).join(". ");
  const rawSentences = combined
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 28 && !/^https?:\/\//i.test(s));

  const uniqueSentences = [];
  const seen = new Set([title.toLowerCase()]);
  for (const s of rawSentences) {
    const norm = s.toLowerCase().slice(0, 60);
    if (!seen.has(norm)) {
      seen.add(norm);
      uniqueSentences.push(s.length > 145 ? `${s.slice(0, 142).trim()}…` : s);
    }
    if (uniqueSentences.length >= 2) break;
  }

  const category = String(blog.category || "Engineering").trim();
  const insight1 =
    uniqueSentences[0] ||
    (excerpt
      ? excerpt.slice(0, 142)
      : `Breaking down key architecture patterns behind ${title}.`);

  const insight2 =
    uniqueSentences[1] ||
    `Practical ${category.toLowerCase()} takeaways engineered for modern production teams — full analysis on DevInquire.`;

  return {
    title: title.length > 105 ? `${title.slice(0, 102).trim()}…` : title,
    insight1,
    insight2,
    category: category.toUpperCase(),
  };
}

/**
 * Synthesize a warm, royalty-free 108 BPM ambient tech beat into a 44.1kHz 16-bit stereo WAV buffer
 */
function generateAmbientTechBeatWav(durationSec = DURATION_SEC) {
  const sampleRate = 44100;
  const numChannels = 2;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * numChannels * 2;
  const buf = Buffer.alloc(44 + dataSize);

  // WAV RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numChannels * 2, 28);
  buf.writeUInt16LE(numChannels * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  const bpm = 108;
  const beatDur = 60 / bpm; // ~0.555s
  const sixteenthDur = beatDur / 4;

  // 4-bar chord progression: Am9 -> Fmaj7 -> Cmaj9 -> Gadd9
  const chords = [
    [110.0, 220.0, 261.63, 329.63, 392.0, 493.88],
    [87.31, 174.61, 220.0, 261.63, 329.63, 440.0],
    [130.81, 196.0, 261.63, 329.63, 392.0, 587.33],
    [98.0, 196.0, 246.94, 293.66, 392.0, 440.0],
  ];
  const arpNotes = [440.0, 523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 659.25];

  let noiseSeed = 0x12345678;
  const nextNoise = () => {
    noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
    return (noiseSeed / 0xffffffff) * 2 - 1;
  };

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Master fade-in (0.7s) & fade-out (1.3s)
    const fadeIn = Math.min(1, t / 0.7);
    const fadeOut = Math.min(1, (durationSec - t) / 1.3);
    const masterGain = 0.28 * fadeIn * fadeOut;

    const beatPos = (t % beatDur) / beatDur;
    const barIdx = Math.floor(t / (beatDur * 4)) % chords.length;
    const chord = chords[barIdx];

    // 1. Soft punchy tech kick + sub-bass on every beat
    const kickPitch = 52 + 95 * Math.exp(-beatPos * 26);
    const kickEnv = Math.exp(-beatPos * 7.5);
    const kick = Math.sin(2 * Math.PI * kickPitch * (t % beatDur)) * kickEnv * 0.48;

    // Sidechain ducking for pad
    const sidechain = 0.45 + 0.55 * Math.min(1, beatPos * 2.2);

    // 2. Warm stereo detuned synth pad
    const bassFreq = chord[0];
    const subBass = Math.sin(2 * Math.PI * bassFreq * t) * 0.22 * sidechain;

    let padL = 0;
    let padR = 0;
    for (let n = 1; n < chord.length; n++) {
      const f = chord[n];
      padL += Math.sin(2 * Math.PI * (f * 0.9985) * t + n) * 0.065;
      padR += Math.sin(2 * Math.PI * (f * 1.0015) * t + n * 1.3) * 0.065;
    }

    // 3. Crisp tech pluck arpeggio (16th notes, gently stereo-panned)
    const stepIdx = Math.floor(t / sixteenthDur);
    const stepPos = (t % sixteenthDur) / sixteenthDur;
    const arpFreq = arpNotes[stepIdx % arpNotes.length];
    const arpEnv = Math.exp(-stepPos * 8.5);
    const arpWave =
      (Math.sin(2 * Math.PI * arpFreq * t) * 0.7 +
        Math.sin(4 * Math.PI * arpFreq * t) * 0.3) *
      arpEnv *
      0.11;
    const pan = 0.5 + 0.35 * Math.sin(stepIdx * 0.9);

    // 4. Soft off-beat brushed hi-hat
    const halfBeatPos = ((t + beatDur * 0.5) % beatDur) / beatDur;
    const hatEnv = Math.exp(-halfBeatPos * 32);
    const hat = nextNoise() * hatEnv * 0.05;

    const left = Math.max(
      -0.98,
      Math.min(0.98, (kick + subBass + padL * sidechain + arpWave * pan + hat) * masterGain)
    );
    const right = Math.max(
      -0.98,
      Math.min(
        0.98,
        (kick + subBass + padR * sidechain + arpWave * (1 - pan) + hat) * masterGain
      )
    );

    buf.writeInt16LE(Math.round(left * 32767), offset);
    buf.writeInt16LE(Math.round(right * 32767), offset + 2);
    offset += 4;
  }

  return buf;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth, maxLines = 5) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let current = [];

  for (const word of words) {
    const test = [...current, word].join(" ");
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = [word];
      if (lines.length >= maxLines - 1) {
        // Put remaining words on last line up to width
      }
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

/**
 * Draw karaoke-highlighted caption lines synced to progress (0..1)
 */
function drawAnimatedCaptionBlock(ctx, text, x, y, maxWidth, fontSize, lineHeight, progress, fontFamily) {
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  const linesOfWords = wrapLines(ctx, text, maxWidth, 5);
  const totalWords = linesOfWords.reduce((acc, l) => acc + l.length, 0) || 1;
  const activeWordLimit = Math.floor(Math.min(1, progress * 1.25) * totalWords);

  let wordIndex = 0;
  linesOfWords.forEach((words, lineIdx) => {
    const lineY = y + lineIdx * lineHeight;
    let cursorX = x;
    for (const word of words) {
      const isHighlighted = wordIndex <= activeWordLimit;
      const isCurrent = wordIndex === activeWordLimit;
      const wordText = `${word} `;
      const wordW = ctx.measureText(wordText).width;

      if (isCurrent) {
        ctx.save();
        ctx.fillStyle = "rgba(78, 69, 225, 0.92)";
        drawRoundedRect(ctx, cursorX - 6, lineY - fontSize + 4, wordW + 4, fontSize + 10, 10);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = isHighlighted ? "#FFFFFF" : "rgba(255, 255, 255, 0.46)";
      ctx.fillText(word, cursorX, lineY);
      cursorX += wordW;
      wordIndex += 1;
    }
  });

  return y + linesOfWords.length * lineHeight;
}

async function loadBlogCoverImage(imageUrl, loadImage) {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  try {
    if (imageUrl.startsWith("data:image/")) {
      const base64 = imageUrl.split(",")[1];
      if (base64) return await loadImage(Buffer.from(base64, "base64"));
    }
    if (/^https?:\/\//i.test(imageUrl)) {
      const res = await fetch(imageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 DevInquire-ReelRenderer/1.0" },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const arr = await res.arrayBuffer();
        return await loadImage(Buffer.from(arr));
      }
    }
  } catch {
    // Fallback cleanly to branded studio backdrop
  }
  return null;
}

function drawCoverFit(ctx, img, x, y, w, h, zoom = 1.0) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let drawW;
  let drawH;
  if (imgRatio > boxRatio) {
    drawH = h * zoom;
    drawW = drawH * imgRatio;
  } else {
    drawW = w * zoom;
    drawH = drawW / imgRatio;
  }
  const dx = x + (w - drawW) / 2;
  const dy = y + (h - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

function renderReelFrame(ctx, frameIdx, meta, coverImg, fontFamily) {
  const t = frameIdx / FPS;
  const globalProgress = frameIdx / (TOTAL_FRAMES - 1);

  // Scene boundaries:
  // Scene 0: 0.0 - 3.8s (Hook + Cover + Headline)
  // Scene 1: 3.8 - 7.6s (Key Insight #1)
  // Scene 2: 7.6 - 11.2s (Key Insight #2)
  // Scene 3: 11.2 - 14.0s (DevInquire CTA Outro)
  let sceneIdx = 0;
  let sceneProgress = 0;
  if (t < 3.8) {
    sceneIdx = 0;
    sceneProgress = t / 3.8;
  } else if (t < 7.6) {
    sceneIdx = 1;
    sceneProgress = (t - 3.8) / 3.8;
  } else if (t < 11.2) {
    sceneIdx = 2;
    sceneProgress = (t - 7.6) / 3.6;
  } else {
    sceneIdx = 3;
    sceneProgress = (t - 11.2) / 2.8;
  }

  // 1. Deep Studio Background + Cover Image Backdrop
  ctx.fillStyle = "#080914";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (coverImg) {
    ctx.save();
    ctx.globalAlpha = sceneIdx === 0 ? 0.34 : 0.2;
    drawCoverFit(ctx, coverImg, 0, 0, WIDTH, HEIGHT, 1.06 + globalProgress * 0.12);
    ctx.restore();
  }

  // Rich aurora radial gradients
  const orbX = WIDTH * (0.25 + 0.5 * Math.sin(t * 0.55));
  const orbY = HEIGHT * (0.22 + 0.12 * Math.cos(t * 0.45));
  const aurora1 = ctx.createRadialGradient(orbX, orbY, 30, orbX, orbY, 560);
  aurora1.addColorStop(0, "rgba(78, 69, 225, 0.52)");
  aurora1.addColorStop(0.55, "rgba(124, 58, 237, 0.20)");
  aurora1.addColorStop(1, "rgba(8, 9, 20, 0)");
  ctx.fillStyle = aurora1;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const orb2X = WIDTH * (0.78 - 0.35 * Math.sin(t * 0.4));
  const orb2Y = HEIGHT * 0.78;
  const aurora2 = ctx.createRadialGradient(orb2X, orb2Y, 20, orb2X, orb2Y, 500);
  aurora2.addColorStop(0, "rgba(6, 182, 212, 0.28)");
  aurora2.addColorStop(1, "rgba(8, 9, 20, 0)");
  ctx.fillStyle = aurora2;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Dark vignette overlay for crisp text contrast
  const vignette = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  vignette.addColorStop(0, "rgba(7, 8, 18, 0.78)");
  vignette.addColorStop(0.45, "rgba(7, 8, 18, 0.52)");
  vignette.addColorStop(1, "rgba(7, 8, 18, 0.92)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. Top Story Segmented Progress Bars (4 scenes)
  const segGap = 8;
  const padX = 44;
  const segW = (WIDTH - padX * 2 - segGap * 3) / 4;
  for (let s = 0; s < 4; s++) {
    const sx = padX + s * (segW + segGap);
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    drawRoundedRect(ctx, sx, 46, segW, 5, 3);
    ctx.fill();

    const fillRatio = s < sceneIdx ? 1 : s === sceneIdx ? Math.min(1, sceneProgress) : 0;
    if (fillRatio > 0) {
      ctx.fillStyle = "#FFFFFF";
      drawRoundedRect(ctx, sx, 46, Math.max(6, segW * fillRatio), 5, 3);
      ctx.fill();
    }
  }

  // 3. Brand Header Bar (@devinquire + Category + Live Equalizer)
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  drawRoundedRect(ctx, padX, 74, 215, 42, 21);
  ctx.fill();

  ctx.fillStyle = "#4E45E1";
  ctx.beginPath();
  ctx.arc(padX + 22, 95, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 13px ${fontFamily}`;
  ctx.fillText("DI", padX + 15, 100);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 16px ${fontFamily}`;
  ctx.fillText(meta.handle, padX + 44, 101);

  // Animated 5-bar audio equalizer reacting to 108 BPM beat
  const eqBaseX = WIDTH - padX - 48;
  for (let b = 0; b < 5; b++) {
    const wave = 0.35 + 0.65 * Math.abs(Math.sin(t * 7.2 + b * 1.15));
    const bh = Math.round(10 + 20 * wave);
    ctx.fillStyle = b % 2 === 0 ? "#818CF8" : "#38BDF8";
    drawRoundedRect(ctx, eqBaseX + b * 9, 95 - bh / 2, 5, bh, 2.5);
    ctx.fill();
  }

  // Smooth slide entrance animation per scene
  const enterEase = 1 - Math.pow(1 - Math.min(1, sceneProgress * 4.2), 3);
  const slideOffsetY = Math.round((1 - enterEase) * 34);

  ctx.save();
  ctx.globalAlpha = Math.min(1, sceneProgress * 5);
  ctx.translate(0, slideOffsetY);

  if (sceneIdx === 0) {
    // SCENE 0: Cover Photo Card + Category Pill + Bold Headline
    if (coverImg) {
      ctx.save();
      drawRoundedRect(ctx, padX, 148, WIDTH - padX * 2, 390, 28);
      ctx.clip();
      drawCoverFit(ctx, coverImg, padX, 148, WIDTH - padX * 2, 390, 1.02 + sceneProgress * 0.08);
      ctx.restore();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, padX, 148, WIDTH - padX * 2, 390, 28);
      ctx.stroke();
    } else {
      // Sleek decorative tech card when blog has no featured_image
      const cardGrad = ctx.createLinearGradient(padX, 148, WIDTH - padX, 510);
      cardGrad.addColorStop(0, "rgba(78, 69, 225, 0.38)");
      cardGrad.addColorStop(1, "rgba(14, 165, 233, 0.22)");
      ctx.fillStyle = cardGrad;
      drawRoundedRect(ctx, padX, 148, WIDTH - padX * 2, 340, 28);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = `700 22px ${fontFamily}`;
      ctx.fillText("DEVINQUIRE ENGINEERING BRIEF", padX + 34, 315);
      ctx.fillStyle = "rgba(165, 180, 252, 0.95)";
      ctx.font = `600 17px ${fontFamily}`;
      ctx.fillText("60-Second Architecture & Tech Breakdown", padX + 34, 350);
    }

    const headlineTop = coverImg ? 578 : 535;

    // Category pill
    ctx.font = `700 15px ${fontFamily}`;
    const catText = `⚡ ${meta.category}`;
    const catW = ctx.measureText(catText).width + 32;
    ctx.fillStyle = "rgba(78, 69, 225, 0.9)";
    drawRoundedRect(ctx, padX, headlineTop, catW, 38, 19);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(catText, padX + 16, headlineTop + 25);

    // Animated Headline
    drawAnimatedCaptionBlock(
      ctx,
      meta.title,
      padX,
      headlineTop + 96,
      WIDTH - padX * 2,
      42,
      54,
      sceneProgress,
      fontFamily
    );
  } else if (sceneIdx === 1 || sceneIdx === 2) {
    // SCENE 1 & 2: Glass Takeaway Card + Karaoke On-Screen Captions
    const badgeLabel = sceneIdx === 1 ? "01 • KEY TAKEAWAY" : "02 • WHY IT MATTERS";
    const bodyText = sceneIdx === 1 ? meta.insight1 : meta.insight2;

    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    drawRoundedRect(ctx, padX, 240, WIDTH - padX * 2, 690, 34);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, padX, 240, WIDTH - padX * 2, 690, 34);
    ctx.stroke();

    // Badge
    ctx.fillStyle = sceneIdx === 1 ? "rgba(78, 69, 225, 0.9)" : "rgba(14, 165, 233, 0.88)";
    drawRoundedRect(ctx, padX + 34, 282, 235, 40, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 15px ${fontFamily}`;
    ctx.fillText(badgeLabel, padX + 52, 308);

    // Small context title
    ctx.fillStyle = "rgba(199, 210, 254, 0.92)";
    ctx.font = `600 19px ${fontFamily}`;
    const shortTopic = meta.title.length > 52 ? `${meta.title.slice(0, 50)}…` : meta.title;
    ctx.fillText(shortTopic, padX + 34, 366);

    // Divider
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(padX + 34, 390, WIDTH - padX * 2 - 68, 1.5);

    // Karaoke animated caption words
    drawAnimatedCaptionBlock(
      ctx,
      bodyText,
      padX + 34,
      458,
      WIDTH - padX * 2 - 68,
      36,
      50,
      sceneProgress,
      fontFamily
    );

    // Hashtags row at bottom of card
    if (meta.hashtags.length > 0) {
      ctx.fillStyle = "rgba(165, 180, 252, 0.9)";
      ctx.font = `600 18px ${fontFamily}`;
      const tagsLine = meta.hashtags
        .slice(0, 3)
        .map((h) => `#${h}`)
        .join("   ");
      ctx.fillText(tagsLine, padX + 34, 882);
    }
  } else {
    // SCENE 3: Branded DevInquire Outro & Call-To-Action
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    drawRoundedRect(ctx, padX, 290, WIDTH - padX * 2, 620, 36);
    ctx.fill();
    ctx.strokeStyle = "rgba(129, 140, 248, 0.45)";
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, padX, 290, WIDTH - padX * 2, 620, 36);
    ctx.stroke();

    // Glowing Brand Circle
    ctx.fillStyle = "#4E45E1";
    ctx.beginPath();
    ctx.arc(WIDTH / 2, 410, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 36px ${fontFamily}`;
    ctx.fillText("DI", WIDTH / 2 - 20, 423);

    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 38px ${fontFamily}`;
    ctx.fillText("Read the Full", WIDTH / 2, 525);
    ctx.fillText("Engineering Breakdown", WIDTH / 2, 572);

    ctx.fillStyle = "rgba(199, 210, 254, 0.95)";
    ctx.font = `600 21px ${fontFamily}`;
    ctx.fillText("Link in caption & bio", WIDTH / 2, 628);

    // URL CTA Pill
    ctx.fillStyle = "#4E45E1";
    drawRoundedRect(ctx, padX + 42, 676, WIDTH - (padX + 42) * 2, 68, 34);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 22px ${fontFamily}`;
    ctx.fillText("devinquire.com/blog", WIDTH / 2, 718);

    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.font = `600 18px ${fontFamily}`;
    ctx.fillText(`Follow ${meta.handle} for daily tech insights`, WIDTH / 2, 835);
    ctx.textAlign = "left";
  }

  ctx.restore();

  // 4. Bottom Footer Caption Strip
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.font = `600 16px ${fontFamily}`;
  ctx.fillText("devinquire.com • Engineering & AI Studio", padX, HEIGHT - 54);
}

/**
 * Generate (or return cached) 9:16 MP4 Reel + Poster JPG for a Blog article
 */
export async function generateBlogReelVideo(blog = {}, options = {}) {
  ensureDirs();
  const safeId = String(blog.id || blog.slug || `custom-${Date.now()}`)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .slice(0, 80);

  const mp4Filename = `blog-${safeId}.mp4`;
  const posterFilename = `blog-${safeId}.jpg`;
  const mp4Path = path.join(REELS_DIR, mp4Filename);
  const posterPath = path.join(REELS_DIR, posterFilename);

  if (!options.forceRegenerate && fs.existsSync(mp4Path) && fs.statSync(mp4Path).size > 10000) {
    return {
      mp4Filename,
      posterFilename,
      mp4Path,
      posterPath,
      durationSec: DURATION_SEC,
      cached: true,
    };
  }

  if (activeRenders.has(mp4Filename)) {
    return activeRenders.get(mp4Filename);
  }

  const renderPromise = (async () => {
    const { ffmpegBin, createCanvas, loadImage, GlobalFonts } = await getVideoLibs();
    const fontFamily = await ensureFontsReady(GlobalFonts);
    const coverImg = await loadBlogCoverImage(options.imageUrl || blog.featured_image || "", loadImage);
    const insights = extractReelInsights(blog);

    const rawTags = Array.isArray(blog.tags)
      ? blog.tags
      : typeof blog.tags === "string"
      ? (() => {
          try {
            return JSON.parse(blog.tags);
          } catch {
            return [];
          }
        })()
      : [];

    const meta = {
      ...insights,
      handle: options.handle || "@devinquire",
      hashtags:
        rawTags.length > 0
          ? rawTags.map((t) => String(t).replace(/[^a-zA-Z0-9]/g, "")).filter(Boolean)
          : ["DevInquire", "SoftwareEngineering", "TechReels"],
    };

    const wavPath = path.join(REELS_DIR, `tmp-audio-${safeId}-${Date.now()}.wav`);
    const tmpMp4Path = path.join(REELS_DIR, `tmp-video-${safeId}-${Date.now()}.mp4`);

    fs.writeFileSync(wavPath, generateAmbientTechBeatWav(DURATION_SEC));

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    await new Promise((resolve, reject) => {
      const ffArgs = [
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        `${WIDTH}x${HEIGHT}`,
        "-r",
        String(FPS),
        "-i",
        "pipe:0",
        "-i",
        wavPath,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "high",
        "-level",
        "4.1",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-shortest",
        "-movflags",
        "+faststart",
        tmpMp4Path,
      ];

      const proc = spawn(ffmpegBin, ffArgs, {
        stdio: ["pipe", "ignore", "pipe"],
      });

      let stderrLog = "";
      proc.stderr.on("data", (chunk) => {
        stderrLog += chunk.toString();
      });

      proc.on("error", (err) => reject(err));
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderrLog.slice(-400)}`));
      });

      let frame = 0;
      const writeNext = () => {
        try {
          while (frame < TOTAL_FRAMES) {
            renderReelFrame(ctx, frame, meta, coverImg, fontFamily);
            if (frame === 36) {
              try {
                fs.writeFileSync(posterPath, canvas.toBuffer("image/jpeg", 86));
              } catch {
                // poster optional
              }
            }
            const rawRgba = canvas.data();
            frame += 1;
            if (!proc.stdin.write(rawRgba)) {
              proc.stdin.once("drain", writeNext);
              return;
            }
          }
          proc.stdin.end();
        } catch (drawErr) {
          proc.kill("SIGKILL");
          reject(drawErr);
        }
      };

      writeNext();
    });

    try {
      if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
    } catch {
      // ignore
    }

    fs.renameSync(tmpMp4Path, mp4Path);

    return {
      mp4Filename,
      posterFilename,
      mp4Path,
      posterPath,
      durationSec: DURATION_SEC,
      cached: false,
    };
  })();

  activeRenders.set(mp4Filename, renderPromise);
  try {
    return await renderPromise;
  } finally {
    activeRenders.delete(mp4Filename);
  }
}
