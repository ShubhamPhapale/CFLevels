# CFLevels

A lightweight Chrome extension that adds a **Contest Type** and **Problem Level** filter directly to the Codeforces problemset page (`/problemset`).

---

## The Problem

Codeforces provides native filters for problem tags and difficulty rating ranges, but there is no built-in way to filter by **contest type** (Div. 1, Div. 2, Div. 3, Div. 4, Educational, etc.) or **problem level** (A, B, C, D, etc.).

If you want to practice all Div. 2 C problems or grind Div. 3 D & E, rating alone does not tell the full story—a 1600 Div. 2 C has a completely different contest feel from an old marathon problem or a Div. 1 A.

---

## Features

- **Multi-Select Contest Types**: Choose one or multiple contest divisions (Div. 1, Div. 2, Div. 3, Div. 4, Educational, Global, CodeTON, etc.).
- **Multi-Select Problem Levels**: Select single or multiple problem letters (e.g. `C` and `D`).
- **Works with Native Filters**: Combine seamlessly with Codeforces tags (`dp`, `graphs`, etc.) and difficulty rating ranges (`1400-1600`).
- **Smart Narrowing**: Level options dynamically adapt to show only levels that actually exist for your selected contest types and tags.
- **100 Problems per Page**: Clean pagination sorted newest to oldest, with your solved problems highlighted.
- **Native Look & Feel**: Styled to blend seamlessly with Codeforces' roundbox layout and contest filter dropdowns.
- **Fast & Private**: Runs 100% client-side using public Codeforces API endpoints. Zero tracking, no accounts or external servers.

---

## Installation

### Option 1: Chrome Web Store
*(Link coming soon)*

### Option 2: Load Unpacked (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/ShubhamPhapale/CFLevels.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** in the top left corner.
5. Select the `CFLevels` folder.
6. Open [Codeforces Problemset](https://codeforces.com/problemset) and the filter box will appear in the right sidebar.

---

## Author

**Shubham Phapale**  
- GitHub: [@ShubhamPhapale](https://github.com/ShubhamPhapale)

---

## License

MIT License. Feel free to use, modify, and contribute!
