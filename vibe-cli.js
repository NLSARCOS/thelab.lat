#!/usr/bin/env node
const axios = require('axios');
const path = require('path');

/**
 * VIBE-CLI v1.0.0
 * The official command line tool for VibeCheck Security.
 */

const target = process.argv[2] || process.cwd();
const absolutePath = path.resolve(target);

async function runAudit() {
    console.log(`\x1b[36m[VibeCheck]\x1b[0m Starting autonomous audit in: ${absolutePath}`);
    
    try {
        const res = await axios.post('https://thelab.lat/api/scanner/audit', {
            repoPath: absolutePath
        });
        
        const { issuesFound, issues } = res.data;
        
        if (issuesFound === 0) {
            console.log('\x1b[32m[+] Perfect! No IA-Specific vulnerabilities found.\x1b[0m');
        } else {
            console.log(`\x1b[31m[!] Found ${issuesFound} issues!\x1b[0m`);
            issues.forEach(i => {
                console.log(`  - [${i.severity}] ${i.description} in ${i.file}:${i.line}`);
            });
        }
    } catch (e) {
        console.error('\x1b[31m[-] System unreachable. Check your connection.\x1b[0m');
    }
}

runAudit();
