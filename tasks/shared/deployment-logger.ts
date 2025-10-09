import * as fs from 'fs';
import * as path from 'path';

interface DeploymentRecord {
  network: string;
  chainId: number;
  deployer: string;
  registry?: string;
  metadata?: string;
  resolver?: string;
  timestamp: string;
  blockConfirmations: number;
  isSystemDeployment: boolean;
  integrationTestsPassed?: boolean;
  method?: string; // 'Hardhat (SSH Key)' or 'Thirdweb (Server Wallet)'
}

/**
 * Appends a deployment record to contract-addresses.txt and updates the active summary
 */
export async function logDeployment(record: DeploymentRecord): Promise<void> {
  // Use process.cwd() to get the repository root (where hardhat commands are run from)
  const filePath = path.join(process.cwd(), 'contract-addresses.txt');
  
  // Read existing content
  let existingContent = '';
  try {
    existingContent = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.warn('Could not read contract-addresses.txt, will create new file');
  }

  // Count existing deployments to get the next number
  const deploymentMatches = existingContent.match(/=== Deployment #(\d+) ===/g) || [];
  const deploymentNumber = deploymentMatches.length + 1;

  // Determine deployment type
  const deploymentType = record.registry && record.metadata && record.resolver 
    ? 'Full System Deployment' 
    : record.registry ? 'Individual Contract (Registry)'
    : record.metadata ? 'Individual Contract (Metadata)'
    : 'Individual Contract (Resolver)';

  const method = record.method || 'Hardhat (SSH Key)';

  // Format the new entry
  let entry = `\n=== Deployment #${deploymentNumber} ===\n`;
  entry += `Timestamp: ${record.timestamp}\n`;
  entry += `Network: ${record.network} (Chain ID: ${record.chainId})\n`;
  entry += `Type: ${deploymentType}\n`;
  entry += `Method: ${method}\n`;
  entry += `Deployer: ${record.deployer}\n`;
  entry += `\n`;

  entry += `Deployed Contracts:\n`;
  if (record.registry) {
    entry += `  Registry:  ${record.registry}\n`;
  }
  if (record.metadata) {
    entry += `  Metadata:  ${record.metadata}\n`;
  }
  if (record.resolver) {
    entry += `  Resolver:  ${record.resolver}\n`;
  }

  entry += `\nDeployment Details:\n`;
  entry += `  Block Confirmations: ${record.blockConfirmations}\n`;
  if (record.integrationTestsPassed !== undefined) {
    entry += `  Integration Tests: ${record.integrationTestsPassed ? '✅ PASSED' : '❌ FAILED'}\n`;
  }
  entry += `  Verification Status: Pending (run verify commands if supported by explorer)\n`;
  entry += `============================================================================\n`;

  // Append to file
  try {
    fs.appendFileSync(filePath, entry, 'utf-8');
  } catch (error) {
    console.error(`❌ Failed to append deployment record:`, error);
    throw error;
  }
  
  // Update the active deployments summary at the top
  try {
    updateActiveSummary(filePath, record);
  } catch (error) {
    console.warn(`⚠️  Failed to update active deployments summary:`, error);
  }
  
  console.log(`\n✅ Deployment logged to contract-addresses.txt (Deployment #${deploymentNumber})`);
}

/**
 * Updates the "Active Deployments" summary section at the top of the file
 */
function updateActiveSummary(filePath: string, record: DeploymentRecord): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Split into summary section and history section
  const historySeparator = '# 📜 DEPLOYMENT HISTORY';
  const parts = content.split(historySeparator);
  
  if (parts.length !== 2) {
    console.warn('Could not find history separator, skipping summary update');
    return;
  }

  // Determine if this is testnet or production
  const isTestnet = record.network.toLowerCase().includes('testnet') || 
                    record.network === 'localhost' || 
                    record.network === 'hardhat';
  
  const sectionHeader = isTestnet 
    ? '### Testnet ('
    : '### Production (';

  // Find and update the appropriate section
  let summarySection = parts[0];
  const sectionStart = summarySection.indexOf(sectionHeader);
  
  if (sectionStart === -1) {
    console.warn(`Could not find ${isTestnet ? 'testnet' : 'production'} section, skipping summary update`);
    return;
  }

  // Find the end of this section (next ### or end of summary)
  const nextSectionStart = summarySection.indexOf('###', sectionStart + 1);
  const sectionEnd = nextSectionStart === -1 
    ? summarySection.indexOf('# ===', sectionStart)
    : nextSectionStart;

  // Extract existing values so we only update fields we deployed, leaving others intact
  const targetSection = summarySection.substring(sectionStart, sectionEnd);
  const getExisting = (label: string): string | undefined => {
    const m = targetSection.match(new RegExp(`^${label}:\\s+(.*)$`, 'm'));
    return m ? m[1].trim() : undefined;
  };

  const existingRegistry = getExisting('Registry');
  const existingMetadata = getExisting('Metadata');
  const existingResolver = getExisting('Resolver');

  const mergedRegistry = (record.registry !== undefined && record.registry !== '')
    ? record.registry
    : (existingRegistry !== undefined ? existingRegistry : 'Not deployed');

  const mergedMetadata = (record.metadata !== undefined && record.metadata !== '')
    ? record.metadata
    : (existingMetadata !== undefined ? existingMetadata : 'Not deployed');

  const mergedResolver = (record.resolver !== undefined && record.resolver !== '')
    ? record.resolver
    : (existingResolver !== undefined ? existingResolver : 'Not deployed');

  // Build new section content (only the updated lines change)
  let newSection = `${sectionHeader}${record.network})\n`;
  newSection += `Network: ${record.network} (Chain ID: ${record.chainId})\n`;
  newSection += `Last Updated: ${record.timestamp}\n`;
  newSection += `\n`;
  newSection += `Registry:  ${mergedRegistry}\n`;
  newSection += `Metadata:  ${mergedMetadata}\n`;
  newSection += `Resolver:  ${mergedResolver}\n`;
  newSection += `Deployer:  ${record.deployer}\n`;

  // Replace the section
  const beforeSection = summarySection.substring(0, sectionStart);
  const afterSection = summarySection.substring(sectionEnd);
  
  const newContent = beforeSection + newSection + '\n' + afterSection + historySeparator + parts[1];
  
  // Write back to file
  fs.writeFileSync(filePath, newContent, 'utf-8');
}

/**
 * Gets current UTC timestamp in a readable format
 */
export function getTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}
