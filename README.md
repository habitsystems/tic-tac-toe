# Tic-Tac-Toe

![Deploy to GitHub Pages](https://github.com/habitsystems/tic-tac-toe/actions/workflows/deploy.yml/badge.svg)

A simple Tic-Tac-Toe (Exes and Os) project in TypeScript.

## Getting Started

### Prerequisites

- Node.js 24.x
- npm 10.x (or newer)

If you use `nvm`, this repo includes `.nvmrc`:

```bash
nvm use
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

To run the project on localhost:
```bash
npm start
```
This will start a local server and open the game in your browser.

### Building

To compile the TypeScript code to JavaScript:
```bash
npm run build
```

### Pre-commit Linting

This project runs lint checks before each commit using `husky` + `lint-staged`.

- On commit, staged `*.ts` files are linted automatically.
- Fix lint issues before committing if the hook blocks the commit.

You can run linting manually:

```bash
npm run lint
```

Auto-fix lint issues where possible:

```bash
npm run lint:fix
```

## License

MIT
