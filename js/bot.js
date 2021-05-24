class bot{

  constructor() {
    this.isBotRunning = false;
    this.alertCaptcha = false;
    this.checkCpuPercent = 90;
    this.timerDelay = 810000;
    this.checkMinedelay = false;
    this.firstMine = true;
    this.previousMineDone = false;
    this.lineToken = '';
    this.lineBypassUrl = 'https://notify-gateway.vercel.app/api/notify';
}

delay = (millis) =>
  new Promise((resolve, reject) => {
    setTimeout((_) => resolve(), millis);
  });

isEmptyObject(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

async postData(url = '', data = {}, method = 'POST',header = {'Content-Type': 'application/json'}) {
  try {
    const init = (method == 'POST') ? {method: method,mode: 'cors', cache: 'no-cache',credentials: 'same-origin',headers: header,redirect: 'follow',referrerPolicy: 'no-referrer',body: JSON.stringify(data)} : {method: method,mode: 'cors', cache: 'no-cache',credentials: 'same-origin',headers: header,redirect: 'follow',referrerPolicy: 'no-referrer'}
    const response = await fetch(url, init);

    return response.json(); // parses JSON response into native JavaScript objects
  }catch (err) {
    this.appendMessage(`Error:${err.message}`)
    //send bypass line notify
    if(this.lineToken !== ''){
      await this.postData(this.lineBypassUrl, { token: this.lineToken, message:`Fetch:error, User:${userAccount}, Message:${err.message}` })
    }
    return false;
  }
}

async checkCPU (userAccount){
  let result = true
  let i = 0;
  let accountDetail = {}
  while(result){
    if(i%2 > 0){
      accountDetail = await this.postData('https://wax.cryptolions.io/v2/state/get_account?account='+userAccount, {}, 'GET')
      accountDetail = accountDetail.account;
    }else{
      accountDetail = await this.postData('https://api.waxsweden.org/v1/chain/get_account', { account_name: userAccount })
    }
      console.log('accountDetail',accountDetail)
    if(accountDetail){
      const rawPercent = ((accountDetail.cpu_limit.used/accountDetail.cpu_limit.max)*100).toFixed(2)
      console.log(`%c[Bot] rawPercent : ${rawPercent}%`, 'color:green')
      this.appendMessage(`CPU ${rawPercent}%`)
      if(rawPercent < this.checkCpuPercent){
        result = false;
      }
    }
    
    if(result){
      const delayCheckCpu = 120000 + Math.floor(Math.random() * 30001)
      // console.log(`%c[Bot] delay ${(delayCheckCpu/1000/60)} min check cpu again`, 'color:green')
      this.appendMessage(`CPU delay check ${Math.ceil(delayCheckCpu/1000/60)} min`)
      await this.delay(delayCheckCpu);
      i ++;
    }
  }
}

appendMessage(msg , box = ''){
  const dateNow = moment().format('DD/MM/YYYY h:mm:ss');
  const boxMessage = document.getElementById("box-message"+box)
  boxMessage.value += '\n'+ `${dateNow} : ${msg}`
  boxMessage.scrollTop = boxMessage.scrollHeight;
}

countDown(countDown){
  let countDownDisplay = countDown/1000;
  var x = setInterval(function() {
    document.getElementById("text-cooldown").innerHTML = countDownDisplay + " Sec"
    countDown = countDown - 1000;
    countDownDisplay = countDown/1000;
    if (countDown < 0) {
      clearInterval(x);
      document.getElementById("text-cooldown").innerHTML = "Go mine";
    }
  }, 1000);
}

async getUserMineDelay(userAccount){
  return getMineDelay(userAccount);
}

async stop() {
  this.isBotRunning = false;
  this.appendMessage("bot STOP")
  console.log(`%c[Bot] stop`, 'color:green');
}

async start() {
  const userAccount = await wax.login();
  document.getElementById("text-user").innerHTML = userAccount
  console.log('timerDelay',this.timerDelay,'checkCpuPercent',this.checkCpuPercent)
  unityInstance.SendMessage(
    "Controller",
    "Server_Response_LoginData",
    userAccount
  );
  this.isBotRunning = true;
  await this.delay(2000);
  console.log("bot StartBot");
  this.appendMessage("bot START")
  while (this.isBotRunning) {
    let minedelay = 1;
    do {
      if(this.timerDelay != 0){
        if(this.checkMinedelay){
          minedelay = this.timerDelay;
        }
      }else{
        minedelay = await getMineDelay(userAccount);
      }
      // console.log(`%c[Bot] Cooldown for ${Math.ceil((minedelay / 1000)/60)} min`, 'color:green');
      this.countDown(minedelay)
      const RandomTimeWait = minedelay + Math.floor(1000 + (Math.random() * 9000))
      this.appendMessage(`Cooldown for ${Math.ceil((RandomTimeWait / 1000)/60)} min`)
      await this.delay(RandomTimeWait);
      minedelay = 0;      
    } while (minedelay !== 0 && (this.previousMineDone || this.firstMine));
    await this.mine(userAccount)
  }
}

async mine(userAccount){
  document.getElementById("btn-mine").disabled = true
  const balance = await getBalance(userAccount, wax.api.rpc);
    // console.log(`%c[Bot] balance: (before mine) ${balance}`, 'color:green');
    document.getElementById("text-balance").innerHTML = balance
    
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
      console.log("bot checkCPU2");
      await this.checkCPU(userAccount);
      if(this.alertCaptcha){
        const audio = new Audio('https://media.geeksforgeeks.org/wp-content/uploads/20190531135120/beep.mp3');
        audio.play();
      }

      const result = await wax.api.transact(
        {
          actions,
        },
        {
          blocksBehind: 3,
          expireSeconds: 360,
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
        this.appendMessage(amounts.get(mine_work.account),'2')
        this.firstMine = false;
        this.previousMineDone = true;
        this.checkMinedelay = true;
      }
    } catch (err) {
      unityInstance.SendMessage(
        "ErrorHandler",
        "Server_Response_SetErrorData",
        err.message
      );
      this.previousMineDone = false;
      this.checkMinedelay = false;
      console.log(`%c[Bot] Error:${err.message}`, 'color:red');
      this.appendMessage(`Error:${err.message}`)
      //send bypass line notify
      if(this.lineToken !== ''){
        await this.postData(this.lineBypassUrl, { token: this.lineToken, message:`User:${userAccount} , Message:${err.message}` })
      }
    }

    const afterMindedBalance = await getBalance(userAccount, wax.api.rpc);
    this.appendMessage(`balance (after mined): ${afterMindedBalance}`)
    document.getElementById("text-balance").innerHTML = afterMindedBalance
    // console.log(`%c[Bot] balance (after mined): ${afterMindedBalance}`, 'color:green');
    document.getElementById("btn-mine").disabled = false
}

}