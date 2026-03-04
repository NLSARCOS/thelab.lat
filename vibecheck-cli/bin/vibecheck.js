#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { Command } = require('commander');

const API_BASE = 'https://vibecheck.thelab.lat/api';
const CONFIG_DIR = path.join(os.homedir(), '.vibecheck');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

async function loadDeps() {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;
  return { chalk, ora };
}

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function banner(chalk) {
  const art = [
    ' __     __ _ _          ____ _               _    ',
    ' \\ \\   / /(_) |        / ___| |__   ___  ___| | __',
    '  \\ \\ / / | | |_____  | |   | \'_ \\ / _ \\/ __| |/ /',
    '   \\ V /  | | |_____| | |___| | | |  __/ (__|   < ',
    '    \\_/   |_|_|         \\____|_| |_|\\___|\\___|_|\\_\\'
  ];
  console.log(chalk.cyan(art.join('\n')));
  console.log(chalk.gray('AI security scanner for vibe-coded projects — by TheLab.lat'));
  console.log('');
}

function normalizeSeverity(s) {
  if (!s) return 'LOW';
  return String(s).toUpperCase();
}

function severityColor(chalk, sev) {
  const s = normalizeSeverity(sev);
  if (s === 'CRITICAL') return chalk.red.bold;
  if (s === 'HIGH') return chalk.yellow.bold;
  if (s === 'MEDIUM') return chalk.blue.bold;
  return chalk.gray.bold;
}

function formatScore(chalk, score) {
  const value = Number.isFinite(score) ? score : 0;
  const color = value >= 90 ? chalk.green.bold : value >= 70 ? chalk.yellow.bold : chalk.red.bold;
  return color(`${value}`);
}

function extractFindings(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.findings)) return data.findings;
  if (Array.isArray(data.issues)) return data.issues;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function extractScore(data) {
  if (!data || typeof data !== 'object') return 0;
  if (Number.isFinite(data.score)) return data.score;
  if (Number.isFinite(data.securityScore)) return data.securityScore;
  if (Number.isFinite(data.riskScore)) return data.riskScore;
  return 0;
}

function summarizeFindings(findings) {
  const summary = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) {
    const sev = normalizeSeverity(f.severity || f.level || f.risk);
    if (!summary[sev]) summary[sev] = 0;
    summary[sev] += 1;
  }
  return summary;
}

function renderSummaryTable(chalk, summary) {
  const rows = [
    ['CRITICAL', summary.CRITICAL || 0],
    ['HIGH', summary.HIGH || 0],
    ['MEDIUM', summary.MEDIUM || 0],
    ['LOW', summary.LOW || 0]
  ];
  const labelPad = Math.max(...rows.map(r => r[0].length));
  console.log(chalk.white.bold('Summary'));
  for (const [label, count] of rows) {
    const color = severityColor(chalk, label);
    const padded = label.padEnd(labelPad, ' ');
    console.log(`  ${color(padded)}  ${count}`);
  }
  console.log('');
}

function renderFindings(chalk, findings) {
  if (!findings.length) {
    console.log(chalk.green('No findings found.'));
    console.log('');
    return;
  }
  console.log(chalk.white.bold('Findings'));
  findings.forEach((f, idx) => {
    const sev = normalizeSeverity(f.severity || f.level || f.risk);
    const color = severityColor(chalk, sev);
    const title = f.title || f.name || f.rule || 'Untitled finding';
    const detail = f.description || f.message || '';
    console.log(`  ${idx + 1}. ${color(sev)} ${title}`);
    if (detail) console.log(`     ${chalk.gray(detail)}`);
  });
  console.log('');
}

async function runScan(options, repoUrl) {
  const { chalk, ora } = await loadDeps();
  banner(chalk);

  const config = readConfig();
  const apiKey = options.key || config.apiKey || null;
  const useAuth = Boolean(apiKey);

  const spinner = ora('Scanning...').start();
  try {
    let response;
    if (useAuth) {
      response = await axios.post(`${API_BASE}/scan`, { repoUrl }, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
    } else {
      response = await axios.post(`${API_BASE}/scanner/audit`, { repoUrl });
    }
    spinner.succeed('Scan complete');

    const data = response.data || {};

    if (options.output === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      const score = extractScore(data);
      const findings = extractFindings(data);

      console.log(chalk.white.bold('Security Score'));
      console.log(`  ${formatScore(chalk, score)} / 100`);
      console.log('');

      renderFindings(chalk, findings);
      const summary = summarizeFindings(findings);
      renderSummaryTable(chalk, summary);
      console.log(chalk.cyan('See full report at vibecheck.thelab.lat/dashboard'));
      console.log('');

      if (options.failOn === 'critical' && (summary.CRITICAL || 0) > 0) {
        process.exitCode = 1;
      }
    }
  } catch (err) {
    spinner.fail('Scan failed');
    const message = err.response?.data?.message || err.message || 'Unknown error';
    console.error(chalk.red(`Error: ${message}`));
    process.exitCode = 1;
  }
}

async function runAuth(apiKey) {
  const { chalk } = await loadDeps();
  writeConfig({ apiKey });
  console.log(chalk.green('API key saved.'));
  console.log(chalk.gray(`Config: ${CONFIG_FILE}`));
}

async function runStatus() {
  const { chalk } = await loadDeps();
  banner(chalk);

  const config = readConfig();
  if (!config.apiKey) {
    console.log(chalk.yellow('No API key configured.'));
    console.log('Use `vibecheck auth <api-key>` to set one.');
    return;
  }

  console.log(chalk.green('API key configured.'));

  try {
    const response = await axios.get(`${API_BASE}/credits/balance`, {
      headers: { Authorization: `Bearer ${config.apiKey}` }
    });
    const balance = response.data?.balance ?? response.data?.credits ?? response.data?.remaining;
    if (typeof balance !== 'undefined') {
      console.log(chalk.white(`Credits remaining: ${balance}`));
    } else {
      console.log(chalk.gray('Credits remaining: unavailable'));
    }
  } catch (err) {
    const message = err.response?.data?.message || err.message || 'Unknown error';
    console.error(chalk.red(`Failed to fetch credits: ${message}`));
    process.exitCode = 1;
  }
}

async function main() {
  const program = new Command();
  program
    .name('vibecheck')
    .description('VibeCheck Security CLI')
    .version('1.0.0');

  program
    .command('scan')
    .argument('[url]', 'GitHub repository URL (optional)')
    .option('--key <apiKey>', 'API key for authenticated scan')
    .option('--fail-on <level>', 'Fail if findings include the level (e.g., critical)')
    .option('--output <format>', 'Output format: json or pretty', 'pretty')
    .action(async (url, options) => {
      const repoUrl = url || process.cwd();
      await runScan(options, repoUrl);
    });

  program
    .command('auth')
    .argument('<apiKey>', 'API key for VibeCheck')
    .action(async (apiKey) => {
      await runAuth(apiKey);
    });

  program
    .command('status')
    .action(async () => {
      await runStatus();
    });

  await program.parseAsync(process.argv);
}

main().catch(async (err) => {
  const { chalk } = await loadDeps();
  console.error(chalk.red(err.message || 'Unhandled error'));
  process.exit(1);
});
