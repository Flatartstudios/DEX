const Dex = artifacts.require("Dex");
const Link = artifacts.require("Link");
const truffleAssert = require("truffle-assertions");

contract("Dex", (accounts) => {
	it("should throw an error if ETH balance is  too low to create limit order", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		await dex.addEthToken();
		await truffleAssert.reverts(dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 10, 1));

		await dex.depositETH({value: 3000});

		await truffleAssert.passes(dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 10, 1));
	});

	it("should throw an error if Token balance is  too low to create limit sell order", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		await truffleAssert.reverts(dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 100, 1));

		await dex.addToken(web3.utils.fromUtf8("LINK"), Link.address, {
			from: accounts[0]
		});

		await link.approve(dex.address, 500);
		await dex.deposit(web3.utils.fromUtf8("LINK"), 200);
		await truffleAssert.passes(dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 100, 1));
	});

	it("if limitorder = to a opposite order that order must be removed or partially filled", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		await dex.depositETH({value: 300000});
		await dex.addToken(web3.utils.fromUtf8("LINK"), link.address, {
			from: accounts[0]
		});

		let orderBook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1); // Sell orderBook
		// assert(orderBook.length == 0, "Sell order book should be empty at start of test");
		// console.log(orderBook.length);
		//  add LINK tokens from msg.sender or accounts[0] which minted 1000 LINK to  these accounts

		await link.transfer(accounts[1], 150);
		await link.transfer(accounts[2], 150);
		await link.transfer(accounts[3], 150);

		//  approve from each acount that the DEX can spend 50 link each
		await link.approve(dex.address, 50, {from: accounts[1]});
		await link.approve(dex.address, 50, {from: accounts[2]});
		await link.approve(dex.address, 50, {from: accounts[3]});
		//  the DEX now deposit 50 each from the LINK ERC20 contract of each of the accounts
		await dex.deposit(web3.utils.fromUtf8("LINK"), 50, {from: accounts[1]});
		await dex.deposit(web3.utils.fromUtf8("LINK"), 50, {from: accounts[2]});
		await dex.deposit(web3.utils.fromUtf8("LINK"), 50, {from: accounts[3]});

		// fill orderbook
		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 300, 5, {
			from: accounts[1]
		});
		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 300, 5, {
			from: accounts[2]
		});
		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 500, 5, {
			from: accounts[3]
		});
		orderBook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1);
		let lengthbefore = orderBook.length;
		console.log(lengthbefore);
		// sellOrderBefore = orderBook[2].amount;

		await dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 300, 4);
		orderBook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1);
		let lengthAfter = orderBook.length;
		console.log(lengthAfter);
		console.log(orderBook);
		// sellOrderAfter = orderBook[1].amount;

		assert.equal(lengthbefore, lengthAfter);
		// assert.equal(sellOrderBefore.toNumber - 1, sellOrderBefore);
	});

	it("Buy order book must be ordered from high to low starting at index[0]", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		await dex.depositETH({value: 3000});
		await link.approve(dex.address, 1000);

		await dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 300, 1);
		await dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 100, 1);
		await dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 200, 1);
		await dex.createLimitOrder(0, web3.utils.fromUtf8("LINK"), 350, 1);

		let orderBook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 0);
		console.log(orderBook);

		assert(orderBook.length > 0, "Orderbook Empty");

		for (let count = 0; count < orderBook.length - 1; count++) {
			assert(orderBook[count].price >= orderBook[count + 1].price, "NOT IN RIGHT ORDER!");
		}
	});

	it("Sell order book must be ordered from  low to high startin at index[0]", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		// await dex.addEthToken();
		await dex.addToken(web3.utils.fromUtf8("LINK"), Link.address, {
			from: accounts[0]
		});

		await dex.depositETH({value: 300000});
		await link.approve(dex.address, 700);
		await dex.deposit(web3.utils.fromUtf8("LINK"), 700);

		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 100, 1);
		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 300, 1);
		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 200, 1);

		let orderBook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1);
		console.log(orderBook);

		assert(orderBook.length > 0);

		for (let count = 0; count < orderBook.length - 1; count++) {
			assert(orderBook[count].price <= orderBook[count + 1].price, "NOT IN RIGHT ORDER!");
		}
	});
});
