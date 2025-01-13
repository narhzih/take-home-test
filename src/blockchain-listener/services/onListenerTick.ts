import { Chain } from '../../lib/networks'

export async function onListenerTick(chain: Chain) {
  console.log(`Tick at ${new Date().toISOString()} for ${chain}`)
}
