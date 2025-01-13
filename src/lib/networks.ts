export enum Chain {
  Ethereum = 'ethereum',
  Polygon = 'polygon',
  Optimism = 'optimism',
  Arbitrum = 'arbitrum',
  Base = 'base',
  Binance = 'binance-smart-chain',
  Avalanche = 'avalanche',
}

export function isValidChain(chain: string): chain is Chain {
  return Object.values(Chain).includes(chain as Chain)
}
