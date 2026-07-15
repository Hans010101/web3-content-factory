export function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function glyphUnits(character) {
  if (/\s/.test(character)) return 0.36;
  if (/^[\x00-\x7F]$/.test(character)) return /[MW@#%]/.test(character) ? 0.84 : 0.58;
  return 1;
}

export function measureTextUnits(value = "") {
  return Array.from(String(value)).reduce((total, character) => total + glyphUnits(character), 0);
}

export function wrapText(value, maxUnits, maxLines = 99) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const lines = [];
  let line = "";
  let units = 0;
  for (const character of normalized) {
    const next = glyphUnits(character);
    if (line && units + next > maxUnits) {
      // Keep Chinese closing punctuation with the preceding phrase. The card
      // templates reserve one glyph of safety margin for this exception.
      if (/^[，。！？；：、）】》”’…,.!?;:]$/u.test(character)) {
        line += character;
        units += next;
        continue;
      }
      lines.push(line.trimEnd());
      line = character.trimStart();
      units = line ? next : 0;
      if (lines.length === maxLines) break;
    } else {
      line += character;
      units += next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line.trimEnd());
  const consumed = lines.join("").length;
  if (consumed < normalized.replaceAll(" ", "").length && lines.length) {
    lines[lines.length - 1] = `${lines.at(-1).replace(/[，。；：、,.!?\s]+$/u, "").slice(0, -1)}…`;
  }
  return lines;
}

export function tspans(lines, x, y, lineHeight, attributes = "") {
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" ${attributes}>${escapeXml(line)}</text>`)
    .join("\n");
}

export function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "—");
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(number);
}
