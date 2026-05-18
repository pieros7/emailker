import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { Role } from './users/enums/role.enum';
import * as bcrypt from 'bcrypt';

async function createAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  // Puedes cambiar estos valores o pasarlos por variables de entorno
  const email = process.env.ADMIN_EMAIL || 'admin@admin.com';
  const password = process.env.ADMIN_PASSWORD || '12345678';
  const name = 'Administrador';

  const existingUser = await usersService.findByEmail(email);
  if (existingUser) {
    console.log(`User ${email} already exists!`);
    await app.close();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await usersService.create({
    email,
    name,
    passwordHash,
    role: Role.ADMIN,
  });

  console.log('-----------------------------------');
  console.log('✅ Admin user created successfully!');
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
  console.log('-----------------------------------');

  await app.close();
}

createAdmin().catch((err) => {
  console.error('❌ Error creating admin:', err);
  process.exit(1);
});
