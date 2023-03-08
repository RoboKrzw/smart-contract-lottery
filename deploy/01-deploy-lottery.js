const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const {verify} = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("1")

module.exports = async function({getNamedAccounts, deployments}) {
    const {deploy,log} = deployments
    const {deployer} = await getNamedAccounts()
    const chainId = network.config.chainId

    let vrfCoordinatorV2Address, subscriptionId
    if (developmentChains.includes(network.name)) {
        // ponizej wchodzimy do smart kontraktu VRFCoordinatorV2Mock
        const VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = VRFCoordinatorV2Mock.address
        // ponizej korzystamy z funkcji createSubscription tego kontraktu
        const transactionResponse = await VRFCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        // ponizej events odwoluje sie do EMIT w funkcji createSubscription
        subscriptionId = transactionReceipt.events[0].args.subId
        // fund the subscription
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    
    // ponizej bierzemy wszystkie zmienne z constructora lottery.sol
    const entranceFee = networkConfig[chainId]["entranceFee"]
    const keyHash = networkConfig[chainId]["keyHash"]
    const callbackGasLimit = "500000"
    const interval = "30"
    
    // ponizej wpisujemy args które ustanowiliśmy powyżej
    const arguments = [vrfCoordinatorV2Address, entranceFee, keyHash, subscriptionId, callbackGasLimit, interval]
    // console.log(arguments)
    const lottery = await deploy("Lottery", {
        from: deployer,
        args: arguments,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (chainId == 31337) {
        const vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock"
        );
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), lottery.address)
        log("adding consumer...")
        log("Consumer added!")
    }
    
    if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("verifying...")
        await verify(lottery.address, arguments)
    }
    log("---------------------------------")
}

module.exports.tags = ["all", "lottery"]