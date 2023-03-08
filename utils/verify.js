//since we use "run" command we need to ...
const {run} = require("hardhat")

async function verify(contractAddress, args) {
    console.log("veryfing contract.....");
    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: args,
      })
    }
    catch(e) {
      if (e.message.toLowerCase().includes("already verified")){
        console.log("Already verified")
      } else {
        console.log(e)
      }
    }
  }

module.exports = {verify}