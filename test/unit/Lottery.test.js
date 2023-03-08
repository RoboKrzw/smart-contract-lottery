const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name) 
    ? describe.skip 
    : describe(
        "Lottery unit test", 
        function(){
            let lottery, vrfCoordinatorV2Mock, lotteryEntranceFee, deployer, interval
            const chainId = network.config

            beforeEach(async function(){
                deployer = (await getNamedAccounts()).deployer
                // Metoda fixture pozwala na zdeployowanie wszystkich tych, których tag ujęty jest jako argument.
                await deployments.fixture("all")
                lottery = await ethers.getContract("Lottery", deployer)
                vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
                lotteryEntranceFee = await lottery.getEntranceFee()
                interval = await lottery.getInterval()
            })

            describe("constructor", function(){
                it("initialized the lottery correctly", async function(){
                    // idealnie dążymy do tego aby był 1 assert per "it"
                    const lotteryState = await lottery.getLotteryState()
                    const interval = await lottery.getInterval()
                    assert.equal(lotteryState.toString(), "0")
                    assert.equal(interval.toString(), "30")
                })
            })

            describe("enterLottery", function(){
                it("reverts when you dont pay enough", async function(){
                    await expect(lottery.enterLottery()).to.be.revertedWith("Lottery__NotEnoughETHEntered")
                })
                it("records players when they enter", async function(){
                    // potrzebujemy posilic się zmienna lotteryEntranceFee, która ustanowimy u góry
                    await lottery.enterLottery({value: lotteryEntranceFee})
                    const playerFromContract = await lottery.getPlayer(0)
                    assert.equal(playerFromContract, deployer)
                })
                it("emits events on enter", async function(){
                    await expect(lottery.enterLottery({value: lotteryEntranceFee})).to.emit(
                        lottery, 
                        "LotteryEnter"
                    )
                })
                it("doesnt allow entrance when lottery is calculating", async function(){
                    await lottery.enterLottery({value: lotteryEntranceFee})
                    // ponizej sprawiamy ze interval między działaniem loterii będzie o 1 wiekszy niz faktyczny interval i tym samym zmieni się na true i nas przepusci
                    await network.provider.send("evm_increaseTime", [interval.toNumber()+1])
                    // ponizej sprawiamy ze wykopie się 1 dodatkowy blok
                    await network.provider.request({ method: "evm_mine", params: [] })
                    // ponizej udajemy ze jestesmy chainlink keeper
                    await lottery.performUpkeep([])
                    await expect(lottery.enterLottery({value: lotteryEntranceFee})).to.be.revertedWith("Lottery__NotOpen")
                })
            })
            describe("checkUpkeep", function(){
                it("returns false if people didnt send any ETH", async function(){
                    await network.provider.send("evm_increaseTime", [interval.toNumber()+1])
                    await network.provider.request({ method: "evm_mine", params: [] })
                    const {upkeepNeeded} = await lottery.callStatic.checkUpkeep("0x") // tu
                    assert(!upkeepNeeded)
                })
                it("returns false if lottery isnt open", async function(){
                    await lottery.enterLottery({value: lotteryEntranceFee})
                    await network.provider.send("evm_increaseTime", [interval.toNumber()+1])
                    await network.provider.request({ method: "evm_mine", params: [] })
                    await lottery.performUpkeep("0x") // 0x -> pusty bajtowy objekt
                    const lotteryState = await lottery.getLotteryState()
                    const {upkeepNeeded} = await lottery.callStatic.checkUpkeep("0x")
                    assert.equal(lotteryState.toString(), "1")
                    assert.equal(upkeepNeeded, false)
                })
                it("returns false if enough time hasn't passed", async () => {
                    await lottery.enterLottery({ value: lotteryEntranceFee })
                    await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
                    await network.provider.request({ method: "evm_mine", params: [] })
                    const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                    assert(!upkeepNeeded)
                })
                it("returns true if enough time has passed, has players, eth, and is open", async () => {
                    await lottery.enterLottery({ value: lotteryEntranceFee })
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                    await network.provider.request({ method: "evm_mine", params: [] })
                    const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                    assert(upkeepNeeded)
                })
            })
            describe("performUpkeep", function(){
                it("it can only run when checkUpkeep is true", async function(){
                    await lottery.enterLottery({value: lotteryEntranceFee})
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                    await network.provider.request({ method: "evm_mine", params: [] })
                    const tx = await lottery.performUpkeep([])
                    assert(tx)
                })
                it("reverts when checkupkeep is false", async function(){
                    await expect(lottery.performUpkeep([])).to.be.revertedWith("Lottery__UpkeepNotNeeded")
                })
                it("updates the lottery state, emits and event, calls the vrf coordinator", async function(){
                    await lottery.enterLottery({value: lotteryEntranceFee})
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                    await network.provider.request({ method: "evm_mine", params: [] })
                    const txResponse = await lottery.performUpkeep([])
                    const txReceipt = await txResponse.wait(1)
                    const requestId = txReceipt.events[1].args.requestId
                    const lotteryState = await lottery.getLotteryState()
                    console.log(requestId)
                    assert(requestId.toNumber() > 0)
                    assert(lotteryState.toString() == "1")
                })
            })
            describe('fulfillRandomWords', () => {
                beforeEach(async function(){
                    await lottery.enterLottery({value: lotteryEntranceFee})
                    await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                    await network.provider.request({ method: "evm_mine", params: [] })
                })
                it("can only be called after performUpkeep", async function(){
                    await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)).to.be.revertedWith("nonexistent request")
                    await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)).to.be.revertedWith("nonexistent request")
                })
                // it("picks a winner, resets the lottery, and sends the money", async function(){
                //     const additionalEntrants = 3 // chcemy wrzucić do puli graczy 3 uczestniklów
                //     const startingAccountIndex = 1 // zaczynamy od 1 bo deployer to 0
                //     const accounts = ethers.getSigners()
                //     console.log("objet")
                //     for(let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++){
                //             const accountConnectedLottery = lottery.connect(accounts[i])
                //             await accountConnectedLottery.enterLottery({value: lotteryEntranceFee})
                //         }
                //         const startingTimeStamp = await lottery.getLastTimeStamp()

                //     await new Promise(async (resolve, reject) => {
                //         lottery.once("WinnerPicked", async () => {
                //             console.log("found the event!!!!!")
                //             try {
                //                 console.log(recentWinner)
                //                 console.log(accounts[2])
                //                 console.log(accounts[0])
                //                 console.log(accounts[1])
                //                 console.log(accounts[3])
                //                 const recentWinner = await lottery.getRecentWinner()
                //                 const lotteryState = await lottery.getLotteryState()
                //                 const endingTimeStamp = await lottery.getLastTimeStamp()
                //                 const nmumberOfPlayers = await lottery.getNumberOfPlayers()
                //                 assert.equal(nmumberOfPlayers.toString(), "0")
                //                 assert.equal(lotteryState.toString(), "0")
                //                 assert(endingTimeStamp > startingTimeStamp)
                //             } catch (error) {
                //                 reject(error)
                //             }
                //             resolve()
                //         })
                //         // ponizej ustanawiamy listenera, nastepnie rozpoczynamy event, i wtedy listener ma to wyłapać i rozwiązać
                //         const tx = lottery.performUpkeep([])
                //         const txReceipt = await tx.wait(1)
                //         await vrfCoordinatorV2Mock.fulfillRandomWords(
                //             txReceipt.events[1].args.requestId,
                //             lottery.address
                //         )
                //     })
                // })
            })
        }
    )