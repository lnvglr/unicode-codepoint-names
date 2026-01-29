/**
 * Generates display-ready Unicode character names from UnicodeData.txt and writes
 * them to v1/ for GitHub Pages API use:
 * - v1/{block}.json — block files (e.g. v1/0.json)
 * - v1/{codepoint} — plain text file per codepoint (e.g. v1/0048 → "LATIN CAPITAL LETTER H")
 * Run from repo root: node scripts/generate-glyph-map.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNICODE_DATA_FILE = path.join(__dirname, "UnicodeData.txt");
const V1_DIR = path.join(__dirname, "..", "v1");

function normalizeHex(hex) {
  return hex.toUpperCase().padStart(4, "0");
}

function generateName(name, codepoint) {
  // Skip controls / unassigned
  if (!name || name.startsWith("<")) return null;

  // Get the actual character
  const char = String.fromCodePoint(parseInt(codepoint, 16));

  // Parse the Unicode name structure
  // Pattern: {SCRIPT} {CAPITAL|SMALL}? {TYPE} {LITERAL} {WITH ...}?
  // Examples:
  // - "LATIN CAPITAL LETTER A"
  // - "LATIN SMALL LETTER A WITH ACUTE"
  // - "HEBREW LETTER ALEF"
  // - "DIGIT ZERO"
  // - "GREEK CAPITAL LETTER ALPHA"

  const parts = name.split(/\s+/);
  let script = null;
  let capital = null;
  let type = null;
  let literal = null;
  let modifiers = null;
  
  // Find script (first word or first few words before CAPITAL/SMALL/LETTER/DIGIT/SYLLABICS/SYLLABLE)
  const scriptKeywords = ["LATIN", "GREEK", "CYRILLIC", "HEBREW", "ARABIC", "ARMENIAN", 
    "GEORGIAN", "THAI", "DEVANAGARI", "BENGALI", "GURMUKHI", "GUJARATI", "ORIYA", 
    "TAMIL", "TELUGU", "KANNADA", "MALAYALAM", "SINHALA", "TIBETAN", "MYANMAR", 
    "ETHIOPIC", "CHEROKEE", "CANADIAN", "ABORIGINAL", "OGHAM", "RUNIC", "KHMER", 
    "LAO", "HANGUL", "HIRAGANA", "KATAKANA", "BOPOMOFO", "YI", "CJK", "IDEOGRAPHIC", "NKO"];
  
  // Type keywords that mark the end of script name
  const typeMarkers = ["LETTER", "DIGIT", "NUMBER", "SYMBOL", "PUNCTUATION", 
    "MARK", "ACCENT", "TONE", "VOWEL", "CONSONANT", "FIGURE", "CHARACTER", 
    "SPACE", "CONTROL", "LIGATURE", "SYLLABICS", "SYLLABLE", "CAPITAL", "SMALL", "COMBINING"];
  
  // Check if name starts with a script keyword
  const upperName = name.toUpperCase();
  for (const keyword of scriptKeywords) {
    if (upperName.startsWith(keyword + " ") || upperName === keyword) {
      // Find where the script name ends - stop at type markers
      let scriptEnd = name.toUpperCase().indexOf(keyword) + keyword.length;
      const remaining = name.substring(scriptEnd).toUpperCase();
      
      // Check if there's a type marker after the script keyword
      for (const marker of typeMarkers) {
        const markerIndex = remaining.indexOf(" " + marker + " ");
        if (markerIndex !== -1) {
          // Script name ends before the type marker
          script = name.substring(0, scriptEnd).toLowerCase();
          break;
        }
      }
      
      // If no type marker found, use the script keyword as-is
      if (!script) {
        script = name.substring(0, scriptEnd).toLowerCase();
      }
      break;
    }
  }
  
  // If no script found, check for standalone types
  // For these, don't set script (only type), so we get "DIGIT ZERO" not "DIGIT DIGIT ZERO"
  // But don't treat "NUMBER SIGN", "SYMBOL SIGN", etc. as standalone types - let SIGN be detected normally
  if (!script) {
    if (upperName.startsWith("DIGIT ") && !upperName.includes(" SIGN")) {
      type = "digit";
    } else if (upperName.startsWith("NUMBER ") && !upperName.includes(" SIGN")) {
      type = "number";
    } else if (upperName.startsWith("SYMBOL ") && !upperName.includes(" SIGN")) {
      type = "symbol";
    } else if (upperName.startsWith("PUNCTUATION ") && !upperName.includes(" SIGN")) {
      type = "punctuation";
    } else if (upperName.startsWith("MARK ") && !upperName.includes(" SIGN")) {
      type = "mark";
    } else if (upperName.startsWith("SPACE") && !upperName.includes(" SIGN")) {
      type = "space";
    }
  }
  
  // Check for CAPITAL/SMALL
  if (name.includes(" CAPITAL ")) {
    capital = "capital";
  } else if (name.includes(" SMALL ")) {
    capital = "small";
  }
  
  // Find type (LETTER, DIGIT, NUMBER, SYMBOL, SYLLABICS, SYLLABLE, SIGN, ARROW, PARENTHESIS, BRACKET, COMBINING, etc.)
  const typeKeywords = ["LETTER", "DIGIT", "NUMBER", "SYMBOL", "PUNCTUATION", 
    "MARK", "ACCENT", "TONE", "VOWEL", "CONSONANT", "FIGURE", "CHARACTER", 
    "SPACE", "CONTROL", "LIGATURE", "SYLLABICS", "SYLLABLE", "SIGN", "ARROW", "PARENTHESIS", "BRACKET", "COMBINING", "APOSTROPHE"];
  
  // Prefer the rightmost type keyword so "NKO HIGH TONE APOSTROPHE" gets type apostrophe, not tone
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].toUpperCase();
    if (typeKeywords.includes(part)) {
      type = part.toLowerCase();
      break;
    }
  }
  if (!type) {
    for (const keyword of typeKeywords) {
      if (upperName.includes(" " + keyword + " ") || upperName.endsWith(" " + keyword)) {
        type = keyword.toLowerCase();
        break;
      }
    }
  }
  // "SCRIPT SMALL L" (ℓ), "SCRIPT SMALL G", etc. → treat as symbol with full name as literal
  if (upperName.match(/^SCRIPT SMALL [A-Z]$/)) {
    type = "symbol";
    literal = name.toLowerCase();
  }
  
  // Track if we added SIGN as type (so we can use full name as literal)
  let addedSignType = false;
  
  // For names that don't have an explicit type but are mathematical/symbol characters,
  // add "SIGN" as the type if the name suggests it's a sign
  if (!type && !script) {
    const signPatterns = [
      /^(ALMOST EQUAL TO|NOT EQUAL TO|EQUAL TO|LESS-THAN|GREATER-THAN|PLUS|MINUS|MULTIPLICATION|DIVISION|INFINITY|INTEGRAL|SUM|PRODUCT|EMPTY SET|ELEMENT OF|SUBSET|SUPERSET|UNION|INTERSECTION|LOGICAL AND|LOGICAL OR|NOT|TILDE|CIRCUMFLEX|ACUTE|GRAVE|MACRON|BREVE|DOT|RING|CEDILLA|DIAERESIS|HOOK|STROKE|BAR|BRACKET|PARENTHESIS|BRACE|QUOTATION|APOSTROPHE|COMMA|PERIOD|COLON|SEMICOLON|EXCLAMATION|QUESTION|SLASH|BACKSLASH|ASTERISK|AMPERSAND|AT|HASH|DOLLAR|PERCENT|CARET|UNDERSCORE|PIPE|CURLY|SQUARE|ANGLE)/i
    ];
    
    for (const pattern of signPatterns) {
      if (pattern.test(name)) {
        type = "sign";
        addedSignType = true;
        break;
      }
    }
  }
  
  // Extract literal and modifiers
  const withIndex = name.toUpperCase().indexOf(" WITH ");
  if (withIndex !== -1) {
    const beforeWith = name.substring(0, withIndex);
    const afterWith = name.substring(withIndex + 6);
    modifiers = afterWith.toLowerCase();
    
    // Get literal from before "WITH" - include all descriptive words before the letter name
    const beforeParts = beforeWith.trim().split(/\s+/);
    // Find where the type keyword is
    let typeIndex = -1;
    for (let i = 0; i < beforeParts.length; i++) {
      if (["LETTER", "DIGIT", "NUMBER", "SYMBOL", "PUNCTUATION", "MARK", 
           "ACCENT", "TONE", "VOWEL", "CONSONANT", "FIGURE", "CHARACTER", 
           "SPACE", "CONTROL", "LIGATURE", "SIGN", "ARROW", "PARENTHESIS", "BRACKET"].includes(beforeParts[i].toUpperCase())) {
        typeIndex = i;
        break;
      }
    }
    // Everything after the type keyword is the literal (including FINAL, INITIAL, etc.)
    // But if type is at the end, everything before it is the literal
    if (typeIndex !== -1) {
      if (typeIndex < beforeParts.length - 1) {
        // Type is in the middle, everything after is literal
        literal = beforeParts.slice(typeIndex + 1).join(" ").toLowerCase();
      } else if (typeIndex === beforeParts.length - 1) {
        // Type is at the end, everything before it is literal
        literal = beforeParts.slice(0, typeIndex).join(" ").toLowerCase();
      }
      // Remove "FORM" from the end if present (for Arabic/N'Ko forms)
      if (literal && literal.endsWith(" form")) {
        literal = literal.substring(0, literal.length - 5).trim();
      }
    } else {
      literal = beforeParts[beforeParts.length - 1].toLowerCase();
      // Remove "FORM" from the end if present
      if (literal.endsWith(" form")) {
        literal = literal.substring(0, literal.length - 5).trim();
      }
    }
  } else {
    // No "WITH", literal includes all descriptive words after the type keyword
    // Remove script, capital/small, and type keywords
    const skipWords = new Set(["CAPITAL", "SMALL", "LETTER", "DIGIT", "NUMBER", 
      "SYMBOL", "PUNCTUATION", "MARK", "ACCENT", "TONE", "VOWEL", "CONSONANT", 
      "FIGURE", "CHARACTER", "SPACE", "CONTROL", "LIGATURE", "SIGN", "ARROW", "PARENTHESIS", "BRACKET", "EXTENDED", 
      "SUPPLEMENT", "SUPPLEMENTARY"]);
    
    // Also skip script name words
    if (script) {
      script.split(/\s+/).forEach(word => skipWords.add(word.toUpperCase()));
    }
    
    // If we added SIGN as the type, use the full name as literal
    if (addedSignType && type === "sign") {
      const literalParts = parts.filter(p => !skipWords.has(p.toUpperCase()));
      if (literalParts.length > 0) {
        literal = literalParts.join(" ").toLowerCase();
      }
    } else {
      // Find the type keyword index - use the one that matches the detected type
      let typeIndex = -1;
      if (type) {
        // Find the index of the actual type keyword we detected
        for (let i = 0; i < parts.length; i++) {
          if (parts[i].toUpperCase() === type.toUpperCase()) {
            typeIndex = i;
            break;
          }
        }
      }
      
      // If we didn't find the type, fall back to finding any type keyword
      if (typeIndex === -1) {
        for (let i = 0; i < parts.length; i++) {
          if (["LETTER", "DIGIT", "NUMBER", "SYMBOL", "PUNCTUATION", "MARK", 
               "ACCENT", "TONE", "VOWEL", "CONSONANT", "FIGURE", "CHARACTER", 
               "SPACE", "CONTROL", "LIGATURE", "SIGN", "ARROW", "PARENTHESIS", "BRACKET", "COMBINING", "APOSTROPHE"].includes(parts[i].toUpperCase())) {
            typeIndex = i;
            break;
          }
        }
      }
      
      // Everything after the type keyword is the literal
      // But if type is at the end, everything before it is the literal
      if (typeIndex !== -1) {
        if (typeIndex < parts.length - 1) {
          // Type is in the middle, everything after is literal
          // For "SIGN" type, include words that are normally type keywords (like "ARROW")
          // if they come after "SIGN" (e.g., "PHAISTOS DISC SIGN ARROW")
          if (type === "sign") {
            literal = parts.slice(typeIndex + 1).join(" ").toLowerCase();
          } else {
            const literalParts = parts.slice(typeIndex + 1).filter(p => !skipWords.has(p.toUpperCase()));
            if (literalParts.length > 0) {
              literal = literalParts.join(" ").toLowerCase();
            }
          }
        } else if (typeIndex === parts.length - 1) {
          // Type is at the end, everything before it is the literal (excluding script words when script is set)
          const scriptWordCount = script ? script.split(/\s+/).length : 0;
          const literalStart = scriptWordCount;
          if (type === "sign" || (script && ["tone", "apostrophe", "mark"].includes(type))) {
            // Keep full literal (e.g. "high tone" for NKO HIGH TONE APOSTROPHE), don't filter type words
            literal = parts.slice(literalStart, typeIndex).join(" ").toLowerCase();
          } else {
            const literalParts = parts.slice(literalStart, typeIndex).filter(p => !skipWords.has(p.toUpperCase()));
            if (literalParts.length > 0) {
              literal = literalParts.join(" ").toLowerCase();
            }
          }
        }
        
        // Remove "FORM" from the end if present (for Arabic/N'Ko forms)
        if (literal && literal.endsWith(" form")) {
          literal = literal.substring(0, literal.length - 5).trim();
        }
      } else {
        // Fallback: last meaningful word
        const meaningfulParts = parts.filter(p => !skipWords.has(p.toUpperCase()));
        if (meaningfulParts.length > 0) {
          literal = meaningfulParts[meaningfulParts.length - 1].toLowerCase();
          // Remove "FORM" from the end if present
          if (literal.endsWith(" form")) {
            literal = literal.substring(0, literal.length - 5).trim();
          }
        }
      }
    }
  }
  
  // Ensure sign/arrow/parenthesis types always have a descriptive literal (never output just "SIGN" / "ARROW")
  if (type === "sign" && !script && !literal && parts.length > 0) {
    literal = parts.filter((p) => p.toUpperCase() !== "SIGN").join(" ").toLowerCase();
  }
  if (type === "parenthesis" && !script && !literal && parts.length > 0) {
    literal = parts.filter((p) => p.toUpperCase() !== "PARENTHESIS").join(" ").toLowerCase();
  }
  if (type === "arrow" && !script && !literal && parts.length > 0) {
    literal = parts.filter((p) => p.toUpperCase() !== "ARROW").join(" ").toLowerCase();
  }
  if (type === "bracket" && !script && !literal && parts.length > 0) {
    literal = parts.filter((p) => p.toUpperCase() !== "BRACKET").join(" ").toLowerCase();
  }
  
  // Build the name
  const nameParts = [];
  const cp = parseInt(codepoint, 16);
  // Arabic-Indic digits (U+0660–U+0669) → ARABIC DIGIT ZERO; Eastern Arabic-Indic (U+06F0–U+06F9) → FARSI DIGIT ZERO
  const digitPrefix =
    type === "digit"
      ? cp >= 0x0660 && cp <= 0x0669
        ? "Arabic"
        : cp >= 0x06f0 && cp <= 0x06f9
          ? "Farsi"
          : null
      : null;

  if (digitPrefix) {
    nameParts.push(digitPrefix);
  } else if (script) {
    // Use "N'Ko" for N'Ko letters only; use "NKO" for N'Ko digits, symbols, punctuation, marks
    const nkoNonLetter = script === "nko" && ["digit", "number", "symbol", "punctuation", "mark"].includes(type);
    nameParts.push(script === "nko" ? (nkoNonLetter ? "NKO" : "N'Ko") : script);
  }
  
  if (capital) {
    nameParts.push(capital);
  }
  
  // For signs, parentheses, arrows, and brackets without a script, put literal before type to match Unicode format
  const literalBeforeType = (type === "sign" || type === "parenthesis" || type === "arrow" || type === "bracket") && !script;
  const scriptLiteralThenType = script && literal && ["tone", "apostrophe", "mark"].includes(type);
  if (literalBeforeType || scriptLiteralThenType) {
    if (literal) {
      nameParts.push(literal);
    }
    nameParts.push(type);
  } else {
    // Normal order: type then literal
    if (type) {
      nameParts.push(type);
    }
    if (literal) {
      nameParts.push(literal);
    }
  }
  
  if (modifiers) {
    nameParts.push("with", modifiers);
  }
  
  // Return the structured name in UPPERCASE with spaces (keep "N'Ko" as-is for N'Ko letters; "NKO" stays uppercase)
  let result = nameParts.map(part => (part === "N'Ko" || part === "NKO") ? part : part.toUpperCase()).join(" ");
  // Never emit only "SIGN" or "ARROW" — use full Unicode name as last resort
  if (result === "SIGN" || result === "ARROW") {
    result = name.toUpperCase();
  }
  return result;
}

const out = {};
const lines = fs.readFileSync(UNICODE_DATA_FILE, "utf8").split(/\r?\n/);
const errors = [];

for (const line of lines) {
  if (!line) continue;

  const fields = line.split(";");
  const hex = fields[0];
  const name = fields[1];

  const codepoint = normalizeHex(hex);
  const expectedCodepoint = parseInt(codepoint, 16);
  const generatedChar = String.fromCodePoint(expectedCodepoint);
  const actualCodepoint = generatedChar.codePointAt(0);
  
  if (actualCodepoint !== expectedCodepoint) {
    errors.push({
      hex: codepoint,
      name,
      expected: expectedCodepoint,
      actual: actualCodepoint,
      char: generatedChar
    });
    continue;
  }
  
  const readableName = generateName(name, codepoint);
  
  if (readableName) {
    out[codepoint] = readableName;
  }
}

if (errors.length > 0) {
  console.error(`⚠ Found ${errors.length} codepoint mismatches:`);
  errors.slice(0, 20).forEach(err => {
    console.error(`  ${err.hex}: ${err.name}`);
  });
  if (errors.length > 20) {
    console.error(`  ... and ${errors.length - 20} more`);
  }
}

// Split by Unicode block (high byte) and write block files + per-codepoint plain text files
const byBlock = {};
for (const key of Object.keys(out)) {
  const cp = parseInt(key, 16);
  const block = cp >> 8;
  const blockId = block.toString(16).toUpperCase();
  if (!byBlock[blockId]) byBlock[blockId] = {};
  byBlock[blockId][key] = out[key];
}

fs.mkdirSync(V1_DIR, { recursive: true });

for (const [blockId, blockData] of Object.entries(byBlock)) {
  const outPath = path.join(V1_DIR, `${blockId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(blockData), "utf8");
  console.log(`Wrote v1/${blockId}.json (${Object.keys(blockData).length} entries)`);
}

// Per-codepoint plain text files: v1/0048 → "LATIN CAPITAL LETTER H"
let written = 0;
for (const [key, name] of Object.entries(out)) {
  const filePath = path.join(V1_DIR, key);
  fs.writeFileSync(filePath, name, "utf8");
  written++;
  if (written % 5000 === 0) {
    console.log(`  ... ${written} codepoint files`);
  }
}

console.log(`✔ Generated ${Object.keys(out).length} names → v1/ (${Object.keys(byBlock).length} block JSONs + ${Object.keys(out).length} codepoint files)`);
