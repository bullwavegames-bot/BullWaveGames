export const AVATAR_SKINS: Record<string, { glyph: string; label: string; tint: string }> = {
  kite: { glyph: "🪁", label: "Kite", tint: "#43c7e8" },
  lantern: { glyph: "🏮", label: "Lantern", tint: "#f0c36a" },
  tide: { glyph: "🌊", label: "Tide", tint: "#61d6b0" },
  gharial: { glyph: "🐊", label: "Gharial", tint: "#7dd3a8" },
  rangoli: { glyph: "✦", label: "Rangoli", tint: "#e8a0c8" },
  fold: { glyph: "📄", label: "Fold", tint: "#c9d4e8" },
};

export function playerRank(plays: number, stars: number): { level: number; title: string; xp: number; next: number } {
  const xp = Math.max(0, plays * 2 + stars);
  const level = 1 + Math.floor(xp / 8);
  const titles = ["Ripple", "Wave", "Breaker", "Surge", "Tide", "Horizon", "Monsoon"];
  const title = titles[Math.min(titles.length - 1, Math.floor((level - 1) / 3))];
  const next = level * 8;
  return { level, title, xp, next };
}

export function compressAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose a JPG, PNG, or WebP image."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Keep the photo under 8 MB."));
      return;
    }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not prepare that image."));
        return;
      }
      const min = Math.min(image.width, image.height);
      const sx = (image.width - min) / 2;
      const sy = (image.height - min) / 2;
      context.drawImage(image, sx, sy, min, min, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    image.src = url;
  });
}
