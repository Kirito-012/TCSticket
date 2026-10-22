/**
 * One-off: tickets that the drone re-check marked "verified" (verification.source = 'drone') move to the
 * new separate "drone verified" tag, and their manual Verified tag goes back to "not verified" (the manual
 * tag is for leads only). Safe to run twice.
 *
 *   node --env-file=.env.local --import tsx scripts/migrate-drone-verification.ts [--apply]
 */
import mongoose from 'mongoose'

async function main() {
  const apply = process.argv.includes('--apply')
  await mongoose.connect(process.env.MONGODB_URI!)
  const tickets = mongoose.connection.db!.collection('tickets')
  const rows = await tickets
    .find({ 'verification.status': 'verified', 'verification.source': 'drone' })
    .project({ number: 1, 'verification.verifiedAt': 1 })
    .toArray()
  console.log(
    `${apply ? 'Moving' : 'Would move'} ${rows.length} ticket(s):`,
    rows.map((r) => r.number).join(', ') || '-',
  )
  if (apply) {
    for (const r of rows) {
      await tickets.updateOne(
        { _id: r._id },
        {
          $set: {
            droneVerification: {
              status: 'verified',
              verifiedAt: r.verification?.verifiedAt ?? new Date(),
            },
            verification: {
              status: 'not_verified',
              verifiedAt: null,
              verifiedBy: null,
              source: null,
            },
          },
        },
      )
    }
    console.log('Done.')
  }
  process.exit(0)
}
main()
