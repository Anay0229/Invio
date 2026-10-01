#!/usr/bin/env node

/**
 * Extract and sync i18n keys from source code
 *
 * This script scans your frontend code for t("...") calls and ensures
 * all used keys exist in your translation files.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SRC_DIR = path.join(__dirname, "src");
const LOCALES_DIR = path.join(__dirname, "src/lib/i18n/locales");
const SOURCE_FILE = "en.json";

// Matches t("key"), t('key'), $t("key"), t("key", { params }) and tKey("key").
// tKey() marks keys that are defined in one place and passed to t() later.
const T_PATTERNS = [/(?<![\w.])(?:\$?t|tKey)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1\s*[,)]/gs];

function findFiles(dir, extensions = [".svelte", ".ts", ".js"]) {
  let results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      // Skip node_modules and build directories
      if (
        !["node_modules", "build", ".svelte-kit", "dist"].includes(item.name)
      ) {
        results = results.concat(findFiles(fullPath, extensions));
      }
    } else if (extensions.some((ext) => item.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }

  return results;
}

function extractKeysFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const keys = new Set();

  for (const pattern of T_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1] === "`" && match[2].includes("${")) continue;
      keys.add(match[1] === "`" ? match[2] : JSON.parse(`"${match[2].replace(/\\'/g, "'")}"`));
    }
  }

  return Array.from(keys);
}

function loadJSON(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

function saveJSON(filePath, data) {
  // Sort keys alphabetically
  const sorted = Object.keys(data)
    .sort()
    .reduce((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});

  const content = JSON.stringify(sorted, null, 2) + "\n";
  fs.writeFileSync(filePath, content, "utf8");
}

function extractAndSync() {
  console.log("🔍 Scanning source code for translation keys...\n");

  // Find all source files
  const files = findFiles(SRC_DIR);
  console.log(`📁 Found ${files.length} source files\n`);

  // Extract all translation keys from source code
  const allKeys = new Set();
  let fileCount = 0;

  files.forEach((file) => {
    const keys = extractKeysFromFile(file);
    if (keys.length > 0) {
      fileCount++;
      keys.forEach((key) => allKeys.add(key));
    }
  });

  const sortedKeys = Array.from(allKeys).sort();
  console.log(
    `🔑 Found ${sortedKeys.length} unique translation keys in ${fileCount} files\n`,
  );

  // Load English translations
  const enPath = path.join(LOCALES_DIR, SOURCE_FILE);
  const enTranslations = loadJSON(enPath);

  // Find missing keys
  const missingKeys = sortedKeys.filter(
    (key) => !enTranslations.hasOwnProperty(key),
  );
  const unusedKeys = Object.keys(enTranslations).filter(
    (key) => !allKeys.has(key),
  );

  if (missingKeys.length > 0) {
    console.log(`⚠️  Missing in en.json (${missingKeys.length} keys):`);
    missingKeys.forEach((key) => {
      console.log(`   + "${key}"`);
      enTranslations[key] = key; // Add with key as value
    });
    console.log("");
  } else {
    console.log(`✅ All keys found in en.json\n`);
  }

  if (unusedKeys.length > 0) {
    console.log(
      `🗑️  Removing unused keys from en.json (${unusedKeys.length} keys):`,
    );
    unusedKeys.slice(0, 10).forEach((key) => {
      console.log(`   - "${key}"`);
      delete enTranslations[key];
    });
    if (unusedKeys.length > 10) {
      console.log(`   ... and ${unusedKeys.length - 10} more`);
      // Delete the rest
      unusedKeys.slice(10).forEach((key) => {
        delete enTranslations[key];
      });
    }
    console.log("");
  }

  // Save updated English file if there were changes
  if (missingKeys.length > 0 || unusedKeys.length > 0) {
    saveJSON(enPath, enTranslations);

    const changes = [];
    if (missingKeys.length > 0) changes.push(`+${missingKeys.length} added`);
    if (unusedKeys.length > 0) changes.push(`-${unusedKeys.length} removed`);
    console.log(`💾 Updated ${SOURCE_FILE}: ${changes.join(", ")}\n`);

    // Update other language files
    const otherFiles = fs
      .readdirSync(LOCALES_DIR)
      .filter((f) => f.endsWith(".json") && f !== SOURCE_FILE);

    otherFiles.forEach((file) => {
      const filePath = path.join(LOCALES_DIR, file);
      const translations = loadJSON(filePath);
      let added = 0;
      let removed = 0;

      // Add missing keys
      missingKeys.forEach((key) => {
        if (!translations.hasOwnProperty(key)) {
          translations[key] = `[NEEDS TRANSLATION] ${key}`;
          added++;
        }
      });

      // Remove unused keys
      unusedKeys.forEach((key) => {
        if (translations.hasOwnProperty(key)) {
          delete translations[key];
          removed++;
        }
      });

      if (added > 0 || removed > 0) {
        saveJSON(filePath, translations);
        const fileChanges = [];
        if (added > 0) fileChanges.push(`+${added}`);
        if (removed > 0) fileChanges.push(`-${removed}`);
        console.log(`   📝 ${file}: ${fileChanges.join(", ")}`);
      }
    });

    console.log("\n✨ All translation files updated!");
    if (missingKeys.length > 0) {
      console.log(
        '\n💡 Tip: Search for "[NEEDS TRANSLATION]" in the non-English locale files',
      );
    }
  } else {
    console.log("✅ No changes needed - all keys are in sync!");
  }

  // Summary
  console.log("\n📊 Summary:");
  console.log(`   Total keys in code: ${sortedKeys.length}`);
  console.log(`   Keys in en.json: ${Object.keys(enTranslations).length}`);
  console.log(`   Missing keys: ${missingKeys.length}`);
  console.log(`   Unused keys: ${unusedKeys.length}`);
}

// Run the extraction
try {
  extractAndSync();
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error(error.stack);
  process.exit(1);
}
