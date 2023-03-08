const { ethers, network } = require("hardhat")
// it is an inbuilt method which is used to read the file. This method read the entire file into buffer.
const {fs} = require("fs")

const FRONTEND_ADDRESSES_FILE = "../nextjs-smartcontract-lottery/constants/contractAddresses.json"
const FRONTEND_ABI_FILE = "../nextjs-smartcontract-lottery/constants/abi.json"

module.exports = async function (){
    if(process.env.UPDATE_FRONTEND){
        console.log("updating frontend")
        updateContractAddresses()
        updateABI()
    }
}

async function updateABI(){
    const lottery = await ethers.getContract("Lottery")
    // ponizej dzieki jednej linijce kodu uzyskujemy ABI

    // FUNKCJA writeFileSync
    // It takes in three parameters, based on which it creates and writes files:
    // The file name or descriptor
    // The data that you want to write to the file
    // Options: a string or object you can use to specify three additional optional parameters
    fs.writeFileSync(FRONTEND_ABI_FILE, lottery.interface.format(ethers.utils.FormatTypes.json))
}

async function updateContractAddresses(){
    const lottery = await ethers.getContract("Lottery")
    // chcemy przekazac ten adres do frontendu
    // FUNKCJA readFileSync
    // bierze params path, options (np. kodowanie)
    const currentAddresses = JSON.parse(fs.readFileSync(FRONTEND_ADDRESSES_FILE, "utf8"))
    const chainId = network.config.chainId.toString()
    // jesli chainId znajduje się w currentAddresses
    // ------> OPERATOR IN <---------
    if(chainId in currentAddresses) {
        if(!currentAddresses[chainId].includes(lottery.address)){
            currentAddresses[chainId].push(lottery.address)
        } {
            // jesli chainId nie istnieje w obecnym adresie to dodamy nową array
            currentAddresses[chainId] = [lottery.address]
        }
    }
    // FUNKCJA writeFileSync
    // It takes in three parameters, based on which it creates and writes files:
    // The file name or descriptor
    // The data that you want to write to the file
    // Options: a string or object you can use to specify three additional optional parameters
    fs.writeFileSync(FRONTEND_ADDRESSES_FILE, JSON.stringify(currentAddresses))
}

module.exports.tags = ["all", "frontend"]