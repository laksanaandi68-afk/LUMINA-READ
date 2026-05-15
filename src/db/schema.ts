import { pgTable, uuid, text, timestamp, integer, boolean, date, decimal } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  display_name: text('display_name'),
  username: text('username').unique(),
  role: text('role').default('user'),
  avatar_url: text('avatar_url'),
  phone_number: text('phone_number'),
  monthly_target: integer('monthly_target').default(5),
  daily_target: integer('daily_target').default(20),
  status: text('status').default('active'),
  last_seen: timestamp('last_seen').defaultNow(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const books = pgTable('books', {
  id: uuid('id').defaultRandom().primaryKey(),
  owner_id: uuid('owner_id').references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  author: text('author').notNull(),
  genre: text('genre'),
  synopsis: text('synopsis'),
  content: text('content').default(''),
  cover_url: text('cover_url'),
  total_pages: integer('total_pages').default(100),
  current_page: integer('current_page').default(0),
  status: text('status').default('Belum Dimulai'),
  rating: decimal('rating').default('0'),
  review_count: integer('review_count').default(0),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reporter_id: uuid('reporter_id').references(() => profiles.id, { onDelete: 'cascade' }),
  reported_user_id: uuid('reported_user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  message_id: uuid('message_id'),
  reason: text('reason').notNull(),
  description: text('description').notNull(),
  status: text('status').default('pending'),
  created_at: timestamp('created_at').defaultNow(),
});

export const testimonials = pgTable('testimonials', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  message: text('message'),
  status: text('status').default('pending'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  event_date: date('event_date').notNull(),
  type: text('type').default('reading'),
  created_at: timestamp('created_at').defaultNow(),
});

export const readingLogs = pgTable('reading_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  reading_date: date('reading_date').defaultNow(),
  pages_read: integer('pages_read').default(0),
  created_at: timestamp('created_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  likes: integer('likes').default(0),
  created_at: timestamp('created_at').defaultNow(),
});
