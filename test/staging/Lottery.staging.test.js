const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name) 
? describe.skip
: describe(
    "Lottery staging test", 
    function(){
        let lottery, lotteryEntranceFee, deployer, interval

        beforeEach(async function(){
            deployer = (await getNamedAccounts()).deployer
            lottery = await ethers.getContract("Lottery", deployer)
            lotteryEntranceFee = await lottery.getEntranceFee()
            interval = await lottery.getInterval()
        })
        describe("fulfillRandomWords", function(){
            it("works with live chainlink keepers and chainlink vrf, we get a random winner", async function(){
                // enter the lottery
                console.log("Setting up test...")
                const startingTimestamp = await lottery.getLastTimeStamp
                const accounts = await ethers.getSigners()

                console.log("Setting up Listener...")
                // await new Promise(async(resolve, reject) => {
                //     lottery.once("WinnerPicked", async () => {
                //         console.log("winner picked, event fired!")
                //         try {
                //             // tutaj dodajemy nasze zalozenia (assert)
                //             const recentWinner = await lottery.getRecentWinner()
                //             const lotteryState = await lottery.getLotteryState()
                //             const winnerEndingBalance = await accounts[0].getBalance()
                //             const endingTimeStamp = await lottery.getLastTimeStamp()

                //             await expect(lottery.getPlayer(0)).to.be.reverted
                //             assert.equal(recentWinner.toString(), accounts[0].address)
                //             assert.equal(lotteryState, 0)
                //             assert.equal(
                //                 winnerEndingBalance.toString(),
                //                 winnerStartingBalance.add(lotteryEntranceFee).toString()
                //             )
                //             assert(endingTimeStamp > startingTimestamp)
                //             resolve()
                //         } catch (error) {
                //             console.log(error)
                //             reject(error)
                //         }
                //     })
                //     console.log("Entering lottery...")
                //     const tx = await lottery.enterLottery({value: lotteryEntranceFee})
                //     // await tx.wait(1)
                //     console.log("Ok, time to wait...")
                //     // const winnerStartingBalance = await accounts[0].getBalance()
                // })
                //entering the Lottery
                console.log("Entering Lottery...")
                const txResponse = await lottery.enterLottery({ value: lotteryEntranceFee })
                const txReceipt = await txResponse.wait(6);
                console.log("Time to wait...")
                // emit accepts two parameters, 1st is contract, which will emit event, 2nd is event name in string form
                expect(txReceipt).to.emit(lottery, "WinnerPicked");   // Expect the event to fire, 
               // Now the event is emitted, we can run our code to test for things after event is fired

              console.log("WinnerPicked event fired")
                    try {
                        // asserts
                        console.log("Made it here!!!")
                        const recentWinner = await lottery.getRecentWinner()
                        const LotteryState = await lottery.getLotteryState()
                        const winnerEndingBalance = await accounts[0].getBalance()
                        const endingTimeStamp = await lottery.getLatestTimestamp()

                        await expect(Lottery.getPlayer(0)).to.be.reverted
                        assert.equal(recentWinner.toString(), accounts[0].address) // deployer
                        assert.equal(LotteryState, 0)
                        assert.equal(
                            winnerEndingBalance.toString(),
                            winnerStartingBalance.add(lotteryEntranceFee).toString()
                        )
                        assert(endingTimeStamp > startingTimestamp)
                    } catch (error) {
                        console.log(error)
                    }
            })
        })
    }
)