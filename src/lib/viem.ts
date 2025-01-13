import { Chain as ViemChainConfig, PublicClient, createPublicClient, http } from 'viem'
import { arbitrum, avalanche, base, bsc, mainnet, optimism, polygon } from 'viem/chains'
import { Chain } from './networks'

const networkToViemChain: Record<Chain, ViemChainConfig> = {
  [Chain.Polygon]: polygon,
  [Chain.Ethereum]: mainnet,
  [Chain.Avalanche]: avalanche,
  [Chain.Arbitrum]: arbitrum,
  [Chain.Binance]: bsc,
  [Chain.Optimism]: optimism,
  [Chain.Base]: base,
}

export function createClientForChain(chain: Chain): PublicClient {
  return createPublicClient({
    chain: networkToViemChain[chain],
    transport: http(),
  })
}
