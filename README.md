# Spritz Finance Take-Home Test

## Technical Support Engineer (Tier 3) Assessment

This take-home test evaluates your TypeScript abilities, understanding of Web3 concepts, and payment flows. As Spritz Finance enables users to spend their crypto in the real world, this assessment focuses on core functionalities around payment processing and blockchain event handling.

## Project Overview

The project simulates a simplified version of Spritz's payment flow:

1. A user creates a payment via API
2. The user submits a transaction to the blockchain
3. Your task is to implement the system that detects this transaction and processes the payment

## Core Requirements

### 1. Blockchain Event Listener

- Implement the event listener to detect the `Payment` event from Spritz's smart contract
- Reference transaction for event structure: [Example TX](https://etherscan.io/tx/0x5db01a1daf2a2a226a35e50e212888be4efaa6f725be7bb25e2d6aa25f87fc7f)
- Extract the payment reference from the event (corresponds to payment `_id` in database)

### 2. Payment Processing

- Implement payment processing using Method's API
- API Documentation: https://docs.methodfi.com/reference/payments/create
- Explore the docs and create a mock client for Method's API (actual API access not provided)
- Focus on proper error handling

### 3. Webhook Handler

- Implement a webhook handler to receive payment status updates
- Review Method's webhook documentation
- Handle relevant webhook events appropriately

## Technical Notes

### Project Setup

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Start MongoDB:

   ```bash
   docker-compose up -d
   ```

### Testing

- Project uses Vitest for testing
- MongoDB memory server is configured for tests
- Write unit tests for individual components
- End-to-end testing is not required

### Project Structure

- `/src/payments/` - Payment-related functionality
- `/src/blockchain-listener/` - Blockchain event listener implementation
- `/src/lib/` - Utility functions and shared code

## Evaluation Criteria

1. **Code Quality**

   - TypeScript usage and type safety
   - Clean, maintainable code
   - Error handling
   - Project structure

2. **Technical Understanding**

   - Web3 concepts and blockchain interaction
   - Payment processing flows
   - API integration and mocking
   - Webhook handling

3. **Problem Solving**
   - Breaking down complex requirements
   - Creating working components without being able to test end-to-end
   - Edge case handling
   - Documentation and code comments

## Important Notes

- This is not an end-to-end project. We will not be running the final submission - instead, we will be reviewing your code implementation of the three core components:
  1. Blockchain event detection
  2. Payment issuance
  3. Webhook handling
- Create any additional database models as needed
- Mock external services appropriately
- Document assumptions and design decisions
- Quality over quantity - focus on robust implementation of core features

## Submission

1. Fork this repository
2. Make your forked repository private
3. Add `laurence@spritz.finance` as a collaborator to your private repository
4. Implement the required functionality
5. Document your implementation decisions
6. Submit a pull request with your solution

## Questions?

If you have any questions about the requirements or implementation details, please reach out to the Spritz team.

Good luck!
