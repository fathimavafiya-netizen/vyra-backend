import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Check if admin already exists
    let admin = await prisma.user.findUnique({
      where: { email: 'admin@vyra.com' }
    });

    if (admin) {
      // Ensure role is ADMIN
      await prisma.user.update({
        where: { email: 'admin@vyra.com' },
        data: { role: 'ADMIN', password: hashedPassword }
      });
      console.log('Admin user updated successfully.');
    } else {
      // Create new admin
      admin = await prisma.user.create({
        data: {
          email: 'admin@vyra.com',
          password: hashedPassword,
          role: 'ADMIN',
          profile: {
            create: {
              name: 'System Admin',
              username: 'admin',
              bio: 'System Administrator',
            }
          },
          settings: {
            create: {}
          }
        }
      });
      console.log('Admin user created successfully.');
    }
    console.log('--- ADMIN CREDENTIALS ---');
    console.log('Email: admin@vyra.com');
    console.log('Password: admin123');
    console.log('-------------------------');
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
