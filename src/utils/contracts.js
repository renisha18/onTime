import { CONTRACTS } from '../contracts/addresses';
import ArcTokenABI from '../contracts/abis/ArcTokenReward.json';
import BillSplitABI from '../contracts/abis/BillSplit.json';

export const getArcTokenContract = () => {
  console.log('Arc Token Address:', CONTRACTS.arcToken);
  console.log('Arc Token ABI length:', ArcTokenABI.length);
  
  return {
    address: CONTRACTS.arcToken,
    abi: ArcTokenABI,
  };
};

export const getBillSplitContract = () => {
  console.log('BillSplit Address:', CONTRACTS.billSplit);
  console.log('BillSplit ABI length:', BillSplitABI.length);
  
  return {
    address: CONTRACTS.billSplit,
    abi: BillSplitABI,
  };
};