import path from 'node:path'
import fs from 'node:fs'
import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createNoopSigner,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  IInstruction,
  partiallySignTransactionMessageWithSigners,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
} from '@solana/web3.js'
import {
  getCreateAccountInstruction,
  SYSTEM_PROGRAM_ADDRESS,
} from '@solana-program/system'

const keypairBytes = new Uint8Array(
  JSON.parse(
    fs.readFileSync(
      path.join(process.env.HOME!, 'solana-wallet', 'testing-1.json'),
      { encoding: 'utf-8' }
    )
  )
)
const programAddress = address('7pQmvvQpDmRnytFpn7aXCzG8q4mKBPSyjiHr1ZrNaPCu')
const rpc = createSolanaRpc('https://api.devnet.solana.com')
const rpcSubscriptions = createSolanaRpcSubscriptions(
  'ws://api.devnet.solana.com'
)
const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
})

const instructionData = Buffer.alloc(8)
instructionData.writeUInt8(4)

async function main() {
  const signer = await createKeyPairSignerFromBytes(keypairBytes)
  const andySigner = createNoopSigner(
    address('Andy1111111111111111111111111111111111111111')
  )
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

  // Accounts
  const programAccountSpace = BigInt(136)
  const programAccountKeypairSigner = await generateKeyPairSigner()
  const programAccountInstruction = getCreateAccountInstruction({
    lamports: await rpc
      .getMinimumBalanceForRentExemption(programAccountSpace)
      .send(),
    newAccount: programAccountKeypairSigner,
    payer: signer,
    programAddress: programAddress,
    space: programAccountSpace,
  })

  const instruction: IInstruction = {
    programAddress,
    accounts: [
      {
        address: address('6wafnUKC6UC8ExmgRGtuXDky1MnvApAi4QhXiAQZTGYk'),
        role: AccountRole.WRITABLE,
      },
      {
        address: andySigner.address,
        role: AccountRole.READONLY_SIGNER,
      },
      {
        address: SYSTEM_PROGRAM_ADDRESS,
        role: AccountRole.READONLY,
      },
      {
        address: signer.address,
        role: AccountRole.WRITABLE_SIGNER,
      },
    ],
    data: instructionData,
  }

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(signer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    // (tx) => appendTransactionMessageInstruction(programAccountInstruction, tx),
    (tx) => appendTransactionMessageInstruction(instruction, tx)
  )

  // * SENDING TRANSACTION

  //   const signedTransaction = await signTransactionMessageWithSigners(
  //     transactionMessage
  //   )

  //   await sendAndConfirmTransaction(signedTransaction, {
  //     commitment: 'confirmed',
  //   })

  //   const signature = getSignatureFromTransaction(signedTransaction)

  // * SIMULATION

  const signedTransaction = await partiallySignTransactionMessageWithSigners(
    transactionMessage
  )

  const encodedTransaction = getBase64EncodedWireTransaction(signedTransaction)

  const simulation = await rpc
    .simulateTransaction(encodedTransaction, { encoding: 'base64' })
    .send()

  console.log(simulation)
}

main()
