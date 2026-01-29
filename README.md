# Unicode codepoint names API

Human-readable Unicode character names, served over GitHub Pages so you can resolve any codepoint to its name (e.g. `0048` → `LATIN CAPITAL LETTER H`).

**Base URL (GitHub Pages):**  
`https://lnvglr.github.io/unicode-codepoint-names/`

---

## API usage

### Get name for a single codepoint (plain text)

Use the 4-digit hex codepoint (uppercase) in the path:

```
GET /v1/0048
```

**Example:**

- **URL:** `https://lnvglr.github.io/unicode-codepoint-names/v1/0048`
- **Response (plain text):** `LATIN CAPITAL LETTER H`

**In code:**

```bash
curl https://lnvglr.github.io/unicode-codepoint-names/v1/0048
# LATIN CAPITAL LETTER H
```

```javascript
const name = await fetch('https://lnvglr.github.io/unicode-codepoint-names/v1/0048').then(r => r.text());
// "LATIN CAPITAL LETTER H"
```

```javascript
// From a character: codepoint 0048 = "H"
const hex = 'H'.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
const name = await fetch(`https://lnvglr.github.io/unicode-codepoint-names/v1/${hex}`).then(r => r.text());
```

### Get a block of names (JSON)

Block files are keyed by the high byte of the codepoint (e.g. `0` for U+0000–U+00FF). Fetch a block and look up the 4-digit key:

```
GET /v1/0.json   →  { "0048": "LATIN CAPITAL LETTER H", "0049": "LATIN CAPITAL LETTER I", ... }
```

**Example:**

```javascript
const block = (codepoint >> 8).toString(16).toUpperCase();
const key = codepoint.toString(16).toUpperCase().padStart(4, '0');
const data = await fetch(`https://lnvglr.github.io/unicode-codepoint-names/v1/${block}.json`).then(r => r.json());
const name = data[key]; // "LATIN CAPITAL LETTER H" for 0x0048
```

---

## Regenerating the data

Names are generated from Unicode’s `UnicodeData.txt` and written into `v1/` (block JSONs + one plain-text file per codepoint).

**Requirements:** Node.js (ES modules)

**Steps:**

1. Ensure `scripts/UnicodeData.txt` is present (download from [Unicode](https://unicode.org/Public/UCD/latest/ucd/UnicodeData.txt) if needed).
2. From the repo root:
   ```bash
   node scripts/generate-glyph-map.js
   ```
3. Commit the updated `v1/` folder if needed.