const Dex = artifacts.require("Dex");
const Link = artifacts.require("Link");
const truffleAssert = require("truffle-assertions");

contract("Dex", (accounts) => {
	it("should only be possible for owner to add token", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		// dex.addToken(web3.utils.fromUtf8("LINK"), link.address);
		// await dex.deposit(web3.utils.fromUtf8("LINK"), 100);

		await truffleAssert.passes(
			dex.addToken(web3.utils.fromUtf8("LINK"), Link.address, {
				from: accounts[0]
			})
		);

		await truffleAssert.reverts(
			dex.addToken(web3.utils.fromUtf8("AAVE"), Link.address, {
				from: accounts[1]
			})
		);
	});

	it("should handle deposits correctly", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		await link.approve(dex.address, 500);
		await dex.deposit(web3.utils.fromUtf8("LINK"), 100);

		let balance = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"));
		assert.equal(balance.toNumber(), 100);
	});

	it("should handle faulty withdrawals correctly", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		await truffleAssert.reverts(dex.withdrawal(web3.utils.fromUtf8("LINK"), 150));
	});

	it("should handle faulty withdrawals correctly", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		await truffleAssert.passes(dex.withdrawal(web3.utils.fromUtf8("LINK"), 50));
	});
});
