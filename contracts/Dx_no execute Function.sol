// SPDX-License-Identifier: Undefined

pragma solidity 0.8.6;
pragma experimental ABIEncoderV2;

import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../contracts/Wallet.sol";

contract Dex_NoExecuteFunction is Wallet {
	// Dex.defaults = ({gasPrice: 0,})

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
		checkBalance(msg.sender, orderSide, _ticker, _price, _amount);

		Order[] storage orders = Orderbook[_ticker][uint256(orderSide)];
		orders.push(Order(nextOrderId, msg.sender, orderSide, _ticker, _amount, _price, 0));
		uint256 i = orders.length > 0 ? orders.length - 1 : 0;

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

	function executeOrder(
		side orderSide,
		bytes32 _ticker,
		Order[] storage orders,
		uint256 _amount,
		uint256 i
	) private {
		uint256 cost = _amount.mul(orders[i].price);
		if (orderSide == side.BUY) {
			balances[orders[i].traderAddress][_ticker] = balances[orders[i].traderAddress][_ticker].sub(_amount); // remove ERC20 Token from  order on sell side address

			balances[orders[i].traderAddress]["ETH"] = balances[orders[i].traderAddress]["ETH"].add(cost); //  add ETH to seller address

			balances[msg.sender][_ticker] = balances[msg.sender][_ticker].add(_amount); // add ERC20 Token to buyer address
			balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].sub(cost); // remove ETH from  buyer side address
		}
		if (orderSide == side.SELL) {
			// remove ETH from  order on buyer side address
			balances[orders[i].traderAddress]["ETH"] = balances[orders[i].traderAddress]["ETH"].sub(cost);

			//  add erc20 Token to buyer address
			balances[orders[i].traderAddress][_ticker] = balances[orders[i].traderAddress][_ticker].add(_amount);

			// add ETH to seller address
			balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].add(cost);
			// remove erc20 Token from   side address
			balances[msg.sender][_ticker] = balances[msg.sender][_ticker].sub(_amount);
		}
	}

	event ExecuteOrder(side orderSide, bytes32 _ticker, Order[] orders, uint256 _amount, uint256 i, string message);

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
			// require that there is enough eth for the transaction
			uint256 orderBookTotal;
			uint256 currentOrderTotal;
			uint256 orderLeftToFill = _amount;

			orders = Orderbook[_ticker][marketOrderSide];

			for (uint256 i = 0; i < orders.length && totalFilled < _amount; i++) {
				uint256 availableToFill = orders[i].amount - orders[i].filled;

				if (orderLeftToFill > availableToFill) {
					currentOrderTotal = (availableToFill).mul(orders[i].price);
					orderBookTotal = orderBookTotal.add(currentOrderTotal);
					totalFilled = totalFilled.add(availableToFill);
					orderLeftToFill = orderLeftToFill.sub(availableToFill);
				} else {
					currentOrderTotal = (orders[i].price).mul(orderLeftToFill);
					orderBookTotal = orderBookTotal.add(currentOrderTotal);
					totalFilled = totalFilled.add(orderLeftToFill);
					break;
				}
			}
			require(balances[msg.sender]["ETH"] > orderBookTotal, "NOT ENOUGH ETH!!!!");
		} else {
			// if sell order
			require(balances[msg.sender][_ticker] >= _amount, "ERC20 Token balance too low!!");
			marketOrderSide = 0;
			//   orders = Orderbook[_ticker][marketOrderSide];
			//   require(
			//     balances[msg.sender][_ticker] > _amount,
			//     "ERC20 Token balance too low!!"
			//   );
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

			uint256 cost = filled.mul(orders[i].price);

			if (orderSide == side.BUY) {
				// require(balances[msg.sender]["ETH"] >= cost, "NOT ENOUGH ETH!!!!");
				balances[orders[i].traderAddress][_ticker] = balances[orders[i].traderAddress][_ticker].sub(filled);
				balances[orders[i].traderAddress]["ETH"] = balances[orders[i].traderAddress]["ETH"].add(cost);

				balances[msg.sender][_ticker] = balances[msg.sender][_ticker].add(filled);
				balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].sub(cost);
			}

			if (orderSide == side.SELL) {
				balances[orders[i].traderAddress]["ETH"] = balances[orders[i].traderAddress]["ETH"].sub(cost);
				balances[orders[i].traderAddress][_ticker] = balances[orders[i].traderAddress][_ticker].add(filled);

				balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].add(cost);
				balances[msg.sender][_ticker] = balances[msg.sender][_ticker].sub(filled);
			}
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
