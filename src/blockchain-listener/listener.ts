import { isValidChain, Chain } from '../lib/networks'
import { onListenerTick } from './services/onListenerTick'

/**
 * Custom error class for BlockchainListener related errors
 */
class BlockchainListenerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlockchainListenerError'
  }
}

/**
 * BlockchainListener class implements a singleton pattern to monitor blockchain events
 * for a specific chain at regular intervals.
 */
class BlockchainListener {
  private static instance: BlockchainListener | null = null
  private intervalId: NodeJS.Timeout | null = null
  private readonly chain: Chain
  private isRunning: boolean = false
  private static readonly MIN_INTERVAL = 1000 // 1 second
  private static readonly MAX_INTERVAL = 300000 // 5 minutes

  private constructor(chain: Chain) {
    this.chain = chain
  }

  /**
   * Gets the singleton instance of BlockchainListener
   * @param chain - The blockchain network to listen to
   * @returns BlockchainListener instance
   * @throws {BlockchainListenerError} If trying to create a new instance with different chain
   */
  public static getInstance(chain: Chain): BlockchainListener {
    if (!BlockchainListener.instance) {
      BlockchainListener.instance = new BlockchainListener(chain)
    } else if (BlockchainListener.instance.chain !== chain) {
      throw new BlockchainListenerError(
        `Listener already initialized for ${BlockchainListener.instance.chain}. Cannot create new instance for ${chain}`,
      )
    }
    return BlockchainListener.instance
  }

  /**
   * Starts the blockchain listening process
   * @param intervalMs - Interval in milliseconds between checks (default: 60000)
   * @throws {BlockchainListenerError} If listener is already running or invalid interval
   */
  public startListening(intervalMs: number = 60000): void {
    if (this.isRunning) {
      throw new BlockchainListenerError('Listener is already running')
    }

    if (
      intervalMs < BlockchainListener.MIN_INTERVAL ||
      intervalMs > BlockchainListener.MAX_INTERVAL
    ) {
      throw new BlockchainListenerError(
        `Interval must be between ${BlockchainListener.MIN_INTERVAL}ms and ${BlockchainListener.MAX_INTERVAL}ms`,
      )
    }

    console.log(`🚀 Starting listener for ${this.chain} chain...`)
    this.isRunning = true
    void this.tick()
    this.intervalId = setInterval(() => void this.tick(), intervalMs)

    // Setup graceful shutdown
    process.on('SIGTERM', () => this.stopListening())
    process.on('SIGINT', () => this.stopListening())
  }

  /**
   * Stops the blockchain listening process
   */
  public stopListening(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      this.isRunning = false
      console.log(`⏹️ Listener stopped for ${this.chain} chain`)
    }
  }

  /**
   * Returns the current running status of the listener
   */
  public isListening(): boolean {
    return this.isRunning
  }

  /**
   * Executes a single tick of the listener
   * @private
   */
  private async tick(): Promise<void> {
    try {
      await onListenerTick(this.chain)
    } catch (error) {
      console.error(`❌ Error during listener tick for ${this.chain}:`, error)
    }
  }

  /**
   * Resets the singleton instance (useful for testing)
   * @private
   */
  public static reset(): void {
    BlockchainListener.instance = null
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2)
  const chain = args[0]

  if (!chain) {
    console.error('❌ Please specify a chain: yarn start-listener <chain>')
    process.exit(1)
  }

  if (!isValidChain(chain)) {
    console.error(`❌ Invalid chain specified. Valid chains: ${Object.values(Chain).join(', ')}`)
    process.exit(1)
  }

  try {
    const listener = BlockchainListener.getInstance(chain)
    listener.startListening()
  } catch (error) {
    console.error('❌ Failed to start listener:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

export default BlockchainListener
