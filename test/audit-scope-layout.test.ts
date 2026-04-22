import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";

describe("Audit Scope Layout", function () {
  const root = path.resolve(__dirname, "..");
  const contractsDir = path.join(root, "contracts");
  const depsDir = path.join(root, "deps");

  it("keeps contracts grouped by audit domain", function () {
    expect(fs.existsSync(path.join(contractsDir, "identity", "OMA3AppRegistry.sol"))).to.equal(true);
    expect(fs.existsSync(path.join(contractsDir, "identity", "OMA3AppMetadata.sol"))).to.equal(true);
    expect(fs.existsSync(path.join(contractsDir, "identity", "OMA3MetadataKeys.sol"))).to.equal(true);
    expect(fs.existsSync(path.join(contractsDir, "identity", "OMA3ResolverWithStore.sol"))).to.equal(true);
    expect(fs.existsSync(path.join(contractsDir, "reputation", "OMATrustFeeResolver.sol"))).to.equal(true);
  });

  it("keeps vendored dependencies out of contracts", function () {
    expect(fs.existsSync(path.join(depsDir, "eas", "EAS.sol"))).to.equal(true);
    expect(fs.existsSync(path.join(depsDir, "eas", "SchemaRegistry.sol"))).to.equal(true);
    expect(fs.existsSync(path.join(depsDir, "openzeppelin", "TimelockController.sol"))).to.equal(true);
    expect(fs.existsSync(path.join(contractsDir, "deps.sol"))).to.equal(true);

    // Regression guard: old layout should not reappear.
    expect(fs.existsSync(path.join(contractsDir, "eas"))).to.equal(false);
  });
});
