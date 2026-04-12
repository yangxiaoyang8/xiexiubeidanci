import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, index, jsonb } from "drizzle-orm/pg-core";

// 保留系统表
export const healthCheck = pgTable("health_check", {
  id: integer("id").notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 词库表
export const vocabBooks = pgTable(
  "vocab_books",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    level: varchar("level", { length: 50 }).notNull(),
    total_words: integer("total_words").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [index("vocab_books_level_idx").on(table.level)]
);

// 词汇表
export const words = pgTable(
  "words",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    book_id: varchar("book_id", { length: 36 }).notNull().references(() => vocabBooks.id, { onDelete: "cascade" }),
    word: varchar("word", { length: 100 }).notNull(),
    phonetic: varchar("phonetic", { length: 100 }),
    meaning: text("meaning").notNull(),
    example_sentence: text("example_sentence"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("words_book_id_idx").on(table.book_id),
    index("words_word_idx").on(table.word),
  ]
);

// 小说表
export const novels = pgTable(
  "novels",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    book_id: varchar("book_id", { length: 36 }).notNull().references(() => vocabBooks.id, { onDelete: "cascade" }),
    device_id: varchar("device_id", { length: 64 }), // 设备ID，用于数据隔离
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content"), // 内容可为空（生成中时）
    cover_image: text("cover_image"),
    summary: text("summary"),
    chapter_count: integer("chapter_count").notNull().default(1),
    word_count: integer("word_count").notNull().default(0),
    is_user_uploaded: boolean("is_user_uploaded").notNull().default(false),
    generate_status: varchar("generate_status", { length: 20 }).notNull().default('completed'), // generating, completed, failed
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("novels_book_id_idx").on(table.book_id),
    index("novels_created_at_idx").on(table.created_at),
    index("novels_device_id_idx").on(table.device_id),
    index("novels_generate_status_idx").on(table.generate_status),
  ]
);

// 小说词汇关系表
export const novelWords = pgTable(
  "novel_words",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    novel_id: varchar("novel_id", { length: 36 }).notNull().references(() => novels.id, { onDelete: "cascade" }),
    word_id: varchar("word_id", { length: 36 }).notNull().references(() => words.id, { onDelete: "cascade" }),
    position: integer("position"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("novel_words_novel_id_idx").on(table.novel_id),
    index("novel_words_word_id_idx").on(table.word_id),
  ]
);

// 用户小说表
export const userNovels = pgTable(
  "user_novels",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    device_id: varchar("device_id", { length: 64 }), // 设备ID，用于数据隔离
    title: varchar("title", { length: 200 }).notNull(),
    original_content: text("original_content").notNull(),
    processed_content: text("processed_content"),
    book_id: varchar("book_id", { length: 36 }).notNull().references(() => vocabBooks.id, { onDelete: "cascade" }),
    is_processed: boolean("is_processed").notNull().default(false),
    vocabulary_list: jsonb("vocabulary_list"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("user_novels_book_id_idx").on(table.book_id),
    index("user_novels_created_at_idx").on(table.created_at),
    index("user_novels_device_id_idx").on(table.device_id),
  ]
);

// 生成次数限制表
export const generateLimits = pgTable(
  "generate_limits",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    device_id: varchar("device_id", { length: 64 }).notNull(),
    week_start: varchar("week_start", { length: 10 }).notNull(), // 周起始日期 YYYY-MM-DD
    count: integer("count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("generate_limits_device_id_idx").on(table.device_id),
    index("generate_limits_week_start_idx").on(table.week_start),
  ]
);

// 上传次数限制表
export const uploadLimits = pgTable(
  "upload_limits",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    device_id: varchar("device_id", { length: 64 }).notNull(),
    week_start: varchar("week_start", { length: 10 }).notNull(), // 周起始日期 YYYY-MM-DD
    count: integer("count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("upload_limits_device_id_idx").on(table.device_id),
    index("upload_limits_week_start_idx").on(table.week_start),
  ]
);

// 音频生成进度表（用于断点续传）
export const audioPackProgress = pgTable(
  "audio_pack_progress",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    book_id: varchar("book_id", { length: 36 }).notNull().references(() => vocabBooks.id, { onDelete: "cascade" }),
    word: varchar("word", { length: 100 }).notNull(),
    audio_key: text("audio_key").notNull(), // 对象存储中的key
    audio_size: integer("audio_size").notNull(), // 音频大小（字节）
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audio_pack_progress_book_id_idx").on(table.book_id),
    index("audio_pack_progress_word_idx").on(table.word),
  ]
);

// TTS试用次数表
export const ttsLimits = pgTable(
  "tts_limits",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    device_id: varchar("device_id", { length: 64 }).notNull().unique(), // 每个设备只有一条记录
    count: integer("count").notNull().default(0), // 已使用次数
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("tts_limits_device_id_idx").on(table.device_id),
  ]
);
