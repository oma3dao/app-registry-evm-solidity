#!/usr/bin/env ts-node

/**
 * OMA3 Specification Compliance Test Runner
 * 
 * This script runs tests that verify specification compliance rather than
 * implementation details. It's designed to catch bugs like the deterministic
 * issuer issue where tests were validating broken behavior.
 */

import { spawn } from 'child_process';
import * as path from 'path';

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(message: string, color: string = colors.white) {
    console.log(`${color}${message}${colors.reset}`);
}

function runTest(testFile: string, description: string): Promise<boolean> {
    return new Promise((resolve) => {
        log(`\n${colors.cyan}🧪 Running: ${description}${colors.reset}`);
        log(`${colors.blue}   File: ${testFile}${colors.reset}`);
        
        const child = spawn('npx', ['hardhat', 'test', testFile], {
            stdio: 'pipe',
            shell: true
        });

        let output = '';
        let errorOutput = '';

        child.stdout?.on('data', (data) => {
            output += data.toString();
        });

        child.stderr?.on('data', (data) => {
            errorOutput += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                log(`   ${colors.green}✅ PASSED${colors.reset}`);
                resolve(true);
            } else {
                log(`   ${colors.red}❌ FAILED (exit code: ${code})${colors.reset}`);
                
                // Show key error information
                if (errorOutput.includes('🚨 CRITICAL BUG')) {
                    log(`   ${colors.red}🚨 CRITICAL BUG DETECTED IN IMPLEMENTATION${colors.reset}`);
                }
                
                if (output.includes('expected') && output.includes('to equal')) {
                    const match = output.match(/expected.*?to equal.*?/);
                    if (match) {
                        log(`   ${colors.yellow}   Expected vs Actual: ${match[0]}${colors.reset}`);
                    }
                }
                
                resolve(false);
            }
        });
    });
}

async function main() {
    const command = process.argv[2];

    log(`${colors.bright}${colors.magenta}🎯 OMA3 Specification Compliance Test Runner${colors.reset}`);
    log(`${colors.blue}========================================${colors.reset}`);

    const testSuites = [
        {
            file: 'test/OMA3SpecificationComplianceTests.ts',
            description: 'Specification Compliance Tests - Tests actual requirements vs implementation'
        },
        {
            file: 'test/OMA3CriticalBugDetectionTests.ts', 
            description: 'Critical Bug Detection Tests - Catches deterministic issuer bug'
        },
        {
            file: 'test/OMA3MissingTestCases.ts',
            description: 'Missing Test Cases - Comprehensive coverage of all functionality'
        },
        {
            file: 'test/OMA3SecurityEdgeCases.ts',
            description: 'Security and Edge Cases - Robustness against attacks and edge conditions'
        },
        {
            file: 'test/OMA3KeywordTraitTests.ts',
            description: 'Keyword and Trait Tests - Registry keyword and trait functionality'
        },
        {
            file: 'test/OMA3FinalCoverageTests.ts',
            description: 'Fixed Coverage Tests - Updated to test specification compliance'
        },
        {
            file: 'test/OMA3ResolverWithStore.ts',
            description: 'Main Resolver Tests - Updated with positive test cases'
        },
        {
            file: 'test/OMA3ResolverEdgeCases.ts',
            description: 'Edge Case Tests - Fixed to test actual behavior'
        }
    ];

    if (command === 'all') {
        log(`\n${colors.bright}Running all specification compliance tests...${colors.reset}`);
        
        let passed = 0;
        let failed = 0;
        
        for (const suite of testSuites) {
            const success = await runTest(suite.file, suite.description);
            if (success) {
                passed++;
            } else {
                failed++;
            }
        }
        
        log(`\n${colors.bright}${colors.blue}📊 RESULTS SUMMARY${colors.reset}`);
        log(`${colors.green}✅ Passed: ${passed}${colors.reset}`);
        log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);
        
        if (failed > 0) {
            log(`\n${colors.red}🚨 CRITICAL ISSUES DETECTED:${colors.reset}`);
            log(`${colors.yellow}   - Some tests are failing because the implementation doesn't match the specification${colors.reset}`);
            log(`${colors.yellow}   - The deterministic issuer bug is likely present${colors.reset}`);
            log(`${colors.yellow}   - Review the failing tests to understand what needs to be fixed${colors.reset}`);
        } else {
            log(`\n${colors.green}🎉 All tests passed! Implementation appears to match specification.${colors.reset}`);
        }
        
    } else if (command === 'spec') {
        log(`\n${colors.bright}Running specification compliance tests only...${colors.reset}`);
        await runTest(testSuites[0].file, testSuites[0].description);
        
    } else if (command === 'bugs') {
        log(`\n${colors.bright}Running critical bug detection tests only...${colors.reset}`);
        await runTest(testSuites[1].file, testSuites[1].description);
        
    } else if (command === 'missing') {
        log(`\n${colors.bright}Running missing test cases...${colors.reset}`);
        await runTest(testSuites[2].file, testSuites[2].description);
        
    } else if (command === 'security') {
        log(`\n${colors.bright}Running security and edge case tests...${colors.reset}`);
        await runTest(testSuites[3].file, testSuites[3].description);
        
    } else if (command === 'keywords') {
        log(`\n${colors.bright}Running keyword and trait tests...${colors.reset}`);
        await runTest(testSuites[4].file, testSuites[4].description);
        
    } else if (command === 'help' || !command) {
        log(`\n${colors.bright}Available commands:${colors.reset}`);
        log(`  ${colors.cyan}all${colors.reset}    - Run all specification compliance tests`);
        log(`  ${colors.cyan}spec${colors.reset}    - Run specification compliance tests only`);
        log(`  ${colors.cyan}bugs${colors.reset}    - Run critical bug detection tests only`);
        log(`  ${colors.cyan}missing${colors.reset} - Run missing test cases`);
        log(`  ${colors.cyan}security${colors.reset} - Run security and edge case tests`);
        log(`  ${colors.cyan}keywords${colors.reset} - Run keyword and trait tests`);
        log(`  ${colors.cyan}help${colors.reset}    - Show this help message`);
        
        log(`\n${colors.bright}What these tests do:${colors.reset}`);
        log(`  ${colors.yellow}•${colors.reset} Verify that currentOwner() works with real authorized issuers`);
        log(`  ${colors.yellow}•${colors.reset} Check that isDataHashValid() functions correctly`);
        log(`  ${colors.yellow}•${colors.reset} Test end-to-end attestation-to-mint flows`);
        log(`  ${colors.yellow}•${colors.reset} Catch the deterministic issuer discovery bug`);
        log(`  ${colors.yellow}•${colors.reset} Ensure tests validate specification requirements, not broken implementation`);
        log(`  ${colors.yellow}•${colors.reset} Test comprehensive coverage of all missing functionality`);
        log(`  ${colors.yellow}•${colors.reset} Validate security against various attack vectors`);
        log(`  ${colors.yellow}•${colors.reset} Test keyword and trait functionality in registry`);
        
    } else {
        log(`\n${colors.red}❌ Unknown command: ${command}${colors.reset}`);
        log(`Run with 'help' to see available commands.`);
        process.exit(1);
    }
}

main().catch((error) => {
    log(`\n${colors.red}❌ Error running tests: ${error.message}${colors.reset}`);
    process.exit(1);
});
