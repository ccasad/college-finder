// import { setTimeout } from 'timers/promises';
const { setTimeout } = require("timers/promises");

(async () => {
  for (let i=0; i<5; i++){
    console.log("Start", i)
    await setTimeout(2000)
    // Executed after 2 seconds
    console.log("END");
  }
})()

// (async () => {
//   const sleep = m => new Promise(r => setTimeout(r, m))
//   console.log("Slept for")
//   await sleep(3000)
//   console.log("Slept for")
// })()