class bot{

delay = (millis) =>
  new Promise((resolve, reject) => {
    setTimeout((_) => resolve(), millis);
  });

async postData(url = '', data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json'
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  });
  return response.json(); // parses JSON response into native JavaScript objects
}

async checkCPU (userAccount){
  let result = true;

  while(result){
    try {
      const accountDetail = await this.postData('https://api.waxsweden.org/v1/chain/get_account', { account_name: userAccount })
      
      if(accountDetail.cpu_limit != null){
        const rawPercent = ((accountDetail.cpu_limit.used/accountDetail.cpu_limit.max)*100).toFixed(2)
        console.log(`%c[Bot] rawPercent : ${rawPercent}%`, 'color:green')
        console.log(`%c[Bot] cpu_limit max:${accountDetail.cpu_limit.max} use:${accountDetail.cpu_limit.used} = ${accountDetail.cpu_limit.max - accountDetail.cpu_limit.used}`, 'color:green')
        if(rawPercent < 90){
          result = false;
        }
      }
    }catch (err) {
      console.log(err.message);
      result = false;
    }
    
    if(result){
      const delayCheckCpu = 120000 + Math.floor(Math.random() * 30001)
      console.log(`%c[Bot] delay ${(delayCheckCpu/1000/60)} min check cpu again`, 'color:green')
      await delay(delayCheckCpu);
    }
  }
}

async start() {
const userAccount = await wax.login();
unityInstance.SendMessage(
  "Controller",
  "Server_Response_LoginData",
  userAccount
);
await delay(2000);
console.log("bot StartBot");
while (true) {
  let firstMine = true;
  let previousMineDone = false;
  let minedelay = 1;
  do {
    console.log("bot checkCPU");
    await this.checkCPU(userAccount);
    minedelay = await getMineDelay(userAccount);
    // minedelay = 900000;   
    console.log(`%c[Bot] Cooldown for ${Math.ceil((minedelay / 1000)/60)} min`, 'color:green');
    await delay(minedelay + Math.floor(1000 + (Math.random() * 9000)));
    // minedelay = 0;
  } while (minedelay !== 0 && (previousMineDone || firstMine));
  const balance = await getBalance(userAccount, wax.api.rpc);
  console.log(`%c[Bot] balance: (before mine) ${balance}`, 'color:green');
  
  const mine_work = await background_mine(userAccount);
  unityInstance.SendMessage(
    "Controller",
    "Server_Response_Mine",
    JSON.stringify(mine_work)
  );

  const mine_data = {
    miner: mine_work.account,
    nonce: mine_work.rand_str,
  };
  console.log(`%c[Bot]mine data `,mine_data, 'color:green');
  const actions = [
    {
      account: mining_account,
      name: "mine",
      authorization: [
        {
          actor: mine_work.account,
          permission: "active",
        },
      ],
      data: mine_data,
    },
  ];
  
  try {
      const audio = new Audio('https://media.geeksforgeeks.org/wp-content/uploads/20190531135120/beep.mp3');
      audio.play();
  
    const result = await wax.api.transact(
      {
        actions,
      },
      {
        blocksBehind: 3,
        expireSeconds: 90,
      }
    );
    console.log(`%c[Bot] result is = ${result}`, 'color:green');
    var amounts = new Map();
    if (result && result.processed) {
      result.processed.action_traces[0].inline_traces.forEach((t) => {
        if (t.act.data.quantity) {
          const mine_amount = t.act.data.quantity;
          console.log(`%c[Bot] ${mine_work.account} Mined ${mine_amount}`, 'color:green');
          if (amounts.has(t.act.data.to)) {
            let obStr = amounts.get(t.act.data.to);
            obStr = obStr.substring(0, obStr.length - 4);
            let nbStr = t.act.data.quantity;
            nbStr = nbStr.substring(0, nbStr.length - 4);
            let balance = (parseFloat(obStr) + parseFloat(nbStr)).toFixed(4);
            amounts.set(t.act.data.to, balance.toString() + " TLM");
          } else {
            amounts.set(t.act.data.to, t.act.data.quantity);
          }
        }
      });
      unityInstance.SendMessage(
        "Controller",
        "Server_Response_Claim",
        amounts.get(mine_work.account)
      );
      firstMine = false;
      previousMineDone = true;
    }
  } catch (err) {
    unityInstance.SendMessage(
      "ErrorHandler",
      "Server_Response_SetErrorData",
      err.message
    );
    previousMineDone = false;
    console.log(`%c[Bot] Error`, 'color:red');
  }

  const afterMindedBalance = await getBalance(userAccount, wax.api.rpc);
  const now = (new Date());
  console.log(`%c[Bot] balance (after mined): ${afterMindedBalance}`, 'color:green');
  console.log(`%c[Bot] Time : ${now}`, 'color:green');
}
}

}