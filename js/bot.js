class bot{

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
    this.serverGetNonce = 'alien';
    this.interval;
    this.autoClaimnfts;
}

delay = (millis) =>
  new Promise((resolve, reject) => {
    setTimeout((_) => resolve(), millis);
  });

isEmptyObject(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

async postData(url = '', data = {}, method = 'POST',header = {'Content-Type': 'application/json'},returnMode = 'json') {
  try {
    // Object.assign(header,{'pragma':'no-cache' ,'cache-control':'no-cache'})
    const init = (method == 'POST') ? {method: method,mode: 'cors', cache: 'no-cache',credentials: 'same-origin',headers: header,redirect: 'follow',referrerPolicy: 'no-referrer',body: JSON.stringify(data)} : {method: method,mode: 'cors', cache: 'no-cache',credentials: 'same-origin',headers: header,redirect: 'follow',referrerPolicy: 'no-referrer'}
    if(returnMode == 'json'){
      const response = await fetch(url, init);
      return response.json(); // parses JSON response into native JavaScript objects
    }else{
      const response = await fetch(url, init).then(function(response) {
          if(response.ok)
          {
            return response.text(); 
          }
    
          throw new Error('Something went wrong.');
      })  
      .then(function(text) {
        console.log('Request successful', text);
        return text;
      })  
      .catch(function(error) {
        console.log('Request failed', error);
        return '';
      });

      return response
    }
  }catch (err) {
    this.appendMessage(`Error:${err.message}`)
    //send bypass line notify
    if(this.lineToken !== ''){
      await this.postData(this.lineBypassUrl, { token: this.lineToken, message:`Fetch:error, User:${userAccount}, Message:${err.message}` })
    }
    return false;
  }
}

async checkCPU (){
  let result = true
  let i = 0;
  let accountDetail = {}
  while(result){
    if(i%2 > 0){
      accountDetail = await this.postData('https://wax.cryptolions.io/v2/state/get_account?account='+wax.userAccount, {}, 'GET')
      accountDetail = accountDetail.account;
    }else{
      accountDetail = await this.postData('https://wax.pink.gg/v1/chain/get_account', { account_name: wax.userAccount }) //https://api.waxsweden.org
    }
    if(accountDetail){
      i ++;
      const rawPercent = ((accountDetail.cpu_limit.used/accountDetail.cpu_limit.max)*100).toFixed(2)
      console.log(`%c[Bot] rawPercent : ${rawPercent}%`, 'color:green')
      const ms = accountDetail.cpu_limit.max - accountDetail.cpu_limit.used;
      this.appendMessage(`CPU ${rawPercent}% : ${ms} ms`)
      if(rawPercent < this.checkCpuPercent){
        result = false;
      }else if(i > parseInt(document.getElementById("timer").value)){
        result = false;
        this.appendMessage(`Check CPU ${i} times --> mine`)    
      }  
    }
    
    if(result && accountDetail){
      const randomTimer = Math.floor(Math.random() * 30001)
      const delayCheckCpu = this.timerDelayCpu
      this.appendMessage(`CPU delay check ${Math.ceil(delayCheckCpu/1000/60)} min`)
      this.countDown(delayCheckCpu + randomTimer)
      await this.delay(delayCheckCpu + randomTimer);
    }
  }
}

appendMessage(msg , box = ''){
  const dateNow = moment().format('DD/MM/YYYY H:mm:ss');
  const boxMessage = document.getElementById("box-message"+box)
  boxMessage.value += '\n'+ `${dateNow} : ${msg}`
  boxMessage.scrollTop = boxMessage.scrollHeight;
}

countDown(countDown){
  clearInterval(this.interval);
  let countDownDisplay = Math.floor(countDown/1000)
  this.interval = setInterval(function() {
    document.getElementById("text-cooldown").innerHTML = countDownDisplay + " Sec"
    countDown = countDown - 1000;
    countDownDisplay = Math.floor(countDown/1000)
    if (countDown < 1000) {
      clearInterval(this.interval);
      document.getElementById("text-cooldown").innerHTML = "Go mine";
    }
  }, 1000);
}

async stop() {
  this.isBotRunning = false;
  this.appendMessage("bot STOP")
  console.log(`%c[Bot] stop`, 'color:green');
}

async start() {
  const userAccount = await wax.login();
  document.getElementById("text-user").innerHTML = userAccount
  document.getElementsByTagName('title')[0].text = userAccount
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
      const RandomTimeWait = minedelay + Math.floor(1000 + (Math.random() * 9000))
      this.countDown(RandomTimeWait)
      this.appendMessage(`Cooldown for ${Math.ceil((RandomTimeWait / 1000)/60)} min`)
      await this.delay(RandomTimeWait);
      minedelay = 0;      
    } while (minedelay !== 0 && (this.previousMineDone || this.firstMine));
    await this.mine()
  }
}

async mine(){
  const balance = await getBalance(wax.userAccount, wax.api.rpc);
    // console.log(`%c[Bot] balance: (before mine) ${balance}`, 'color:green');
    document.getElementById("text-balance").innerHTML = balance

    const nonce = await this.getNonce()
    let actions = [
      {
        account: "m.federation",
        name: "mine",
        authorization: [
          {
            actor: wax.userAccount,
            permission: "active",
          },
        ],
        data: {
          miner: wax.userAccount,
          nonce: nonce,
        },
      },
    ];
    
    try {
      if(this.checkCpuPercent != 0){
        console.log("bot checkCPU2");
        await this.checkCPU(wax.userAccount);
      }
      if(this.alertCaptcha){
        const audio = new Audio('https://media.geeksforgeeks.org/wp-content/uploads/20190531135120/beep.mp3');
        audio.play();
      }

      const result = await wax.api.transact({actions},{blocksBehind: 3,expireSeconds: 90});
      console.log(`%c[Bot] result is = ${result}`, 'color:green');
      if (result && result.processed) {
          let mined_amount = 0;
          result.processed.action_traces[0].inline_traces.forEach((t) => {
              if (t.act.account === 'alien.worlds' && t.act.name === 'transfer' && t.act.data.to === wax.userAccount) {
                const [amount_str] = t.act.data.quantity.split(' ');
                mined_amount += parseFloat(amount_str);
              }
          });

        this.appendMessage(mined_amount.toString() + ' TLM','2')
        this.firstMine = false;
        this.previousMineDone = true;
        this.checkMinedelay = true;
      }
    } catch (err) {
      this.previousMineDone = false;
      this.checkMinedelay = false;
      console.log(`%c[Bot] Error:${err.message}`, 'color:red');
      this.appendMessage(`Error:${err.message}`)
      //send bypass line notify
      if(this.lineToken !== ''){
        if(err.message.indexOf("billed CPU time") == -1){
          await this.postData(this.lineBypassUrl, { token: this.lineToken, message:`User:${wax.userAccount} , Message:${err.message}` })
        }
      }
      if(this.checkCpuPercent == 0){
        this.appendMessage(`Delay error CPU ${Math.ceil((this.timerDelayCpu / 1000)/60)} min`)
        this.countDown(this.timerDelayCpu)        
        await this.delay(this.timerDelayCpu);        
      }
    }
    
    const afterMindedBalance = await getBalance(wax.userAccount, wax.api.rpc);
    this.appendMessage(`balance (after mined): ${afterMindedBalance}`)
    document.getElementById("text-balance").innerHTML = afterMindedBalance
    // console.log(`%c[Bot] balance (after mined): ${afterMindedBalance}`, 'color:green');
}

async getNonce(){
  let nonce = '';
  let message = ''
  const serverGetNonce = document.querySelector('input[name="server"]:checked').value
  if(serverGetNonce == 'ninjamine' || serverGetNonce == 'ninjamine-vip'){
    let urlNinJa = 'https://server-mine-b7clrv20.an.gateway.dev/server_mine'      
    if(serverGetNonce == 'ninjamine-vip'){
      urlNinJa = 'https://server-mine-b7clrv20.an.gateway.dev/server_mine_vip';
    }
    console.log('urlNinJa',urlNinJa)
    nonce = await this.postData(urlNinJa+'?wallet='+wax.userAccount, {}, 'GET',{Origin : ""}, 'raw')
    if(nonce !== ''){
      if(serverGetNonce == 'ninjamine'){
        message = 'Ninja limit: ' + nonce
      }else{
        message = 'Ninja VIP god mode: ' + nonce
      }      
    }
    console.log('nonce-ninjamine',nonce)
  }

  if(this.serverGetNonce == 'alien' || nonce == ''){
    const mine_work = await background_mine(wax.userAccount)
    nonce = mine_work.rand_str
    console.log('nonce-alien',nonce)
    message = 'Alien: ' + nonce
  }

  this.appendMessage(`${message}`)
  return nonce;
}

  claimnftsController(){
    console.log('claimnftsController')
    clearInterval(this.autoClaimnfts);
    this.autoClaimnfts = setInterval(function() {
      var newBot = new bot()
      newBot.getClaimnfts('auto')
    }, 3600000);
  }

  async getClaimnfts(mode){
    document.getElementById("btn-claimn-nft").disabled = true
    const newClaims = new claims()
    const userCheckNft = document.getElementById("user-check-nft").value == '' ? wax.userAccount : document.getElementById("user-check-nft").value
    const get_nft = await newClaims.getNFT(userCheckNft, wax.api.rpc, aa_api) 
    console.log('get_nft',get_nft)
    if(get_nft.length > 0){
      let actions = [
        {
          account: 'm.federation',
          name: 'claimnfts',
          authorization: [{
            actor: wax.userAccount,
            permission: 'active',
          }],
          data: {
            miner: wax.userAccount
          },
        }
      ];      

      await wax.api.transact({actions},{blocksBehind: 3,expireSeconds: 90});
      for(const item of get_nft){
        this.appendMessage(item.name,'2')
        await this.postData(this.lineBypassUrl, { token: this.lineToken, message:`User:${wax.userAccount} , NFT Name:${item.name}` })
      }      
    }else{
      if(mode !== 'auto'){
        this.appendMessage('NFT Nothing...','2')
      }
    }
    
    document.getElementById("btn-claimn-nft").disabled = false
  }

}