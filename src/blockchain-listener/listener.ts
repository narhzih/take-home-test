import { isValidChain, Chain } from '../lib/networks'
import { onListenerTick } from './services/onListenerTick'
import { BlockchainPayment } from './types'

/**
 * Configuration options for the blockchain listener
 */
export interface ListenerConfig {
  intervalMs?: number
  maxRetries?: number
  retryDelayMs?: number
  maxBlockRange?: number
  startBlockNumber?: number
}

/**
 * Event types that can be emitted by the listener
 */
export type ListenerEvent =
  | { type: 'payment'; data: BlockchainPayment }
  | { type: 'error'; error: Error }
  | { type: 'block'; blockNumber: number }

/**
 * Listener state interface
 */
interface ListenerState {
  lastProcessedBlock: number
  lastSyncTime: Date
  errors: Array<{ timestamp: Date; error: Error }>
  retryCount: number
}

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
  private static readonly MIN_INTERVAL = 1_000 // 1 second
  private static readonly MAX_INTERVAL = 300_000 // 5 minutes
  private static readonly DEFAULT_MAX_RETRIES = 3
  private static readonly DEFAULT_RETRY_DELAY = 5_000 // 5 seconds
  private static readonly DEFAULT_MAX_BLOCK_RANGE = 1_000

  private readonly config: Required<ListenerConfig>
  private state: ListenerState
  private eventHandlers: Map<string, Array<(event: ListenerEvent) => void>> = new Map()

  private constructor(chain: Chain, config: ListenerConfig = {}) {
    this.chain = chain
    this.config = {
      intervalMs: config.intervalMs ?? 60000,
      maxRetries: config.maxRetries ?? BlockchainListener.DEFAULT_MAX_RETRIES,
      retryDelayMs: config.retryDelayMs ?? BlockchainListener.DEFAULT_RETRY_DELAY,
      maxBlockRange: config.maxBlockRange ?? BlockchainListener.DEFAULT_MAX_BLOCK_RANGE,
      startBlockNumber: config.startBlockNumber ?? 0,
    }
    this.state = {
      lastProcessedBlock: this.config.startBlockNumber,
      lastSyncTime: new Date(),
      errors: [],
      retryCount: 0,
    }
  }

  /**
   * Gets the singleton instance of BlockchainListener
   * @param chain - The blockchain network to listen to
   * @param config - Optional configuration for the listener
   * @returns BlockchainListener instance
   * @throws {BlockchainListenerError} If trying to create a new instance with different chain
   */
  public static getInstance(chain: Chain, config?: ListenerConfig): BlockchainListener {
    if (!BlockchainListener.instance) {
      BlockchainListener.instance = new BlockchainListener(chain, config)
    } else if (BlockchainListener.instance.chain !== chain) {
      throw new BlockchainListenerError(
        `Listener already initialized for ${BlockchainListener.instance.chain}. Cannot create new instance for ${chain}`,
      )
    }
    return BlockchainListener.instance
  }

  /**
   * Subscribe to listener events
   * @param eventType - Type of event to subscribe to
   * @param handler - Event handler function
   */
  public on(eventType: ListenerEvent['type'], handler: (event: ListenerEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType) ?? []
    handlers.push(handler)
    this.eventHandlers.set(eventType, handlers)
  }

  /**
   * Emit an event to all registered handlers
   * @private
   */
  private emit(event: ListenerEvent): void {
    const handlers = this.eventHandlers.get(event.type) ?? []
    handlers.forEach((handler) => handler(event))
  }

  /**
   * Get the current listener state
   */
  public getState(): Readonly<ListenerState> {
    return { ...this.state }
  }

  /**
   * Starts the blockchain listening process
   * @throws {BlockchainListenerError} If listener is already running or invalid interval
   */
  public startListening(): void {
    if (this.isRunning) {
      throw new BlockchainListenerError('Listener is already running')
    }

    if (
      this.config.intervalMs < BlockchainListener.MIN_INTERVAL ||
      this.config.intervalMs > BlockchainListener.MAX_INTERVAL
    ) {
      throw new BlockchainListenerError(
        `Interval must be between ${BlockchainListener.MIN_INTERVAL}ms and ${BlockchainListener.MAX_INTERVAL}ms`,
      )
    }

    console.log(`🚀 Starting listener for ${this.chain} chain...`)
    this.isRunning = true
    void this.tick()
    this.intervalId = setInterval(() => void this.tick(), this.config.intervalMs)

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

      // If this was triggered by a signal (SIGINT/SIGTERM), exit the process
      if (process.listenerCount('SIGINT') > 0 || process.listenerCount('SIGTERM') > 0) {
        process.exit(0)
      }
    }
  }

  /**
   * Returns the current running status of the listener
   */
  public isListening(): boolean {
    return this.isRunning
  }

  /**
   * Executes a single tick of the listener with retry logic
   * @private
   */
  private async tick(): Promise<void> {
    try {
      const result = await onListenerTick(this.chain)

      // Update state
      this.state.lastProcessedBlock = result.lastProcessedBlock
      this.emit({ type: 'block', blockNumber: result.lastProcessedBlock })

      // Emit payment events if any
      result.payments.forEach((payment) => {
        this.emit({ type: 'payment', data: payment })
      })

      this.state.lastSyncTime = new Date()
      this.state.retryCount = 0
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error))
      console.error(`❌ Error during listener tick for ${this.chain}:`, typedError)

      // Handle retries
      this.state.errors.push({ timestamp: new Date(), error: typedError })
      this.emit({ type: 'error', error: typedError })

      if (this.state.retryCount < this.config.maxRetries) {
        this.state.retryCount++
        console.log(
          `🔄 Retrying in ${this.config.retryDelayMs}ms (attempt ${this.state.retryCount}/${this.config.maxRetries})`,
        )
        setTimeout(() => void this.tick(), this.config.retryDelayMs)
      } else {
        console.error(`❌ Max retries (${this.config.maxRetries}) reached, stopping listener`)
        this.stopListening()
      }
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
    const listener = BlockchainListener.getInstance(chain, {
      intervalMs: 60000,
      maxRetries: 3,
      retryDelayMs: 5000,
      maxBlockRange: 1000,
    })

    // Example event handlers
    listener.on('error', (event) => {
      if (event.type === 'error') {
        console.error('🚨 Listener error:', event.error)
      }
    })

    listener.on('block', (event) => {
      if (event.type === 'block') {
        console.log(`📦 Processed block ${event.blockNumber}`)
      }
    })

    listener.startListening()
  } catch (error) {
    console.error('❌ Failed to start listener:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

export default BlockchainListener
