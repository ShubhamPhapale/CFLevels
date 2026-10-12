# CFLevels

A Chrome extension that adds **Contest Type** and **Problem Level** filters directly to the Codeforces problemset page.

![CFLevels Preview](assets/screenshot.png)

---

## Why this exists

When practicing on `/problemset`, rating filters only tell part of the story. A 1600 Div. 2 C feels very different from a 1600 Div. 1 A or an old math puzzle from 2013.

If you want to target a specific hurdle (like grinding Div. 2 C problems to stop choking mid-contest, or practicing Div. 3 D and E), Codeforces does not offer a way to filter by contest division or problem letter. 

CFLevels adds a **→ Filter by Level** box right into the sidebar on `/problemset` to solve this.

---

## Features

- **Multi-select contest types**: Div. 1, Div. 2, Div. 3, Div. 4, Educational, Global, CodeTON, and others.
- **Multi-select problem levels**: Pick single or multiple letters (for example, practicing both `C` and `D` problems together).
- **Works with native filters**: Combine it directly with Codeforces tags (`dp`, `graphs`) and difficulty rating ranges (`1400-1600`).
- **Smart narrowing**: The level list automatically adjusts to show only letters that actually exist for your selected contest types and tags.
- **Native look**: Styled to match Codeforces' own roundbox borders and contest-page multi-select dropdowns.
- **Fast and private**: Runs entirely in your browser using public Codeforces API endpoints (`contest.list` and `problemset.problems`). No tracking, no external servers, no login required.

---

## Installation

### From Chrome Web Store
*(Pending review, link will be added once live)*

### Load Unpacked (Manual)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/ShubhamPhapale/CFLevels.git
   ```
2. Open Google Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** in the top right.
4. Click **Load unpacked** in the top left.
5. Select the `CFLevels` folder.
6. Open [Codeforces Problemset](https://codeforces.com/problemset). The filter box will appear in the right sidebar below the native filter box.

---

## Author

**Shubham Phapale**  
GitHub: [@ShubhamPhapale](https://github.com/ShubhamPhapale)

---

## License

MIT
