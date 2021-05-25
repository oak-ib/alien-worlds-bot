class botNew{

  constructor() {
    this.isBotRunning = false;
    this.alertCaptcha = false;
    this.checkCpuPercent = 90;
    this.timerDelay = 810000;
    this.timerDelayCpu = 180000;
    this.checkMinedelay = false;
    this.firstMine = true;
    this.previousMineDone = false;
    this.lineToken = '';
    this.lineBypassUrl = 'https://notify-gateway.vercel.app/api/notify';
  }

  delay = (millis) => new Promise((resolve, reject) => {
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
    if(accountDetail){
      const rawPercent = ((accountDetail.cpu_limit.used/accountDetail.cpu_limit.max)*100).toFixed(2)
      console.log(`%c[Bot] rawPercent : ${rawPercent}%`, 'color:green')
      this.appendMessage(`CPU ${rawPercent}%`)
      if(rawPercent < this.checkCpuPercent){
        result = false;
      }
    }
    
    if(result){
      const randomTimer = Math.floor(Math.random() * 30001)
      const delayCheckCpu = this.timerDelayCpu
      this.appendMessage(`CPU delay check ${Math.ceil(delayCheckCpu/1000/60)} min`)
      await this.delay(delayCheckCpu + randomTimer);
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
    if (countDown < 1000) {
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
  console.log("bot StartBot script test");
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
      const RandomTimeWait = minedelay + Math.floor(1000 + (Math.random() * 9000))
      this.countDown(minedelay)
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
  document.getElementById("text-balance").innerHTML = balance
    
    const mine_work = await background_mine(userAccount);
    // unityInstance.SendMessage(
    //   "Controller",
    //   "Server_Response_Mine",
    //   JSON.stringify(mine_work)
    // );

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
    
    console.log("bot checkCPU2");
    await this.checkCPU(userAccount);
    try {
      if(this.alertCaptcha){
        const audio = new Audio('https://media.geeksforgeeks.org/wp-content/uploads/20190531135120/beep.mp3');
        audio.play();
      }

      //send bypass line notify
      if(this.lineToken !== ''){
        await this.postData(this.lineBypassUrl, { token: this.lineToken, message:`User:${userAccount} , Message: mine` })
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
      
      var transaction_id = "0"
      var amounts = new Map();
      if (result && result.processed) {
        let mined_amount = 0;
        result.processed.action_traces[0].inline_traces.forEach((t) => {
          if (t.act.account === 'alien.worlds' && t.act.name === 'transfer' && t.act.data.to === mine_work.account){
            const [amount_str] = t.act.data.quantity.split(' ');
            mined_amount += parseFloat(amount_str);        
          }
          transaction_id = result.transaction_id;
				});
        
        this.firstMine = false;
        this.previousMineDone = true;
        this.checkMinedelay = true;
      }

      const claimBounty = await getBountyFromTx(transaction_id,account, ["https://api.waxsweden.org","https://wax.eosrio.io"]);      
      this.appendMessage(claimBounty.toString(),'2')
      this.appendMessage(amounts.get(mine_work.account),'2')
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