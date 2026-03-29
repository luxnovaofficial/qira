# QIRA Peptide Site

Single-page premium peptide optimization concept for a physician-led luxury performance brand.

## Run locally

Use either option from the project root:

```bash
npx serve .
```

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000`.

## Current site scope

The current implementation includes:

- Hero section with custom peptide-inspired canvas animation
- Nine featured codes across multi-row card layouts
- Physician authority section with portrait slot and fallback state
- Process section covering labs, consult, code, and consistency
- Difference section focused on protocol-led care and physician oversight
- Compliance-aware footer with regulatory and clinical review copy

## File structure

- `index.html` contains the full single-page site markup and content
- `css/tokens.css` contains design tokens, layout primitives, and component styling
- `js/main.js` handles smooth scrolling and animation bootstrapping
- `js/hero-animation.js` renders the custom hero canvas animation
- `js/scroll-animations.js` handles reveal, strand, and shimmer effects
- `assets/doctor.jpg` is the physician portrait slot used by the page
- `assets/logo.png` is available as a brand asset but is not currently wired into the header/footer

## Notes

- Tailwind is loaded via CDN for rapid prototyping
- The design token source of truth lives in `css/tokens.css`
- This repo is a static concept site with no build step
