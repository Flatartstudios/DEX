// SPDX-License-Identifier: Undefined

pragma solidity 0.8.6;
pragma experimental ABIEncoderV2;

import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../contracts/Wallet.sol";

contract Dex is Wallet {
	using SafeMath for uint256;

	enum side {
		BUY,
		SELL
	}

	struct Order {
		uint256 id;
		address traderAddress;
		side orderSide;
		bytes32 ticker;
		uint256 amount;
		uint256 price;
		uint256 filled;
	}

	mapping(bytes32 => mapping(uint256 => Order[])) Orderbook;

	uint256 nextOrderId = 0;

	function getOrderbook(bytes32 _ticker, side orderSide) public view returns (Order[] memory) {
		return Orderbook[_ticker][uint256(orderSide)];
	}

	function checkBalance(
		address _trader,
		side orderSide,
		bytes32 _ticker,
		uint256 _price,
		uint256 _amount
	) public view {
		if (orderSide == side.BUY) {
			require(balances[_trader]["ETH"] >= _amount.mul(_price), "Your ETH Balance is too low");
		} else if (orderSide == side.SELL) {
			require(balances[_trader][_ticker] >= _amount, " Your ERC20 Token Balance too low");
		}
	}

	function createLimitOrder(
		side orderSide,
		bytes32 _ticker,
		uint256 _price,
		uint256 _amount
	) public {
		checkBalance(msg.sender, orderSide, _ticker, _price, _amount); // check that there is enough balance to place the limit order

		uint256 marketSide; // create variable to use to get opposite side orderbook

		if (orderSide == side.BUY) {
			marketSide = 1;
		} else {
			marketSide = 0;
		}

		Order[] storage oppositeOrderBook = Orderbook[_ticker][marketSide];

		uint256 i = 0;
		uint256 totalFilled = 0;
		uint256 leftToFill = _amount;

		//  execute order if it matches the opposite orderbook

		while (oppositeOrderBook.length != 0 && i < oppositeOrderBook.length - 1 && oppositeOrderBook[i].price == _price && totalFilled < _amount) {
			leftToFill = _amount.sub(totalFilled);
			uint256 availableToFill = oppositeOrderBook[i].amount.sub(oppositeOrderBook[i].filled);
			uint256 filled;

			if (leftToFill < availableToFill) {
				filled = leftToFill;
			} else {
				filled = availableToFill;
			}

			oppositeOrderBook[i].filled = oppositeOrderBook[i].filled.add(filled);
			totalFilled = totalFilled.add(filled);

			executeOrder(orderSide, _ticker, oppositeOrderBook[i].traderAddress, filled, oppositeOrderBook[i].price);
			i++;
		}

		while (oppositeOrderBook.length > 0 && oppositeOrderBook[0].filled == oppositeOrderBook[0].amount) {
			// if the order is filled remove the order for the orderbook

			for (uint256 j = 0; j < oppositeOrderBook.length - 1; j++) {
				oppositeOrderBook[j] = oppositeOrderBook[j + 1];
			}

			oppositeOrderBook.pop();
		}

		if (leftToFill != 0) {
			//  if either the new limit order does not match or partly match a current order then add the limit order to the opposite orderbook

			Order[] storage orders = Orderbook[_ticker][uint256(orderSide)];

			orders.push(Order(nextOrderId, msg.sender, orderSide, _ticker, leftToFill, _price, 0));
			i = orders.length > 0 ? orders.length - 1 : 0;

			if (orderSide == side.BUY) {
				while (i > 0) {
					if (orders[i].price < orders[i - 1].price) {
						break;
					}
					Order memory orderToMove = orders[i];
					orders[i] = orders[i - 1];
					orders[i - 1] = orderToMove;
					i--;
				}
			} else if (orderSide == side.SELL) {
				while (i > 0) {
					if (orders[i - 1].price < orders[i].price) {
						break;
					}
					Order memory orderToMove = orders[i - 1];
					orders[i - 1] = orders[i];
					orders[i] = orderToMove;
					i--;
				}
			}
			nextOrderId++;
		}
	}

	function executeOrder(
		side orderSide,
		bytes32 _ticker,
		address traderAddress,
		uint256 _amount,
		uint256 price
	) private {
		uint256 cost = _amount.mul(price);

		if (orderSide == side.BUY) {
			checkBalance(msg.sender, orderSide, _ticker, price, _amount);
			balances[traderAddress][_ticker] = balances[traderAddress][_ticker].sub(_amount); // remove ERC20 Token from  order on sell side address
			balances[traderAddress]["ETH"] = balances[traderAddress]["ETH"].add(cost); //  add ETH to seller address
			balances[msg.sender][_ticker] = balances[msg.sender][_ticker].add(_amount); // add ERC20 Token to buyer address
			balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].sub(cost); // remove ETH from  buyer side address
		}
		if (orderSide == side.SELL) {
			checkBalance(msg.sender, orderSide, _ticker, price, _amount);
			balances[traderAddress]["ETH"] = balances[traderAddress]["ETH"].sub(cost); // remove ETH from  order on buyer side address
			balances[traderAddress][_ticker] = balances[traderAddress][_ticker].add(_amount); //  add erc20 Token to buyer address
			balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].add(cost); // add ETH to seller address
			balances[msg.sender][_ticker] = balances[msg.sender][_ticker].sub(_amount); // remove erc20 Token from   side address
		}
	}

	function marketOrder(
		side orderSide,
		bytes32 _ticker,
		uint256 _amount
	) public {
		uint256 marketOrderSide;
		uint256 totalFilled = 0;
		Order[] storage orders;

		if (orderSide == side.BUY) {
			marketOrderSide = 1;
		} else {
			// if sell order
			require(balances[msg.sender][_ticker] >= _amount, "ERC20 Token balance too low!!");
			marketOrderSide = 0;
		}
		orders = Orderbook[_ticker][marketOrderSide];
		totalFilled = 0;

		for (uint256 i = 0; i < orders.length && totalFilled < _amount; i++) {
			uint256 leftToFill = _amount.sub(totalFilled);
			uint256 availableToFill = orders[i].amount.sub(orders[i].filled);
			uint256 filled;

			if (leftToFill < availableToFill) {
				filled = leftToFill;
			} else {
				filled = availableToFill;
			}

			orders[i].filled = orders[i].filled.add(filled);
			totalFilled = totalFilled.add(filled);

			executeOrder(orderSide, _ticker, orders[i].traderAddress, filled, orders[i].price);
		}

		while (orders.length > 0 && orders[0].filled == orders[0].amount) {
			// if the order is filled remove the order for the orderbook

			for (uint256 j = 0; j < orders.length - 1; j++) {
				orders[j] = orders[j + 1];
			}

			orders.pop();
		}
	}
}
