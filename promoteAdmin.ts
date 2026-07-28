import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAccounts() {
  const hashedTester = await bcrypt.hash('Tester@123', 10);
  const hashedAdmin  = await bcrypt.hash('Admin@sociall123', 10);

  // ── 1. Test account ──────────────────────────────────────────────────────────
  const existingTester = await prisma.user.findFirst({ where: { email: 'tester@sociall.com' } });
  if (existingTester) {
    console.log('ℹ️  tester@sociall.com already exists – skipping creation.');
  } else {
    await prisma.user.create({
      data: {
        email: 'tester@sociall.com',
        password: hashedTester,
        role: 'USER',
        isActive: true,
        profile: {
          create: {
            name: 'Sociall Tester',
            username: 'sociall_tester',
            bio: 'QA Test Account',
            profilePic: 'https://ui-avatars.com/api/?name=Sociall+Tester&background=6C3CE9&color=fff',
          },
        },
        settings: { create: {} },
      },
    });
    console.log('✅ Created tester@sociall.com  (role: USER)');
  }

  // ── 2. Admin account ─────────────────────────────────────────────────────────
  const existingAdmin = await prisma.user.findFirst({ where: { email: 'admin@sociall.com' } });
  if (existingAdmin) {
    // Just promote if already exists but is not yet ADMIN
    if (existingAdmin.role !== 'ADMIN') {
      await prisma.user.update({ where: { id: existingAdmin.id }, data: { role: 'ADMIN' } });
      console.log('✅ Promoted existing admin@sociall.com to ADMIN');
    } else {
      console.log('ℹ️  admin@sociall.com already exists as ADMIN – skipping.');
    }
  } else {
    await prisma.user.create({
      data: {
        email: 'admin@sociall.com',
        password: hashedAdmin,
        role: 'ADMIN',
        isActive: true,
        profile: {
          create: {
            name: 'Sociall Admin',
            username: 'sociall_admin',
            bio: 'Platform Administrator',
            profilePic: 'https://ui-avatars.com/api/?name=Sociall+Admin&background=FF5C8A&color=fff',
          },
        },
        settings: { create: {} },
      },
    });
    console.log('✅ Created admin@sociall.com  (role: ADMIN)');
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const tester = await prisma.user.findFirst({ where: { email: 'tester@sociall.com' }, include: { profile: true } });
  const admin  = await prisma.user.findFirst({ where: { email: 'admin@sociall.com'  }, include: { profile: true } });

  console.log('\n─────────────────────────────────────────');
  console.log('ACCOUNT SUMMARY');
  console.log('─────────────────────────────────────────');
  console.log(`Tester  │ email: tester@sociall.com  │ pass: Tester@123    │ role: ${tester?.role}`);
  console.log(`Admin   │ email: admin@sociall.com   │ pass: Admin@sociall123 │ role: ${admin?.role}`);
  console.log('─────────────────────────────────────────');
}

createAccounts()
  .catch((e) => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
