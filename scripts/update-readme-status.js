const fs = require("fs");

/**
 * Updates the README.md status section with data from Sanity.
 * Uses surgical regex capture groups to preserve markers.
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

    let content = "";

    // Generate content only if Open to Work is true
    if (d.isOpenToWork === true) {
      const lines = [];
      lines.push(`+ "availability": "Open to Work | Available for Hire"`);

      if (d.statusRole) lines.push(`+ "role": "${d.statusRole}"`);
      if (d.statusMode) lines.push(`+ "mode": "${d.statusMode}"`);

      const preferences = [];
      if (d.statusIntents && d.statusIntents.length > 0) {
        d.statusIntents.forEach(item => preferences.push(`+   "${item}"`));
      }
      if (d.statusAvoids && d.statusAvoids.length > 0) {
        d.statusAvoids.forEach(item => preferences.push(`-   "${item}"`));
      }

      if (preferences.length > 0) {
        lines.push(`+ "preferences": [\n${preferences.join(",\n")}\n+ ]`);
      }

      const jsonDiffBlock = "```diff\n{\n  " + lines.join(",\n  ") + "\n}\n```";
      content = `\n${jsonDiffBlock}\n\n---\n`;
    }

    const readmePath = "README.md";
    if (!fs.existsSync(readmePath)) {
      throw new Error("README.md not found in root directory.");
    }

    const readme = fs.readFileSync(readmePath, "utf8");

    // New surgical markers: <!-- SANITY_STATUS_SYNC:START --> and <!-- SANITY_STATUS_SYNC:END -->
    const markerRegex = /(<!-- SANITY_STATUS_SYNC:START -->)[\s\S]*?(<!-- SANITY_STATUS_SYNC:END -->)/;

    if (!markerRegex.test(readme)) {
      throw new Error("Missing markers: <!-- SANITY_STATUS_SYNC:START --> and <!-- SANITY_STATUS_SYNC:END --> in README.md");
    }

    // Replace ONLY the content between markers using capture groups ($1 and $2)
    const updated = readme.replace(markerRegex, `$1${content}$2`);
    fs.writeFileSync(readmePath, updated);

    console.log(`✅ README synchronized surgically. Visibility: ${d.isOpenToWork ? 'VISIBLE' : 'HIDDEN'}`);

  } catch (error) {
    console.error("❌ Critical Error:", error.message);
    process.exit(1);
  }
}

updateStatus();
