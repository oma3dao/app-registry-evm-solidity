import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { keccak256, toUtf8Bytes } from "ethers";

/**
 * View attestations in the resolver contract
 * Useful for testing DID verification and debugging
 */
task("resolver-view-attestations", "View attestations in the resolver")
  .addOptionalParam("resolver", "Resolver contract address (optional, uses config if not provided)")
  .addOptionalParam("did", "DID to query (e.g., did:web:example.com or did:pkh:eip155:1:0x...)")
  .addOptionalParam("issuer", "Issuer address to query attestations from")
  .addOptionalParam("type", "owner|datahash|both (default both)", "both")
  .addOptionalParam("datahash", "Specific data hash (0x + 64 hex) to check against the DID")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { did, issuer, type = "both", datahash } = taskArgs;

    console.log("\n📋 Resolver Attestation Viewer");
    console.log("================================\n");

    // Get resolver address
    const resolverAddress = taskArgs.resolver || getNetworkContractAddress(hre, "resolver");
    console.log(`Network: ${hre.network.name}`);
    console.log(`Resolver: ${resolverAddress}\n`);

    // Get resolver contract
    const Resolver = await hre.ethers.getContractAt(
      "OMA3ResolverWithStore",
      resolverAddress
    );

    // Get list of authorized issuers
    const authorizedIssuers = await getAuthorizedIssuers(Resolver);
    
    if (authorizedIssuers.length === 0) {
      console.log("⚠️  No authorized issuers found in resolver");
      return;
    }

    console.log(`Authorized Issuers (${authorizedIssuers.length}):`);
    authorizedIssuers.forEach((addr, i) => {
      console.log(`  ${i + 1}. ${addr}`);
    });
    console.log();

    // Query based on parameters
    if (did) {
      const mode = String(type).toLowerCase();
      const didHashHex = keccak256(toUtf8Bytes(did));
      console.log(`DID: ${did}`);
      console.log(`didHash: ${didHashHex}`);
      if (datahash) {
        console.log(`dataHash (arg): ${datahash}`);
      }
      console.log();

      if (mode === "owner" || mode === "both") {
        await viewAttestationsByDid(Resolver, did, authorizedIssuers, issuer);
      }
      if (mode === "datahash" || mode === "both") {
        await viewDataHashAttestationsByDid(Resolver, did, authorizedIssuers, datahash, issuer);
      }
    } else if (issuer) {
      await viewAttestationsByIssuer(Resolver, issuer);
    } else {
      console.log("ℹ️  Usage:");
      console.log("  View attestations by DID:");
      console.log("    npx hardhat resolver-view-attestations --network omachainTestnet --did 'did:web:example.com'");
      console.log();
      console.log("  View only data hash attestations by DID (and optional datahash filter):");
      console.log("    npx hardhat resolver-view-attestations --network omachainTestnet --did 'did:web:example.com' --type datahash --datahash 0x...");
      console.log();
      console.log("  View attestations by issuer:");
      console.log("    npx hardhat resolver-view-attestations --network omachainTestnet --issuer 0x...");
      console.log();
      console.log("  View attestations by DID from specific issuer:");
      console.log("    npx hardhat resolver-view-attestations --network omachainTestnet --did 'did:web:example.com' --issuer 0x...");
    }
  });

/**
 * Get list of authorized issuers by checking events
 */
async function getAuthorizedIssuers(resolver: any): Promise<string[]> {
  const issuers: Set<string> = new Set();
  
  // Get IssuerAuthorized events
  const authorizedFilter = resolver.filters.IssuerAuthorized();
  const authorizedEvents = await resolver.queryFilter(authorizedFilter);
  
  // Get IssuerRevoked events
  const revokedFilter = resolver.filters.IssuerRevoked();
  const revokedEvents = await resolver.queryFilter(revokedFilter);
  
  // Build set of currently authorized issuers
  for (const event of authorizedEvents) {
    const issuerAddr = event.args?.[0];
    if (issuerAddr) {
      // Double-check with contract state
      const isAuthorized = await resolver.isIssuer(issuerAddr);
      if (isAuthorized) {
        issuers.add(issuerAddr);
      }
    }
  }
  
  // Remove revoked issuers
  for (const event of revokedEvents) {
    const issuerAddr = event.args?.[0];
    if (issuerAddr) {
      issuers.delete(issuerAddr);
    }
  }
  
  return Array.from(issuers);
}

/**
 * View attestations for a specific DID
 */
async function viewAttestationsByDid(
  resolver: any,
  did: string,
  authorizedIssuers: string[],
  specificIssuer?: string
) {
  console.log(`🔍 Querying attestations for DID: ${did}\n`);
  
  // Hash the DID
  const didHash = keccak256(toUtf8Bytes(did));
  console.log(`DID Hash: ${didHash}\n`);
  
  // Query current owner via resolver logic
  try {
    const currentOwner = await resolver.currentOwner(didHash);
    if (currentOwner !== "0x0000000000000000000000000000000000000000") {
      console.log(`✅ Current Resolved Owner: ${currentOwner}`);
      console.log(`   (After maturation period and conflict resolution)\n`);
    } else {
      console.log(`❌ No current owner resolved\n`);
    }
  } catch (error) {
    console.log(`⚠️  Error resolving current owner: ${(error as Error).message}\n`);
  }
  
  // Filter issuers if specified
  const issuersToQuery = specificIssuer
    ? authorizedIssuers.filter(addr => addr.toLowerCase() === specificIssuer.toLowerCase())
    : authorizedIssuers;
  
  if (issuersToQuery.length === 0) {
    console.log(`⚠️  Issuer ${specificIssuer} not found in authorized list`);
    return;
  }
  
  // Query each issuer
  let foundAny = false;
  for (const issuerAddr of issuersToQuery) {
    try {
      const entry = await resolver.get(issuerAddr, didHash);
      
      if (entry.active || entry.recordedAt > 0n) {
        foundAny = true;
        console.log(`📝 Attestation from: ${issuerAddr}`);
        console.log(`   Status: ${entry.active ? "✅ Active" : "❌ Revoked"}`);
        
        if (entry.active) {
          // Convert bytes32 to address
          const controllerAddr = "0x" + entry.controllerAddress.slice(26);
          console.log(`   Controller: ${controllerAddr}`);
          console.log(`   Recorded: ${new Date(Number(entry.recordedAt) * 1000).toISOString()}`);
          console.log(`   Block: ${entry.recordedBlock}`);
          
          if (entry.expiresAt > 0n) {
            const expiresDate = new Date(Number(entry.expiresAt) * 1000);
            const isExpired = Date.now() > expiresDate.getTime();
            console.log(`   Expires: ${expiresDate.toISOString()} ${isExpired ? "⚠️ EXPIRED" : ""}`);
          } else {
            console.log(`   Expires: Never (permanent)`);
          }
        } else {
          console.log(`   Revoked at: ${new Date(Number(entry.recordedAt) * 1000).toISOString()}`);
          console.log(`   Block: ${entry.recordedBlock}`);
        }
        console.log();
      }
    } catch (error) {
      console.log(`⚠️  Error querying issuer ${issuerAddr}: ${(error as Error).message}\n`);
    }
  }
  
  if (!foundAny) {
    console.log(`ℹ️  No attestations found for this DID`);
  }
}

/**
 * View data hash attestations for a specific DID (optionally filtered by dataHash and issuer)
 */
async function viewDataHashAttestationsByDid(
  resolver: any,
  did: string,
  authorizedIssuers: string[],
  dataHash?: string,
  specificIssuer?: string
) {
  console.log(`🔍 Querying DATA HASH attestations for DID: ${did}`);
  const didHash = keccak256(toUtf8Bytes(did));
  console.log(`DID Hash: ${didHash}`);
  if (dataHash) console.log(`Filter dataHash: ${dataHash}`);
  console.log();

  // Build issuer set
  const issuersToQuery = specificIssuer
    ? authorizedIssuers.filter(addr => addr.toLowerCase() === String(specificIssuer).toLowerCase())
    : authorizedIssuers;
  if (issuersToQuery.length === 0) {
    console.log(`⚠️  Issuer ${specificIssuer} not found in authorized list`);
    return;
  }

  // Try direct query via getDataEntry if dataHash provided
  if (dataHash) {
    let any = false;
    for (const issuerAddr of issuersToQuery) {
      try {
        const entry = await resolver.getDataEntry(issuerAddr, didHash, dataHash);
        const active = Boolean(entry.active);
        const recordedAt = Number(entry.recordedAt || 0n);
        const recordedBlock = entry.recordedBlock;
        const expiresAt = Number(entry.expiresAt || 0n);
        if (active || recordedAt > 0) {
          any = true;
          console.log(`📝 DataHash attestation from: ${issuerAddr}`);
          console.log(`   Status: ${active ? "✅ Active" : "❌ Inactive"}`);
          console.log(`   DataHash: ${dataHash}`);
          if (recordedAt) console.log(`   Recorded: ${new Date(recordedAt * 1000).toISOString()} (block ${recordedBlock})`);
          if (expiresAt) {
            const exp = new Date(expiresAt * 1000);
            console.log(`   Expires: ${exp.toISOString()}${Date.now() > exp.getTime() ? " ⚠️ EXPIRED" : ""}`);
          } else {
            console.log(`   Expires: Never`);
          }
          console.log();
        }
      } catch (err) {
        console.log(`⚠️  Error querying issuer ${issuerAddr}: ${(err as Error).message}`);
      }
    }
    if (!any) console.log("ℹ️  No datahash attestations found for this DID/hash\n");
  }

  // Enumerate via events (show all known data hashes for this DID)
  try {
    const attestedFilter = resolver.filters.DataHashAttested();
    const revokedFilter = resolver.filters.DataHashRevoked();
    const attestedEvents = await resolver.queryFilter(attestedFilter);
    const revokedEvents = await resolver.queryFilter(revokedFilter);

    // Build map: (issuer, didHash, dataHash) -> latest active state
    type Key = string;
    const key = (iss: string, dh: string, h: string): Key => `${iss.toLowerCase()}|${dh.toLowerCase()}|${h.toLowerCase()}`;
    const entries = new Map<Key, { issuer: string; didHash: string; dataHash: string; recordedAt: number; block: bigint; active: boolean; expiresAt: number }>();

    for (const e of attestedEvents) {
      const iss = String(e.args?.[0]);
      const dh = String(e.args?.[1]);
      const h = String(e.args?.[2]);
      const exp = Number(e.args?.[3] || 0n);
      const rec = Number(e.args?.[4] || 0n);
      const blk = e.args?.[5] as bigint;
      if (dh.toLowerCase() !== didHash.toLowerCase()) continue;
      if (!issuersToQuery.some(a => a.toLowerCase() === iss.toLowerCase())) continue;
      if (dataHash && h.toLowerCase() !== dataHash.toLowerCase()) continue;
      entries.set(key(iss, dh, h), { issuer: iss, didHash: dh, dataHash: h, recordedAt: rec, block: blk, active: true, expiresAt: exp });
    }
    for (const e of revokedEvents) {
      const iss = String(e.args?.[0]);
      const dh = String(e.args?.[1]);
      const h = String(e.args?.[2]);
      const rec = Number(e.args?.[3] || 0n);
      const blk = e.args?.[4] as bigint;
      if (dh.toLowerCase() !== didHash.toLowerCase()) continue;
      if (!issuersToQuery.some(a => a.toLowerCase() === iss.toLowerCase())) continue;
      if (dataHash && h.toLowerCase() !== dataHash.toLowerCase()) continue;
      entries.set(key(iss, dh, h), { issuer: iss, didHash: dh, dataHash: h, recordedAt: rec, block: blk, active: false, expiresAt: 0 });
    }

    if (entries.size === 0) {
      console.log("ℹ️  No data hash attested events found for this DID");
      return;
    }

    console.log(`🧾 Data Hash Attestations (${entries.size} entries):`);
    for (const { issuer: iss, dataHash: h, recordedAt: rec, block: blk, active, expiresAt: exp } of entries.values()) {
      console.log(`  Issuer:   ${iss}`);
      console.log(`  DataHash: ${h}`);
      if (rec) console.log(`  Recorded: ${new Date(rec * 1000).toISOString()} (block ${blk})`);
      if (exp) {
        const d = new Date(exp * 1000);
        console.log(`  Expires:  ${d.toISOString()}${Date.now() > d.getTime() ? " ⚠️ EXPIRED" : ""}`);
      } else {
        console.log(`  Expires:  Never`);
      }
      console.log(`  Status:   ${active ? "✅ Active" : "❌ Revoked"}`);
      console.log();
    }
  } catch (err) {
    console.log(`⚠️  Error fetching data hash events: ${(err as Error).message}`);
  }
}

/**
 * View all attestations from a specific issuer
 * Note: This can only show attestations we know about via events
 */
async function viewAttestationsByIssuer(resolver: any, issuerAddr: string) {
  console.log(`🔍 Querying attestations from issuer: ${issuerAddr}\n`);
  
  // Check if issuer is authorized
  const isAuthorized = await resolver.isIssuer(issuerAddr);
  console.log(`Issuer Status: ${isAuthorized ? "✅ Authorized" : "❌ Not Authorized"}\n`);
  
  // Get Upsert events for this issuer
  const upsertFilter = resolver.filters.Upsert(issuerAddr);
  const upsertEvents = await resolver.queryFilter(upsertFilter);
  
  // Get Revoke events for this issuer
  const revokeFilter = resolver.filters.Revoke(issuerAddr);
  const revokeEvents = await resolver.queryFilter(revokeFilter);
  
  if (upsertEvents.length === 0 && revokeEvents.length === 0) {
    console.log(`ℹ️  No attestations found from this issuer`);
    return;
  }
  
  console.log(`Found ${upsertEvents.length} upsert(s) and ${revokeEvents.length} revoke(s)\n`);
  
  // Show upsert events
  if (upsertEvents.length > 0) {
    console.log("📝 Upsert Events:");
    for (const event of upsertEvents) {
      const didHash = event.args?.[1];
      const controllerAddress = event.args?.[2];
      const expiresAt = event.args?.[3];
      const recordedAt = event.args?.[4];
      const recordedBlock = event.args?.[5];
      
      // Convert bytes32 to address
      const controllerAddr = "0x" + controllerAddress.slice(26);
      
      console.log(`  DID Hash: ${didHash}`);
      console.log(`  Controller: ${controllerAddr}`);
      console.log(`  Recorded: ${new Date(Number(recordedAt) * 1000).toISOString()} (block ${recordedBlock})`);
      
      if (expiresAt > 0n) {
        const expiresDate = new Date(Number(expiresAt) * 1000);
        const isExpired = Date.now() > expiresDate.getTime();
        console.log(`  Expires: ${expiresDate.toISOString()} ${isExpired ? "⚠️ EXPIRED" : ""}`);
      } else {
        console.log(`  Expires: Never`);
      }
      
      // Check current status
      const entry = await resolver.get(issuerAddr, didHash);
      console.log(`  Current Status: ${entry.active ? "✅ Active" : "❌ Revoked"}`);
      console.log();
    }
  }
  
  // Show revoke events
  if (revokeEvents.length > 0) {
    console.log("❌ Revoke Events:");
    for (const event of revokeEvents) {
      const didHash = event.args?.[1];
      const recordedAt = event.args?.[2];
      const recordedBlock = event.args?.[3];
      
      console.log(`  DID Hash: ${didHash}`);
      console.log(`  Revoked: ${new Date(Number(recordedAt) * 1000).toISOString()} (block ${recordedBlock})`);
      console.log();
    }
  }
}
