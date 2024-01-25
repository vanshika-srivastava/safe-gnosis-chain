import React, { useEffect, useState } from "react";
import { SafeAuthPack, SafeAuthConfig, SafeAuthInitOptions,AuthKitSignInData,SafeAuthUserInfo } from "@safe-global/auth-kit"
import { ethers, BrowserProvider } from "ethers";
import Safe, { EthersAdapter, SafeFactory } from "@safe-global/protocol-kit";
import { GelatoRelayPack } from '@safe-global/relay-kit';
import { ToastContainer, toast } from "react-toastify";
import Box from '@mui/system/Box';
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { OperationType } from "@safe-global/safe-core-sdk-types";


function App() {
  const [safeAuth, setSafeAuth] = useState(null);
  const [userInfo, setUserInfo] = useState();
  const [provider, setProvider] = useState();
  const [currentSigner, setCurrentSigner] = useState(null);
  const [safeAuthSignInResponse, setSafeAuthSignInResponse] = useState();
  const [balanceEOA, setBalanceEOA] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [chainId, setChainId] = useState();
  const [userDestinationAddress, setUserDestinationAddress] = useState('');
  const [safeBalance, setSafeBalance] = useState('');
  
  const GELATO_1_BALANCE = import.meta.env.VITE_BALANCE_API_KEY;
 

  useEffect(() => {
    const initSafeAuthPack = async () => {
      try {
        const safeAuthInitOptions = {
          showWidgetButton: true,
          enableLogging: true,
          buttonPosition: "top-right",
          buildEnv: "production",
          chainConfig: {
            chainId: "0x64",
            displayName: "Gnosis",
            rpcTarget: 'https://gnosis.drpc.org',
            blockExplorerURL: 'https://gnosisscan.io/',
            ticker: "xDAI",
            tickerName: "Gnosis Chain",
          },
        };

        const safeAuthPack = new SafeAuthPack();

        await safeAuthPack.init(safeAuthInitOptions);
        setSafeAuth(safeAuthPack);

        if (safeAuthPack.isAuthenticated) {
          const signInInfo = await safeAuthPack?.signIn();
          setSafeAuthSignInResponse(signInInfo);
          setProvider(safeAuthPack.getProvider());
          setIsAuthenticated(true);
          toast.success("Initialization and auto-login successful!");
          
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to initialize SafeAuthPack,try again!");
      }
    };

    initSafeAuthPack();
  }, []);

  useEffect(() => {
    if (!safeAuth || !isAuthenticated) return;
    (async () => {
      const web3Provider = safeAuth.getProvider();
      const userInfo = await safeAuth.getUserInfo();
      console.log(userInfo);
      setUserInfo(userInfo);

      
      if (web3Provider) {
        const provider = new BrowserProvider(safeAuth.getProvider());
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();

        setChainId((await provider?.getNetwork()).chainId.toString());
        setBalanceEOA(ethers.formatEther(await provider.getBalance(signerAddress)));
        setProvider(provider);
        setCurrentSigner(signer);

      if (safeAuthSignInResponse?.safes?.length > 0) {
        const safeAdapter = new EthersAdapter({
        ethers,
        signerOrProvider: signer,
          });
        const safe = await Safe.create({
            ethAdapter: safeAdapter,
            safeAddress: safeAuthSignInResponse?.safes[0],
          });
        const safeBalance = ethers.formatEther(await safe.getBalance());
        setSafeBalance(safeBalance);

        
      }}
    })();
  }, [isAuthenticated]);

  const loginOrOut = async () => {
    try {
      if (isAuthenticated) {
        await safeAuth?.signOut();
        setSafeAuthSignInResponse(null);
        setIsAuthenticated(false);
        toast.success("Logged out Successfully!");
      } else {
        const signInInfo = await safeAuth?.signIn();
        setSafeAuthSignInResponse(signInInfo);
        setIsAuthenticated(!!signInInfo);
        toast.success("Logged in Successfully!")
       
      }
    } catch (error) {
      console.error('Error during login or logout:', error);
      toast.error("An error occurred during login or logout.");
    }
  };

  const createSafe = async () => {
    if (!safeAuthSignInResponse?.eoa) {
      toast.error("No EOA (Externally Owned Account) available to create a Safe.");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(safeAuth?.getProvider());
      const signer = await provider.getSigner();
      const ethAdapter = new EthersAdapter({
        ethers,
        signerOrProvider: signer,
      });

      const safeFactory = await SafeFactory.create({ ethAdapter });

      const safe = await safeFactory.deploySafe({
        safeAccountConfig: { threshold: 1, owners: [safeAuthSignInResponse?.eoa] },
      });

      const safeAddress = await safe.getAddress();
      console.log("SAFE Created!", safeAddress);
      toast.success(`Safe created successfully! Safe Address: ${safeAddress}`);

      // Fetch and update Safe balance after creating the Safe
      const safeAdapter = new EthersAdapter({
        ethers,
        signerOrProvider: provider,
      });
      const createdSafe = await Safe.create({
        ethAdapter: safeAdapter,
        safeAddress: safeAddress,
      });
      const createdSafeBalance = ethers.formatEther(await createdSafe.getBalance());
      setSafeBalance(createdSafeBalance);
    } catch (error) {
      console.error("Error creating Safe:", error);
      toast.error("Couldn't create a Safe account. Please try again.");
    }
  };

  const handleDestinationAddressChange = (event) => {
    setUserDestinationAddress(event.target.value);
  };

  const updateBalances = async () => {
    // Update EOA balance
    const updatedEOABalance = ethers.formatEther(await provider.getBalance(currentSigner));
    setBalanceEOA(updatedEOABalance);
  
    // Update Safe balance
    if (safeAuthSignInResponse?.safes?.length > 0) {
      const safeAdapter = new EthersAdapter({
        ethers,
        signerOrProvider: currentSigner,
      });
  
      const safe = await Safe.create({
        ethAdapter: safeAdapter,
        safeAddress: safeAuthSignInResponse?.safes[0],
      });
  
      const updatedSafeBalance = ethers.formatEther(await safe.getBalance());
      setSafeBalance(updatedSafeBalance);
    }
  };

  const handleTransaction = async () => {
    try {
      const destinationAddress = userDestinationAddress;
      const withdrawAmount = ethers.parseUnits('0.0001', 'ether').toString();

      const transactions = [{
        to: destinationAddress,
        value: withdrawAmount,
        data: '0x',
        operation: OperationType.Call,
      }];

      const ethAdapter = new EthersAdapter({
        ethers,
        signerOrProvider: currentSigner,
      });

      const protocolKit = await Safe.create({
        ethAdapter,
        safeAddress: safeAuthSignInResponse?.safes[0],
      });

     

      const relayKit = new GelatoRelayPack({ apiKey: GELATO_1_BALANCE, protocolKit });

      const safeTransaction = await relayKit.createRelayedTransaction({
        transactions,
        options: { isSponsored: true, gasLimit: '100000' },
      });

      const signedSafeTransaction = await protocolKit.signTransaction(safeTransaction);

      const response = await relayKit.executeRelayTransaction(signedSafeTransaction, { isSponsored: true });
      console.log(`Relay Transaction Task ID: https://relay.gelato.digital/tasks/status/${response.taskId}`);
      
      const transactionHash = response.taskId;
      console.log(`Transaction Hash: ${transactionHash}`);

      updateBalances()
      if (transactionHash){
        toast.success("Successfully sent transaction");
        toast.success(`Check Transaction Hash: https://gnosisscan.io/address/${transactionHash}}`)

      }
    
      
    } catch (error) {
      console.error('Error handling Gelato Relay transaction:', error);
      console.error('Error details:', error.response?.data);
      toast.error("Unable to send transaction")
    }


  };

  // Helper function to truncate Ethereum address
const truncateAddress = (address, prefixLength = 6, suffixLength = 4) => {
  if (!address || address.length <= prefixLength + suffixLength) {
    return address;
  }

  const prefix = address.slice(0, prefixLength);
  const suffix = address.slice(-suffixLength);
  return `${prefix}...${suffix}`;
};


  const loggedInContent = (
    <>
      <div className="bar">
        <div className="upper-container">
          {isAuthenticated && !safeAuthSignInResponse?.safes?.length && (
            <button onClick={createSafe}>Create Safe</button>
          )}
          <button>Safe Balance : {safeBalance}</button>
          <button>EOA Balance : {balanceEOA}</button>
          {provider && safeAuthSignInResponse?.eoa && (
            <button>
              Your EOA:{' '}
              <a href={`https://gnosisscan.io/address/${safeAuthSignInResponse?.eoa}`} target="_blank" rel="noreferrer">
                {truncateAddress(safeAuthSignInResponse?.eoa)}
              </a>
            </button>
          )}
          {provider && safeAuthSignInResponse?.safes?.length && (
            <>
              {safeAuthSignInResponse?.safes.map((safe, index) => (
                <button key={index}>
                  Safe Account:
                  <a href={`https://gnosisscan.io/address/${safe}`} target="_blank" rel="noreferrer">
                    {truncateAddress(safe)}
                  </a>
                </button>
              ))}
            </>
          )}
          <button onClick={loginOrOut}>{isAuthenticated ? 'Logout' : 'Login'}</button>
        </div>
      </div>

      <div className="grid">
        {provider && userInfo?.name ? <p><span className="waving-hand">👋</span>{'  '} Welcome {userInfo?.name}!</p> : null}
      </div>

      <div className="container">
        <input
          type="text"
          placeholder="Enter destination address"
          value={userDestinationAddress}
          onChange={handleDestinationAddressChange}
          className="card"
        />
        <p>
          <button onClick={handleTransaction}>Send Gasless Transaction</button>
        </p>
      </div>
    </>
  );

  const unloggedInContent = (
    <div>
      <button onClick={loginOrOut}>{isAuthenticated ? 'Logout' : 'Login'}</button>
    </div>
  );
  

  return (
    <div>
      <h1 className="title">
        <a target="_blank" href="https://web3auth.io/docs/sdk/pnp/web/modal" rel="noreferrer">
          Safe Account Abstraction{'  '}
        </a>
        on{'  '}
        <a target="_blank" href="https://docs.safe.global/safe-core-aa-sdk/auth-kit/reference" rel="noreferrer">
          Gnosis Chain
        </a>{' '}
        Demo
      </h1>
      <ToastContainer />
      {isAuthenticated ? loggedInContent : unloggedInContent}
      <div className="footer">
        <p> Made on Gnosis Chain by Vanshika {' '}
          <p>
            <a
              href="https://github.com/Web3Auth/web3auth-pnp-examples/tree/main/web-modal-sdk/account-abstraction/web3auth-safe-example"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source code
            </a>
          </p>
        </p>
      </div>
    </div>
  );
}

export default App;
