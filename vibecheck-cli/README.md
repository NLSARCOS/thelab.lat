# VibeCheck Security CLI

AI security scanner for vibe-coded projects — by TheLab.lat.

## Install

```bash
npm install -g vibecheck
```

## Usage

```bash
vibecheck scan https://github.com/org/repo
vibecheck scan --key=vck_xxx
vibecheck scan --fail-on=critical
vibecheck scan --output=json
vibecheck auth vck_xxx
vibecheck status
```

### Examples

Scan a GitHub repository:

```bash
vibecheck scan https://github.com/thelab-lat/vibecheck-cli
```

Scan the current directory:

```bash
vibecheck scan
```

Authenticated scan (saves to dashboard):

```bash
vibecheck scan --key=vck_xxx
```

Fail CI on critical findings:

```bash
vibecheck scan --fail-on=critical
```

Output raw JSON:

```bash
vibecheck scan --output=json
```

## GitHub Actions Workflow Example

```yaml
name: VibeCheck Security

on:
  push:
    branches: [main]
  pull_request:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install VibeCheck
        run: npm install -g vibecheck

      - name: Run VibeCheck Scan
        env:
          VIBECHECK_KEY: ${{ secrets.VIBECHECK_KEY }}
        run: |
          vibecheck scan --key=$VIBECHECK_KEY --fail-on=critical
```

## CI/CD Integration Guide

1. Create an API key in the VibeCheck dashboard.
2. Store the key in your CI secrets as `VIBECHECK_KEY`.
3. Run `vibecheck scan --key=$VIBECHECK_KEY --fail-on=critical` in your pipeline.
4. Use `--output=json` to feed results into downstream tooling.
5. Open the dashboard link printed at the end of each scan for full reports.

## Notes

- Public scans are supported for GitHub URLs or local paths.
- Authenticated scans are required to save results to the dashboard.
