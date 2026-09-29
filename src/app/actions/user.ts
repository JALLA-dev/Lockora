'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getLockoraUser() {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    return user || null;
  } catch (err: any) {
    console.error('[getLockoraUser Error]:', err?.message);
    return null;
  }
}

export async function updateUsername(username: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  
  // Format the username: lowercase, no spaces or special chars
  const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  if (!sanitizedUsername) {
    throw new Error('Invalid username format');
  }

  try {
    await db
      .update(users)
      .set({
        username: sanitizedUsername,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
      
    return { success: true, username: sanitizedUsername };
  } catch (err: any) {
    if (err.code === '23505') {
      throw new Error('This username is already taken. Please choose another one.');
    }
    throw err;
  }
}
