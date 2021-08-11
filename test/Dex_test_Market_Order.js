const Dex = artifacts.require("Dex");
const Link = artifacts.require("Link");
const truffleAssert = require("truffle-assertions");

contract("Dex", (accounts) => {
	//  MARKET ORDER TESTS

	//  when creating a SELL market order, the seller needs to have enough tokens for the trade

	it("when creating a SELL market order, the seller needs to have enough token for the trade", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		let balance = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"));

		assert.equal(balance.toNumber(), 0, "Initial LINK BALANCE IS NOT 0!");

		await truffleAssert.reverts(dex.marketOrder(1, web3.utils.fromUtf8("LINK"), 10));
	});

	//  MArket order can  be submitted even if the orderbook is empty

	it("should allow a market order even if orderbook even if it is empty", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		await dex.depositETH({value: 3000});
		await dex.addToken(web3.utils.fromUtf8("LINK"), Link.address, {
			from: accounts[0]
		});

		let orderBook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 0);
		console.log(orderBook.length);
		assert(orderBook.length == 0);

		await truffleAssert.passes(dex.marketOrder(0, web3.utils.fromUtf8("LINK"), 10));
	});

	//  If there is enough liquidity, mArket orders should be filled until orderbook is empty or the market order is filled 100%

	it("Market orders should not fill more than limit order amount", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		await dex.depositETH({value: 300000});
		await dex.addToken(web3.utils.fromUtf8("LINK"), link.address, {
			from: accounts[0]
		});

		let orderBook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1); // Sell orderBook
		assert(orderBook.length == 0, "Sell order book should be empty at start of test");
		console.log(orderBook.length);
		//  add LINK tokens from msg.sender or accounts[0] which minted 1000 LINK to  these accounts
		// balanceToken = await dex.link.balanceOf(msg.sender);
		// console.log(balanceToken);
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
		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 400, 5, {
			from: accounts[2]
		});
		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 500, 5, {
			from: accounts[3]
		});

		// orderBook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1);
		// console.log(orderBook);

		await dex.marketOrder(0, web3.utils.fromUtf8("LINK"), 10); ///////

		orderBook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1);
		console.log(orderBook);

		assert(orderBook.length == 1, "Sell side orderbook should only have 1 order left");
		assert(orderBook[0].filled == 0, "Sell side order number[0] should have 0 filled");
	});

	//  The ETH balance of the buyer should decrease with filled amount
	it("Market orders should be filled until orderbook is empty ", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 300, 5, {
			from: accounts[1]
		});
		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 400, 5, {
			from: accounts[2]
		});

		// check buyer "LINK" balance

		let balanceBefore = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"));

		await dex.marketOrder(0, web3.utils.fromUtf8("LINK"), 20);

		let balanceAfter = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"));

		assert.equal(balanceBefore.toNumber() + 15, balanceAfter.toNumber());
		orderBook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1);
		console.log(orderBook);
		assert.equal(orderBook.length, 0);
	});
	//  The ETH balance of the buyer should decrease with filled amount
	it("The ETH balance of the buyer should decrease with filled amount ", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		// seller deposits link and creates sell order
		await link.approve(dex.address, 50, {from: accounts[1]});
		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 300, 1, {
			from: accounts[1]
		});

		// Eth balances before the trade

		let balanceBefore = await dex.balances(accounts[0], web3.utils.fromUtf8("ETH"));

		await dex.marketOrder(0, web3.utils.fromUtf8("LINK"), 1);

		let balanceAfter = await dex.balances(accounts[0], web3.utils.fromUtf8("ETH"));

		assert.equal(balanceBefore.toNumber() - 300, balanceAfter.toNumber());
	});

	//The token balances of the limit order sellers should decrease with the filled amounts.
	it("The token balances of the limit order sellers should decrease with the filled amounts.", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		let orderbook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook
		assert(orderbook.length == 0, "Sell side Orderbook should be empty at start of test");

		//Seller Account[2] deposits link
		await link.approve(dex.address, 500, {from: accounts[2]});
		await dex.deposit(web3.utils.fromUtf8("LINK"), 100, {from: accounts[2]});

		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 300, 1, {
			from: accounts[1]
		});
		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 400, 1, {
			from: accounts[2]
		});

		//Check sellers Link balances before trade
		let account1balanceBefore = await dex.balances(accounts[1], web3.utils.fromUtf8("LINK"));
		let account2balanceBefore = await dex.balances(accounts[2], web3.utils.fromUtf8("LINK"));

		//Account[0] created market order to buy up both sell orders
		await dex.marketOrder(0, web3.utils.fromUtf8("LINK"), 2);

		//Check sellers Link balances after trade
		let account1balanceAfter = await dex.balances(accounts[1], web3.utils.fromUtf8("LINK"));
		let account2balanceAfter = await dex.balances(accounts[2], web3.utils.fromUtf8("LINK"));

		assert.equal(account1balanceBefore.toNumber() - 1, account1balanceAfter.toNumber());
		assert.equal(account2balanceBefore.toNumber() - 1, account2balanceAfter.toNumber());
	});

	it("Filled limit orders should be removed from the orderbook", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();
		await dex.addToken(web3.utils.fromUtf8("LINK"), link.address);

		//Seller deposits link and creates a sell limit order for 1 link for 300 wei
		await link.approve(dex.address, 500);
		await dex.deposit(web3.utils.fromUtf8("LINK"), 100);

		await dex.depositETH({value: 10000});

		let orderbook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook

		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 300, 1);
		await dex.marketOrder(0, web3.utils.fromUtf8("LINK"), 1);

		orderbook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook
		assert(orderbook.length == 0, "Sell side Orderbook should be empty after trade");
	});

	//Partly filled limit orders should be modified to represent the filled/remaining amount
	it("Limit orders filled property should be set correctly after a trade", async () => {
		let dex = await Dex.deployed();
		let link = await Link.deployed();

		let orderbook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook
		assert(orderbook.length == 0, "Sell side Orderbook should be empty at start of test");

		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 300, 5, {
			from: accounts[1]
		});
		await dex.marketOrder(0, web3.utils.fromUtf8("LINK"), 2);

		orderbook = await dex.getOrderbook(web3.utils.fromUtf8("LINK"), 1); //Get sell side orderbook
		assert.equal(orderbook[0].filled, 2);
		assert.equal(orderbook[0].amount, 5);
	});
	//When creating a BUY market order, the buyer needs to have enough ETH for the trade
	it("Should throw an error when creating a buy market order without adequate ETH balance", async () => {
		let dex = await Dex.deployed();

		let balance = await dex.balances(accounts[4], web3.utils.fromUtf8("ETH"));
		assert.equal(balance.toNumber(), 0, "Initial ETH balance is not 0");
		await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 300, 5, {
			from: accounts[1]
		});

		await truffleAssert.reverts(
			dex.marketOrder(0, web3.utils.fromUtf8("LINK"), 5, {
				from: accounts[4]
			})
		);
	});

	//  The Token balance of the limit orders sellers should decrease with filled amount
});
