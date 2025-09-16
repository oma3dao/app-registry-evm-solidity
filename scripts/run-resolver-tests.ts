import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Test runner script for OMA3ResolverWithStore tests
 * Provides convenient ways to run specific test categories
 */

interface TestConfig {
    name: string;
    description: string;
    command: string;
}

const testConfigs: TestConfig[] = [
    {
        name: 'all',
        description: 'Run all resolver tests',
        command: 'npx hardhat test test/OMA3ResolverWithStore.ts test/OMA3ResolverIntegration.ts'
    },
    {
        name: 'core',
        description: 'Run core functionality tests only',
        command: 'npx hardhat test test/OMA3ResolverWithStore.ts'
    },
    {
        name: 'integration',
        description: 'Run integration tests only', 
        command: 'npx hardhat test test/OMA3ResolverIntegration.ts'
    },
    {
        name: 'deployment',
        description: 'Run deployment and configuration tests',
        command: 'npx hardhat test test/OMA3ResolverWithStore.ts --grep "Deployment"'
    },
    {
        name: 'issuers',
        description: 'Run issuer authorization management tests',
        command: 'npx hardhat test test/OMA3ResolverWithStore.ts --grep "Issuer Authorization"'
    },
    {
        name: 'ownership',
        description: 'Run ownership attestation tests',
        command: 'npx hardhat test test/OMA3ResolverWithStore.ts --grep "Direct Ownership|EIP-712 Delegated"'
    },
    {
        name: 'data',
        description: 'Run data hash attestation tests',
        command: 'npx hardhat test test/OMA3ResolverWithStore.ts --grep "Data Hash"'
    },
    {
        name: 'resolver',
        description: 'Run resolver function tests',
        command: 'npx hardhat test test/OMA3ResolverWithStore.ts --grep "Resolver Functions"'
    },
    {
        name: 'maturation',
        description: 'Run maturation window tests',
        command: 'npx hardhat test test/OMA3ResolverIntegration.ts --grep "Maturation"'
    },
    {
        name: 'delegated',
        description: 'Run EIP-712 delegated operation tests',
        command: 'npx hardhat test test/OMA3ResolverWithStore.ts test/OMA3ResolverIntegration.ts --grep "Delegated"'
    },
    {
        name: 'edge-cases',
        description: 'Run edge cases and error condition tests',
        command: 'npx hardhat test test/OMA3ResolverWithStore.ts --grep "Edge Cases"'
    },
    {
        name: 'gas',
        description: 'Run all tests with gas reporting',
        command: 'REPORT_GAS=true npx hardhat test test/OMA3ResolverWithStore.ts test/OMA3ResolverIntegration.ts'
    },
    {
        name: 'coverage',
        description: 'Run tests with coverage reporting',
        command: 'npx hardhat coverage --testfiles "test/OMA3ResolverWithStore.ts" --testfiles "test/OMA3ResolverIntegration.ts"'
    }
];

async function runTests(configName: string): Promise<void> {
    const config = testConfigs.find(c => c.name === configName);
    
    if (!config) {
        console.error(`❌ Unknown test configuration: ${configName}`);
        console.log('\nAvailable configurations:');
        testConfigs.forEach(c => {
            console.log(`  ${c.name.padEnd(12)} - ${c.description}`);
        });
        process.exit(1);
    }

    console.log(`🚀 Running: ${config.description}`);
    console.log(`📝 Command: ${config.command}\n`);

    try {
        const { stdout, stderr } = await execAsync(config.command);
        
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        
        console.log(`✅ Completed: ${config.description}`);
    } catch (error: any) {
        console.error(`❌ Failed: ${config.description}`);
        console.error(error.stdout || error.message);
        process.exit(1);
    }
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('🧪 OMA3ResolverWithStore Test Runner\n');
        console.log('Usage: npx ts-node scripts/run-resolver-tests.ts <config>\n');
        console.log('Available test configurations:');
        testConfigs.forEach(c => {
            console.log(`  ${c.name.padEnd(12)} - ${c.description}`);
        });
        console.log('\nExamples:');
        console.log('  npx ts-node scripts/run-resolver-tests.ts all');
        console.log('  npx ts-node scripts/run-resolver-tests.ts core');
        console.log('  npx ts-node scripts/run-resolver-tests.ts gas');
        return;
    }

    const configName = args[0];
    await runTests(configName);
}

// Handle CLI execution
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Error running tests:', error);
        process.exit(1);
    });
}

export { runTests, testConfigs };
