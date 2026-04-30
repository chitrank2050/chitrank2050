const fs = require("fs");

/**
 * Updates the README.md status section with data from Sanity.
 * Inlines a unified, high-fidelity SVG status block for zero-latency.
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

    if (!d) {
      console.warn("⚠️ No siteSettings data found in Sanity. Skipping update.");
      return;
    }

    let readmeContent = "";

    if (d.isOpenToWork === true) {
      const lines = [];

      // Braces are now part of the 'add' lines so they get the green background
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

      // Calculate SVG Dimensions
      const lineHeight = 20;
      const padding = 16;
      const maxChars = lines.reduce((max, line) => Math.max(max, line.text.length + 2), 20);
      const width = Math.min(800, (maxChars * 8.5) + (padding * 2));
      const height = lines.length * lineHeight + (padding * 2);

      let svgRows = `<rect width="100%" height="100%" fill="#0d1117" rx="6" />`;

      lines.forEach((line, index) => {
        const y = padding + (index + 1) * lineHeight - 4;
        const bgColor = line.type === 'add' ? 'rgba(46, 160, 67, 0.15)' : 'rgba(248, 81, 73, 0.15)';
        const textColor = line.type === 'add' ? '#3fb950' : '#f85149';
        const symbol = line.type === 'add' ? '+' : '-';

        svgRows += `
          <rect x="0" y="${y - 15}" width="100%" height="${lineHeight}" fill="${bgColor}" />
          <text x="${padding}" y="${y}" fill="${textColor}" font-family="monospace" font-size="14">${symbol} ${line.text}</text>
        `;
      });

      const inlineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img">${svgRows}</svg>`;

      // Using inlining to avoid blinking; markers are handled by the replace logic
      readmeContent = `\n<p align="left">\n  ${inlineSvg}\n</p>\n\n---\n`;
    }

    const readmePath = "README.md";
    if (!fs.existsSync(readmePath)) {
      throw new Error("README.md not found in root directory.");
    }

    const readme = fs.readFileSync(readmePath, "utf8");
    const markerRegex = /(<!-- SANITY_STATUS_SYNC:START -->)[\s\S]*?(<!-- SANITY_STATUS_SYNC:END -->)/;

    if (!markerRegex.test(readme)) {
      throw new Error("Missing markers in README.md");
    }

    // $1 and $2 ensure the markers are preserved without duplication
    const updated = readme.replace(markerRegex, `$1${readmeContent}$2`);
    fs.writeFileSync(readmePath, updated);

    console.log(`✅ README synchronized surgically with inlined SVG.`);

  } catch (error) {
    console.error("❌ Critical Error:", error.message);
    process.exit(1);
  }
}

updateStatus();
