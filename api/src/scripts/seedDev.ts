import { hashPassword, Role } from '../auth/auth.js';
import { connectMongo, disconnectMongo } from '../db.js';
import { PartnerModel } from '../models/Partner.js';
import { UserModel } from '../models/User.js';
import { VehicleModel } from '../models/Vehicle.js';

async function main() {
  await connectMongo();

  const partnerName = process.env.SEED_PARTNER_NAME ?? 'Demo Yard';
  const staffPhone = process.env.SEED_STAFF_PHONE ?? '+254700000000';
  const staffPassword = process.env.SEED_STAFF_PASSWORD ?? 'Passw0rd!Passw0rd!';

  const partner =
    (await PartnerModel.findOne({ name: partnerName })) ??
    (await PartnerModel.create({ name: partnerName, verified: true }));

  const existingStaff = await UserModel.findOne({ phone: staffPhone });
  if (!existingStaff) {
    const passwordHash = await hashPassword(staffPassword);
    await UserModel.create({
      phone: staffPhone,
      name: 'Demo Staff',
      passwordHash,
      roles: [Role.PARTNER_STAFF],
      partnerId: partner._id
    });
  }

  const demoVehicles = ['Toyota Premio', 'Subaru Forester', 'Nissan Note'];
  for (const title of demoVehicles) {
    const exists = await VehicleModel.findOne({ partnerId: partner._id, title }).lean();
    if (!exists) {
      await VehicleModel.create({ partnerId: partner._id, title });
    }
  }

  // eslint-disable-next-line no-console
  console.log('Seeded:');
  // eslint-disable-next-line no-console
  console.log(`- Partner: ${partnerName} (${partner._id.toString()})`);
  // eslint-disable-next-line no-console
  console.log(`- Staff login: ${staffPhone} / ${staffPassword}`);
}

main()
  .then(disconnectMongo)
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await disconnectMongo();
    process.exit(1);
  });

