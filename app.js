const express = require("express");
const Tx = require("ethereumjs-tx");
const Web3 = require("web3");
const morgan = require("morgan");
const cors = require("cors");
const fs = require("fs");
const util = require("util");

const bodyParser = require("body-parser");
const rp = require("request-promise");
const axios = require("axios");
const CoinGecko = require("coingecko-api");
const CryptoNewsAPI = require("crypto-news-api").default;
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
// 6d03dcc3-dcb6-4908-ab3b-9cd6d1f0c199
// const ganache = "http://127.0.0.1:7545";

//Initiate the CoinGecko API Client
const CoinGeckoClient = new CoinGecko();

const Api = new CryptoNewsAPI("YOUR_API_KEY");
const rpcUrl = "https://mainnet.infura.io/v3/YOUR_API_KEY";
const web3 = new Web3(rpcUrl);

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(morgan("dev"));

//@route POST /web3/create
//@desc Post Create a new ethereum wallet
//@access Public
app.get("/web3/create", (req, res) => {
  const account = web3.eth.accounts.create();
  const wallet = {
    address: account.address,
    privateKey: account.privateKey
  };
  return res.status(200).json(wallet);
});

//@route POST /web3/fetch
//@desc GEt user account balance by it's address
//@access Public
app.post("/web3/fetch", (req, res) => {
  const address = req.body.address;
  let ether, noble;
  //address cannot be empty
  if (address == "") {
    return res.status(400).json({
      success: false,
      data: {},
      error: { message: "Address cannot be empty" }
    });
  }

  //Get the balance of etherum
  web3.eth
    .getBalance(address)
    .then(balance => {
      ether = web3.utils.fromWei(balance, "ether");
      //console.log(Balance);

      let contractAddr = "0x5975993e36EaBeFFe58Cc254B17E61e6a37a3a19"; //Address of token
      let userEthAddress = address.substring(2);
      let contractData = "0x70a08231000000000000000000000000" + userEthAddress;
      //Get balance of noble
      web3.eth.call(
        {
          to: contractAddr,
          data: contractData
        },
        (err, result) => {
          if (err) {
            // console.log(err);
            return res.status(400).json({
              success: false,
              data: {},
              error: { message: "Something Went wrong at Noble" }
            });
          }
          if (result) {
            //var tokens = web3.utils.toBN(result).toString();
            noble = web3.utils.fromWei(result, "ether");
            // console.log("Balance", Balance);
            // console.log("Tokens Owned: " + web3.utils.fromWei(tokens, "ether"));
            return res.status(200).json({
              success: true,
              data: { ether: ether, noble: noble },
              error: {}
            });
          }
        }
      );
    })
    .catch(err => {
      return res.status(400).json({
        success: false,
        data: {},
        error: { message: "Something Went Wrong" }
      });
    });
});

//@route POST web3/sendEther
//@desc POST send ether from one account to another
//@access Public
app.post("/web3/sendEther", (req, res) => {
  const account1 = req.body.sender; // Your account address 1
  const account2 = req.body.receiver; // Your account address 2
  const ether = req.body.amount;
  const gasPrice = req.body.gasPrice;
  const privateKey = req.body.privateKey.split("x")[1];
  // console.log(privateKey);
  //Checking values so that it cannot be empty
  if (
    account1 == "" ||
    account2 == "" ||
    privateKey == "" ||
    ether == "" ||
    gasPrice == ""
  ) {
    return res.status(400).json({
      success: false,
      data: {},
      error: { message: "One of the Input parameter is empty" }
    });
  }
  const privateKey1 = Buffer.from(privateKey, "hex"); //private key of sender account
  // console.log(privateKey1);
  //const privateKey2 = Buffer.from("YOUR_PRIVATE_KEY_2", "hex");

  web3.eth.getTransactionCount(account1, (err, txCount) => {
    if (err) {
      //console.log(err);
      return res.status(400).json({
        success: false,
        data: {},
        error: { message: "Something Went wrong" }
      });
    }
    // Build the transaction
    const txObject = {
      nonce: web3.utils.toHex(txCount),
      to: account2,
      value: web3.utils.toHex(web3.utils.toWei(ether.toString(), "ether")),
      gasLimit: web3.utils.toHex(21000),
      gasPrice: web3.utils.toHex(web3.utils.toWei(gasPrice.toString(), "gwei"))
    };
    //.log(txObject);
    // Sign the transaction
    const tx = new Tx(txObject);
    tx.sign(privateKey1);

    const serializedTx = tx.serialize();
    const raw = "0x" + serializedTx.toString("hex");

    // Broadcast the transaction
    web3.eth.sendSignedTransaction(raw, (err, txHash) => {
      if (err) {
        // console.log(err);
        return res.status(400).json({
          success: false,
          data: {},
          error: { message: "Transaction cannot be created" }
        });
      }
      // console.log("txHash:", txHash);
      // Now go check etherscan to see the transaction!
      return res
        .status(200)
        .json({ success: true, data: { txHash: txHash }, error: {} });
    });
  });
});

//@route POST web3/sendNob
//@desc POST send ether from one account to another
//@access Public
app.post("/web3/sendNob", (req, res) => {
  const account1 = req.body.sender; // Your account address 1
  const account2 = req.body.receiver; // Your account address 2
  const noble = req.body.amount * 1000000000000000000;
  const gasPrice = req.body.gasPrice;
  const privateKey = req.body.privateKey.split("x")[1];
  //Checking values so that it cannot be empty
  if (
    account1 == "" ||
    account2 == "" ||
    privateKey == "" ||
    noble == "" ||
    gasPrice == ""
  ) {
    return res.status(404).json({
      success: false,
      data: {},
      error: { message: "One of the Input parameter is empty" }
    });
  }
  const privateKey1 = Buffer.from(privateKey, "hex");
  // console.log("privateKey", privateKey1);
  const contractAddress = "0x5975993e36EaBeFFe58Cc254B17E61e6a37a3a19";
  const contractABI = [
    {
      constant: false,
      inputs: [],
      name: "freezeTransfers",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [],
      name: "name",
      outputs: [{ name: "", type: "string" }],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        { name: "_spender", type: "address" },
        { name: "_value", type: "uint256" }
      ],
      name: "approve",
      outputs: [{ name: "success", type: "bool" }],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: false,
      inputs: [{ name: "_newOwner", type: "address" }],
      name: "setOwner",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [],
      name: "totalSupply",
      outputs: [{ name: "supply", type: "uint256" }],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        { name: "_from", type: "address" },
        { name: "_to", type: "address" },
        { name: "_value", type: "uint256" }
      ],
      name: "transferFrom",
      outputs: [{ name: "success", type: "bool" }],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [],
      name: "decimals",
      outputs: [{ name: "", type: "uint8" }],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [],
      name: "unfreezeTransfers",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [{ name: "_owner", type: "address" }],
      name: "balanceOf",
      outputs: [{ name: "balance", type: "uint256" }],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [{ name: "_value", type: "uint256" }],
      name: "createTokens",
      outputs: [{ name: "success", type: "bool" }],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        { name: "_token", type: "address" },
        { name: "_refund", type: "address" },
        { name: "_value", type: "uint256" }
      ],
      name: "refundTokens",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [],
      name: "symbol",
      outputs: [{ name: "", type: "string" }],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        { name: "_to", type: "address" },
        { name: "_value", type: "uint256" }
      ],
      name: "transfer",
      outputs: [{ name: "success", type: "bool" }],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [
        { name: "_owner", type: "address" },
        { name: "_spender", type: "address" }
      ],
      name: "allowance",
      outputs: [{ name: "remaining", type: "uint256" }],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        { name: "_target", type: "address" },
        { name: "freeze", type: "bool" }
      ],
      name: "freezeAccount",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "constructor"
    },
    { anonymous: false, inputs: [], name: "Freeze", type: "event" },
    { anonymous: false, inputs: [], name: "Unfreeze", type: "event" },
    {
      anonymous: false,
      inputs: [
        { indexed: false, name: "target", type: "address" },
        { indexed: false, name: "frozen", type: "bool" }
      ],
      name: "FrozenFunds",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        { indexed: false, name: "_token", type: "address" },
        { indexed: false, name: "_refund", type: "address" },
        { indexed: false, name: "_value", type: "uint256" }
      ],
      name: "RefundTokens",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: "_from", type: "address" },
        { indexed: true, name: "_to", type: "address" },
        { indexed: false, name: "_value", type: "uint256" }
      ],
      name: "Transfer",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: "_owner", type: "address" },
        { indexed: true, name: "_spender", type: "address" },
        { indexed: false, name: "_value", type: "uint256" }
      ],
      name: "Approval",
      type: "event"
    }
  ];
  const contract = new web3.eth.Contract(contractABI, contractAddress);
  // const data = contract.methods.transfer(account2, 1000).encodeABI();
  // console.log(data);

  web3.eth.getTransactionCount(account1, (err, txCount) => {
    if (err) {
      // console.log(err);
      return res.status(400).json({
        success: false,
        data: {},
        error: { message: "Something Went wrong" }
      });
    }
    //conversion of noble to string
    newNoble = noble.toString();

    // Build the transaction
    const txObject = {
      nonce: web3.utils.toHex(txCount),
      gasLimit: web3.utils.toHex(50000), // Raise the gas limit to a much higher amount
      gasPrice: web3.utils.toHex(web3.utils.toWei(gasPrice.toString(), "gwei")),
      to: contractAddress,
      data: contract.methods.transfer(account2, newNoble).encodeABI()
    };

    const tx = new Tx(txObject);
    tx.sign(privateKey1);

    const serializedTx = tx.serialize();
    const raw = "0x" + serializedTx.toString("hex");

    web3.eth.sendSignedTransaction(raw, (err, txHash) => {
      if (err) {
        // console.log(err);
        return res.status(400).json({
          success: false,
          data: {},
          error: {
            message: "insufficient funds for gas * price + value"
          }
        });
      }
      // Use this txHash to find the contract on Etherscan!
      // Now go check etherscan to see the transaction!
      return res
        .status(200)
        .json({ success: true, data: { txHash: txHash }, error: {} });
    });
  });
});

//@route POST web3/sendbyaddr
//@desc Get all the transaction by address
//@access Public
app.post("/web3/sendbyaddr", async (req, res) => {
  let contractAddress = req.body.contract.toString().trim();
  const account1 = req.body.sender.trim(); // Your account address 1
  const account2 = req.body.receiver.trim(); // Your account address 2
  const noble = parseInt(req.body.amount, 10) * 1000000000000000000;
  const gasPrice = req.body.gasPrice;
  const privateKey = req.body.privateKey.split("x")[1];

  //Checking values so that it cannot be empty
  if (
    contractAddress == "" ||
    account1 == "" ||
    account2 == "" ||
    privateKey == "" ||
    noble == "" ||
    gasPrice == ""
  ) {
    return res.status(404).json({
      success: false,
      data: {},
      error: { message: "One of the Input parameter is empty" }
    });
  }
  const privateKey1 = Buffer.from(privateKey, "hex");
  console.log(privateKey1);
  //Ether scan API
  const url = `https://api.etherscan.io/api?module=contract&action=getabi&address=${contractAddress}&apikey=SXB52YHQYXZMHQXBTG9VNZU27TD4H6MJWF`;
  try {
    const response = await axios.get(url);
    const writeFiles = await writeFile(
      "./abi/abiaddr.json",
      response.data.result
    );
    const read = await readFile("./abi/abiaddr.json");
    const data = JSON.parse(read);
    const contract = new web3.eth.Contract(data, contractAddress);
    web3.eth.getTransactionCount(account1, (err, txCount) => {
      if (err) {
        console.log(err);
        return res.status(400).json({
          success: false,
          data: {},
          error: { message: "Something Went wrong" }
        });
      }
      //conversion of noble to string
      newNoble = noble.toString();

      // Build the transaction
      const txObject = {
        nonce: web3.utils.toHex(txCount),
        gasLimit: web3.utils.toHex(50000), // Raise the gas limit to a much higher amount
        gasPrice: web3.utils.toHex(
          web3.utils.toWei(gasPrice.toString(), "gwei")
        ),
        to: contractAddress,
        data: contract.methods.transfer(account2, newNoble).encodeABI()
      };

      const tx = new Tx(txObject);
      tx.sign(privateKey1);

      const serializedTx = tx.serialize();
      const raw = "0x" + serializedTx.toString("hex");

      web3.eth.sendSignedTransaction(raw, (err, txHash) => {
        if (err) {
          console.log(err);
          return res.status(400).json({
            success: false,
            data: {},
            error: {
              message: "insufficient funds for gas * price + value"
            }
          });
        }
        // Use this txHash to find the contract on Etherscan!
        // Now go check etherscan to see the transaction!
        return res
          .status(200)
          .json({ success: true, data: { txHash: txHash }, error: {} });
      });
    });
  } catch (e) {
    console.log(e);
    return res.status(400).send(e);
  }
});

//@route POST web3/addtoken
//@desc Get all the transaction by address
//@access Public
app.post("/web3/tokeninfo", async (req, res) => {
  let contractAddress = req.body.contract.toString().trim();
  if (
    contractAddress == null ||
    contractAddress == "" ||
    contractAddress == undefined
  ) {
    return res
      .status(400)
      .json({ status: 0, message: "contract address cannot be empty" });
  }
  //Ether scan API
  const url = `https://api.etherscan.io/api?module=contract&action=getabi&address=${contractAddress}&apikey=YOUR_API_KEY`;
  try {
    const data = await fetchAbi(url);
    const contract = new web3.eth.Contract(data, contractAddress);
    contract.methods
      .decimals()
      .call()
      .then(suc => {
        let decimal = suc;
        if (suc._hex) {
          decimal = web3.utils.hexToNumber(suc._hex);
        }
        // console.log(decimal);
        contract.methods
          .name()
          .call()
          .then(name => {
            if (web3.utils.isHex(name)) {
              name = web3.utils.hexToString(name);
            }
            let result = {
              status: "1",
              message: "OK",
              result: { decimal, name }
            };
            //console.log(name);
            return res.status(200).send(result);
          })
          .catch(err => {
            return res.status(404).json(err);
          });
      })
      .catch(err => {
        return res.status(404).json(err);
      });
    //return res.status(200).send(data);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

//@route POST web3/history
//@desc Get all the transaction by address
//@access Public
app.get("/web3/history", (req, res) => {
  const { address } = req.body;
  //console.log(address);
  let url = `http://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=YOUR_API_KEY`;
  axios
    .get(url)
    .then(response => {
      return res.status(200).json(response.data);
    })
    .catch(error => {
      return res.status(404).json(error);
    });
});

//@route GET web3/market
//@desc Get all the coins
//@access Public
app.get("/web3/market", async (req, res) => {
  try {
    let data = await CoinGeckoClient.coins.markets({
      vs_currency: "usd",
      price_change_percentage: "1h,24h",
      order: "market_cap_desc"
    });
    return res.status(200).send(data);
  } catch (e) {
    return res.status(400).send(e.message);
  }
});

//@route GET web3/news
//@desc Get News
//@access Public
app.get("/web3/news", async (req, res) => {
  try {
    //const news = await Api.getTopNews();
    const bitcoin = await Api.getTopNewsByCoin("bitcoin");
    // Get coin details for ethereum
    // const ethereum = await Api.getCoinDetails("ethereum");
    const btcNews = bitcoin.map(news => {
      return {
        Description: news.description,
        Title: news.title,
        URL: news.url,
        Thumbnail: news.thumbnail,
        publishedAt: news.publishedAt
      };
    });

    return res.status(200).json({ success: true, data: btcNews, Error: {} });
  } catch (e) {
    console.log(e);
    return res.status(400).json({ Error: e.message });
  }
});

//@route POST web3/price
//@desc Get Current price of token
//@access Public
app.post("/web3/price", async (req, res) => {
  /* Example in Node.js ES6 using request-promise */
  const symbol = req.body.symbol.toString().toUpperCase();
  //cost Price in USD @ user bought token
  const pastPrice = req.body.rate * parseInt(req.body.token, 10);
  //Parameters pass with coinmarketapp API
  const requestOptions = {
    method: "GET",
    uri: "https://pro-api.coinmarketcap.com/v1/tools/price-conversion",
    qs: {
      //id: "1",
      symbol,
      amount: req.body.token, //An amount of currency to convert. Example: 10.43
      convert: "USD"
    },
    headers: {
      "X-CMC_PRO_API_KEY": "db0b3a88-8427-471d-90fa-724417ae6723"
    },
    json: true,
    gzip: true
  };

  try {
    const response = await rp(requestOptions);
    const currentPrice = response["data"]["quote"]["USD"].price; //Current price in USD of token in USD
    console.log("Past Price", pastPrice);
    console.log("Current Price", currentPrice);
    //Calculate gain or loss
    const gainOrloss =
      pastPrice < currentPrice
        ? currentPrice - pastPrice
        : pastPrice - currentPrice;
    // data = {
    //   gain: pastPrice < currentPrice ? gainOrloss : 0,
    //   loss: pastPrice > currentPrice ? gainOrloss : 0
    // };
    console.log(gainOrloss);
    return res.status(200).json({
      success: true,
      data: {
        gain: pastPrice < currentPrice ? gainOrloss : 0,
        loss: pastPrice > currentPrice ? gainOrloss : 0,
        //Gain Percent
        gainPercent:
          pastPrice < currentPrice
            ? ((currentPrice - pastPrice) / pastPrice) * 100
            : 0,
        //Loss Percent
        lossPercent:
          pastPrice > currentPrice
            ? ((pastPrice - currentPrice) / pastPrice) * 100
            : 0
      },
      error: {}
    });
    //return res.status(200).send(response);
  } catch (e) {
    return res.status(400).json({
      success: true,
      data: {},
      error: e.message
    });
  }
});

async function fetchAbi(url) {
  try {
    const response = await axios.get(url);
    await writeFile("./abi.json", response.data.result);
    const read = await readFile("abi.json");
    return JSON.parse(read);
  } catch (e) {
    return e;
  }
}
app.listen(process.env|| 3000, () => {
  console.log("App is running at port 3000");
});
