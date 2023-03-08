// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
import "hardhat/console.sol";

error Lottery__NotEnoughETHEntered();
error Lottery__TransferFailed();
error Lottery__NotOpen();
error Lottery__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 lotteryState);

contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {

    /* Types declarations */
    // enum - typy, coś nowego! typami do tej pory były: uint256, address itp
    enum LotteryState{
        OPEN,
        CALCULATING
    }
    /* state variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_keyHash;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    // CAPS LOCK FOR CONSTANT VARS
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    /* lottery variables */
    address private s_recentWinner;
    LotteryState private s_lotteryState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    /* events */
    // events are passed in logs, logs are not a part of smart contract, so they dont consume gas
    event LotteryEnter(address indexed player);
    event RequestLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2, // contract address
        uint256 entranceFee, 
        bytes32 keyHash,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_keyHash = keyHash;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_lotteryState = LotteryState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }
    // musimy dodać VRFConsumerBaseV2 ponieważ chainlink wymaga tego od nas, z kolei vrfCoordinatorV2 to adres kontraktu ktory tworzy randomNumber

    function enterLottery() public payable {
        // msg.value -> wartość podawana przez uczestnika loterii we front-endzie
        if(msg.value < i_entranceFee){
            revert Lottery__NotEnoughETHEntered();
        }
        // jeśli nie jest otwarta to nie można przystąpić
        if(s_lotteryState != LotteryState.OPEN){
            revert Lottery__NotOpen();
        }
        // ponizsze dorzuca uczestników do puli
        // nalezy konkretnie nazwac payable, bo w domysle jest jedynie adresem
        s_players.push(payable(msg.sender));
        // emit wyemituje nam event w logu
        emit LotteryEnter(msg.sender);
    }

    // to jest funkcja, która wywoluje node CHAINLINK KEEPER-a
    // upkeepNeeded 
    // 1. ma zwrócić TRUE
    // TRUE oznacza:
    // 2. nasz interwał czasowy minał
    // 3. loteria powinna miec co najmniej jednego uczestnika i jakies ETH
    // 4. nasza subskrypcja jest płacona z uzyciem waluty LINK

    // Runs off-chain at every block to determine if the performUpkeep function should be called on-chain.
    function checkUpkeep(
        // calldata doesnt work with string, if we pass "" we need to change it to memory
        bytes memory /*checkData*/
        ) 
        public
        override 
        returns (
            bool upkeepNeeded,
            bytes memory /* perfomData */
        ) {
        // 1.
        bool isOpen = (LotteryState.OPEN == s_lotteryState);
        // 2. (block.timestamp - last block timestamp) > interval
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        // 3. 
        bool enoughPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        // jesli wskazane jest w returnie jakim typem jest upkeepNeeded to ponizej nie musimy tego robic
        upkeepNeeded = (isOpen && timePassed && enoughPlayers && hasBalance);
    }

    // Contains the logic that should be executed on-chain when checkUpkeep returns true
    // external functions are cheaper than public + our smartContract cant call them
    function performUpkeep(
        bytes calldata /*performData*/
    ) 
    external 
    override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        // require(upkeepNeeded, "Upkeep not needed");
        if(!upkeepNeeded) {
            revert Lottery__UpkeepNotNeeded(
                address(this).balance, 
                s_players.length, 
                uint256 (s_lotteryState));
        }
        s_lotteryState = LotteryState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestLotteryWinner(requestId);
    }

    function fulfillRandomWords(
        uint256 /* requestId */, 
        uint256[] memory randomWords) 
        internal 
        override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_lotteryState = LotteryState.OPEN;
        s_recentWinner = recentWinner;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if(!success) {
            revert Lottery__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    /* view / pure functions */
    function getEntranceFee() public view returns(uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns(address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns(address) {
        return s_recentWinner;
    }

    function getLotteryState() public view returns(LotteryState) {
        return s_lotteryState;
    }

    function getNumWords() public view returns(uint256) {
        return NUM_WORDS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }
}