/**
 * nameCorrector.js
 *
 * Post-processes STT FINAL text to enforce correct spelling of known names
 * the engines mangle. Speechmatics' additional_vocab and Deepgram's keyterms
 * boost the right word, but neither is perfect — Calacanis still occasionally
 * comes back as "Kalakanis", "Kalacanis", etc.
 *
 * Each entry maps a regex of mishearings → the canonical spelling. Match is
 * case-insensitive but the replacement preserves the canonical capitalization.
 */

const REPLACEMENTS = [
  // Jason Calacanis — most-mangled host
  { re: /\bKalakanis\b/gi,  to: 'Calacanis' },
  { re: /\bKalacanis\b/gi,  to: 'Calacanis' },
  { re: /\bKhalakanis\b/gi, to: 'Calacanis' },
  { re: /\bKhalacanis\b/gi, to: 'Calacanis' },
  { re: /\bCaulacanis\b/gi, to: 'Calacanis' },
  { re: /\bCalakinis\b/gi,  to: 'Calacanis' },
  { re: /\bKalakinis\b/gi,  to: 'Calacanis' },
  { re: /\bCalicanis\b/gi,  to: 'Calacanis' },
  { re: /\bColecanis\b/gi,  to: 'Calacanis' },
  { re: /\bColicanis\b/gi,  to: 'Calacanis' },
  { re: /\bColocanis\b/gi,  to: 'Calacanis' },

  // Chamath Palihapitiya
  { re: /\bShamath\b/gi,        to: 'Chamath' },
  { re: /\bPalapitiya\b/gi,     to: 'Palihapitiya' },
  { re: /\bPalihapitia\b/gi,    to: 'Palihapitiya' },
  { re: /\bPalihapatiya\b/gi,   to: 'Palihapitiya' },
  { re: /\bPalahapitiya\b/gi,   to: 'Palihapitiya' },
  { re: /\bPalihapitya\b/gi,    to: 'Palihapitiya' },

  // David Friedberg
  { re: /\bFreedberg\b/gi,  to: 'Friedberg' },
  { re: /\bFreidberg\b/gi,  to: 'Friedberg' },
  { re: /\bFriedburg\b/gi,  to: 'Friedberg' },
  { re: /\bFreedburg\b/gi,  to: 'Friedberg' },

  // David Sacks
  { re: /\bDavid Sax\b/gi, to: 'David Sacks' },

  // Naval Ravikant
  { re: /\bNeval\b/gi,           to: 'Naval' },
  { re: /\bRavikan\b/gi,         to: 'Ravikant' },
  { re: /\bRavi Kant\b/gi,       to: 'Ravikant' },
  { re: /\bRovikant\b/gi,        to: 'Ravikant' },

  // Garry Tan (often "Gary Tan" — the spelling is two-r Garry)
  { re: /\bGary Tan\b/gi, to: 'Garry Tan' },

  // Lon Harris (often "Lawn Harris" / "Long Harris")
  { re: /\bLawn Harris\b/gi,  to: 'Lon Harris' },
  { re: /\bLong Harris\b/gi,  to: 'Lon Harris' },
  { re: /\bLawn Harrison\b/gi, to: 'Lon Harris' },

  // Alex Wilhelm
  { re: /\bWillem\b/gi,        to: 'Wilhelm' },
  { re: /\bWillhelm\b/gi,      to: 'Wilhelm' },
  { re: /\bWilhelmy\b/gi,      to: 'Wilhelm' },
  { re: /\bAlex Will\b/gi,     to: 'Alex Wilhelm' },

  // Oliver Korzen
  { re: /\bCorzen\b/gi,    to: 'Korzen' },
  { re: /\bCorzin\b/gi,    to: 'Korzen' },
  { re: /\bCorson\b/gi,    to: 'Korzen' },
  { re: /\bKorson\b/gi,    to: 'Korzen' },

  // Show / brand names
  { re: /\btwist podcast\b/gi,            to: 'TWiST podcast' },
  { re: /\bthis week and startups\b/gi,   to: 'This Week in Startups' },
  { re: /\bthis week in start ups\b/gi,   to: 'This Week in Startups' },
  { re: /\ball in podcast\b/gi,           to: 'All-In Podcast' },
  { re: /\ball in summit\b/gi,            to: 'All-In Summit' },

  // VC firms
  { re: /\bAndresen Horowitz\b/gi,  to: 'Andreessen Horowitz' },
  { re: /\bAndressen Horowitz\b/gi, to: 'Andreessen Horowitz' },
  { re: /\bSequoya\b/gi,            to: 'Sequoia' },

  // Companies
  { re: /\bbeehive\b/gi,    to: 'Beehiiv' },
  { re: /\bopen rooter\b/gi, to: 'OpenRouter' },
  { re: /\bopen router\b/gi, to: 'OpenRouter' },
];

/**
 * Apply all corrections to a single string. Idempotent — running twice
 * yields the same result.
 */
function correctNames(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  for (const { re, to } of REPLACEMENTS) {
    out = out.replace(re, to);
  }
  return out;
}

module.exports = { correctNames };
