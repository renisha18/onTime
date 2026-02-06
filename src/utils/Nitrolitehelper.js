// src/utils/nitroliteHelper.js
import { NitroliteClient } from '@erc7824/nitrolite';
import { createPublicClient, createWalletClient, http, custom } from 'viem';
import { sepolia } from 'viem/chains';

/**
 * Initialize Nitrolite client with proper error handling
 * @param {string} walletAddress - Connected wallet address
 * @returns {Promise<NitroliteClient|null>} Initialized client or null
 */
export async function initializeNitrolite(walletAddress) {
  try {
    console.log('🟡 [NitroliteHelper] Starting initialization...');
    console.log('🟡 [NitroliteHelper] Wallet address:', walletAddress);
    console.log('🟡 [NitroliteHelper] MetaMask available:', !!window.ethereum);

    if (!walletAddress) {
      throw new Error('No wallet address provided');
    }

    if (!window.ethereum) {
      throw new Error('MetaMask not detected');
    }

    // Create viem clients
    console.log('🟡 [NitroliteHelper] Creating viem public client...');
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
    });

    console.log('🟡 [NitroliteHelper] Creating viem wallet client...');
    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(window.ethereum),
      account: walletAddress,
    });

    console.log('🟡 [NitroliteHelper] Testing viem clients...');
    // Test clients work
    const blockNumber = await publicClient.getBlockNumber();
    console.log('✅ [NitroliteHelper] Public client working. Current block:', blockNumber);

    console.log('🟡 [NitroliteHelper] Creating Nitrolite client instance...');
    console.log('🟡 [NitroliteHelper] Nitrolite config:', {
      chainId: sepolia.id,
      hasPublicClient: !!publicClient,
      hasWalletClient: !!walletClient,
    });

    // Initialize Nitrolite client
    const client = new NitroliteClient({
      chainId: sepolia.id,
      publicClient,
      walletClient,
    });

    console.log('🟡 [NitroliteHelper] Nitrolite client created:', client);
    console.log('🟡 [NitroliteHelper] Client methods:', Object.keys(client));

    // Try to connect if connect method exists
    if (typeof client.connect === 'function') {
      console.log('🟡 [NitroliteHelper] Calling client.connect()...');
      await client.connect();
      console.log('✅ [NitroliteHelper] Successfully connected to ClearNode');
    } else {
      console.log('⚠️ [NitroliteHelper] No connect() method found, client may auto-connect');
    }

    console.log('✅ [NitroliteHelper] Nitrolite client fully initialized!');
    return client;

  } catch (error) {
    console.error('❌ [NitroliteHelper] Initialization failed');
    console.error('❌ [NitroliteHelper] Error type:', error.constructor.name);
    console.error('❌ [NitroliteHelper] Error message:', error.message);
    console.error('❌ [NitroliteHelper] Full error:', error);
    console.error('❌ [NitroliteHelper] Stack:', error.stack);
    return null;
  }
}

/**
 * Create a session with Nitrolite
 * @param {NitroliteClient} client - Initialized Nitrolite client
 * @param {object} metadata - Session metadata
 * @returns {Promise<string|null>} Session ID or null
 */
export async function createSession(client, metadata) {
  try {
    if (!client) {
      console.warn('⚠️ [NitroliteHelper] No client provided to createSession');
      return null;
    }

    console.log('🟡 [NitroliteHelper] Creating session...');
    console.log('🟡 [NitroliteHelper] Metadata:', metadata);

    // Check if createSession method exists
    if (typeof client.createSession !== 'function') {
      console.error('❌ [NitroliteHelper] client.createSession is not a function');
      console.error('❌ [NitroliteHelper] Available methods:', Object.keys(client));
      return null;
    }

    const session = await client.createSession({
      appName: 'OnTime-BillSplit',
      ...metadata,
    });

    console.log('✅ [NitroliteHelper] Session created:', session);
    
    // Handle different response formats
    const sessionId = session?.sessionId || session?.id || session;
    console.log('✅ [NitroliteHelper] Session ID:', sessionId);
    
    return sessionId;

  } catch (error) {
    console.error('❌ [NitroliteHelper] Failed to create session');
    console.error('❌ [NitroliteHelper] Error:', error);
    return null;
  }
}

/**
 * Send a payment message through Nitrolite
 * @param {NitroliteClient} client - Initialized Nitrolite client
 * @param {string} sessionId - Active session ID
 * @param {object} paymentData - Payment information
 * @returns {Promise<object|null>} Payment result or null
 */
export async function sendPayment(client, sessionId, paymentData) {
  try {
    if (!client || !sessionId) {
      console.warn('⚠️ [NitroliteHelper] Missing client or sessionId');
      return null;
    }

    console.log('🟡 [NitroliteHelper] Sending payment message...');
    console.log('🟡 [NitroliteHelper] Session:', sessionId);
    console.log('🟡 [NitroliteHelper] Payment data:', paymentData);

    // Try different method names
    let result;
    if (typeof client.sendMessage === 'function') {
      result = await client.sendMessage({
        sessionId,
        type: 'PAYMENT',
        data: paymentData,
      });
    } else if (typeof client.send === 'function') {
      result = await client.send({
        sessionId,
        type: 'PAYMENT',
        data: paymentData,
      });
    } else if (typeof client.executePayment === 'function') {
      result = await client.executePayment({
        sessionId,
        ...paymentData,
      });
    } else {
      console.error('❌ [NitroliteHelper] No payment method found on client');
      return null;
    }

    console.log('✅ [NitroliteHelper] Payment message sent:', result);
    return result;

  } catch (error) {
    console.error('❌ [NitroliteHelper] Failed to send payment');
    console.error('❌ [NitroliteHelper] Error:', error);
    return null;
  }
}

/**
 * Close a Nitrolite session
 * @param {NitroliteClient} client - Initialized Nitrolite client
 * @param {string} sessionId - Session to close
 * @returns {Promise<boolean>} Success status
 */
export async function closeSession(client, sessionId) {
  try {
    if (!client || !sessionId) {
      console.warn('⚠️ [NitroliteHelper] Missing client or sessionId');
      return false;
    }

    console.log('🟡 [NitroliteHelper] Closing session:', sessionId);

    if (typeof client.closeSession === 'function') {
      await client.closeSession({ sessionId });
    } else if (typeof client.close === 'function') {
      await client.close({ sessionId });
    } else if (typeof client.endSession === 'function') {
      await client.endSession({ sessionId });
    } else {
      console.warn('⚠️ [NitroliteHelper] No close method found');
      return false;
    }

    console.log('✅ [NitroliteHelper] Session closed successfully');
    return true;

  } catch (error) {
    console.error('❌ [NitroliteHelper] Failed to close session');
    console.error('❌ [NitroliteHelper] Error:', error);
    return false;
  }
}

export default {
  initializeNitrolite,
  createSession,
  sendPayment,
  closeSession,
};