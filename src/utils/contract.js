import { CONTRACTS } from '../contracts/addresses';
import ArcTokenABI from '../contracts/abis/ArcRewardToken.json';
import BillSplitABI from '../contracts/abis/BillSplit.json';

export const getArcTokenContract = () => ({
  address: CONTRACTS.arcToken,
  abi: ArcTokenABI,
});

export const getBillSplitContract = () => ({
  address: CONTRACTS.billSplit,
  abi: BillSplitABI,
});