import mongoose from 'mongoose'
import { afterAll, beforeAll } from 'vitest'
import { setup, teardown } from 'vitest-mongodb'

beforeAll(async () => {
  await setup({
    serverOptions: {
      binary: {
        version: '6.0.6',
      },
    },
  })
  await mongoose.connect(global.__MONGO_URI__)
})

afterAll(async () => {
  await mongoose.connection.close()
  await teardown()
})
