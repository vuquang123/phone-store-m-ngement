import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config()

async function main() {
  const { resetCashFlowData } = await import("@/lib/cash-flow/sheets")
  const result = await resetCashFlowData()
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
