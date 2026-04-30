const fs = require("fs");

/**
 * Generates two themed SVGs (Light/Dark) and updates the README.
 */
async function updateStatus() {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET || "production";

  if (!projectId) {
    console.error("❌ Error: SANITY_PROJECT_ID secret is missing.");
    process.exit(1);
  }

  const query = encodeURIComponent("*[_type == 'siteSettings'][0]{isOpenToWork, statusRole, statusMode, statusIntents, statusAvoids}");
  const url = `https://${projectId}.api.sanity.io/v2021-10-21/data/query/${dataset}?query=${query}`;

  try {
    console.log("🛰️ Fetching status from Sanity...");
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Sanity API failed: ${res.statusText} (${res.status})`);
    }

    const { result: d } = await res.json();
    if (!d) return;

    let readmeContent = "";

    if (d.isOpenToWork === true) {
      const lines = [];
      lines.push({ type: 'add', text: `{` });
      lines.push({ type: 'add', text: `  "availability": "Open to Work | Available for Hire"` });

      if (d.statusRole) lines.push({ type: 'add', text: `  "role": "${d.statusRole}"` });
      if (d.statusMode) lines.push({ type: 'add', text: `  "mode": "${d.statusMode}"` });

      if (d.statusIntents && d.statusIntents.length > 0) {
        lines.push({ type: 'add', text: `  "preferences": [` });
        d.statusIntents.forEach((item, i) => {
          const comma = (i === d.statusIntents.length - 1 && (!d.statusAvoids || d.statusAvoids.length === 0)) ? "" : ",";
          lines.push({ type: 'add', text: `    "${item}"${comma}` });
        });
      }

      if (d.statusAvoids && d.statusAvoids.length > 0) {
        if (!d.statusIntents || d.statusIntents.length === 0) {
          lines.push({ type: 'add', text: `  "preferences": [` });
        }
        d.statusAvoids.forEach((item, i) => {
          const comma = (i === d.statusAvoids.length - 1) ? "" : ",";
          lines.push({ type: 'remove', text: `    "${item}"${comma}` });
        });
      }

      if ((d.statusIntents && d.statusIntents.length > 0) || (d.statusAvoids && d.statusAvoids.length > 0)) {
        lines.push({ type: 'add', text: `  ]` });
      }
      lines.push({ type: 'add', text: `}` });

      const themes = [
        { name: "dark", bg: "#0d1117", text: "#c9d1d9", addBg: "rgba(46, 160, 67, 0.15)", addText: "#3fb950", remBg: "rgba(248, 81, 73, 0.15)", remText: "#f85149" },
        { name: "light", bg: "#ffffff", text: "#24292e", addBg: "rgba(40, 167, 69, 0.15)", addText: "#22863a", remBg: "rgba(203, 36, 49, 0.15)", remText: "#d73a49" }
      ];

      const lineHeight = 20;
      const padding = 16;
      const maxChars = lines.reduce((max, line) => Math.max(max, line.text.length + 2), 20);
      const width = Math.min(800, (maxChars * 8.5) + (padding * 2));
      const height = lines.length * lineHeight + (padding * 2);

      themes.forEach(theme => {
        let svgRows = `<rect width="100%" height="100%" fill="${theme.bg}" rx="6" />`;
        lines.forEach((line, index) => {
          const y = padding + (index + 1) * lineHeight - 4;
          const bgColor = line.type === 'add' ? theme.addBg : theme.remBg;
          const textColor = line.type === 'add' ? theme.addText : theme.remText;
          const symbol = line.type === 'add' ? '+' : '-';

          svgRows += `
            <rect x="0" y="${y - 15}" width="100%" height="${lineHeight}" fill="${bgColor}" />
            <text x="${padding}" y="${y}" fill="${textColor}" font-family="monospace" font-size="14">${symbol} ${line.text}</text>
          `;
        });
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svgRows}</svg>`;
        fs.writeFileSync(`status-${theme.name}.svg`, svg);
      });

      // Use <picture> for theme switching
      readmeContent = `
<p align="left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="status-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="status-light.svg">
    <img alt="Live Status" src="status-dark.svg">
  </picture>
</p>

---
`;
    }

    const readmePath = "README.md";
    const readme = fs.readFileSync(readmePath, "utf8");
    const markerRegex = /(<!-- SANITY_STATUS_SYNC:START -->)[\s\S]*?(<!-- SANITY_STATUS_SYNC:END -->)/;

    const updated = readme.replace(markerRegex, `$1${readmeContent}$2`);
    fs.writeFileSync(readmePath, updated);

    console.log(`✅ README synchronized with adaptive Light/Dark SVGs.`);

  } catch (error) {
    console.error("❌ Critical Error:", error.message);
    process.exit(1);
  }
}

updateStatus();
