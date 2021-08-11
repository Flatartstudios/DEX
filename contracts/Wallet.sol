// SPDX-License-Identifier: Undefined

pragma solidity >=0.4.22 <0.9.0;

import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../node_modules/@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

contract Wallet is Ownable {
	using SafeMath for uint256;

	struct Token {
		bytes32 ticker;
		address tokenAddress;
	}

	mapping(bytes32 => Token) public tokenMapping;
	bytes32[] public Tokenlist;

	mapping(address => mapping(bytes32 => uint256)) public balances;

	modifier tokenExists(bytes32 _ticker) {
		require((tokenMapping[_ticker].tokenAddress) != address(0), "Token does not exist");
		_;
	}

	function _addToken(bytes32 _ticker, address _tokenAddress) internal onlyOwner {
		tokenMapping[_ticker] = Token(_ticker, _tokenAddress);
		Tokenlist.push(_ticker);
	}

	function addToken(bytes32 _ticker, address _tokenAddress) external onlyOwner {
		_addToken(_ticker, _tokenAddress);
	}

	function addEthToken() external onlyOwner {
		_addToken("ETH", msg.sender);
	}

	function deposit(bytes32 _ticker, uint256 amount) external tokenExists(_ticker) {
		balances[msg.sender][_ticker] = balances[msg.sender][_ticker].add(amount);
		IERC20(tokenMapping[_ticker].tokenAddress).transferFrom((msg.sender), address(this), amount);
	}

	function depositETH() public payable returns (uint256) {
		// require (msg.sender.balance >= msg.value);
		balances[msg.sender]["ETH"] = balances[msg.sender]["ETH"].add(msg.value);
		return balances[msg.sender]["ETH"];
	}

	// function withdrawETH() public payable returns (uint)  {
	//         balance[msg.sender] = balance[msg.sender].add(msg.value);
	//         return balance[msg.sender];

	function withdrawal(bytes32 _ticker, uint256 amount) external tokenExists(_ticker) {
		require(balances[msg.sender][_ticker] >= amount, " Balance not sufficient ");

		balances[msg.sender][_ticker] = balances[msg.sender][_ticker].sub(amount);

		IERC20(tokenMapping[_ticker].tokenAddress).transfer(payable(msg.sender), amount);
	}
}
